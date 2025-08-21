import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function CustomerPaymentLedger() {
  const { profile, hasPermission, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerList, setCustomerList] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Form states for new entry
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'PAYMENT', // PAYMENT, DUE_GIVEN, DUE_PAID, CREDIT, REFUND
    amount: '',
    description: '',
    paymentMethod: 'CASH', // CASH, CARD, UPI, BANK_TRANSFER, CHEQUE
    reference: '',
    customerName: '',
    customerPhone: '',
    notes: ''
  });

  // Date range filters
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  // Calculate totals
  const [totals, setTotals] = useState({
    totalPayments: 0,
    totalDuesGiven: 0,
    totalDuesPaid: 0,
    totalCredits: 0,
    totalRefunds: 0,
    netAmount: 0,
    outstandingDues: 0
  });

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadCustomers();
      loadLedgerEntries();
    }
  }, [selectedStore, selectedCustomer, dateRange]);

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

  const loadCustomers = async () => {
    if (!selectedStore) return;
    
    try {
      // Load customers from dues collection
      const duesQuery = query(
        collection(db, 'dues'),
        where('storeId', '==', selectedStore)
      );
      const duesSnap = await getDocs(duesQuery);
      const duesList = duesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Extract unique customers
      const uniqueCustomers = [];
      const customerMap = new Map();
      
      duesList.forEach(due => {
        const customerKey = due.customerPhone || due.customerName;
        if (customerKey && !customerMap.has(customerKey)) {
          customerMap.set(customerKey, {
            name: due.customerName || 'Unknown',
            phone: due.customerPhone || '',
            email: due.customerEmail || ''
          });
          uniqueCustomers.push({
            name: due.customerName || 'Unknown',
            phone: due.customerPhone || '',
            email: due.customerEmail || ''
          });
        }
      });
      
      setCustomerList(uniqueCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
      setMessage('❌ Error loading customers: ' + error.message);
    }
  };

  const loadLedgerEntries = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    try {
      let ledgerQuery = query(
        collection(db, 'customerPayments'),
        where('storeId', '==', selectedStore),
        where('date', '>=', dateRange.from),
        where('date', '<=', dateRange.to),
        orderBy('date', 'desc')
      );

      if (selectedCustomer) {
        ledgerQuery = query(
          collection(db, 'customerPayments'),
          where('storeId', '==', selectedStore),
          where('customerPhone', '==', selectedCustomer),
          where('date', '>=', dateRange.from),
          where('date', '<=', dateRange.to),
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
        case 'PAYMENT':
          acc.totalPayments += amount;
          break;
        case 'DUE_GIVEN':
          acc.totalDuesGiven += amount;
          break;
        case 'DUE_PAID':
          acc.totalDuesPaid += amount;
          break;
        case 'CREDIT':
          acc.totalCredits += amount;
          break;
        case 'REFUND':
          acc.totalRefunds += amount;
          break;
      }
      
      return acc;
    }, {
      totalPayments: 0,
      totalDuesGiven: 0,
      totalDuesPaid: 0,
      totalCredits: 0,
      totalRefunds: 0
    });

    totals.netAmount = totals.totalPayments + totals.totalDuesPaid - totals.totalDuesGiven - totals.totalCredits - totals.totalRefunds;
    totals.outstandingDues = totals.totalDuesGiven - totals.totalDuesPaid;
    setTotals(totals);
  };

  const handleAddEntry = async () => {
    if (!selectedStore || !newEntry.amount || !newEntry.customerName) {
      setMessage('❌ Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const entryData = {
        storeId: selectedStore,
        date: newEntry.date,
        type: newEntry.type,
        amount: Number(newEntry.amount),
        description: newEntry.description,
        paymentMethod: newEntry.paymentMethod,
        reference: newEntry.reference,
        customerName: newEntry.customerName,
        customerPhone: newEntry.customerPhone,
        notes: newEntry.notes,
        createdBy: profile.email,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'customerPayments'), entryData);
      
      // If this is a due transaction, also update the dues collection
      if (newEntry.type === 'DUE_GIVEN' || newEntry.type === 'DUE_PAID') {
        await addDoc(collection(db, 'dues'), {
          storeId: selectedStore,
          customerName: newEntry.customerName,
          customerPhone: newEntry.customerPhone,
          amount: newEntry.type === 'DUE_GIVEN' ? Number(newEntry.amount) : -Number(newEntry.amount),
          type: newEntry.type,
          date: newEntry.date,
          description: newEntry.description,
          createdBy: profile.email,
          createdAt: serverTimestamp()
        });
      }
      
      setMessage('✅ Payment entry added successfully');
      setShowAddModal(false);
      setNewEntry({
        date: new Date().toISOString().split('T')[0],
        type: 'PAYMENT',
        amount: '',
        description: '',
        paymentMethod: 'CASH',
        reference: '',
        customerName: '',
        customerPhone: '',
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
      case 'PAYMENT': return 'text-green-600 bg-green-50';
      case 'DUE_GIVEN': return 'text-orange-600 bg-orange-50';
      case 'DUE_PAID': return 'text-blue-600 bg-blue-50';
      case 'CREDIT': return 'text-purple-600 bg-purple-50';
      case 'REFUND': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'PAYMENT': return '💰';
      case 'DUE_GIVEN': return '📝';
      case 'DUE_PAID': return '✅';
      case 'CREDIT': return '💳';
      case 'REFUND': return '↩️';
      default: return '📄';
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Payment Ledger</h1>
        <p className="text-gray-600">Classical accounting ledger for customer payments, dues, and credit transactions</p>
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
        <div className="grid md:grid-cols-5 gap-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customerList.map((customer, index) => (
                <option key={index} value={customer.phone}>
                  {customer.name} ({customer.phone})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!selectedStore}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Payment Entry
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">₹{totals.totalPayments.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Payments</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">₹{totals.totalDuesGiven.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Dues Given</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">₹{totals.totalDuesPaid.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Dues Paid</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">₹{totals.totalCredits.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Credits</div>
        </div>
      </div>

      {/* Additional Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-red-600">₹{totals.totalRefunds.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Refunds</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className={`text-2xl font-bold ${totals.netAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{totals.netAmount.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Net Amount</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">₹{totals.outstandingDues.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Outstanding Dues</div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Customer Payment Ledger Entries</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading ledger entries...</p>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No payment entries found for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
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
                        <div className="text-sm font-medium text-gray-900">{entry.customerName}</div>
                        <div className="text-sm text-gray-500">{entry.customerPhone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(entry.type)}`}>
                        {getTypeIcon(entry.type)} {entry.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{entry.amount?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {entry.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.paymentMethod?.replace('_', ' ')}
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
                Add Customer Payment Entry
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
                    <option value="PAYMENT">Payment</option>
                    <option value="DUE_GIVEN">Due Given</option>
                    <option value="DUE_PAID">Due Paid</option>
                    <option value="CREDIT">Credit</option>
                    <option value="REFUND">Refund</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    value={newEntry.customerName}
                    onChange={(e) => setNewEntry({...newEntry, customerName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Customer name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                  <input
                    type="text"
                    value={newEntry.customerPhone}
                    onChange={(e) => setNewEntry({...newEntry, customerPhone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Phone number"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
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
                    placeholder="Transaction description"
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
                    <option value="CARD">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
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
