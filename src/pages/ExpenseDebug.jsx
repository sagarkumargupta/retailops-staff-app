import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function ExpenseDebug() {
  const { profile } = useUserProfile();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const expensesSnap = await getDocs(collection(db, 'other_expenses'));
      const expensesList = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(expensesList);
      setMessage(`Loaded ${expensesList.length} expense requests`);
      
      // Debug: Log all approved expenses to see their structure
      const approvedExpenses = expensesList.filter(exp => exp.status === 'approved');
      console.log('All approved expenses:', approvedExpenses);
      
      // Check for date format issues
      const today = new Date().toISOString().slice(0, 10);
      const expensesForToday = approvedExpenses.filter(exp => exp.date === today);
      console.log('Approved expenses for today:', today, expensesForToday);
      
    } catch (error) {
      console.error('Error loading expenses:', error);
      setMessage('Error loading expenses: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fixMissingStoreIds = async () => {
    setLoading(true);
    try {
      const expensesWithoutStoreId = expenses.filter(expense => !expense.storeId);
      setMessage(`Found ${expensesWithoutStoreId.length} expenses without storeId`);
      
      if (expensesWithoutStoreId.length === 0) {
        setMessage('All expenses have storeId - no fixes needed');
        return;
      }

      // Show which ones need fixing
      console.log('Expenses without storeId:', expensesWithoutStoreId);
      
      // For expenses without storeId, we need to determine which store they belong to
      // This is tricky because we don't have the store information
      // For now, we'll mark them as needing manual review
      setMessage(`Found ${expensesWithoutStoreId.length} expenses without storeId. These need manual review to assign the correct store.`);
      
      // You can manually fix these by:
      // 1. Looking at the requestedBy field to see who submitted it
      // 2. Checking their assigned store
      // 3. Updating the expense with the correct storeId
      
    } catch (error) {
      console.error('Error fixing expenses:', error);
      setMessage('Error fixing expenses: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fixExpenseStoreId = async (expenseId, newStoreId) => {
    setLoading(true);
    try {
      const expenseRef = doc(db, 'other_expenses', expenseId);
      await updateDoc(expenseRef, {
        storeId: newStoreId
      });
      setMessage(`Updated expense ${expenseId} with storeId: ${newStoreId}`);
      // Reload expenses
      await loadExpenses();
    } catch (error) {
      console.error('Error updating expense:', error);
      setMessage('Error updating expense: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const testRokarQuery = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const testStoreId = prompt('Enter storeId to test query for:');
      
      if (!testStoreId) return;
      
      console.log('Testing RokarEntry query for store:', testStoreId, 'date:', today);
      
      const expenseQuery = query(
        collection(db, 'other_expenses'),
        where('storeId', '==', testStoreId),
        where('status', '==', 'approved'),
        where('date', '==', today)
      );
      
      const expenseSnap = await getDocs(expenseQuery);
      const results = expenseSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('RokarEntry query results:', results);
      setMessage(`RokarEntry query for store ${testStoreId} on ${today} returned ${results.length} expenses: ${JSON.stringify(results, null, 2)}`);
      
    } catch (error) {
      console.error('Error testing RokarEntry query:', error);
      setMessage('Error testing query: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile && ['ADMIN', 'OWNER'].includes(profile.role)) {
      loadExpenses();
    }
  }, [profile]);

  if (!profile || !['ADMIN', 'OWNER'].includes(profile.role)) {
    return (
      <div className="p-6 text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
        <p className="text-gray-600">Only administrators can access this debug page.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Expense Debug Tool</h1>
      
      <div className="mb-6 space-y-4">
        <button
          onClick={loadExpenses}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Loading...' : 'Load All Expenses'}
        </button>
        
        <button
          onClick={fixMissingStoreIds}
          disabled={loading || expenses.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 ml-2"
        >
          Check for Missing StoreIds
        </button>
        
        <button
          onClick={testRokarQuery}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 ml-2"
        >
          Test RokarEntry Query
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700">{message}</p>
        </div>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Expense Requests ({expenses.length})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">StoreId</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debug Info</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {expenses.map((expense) => (
                <tr key={expense.id} className={!expense.storeId ? 'bg-red-50' : ''}>
                  <td className="px-6 py-4 text-sm text-gray-900">{expense.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {expense.storeId ? (
                      <span className="text-green-600">{expense.storeId}</span>
                    ) : (
                      <span className="text-red-600 font-semibold">MISSING!</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      expense.status === 'approved' ? 'bg-green-100 text-green-800' :
                      expense.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {expense.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">₹{expense.amount}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{expense.category}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{expense.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{expense.requestedBy}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {!expense.storeId && (
                      <button
                        onClick={() => {
                          const newStoreId = prompt('Enter the correct storeId for this expense:');
                          if (newStoreId) {
                            fixExpenseStoreId(expense.id, newStoreId);
                          }
                        }}
                        className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                      >
                        Fix StoreId
                      </button>
                                         )}
                   </td>
                   <td className="px-6 py-4 text-sm text-gray-900">
                     <div className="text-xs">
                       <div>Date: {expense.date}</div>
                       <div>Status: {expense.status}</div>
                       <div>StoreId: {expense.storeId || 'null'}</div>
                       <div>Today: {new Date().toISOString().slice(0, 10)}</div>
                       <div>Match: {expense.date === new Date().toISOString().slice(0, 10) ? 'YES' : 'NO'}</div>
                     </div>
                   </td>
                 </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
