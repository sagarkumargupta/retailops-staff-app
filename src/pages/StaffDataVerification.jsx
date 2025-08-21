import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function StaffDataVerification() {
  const { profile } = useUserProfile();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffSubmissions, setStaffSubmissions] = useState([]);
  const [absentStaff, setAbsentStaff] = useState([]);
  const [storeRokarData, setStoreRokarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');
  
  // Edit modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSubmission, setEditingSubmission] = useState(null);
  const [editForm, setEditForm] = useState({
    yesterdaySale: '',
    todayTarget: '',
    googleReviewsDone: '',
    losUpdatesDone: '',
    quantity: '',
    bills: '',
    uniform: 'YES',
    inShoe: 'YES'
  });

  // Calculate yesterday's date for default selection
  const getYesterdayDate = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (profile?.assignedStore) {
      // Set default to yesterday's date
      setSelectedDate(getYesterdayDate());
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.assignedStore && selectedDate) {
      loadData();
    }
  }, [profile, selectedDate]);

  const loadData = async () => {
    if (!profile?.assignedStore) return;
    
    setLoading(true);
    try {
      // Load staff submissions for selected date (this is the submission date)
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('date', '==', selectedDate)
      );
      const attendanceSnap = await getDocs(attendanceQuery);
      const attendanceList = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Load all staff for this store
      const usersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'STAFF'),
        where('assignedStore', '==', profile.assignedStore)
      );
      const usersSnap = await getDocs(usersQuery);
      const allStaff = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter staff submissions for this store
      const storeSubmissions = attendanceList.filter(att => 
        allStaff.some(staff => staff.email === att.staffEmail)
      );

      // Find absent staff (staff without attendance records)
      const presentStaffEmails = storeSubmissions.map(sub => sub.staffEmail);
      const absentStaffList = allStaff.filter(staff => 
        !presentStaffEmails.includes(staff.email)
      );

      setStaffSubmissions(storeSubmissions);
      setAbsentStaff(absentStaffList);

      // Load store rokar data for the sales date (yesterday relative to submission date)
      const salesDate = new Date(selectedDate);
      salesDate.setDate(salesDate.getDate() - 1);
      const salesDateString = salesDate.toISOString().split('T')[0];
      
      const rokarQuery = query(
        collection(db, 'rokar'),
        where('storeId', '==', profile.assignedStore),
        where('date', '==', salesDateString)
      );
      const rokarSnap = await getDocs(rokarQuery);
      const rokarData = rokarSnap.docs.length > 0 ? rokarSnap.docs[0].data() : null;
      setStoreRokarData(rokarData);

    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('❌ Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalSales = () => {
    const submittedSales = staffSubmissions.reduce((sum, sub) => 
      sum + (sub.answers?.yesterdaySale || 0), 0
    );
    return submittedSales;
  };

  const getSalesDifference = () => {
    const totalSubmittedSales = calculateTotalSales();
    const rokarSales = storeRokarData?.totalSale || 0;
    return rokarSales - totalSubmittedSales;
  };

  const handleEditSubmission = (submission) => {
    setEditingSubmission(submission);
    setEditForm({
      yesterdaySale: submission.answers?.yesterdaySale?.toString() || '',
      todayTarget: submission.answers?.todayTarget?.toString() || '',
      googleReviewsDone: submission.answers?.googleReviewsDone?.toString() || '',
      losUpdatesDone: submission.answers?.losUpdatesDone?.toString() || '',
      quantity: submission.answers?.quantity?.toString() || '',
      bills: submission.answers?.bills?.toString() || '',
      uniform: submission.answers?.uniform || 'YES',
      inShoe: submission.answers?.inShoe || 'YES'
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSubmission) return;

    setVerifying(true);
    try {
      const submissionRef = doc(db, 'attendance', editingSubmission.id);
      
      // Prepare updated answers
      const updatedAnswers = {
        ...editingSubmission.answers,
        yesterdaySale: Number(editForm.yesterdaySale) || 0,
        todayTarget: Number(editForm.todayTarget) || 0,
        googleReviewsDone: Number(editForm.googleReviewsDone) || 0,
        losUpdatesDone: Number(editForm.losUpdatesDone) || 0,
        quantity: Number(editForm.quantity) || 0,
        bills: Number(editForm.bills) || 0,
        uniform: editForm.uniform,
        inShoe: editForm.inShoe
      };

      await updateDoc(submissionRef, {
        answers: updatedAnswers,
        editedBy: profile.email,
        editedAt: serverTimestamp(),
        editNotes: `Data edited by manager. Previous sales: ${editingSubmission.answers?.yesterdaySale || 0}, New sales: ${editForm.yesterdaySale}`
      });

      // Send notification to staff about the edit
      await addDoc(collection(db, 'notifications'), {
        recipientEmail: editingSubmission.staffEmail,
        title: 'Your Data Has Been Edited',
        message: `Your attendance data for ${selectedDate} has been edited by your manager. Please review the changes.`,
        type: 'VERIFICATION',
        date: selectedDate,
        createdAt: serverTimestamp(),
        read: false
      });

      setMessage('✅ Data edited successfully. Staff notified.');
      setShowEditModal(false);
      setEditingSubmission(null);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error editing submission:', error);
      setMessage('❌ Error editing data: ' + error.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifySubmission = async (submissionId, isApproved, managerNotes = '') => {
    setVerifying(true);
    try {
      const submissionRef = doc(db, 'attendance', submissionId);
      await updateDoc(submissionRef, {
        verified: true,
        verifiedBy: profile.email,
        verifiedAt: serverTimestamp(),
        isApproved,
        managerNotes,
        verificationStatus: isApproved ? 'APPROVED' : 'REJECTED'
      });

      // Send notification to staff
      const submission = staffSubmissions.find(s => s.id === submissionId);
      if (submission) {
        await addDoc(collection(db, 'notifications'), {
          recipientEmail: submission.staffEmail,
          title: isApproved ? 'Data Approved' : 'Data Requires Correction',
          message: isApproved 
            ? 'Your attendance data has been approved by your manager.'
            : `Your attendance data requires correction. Notes: ${managerNotes}`,
          type: 'VERIFICATION',
          date: selectedDate,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      setMessage(`✅ ${isApproved ? 'Approved' : 'Rejected'} submission successfully`);
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error verifying submission:', error);
      setMessage('❌ Error verifying submission: ' + error.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleAddAbsentStaffSales = async (staffEmail, sales) => {
    setVerifying(true);
    try {
      // Create attendance record for absent staff
      await addDoc(collection(db, 'attendance'), {
        staffEmail,
        date: selectedDate,
        storeId: profile.assignedStore,
        present: false,
        checkIn: null,
        answers: {
          yesterdaySale: Number(sales),
          todayTarget: 0,
          uniform: 'NO',
          inShoe: 'NO',
          googleReviewsDone: 0,
          losUpdatesDone: 0,
          quantity: 0,
          bills: 0
        },
        submittedAt: serverTimestamp(),
        submittedBy: profile.email, // Manager submitted
        verified: true,
        verifiedBy: profile.email,
        verifiedAt: serverTimestamp(),
        isApproved: true,
        managerNotes: 'Sales added by manager for absent staff',
        verificationStatus: 'APPROVED'
      });

      setMessage('✅ Sales added for absent staff successfully');
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error adding absent staff sales:', error);
      setMessage('❌ Error adding sales: ' + error.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleReconcileSales = async () => {
    const difference = getSalesDifference();
    if (Math.abs(difference) < 1) { // Less than 1 rupee difference
      setMessage('✅ Sales are already reconciled!');
      return;
    }

    setVerifying(true);
    try {
      // Update rokar data with reconciled sales
      if (storeRokarData) {
        const rokarRef = doc(db, 'rokar', storeRokarData.id);
        await updateDoc(rokarRef, {
          totalSale: calculateTotalSales(),
          reconciledAt: serverTimestamp(),
          reconciledBy: profile.email,
          reconciliationNotes: `Sales reconciled by manager. Previous total: ${storeRokarData.totalSale}, New total: ${calculateTotalSales()}`
        });
      }

      // Notify all staff about reconciliation
      const allStaffEmails = [...staffSubmissions.map(s => s.staffEmail), ...absentStaff.map(s => s.email)];
      for (const email of allStaffEmails) {
        await addDoc(collection(db, 'notifications'), {
          recipientEmail: email,
          title: 'Sales Data Reconciled',
          message: `Sales data for ${selectedDate} has been reconciled by your manager. Please review your data.`,
          type: 'RECONCILIATION',
          date: selectedDate,
          createdAt: serverTimestamp(),
          read: false
        });
      }

      setMessage('✅ Sales reconciled successfully. All staff notified.');
      await loadData(); // Reload data
    } catch (error) {
      console.error('Error reconciling sales:', error);
      setMessage('❌ Error reconciling sales: ' + error.message);
    } finally {
      setVerifying(false);
    }
  };

  // Calculate the sales date (yesterday relative to selected date)
  const getSalesDate = () => {
    const salesDate = new Date(selectedDate);
    salesDate.setDate(salesDate.getDate() - 1);
    return salesDate.toISOString().split('T')[0];
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Data Verification</h1>
        <p className="text-gray-600">Review and verify staff submissions for {profile?.storeName}</p>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.includes('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Important Information Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 text-xl">ℹ️</div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">How This Works:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Submission Date:</strong> When staff submitted their attendance (selected date)</li>
              <li>• <strong>Sales Date:</strong> The actual sales data being verified (yesterday relative to submission)</li>
              <li>• <strong>Example:</strong> If staff submitted on Jan 15th, we're verifying Jan 14th's sales</li>
              <li>• <strong>Actions:</strong> You can Edit, Approve, or Reject staff submissions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Date Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Submission Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="text-sm text-gray-600">
            (Sales being verified: <strong>{getSalesDate()}</strong>)
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load Data'}
          </button>
        </div>
      </div>

      {/* Sales Reconciliation Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Sales Reconciliation for {getSalesDate()}</h2>
        <div className="grid md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ₹{calculateTotalSales().toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Staff Sales</div>
            <div className="text-xs text-gray-500">(Submitted on {selectedDate})</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ₹{(storeRokarData?.totalSale || 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Rokar Total Sales</div>
            <div className="text-xs text-gray-500">(For {getSalesDate()})</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              getSalesDifference() === 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ₹{getSalesDifference().toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Difference</div>
          </div>
          <div className="text-center">
            <button
              onClick={handleReconcileSales}
              disabled={verifying || getSalesDifference() === 0}
              className={`px-4 py-2 rounded-md text-white ${
                getSalesDifference() === 0 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {verifying ? 'Reconciling...' : 'Reconcile Sales'}
            </button>
          </div>
        </div>
      </div>

      {/* Staff Submissions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          👥 Staff Submissions (Submitted on {selectedDate} for {getSalesDate()} sales)
        </h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading staff submissions...</p>
          </div>
        ) : staffSubmissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No staff submissions found for {selectedDate}</p>
            <p className="text-sm mt-2">(This means no staff submitted attendance on this date)</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yesterday's Sales (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Today's Target (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Google Reviews</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LOS Updates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bills</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{submission.staffName}</div>
                        <div className="text-sm text-gray-500">{submission.staffEmail}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        submission.verified 
                          ? (submission.isApproved ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {submission.verified 
                          ? (submission.isApproved ? 'Approved' : 'Rejected')
                          : 'Pending'
                        }
                      </span>
                      {submission.editedBy && (
                        <div className="text-xs text-gray-500 mt-1">
                          Edited by {submission.editedBy}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{submission.answers?.yesterdaySale?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{submission.answers?.todayTarget?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.answers?.googleReviewsDone || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.answers?.losUpdatesDone || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.answers?.quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.answers?.bills || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditSubmission(submission)}
                          disabled={verifying}
                          className="text-blue-600 hover:text-blue-900 px-2 py-1 rounded text-xs"
                        >
                          Edit
                        </button>
                        {!submission.verified && (
                          <>
                            <button
                              onClick={() => handleVerifySubmission(submission.id, true)}
                              disabled={verifying}
                              className="text-green-600 hover:text-green-900 px-2 py-1 rounded text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt('Enter rejection reason:');
                                if (notes !== null) {
                                  handleVerifySubmission(submission.id, false, notes);
                                }
                              }}
                              disabled={verifying}
                              className="text-red-600 hover:text-red-900 px-2 py-1 rounded text-xs"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Absent Staff */}
      {absentStaff.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            ❌ Absent Staff (Did not submit on {selectedDate})
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            These staff members did not submit attendance on {selectedDate}. You can add their sales for {getSalesDate()} manually.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {absentStaff.map((staff) => (
              <div key={staff.email} className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                  <div className="text-sm text-gray-500">{staff.email}</div>
                </div>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder={`Sales for ${getSalesDate()}`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    id={`sales-${staff.email}`}
                  />
                  <button
                    onClick={() => {
                      const sales = document.getElementById(`sales-${staff.email}`).value;
                      if (sales && sales > 0) {
                        handleAddAbsentStaffSales(staff.email, sales);
                      }
                    }}
                    disabled={verifying}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add Sales
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Data for {editingSubmission.staffName}
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yesterday's Sales (₹)
                </label>
                <input
                  type="number"
                  value={editForm.yesterdaySale}
                  onChange={(e) => setEditForm({...editForm, yesterdaySale: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Today's Target (₹)
                </label>
                <input
                  type="number"
                  value={editForm.todayTarget}
                  onChange={(e) => setEditForm({...editForm, todayTarget: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Reviews Done
                </label>
                <input
                  type="number"
                  value={editForm.googleReviewsDone}
                  onChange={(e) => setEditForm({...editForm, googleReviewsDone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  LOS Updates Done
                </label>
                <input
                  type="number"
                  value={editForm.losUpdatesDone}
                  onChange={(e) => setEditForm({...editForm, losUpdatesDone: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity Sold
                </label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={(e) => setEditForm({...editForm, quantity: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Number of items sold"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Bills
                </label>
                <input
                  type="number"
                  value={editForm.bills}
                  onChange={(e) => setEditForm({...editForm, bills: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Total bills generated"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uniform Status
                </label>
                <select
                  value={editForm.uniform}
                  onChange={(e) => setEditForm({...editForm, uniform: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="YES">YES - Wearing Uniform</option>
                  <option value="NO">NO - Not Wearing Uniform</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shoe Status
                </label>
                <select
                  value={editForm.inShoe}
                  onChange={(e) => setEditForm({...editForm, inShoe: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="YES">YES - Wearing Shoes</option>
                  <option value="NO">NO - Not Wearing Shoes</option>
                </select>
              </div>
            </div>
            </div>
            
            <div className="p-6 border-t border-gray-200">
              <div className="flex space-x-3">
                <button
                  onClick={handleSaveEdit}
                  disabled={verifying}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifying ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSubmission(null);
                  }}
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
