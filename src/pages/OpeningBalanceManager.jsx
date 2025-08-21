import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function OpeningBalanceManager() {
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [openingBalance, setOpeningBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore && selectedDate) {
      loadCurrentBalance();
    }
  }, [selectedStore, selectedDate]);

  const loadStores = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storesList);
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadCurrentBalance = async () => {
    try {
      const docId = `${selectedStore}_${selectedDate}`;
      const docRef = doc(db, 'rokar', docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentBalance(data.openingBalance || 0);
        setOpeningBalance(data.openingBalance?.toString() || '');
      } else {
        setCurrentBalance(null);
        setOpeningBalance('');
      }
    } catch (error) {
      console.error('Error loading current balance:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (!selectedStore || !selectedDate || openingBalance === '') {
        setMessage('Please fill in all required fields');
        return;
      }

      const docId = `${selectedStore}_${selectedDate}`;
      const docRef = doc(db, 'rokar', docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Update existing Rokar entry - only update opening balance
        const existingData = docSnap.data();
        await setDoc(docRef, {
          ...existingData,
          openingBalance: Number(openingBalance),
          // Keep all other fields unchanged to avoid making it "substantial"
          updatedBy: profile.email,
          updatedAt: new Date()
        });
      } else {
        // Create new Rokar entry with ONLY opening balance
        await setDoc(docRef, {
          storeId: selectedStore,
          date: selectedDate,
          openingBalance: Number(openingBalance),
          // All other fields set to 0 to ensure it's not considered "substantial"
          computerSale: 0,
          manualSale: 0,
          manualBilled: 0,
          totalSale: 0,
          customerDuesPaid: 0,
          payments: { paytm: 0, phonepe: 0, gpay: 0, bankDeposit: 0, home: 0 },
          duesGiven: 0,
          totalCashOut: 0,
          expenseBreakup: {
            WATER: 0, TEA: 0, DISCOUNT: 0, ALTERATION: 0, 'STAFF LUNCH': 0,
            GENERATOR: 0, 'SHOP RENT': 0, ELECTRICITY: 0, 'HOME EXPENSE': 0, PETROL: 0,
            SUNDAY: 0, 'CASH RETURN': 0, TRANSPORT: 0
          },
          expenseTotal: 0,
          staffSalaryTotal: 0,
          closingBalance: Number(openingBalance),
          createdBy: profile.email,
          createdAt: new Date(),
          isAdminEntry: true
        });
      }

      setShowSuccessModal(true);
      setCurrentBalance(Number(openingBalance));
      
      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);

    } catch (error) {
      console.error('Error updating opening balance:', error);
      setMessage('Error updating opening balance');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  if (!profile) {
    return <div className="p-6">Loading...</div>;
  }

  if (profile.role !== 'ADMIN') {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-600">Only administrators can manage opening balances.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Opening Balance Manager</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store Selection */}
        <div className="relative">
          <select 
            value={selectedStore} 
            onChange={(e) => setSelectedStore(e.target.value)}
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

        {/* Date Selection */}
        <div className="relative">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-2 border rounded peer bg-transparent"
            required
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Date
          </label>
        </div>

        {/* Opening Balance Input */}
        <div className="relative">
          <input
            type="number"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="w-full p-2 border rounded peer bg-transparent"
            placeholder=" "
            required
            step="0.01"
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Opening Balance (₹)
          </label>
        </div>



        {/* Current Values Display */}
        {currentBalance !== null && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-3">Current Values:</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Opening Balance:</span>
                <span className="font-medium text-blue-600">
                  {formatCurrency(currentBalance)}
                </span>
              </div>

            </div>
            <p className="text-sm text-blue-600 mt-3 pt-2 border-t border-blue-200">
              These values will be updated to your new entries
            </p>
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {loading ? 'Updating...' : 'Update Opening Balance'}
        </button>
      </form>

      {/* Info Section */}
      <div className="mt-8 bg-gray-50 p-4 rounded-lg">
        <h3 className="font-medium text-gray-800 mb-2">How it works:</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• <strong>Opening Balance:</strong> Required field - sets the starting cash for the day</li>
          <li>• If Rokar entry exists, only the opening balance will be updated while preserving other data</li>
          <li>• If no entry exists, a new Rokar entry will be created with the opening balance</li>
          <li>• This action is logged with your admin credentials for audit purposes</li>
          <li>• Use this feature carefully as it affects financial calculations</li>
        </ul>
      </div>

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
              Opening Balance Updated! ✅
            </h3>
            
            <p className="text-gray-600 mb-6">
              The opening balance has been successfully updated for the selected store and date.
            </p>
            
            {/* Updated Info */}
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Store:</span> {stores.find(s => s.id === selectedStore)?.name || 'Unknown Store'}
              </p>
              <p className="text-sm text-blue-800">
                <span className="font-semibold">Date:</span> {new Date(selectedDate).toLocaleDateString('en-IN', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </p>
              <div className="space-y-1 mt-2">
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Opening Balance:</span> {formatCurrency(openingBalance)}
                </p>
              </div>
            </div>
            
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

