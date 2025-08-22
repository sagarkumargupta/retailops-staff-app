import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function TaskResponses() {
  const { profile } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [taskResponses, setTaskResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    taskId: 'all',
    responseType: 'all',
    dateRange: 'month',
    status: 'all',
    assignedTo: 'all',
    completedBy: 'all',
    assignmentType: 'all'
  });
  const [showAssigneesModal, setShowAssigneesModal] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [selectedTaskSteps, setSelectedTaskSteps] = useState([]);

  useEffect(() => {
    if (profile) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading data for profile:', profile?.email, 'Role:', profile?.role);
      
      // Load tasks first and get the filtered tasks list
      const tasksList = await loadTasks();
      
      // Then extract responses from the tasks
      await loadTaskResponses(tasksList);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      if (!profile) return [];
      
      console.log('Loading tasks...');
      const tasksSnap = await getDocs(collection(db, 'tasks'));
      let tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Total tasks found:', tasksList.length);
      
      // Filter based on user role
      if (profile.role === 'MANAGER') {
        tasksList = tasksList.filter(task => {
          // Use targetAudience if available, otherwise fallback to assignTo
          const assignmentType = task.targetAudience || task.assignTo;
          
          return task.createdBy === profile.email || 
            (task.assignees && Array.isArray(task.assignees) && task.assignees.includes(profile.email)) ||
            assignmentType === 'all_managers' ||
            assignmentType === 'all_staff';
        });
        console.log('Tasks after MANAGER filtering:', tasksList.length);
      } else if (profile.role === 'STAFF') {
        tasksList = tasksList.filter(task => {
          // Use targetAudience if available, otherwise fallback to assignTo
          const assignmentType = task.targetAudience || task.assignTo;
          
          return (task.assignees && Array.isArray(task.assignees) && task.assignees.includes(profile.email)) ||
            assignmentType === 'all_staff';
        });
        console.log('Tasks after STAFF filtering:', tasksList.length);
      }
      
      setTasks(tasksList);
      return tasksList; // Return the filtered tasks list
    } catch (error) {
      console.error('Error loading tasks:', error);
      return [];
    }
  };

  const loadTaskResponses = async (tasksList) => {
    try {
      if (!profile) return;

      console.log('Loading task responses...');
      console.log('Tasks available for response extraction:', tasksList.length);
      
      let allResponses = [];

      // Extract responses from tasks themselves - this is where the actual responses are stored
      tasksList.forEach(task => {
        console.log('Processing task:', task.id, task.title, 'StepValidations:', task.stepValidations ? Object.keys(task.stepValidations).length : 0);
        
        // Debug: Log task structure to understand what data is available
        console.log('Task structure:', {
          id: task.id,
          title: task.title,
          hasStepValidations: !!task.stepValidations,
          stepValidationsKeys: task.stepValidations ? Object.keys(task.stepValidations) : [],
          hasSteps: !!task.steps,
          stepsCount: task.steps ? task.steps.length : 0,
          status: task.status,
          completedBy: task.completedBy
        });
        
                         // Add task creation response
        try {
          allResponses.push({
            id: `${task.id}_creation`,
            taskId: task.id,
            taskTitle: task.title,
            collection: 'tasks',
            type: 'creation',
            message: `Task created: ${task.description}`,
            createdBy: task.createdBy || 'Unknown',
            timestamp: task.createdAt,
            stepNumber: 1,
            stepTitle: 'Task Creation',
            validationStatus: 'created',
            assignmentType: task.assignmentType || 'team',
            targetAudience: task.targetAudience || task.assignTo || 'all_staff',
            assignees: task.assignees || [],
            completedBy: task.completedBy || [],
            totalAssigned: getTotalAssignedCount(task),
            totalCompleted: Array.isArray(task.completedBy) ? task.completedBy.length : (task.completedBy ? 1 : 0),
            completionStatus: getTaskCompletionStatus(task),
            task: task // Include full task object for reference
          });
        } catch (error) {
          console.error('Error creating task creation response:', error);
        }

                // Extract actual step validation responses from stepValidations field
        if (task.stepValidations) {
          Object.keys(task.stepValidations).forEach(stepIndex => {
            try {
              const validation = task.stepValidations[stepIndex];
              console.log(`Step ${stepIndex} validation:`, validation);
              if (validation && validation.completed) {
                const stepData = task.steps ? task.steps[parseInt(stepIndex)] : null;
                const stepTitle = stepData?.title || `Step ${parseInt(stepIndex) + 1}`;
                
                // Extract the actual response content based on validation type
                let responseContent = '';
                let responseType = 'validation';
                let fileUrl = null;
                
                if (validation.validation) {
                  switch (validation.validation.type) {
                    case 'text':
                      responseContent = validation.validation.content || '';
                      responseType = 'text';
                      break;
                    case 'image':
                      responseContent = 'Image uploaded';
                      responseType = 'image';
                      fileUrl = validation.validation.url || null;
                      break;
                    case 'voice':
                      responseContent = 'Voice note recorded';
                      responseType = 'voice';
                      fileUrl = validation.validation.url || null;
                      break;
                    case 'checklist':
                      responseContent = validation.validation.checked ? 'Task completed' : 'Task marked as incomplete';
                      responseType = 'checklist';
                      break;
                    default:
                      responseContent = 'Response submitted';
                      responseType = 'other';
                  }
                }
                
                allResponses.push({
                  id: `${task.id}_step_${stepIndex}`,
                  taskId: task.id,
                  taskTitle: task.title,
                  collection: 'tasks',
                  type: responseType,
                  message: responseContent,
                  fileUrl: fileUrl,
                  createdBy: validation.submittedBy || 'Unknown',
                  timestamp: validation.timestamp,
                  stepNumber: parseInt(stepIndex) + 1,
                  stepTitle: stepTitle,
                  validationStatus: validation.validation?.type || 'completed',
                  question: stepData?.question || stepData?.title || `Step ${parseInt(stepIndex) + 1}`,
                  answer: responseContent,
                  assignmentType: task.assignmentType || 'team',
                  targetAudience: task.targetAudience || task.assignTo || 'all_staff',
                  assignees: task.assignees || [],
                  completedBy: task.completedBy || [],
                  totalAssigned: getTotalAssignedCount(task),
                  totalCompleted: Array.isArray(task.completedBy) ? task.completedBy.length : (task.completedBy ? 1 : 0),
                  completionStatus: getTaskCompletionStatus(task),
                  task: task // Include full task object for reference
                });
              }
            } catch (error) {
              console.error(`Error processing step ${stepIndex} validation:`, error);
            }
          });
        }

                         // Add task completion response if task is completed
        if (task.status === 'completed' && task.completedBy) {
          try {
            allResponses.push({
              id: `${task.id}_completion`,
              taskId: task.id,
              taskTitle: task.title,
              collection: 'tasks',
              type: 'completion',
              statusUpdate: `Task completed by ${Array.isArray(task.completedBy) ? task.completedBy.join(', ') : task.completedBy}`,
              createdBy: Array.isArray(task.completedBy) ? task.completedBy[0] : task.completedBy,
              timestamp: task.completedAt,
              stepNumber: task.steps ? task.steps.length : 1,
              stepTitle: 'Task Completion',
              validationStatus: 'completed',
              assignmentType: task.assignmentType || 'team',
              targetAudience: task.targetAudience || task.assignTo || 'all_staff',
              assignees: task.assignees || [],
              completedBy: task.completedBy || [],
              totalAssigned: getTotalAssignedCount(task),
              totalCompleted: Array.isArray(task.completedBy) ? task.completedBy.length : (task.completedBy ? 1 : 0),
              completionStatus: getTaskCompletionStatus(task),
              task: task // Include full task object for reference
            });
          } catch (error) {
            console.error('Error creating task completion response:', error);
          }
        }
      });

      console.log('Total responses found:', allResponses.length);
      console.log('Sample responses:', allResponses.slice(0, 3));
      
      // If no responses found, add sample data for debugging
      if (allResponses.length === 0) {
        console.log('No responses found, adding sample data for debugging...');
        allResponses = [
          {
            id: 'sample_creation',
            taskId: 'sample_task',
            taskTitle: 'Sample Task',
            collection: 'tasks',
            type: 'creation',
            message: 'Sample task created for debugging',
            createdBy: profile.email,
            timestamp: new Date(),
            stepNumber: 1,
            stepTitle: 'Task Creation',
            validationStatus: 'created',
            assignmentType: 'team',
            targetAudience: 'all_staff',
            assignees: [],
            completedBy: [],
            totalAssigned: 'All Staff',
            totalCompleted: 0,
            completionStatus: 'Pending',
            task: { id: 'sample_task', title: 'Sample Task' }
          }
        ];
        console.log('Added sample response for debugging');
      }
      
      setTaskResponses(allResponses);
    } catch (error) {
      console.error('Error loading task responses:', error);
    }
  };

  // Helper function to get assignment display text
  const getAssignmentDisplay = (task) => {
    // Use targetAudience if available (new unified system), otherwise fallback to assignTo
    const assignmentType = task.targetAudience || task.assignTo;
    
    if (assignmentType === 'all_staff') {
      return 'All Staff';
    } else if (assignmentType === 'all_managers') {
      return 'All Managers';
    } else if (assignmentType === 'location') {
      return `Location-based (${task.assignedStores?.length || 0} stores)`;
    } else if (assignmentType === 'brand') {
      return `Brand: ${task.brand || 'Unknown'}`;
    } else if (assignmentType === 'individual') {
      return task.assignees?.join(', ') || 'No assignees';
    } else if (task.assignees && Array.isArray(task.assignees) && task.assignees.length > 0) {
      return task.assignees.join(', ');
    }
    return 'Not assigned';
  };

  // Helper function to get total assigned count
  const getTotalAssignedCount = (task) => {
    // Use targetAudience if available (new unified system), otherwise fallback to assignTo
    const assignmentType = task.targetAudience || task.assignTo;
    
    if (assignmentType === 'all_staff') {
      return 'All Staff';
    } else if (assignmentType === 'all_managers') {
      return 'All Managers';
    } else if (assignmentType === 'location') {
      return `Location (${task.assignedStores?.length || 0} stores)`;
    } else if (assignmentType === 'brand') {
      return `Brand: ${task.brand || 'Unknown'}`;
    } else if (assignmentType === 'individual') {
      return task.assignees?.length || 0;
    } else if (task.assignees && Array.isArray(task.assignees)) {
      return task.assignees.length;
    }
    return 'Unknown';
  };

  // Helper function to get task completion status
  const getTaskCompletionStatus = (task) => {
    const assignmentType = task.assignmentType || 'team';
    const completedCount = Array.isArray(task.completedBy) ? task.completedBy.length : (task.completedBy ? 1 : 0);
    
    if (assignmentType === 'team') {
      // Team task: anyone can complete
      return completedCount > 0 ? 'Completed' : 'Pending';
    } else if (assignmentType === 'individual') {
      // Individual task: everyone must complete
      const totalAssigned = getTotalAssignedCount(task);
      if (typeof totalAssigned === 'number') {
        return completedCount >= totalAssigned ? 'Completed' : `In Progress (${completedCount}/${totalAssigned})`;
      } else {
        return completedCount > 0 ? 'Partially Completed' : 'Pending';
      }
    }
    return 'Unknown';
  };

  // Helper function to get completion status color
  const getCompletionStatusColor = (status) => {
    if (status === 'Completed') return 'bg-green-100 text-green-800';
    if (status === 'In Progress') return 'bg-yellow-100 text-yellow-800';
    if (status.includes('Partially')) return 'bg-orange-100 text-orange-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getFilteredResponses = () => {
    let filteredResponses = [...taskResponses];

    if (filters.taskId !== 'all') {
      filteredResponses = filteredResponses.filter(response => 
        response.taskId === filters.taskId
      );
    }

    if (filters.responseType !== 'all') {
      filteredResponses = filteredResponses.filter(response => {
        if (filters.responseType === 'attachment') {
          return response.fileUrl || response.type === 'image' || response.type === 'voice';
        } else if (filters.responseType === 'text') {
          return response.message || response.type === 'text' || response.type === 'comment';
        } else if (filters.responseType === 'status_update') {
          return response.statusUpdate || response.type === 'completion' || response.type === 'creation';
        }
        return true;
      });
    }

    if (filters.assignedTo !== 'all') {
      filteredResponses = filteredResponses.filter(response => {
        const task = response.task;
        if (!task) return false;
        
        // Use targetAudience if available, otherwise fallback to assignTo
        const assignmentType = task.targetAudience || task.assignTo;
        
        // Check if the task is assigned to the selected user
        if (assignmentType === 'all_staff' && filters.assignedTo === 'all_staff') {
          return true;
        } else if (assignmentType === 'all_managers' && filters.assignedTo === 'all_managers') {
          return true;
        } else if (task.assignees && Array.isArray(task.assignees) && task.assignees.includes(filters.assignedTo)) {
          return true;
        }
        return false;
      });
    }

    if (filters.completedBy !== 'all') {
      filteredResponses = filteredResponses.filter(response => 
        response.createdBy === filters.completedBy
      );
    }

    if (filters.assignmentType !== 'all') {
      filteredResponses = filteredResponses.filter(response => 
        response.assignmentType === filters.assignmentType
      );
    }

    // Group responses by task
    const groupedResponses = filteredResponses.reduce((groups, response) => {
      if (!groups[response.taskId]) {
        groups[response.taskId] = [];
      }
      groups[response.taskId].push(response);
      return groups;
    }, {});

    // Convert grouped responses to task-level summaries
    const taskSummaries = Object.entries(groupedResponses).map(([taskId, taskResponses]) => {
      // Sort responses within the task
      const sortedResponses = taskResponses.sort((a, b) => {
        if (a.type === 'creation') return -1;
        if (b.type === 'creation') return 1;
        if (a.type === 'completion') return 1;
        if (b.type === 'completion') return -1;
        return (a.stepNumber || 0) - (b.stepNumber || 0);
      });

      // Get the first response for basic info
      const firstResponse = sortedResponses[0];
      
      // Count different types of responses
      const stepResponses = sortedResponses.filter(r => r.type !== 'creation' && r.type !== 'completion');
      const hasAttachments = sortedResponses.some(r => r.fileUrl);
      const hasTextResponses = sortedResponses.some(r => r.message || r.type === 'text');
      
      // Get completion status
      const completionResponse = sortedResponses.find(r => r.type === 'completion');
      const isCompleted = !!completionResponse;
      
      // Get task info
      const task = firstResponse.task;
      const isMultiStep = task && task.steps && task.steps.length > 1;
      
      return {
        id: taskId,
        taskId: taskId,
        taskTitle: firstResponse.taskTitle,
        task: task,
        responses: sortedResponses,
        stepCount: stepResponses.length,
        totalSteps: isMultiStep ? task.steps.length : 1,
        isMultiStep: isMultiStep,
        isCompleted: isCompleted,
        hasAttachments: hasAttachments,
        hasTextResponses: hasTextResponses,
        assignmentType: firstResponse.assignmentType,
        targetAudience: firstResponse.targetAudience,
        assignees: firstResponse.assignees,
        completedBy: firstResponse.completedBy,
        totalAssigned: firstResponse.totalAssigned,
        totalCompleted: firstResponse.totalCompleted,
        completionStatus: firstResponse.completionStatus,
        createdAt: firstResponse.timestamp || firstResponse.createdAt,
        completedAt: completionResponse?.timestamp || completionResponse?.createdAt,
        createdBy: firstResponse.createdBy
      };
    });

    // Sort by creation date (newest first)
    return taskSummaries.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return dateB - dateA;
    });
  };

  const getResponseType = (response) => {
    if (response.fileUrl || response.type === 'image' || response.type === 'voice') {
      return 'attachment';
    } else if (response.statusUpdate || response.type === 'completion' || response.type === 'creation') {
      return 'status_update';
    } else if (response.message || response.type === 'text' || response.type === 'comment') {
      return 'text';
    }
    return 'other';
  };

  const getTaskExecutionInfo = (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      return {
        assignedTo: task.assignTo && Array.isArray(task.assignTo) ? task.assignTo.join(', ') : 'Not assigned',
        completedBy: task.completedBy && Array.isArray(task.completedBy) ? task.completedBy.join(', ') : task.completedBy,
        startTime: task.createdAt,
        completionTime: task.completedAt,
        totalTime: task.completedAt && task.createdAt ? 
          new Date(task.completedAt.toDate ? task.completedAt.toDate() : task.completedAt) - 
          new Date(task.createdAt.toDate ? task.createdAt.toDate() : task.createdAt) : null,
        steps: task.steps || [],
        currentStep: task.steps ? task.steps.length : 1,
        totalSteps: task.steps ? task.steps.length : 1
      };
    }
    return null;
  };

  const formatDuration = (milliseconds) => {
    if (!milliseconds) return 'N/A';
    const hours = Math.floor(milliseconds / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getValidationStatusColor = (status) => {
    switch (status) {
      case 'passed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'created': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const downloadResponsesReport = () => {
    const filteredResponses = getFilteredResponses();
    
    const reportData = {
      reportInfo: {
        generatedAt: new Date().toISOString(),
        filters,
        totalResponses: filteredResponses.length,
        userRole: profile?.role,
        userEmail: profile?.email
      },
      responses: filteredResponses.map(response => {
        const executionInfo = getTaskExecutionInfo(response.taskId);
        return {
          id: response.id,
          taskId: response.taskId,
          taskTitle: response.taskTitle,
          type: getResponseType(response),
          message: response.message || response.statusUpdate || '',
          fileUrl: response.fileUrl,
          createdBy: response.createdBy,
          timestamp: response.timestamp?.toDate ? response.timestamp.toDate().toISOString() : 
                    response.createdAt?.toDate ? response.createdAt.toISOString() : 
                    new Date(response.timestamp || response.createdAt).toISOString(),
          stepNumber: response.stepNumber,
          stepTitle: response.stepTitle,
          validationStatus: response.validationStatus,
          assignedTo: executionInfo?.assignedTo,
          completedBy: executionInfo?.completedBy,
          startTime: executionInfo?.startTime?.toDate ? executionInfo.startTime.toDate().toISOString() : 
                    executionInfo?.startTime ? new Date(executionInfo.startTime).toISOString() : null,
          completionTime: executionInfo?.completionTime?.toDate ? executionInfo.completionTime.toDate().toISOString() : 
                         executionInfo?.completionTime ? new Date(executionInfo.completionTime).toISOString() : null,
          totalTime: executionInfo?.totalTime ? formatDuration(executionInfo.totalTime) : null,
          currentStep: executionInfo?.currentStep,
          totalSteps: executionInfo?.totalSteps
        };
      })
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-responses-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getAllAssignees = () => {
    const assignees = new Set();
    tasks.forEach(task => {
      // Add specific assignees
      if (task.assignees && Array.isArray(task.assignees)) {
        task.assignees.forEach(assignee => assignees.add(assignee));
      }
      
      // Add assignment types (use targetAudience if available, otherwise fallback to assignTo)
      const assignmentType = task.targetAudience || task.assignTo;
      if (assignmentType === 'all_staff') {
        assignees.add('all_staff');
      } else if (assignmentType === 'all_managers') {
        assignees.add('all_managers');
      }
    });
    return Array.from(assignees);
  };

  const getAllCompleters = () => {
    const completers = new Set();
    taskResponses.forEach(response => {
      if (response.createdBy) {
        completers.add(response.createdBy);
      }
    });
    return Array.from(completers);
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
    return <div className="p-6">Loading task responses...</div>;
  }

  const filteredResponses = getFilteredResponses();
  console.log('Filtered responses:', filteredResponses.length);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task Responses & Communications</h1>
        <button
          onClick={downloadResponsesReport}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          Download Responses Report
        </button>
      </div>

      {/* Debug Info */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Information</h3>
        <div className="text-sm text-yellow-700">
          <p><strong>User:</strong> {profile.email} ({profile.role})</p>
          <p><strong>Total Tasks:</strong> {tasks.length}</p>
          <p><strong>Total Responses:</strong> {taskResponses.length}</p>
          <p><strong>Filtered Responses:</strong> {filteredResponses.length}</p>
          <p><strong>Response Collections Found:</strong> {[...new Set(taskResponses.map(r => r.collection))].join(', ')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Response Filters</h3>
        <div className="grid md:grid-cols-7 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task</label>
            <select
              value={filters.taskId}
              onChange={(e) => setFilters({...filters, taskId: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Tasks</option>
              {tasks.map(task => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Response Type</label>
            <select
              value={filters.responseType}
              onChange={(e) => setFilters({...filters, responseType: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Types</option>
              <option value="text">Text Messages</option>
              <option value="attachment">Attachments</option>
              <option value="status_update">Status Updates</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
            <select
              value={filters.assignedTo}
              onChange={(e) => setFilters({...filters, assignedTo: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Assignees</option>
              {getAllAssignees().map(assignee => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Completed By</label>
            <select
              value={filters.completedBy}
              onChange={(e) => setFilters({...filters, completedBy: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Users</option>
              {getAllCompleters().map(completer => (
                <option key={completer} value={completer}>
                  {completer}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="week">Last Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Type</label>
            <select
              value={filters.assignmentType}
              onChange={(e) => setFilters({...filters, assignmentType: e.target.value})}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="all">All Types</option>
              <option value="team">Team</option>
              <option value="individual">Individual</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-7 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">{filteredResponses.length}</div>
          <div className="text-sm text-gray-600">Total Responses</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {filteredResponses.filter(r => getResponseType(r) === 'text').length}
          </div>
          <div className="text-sm text-gray-600">Text Messages</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-purple-600">
            {filteredResponses.filter(r => getResponseType(r) === 'attachment').length}
          </div>
          <div className="text-sm text-gray-600">Attachments</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-orange-600">
            {filteredResponses.filter(r => getResponseType(r) === 'status_update').length}
          </div>
          <div className="text-sm text-gray-600">Status Updates</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-indigo-600">
            {filteredResponses.filter(r => r.assignmentType === 'team').length}
          </div>
          <div className="text-sm text-gray-600">Team Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-pink-600">
            {filteredResponses.filter(r => r.assignmentType === 'individual').length}
          </div>
          <div className="text-sm text-gray-600">Individual Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">
            {filteredResponses.filter(r => r.completionStatus === 'Completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
      </div>

      {/* Responses Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Task Responses & Communications</h3>
          <p className="text-sm text-gray-600 mt-1">Showing {filteredResponses.length} responses</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
                         <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Steps</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assignment Type</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completion Status</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
               </tr>
             </thead>
                         <tbody className="bg-white divide-y divide-gray-200">
               {filteredResponses.map((taskSummary, index) => {
                 const taskDate = taskSummary.createdAt?.toDate?.() || new Date(taskSummary.createdAt);
                 const completionDate = taskSummary.completedAt?.toDate?.() || new Date(taskSummary.completedAt);
                 
                 return (
                   <tr key={taskSummary.id} className="hover:bg-gray-50">
                     <td className="px-6 py-4">
                       <div className="text-sm font-medium text-gray-900">
                         {taskSummary.taskTitle || `Task ${taskSummary.taskId}`}
                       </div>
                       <div className="text-xs text-gray-500">ID: {taskSummary.taskId}</div>
                       {taskSummary.isMultiStep && (
                         <div className="text-xs text-blue-600 font-medium">
                           📋 Multi-Step Task ({taskSummary.totalSteps} steps)
                         </div>
                       )}
                     </td>
                     <td className="px-6 py-4">
                       <div className="text-sm font-medium text-gray-900">
                         {taskSummary.stepCount}/{taskSummary.totalSteps} steps
                       </div>
                       <div className="text-xs text-gray-500">
                         {taskSummary.isMultiStep ? 'Multi-step task' : 'Single step task'}
                       </div>
                       {taskSummary.isMultiStep && (
                         <button
                           onClick={() => {
                             setSelectedTaskSteps(taskSummary.responses);
                             setShowStepsModal(true);
                           }}
                           className="mt-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                         >
                           View All Steps
                         </button>
                       )}
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex items-center space-x-2">
                         <div className="w-full bg-gray-200 rounded-full h-2">
                           <div 
                             className="bg-green-600 h-2 rounded-full" 
                             style={{ width: `${taskSummary.totalSteps ? (taskSummary.stepCount / taskSummary.totalSteps) * 100 : 0}%` }}
                           ></div>
                         </div>
                         <span className="text-xs text-gray-500">
                           {Math.round((taskSummary.stepCount / taskSummary.totalSteps) * 100)}%
                         </span>
                       </div>
                       <div className="text-xs text-gray-500 mt-1">
                         {taskSummary.hasAttachments && '📎'} {taskSummary.hasTextResponses && '📝'}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                         taskSummary.assignmentType === 'team' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                       }`}>
                         {taskSummary.assignmentType === 'team' ? 'Team (Anyone)' : 'Individual (Everyone)'}
                       </span>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div>
                         <div className="font-medium">{getAssignmentDisplay(taskSummary.task)}</div>
                         {taskSummary.assignees && Array.isArray(taskSummary.assignees) && taskSummary.assignees.length > 0 && (
                           <div className="text-xs text-gray-500">
                             <span>Specific: {taskSummary.assignees.length} people</span>
                             <button
                               onClick={() => {
                                 setSelectedAssignees(taskSummary.assignees);
                                 setShowAssigneesModal(true);
                               }}
                               className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-medium"
                             >
                               View
                             </button>
                           </div>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div>
                         <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCompletionStatusColor(taskSummary.completionStatus)}`}>
                           {taskSummary.completionStatus}
                         </span>
                         {taskSummary.totalCompleted > 0 && (
                           <div className="text-xs text-gray-500 mt-1">
                             <span>Completed by: {Array.isArray(taskSummary.completedBy) ? taskSummary.completedBy.length : 1} people</span>
                             <button
                               onClick={() => {
                                 setSelectedAssignees(Array.isArray(taskSummary.completedBy) ? taskSummary.completedBy : [taskSummary.completedBy]);
                                 setShowAssigneesModal(true);
                               }}
                               className="ml-2 text-blue-600 hover:text-blue-800 text-xs font-medium"
                             >
                               View
                             </button>
                           </div>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       {taskSummary.createdBy || 'Unknown'}
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div>
                         <div>{taskDate.toLocaleDateString()}</div>
                         <div className="text-xs text-gray-500">{taskDate.toLocaleTimeString()}</div>
                         {taskSummary.isCompleted && (
                           <div className="text-xs text-green-600">
                             Completed: {completionDate.toLocaleDateString()}
                           </div>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-900">
                       <div className="flex space-x-2">
                         {taskSummary.isMultiStep && (
                           <button
                             onClick={() => {
                               setSelectedTaskSteps(taskSummary.responses);
                               setShowStepsModal(true);
                             }}
                             className="text-blue-600 hover:text-blue-800 text-xs"
                           >
                             View Steps
                           </button>
                         )}
                         <button
                           onClick={() => {
                             const details = `Task: ${taskSummary.taskTitle}\nSteps: ${taskSummary.stepCount}/${taskSummary.totalSteps}\nStatus: ${taskSummary.completionStatus}\nCreated: ${taskDate.toLocaleString()}\nCompleted: ${taskSummary.isCompleted ? completionDate.toLocaleString() : 'Not completed'}`;
                             navigator.clipboard.writeText(details);
                           }}
                           className="text-gray-600 hover:text-gray-800 text-xs"
                         >
                           Copy
                         </button>
                       </div>
                     </td>
                   </tr>
                 );
               })}
             </tbody>
          </table>
        </div>
      </div>

             {/* Steps Details Modal */}
       {showStepsModal && selectedTaskSteps.length > 0 && (
         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
           <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 shadow-lg rounded-md bg-white">
             <div className="mt-3">
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-medium text-gray-900">Task Steps & Responses</h3>
                 <button
                   onClick={() => setShowStepsModal(false)}
                   className="text-gray-400 hover:text-gray-600"
                 >
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                   </svg>
                 </button>
               </div>
               
               <div className="space-y-4">
                 {selectedTaskSteps.map((response, index) => {
                   const responseDate = response.timestamp?.toDate?.() || 
                                      response.createdAt?.toDate?.() || 
                                      new Date(response.timestamp || response.createdAt);
                   
                   return (
                     <div key={response.id} className="border rounded-lg p-4 bg-gray-50">
                       <div className="flex items-start justify-between">
                         <div className="flex-1">
                           <div className="flex items-center space-x-2 mb-2">
                             <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                               {response.type === 'creation' ? 'Task Created' : 
                                response.type === 'completion' ? 'Task Completed' : 
                                `Step ${response.stepNumber}`}
                             </span>
                             <span className="text-sm font-medium text-gray-900">
                               {response.stepTitle || response.type}
                             </span>
                           </div>
                           
                           <div className="text-sm text-gray-600 mb-2">
                             {response.message || response.statusUpdate || 'No response content'}
                           </div>
                           
                           <div className="flex items-center space-x-4 text-xs text-gray-500">
                             <span>By: {response.createdBy}</span>
                             <span>{responseDate.toLocaleDateString()} {responseDate.toLocaleTimeString()}</span>
                             {response.fileUrl && (
                               <a href={response.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                                 📎 View Attachment
                               </a>
                             )}
                           </div>
                         </div>
                         
                         <div className="ml-4">
                           <span className={`px-2 py-1 text-xs font-medium rounded-full ${getValidationStatusColor(response.validationStatus)}`}>
                             {response.validationStatus?.toUpperCase() || 'COMPLETED'}
                           </span>
                         </div>
                       </div>
                     </div>
                   );
                 })}
               </div>

               <div className="flex justify-end space-x-3 pt-4">
                 <button
                   onClick={() => setShowStepsModal(false)}
                   className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                 >
                   Close
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Assignees Details Modal */}
       {showAssigneesModal && selectedAssignees.length > 0 && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Staff Members</h3>
                <button
                  onClick={() => setShowAssigneesModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Staff List ({selectedAssignees.length} people)</h5>
                  <div className="max-h-64 overflow-y-auto border rounded">
                    {selectedAssignees.map((email, index) => (
                      <div 
                        key={email} 
                        className="p-3 border-b last:border-b-0 bg-white"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900">
                                {email}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Staff Member #{index + 1}
                            </div>
                          </div>
                          <div className="ml-4">
                            <span className="text-blue-600 text-sm">👤</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowAssigneesModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
