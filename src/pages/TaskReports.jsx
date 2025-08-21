import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function TaskReports() {
  const { profile } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateRange: 'month',
    status: 'all',
    priority: 'all',
    category: 'all'
  });

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      await loadTasks();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      
      // Check if profile is loaded
      if (!profile) {
        console.log('Profile not loaded yet, skipping task loading');
        return;
      }
      
      // Load all tasks and filter on client side
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      let tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log('Loaded tasks:', {
        totalTasks: tasksList.length,
        userRole: profile.role,
        userEmail: profile.email
      });
      
      // Filter based on user role
      if (profile.role === 'MANAGER') {
        // For managers, show tasks they created or are assigned to
        const beforeFilter = tasksList.length;
        tasksList = tasksList.filter(task => 
          task.createdBy === profile.email || 
          (task.assignees && task.assignees.includes(profile.email))
        );
        console.log('Manager filter applied:', {
          before: beforeFilter,
          after: tasksList.length,
          removed: beforeFilter - tasksList.length
        });
      } else if (profile.role === 'STAFF') {
        // For staff, show tasks assigned to them
        const beforeFilter = tasksList.length;
        tasksList = tasksList.filter(task => 
          task.assignees && task.assignees.includes(profile.email)
        );
        console.log('Staff filter applied:', {
          before: beforeFilter,
          after: tasksList.length,
          removed: beforeFilter - tasksList.length
        });
      }
      // For admins, show all tasks (no filtering needed)
      
      // Sort by creation date (newest first)
      tasksList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setTasks(tasksList);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredTasks = () => {
    let filteredTasks = [...tasks];

    // Apply filters
    if (filters.status !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.status === filters.status);
    }

    if (filters.priority !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.priority === filters.priority);
    }

    if (filters.category !== 'all') {
      filteredTasks = filteredTasks.filter(task => task.category === filters.category);
    }

    return filteredTasks;
  };

  const getMetrics = () => {
    const filteredTasks = getFilteredTasks();
    const total = filteredTasks.length;
    const completed = filteredTasks.filter(t => t.status === 'completed').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const pending = filteredTasks.filter(t => t.status === 'pending').length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Calculate average completion time
    const completedTasks = filteredTasks.filter(t => t.status === 'completed' && t.completedAt);
    const totalCompletionTime = completedTasks.reduce((sum, task) => {
      const startTime = task.createdAt?.toDate?.() || new Date(task.createdAt);
      const endTime = task.completedAt?.toDate?.() || new Date(task.completedAt);
      return sum + (endTime - startTime);
    }, 0);
    const avgCompletionTime = completedTasks.length > 0 ? Math.round(totalCompletionTime / completedTasks.length / (1000 * 60 * 60)) : 0; // Hours

    // Calculate overdue tasks
    const now = new Date();
    const overdueTasks = filteredTasks.filter(task => {
      if (task.status === 'completed') return false;
      const dueDate = task.deadline?.toDate?.() || new Date(task.deadline);
      return dueDate < now;
    }).length;

    return { 
      total, 
      completed, 
      inProgress, 
      pending, 
      completionRate, 
      avgCompletionTime, 
      overdueTasks,
      completedTasks: completedTasks.length
    };
  };

  const downloadReport = () => {
    const filteredTasks = getFilteredTasks();
    const metrics = getMetrics();
    
    const reportData = {
      reportInfo: {
        generatedAt: new Date().toISOString(),
        filters,
        metrics
      },
      tasks: filteredTasks.map(task => {
        // Calculate time taken for completed tasks
        let timeTaken = null;
        if (task.status === 'completed' && task.completedAt && task.createdAt) {
          const startTime = task.createdAt?.toDate?.() || new Date(task.createdAt);
          const endTime = task.completedAt?.toDate?.() || new Date(task.completedAt);
          timeTaken = endTime - startTime; // in milliseconds
        }

        // Check if task is overdue
        const isOverdue = task.status !== 'completed' && task.deadline && 
          (task.deadline?.toDate?.() || new Date(task.deadline)) < new Date();

        return {
          id: task.id,
          title: task.title,
          description: task.description,
          priority: task.priority,
          status: task.status,
          category: task.category,
          createdBy: task.createdBy,
          assignees: task.assignees || [],
          completedBy: task.completedBy || [],
          createdAt: task.createdAt?.toDate ? task.createdAt.toDate().toISOString() : new Date(task.createdAt).toISOString(),
          completedAt: task.completedAt?.toDate ? task.completedAt.toDate().toISOString() : (task.completedAt ? new Date(task.completedAt).toISOString() : null),
          deadline: task.deadline?.toDate ? task.deadline.toDate().toISOString() : (task.deadline ? new Date(task.deadline).toISOString() : null),
          timeTaken: timeTaken,
          timeTakenFormatted: timeTaken ? `${Math.floor(timeTaken / (1000 * 60 * 60))}h ${Math.floor((timeTaken % (1000 * 60 * 60)) / (1000 * 60))}m` : null,
          isOverdue: isOverdue,
          storeId: task.storeId,
          targetAudience: task.targetAudience,
          assignedStores: task.assignedStores || []
        };
      })
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const metrics = getMetrics();
  const filteredTasks = getFilteredTasks();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Reports & Analytics</h1>
        <button
          onClick={downloadReport}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Download Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Report Filters</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({...filters, priority: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Categories</option>
              <option value="general">General</option>
              <option value="sales">Sales</option>
              <option value="inventory">Inventory</option>
              <option value="maintenance">Maintenance</option>
              <option value="training">Training</option>
              <option value="customer_service">Customer Service</option>
            </select>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid md:grid-cols-6 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{metrics.total}</div>
          <div className="text-sm text-gray-600">Total Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">{metrics.completed}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">{metrics.inProgress}</div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">{metrics.overdueTasks}</div>
          <div className="text-sm text-gray-600">Overdue</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">{metrics.completionRate}%</div>
          <div className="text-sm text-gray-600">Completion Rate</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-indigo-600">{metrics.avgCompletionTime}h</div>
          <div className="text-sm text-gray-600">Avg Time</div>
        </div>
      </div>

      {/* Task Details Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Task Details Report</h3>
          <p className="text-sm text-gray-600 mt-1">Showing {filteredTasks.length} tasks</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Taken</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTasks.map((task) => {
                // Calculate time taken for completed tasks
                let timeTaken = 'N/A';
                if (task.status === 'completed' && task.completedAt && task.createdAt) {
                  const startTime = task.createdAt?.toDate?.() || new Date(task.createdAt);
                  const endTime = task.completedAt?.toDate?.() || new Date(task.completedAt);
                  const timeDiff = endTime - startTime;
                  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                  timeTaken = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
                }

                // Check if task is overdue
                const isOverdue = task.status !== 'completed' && task.deadline && 
                  (task.deadline?.toDate?.() || new Date(task.deadline)) < new Date();

                return (
                  <tr key={task.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{task.title}</div>
                      <div className="text-sm text-gray-500 max-w-xs truncate">{task.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.priority === 'high' ? 'bg-red-100 text-red-800' :
                        task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {task.priority?.toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        task.status === 'completed' ? 'bg-green-100 text-green-800' :
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {task.status?.replace('_', ' ').toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.category?.replace('_', ' ').toUpperCase() || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.createdBy || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <span className="font-medium">{task.assignees?.length || 0} people</span>
                        {task.assignees && task.assignees.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {task.assignees.slice(0, 2).join(', ')}
                            {task.assignees.length > 2 && ` +${task.assignees.length - 2} more`}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.completedBy && task.completedBy.length > 0 ? (
                        <div>
                          <span className="font-medium">{task.completedBy.length} people</span>
                          <div className="text-xs text-gray-500 mt-1">
                            {task.completedBy.slice(0, 2).join(', ')}
                            {task.completedBy.length > 2 && ` +${task.completedBy.length - 2} more`}
                          </div>
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.createdAt?.toDate ? 
                        task.createdAt.toDate().toLocaleDateString() : 
                        new Date(task.createdAt).toLocaleDateString()
                      }
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.completedAt ? (
                        task.completedAt?.toDate ? 
                          task.completedAt.toDate().toLocaleDateString() : 
                          new Date(task.completedAt).toLocaleDateString()
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className={`font-medium ${
                        timeTaken !== 'N/A' ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {timeTaken}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {task.deadline ? (
                        <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                          {task.deadline?.toDate ? 
                            task.deadline.toDate().toLocaleDateString() : 
                            new Date(task.deadline).toLocaleDateString()
                          }
                          {isOverdue && <span className="text-xs text-red-500 ml-1">(OVERDUE)</span>}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
