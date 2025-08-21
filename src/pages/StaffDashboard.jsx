import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import AttendanceCalendar from '../components/AttendanceCalendar';

export default function StaffDashboard() {
  const { profile } = useUserProfile();
  const [loading, setLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState([]);
  const [mtdStats, setMtdStats] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    averageReachingTime: '00:00',
    totalSales: 0,
    totalTarget: 0,
    googleReviewsDone: 0,
    losUpdatesDone: 0,
    uniformCompliance: 0,
    shoeCompliance: 0
  });

  useEffect(() => {
    if (profile) {
      loadAttendanceData();
    }
  }, [profile]);

  const loadAttendanceData = async () => {
    try {
      // Check if profile and email exist before making the query
      if (!profile?.email) {
        console.log('Profile or email not available, skipping attendance load');
        setAttendanceData([]);
        setMtdStats({
          totalDays: 0,
          presentDays: 0,
          absentDays: 0,
          averageReachingTime: '00:00',
          totalSales: 0,
          totalTarget: 0,
          googleReviewsDone: 0,
          losUpdatesDone: 0,
          uniformCompliance: 0,
          shoeCompliance: 0
        });
        return;
      }

      setLoading(true);
      
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().slice(0, 10);
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('staffEmail', '==', profile.email.toLowerCase()),
        where('date', '>=', monthStartStr),
        orderBy('date', 'desc')
      );

      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceList = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAttendanceData(attendanceList);
      calculateMTDStats(attendanceList, thirtyDaysAgoStr);

    } catch (error) {
      console.error('Error loading attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMTDStats = (data, thirtyDaysAgoStr) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthData = data.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    const thirtyDaysData = data.filter(record => record.date >= thirtyDaysAgoStr);

    let totalDays = monthData.length;
    let presentDays = monthData.filter(record => record.present).length;
    let absentDays = totalDays - presentDays;
    let totalSales = 0;
    let totalTarget = 0;
    let googleReviewsDone = 0;
    let losUpdatesDone = 0;
    let uniformCompliance = 0;
    let shoeCompliance = 0;

    monthData.forEach(record => {
      if (record.answers) {
        totalSales += record.answers.yesterdaySale || 0;
        totalTarget += record.answers.todayTarget || 0;
        googleReviewsDone += record.answers.googleReviewsDone || 0;
        losUpdatesDone += record.answers.losUpdatesDone || 0;
        if (record.answers.uniform === 'YES') uniformCompliance++;
        if (record.answers.inShoe === 'YES') shoeCompliance++;
      }
    });

    let totalMinutes = 0;
    let validTimeRecords = 0;

    thirtyDaysData.forEach(record => {
      if (record.checkIn && record.present) {
        const [hours, minutes] = record.checkIn.split(':').map(Number);
        const totalMinutesForDay = hours * 60 + minutes;
        totalMinutes += totalMinutesForDay;
        validTimeRecords++;
      }
    });

    const averageMinutes = validTimeRecords > 0 ? Math.round(totalMinutes / validTimeRecords) : 0;
    const averageHours = Math.floor(averageMinutes / 60);
    const averageMins = averageMinutes % 60;
    const averageReachingTime = `${averageHours.toString().padStart(2, '0')}:${averageMins.toString().padStart(2, '0')}`;

    setMtdStats({
      totalDays,
      presentDays,
      absentDays,
      averageReachingTime,
      totalSales,
      totalTarget,
      googleReviewsDone,
      losUpdatesDone,
      uniformCompliance,
      shoeCompliance
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (value, total) => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Dashboard</h1>
      
      {/* MTD Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attendance</p>
              <p className="text-2xl font-bold text-gray-900">{mtdStats.presentDays}/{mtdStats.totalDays}</p>
              <p className="text-xs text-gray-500">{formatPercentage(mtdStats.presentDays, mtdStats.totalDays)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Reaching Time</p>
              <p className="text-2xl font-bold text-gray-900">{mtdStats.averageReachingTime}</p>
              <p className="text-xs text-gray-500">Last 30 days</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">MTD Sales</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(mtdStats.totalSales)}</p>
              <p className="text-xs text-gray-500">vs {formatCurrency(mtdStats.totalTarget)} target</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Compliance</p>
              <p className="text-2xl font-bold text-gray-900">{formatPercentage(mtdStats.uniformCompliance, mtdStats.totalDays)}</p>
              <p className="text-xs text-gray-500">Uniform compliance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-semibold mb-2">Google Reviews</h4>
          <p className="text-2xl font-bold text-green-600">{mtdStats.googleReviewsDone}</p>
          <p className="text-sm text-gray-500">Done this month</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-semibold mb-2">LOS Updates</h4>
          <p className="text-2xl font-bold text-blue-600">{mtdStats.losUpdatesDone}</p>
          <p className="text-sm text-gray-500">Updated this month</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-semibold mb-2">Shoe Compliance</h4>
          <p className="text-2xl font-bold text-purple-600">{formatPercentage(mtdStats.shoeCompliance, mtdStats.totalDays)}</p>
          <p className="text-sm text-gray-500">This month</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/self-attendance"
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Mark Attendance</span>
          </Link>

          <Link
            to="/my-tasks"
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">My Tasks</span>
          </Link>

          <Link
            to="/leave-request"
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Leave Request</span>
          </Link>

          <Link
            to="/salary-request"
            className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-900">Salary Request</span>
          </Link>
        </div>
      </div>

      {/* Attendance Calendar */}
      <div className="mb-8">
        <AttendanceCalendar />
      </div>
    </div>
  );
}
