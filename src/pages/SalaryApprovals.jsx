import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

export default function SalaryApprovals(){
  const { profile, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  useEffect(()=>{ (async()=>{
    const ss = await getDocs(collection(db,'stores'));
    let list = ss.docs.map(d=>({id:d.id, ...d.data()}));
    
    // Use new consistent access control pattern
    const userStores = getStoresForFiltering();
    if (userStores.length > 0) {
      list = list.filter(s => userStores.includes(s.id));
    }
    
    setStores(list);
  })() }, [profile?.role, profile?.assignedStore]);

  // Load salary requests when component mounts
  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      // Load stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storesList);

      // Load salary requests
      let requestsQuery;

      // Get user's accessible stores
      const userStores = getStoresForFiltering();
      console.log('SalaryApprovals: User accessible stores:', userStores);

      if (userStores.length > 0) {
        // User has specific store access - filter by those stores
        console.log('SalaryApprovals: Filtering by specific stores:', userStores);
        
        // For managers, use their assigned store
        if (profile?.role === 'MANAGER' && userStores.length > 0) {
          const managerStoreId = userStores[0];
          console.log('SalaryApprovals: Manager filtering by store:', managerStoreId);
          
          requestsQuery = query(
            collection(db, 'salary_requests'),
            where('storeId', '==', managerStoreId),
            orderBy('createdAt', 'desc')
          );
        } else {
          // For other roles with specific store access, filter by those stores
          // Since Firestore doesn't support 'in' queries with orderBy, we'll need to handle this differently
          console.log('SalaryApprovals: Multiple store filtering not supported, loading all and filtering client-side');
          requestsQuery = query(
            collection(db, 'salary_requests'),
            orderBy('createdAt', 'desc')
          );
        }
      } else {
        // Admin/Owner can see all requests
        console.log('SalaryApprovals: Loading all salary requests for admin/owner');
        requestsQuery = query(
          collection(db, 'salary_requests'),
          orderBy('createdAt', 'desc')
        );
      }

      const requestsSnap = await getDocs(requestsQuery);
      const requestsList = requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Apply client-side filtering for store access
      let filteredRequests = requestsList;
      
      if (userStores.length > 0) {
        // Filter requests to only show those from user's accessible stores
        filteredRequests = requestsList.filter(request => {
          const hasAccess = request.storeId && userStores.includes(request.storeId);
          console.log(`SalaryApprovals: Request ${request.id} store access check:`, {
            requestStoreId: request.storeId,
            userStores: userStores,
            hasAccess: hasAccess
          });
          return hasAccess;
        });
      }
      
      console.log('SalaryApprovals: Final filtered requests:', filteredRequests.length);
      setRequests(filteredRequests);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (requestId, status, paymentDate = null) => {
    try {
      const updateData = {
        status: status,
        updatedAt: new Date(),
        updatedBy: profile.email
      };

      // If approving, add payment date
      if (status === 'approved') {
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
        updateData.paymentDate = paymentDate || today;
        console.log('SalaryApprovals: Adding payment date for approved request:', updateData.paymentDate);
      }

      await updateDoc(doc(db, 'salary_requests', requestId), updateData);
      
      // Update local state
      setRequests(prev => prev.map(req => 
        req.id === requestId ? { ...req, ...updateData } : req
      ));
      
      alert(`Request ${status} successfully!${status === 'approved' ? ` Payment date set to ${updateData.paymentDate}.` : ''}`);
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating request status');
    }
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase();
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return badges[statusLower] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date) => {
    return new Date(date.toDate()).toLocaleDateString('en-IN');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        {profile?.role === 'MANAGER' ? 'My Store Salary Request Approvals' : 'Salary Request Approvals'}
      </h1>
      
      {requests.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No salary requests found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left border">Employee</th>
                <th className="p-2 text-left border">Store</th>
                <th className="p-2 text-left border">Amount</th>
                <th className="p-2 text-left border">Month</th>
                <th className="p-2 text-left border">Reason</th>
                <th className="p-2 text-left border">Status</th>
                <th className="p-2 text-left border">Payment Date</th>
                <th className="p-2 text-left border">Created</th>
                <th className="p-2 text-left border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td className="p-2 border">
                    <div>
                      <div className="font-medium">{request.userName}</div>
                      <div className="text-sm text-gray-500">{request.userEmail}</div>
                    </div>
                  </td>
                  <td className="p-2 border">
                    {stores.find(s => s.id === request.storeId)?.name || 'Unknown Store'}
                  </td>
                  <td className="p-2 border font-medium">
                    {formatCurrency(request.amount)}
                  </td>
                  <td className="p-2 border">
                    {new Date(request.month + '-01').toLocaleDateString('en-IN', { 
                      year: 'numeric', 
                      month: 'long' 
                    })}
                  </td>
                  <td className="p-2 border">
                    <div className="max-w-xs truncate" title={request.reason}>
                      {request.reason}
                    </div>
                  </td>
                  <td className="p-2 border">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(request.status)}`}>
                      {request.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2 border text-sm">
                    {request.paymentDate ? (
                      <span className="text-green-600 font-medium">{request.paymentDate}</span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="p-2 border text-sm">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="p-2 border">
                    {request.status?.toLowerCase() === 'pending' && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            const paymentDate = window.prompt('Enter payment date (YYYY-MM-DD) or press OK for today:', new Date().toISOString().slice(0, 10));
                            if (paymentDate) {
                              // Validate date format
                              if (/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
                                updateStatus(request.id, 'approved', paymentDate);
                              } else {
                                alert('Please enter a valid date in YYYY-MM-DD format');
                              }
                            }
                          }}
                          className="px-2 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(request.id, 'rejected')}
                          className="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    {request.status?.toLowerCase() !== 'pending' && (
                      <span className="text-xs text-gray-500">
                        {request.updatedBy && `By ${request.updatedBy}`}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Supporting Documents Modal */}
      {requests.some(req => req.supportingDocs?.length > 0) && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Supporting Documents</h3>
          {requests.map((request) => (
            request.supportingDocs?.length > 0 && (
              <div key={request.id} className="mb-4 p-3 border rounded">
                <div className="font-medium mb-2">
                  {request.userName} - {formatCurrency(request.amount)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {request.supportingDocs.map((doc, index) => (
                    <a
                      key={index}
                      href={doc}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                    >
                      Document {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
