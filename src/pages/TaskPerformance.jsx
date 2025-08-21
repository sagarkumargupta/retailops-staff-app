import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function TaskPerformance() {
  const { profile, hasPermission } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('month'); // week, month, quarter, year
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState('all');

  useEffect(() => {
    if (profile) {
      loadTaskData();
    }
  }, [profile, selectedPeriod, selectedStore, selectedStaff]);

  const loadTaskData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load tasks and staff in parallel
      const [tasksSnapshot, staffSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'users'))
      ]);

      let tasksData = tasksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let staffData = staffSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.role === 'STAFF' || user.role === 'MANAGER');

      console.log('Loaded tasks data:', {
        totalTasks: tasksData.length,
        sampleTask: tasksData[0],
        completedTasks: tasksData.filter(t => t.status === 'completed' || (t.completedBy && t.completedBy.length > 0)).length
      });

      console.log('Loaded staff data:', {
        totalStaff: staffData.length,
        sampleStaff: staffData.slice(0, 3).map(s => ({
          email: s.email,
          role: s.role,
          stores: s.stores,
          assignedStore: s.assignedStore
        }))
      });

      // Filter tasks based on user role
      if (profile?.role === 'STAFF') {
        console.log('Filtering tasks for STAFF role - showing assigned tasks');
        const beforeStaffFilter = tasksData.length;
        tasksData = tasksData.filter(task => 
          task.assignees && task.assignees.includes(profile.email) ||
          task.targetAudience === 'all_staff' ||
          (task.targetAudience === 'location' && task.assignedStores && 
           task.assignedStores.includes(profile.assignedStore))
        );
        console.log('After staff filter:', {
          before: beforeStaffFilter,
          after: tasksData.length,
          removed: beforeStaffFilter - tasksData.length
        });

        // Filter staff to show only self
        staffData = staffData.filter(user => user.email === profile.email);
      } else if (profile?.role === 'MANAGER') {
        console.log('Filtering tasks for MANAGER role');
        const managerStoreIds = profile.stores && typeof profile.stores === 'object' 
          ? Object.keys(profile.stores).filter(key => profile.stores[key] === true)
          : [];
        
        // Also include manager's assigned store
        if (profile.assignedStore && !managerStoreIds.includes(profile.assignedStore)) {
          managerStoreIds.push(profile.assignedStore);
        }

        const beforeManagerFilter = tasksData.length;
        tasksData = tasksData.filter(task => 
          task.createdBy === profile.email || 
          (task.assignees && task.assignees.includes(profile.email)) ||
          task.targetAudience === 'all_managers' ||
          (task.targetAudience === 'location' && task.assignedStores && 
           task.assignedStores.some(storeId => 
             profile.stores && profile.stores[storeId] === true ||
             profile.assignedStore === storeId
           ))
        );
        console.log('After manager filter:', {
          before: beforeManagerFilter,
          after: tasksData.length,
          removed: beforeManagerFilter - tasksData.length
        });

        // Filter staff to show only staff in manager's stores
        staffData = staffData.filter(user => 
          user.stores && Object.keys(user.stores).some(storeId => 
            managerStoreIds.includes(storeId) && user.stores[storeId] === true
          ) || user.assignedStore && managerStoreIds.includes(user.assignedStore)
        );
      }
      // For ADMIN, OWNER, SUPER_ADMIN - show all tasks and staff (no filtering)

      setTasks(tasksData);
      setStaff(staffData);
    } catch (error) {
      console.error('Error loading task data:', error);
      setError('Failed to load task performance data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate performance metrics
  const calculateMetrics = () => {
    const now = new Date();
    const periodStart = getPeriodStart(selectedPeriod);
    
    // Filter tasks by period and completion status
    const periodTasks = tasks.filter(task => {
      const taskDate = task.createdAt?.toDate?.() || new Date(task.createdAt);
      return taskDate >= periodStart;
    });

    // Filter by store if selected
    let filteredTasks = selectedStore === 'all' 
      ? periodTasks 
      : periodTasks.filter(task => task.storeId === selectedStore);

    // Filter by staff if selected
    if (selectedStaff !== 'all') {
      console.log('Filtering tasks for specific staff:', selectedStaff);
      const beforeStaffFilter = filteredTasks.length;
      filteredTasks = filteredTasks.filter(task => 
        task.assignees && task.assignees.includes(selectedStaff) ||
        task.createdBy === selectedStaff
      );
      console.log('After staff filter in metrics:', {
        before: beforeStaffFilter,
        after: filteredTasks.length,
        removed: beforeStaffFilter - filteredTasks.length
      });
    }

    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter(task => 
      task.status === 'completed' || (task.completedBy && task.completedBy.length > 0)
    ).length;
    const pendingTasks = filteredTasks.filter(task => 
      task.status === 'pending' || task.status === 'in_progress'
    ).length;
    const overdueTasks = filteredTasks.filter(task => {
      if (task.status === 'completed' || (task.completedBy && task.completedBy.length > 0)) return false;
      const dueDate = task.deadline?.toDate?.() || new Date(task.deadline);
      return dueDate < now;
    }).length;

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const averageCompletionTime = calculateAverageCompletionTime(filteredTasks);

    console.log('Task Performance Metrics:', {
      periodStart: periodStart.toISOString(),
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
      averageCompletionTime,
      selectedStaff,
      sampleTasks: filteredTasks.slice(0, 3).map(t => ({
        id: t.id,
        status: t.status,
        completedBy: t.completedBy,
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        assignees: t.assignees
      }))
    });

    return {
      totalTasks,
      totalExecutions: totalTasks, // For compatibility
      completedTasks,
      pendingTasks,
      overdueTasks,
      completionRate,
      averageCompletionTime
    };
  };

  const getPeriodStart = (period) => {
    const now = new Date();
    switch (period) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  };

  const calculateAverageCompletionTime = (tasks) => {
    const completedTasks = tasks.filter(task => 
      task.status === 'completed' || (task.completedBy && task.completedBy.length > 0)
    );

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const startTime = task.createdAt?.toDate?.() || new Date(task.createdAt);
      const endTime = task.completedAt?.toDate?.() || new Date(task.completedAt);
      return sum + (endTime - startTime);
    }, 0);

    return Math.round(totalTime / completedTasks.length / (1000 * 60 * 60)); // Hours
  };

  // Prepare chart data
  const getStatusDistributionData = () => {
    const metrics = calculateMetrics();
    return [
      { name: 'Completed', value: metrics.completedTasks, color: '#10B981' },
      { name: 'Pending', value: metrics.pendingTasks, color: '#F59E0B' },
      { name: 'Overdue', value: metrics.overdueTasks, color: '#EF4444' }
    ];
  };

  const getCompletionTrendData = () => {
    const periodStart = getPeriodStart(selectedPeriod);
    const days = selectedPeriod === 'week' ? 7 : selectedPeriod === 'month' ? 30 : 90;
    
    const trendData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(periodStart);
      date.setDate(date.getDate() + i);
      
      const dayTasks = tasks.filter(task => {
        const taskDate = task.createdAt?.toDate?.() || new Date(task.createdAt);
        return taskDate.toDateString() === date.toDateString();
      });

      const completed = dayTasks.filter(task => 
        task.status === 'completed' || (task.completedBy && task.completedBy.length > 0)
      ).length;
      const total = dayTasks.length;

      trendData.push({
        date: date.toLocaleDateString(),
        completed,
        total,
        completionRate: total > 0 ? (completed / total) * 100 : 0
      });
    }

    return trendData;
  };

  const getStorePerformanceData = () => {
    const storeStats = {};
    
    tasks.forEach(task => {
      const storeId = task.storeId || 'Unknown';
      if (!storeStats[storeId]) {
        storeStats[storeId] = { completed: 0, total: 0 };
      }
      storeStats[storeId].total++;
      if (task.status === 'completed' || (task.completedBy && task.completedBy.length > 0)) {
        storeStats[storeId].completed++;
      }
    });

    return Object.entries(storeStats).map(([storeId, stats]) => ({
      store: storeId,
      completed: stats.completed,
      total: stats.total,
      completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
    }));
  };

  const getTopPerformers = () => {
    const userStats = {};
    
    tasks.forEach(task => {
      // Get all assignees for this task
      const assignees = task.assignees || [];
      const createdBy = task.createdBy || 'Unknown';
      
      // Count assignments for each assignee
      assignees.forEach(userId => {
        if (!userStats[userId]) {
          userStats[userId] = { completed: 0, total: 0, totalTime: 0 };
        }
        userStats[userId].total++;
        
        // Check if this specific user completed the task
        const isCompleted = task.status === 'completed' || 
          (task.completedBy && task.completedBy.includes(userId));
        
        if (isCompleted) {
          userStats[userId].completed++;
          if (task.createdAt && task.completedAt) {
            const startTime = task.createdAt?.toDate?.() || new Date(task.createdAt);
            const endTime = task.completedAt?.toDate?.() || new Date(task.completedAt);
            userStats[userId].totalTime += (endTime - startTime);
          }
        }
      });
      
      // Also count tasks created by users
      if (!userStats[createdBy]) {
        userStats[createdBy] = { completed: 0, total: 0, totalTime: 0 };
      }
      userStats[createdBy].total++;
      
      if (task.status === 'completed' || (task.completedBy && task.completedBy.length > 0)) {
        userStats[createdBy].completed++;
        if (task.createdAt && task.completedAt) {
          const startTime = task.createdAt?.toDate?.() || new Date(task.createdAt);
          const endTime = task.completedAt?.toDate?.() || new Date(task.completedAt);
          userStats[createdBy].totalTime += (endTime - startTime);
        }
      }
    });

    console.log('Top Performers calculation:', {
      totalTasks: tasks.length,
      userStats: Object.keys(userStats).length,
      sampleStats: Object.entries(userStats).slice(0, 3).map(([userId, stats]) => ({
        userId,
        total: stats.total,
        completed: stats.completed,
        completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
      }))
    });

    return Object.entries(userStats)
      .map(([userId, stats]) => ({
        user: userId,
        completed: stats.completed,
        total: stats.total,
        completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
        avgTime: stats.completed > 0 ? Math.round(stats.totalTime / stats.completed / (1000 * 60 * 60)) : 0
      }))
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!hasPermission('canManageTasks')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">You do not have permission to view task performance analytics.</p>
        </div>
      </div>
    );
  }

  const metrics = calculateMetrics();
  const statusData = getStatusDistributionData();
  const trendData = getCompletionTrendData();
  const storeData = getStorePerformanceData();
  const topPerformers = getTopPerformers();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Task Performance Analytics</h1>
          <p className="mt-2 text-sm text-gray-700">
            Comprehensive analysis of task completion rates, trends, and performance metrics
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="week">Last Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Stores</option>
            {/* Add store options here */}
          </select>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All Staff</option>
            {staff.map(staffMember => (
              <option key={staffMember.email} value={staffMember.email}>
                {staffMember.name || staffMember.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
                      <dd className="text-lg font-medium text-gray-900">{metrics.totalTasks}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Completion Rate</dt>
                      <dd className="text-lg font-medium text-gray-900">{metrics.completionRate.toFixed(1)}%</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Avg Completion Time</dt>
                      <dd className="text-lg font-medium text-gray-9">{metrics.averageCompletionTime}h</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Overdue Tasks</dt>
                      <dd className="text-lg font-medium text-gray-900">{metrics.overdueTasks}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Status Distribution */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Task Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Completion Trend */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Completion Trend</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="completionRate" stroke="#8884d8" name="Completion Rate (%)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Store Performance */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Store Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={storeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="store" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="completionRate" fill="#8884d8" name="Completion Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Performers */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performers</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time (h)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topPerformers.map((performer, index) => (
                    <tr key={performer.user}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {performer.user}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{performer.completed}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{performer.total}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          performer.completionRate >= 80 ? 'bg-green-100 text-green-800' :
                          performer.completionRate >= 60 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {performer.completionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{performer.avgTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



