import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function AttendanceCalendar({ selectedMonth = null, selectedYear = null }) {
  const { profile } = useUserProfile();
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(selectedMonth || new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(selectedYear || new Date().getFullYear());

  const toDate = (val) => {
    if (!val) return null;
    if (val.toDate) return val.toDate();
    if (typeof val === 'string') return new Date(val + (val.length === 10 ? 'T00:00:00' : ''));
    return new Date(val);
  };

  useEffect(() => {
    if (profile) {
      loadAttendanceData();
    }
  }, [profile, currentMonth, currentYear]);

  const loadAttendanceData = async () => {
    if (!profile?.email) return;

    try {
      setLoading(true);
      
      // Calculate month start and end dates
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0);
      const monthStartStr = monthStart.toISOString().slice(0, 10);
      const monthEndStr = monthEnd.toISOString().slice(0, 10);

      // Load attendance data
      const attendanceQuery = query(
        collection(db, 'attendance'),
        where('staffEmail', '==', profile.email.toLowerCase()),
        where('date', '>=', monthStartStr),
        where('date', '<=', monthEndStr),
        orderBy('date', 'asc')
      );

      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendanceList = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Load leave requests without mixed inequalities, then client-filter by range
      const baseLeaveQuery = query(
        collection(db, 'leave_requests'),
        where('userEmail', '==', profile.email.toLowerCase()),
        where('status', '==', 'approved')
      );

      const leaveSnapshot = await getDocs(baseLeaveQuery);
      const allLeaves = leaveSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const leaveList = allLeaves.filter(leave => {
        const start = toDate(leave.startDate);
        const end = toDate(leave.endDate);
        if (!start || !end) return false;
        return start <= monthEnd && end >= monthStart; // overlap check
      });

      setAttendanceData(attendanceList);
      setLeaveRequests(leaveList);
    } catch (error) {
      console.error('Error loading attendance calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const getAttendanceStatus = (date) => {
    const dateStr = date.toISOString().slice(0, 10);
    
    // Check for leave requests
    const leaveRequest = leaveRequests.find(leave => {
      const startDate = toDate(leave.startDate);
      const endDate = toDate(leave.endDate);
      return startDate && endDate && date >= startDate && date <= endDate;
    });

    if (leaveRequest) {
      return { status: 'leave', color: 'bg-purple-500', text: 'L' };
    }

    // Check for attendance
    const attendance = attendanceData.find(att => att.date === dateStr);
    if (attendance) {
      if (attendance.present) {
        return { status: 'present', color: 'bg-green-500', text: 'P' };
      } else {
        return { status: 'absent', color: 'bg-red-500', text: 'A' };
      }
    }

    // Check if it's a future date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      return { status: 'future', color: 'bg-gray-100', text: '' };
    }

    return { status: 'no-data', color: 'bg-gray-200', text: '' };
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-12 bg-gray-50"></div>);
    }

    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const attendanceStatus = getAttendanceStatus(date);
      
      days.push(
        <div
          key={day}
          className={`h-12 border border-gray-200 flex items-center justify-center relative ${
            attendanceStatus.color
          } ${attendanceStatus.status === 'future' ? 'opacity-50' : ''}`}
        >
          <span className="text-sm font-medium text-gray-900">{day}</span>
          {attendanceStatus.text && (
            <span className="absolute top-1 right-1 text-xs font-bold text-white">
              {attendanceStatus.text}
            </span>
          )}
        </div>
      );
    }

    return days;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Monthly Attendance</h3>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => changeMonth('prev')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-medium text-gray-900">
            {monthNames[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => changeMonth('next')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mb-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span>Present</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span>Absent</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span>Leave</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <span>No Data</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {dayNames.map(day => (
          <div key={day} className="h-8 flex items-center justify-center text-sm font-medium text-gray-500">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {renderCalendar()}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {attendanceData.filter(att => att.present).length}
            </div>
            <div className="text-sm text-gray-600">Present</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {attendanceData.filter(att => !att.present).length}
            </div>
            <div className="text-sm text-gray-600">Absent</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {leaveRequests.length}
            </div>
            <div className="text-sm text-gray-600">Leave Days</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">
              {getDaysInMonth(currentMonth, currentYear)}
            </div>
            <div className="text-sm text-gray-600">Total Days</div>
          </div>
        </div>
      </div>
    </div>
  );
}
