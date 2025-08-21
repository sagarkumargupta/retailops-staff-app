import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function OtherExpenseRequest() {
  const { profile } = useUserProfile();
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    storeId: ''
  });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);

  const categories = [
    'RENT', 'ELECTRICITY', 'WATER', 'GAS', 'INTERNET', 'MAINTENANCE',
    'CLEANING', 'SECURITY', 'MARKETING', 'TRANSPORT', 'OTHER'
  ];

  // Load stores when component mounts
  useEffect(() => {
    const loadStores = async () => {
      try {
        setStoresLoading(true);
        const storesSnap = await getDocs(collection(db, 'stores'));
        const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // For managers, filter to only their assigned stores
        if (profile?.role === 'MANAGER' && profile.assignedStore) {
          const filteredStores = storesList.filter(store => store.id === profile.assignedStore);
          setStores(filteredStores);
          
          // Auto-select the manager's assigned store
          if (filteredStores.length > 0) {
            setFormData(prev => ({ ...prev, storeId: profile.assignedStore }));
          }
        } else {
          // For admins, show all stores
          setStores(storesList);
        }
      } catch (error) {
        console.error('Error loading stores:', error);
        setMessage('Error loading stores. Please refresh the page.');
      } finally {
        setStoresLoading(false);
      }
    };

    if (profile) {
      loadStores();
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Validation
      if (!profile) {
        setMessage('User profile not loaded. Please try again.');
        return;
      }

      if (!formData.amount || !formData.category || !formData.description || !formData.date) {
        setMessage('Please fill in all required fields.');
        return;
      }

      // For admins, ensure store is selected
      if (profile?.role !== 'MANAGER' && !formData.storeId) {
        setMessage('Please select a store for this expense request.');
        return;
      }

      // For managers, ensure they have an assigned store
      if (profile?.role === 'MANAGER' && !profile.assignedStore) {
        setMessage('You do not have an assigned store. Please contact your administrator.');
        return;
      }

      const amount = Number(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        setMessage('Please enter a valid amount greater than 0.');
        return;
      }

      // Prepare expense data
      const expenseData = {
        amount: amount,
        category: formData.category,
        description: formData.description,
        date: formData.date,
        storeId: profile?.role === 'MANAGER' ? profile.assignedStore : formData.storeId,
        status: 'pending',
        requestedBy: profile.email,
        requestedByRole: profile.role,
        requestedAt: serverTimestamp(),
        approvedBy: null,
        approvedAt: null,
        supportingDocuments: []
      };

      console.log('OtherExpenseRequest: Setting storeId:', expenseData.storeId, 'for role:', profile.role);

      // Upload file if provided
      if (file) {
        try {
          const fileName = `other-expenses/${Date.now()}_${file.name}`;
          const storageRef = ref(storage, fileName);
          await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(storageRef);
          expenseData.supportingDocuments.push({
            name: file.name,
            url: downloadURL,
            uploadedAt: serverTimestamp()
          });
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          // Continue without file if upload fails
        }
      }

      // Save expense request
      await addDoc(collection(db, 'other_expenses'), expenseData);

      setShowSuccessModal(true);
      setFormData({
        amount: '',
        category: '',
        description: '',
        date: new Date().toISOString().slice(0, 10),
        storeId: profile?.role === 'MANAGER' ? profile.assignedStore : ''
      });
      setFile(null);

      // Auto-close success modal after 3 seconds
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 3000);

    } catch (error) {
      console.error('Error submitting expense request:', error);
      setMessage('Error submitting expense request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file size (5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setMessage('File size must be less than 5MB.');
        return;
      }
      setFile(selectedFile);
      setMessage('');
    }
  };

  if (!profile) {
    return <div className="p-6">Loading...</div>;
  }

  if (storesLoading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-2 text-gray-600">Loading stores...</p>
      </div>
    );
  }

  if (!['ADMIN', 'OWNER', 'MANAGER'].includes(profile.role)) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-600">Only administrators and managers can submit expense requests.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Submit Expense Request</h1>
      
      {profile?.role === 'MANAGER' && profile.assignedStore && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> You are submitting this expense request for your assigned store. 
            The store selection has been automatically set for you.
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount */}
        <div className="relative">
          <input
            type="number"
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: e.target.value})}
            className="w-full p-2 border rounded peer bg-transparent"
            placeholder=" "
            required
            step="0.01"
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Amount (₹)
          </label>
        </div>

        {/* Store Selection */}
        <div className="relative">
          <select
            value={formData.storeId}
            onChange={(e) => setFormData({...formData, storeId: e.target.value})}
            className={`w-full p-2 border rounded peer bg-transparent ${
              profile?.role === 'MANAGER' && profile.assignedStore ? 'bg-gray-50' : ''
            }`}
            required
            disabled={storesLoading || (profile?.role === 'MANAGER' && profile.assignedStore)}
          >
            <option value="">{storesLoading ? 'Loading stores...' : 'Select Store'}</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.brand ? `${store.brand} - ${store.name}` : store.name}
              </option>
            ))}
          </select>
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Store {profile?.role === 'MANAGER' && profile.assignedStore && '(Auto-selected)'}
          </label>
          {profile?.role === 'MANAGER' && profile.assignedStore && (
            <p className="text-xs text-blue-600 mt-1">✓ Store automatically selected for your assigned location</p>
          )}
        </div>

        {/* Category */}
        <div className="relative">
          <select
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
            className="w-full p-2 border rounded peer bg-transparent"
            required
          >
            <option value="">Select Category</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Category
          </label>
        </div>

        {/* Description */}
        <div className="relative">
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className="w-full p-2 border rounded peer bg-transparent resize-none"
            placeholder=" "
            required
            rows="3"
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Description
          </label>
        </div>

        {/* Date */}
        <div className="relative">
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full p-2 border rounded peer bg-transparent"
            required
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Date
          </label>
        </div>

        {/* File Upload */}
        <div className="relative">
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full p-2 border rounded peer bg-transparent"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
          <label className="absolute left-2 -top-2.5 bg-white px-1 text-xs text-gray-600 peer-focus:text-blue-600 transition-all">
            Supporting Documents (Optional)
          </label>
          {file && (
            <p className="text-sm text-green-600 mt-1">✓ {file.name} selected</p>
          )}
        </div>

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
          {loading ? 'Submitting...' : 'Submit Expense Request'}
        </button>
      </form>

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
              Expense Request Submitted! ✅
            </h3>
            
            <p className="text-gray-600 mb-6">
              Your expense request has been successfully submitted and is pending approval.
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

