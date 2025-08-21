import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, getDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function SalaryRequest() {
  const [user] = useAuthState(auth);
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState(null);
  const [form, setForm] = useState({
    storeId: '',
    amount: '',
    reason: '',
    month: new Date().toISOString().slice(0, 7),
    supportingDocs: []
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [myRequests, setMyRequests] = useState([]);
  const [existingRequests, setExistingRequests] = useState([]);

  useEffect(() => {
    loadStores();
  }, [profile?.role, profile?.stores]);

  useEffect(() => {
    if (user && profile && stores.length > 0) {
      findStaffRecord();
    }
  }, [user, profile, stores]);

  useEffect(() => {
    if (user?.email) {
      loadMyRequests();
    }
  }, [user?.email]);

  const loadStores = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores for managers - they can only see their assigned stores
      if (profile?.role === 'MANAGER' && profile.assignedStore) {
        storesList = storesList.filter(s => s.id === profile.assignedStore);
        console.log('SalaryRequest: Filtered stores for manager:', storesList.length);
      }
      
      setStores(storesList);
      
      // Auto-select the first store for managers
      if (profile?.role === 'MANAGER' && storesList.length > 0) {
        setForm(prev => ({ ...prev, storeId: storesList[0].id }));
        console.log('SalaryRequest: Auto-selected store for manager:', storesList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      setMessage('Error loading stores: ' + error.message);
    }
  };

  const findStaffRecord = async () => {
    try {
      // If user is staff, use their profile directly from users collection
      if (profile.role === 'STAFF') {
        const staffData = {
          id: user.email.toLowerCase(),
          storeId: profile.assignedStore,
          name: profile.name || profile.displayName || user.email?.split('@')[0] || 'Unknown',
          role: profile.staffRole || 'STAFF',
          salary: profile.salary || 0,
          ...profile
        };
        setStaff(staffData);
        setForm(prev => ({ ...prev, storeId: profile.assignedStore }));
        
        // Calculate salary automatically
        calculateSalary(staffData);
      }
    } catch (error) {
      console.error('Error finding staff record:', error);
      setMessage('Error finding staff record: ' + error.message);
    }
  };

  const calculateSalary = (staffData) => {
    if (!staffData.salary) return;

    const monthlySalary = staffData.salary;
    const dailySalary = monthlySalary / 30;
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Calculate working days in current month (excluding weekends)
    let workingDays = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        workingDays++;
      }
    }

    const totalSalary = dailySalary * workingDays;
    const finalSalary = totalSalary - (dailySalary * 2); // Minus 2 days

    setForm(prev => ({
      ...prev,
      amount: finalSalary.toFixed(2)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validation: Staff can only submit for their assigned store
      if (profile.role === 'STAFF') {
        if (form.storeId !== profile.assignedStore) {
          setMessage('You can only submit salary requests for your assigned store.');
          setLoading(false);
          return;
        }
      }

      // Basic validation
      if (!form.storeId) {
        setMessage('Please select a store.');
        setLoading(false);
        return;
      }

      if (!form.amount || form.amount <= 0) {
        setMessage('Please enter a valid amount.');
        setLoading(false);
        return;
      }

      if (form.amount > 100000) {
        setMessage('Salary request amount cannot exceed ₹1,00,000.');
        setLoading(false);
        return;
      }

      if (!form.reason.trim()) {
        setMessage('Please provide a reason for the request.');
        setLoading(false);
        return;
      }
      
      if (form.reason.trim().length < 10) {
        setMessage('Please provide a detailed reason (minimum 10 characters).');
        setLoading(false);
        return;
      }
      
      const requestData = {
        storeId: form.storeId,
        staffId: staff?.id || user.uid,
        staffName: staff?.name || profile?.name || profile?.displayName || user.email?.split('@')[0] || 'Unknown',
        staffRole: staff?.role || profile?.staffRole || profile?.role || 'STAFF',
        userEmail: user.email.toLowerCase(),
        amount: parseFloat(form.amount),
        reason: form.reason,
        month: form.month,
        status: 'PENDING',
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'salary_requests'), requestData);
      
      setMessage('✅ Salary request submitted successfully! Request ID: ' + docRef.id);
      
      // Reset form
      setForm({
        storeId: '',
        amount: '',
        reason: '',
        month: new Date().toISOString().slice(0, 7),
        supportingDocs: []
      });
      
      // Reload requests
      loadMyRequests();
    } catch (error) {
      console.error('Error submitting salary request:', error);
      setMessage('❌ Error submitting salary request: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMyRequests = async () => {
    try {
      // Try the full query first (with orderBy)
      const q = query(
        collection(db, 'salary_requests'),
        where('userEmail', '==', user.email.toLowerCase()),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
      }));
      setMyRequests(requests);
    } catch (error) {
      console.error('Error loading salary requests with orderBy:', error);
      
      // If index error, try without orderBy and sort client-side
      if (error.message.includes('requires an index')) {
        try {
          console.log('Falling back to client-side sorting for salary requests');
          const q = query(
            collection(db, 'salary_requests'),
            where('userEmail', '==', user.email.toLowerCase())
          );
          
          const snapshot = await getDocs(q);
          const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
          }));
          
          // Sort client-side by createdAt descending
          requests.sort((a, b) => {
            const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
            const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
            return dateB - dateA;
          });
          
          setMyRequests(requests);
        } catch (fallbackError) {
          console.error('Fallback query also failed:', fallbackError);
          setMyRequests([]);
        }
      } else {
        setMyRequests([]);
      }
    }
  };

  const handleFileChange = (e) => {
    setForm(prev => ({ ...prev, supportingDocs: Array.from(e.target.files) }));
  };

  if (!profile) {
    return <div className="p-6">Loading...</div>;
  }

  // Check if user has permission to access this page
  if (profile.role === 'OFFICE') {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-600">Office role cannot submit salary requests.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Submit Salary Request</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Selection */}
        {profile?.role === 'ADMIN' ? (
          <div className="relative">
            <select 
              value={form.storeId} 
              onChange={(e) => setForm(prev => ({ ...prev, storeId: e.target.value }))}
              className="w-full p-2 border rounded peer bg-transparent"
              required
            >
              <option value="">Select Store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.brand} — {store.name}
                </option>
              ))}
            </select>
            <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
              Store
            </label>
          </div>
        ) : profile?.role === 'MANAGER' ? (
          <div className="bg-green-50 p-3 rounded border border-green-200">
            <p className="text-sm text-green-800">
              <strong>Your Store:</strong> {stores.find(s => s.id === form.storeId)?.name || 'Loading...'}
            </p>
            <p className="text-xs text-green-600 mt-1">
              Salary request will be submitted for your assigned store
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 p-3 rounded">
            <p className="text-sm text-blue-800">
              <strong>Your Store:</strong> {stores.find(s => s.id === form.storeId)?.name || profile?.storeName || 'Loading...'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              Salary request will be submitted for your assigned store
            </p>
          </div>
        )}

        {/* Amount */}
        <div className="relative">
          <input
            type="number"
            value={form.amount}
            onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
            className="w-full p-2 border rounded peer bg-transparent"
            placeholder=" "
            required
            step="0.01"
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Amount (₹)
          </label>
        </div>

        {/* Month */}
        <div className="relative">
          <input
            type="month"
            value={form.month}
            onChange={(e) => setForm(prev => ({ ...prev, month: e.target.value }))}
            className="w-full p-2 border rounded peer bg-transparent"
            required
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Month
          </label>
        </div>

        {/* Reason */}
        <div className="relative">
          <textarea
            value={form.reason}
            onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full p-2 border rounded peer bg-transparent"
            placeholder=" "
            rows="3"
            required
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Reason for Request
          </label>
        </div>

        {/* Supporting Documents - Disabled for free plan */}
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">File Upload Disabled</h3>
          <p className="text-sm text-yellow-700">
            File uploads are currently disabled due to Firebase free plan limitations. 
            You can still submit salary requests without supporting documents.
          </p>
        </div>

        {/* Salary Calculation Info for Staff */}
        {staff && (
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="font-semibold text-green-800 mb-2">Salary Calculation</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p>Monthly Salary: ₹{staff.salary}</p>
              <p>Daily Salary: ₹{(staff.salary / 30).toFixed(2)}</p>
              <p>Working Days: {new Date().getMonth() === 1 ? 28 : 30} days</p>
              <p>Deduction: 2 days (₹{((staff.salary / 30) * 2).toFixed(2)})</p>
              <p className="font-semibold">Final Amount: ₹{form.amount}</p>
            </div>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Submitting...' : 'Submit Salary Request'}
        </button>
      </form>

      {/* My Salary Requests History */}
      <div className="mt-8 bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">My Salary Requests</h3>
        </div>
        
        {myRequests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No salary requests submitted yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {myRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.createdAt ? new Date(request.createdAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{request.amount?.toLocaleString() || '0'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.month || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {request.reason || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
