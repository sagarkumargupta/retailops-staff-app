import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { filterAssignedItems } from '../utils/assignmentUtils';

const MyTasks = () => {
  const { profile } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // all, pending, in_progress, completed, overdue

  useEffect(() => {
    loadData();
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
      if (!profile?.email) {
        console.log('Profile not loaded yet, skipping tasks load');
        return;
      }
      
      let q;
      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
        q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      } else {
        // For staff and managers, load tasks based on their assignment
        q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
      }

      const snapshot = await getDocs(q);
      let tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter tasks based on user assignment using unified utility
      if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
        console.log('Filtering tasks for user:', {
          role: profile?.role,
          email: profile?.email,
          totalTasks: tasksData.length
        });

        // Convert task assignment format to unified format
        const unifiedTasks = tasksData.map(task => ({
          ...task,
          targetAudience: task.targetAudience || task.assignTo // Use targetAudience if available, otherwise fallback to assignTo
        }));

        const filteredTasks = filterAssignedItems(unifiedTasks, profile);
        
        // Convert back to original format
        tasksData = filteredTasks.map(task => {
          const { targetAudience, ...originalTask } = task;
          return originalTask;
        });

        console.log('Filtered tasks count:', tasksData.length);
      }

      setTasks(tasksData);
    } catch (error) {
      console.error('Error loading tasks with orderBy:', error);
      
      // Enhanced fallback: handle both index errors and other errors
      try {
        console.log('Falling back to client-side sorting for tasks');
        const q = query(collection(db, 'tasks'));
        
        const snapshot = await getDocs(q);
        let tasksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter tasks based on user assignment using unified utility
        if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ADMIN') {
          // Convert task assignment format to unified format
          const unifiedTasks = tasksData.map(task => ({
            ...task,
            targetAudience: task.targetAudience || task.assignTo // Use targetAudience if available, otherwise fallback to assignTo
          }));

          const filteredTasks = filterAssignedItems(unifiedTasks, profile);
          
          // Convert back to original format
          tasksData = filteredTasks.map(task => {
            const { targetAudience, ...originalTask } = task;
            return originalTask;
          });
        }
        
        // Sort client-side
        tasksData = tasksData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB - dateA;
        });
        
        setTasks(tasksData);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setTasks([]);
      }
    }
  };

  const getTaskStatus = (task) => {
    // Debug logging
    console.log('getTaskStatus debug:', {
      taskId: task.id,
      taskTitle: task.title,
      taskStatus: task.status,
      storeCompletions: task.storeCompletions,
      completedBy: task.completedBy,
      userStore: profile?.assignedStore,
      userEmail: profile?.email
    });
    
    // First check if task has store-specific completions
    if (task.storeCompletions && profile?.assignedStore) {
      const userStore = profile.assignedStore;
      const storeCompletion = task.storeCompletions[userStore];
      
      console.log('Store completion check:', {
        userStore,
        storeCompletion,
        assignmentType: task.assignmentType
      });
      
      if (storeCompletion) {
        // Check if task is complete for this store
        if (task.assignmentType === 'individual') {
          // For individual tasks, check if all assignees from this store completed it
          const storeAssignees = task.assignees?.filter(assigneeEmail => {
            // For now, assume all assignees are from the same store
            // In a more complex system, you'd check the actual store assignment
            return true;
          }) || [];
          
          const storeCompleted = storeCompletion.completedBy?.length || 0;
          console.log('Individual task completion:', {
            storeAssignees: storeAssignees.length,
            storeCompleted,
            isComplete: storeCompleted >= storeAssignees.length
          });
          
          if (storeCompleted >= storeAssignees.length) {
            return 'completed';
          }
        } else {
          // Team or regular task: complete if anyone from this store completed it
          const hasCompletion = storeCompletion.completedBy?.length > 0;
          console.log('Team task completion:', {
            completedBy: storeCompletion.completedBy,
            hasCompletion
          });
          
          if (hasCompletion) {
            return 'completed';
          }
        }
        
        // If there's store completion data but not complete, it's in progress
        return 'in_progress';
      }
    }
    
    // Fallback to old logic for backward compatibility
    if (task.status === 'completed') return 'completed';
    if (task.status === 'in_progress') return 'in_progress';
    
    // Check if user has completed this task (for backward compatibility)
    if (task.completedBy && Array.isArray(task.completedBy) && task.completedBy.includes(profile?.email)) {
      return 'completed';
    }
    
    // Check if overdue
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const now = new Date();
      if (deadline < now && task.status !== 'completed') {
        return 'overdue';
      }
    }
    
    return 'pending';
  };

  const getFilteredTasks = () => {
    if (filter === 'all') return tasks;
    
    return tasks.filter(task => {
      const status = getTaskStatus(task);
      return status === filter;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'cleaning': return '🧹';
      case 'maintenance': return '🔧';
      case 'operations': return '⚙️';
      case 'sales': return '💰';
      case 'customer_service': return '👥';
      case 'inventory': return '📦';
      case 'general': return '📋';
      default: return '📋';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No deadline';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const pending = tasks.filter(task => getTaskStatus(task) === 'pending').length;
    const inProgress = tasks.filter(task => getTaskStatus(task) === 'in_progress').length;
    const completed = tasks.filter(task => getTaskStatus(task) === 'completed').length;
    const overdue = tasks.filter(task => getTaskStatus(task) === 'overdue').length;
    
    return { total, pending, inProgress, completed, overdue };
  };

  const stats = getTaskStats();
  const filteredTasks = getFilteredTasks();

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
              <p className="mt-2 text-gray-600">
                View and manage your assigned tasks
              </p>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
            <div className="text-sm text-gray-600">Overdue</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {[
                { key: 'all', label: 'All Tasks', count: stats.total },
                { key: 'pending', label: 'Pending', count: stats.pending },
                { key: 'in_progress', label: 'In Progress', count: stats.inProgress },
                { key: 'completed', label: 'Completed', count: stats.completed },
                { key: 'overdue', label: 'Overdue', count: stats.overdue }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tasks List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">
                {filter === 'all' 
                  ? "You don't have any tasks assigned yet." 
                  : `No ${filter.replace('_', ' ')} tasks found.`
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTasks.map((task) => {
                const status = getTaskStatus(task);
                return (
                  <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-2xl">{getCategoryIcon(task.category)}</span>
                          <h3 className="text-lg font-medium text-gray-900">{task.title}</h3>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                            {status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-3">{task.description}</p>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Due: {formatDate(task.deadline)}
                          </div>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {task.estimatedHours}h estimated
                          </div>
                          {task.hasSteps && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              {task.steps?.length || 0} steps
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <Link
                          to={`/task-execution/${task.id}`}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {task.hasSteps ? 'Start Task' : 'View Details'}
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyTasks;



