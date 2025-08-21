import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function StaffPaymentLedger() {
  const { profile, hasPermission, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form states for new entry
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'SALARY', // SALARY, ADVANCE, BONUS, DEDUCTION
    amount: '',
    description: '',
    paymentMethod: 'CASH', // CASH, BANK, UPI
    reference: '',
    notes: ''
  });

  // Calculate totals
  const [totals, setTotals] = useState({
    totalSalary: 0,
    totalAdvances: 0,
    totalBonuses: 0,
    totalDeductions: 0,
    netAmount: 0
  });

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadStaff();
      loadLedgerEntries();
    }
  }, [selectedStore, selectedStaff]);

  const loadStores = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores based on user permissions
      const userStores = getStoresForFiltering();
      if (userStores.length > 0) {
        storesList = storesList.filter(store => userStores.includes(store.id));
      }
      
      setStores(storesList);
      if (storesList.length > 0) {
        setSelectedStore(storesList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      setMessage('❌ Error loading stores: ' + error.message);
    }
  };

  const loadStaff = async () => {
    if (!selectedStore) return;
    
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter staff for selected store
      const storeStaff = allUsers.filter(user => 
        user.role === 'STAFF' && 
        user.assignedStore === selectedStore &&
        (user.status === 'ACTIVE' || user.isActive === true)
      );
      
      setStaffList(storeStaff);
    } catch (error) {
      console.error('Error loading staff:', error);
      setMessage('❌ Error loading staff: ' + error.message);
    }
  };

  const loadLedgerEntries = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    try {
      let ledgerQuery = query(
        collection(db, 'staffPayments'),
        where('storeId', '==', selectedStore),
        orderBy('date', 'desc')
      );

      if (selectedStaff) {
        ledgerQuery = query(
          collection(db, 'staffPayments'),
          where('storeId', '==', selectedStore),
          where('staffEmail', '==', selectedStaff),
          orderBy('date', 'desc')
        );
      }

      const ledgerSnap = await getDocs(ledgerQuery);
      const entries = ledgerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setLedgerEntries(entries);
      calculateTotals(entries);
    } catch (error) {
      console.error('Error loading ledger entries:', error);
      setMessage('❌ Error loading ledger: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (entries) => {
    const totals = entries.reduce((acc, entry) => {
      const amount = Number(entry.amount) || 0;
      
      switch (entry.type) {
        case 'SALARY':
          acc.totalSalary += amount;
          break;
        case 'ADVANCE':
          acc.totalAdvances += amount;
          break;
        case 'BONUS':
          acc.totalBonuses += amount;
          break;
        case 'DEDUCTION':
          acc.totalDeductions += amount;
          break;
      }
      
      return acc;
    }, {
      totalSalary: 0,
      totalAdvances: 0,
      totalBonuses: 0,
      totalDeductions: 0
    });

    totals.netAmount = totals.totalSalary + totals.totalBonuses - totals.totalAdvances - totals.totalDeductions;
    setTotals(totals);
  };

  const handleAddEntry = async () => {
    if (!selectedStore || !selectedStaff || !newEntry.amount) {
      setMessage('❌ Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const staff = staffList.find(s => s.email === selectedStaff);
      
      const entryData = {
        storeId: selectedStore,
        staffEmail: selectedStaff,
        staffName: staff?.name || 'Unknown',
        date: newEntry.date,
        type: newEntry.type,
        amount: Number(newEntry.amount),
        description: newEntry.description,
        paymentMethod: newEntry.paymentMethod,
        reference: newEntry.reference,
        notes: newEntry.notes,
        createdBy: profile.email,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'staffPayments'), entryData);
      
      setMessage('✅ Payment entry added successfully');
      setShowAddModal(false);
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'SALARY',
        amount: '',
        description: '',
        paymentMethod: 'CASH',
        reference: '',
        notes: ''
      });
      
      await loadLedgerEntries();
    } catch (error) {
      console.error('Error adding entry:', error);
      setMessage('❌ Error adding entry: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'SALARY': return 'text-green-600 bg-green-50';
      case 'ADVANCE': return 'text-orange-600 bg-orange-50';
      case 'BONUS': return 'text-blue-600 bg-blue-50';
      case 'DEDUCTION': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'SALARY': return '💰';
      case 'ADVANCE': return '💳';
      case 'BONUS': return '🎉';
      case 'DEDUCTION': return '⚠️';
      default: return '📝';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Payment Ledger</h1>
        <p className="text-gray-600">Classical accounting ledger for staff salary payments and advances</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Store</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.brand} — {store.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member</label>
            <select
              value={selectedStaff}
              onChange={(e) => setSelectedStaff(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Staff</option>
              {staffList.map(staff => (
                <option key={staff.email} value={staff.email}>
                  {staff.name} ({staff.email})
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!selectedStore || !selectedStaff}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Payment Entry
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">₹{totals.totalSalary.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Salary</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">₹{totals.totalAdvances.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Advances</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">₹{totals.totalBonuses.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Bonuses</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-red-600">₹{totals.totalDeductions.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Deductions</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className={`text-2xl font-bold ${totals.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{totals.netAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Net Amount</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Payment Ledger Entries</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading ledger entries...</p>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No payment entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.staffName}</div>
                        <div className="text-sm text-gray-500">{entry.staffEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(entry.type)}`}>
                        {getTypeIcon(entry.type)} {entry.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{entry.amount?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {entry.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.reference || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {entry.notes || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entry.createdBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Add Payment Entry
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({...newEntry, date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newEntry.type}
                    onChange={(e) => setNewEntry({...newEntry, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SALARY">Salary</option>
                    <option value="ADVANCE">Advance</option>
                    <option value="BONUS">Bonus</option>
                    <option value="DEDUCTION">Deduction</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={newEntry.amount}
                    onChange={(e) => setNewEntry({...newEntry, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter amount"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newEntry.description}
                    onChange={(e) => setNewEntry({...newEntry, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Payment description"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={newEntry.paymentMethod}
                    onChange={(e) => setNewEntry({...newEntry, paymentMethod: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                  <input
                    type="text"
                    value={newEntry.reference}
                    onChange={(e) => setNewEntry({...newEntry, reference: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Transaction reference"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={newEntry.notes}
                    onChange={(e) => setNewEntry({...newEntry, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Additional notes"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <div className="flex space-x-3">
                <button
                  onClick={handleAddEntry}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Entry'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
