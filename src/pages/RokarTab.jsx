import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, getDoc, doc, query, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function RokarTab() {
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rokarData, setRokarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const rokarRef = useRef(null);

  useEffect(() => {
    loadStores();
  }, [profile?.role, profile?.stores]);

  useEffect(() => {
    if (selectedStore && date) {
      loadRokarData();
    }
  }, [selectedStore, date]);

  const loadStores = async () => {
    try {
      console.log('Loading stores for profile:', profile?.role, profile?.stores);
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('All stores loaded:', storesList.length);
      
      // Filter stores for managers - they can only see their assigned stores
      if (profile?.role === 'MANAGER' && profile.stores && typeof profile.stores === 'object') {
        const managerStoreIds = Object.keys(profile.stores).filter(key => profile.stores[key] === true);
        console.log('Manager store IDs:', managerStoreIds);
        storesList = storesList.filter(s => managerStoreIds.includes(s.id));
        console.log('Filtered stores for manager:', storesList.length);
      }
      
      setStores(storesList);
      if (storesList.length > 0) {
        setSelectedStore(storesList[0].id);
        console.log('Selected store:', storesList[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadRokarData = async () => {
    setLoading(true);
    try {
      // Use the same document ID format as RokarEntry
      const documentId = `${selectedStore}_${date}`;
      console.log('Loading rokar data for document ID:', documentId);
      
      const rokarRef = doc(db, 'rokar', documentId);
      const rokarSnap = await getDoc(rokarRef);
      
      if (rokarSnap.exists()) {
        const data = rokarSnap.data();
        console.log('Rokar data found:', data);
        setRokarData({ id: rokarSnap.id, ...data });
      } else {
        console.log('No rokar data found for document ID:', documentId);
        setRokarData(null);
      }
    } catch (error) {
      console.error('Error loading rokar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPreviousDay = (currentDate) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    return date.toISOString().slice(0, 10);
  };

  const getNextDay = (currentDate) => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  };

  const navigateToDay = (newDate) => {
    setDate(newDate);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  // Check if user has permission to delete rokar entries
  const canDeleteRokar = () => {
    return profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN' || profile?.role === 'OWNER';
  };

  // Delete rokar entry
  const handleDeleteRokar = async () => {
    if (!rokarData || !canDeleteRokar()) {
      alert('You do not have permission to delete rokar entries.');
      return;
    }

    if (!confirm(`Are you sure you want to delete the rokar entry for ${selectedStore} on ${date}?\n\nThis action cannot be undone and will permanently remove all data for this date.`)) {
      return;
    }

    setDeleting(true);
    try {
      const documentId = `${selectedStore}_${date}`;
      await deleteDoc(doc(db, 'rokar', documentId));
      
      alert(`Rokar entry for ${date} has been deleted successfully. The manager can now add new data for this date.`);
      
      // Clear the current data
      setRokarData(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting rokar entry:', error);
      alert('Failed to delete rokar entry: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const downloadAsJPG = async () => {
    if (!rokarRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(rokarRef.current, {
        backgroundColor: '#fefce8',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `rokar-${selectedStore}-${date}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    } catch (error) {
      console.error('Error downloading as JPG:', error);
      alert('Failed to download as JPG. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const downloadAsPDF = async () => {
    if (!rokarRef.current) return;
    
    setDownloading(true);
    try {
      const canvas = await html2canvas(rokarRef.current, {
        backgroundColor: '#fefce8',
        scale: 2,
        useCORS: true,
        allowTaint: true
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 20; // 10mm margin on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add title
      pdf.setFontSize(16);
      pdf.text('Rokar Book Report', pdfWidth / 2, 15, { align: 'center' });
      pdf.setFontSize(12);
      pdf.text(`Store: ${stores.find(s => s.id === selectedStore)?.name || 'Unknown'}`, 10, 25);
      pdf.text(`Date: ${formatDate(date)}`, 10, 32);
      
      // Add image
      pdf.addImage(imgData, 'JPEG', 10, 40, imgWidth, imgHeight);
      
      pdf.save(`rokar-${selectedStore}-${date}.pdf`);
    } catch (error) {
      console.error('Error downloading as PDF:', error);
      alert('Failed to download as PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (stores.length === 0) {
    return <div className="p-6">Loading stores...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {profile?.role === 'MANAGER' ? 'My Store Rokar Book' : 'Rokar Book'}
        </h1>
        
        {/* Download and Delete Buttons */}
        {rokarData && (
          <div className="flex gap-2">
            <button
              onClick={downloadAsJPG}
              disabled={downloading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {downloading ? 'Downloading...' : 'Download JPG'}
            </button>
            <button
              onClick={downloadAsPDF}
              disabled={downloading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloading ? 'Downloading...' : 'Download PDF'}
            </button>
            
            {/* Delete Button - Only for Admin/Owner/SuperAdmin */}
            {canDeleteRokar() && (
              <button
                onClick={handleDeleteRokar}
                disabled={deleting}
                className="px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 disabled:opacity-60 flex items-center gap-2"
                title="Delete this rokar entry (Admin/Owner only)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? 'Deleting...' : 'Delete Entry'}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Store and Date Selection */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Store</label>
          <select 
            value={selectedStore} 
            onChange={(e) => setSelectedStore(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {stores.map(store => (
              <option key={store.id} value={store.id}>
                {store.brand} — {store.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex justify-between items-center border-t pt-4 mb-4">
        <button 
          onClick={() => navigateToDay(getPreviousDay(date))}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Previous Day</span>
        </button>
        
        <div className="text-center">
          <p className="text-sm text-gray-600">Current Date</p>
          <p className="font-semibold text-gray-800">{formatDate(date)}</p>
        </div>
        
        <button 
          onClick={() => navigateToDay(getNextDay(date))}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
        >
          <span>Next Day</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Download Status */}
      {downloading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Generating download... Please wait.</span>
          </div>
        </div>
      )}

      {/* Rokar Display */}
      {loading ? (
        <div className="text-center py-8">
          <p>Loading rokar data...</p>
        </div>
      ) : rokarData ? (
        <div ref={rokarRef} className="mt-6 bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 font-serif">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-yellow-800">रोकड़ बही (Rokar Book)</h2>
            <p className="text-yellow-700">{formatDate(date)}</p>
            <p className="text-yellow-700">{stores.find(s => s.id === selectedStore)?.name}</p>
          </div>

          {/* Opening Balance */}
          <div className="mb-4 p-3 bg-yellow-100 rounded">
            <h3 className="font-bold text-yellow-800">Opening Balance / आरंभिक शेष</h3>
            <p className="text-xl font-bold text-yellow-900">{formatCurrency(rokarData.openingBalance)}</p>
          </div>

          {/* Income Section */}
          <div className="mb-4">
            <h3 className="font-bold text-green-800 mb-2">Income / आय</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Computer Sale / कंप्यूटर बिक्री:</span>
                <span className="font-bold">{formatCurrency(rokarData.computerSale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Manual Sale / मैनुअल बिक्री:</span>
                <span className="font-bold">{formatCurrency(rokarData.manualSale)}</span>
              </div>
              <div className="flex justify-between">
                <span>Manual Billed / मैनुअल बिल:</span>
                <span className="font-bold text-red-600">-{formatCurrency(rokarData.manualBilled)}</span>
              </div>
              <div className="border-t pt-1">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total Sale / कुल बिक्री:</span>
                  <span>{formatCurrency(rokarData.totalSale)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Digital Payments */}
          <div className="mb-4">
            <h3 className="font-bold text-blue-800 mb-2">Digital Payments / डिजिटल भुगतान</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Paytm:</span>
                <span>{formatCurrency(rokarData.payments?.paytm)}</span>
              </div>
              <div className="flex justify-between">
                <span>PhonePe:</span>
                <span>{formatCurrency(rokarData.payments?.phonepe)}</span>
              </div>
              <div className="flex justify-between">
                <span>GPay:</span>
                <span>{formatCurrency(rokarData.payments?.gpay)}</span>
              </div>
              <div className="flex justify-between">
                <span>Bank Deposit:</span>
                <span>{formatCurrency(rokarData.payments?.bankDeposit)}</span>
              </div>
              <div className="flex justify-between">
                <span>Home:</span>
                <span>{formatCurrency(rokarData.payments?.home)}</span>
              </div>
              <div className="border-t pt-1">
                <div className="flex justify-between font-bold">
                  <span>Total Cash Out:</span>
                  <span>{formatCurrency(rokarData.totalCashOut)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="mb-4">
            <h3 className="font-bold text-red-800 mb-2">Expenses / खर्च</h3>
            <div className="space-y-1 text-sm">
              {rokarData.expenseBreakup && Object.entries(rokarData.expenseBreakup).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span>{key}:</span>
                  <span>{formatCurrency(value)}</span>
                </div>
              ))}
              <div className="border-t pt-1">
                <div className="flex justify-between font-bold">
                  <span>Total Expenses:</span>
                  <span>{formatCurrency(rokarData.expenseTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Staff Salary */}
          <div className="mb-4">
            <h3 className="font-bold text-purple-800 mb-2">Staff Salary / कर्मचारी वेतन</h3>
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Total Staff Salary:</span>
                <span className="font-bold">{formatCurrency(rokarData.staffSalaryTotal)}</span>
              </div>
            </div>
          </div>

          {/* Dues */}
          <div className="mb-4">
            <h3 className="font-bold text-orange-800 mb-2">Dues / बकाया</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Dues Given:</span>
                <span>{formatCurrency(rokarData.duesGiven)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dues Paid:</span>
                <span>{formatCurrency(rokarData.duesPaid)}</span>
              </div>
            </div>
          </div>

          {/* Closing Balance */}
          <div className="mt-6 p-4 bg-yellow-200 rounded border-2 border-yellow-300">
            <h3 className="font-bold text-yellow-900 text-lg">Closing Balance / समापन शेष</h3>
            <p className="text-2xl font-bold text-yellow-900">{formatCurrency(rokarData.closingBalance)}</p>
          </div>

          {/* Cash Breakdown */}
          {rokarData.cashBreakdown && (
            <div className="mt-4 p-4 bg-green-50 rounded border border-green-200">
              <h3 className="font-bold text-green-800 mb-3">Cash Breakdown / नकद विवरण</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹5 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs5 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹10 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs10 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹20 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs20 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹50 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs50 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹100 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs100 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹200 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs200 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">₹500 Notes:</div>
                  <div className="font-bold">{rokarData.cashBreakdown.rs500 || 0}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">Coins:</div>
                  <div className="font-bold">{formatCurrency(rokarData.cashBreakdown.coins || 0)}</div>
                </div>
                <div className="p-2 bg-green-100 rounded">
                  <div className="text-green-700">Foreign Cash:</div>
                  <div className="font-bold">{formatCurrency(rokarData.cashBreakdown.foreignCash || 0)}</div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-green-200 rounded text-center">
                <div className="text-green-800 font-bold">Total Cash: {formatCurrency(rokarData.cashTotal || 0)}</div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-yellow-700">
            <p>Prepared by: {rokarData.createdBy || 'System'}</p>
            <p>Date: {formatDate(date)}</p>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No rokar data found for this date.</p>
        </div>
      )}
    </div>
  );
}
