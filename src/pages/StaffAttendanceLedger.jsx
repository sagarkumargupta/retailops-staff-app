import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function StaffAttendanceLedger() {
  const { profile, hasPermission, getStoresForFiltering } = useUserProfile();
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [attendanceEntries, setAttendanceEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Date range filters
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  // Calculate totals
  const [totals, setTotals] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    lateDays: 0,
    averageCheckIn: '00:00',
    totalSales: 0,
    totalTarget: 0,
    achievementRate: 0
  });

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadStaff();
      loadAttendanceEntries();
    }
  }, [selectedStore, selectedStaff, dateRange]);

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

  const loadAttendanceEntries = async () => {
    if (!selectedStore) return;
    
    setLoading(true);
    try {
      let attendanceQuery = query(
        collection(db, 'attendance'),
        where('storeId', '==', selectedStore),
        where('date', '>=', dateRange.from),
        where('date', '<=', dateRange.to),
        orderBy('date', 'desc')
      );

      if (selectedStaff) {
        attendanceQuery = query(
          collection(db, 'attendance'),
          where('storeId', '==', selectedStore),
          where('staffEmail', '==', selectedStaff),
          where('date', '>=', dateRange.from),
          where('date', '<=', dateRange.to),
          orderBy('date', 'desc')
        );
      }

      const attendanceSnap = await getDocs(attendanceQuery);
      const entries = attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setAttendanceEntries(entries);
      calculateTotals(entries);
    } catch (error) {
      console.error('Error loading attendance entries:', error);
      setMessage('❌ Error loading attendance: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (entries) => {
    const totals = entries.reduce((acc, entry) => {
      acc.totalDays++;
      
      if (entry.present) {
        acc.presentDays++;
        
        // Calculate average check-in time
        if (entry.checkIn) {
          const checkInTime = entry.checkIn;
          const [hours, minutes] = checkInTime.split(':').map(Number);
          acc.totalCheckInMinutes += hours * 60 + minutes;
        }
        
        // Check if late (after 9:30 AM)
        if (entry.checkIn) {
          const [hours, minutes] = entry.checkIn.split(':').map(Number);
          if (hours > 9 || (hours === 9 && minutes > 30)) {
            acc.lateDays++;
          }
        }
      } else {
        acc.absentDays++;
      }
      
      // Sales and target data
      if (entry.answers?.yesterdaySale) {
        acc.totalSales += Number(entry.answers.yesterdaySale) || 0;
      }
      if (entry.answers?.todayTarget) {
        acc.totalTarget += Number(entry.answers.todayTarget) || 0;
      }
      
      return acc;
    }, {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      totalCheckInMinutes: 0,
      totalSales: 0,
      totalTarget: 0
    });

    // Calculate average check-in time
    if (totals.presentDays > 0) {
      const avgMinutes = Math.round(totals.totalCheckInMinutes / totals.presentDays);
      const avgHours = Math.floor(avgMinutes / 60);
      const avgMins = avgMinutes % 60;
      totals.averageCheckIn = `${avgHours.toString().padStart(2, '0')}:${avgMins.toString().padStart(2, '0')}`;
    }

    // Calculate achievement rate
    totals.achievementRate = totals.totalTarget > 0 ? Math.round((totals.totalSales / totals.totalTarget) * 100) : 0;
    
    setTotals(totals);
  };

  const getStatusColor = (present, checkIn) => {
    if (!present) return 'text-red-600 bg-red-50';
    if (checkIn) {
      const [hours, minutes] = checkIn.split(':').map(Number);
      if (hours > 9 || (hours === 9 && minutes > 30)) {
        return 'text-orange-600 bg-orange-50';
      }
    }
    return 'text-green-600 bg-green-50';
  };

  const getStatusIcon = (present, checkIn) => {
    if (!present) return '❌';
    if (checkIn) {
      const [hours, minutes] = checkIn.split(':').map(Number);
      if (hours > 9 || (hours === 9 && minutes > 30)) {
        return '⏰';
      }
    }
    return '✅';
  };

  const getStatusText = (present, checkIn) => {
    if (!present) return 'Absent';
    if (checkIn) {
      const [hours, minutes] = checkIn.split(':').map(Number);
      if (hours > 9 || (hours === 9 && minutes > 30)) {
        return 'Late';
      }
    }
    return 'Present';
  };

  const formatTime = (time) => {
    if (!time) return '-';
    return time;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Staff Attendance Ledger</h1>
        <p className="text-gray-600">Classical accounting ledger for staff attendance tracking and performance</p>
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
        <div className="grid md:grid-cols-4 gap-4">
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
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{totals.totalDays}</div>
          <div className="text-sm text-gray-600">Total Days</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{totals.presentDays}</div>
          <div className="text-sm text-gray-600">Present Days</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-red-600">{totals.absentDays}</div>
          <div className="text-sm text-gray-600">Absent Days</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">{totals.lateDays}</div>
          <div className="text-sm text-gray-600">Late Days</div>
        </div>
      </div>

      {/* Performance Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">{totals.averageCheckIn}</div>
          <div className="text-sm text-gray-600">Average Check-in</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">₹{totals.totalSales.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Sales</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">₹{totals.totalTarget.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Target</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className={`text-2xl font-bold ${totals.achievementRate >= 100 ? 'text-green-600' : 'text-orange-600'}`}>
            {totals.achievementRate}%
          </div>
          <div className="text-sm text-gray-600">Achievement Rate</div>
        </div>
      </div>

      {/* Attendance Ledger Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Attendance Ledger Entries</h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading attendance entries...</p>
          </div>
        ) : attendanceEntries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No attendance entries found for the selected period</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check-in</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target (₹)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Achievement</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Google Reviews</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LOS Updates</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bills</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uniform</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shoes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attendanceEntries.map((entry) => (
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
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(entry.present, entry.checkIn)}`}>
                        {getStatusIcon(entry.present, entry.checkIn)} {getStatusText(entry.present, entry.checkIn)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatTime(entry.checkIn)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{entry.answers?.yesterdaySale?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{entry.answers?.todayTarget?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.answers?.todayTarget && entry.answers?.yesterdaySale ? 
                        `${Math.round((entry.answers.yesterdaySale / entry.answers.todayTarget) * 100)}%` : 
                        '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.answers?.googleReviewsDone || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.answers?.losUpdatesDone || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.answers?.quantity || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.answers?.bills || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.answers?.uniform === 'YES' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.answers?.uniform || 'NO'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        entry.answers?.inShoe === 'YES' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.answers?.inShoe || 'NO'}
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
