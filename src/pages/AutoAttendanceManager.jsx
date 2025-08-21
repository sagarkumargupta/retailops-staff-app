import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function AutoAttendanceManager() {
  const { profile } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadStores();
  }, [profile]);

  useEffect(() => {
    if (selectedStore && selectedDate) {
      loadStaffAttendance();
    }
  }, [selectedStore, selectedDate]);

  const loadStores = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores based on user role
      if (profile?.role === 'OWNER') {
        const ownerStores = storesList.filter(store => store.ownerId === profile.email);
        setStores(ownerStores);
      } else if (profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN') {
        setStores(storesList);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
      setMessage('Error loading stores: ' + error.message);
    }
  };

  const loadStaffAttendance = async () => {
    if (!selectedStore || !selectedDate) return;
    
    setLoading(true);
    try {
      // Get all staff for the selected store
      const staffQuery = query(
        collection(db, 'users'),
        where('assignedStore', '==', selectedStore),
        where('role', '==', 'STAFF')
      );
      const staffSnap = await getDocs(staffQuery);
      const staffMembers = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Check attendance for each staff member
      const staffWithAttendance = await Promise.all(
        staffMembers.map(async (staff) => {
          const attendanceId = `${selectedStore}_${selectedDate}_${staff.id}`;
          const attendanceDoc = await getDoc(doc(db, 'attendance', attendanceId));
          
          return {
            ...staff,
            hasAttendance: attendanceDoc.exists(),
            attendanceData: attendanceDoc.exists() ? attendanceDoc.data() : null
          };
        })
      );

      setStaffList(staffWithAttendance);
    } catch (error) {
      console.error('Error loading staff attendance:', error);
      setMessage('Error loading staff attendance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const markAbsent = async (staffId, staffName) => {
    try {
      const attendanceId = `${selectedStore}_${selectedDate}_${staffId}`;
      
      await setDoc(doc(db, 'attendance', attendanceId), {
        storeId: selectedStore,
        date: selectedDate,
        staffId: staffId,
        staffName: staffName,
        staffEmail: staffId, // staffId is the email for staff
        staffRole: 'STAFF',
        present: false,
        checkIn: null,
        answers: {
          yesterdaySale: 0,
          todayTarget: 0,
          uniform: 'NO',
          inShoe: 'NO',
          googleReviewsDone: 0,
          losUpdatesDone: 0,
        },
        submittedAt: new Date(),
        markedBy: profile.email,
        markedAs: 'AUTO_ABSENT'
      });

      setMessage(`✅ Marked ${staffName} as absent for ${selectedDate}`);
      loadStaffAttendance(); // Reload the list
    } catch (error) {
      console.error('Error marking absent:', error);
      setMessage('❌ Error marking absent: ' + error.message);
    }
  };

  const markAllAbsent = async () => {
    const absentStaff = staffList.filter(staff => !staff.hasAttendance);
    
    if (absentStaff.length === 0) {
      setMessage('No staff members to mark as absent.');
      return;
    }

    setLoading(true);
    try {
      await Promise.all(
        absentStaff.map(staff => 
          markAbsent(staff.id, staff.name)
        )
      );
      setMessage(`✅ Marked ${absentStaff.length} staff members as absent`);
      loadStaffAttendance();
    } catch (error) {
      console.error('Error marking all absent:', error);
      setMessage('❌ Error marking staff as absent: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile || (profile.role !== 'OWNER' && profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN')) {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-600">Only owners, admins, and super admins can manage auto-attendance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auto Attendance Manager</h1>
      
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h2 className="font-semibold text-blue-800 mb-2">Auto-Mark Absent Feature</h2>
        <p className="text-blue-700 text-sm">
          This feature allows you to automatically mark staff as absent if they haven't submitted attendance for a specific date.
          Only staff members without attendance records will be marked as absent.
        </p>
      </div>

      {/* Store and Date Selection */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Select Store and Date</h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          <div className="relative">
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Store</option>
              {stores.map(store => (
                <option key={store.id} value={store.id}>
                  {store.brand} — {store.name}
                </option>
              ))}
            </select>
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Store</label>
          </div>
          
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-3 border rounded-lg peer bg-transparent focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <label className="absolute left-3 -top-2.5 bg-white px-1 text-xs text-gray-600">Date</label>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.includes('✅') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Staff List */}
      {selectedStore && selectedDate && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">
              Staff Attendance for {selectedDate}
            </h3>
            {staffList.filter(staff => !staff.hasAttendance).length > 0 && (
              <button
                onClick={markAllAbsent}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : `Mark All Absent (${staffList.filter(staff => !staff.hasAttendance).length})`}
              </button>
            )}
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading staff attendance...</p>
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p>No staff members found for this store.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffList.map((staff) => (
                    <tr key={staff.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                        <div className="text-sm text-gray-500">{staff.staffRole || 'STAFF'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {staff.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          staff.hasAttendance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {staff.hasAttendance ? 'Present' : 'No Attendance'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {!staff.hasAttendance && (
                          <button
                            onClick={() => markAbsent(staff.id, staff.name)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Mark Absent
                          </button>
                        )}
                        {staff.hasAttendance && (
                          <span className="text-gray-400">Already marked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


