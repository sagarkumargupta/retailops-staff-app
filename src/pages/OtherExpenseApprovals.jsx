import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, updateDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import useUserProfile from '../hooks/useUserProfile';

export default function OtherExpenseApprovals() {
  const { profile, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreId] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [message, setMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Load stores when component mounts
  useEffect(() => {
    (async () => {
      console.log('OtherExpenseApprovals: Loading stores for profile:', profile?.role, profile?.stores);
      const ss = await getDocs(collection(db, 'stores'));
      let list = ss.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('OtherExpenseApprovals: All stores loaded:', list.length);
      
      // Use new consistent access control pattern
      const userStores = getStoresForFiltering();
      console.log('OtherExpenseApprovals: User stores for filtering:', userStores);
      if (userStores.length > 0) {
        list = list.filter(s => userStores.includes(s.id));
        console.log('OtherExpenseApprovals: Filtered stores for user:', list.length);
        
        // For managers, automatically set the store ID to their assigned store
        if (profile?.role === 'MANAGER' && userStores.length > 0) {
          setStoreId(userStores[0]); // Set to first assigned store
          console.log('OtherExpenseApprovals: Auto-set store ID for manager:', userStores[0]);
        }
      }
      
      setStores(list);
    })();
  }, [profile?.role, profile?.assignedStore]);

  // Load expense requests when component mounts or profile changes
  useEffect(() => {
    if (profile) {
      console.log('OtherExpenseApprovals: Profile loaded, starting data load');
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      console.log('OtherExpenseApprovals: Starting data load for role:', profile?.role);
      setLoading(true);
      setMessage('');

      // Load stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storesList);

      // Load expense requests
      let expensesQuery;

      // If manager, filter by their stores
      if (profile?.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
        const managerStoreIds = Object.keys(profile.stores).filter(key => profile.stores[key] === true);
        console.log('OtherExpenseApprovals: Manager store IDs:', managerStoreIds);
        
        if (managerStoreIds.length > 0) {
          // For managers, use the first store ID (since they should only have one)
          const managerStoreId = managerStoreIds[0];
          console.log('OtherExpenseApprovals: Using manager store ID:', managerStoreId);
          
          expensesQuery = query(
            collection(db, 'other_expenses'),
            where('storeId', '==', managerStoreId),
            orderBy('requestedAt', 'desc')
          );
        } else {
          console.log('OtherExpenseApprovals: No stores assigned to manager');
          // No stores assigned, return empty
          setExpenses([]);
          setLoading(false);
          return;
        }
      } else {
        // For admin, load all requests
        console.log('OtherExpenseApprovals: Loading all expenses for admin');
        expensesQuery = query(
          collection(db, 'other_expenses'),
          orderBy('requestedAt', 'desc')
        );
      }

      console.log('OtherExpenseApprovals: Executing query...');
      const expensesSnap = await getDocs(expensesQuery);
      const expensesList = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('OtherExpenseApprovals: Raw expenses found:', expensesList.length);
      
      // Log each expense for debugging
      expensesList.forEach((expense, index) => {
        console.log(`OtherExpenseApprovals: Expense ${index + 1}:`, {
          id: expense.id,
          status: expense.status,
          storeId: expense.storeId,
          requestedBy: expense.requestedBy,
          amount: expense.amount,
          category: expense.category,
          requestedAt: expense.requestedAt
        });
      });
      
      // Additional filtering to ensure data integrity
      const filteredExpenses = expensesList.filter(expense => {
        // For managers, double-check that the request belongs to their store
        if (profile?.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
          const managerStoreIds = Object.keys(profile.stores).filter(key => profile.stores[key] === true);
          const belongsToManager = expense.storeId && managerStoreIds.includes(expense.storeId);
          console.log(`OtherExpenseApprovals: Expense ${expense.id} belongs to manager:`, belongsToManager);
          return belongsToManager;
        }
        return true; // For admin, show all requests
      });
      
      console.log('OtherExpenseApprovals: Filtered expenses:', filteredExpenses.length);
      setExpenses(filteredExpenses);
      
    } catch (error) {
      console.error('OtherExpenseApprovals: Error loading data:', error);
      setMessage('Error loading expense requests: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (expenseId, status, approvalPerson) => {
    try {
      console.log('OtherExpenseApprovals: Handling approval for expense:', expenseId, 'status:', status, 'approvalPerson:', approvalPerson);
      
      const expenseRef = doc(db, 'other_expenses', expenseId);
      await updateDoc(expenseRef, {
        status: status,
        approvedBy: profile.email,
        approvedByRole: profile.role,
        approvedAt: serverTimestamp(),
        approvalPerson: approvalPerson
      });

      setSuccessMessage(`Expense request ${status.toLowerCase()} successfully!`);
      setShowSuccessModal(true);
      
      console.log('OtherExpenseApprovals: Expense updated successfully, reloading data...');
      // Reload expenses
      await loadData();

      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);

    } catch (error) {
      console.error('OtherExpenseApprovals: Error updating expense:', error);
      setMessage('Error updating expense request: ' + error.message);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!profile) {
    console.log('OtherExpenseApprovals: Profile not loaded yet');
    return <div className="p-6">Loading...</div>;
  }

  if (!['ADMIN', 'OWNER'].includes(profile.role)) {
    console.log('OtherExpenseApprovals: Access denied for role:', profile.role);
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-600">Only administrators can approve expense requests.</p>
        </div>
      </div>
    );
  }

  console.log('OtherExpenseApprovals: Rendering component with', expenses.length, 'expenses');

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Expense Request Approvals
      </h1>

      {/* Debug Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">Debug Information:</h3>
        <div className="text-xs text-blue-700 space-y-1">
          <p>Role: {profile?.role}</p>
          <p>Email: {profile?.email}</p>
          <p>Stores: {profile?.stores ? Object.keys(profile.stores).filter(k => profile.stores[k]).join(', ') : 'None'}</p>
          <p>Total Expenses Loaded: {expenses.length}</p>
          <p>Loading State: {loading ? 'Yes' : 'No'}</p>
        </div>
      </div>

      {message && (
        <div className={`p-3 rounded mb-4 ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading expense requests...</p>
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">No Pending Requests</h3>
          <p className="text-gray-600">All expense requests have been processed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {expenses.map((expense) => (
            <div key={expense.id} className="bg-white border rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {expense.category || 'Expense Request'}
                  </h3>
                  <p className="text-gray-600 mb-2">{expense.description || 'No description provided'}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-green-600 font-medium">
                      {formatCurrency(expense.amount)}
                    </span>
                    <span className="text-gray-500">
                      Store: {expense.storeId || 'Unknown Store'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {expense.status?.toUpperCase() || 'PENDING'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Requested By:</p>
                  <p className="text-gray-800">{expense.requestedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Requested At:</p>
                  <p className="text-gray-800">{formatDate(expense.requestedAt)}</p>
                </div>
              </div>

              {expense.supportingDocuments && expense.supportingDocuments.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Supporting Documents:</p>
                  <div className="space-y-1">
                    {expense.supportingDocuments.map((doc, index) => (
                      <a
                        key={index}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {doc.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    // For admins and owners, use their name directly
                    if (profile?.role === 'ADMIN' || profile?.role === 'OWNER') {
                      handleApproval(expense.id, 'approved', profile?.name || 'Admin');
                    } else {
                      // For others, use the prompt system
                      const approvalPerson = window.prompt('Select approval person (Akash Sir, Sagar Sir, Badal Sir):');
                      if (approvalPerson && ['Akash Sir', 'Sagar Sir', 'Badal Sir'].includes(approvalPerson)) {
                        handleApproval(expense.id, 'approved', approvalPerson);
                      } else if (approvalPerson) {
                        alert('Please select a valid approval person: Akash Sir, Sagar Sir, or Badal Sir');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleApproval(expense.id, 'rejected', null)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-2xl max-w-md w-full mx-4 text-center shadow-2xl">
            {/* Success Icon */}
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Success Message */}
            <h3 className="text-2xl font-bold text-gray-800 mb-4">
              Request Updated! ✅
            </h3>
            
            <p className="text-gray-600 mb-6">
              {successMessage}
            </p>
            
            {/* Action Button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


