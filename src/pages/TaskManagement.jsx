import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

export default function TaskManagement() {
  const [user] = useAuthState(auth);
  const { profile, getStoresForFiltering } = useUserProfile();
  const [tasks, setTasks] = useState([]);
  const [stores, setStores] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Task form state
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    deadline: '',
    assignmentType: 'team', // team, individual (how completion works)
    targetAudience: 'all_staff', // Changed from assignTo to targetAudience
    assignees: [],
    brand: '',
    location: '',
    recurring: false,
    recurringType: 'weekly', // hourly, weekly, monthly
    recurringInterval: 1,
    reminderEnabled: true,
    reminderTime: '24', // hours before deadline
    status: 'pending',
    estimatedHours: 1,
    tags: [],
    // New fields for multi-step tasks
    hasSteps: false,
    steps: [],
    validationMethod: 'checklist', // checklist, image, voice, text, none
    requireValidation: true
  });

  // Task templates (Petpooja inspired) - Updated with multi-step SOPs
  const taskTemplates = [
    {
      title: 'Daily Store Opening Checklist',
      description: 'Complete all opening procedures including cash register setup, inventory check, and store cleanliness',
      priority: 'high',
      assignmentType: 'team',
      targetAudience: 'all_staff', // Updated
      category: 'daily',
      estimatedHours: 1,
      hasSteps: true,
      steps: [
        { title: 'Unlock store and disable alarm', validation: 'checklist' },
        { title: 'Check cash register and count opening cash', validation: 'checklist' },
        { title: 'Verify inventory levels', validation: 'checklist' },
        { title: 'Clean store area and arrange displays', validation: 'image' },
        { title: 'Turn on all lights and equipment', validation: 'checklist' }
      ]
    },
    {
      title: 'Weekly Inventory Count',
      description: 'Complete detailed inventory count for all product categories',
      priority: 'medium',
      assignmentType: 'team',
      targetAudience: 'all_staff', // Updated
      category: 'weekly',
      estimatedHours: 3,
      hasSteps: true,
      steps: [
        { title: 'Print current inventory report', validation: 'checklist' },
        { title: 'Count products by category', validation: 'checklist' },
        { title: 'Record discrepancies', validation: 'text' },
        { title: 'Update inventory system', validation: 'checklist' },
        { title: 'Submit count report', validation: 'image' }
      ]
    },
    {
      title: 'Monthly Sales Review',
      description: 'Analyze monthly sales performance and prepare report',
      priority: 'medium',
      assignmentType: 'individual',
      targetAudience: 'all_managers', // Updated
      category: 'monthly',
      estimatedHours: 2,
      hasSteps: true,
      steps: [
        { title: 'Gather sales data from POS system', validation: 'checklist' },
        { title: 'Analyze sales trends and patterns', validation: 'text' },
        { title: 'Identify top performing products', validation: 'text' },
        { title: 'Prepare sales report', validation: 'image' },
        { title: 'Submit report to management', validation: 'checklist' }
      ]
    },
    {
      title: 'Customer Service Training',
      description: 'Complete customer service best practices training module',
      priority: 'low',
      assignmentType: 'individual',
      targetAudience: 'all_staff', // Updated
      category: 'training',
      estimatedHours: 1,
      hasSteps: true,
      steps: [
        { title: 'Watch training video', validation: 'checklist' },
        { title: 'Read customer service guidelines', validation: 'checklist' },
        { title: 'Complete quiz', validation: 'checklist' },
        { title: 'Practice role-play scenarios', validation: 'voice' },
        { title: 'Submit completion certificate', validation: 'image' }
      ]
    },
    {
      title: 'Store Maintenance Check',
      description: 'Inspect store equipment and report any maintenance issues',
      priority: 'medium',
      assignmentType: 'team',
      targetAudience: 'all_staff', // Updated
      category: 'maintenance',
      estimatedHours: 1,
      hasSteps: true,
      steps: [
        { title: 'Check HVAC system', validation: 'checklist' },
        { title: 'Inspect lighting fixtures', validation: 'checklist' },
        { title: 'Test security systems', validation: 'checklist' },
        { title: 'Check plumbing and restrooms', validation: 'image' },
        { title: 'Report any issues found', validation: 'text' }
      ]
    },
    {
      title: 'Product Display Update',
      description: 'Update product displays according to new merchandising guidelines',
      priority: 'medium',
      assignmentType: 'team',
      targetAudience: 'all_staff', // Updated
      category: 'merchandising',
      estimatedHours: 2,
      hasSteps: true,
      steps: [
        { title: 'Review new display guidelines', validation: 'checklist' },
        { title: 'Remove old displays', validation: 'checklist' },
        { title: 'Arrange new product displays', validation: 'image' },
        { title: 'Add price tags and signage', validation: 'checklist' },
        { title: 'Take final display photos', validation: 'image' }
      ]
    },
    {
      title: 'Cash Register Reconciliation',
      description: 'Reconcile daily cash register transactions and prepare deposit',
      priority: 'high',
      assignmentType: 'individual',
      targetAudience: 'all_managers', // Updated
      category: 'financial',
      estimatedHours: 1,
      hasSteps: true,
      steps: [
        { title: 'Print end-of-day register report', validation: 'checklist' },
        { title: 'Count cash and verify amounts', validation: 'checklist' },
        { title: 'Reconcile credit card transactions', validation: 'checklist' },
        { title: 'Prepare bank deposit', validation: 'checklist' },
        { title: 'Submit reconciliation report', validation: 'image' }
      ]
    },
    {
      title: 'Safety Protocol Review',
      description: 'Review and update store safety protocols and emergency procedures',
      priority: 'high',
      assignmentType: 'team',
      targetAudience: 'all_staff', // Updated
      category: 'safety',
      estimatedHours: 1,
      hasSteps: true,
      steps: [
        { title: 'Review current safety protocols', validation: 'checklist' },
        { title: 'Check emergency exits and equipment', validation: 'image' },
        { title: 'Update emergency contact list', validation: 'checklist' },
        { title: 'Conduct safety drill', validation: 'voice' },
        { title: 'Document any changes needed', validation: 'text' }
      ]
    },
    {
      title: 'Customer Feedback Collection',
      description: 'Collect and document customer feedback for service improvement',
      priority: 'low',
      assignmentType: 'team',
      targetAudience: 'all_staff', // Updated
      category: 'customer_service',
      estimatedHours: 1,
      hasSteps: true,
      steps: [
        { title: 'Approach customers for feedback', validation: 'checklist' },
        { title: 'Record customer comments', validation: 'text' },
        { title: 'Document any complaints', validation: 'text' },
        { title: 'Submit feedback summary', validation: 'text' },
        { title: 'Follow up on urgent issues', validation: 'checklist' }
      ]
    }
  ];

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      let storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter stores based on user's access using new consistent pattern
      const userStores = getStoresForFiltering();
      console.log('TaskManagement: User accessible stores:', userStores);
      
      if (userStores.length > 0) {
        // User has specific store access - filter to only those stores
        storesList = storesList.filter(store => userStores.includes(store.id));
        console.log('TaskManagement: Filtered stores for user:', storesList.length);
      }
      
      setStores(storesList);

      // Load staff for all accessible stores
      const allStaff = [];
      const accessibleStores = getStoresForFiltering();
      
      if (accessibleStores.length > 0) {
        // User has specific store access - load staff for those stores
        const staffSnap = await getDocs(collection(db, 'users'));
        const allUsers = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter staff for the stores the user can access
        const filteredStaff = allUsers.filter(user => 
          user.role === 'STAFF' && 
          user.assignedStore && 
          accessibleStores.includes(user.assignedStore)
        );
        
        allStaff.push(...filteredStaff);
      } else {
        // Admin/Owner can access all stores - load all staff
        const staffSnap = await getDocs(collection(db, 'users'));
        const allUsers = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter only staff users
        const filteredStaff = allUsers.filter(user => user.role === 'STAFF');
        allStaff.push(...filteredStaff);
      }
      
      setStaff(allStaff);

      // Load tasks
      await loadTasks();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTasks = async () => {
    try {
      let tasksList = [];
      
      if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN') {
        // For admin roles, load all tasks
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else if (profile?.role === 'MANAGER') {
        // For managers, load tasks they created or are assigned to
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(task => 
            task.createdBy === user.email || 
            (task.assignees && task.assignees.includes(user.email))
          );
      } else if (profile?.role === 'STAFF') {
        // For staff, load tasks assigned to them
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(task => 
            task.assignees && task.assignees.includes(user.email)
          );
      } else {
        // For other roles, load all tasks (fallback)
        const tasksSnap = await getDocs(collection(db, 'tasks'));
        tasksList = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      // Sort by creation date (newest first)
      tasksList.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      setTasks(tasksList);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      // Ensure tags is always an array
      const sanitizedTaskForm = {
        ...taskForm,
        tags: Array.isArray(taskForm.tags) ? taskForm.tags : [],
        steps: Array.isArray(taskForm.steps) ? taskForm.steps : [],
        assignees: Array.isArray(taskForm.assignees) ? taskForm.assignees : []
      };

      const taskData = {
        ...sanitizedTaskForm,
        createdBy: user.email,
        createdByRole: profile.role,
        createdAt: serverTimestamp(),
        status: 'pending',
        completedBy: [],
        storeCompletions: {}, // Initialize store-specific completion tracking
        assignedStores: getAssignedStores(),
        assignees: getAssignees(),
        // Maintain backward compatibility with assignTo field
        assignTo: sanitizedTaskForm.targetAudience
      };

      await addDoc(collection(db, 'tasks'), taskData);
      setShowCreateModal(false);
      setTaskForm({
        title: '',
        description: '',
        priority: 'medium',
        deadline: '',
        assignmentType: 'team',
        targetAudience: 'all_staff',
        assignees: [],
        brand: '',
        location: '',
        recurring: false,
        recurringType: 'weekly',
        recurringInterval: 1,
        reminderEnabled: true,
        reminderTime: '24',
        status: 'pending',
        category: 'general',
        estimatedHours: 1,
        tags: [],
        hasSteps: false,
        steps: [],
        validationMethod: 'checklist',
        requireValidation: true
      });
      await loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const getAssignedStores = () => {
    switch (taskForm.targetAudience) {
      case 'all_staff':
      case 'all_managers':
        return stores.map(s => s.id);
      case 'brand':
        return stores.filter(s => s.brand === taskForm.brand).map(s => s.id);
      case 'location':
        return stores.filter(s => s.city === taskForm.location).map(s => s.id);
      case 'individual':
        return [...new Set(taskForm.assignees.map(email => 
          staff.find(s => s.email === email)?.assignedStore
        ).filter(Boolean))];
      default:
        return [];
    }
  };

  const getAssignees = () => {
    switch (taskForm.targetAudience) {
      case 'all_staff':
        return staff.map(s => s.email);
      case 'all_managers':
        return staff.filter(s => s.role === 'MANAGER').map(s => s.email);
      case 'brand':
        return staff.filter(s => stores.find(store => store.id === s.assignedStore)?.brand === taskForm.brand).map(s => s.email);
      case 'location':
        return staff.filter(s => stores.find(store => store.id === s.assignedStore)?.city === taskForm.location).map(s => s.email);
      case 'individual':
        return taskForm.assignees;
      default:
        return [];
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const userStore = profile.assignedStore;
      
      // For store-specific tracking, update the store completion instead of global status
      if (userStore && task.storeCompletions) {
        const storeCompletions = task.storeCompletions || {};
        const currentStoreCompletion = storeCompletions[userStore] || {
          completedBy: [],
          completedAt: null
        };
        
        // Update store-specific completion based on status
        const updatedStoreCompletion = {
          ...currentStoreCompletion,
          status: status,
          updatedAt: serverTimestamp(),
          updatedBy: user.email
        };
        
        await updateDoc(doc(db, 'tasks', taskId), {
          storeCompletions: {
            ...storeCompletions,
            [userStore]: updatedStoreCompletion
          },
          updatedAt: serverTimestamp(),
          updatedBy: user.email
        });
      } else {
        // Fallback to global status update
        await updateDoc(doc(db, 'tasks', taskId), {
          status,
          updatedAt: serverTimestamp(),
          updatedBy: user.email
        });
      }
      
      await loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const markTaskComplete = async (taskId) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const userStore = profile.assignedStore;
      
      // Handle store-specific completion tracking
      const storeCompletions = task.storeCompletions || {};
      const currentStoreCompletion = storeCompletions[userStore] || {
        completedBy: [],
        completedAt: null
      };
      
      // Add current user to store completion if not already there
      if (!currentStoreCompletion.completedBy.includes(user.email)) {
        currentStoreCompletion.completedBy.push(user.email);
      }
      
      // Update store-specific completion
      const updatedStoreCompletions = {
        ...storeCompletions,
        [userStore]: {
          ...currentStoreCompletion,
          completedAt: serverTimestamp()
        }
      };
      
      // Keep backward compatibility with global completion tracking
      const completedBy = task.completedBy || [];
      if (!completedBy.includes(user.email)) {
        completedBy.push(user.email);
      }

      let newStatus = task.status;
      
      // Check if task is complete based on assignment type and store
      if (task.assignmentType === 'team') {
        // Team task: complete if anyone from the store completes it
        newStatus = 'completed';
      } else if (task.assignmentType === 'individual') {
        // Individual task: check completion for this specific store
        // Filter assignees for this specific store
        const storeAssignees = task.assignees?.filter(assigneeEmail => {
          // Find the staff member and check if they belong to this store
          const staffMember = staff.find(s => s.email === assigneeEmail);
          return staffMember && staffMember.assignedStore === userStore;
        }) || [];
        
        const storeCompleted = currentStoreCompletion.completedBy.length >= storeAssignees.length;
        newStatus = storeCompleted ? 'completed' : 'in_progress';
      } else {
        // Regular task: complete if anyone from the store completes it
        newStatus = 'completed';
      }

      await updateDoc(doc(db, 'tasks', taskId), {
        storeCompletions: updatedStoreCompletions,
        completedBy, // Keep backward compatibility
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user.email
      });
      await loadTasks();
    } catch (error) {
      console.error('Error marking task complete:', error);
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

  const getEffectiveTaskStatus = (task, userStore) => {
    // If no store-specific completion tracking, use global status
    if (!task.storeCompletions || !userStore) {
      return task.status;
    }
    
    const storeCompletion = task.storeCompletions[userStore];
    if (!storeCompletion) {
      return 'pending'; // Not started for this store
    }
    
    // Check if task is complete for this store
    if (task.assignmentType === 'individual') {
      // Filter assignees for this specific store
      const storeAssignees = task.assignees?.filter(assigneeEmail => {
        // Find the staff member and check if they belong to this store
        const staffMember = staff.find(s => s.email === assigneeEmail);
        return staffMember && staffMember.assignedStore === userStore;
      }) || [];
      
      const storeCompleted = storeCompletion.completedBy?.length || 0;
      return storeCompleted >= storeAssignees.length ? 'completed' : 'in_progress';
    } else {
      // Team or regular task: complete if anyone from this store completed it
      return storeCompletion.completedBy?.length > 0 ? 'completed' : 'in_progress';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('en-IN');
  };

  const isOverdue = (deadline) => {
    if (!deadline) return false;
    const deadlineDate = new Date(deadline);
    return deadlineDate < new Date() && deadlineDate.getTime() !== 0;
  };

  const useTemplate = (template) => {
    setTaskForm({
      ...taskForm,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority,
      estimatedHours: template.estimatedHours,
      tags: Array.isArray(template.tags) ? template.tags : [],
      assignmentType: template.assignmentType,
      targetAudience: template.targetAudience,
      hasSteps: template.hasSteps || false,
      steps: template.steps || [],
      validationMethod: template.validationMethod || 'checklist',
      requireValidation: true
    });
    setShowCreateModal(true);
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">
          {profile?.role === 'MANAGER' ? 'My Team Task Management' : 'Task Management'}
        </h1>
        {(profile?.role === 'ADMIN' || profile?.role === 'MANAGER') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Task
          </button>
        )}
      </div>

      {/* Task Statistics */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-blue-600">
            {tasks.filter(t => getEffectiveTaskStatus(t, profile?.assignedStore) === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending Tasks</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-yellow-600">
            {tasks.filter(t => getEffectiveTaskStatus(t, profile?.assignedStore) === 'in_progress').length}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-green-600">
            {tasks.filter(t => getEffectiveTaskStatus(t, profile?.assignedStore) === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-red-600">{tasks.filter(t => isOverdue(t.deadline)).length}</div>
          <div className="text-sm text-gray-600">Overdue</div>
        </div>
      </div>

      {/* Task Templates Section */}
      {profile?.role === 'ADMIN' && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Quick Task Templates</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {taskTemplates.map((template) => (
              <div key={template.title} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{template.title}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(template.priority)}`}>
                    {template.priority.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">{template.estimatedHours}h estimated</span>
                  <div className="flex items-center space-x-2">
                    {template.hasSteps && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        📋 Multi-step
                      </span>
                    )}
                    <button
                      onClick={() => useTemplate(template)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Use Template
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deadline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{task.title}</div>
                      <div className="text-sm text-gray-500">{task.description}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        Type: {task.assignmentType === 'team' ? 'Team Task' : 'Individual Task'} | 
                        Assigned: {task.targetAudience === 'all_staff' ? 'All Staff' : 
                                  task.targetAudience === 'all_managers' ? 'All Managers' : 
                                  task.targetAudience === 'location' ? `Location: ${task.location}` :
                                  task.targetAudience === 'brand' ? `Brand: ${task.brand}` : 'Selected Staff'}
                      </div>
                      {task.hasSteps && (
                        <div className="text-xs text-blue-600 mt-1">
                          📋 Multi-step Task ({task.steps?.length || 0} steps) | 
                          Validation: {task.validationMethod?.toUpperCase() || 'NONE'}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatDate(task.deadline)}
                    {isOverdue(task.deadline) && (
                      <div className="text-xs text-red-600">OVERDUE</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(getEffectiveTaskStatus(task, profile?.assignedStore))}`}>
                      {getEffectiveTaskStatus(task, profile?.assignedStore).replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {task.assignees?.length || 0} people
                    {task.assignmentType === 'individual' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {/* Show store-specific completion if available */}
                        {task.storeCompletions && profile?.assignedStore ? (
                          (() => {
                            const storeCompletion = task.storeCompletions[profile.assignedStore];
                            const storeCompletedCount = storeCompletion?.completedBy?.length || 0;
                            // Filter assignees for this specific store
                            const storeAssignees = task.assignees?.filter(assigneeEmail => {
                              const staffMember = staff.find(s => s.email === assigneeEmail);
                              return staffMember && staffMember.assignedStore === profile.assignedStore;
                            }) || [];
                            const storeAssigneesCount = storeAssignees.length;
                            return (
                              <>
                                {storeCompletedCount}/{storeAssigneesCount} completed (this store)
                                <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                  <div 
                                    className="bg-green-600 h-1 rounded-full" 
                                    style={{ width: `${storeAssigneesCount ? (storeCompletedCount / storeAssigneesCount) * 100 : 0}%` }}
                                  ></div>
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          // Fallback to global completion tracking
                          <>
                            {task.completedBy?.length || 0}/{task.assignees?.length || 0} completed
                            <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                              <div 
                                className="bg-green-600 h-1 rounded-full" 
                                style={{ width: `${task.assignees?.length ? ((task.completedBy?.length || 0) / task.assignees.length) * 100 : 0}%` }}
                              ></div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowDetailsModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View
                      </button>
                      {task.hasSteps && (
                        <button
                          onClick={() => window.location.href = `/task-execution/${task.id}`}
                          className="text-green-600 hover:text-green-900"
                        >
                          Execute
                        </button>
                      )}
                      {getEffectiveTaskStatus(task, profile?.assignedStore) === 'pending' && (
                        <button
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Start
                        </button>
                      )}
                      {getEffectiveTaskStatus(task, profile?.assignedStore) === 'in_progress' && !task.hasSteps && (
                        <button
                          onClick={() => markTaskComplete(task.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Task</h3>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Task Title</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({...taskForm, title: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({...taskForm, description: e.target.value})}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    rows="3"
                    required
                  />
                </div>

                                 <div className="grid md:grid-cols-3 gap-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Category</label>
                     <select
                       value={taskForm.category}
                       onChange={(e) => setTaskForm({...taskForm, category: e.target.value})}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                     >
                       <option value="general">General</option>
                       <option value="sales">Sales</option>
                       <option value="inventory">Inventory</option>
                       <option value="maintenance">Maintenance</option>
                       <option value="training">Training</option>
                       <option value="customer_service">Customer Service</option>
                       <option value="operations">Operations</option>
                     </select>
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700">Priority</label>
                     <select
                       value={taskForm.priority}
                       onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                     >
                       <option value="low">Low</option>
                       <option value="medium">Medium</option>
                       <option value="high">High</option>
                     </select>
                   </div>

                   <div>
                     <label className="block text-sm font-medium text-gray-700">Estimated Hours</label>
                     <input
                       type="number"
                       value={taskForm.estimatedHours}
                       onChange={(e) => setTaskForm({...taskForm, estimatedHours: parseInt(e.target.value)})}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       min="0.5"
                       step="0.5"
                     />
                   </div>
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700">Deadline</label>
                   <input
                     type="datetime-local"
                     value={taskForm.deadline}
                     onChange={(e) => setTaskForm({...taskForm, deadline: e.target.value})}
                     className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                     required
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-gray-700">Assignment Type</label>
                   <select
                     value={taskForm.assignmentType}
                     onChange={(e) => setTaskForm({...taskForm, assignmentType: e.target.value})}
                     className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   >
                     <option value="team">Team Task (Anyone can complete)</option>
                     <option value="individual">Individual Task (Everyone must complete)</option>
                   </select>
                 </div>

                 {taskForm.assignmentType === 'team' && (
                   <div className="bg-blue-50 p-3 rounded border border-blue-200">
                     <p className="text-sm text-blue-800">
                       <strong>Team Task:</strong> This task can be completed by any team member. 
                       Once one person completes it, the task is marked as done for the entire team.
                     </p>
                   </div>
                 )}

                 {taskForm.assignmentType === 'individual' && (
                   <div className="bg-orange-50 p-3 rounded border border-orange-200">
                     <p className="text-sm text-orange-800">
                       <strong>Individual Task:</strong> Each team member must complete this task individually. 
                       The task will show progress as each person completes their part.
                     </p>
                   </div>
                 )}

                 <div>
                   <label className="block text-sm font-medium text-gray-700">Assign To</label>
                   <select
                     value={taskForm.targetAudience}
                     onChange={(e) => setTaskForm({...taskForm, targetAudience: e.target.value})}
                     className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                   >
                     <option value="all_staff">All Staff</option>
                     <option value="all_managers">All Managers</option>
                     <option value="location">By Location</option>
                     <option value="brand">By Brand</option>
                     <option value="individual">Individual Selection</option>
                   </select>
                 </div>

                 {taskForm.targetAudience === 'brand' && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Brand</label>
                     <select
                       value={taskForm.brand}
                       onChange={(e) => setTaskForm({...taskForm, brand: e.target.value})}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       required
                     >
                       <option value="">Select Brand</option>
                       {[...new Set(stores.map(s => s.brand))].map(brand => (
                         <option key={brand} value={brand}>{brand}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {taskForm.targetAudience === 'location' && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Location</label>
                     <select
                       value={taskForm.location}
                       onChange={(e) => setTaskForm({...taskForm, location: e.target.value})}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       required
                     >
                       <option value="">Select Location</option>
                       {[...new Set(stores.map(s => s.city))].map(city => (
                         <option key={city} value={city}>{city}</option>
                       ))}
                     </select>
                   </div>
                 )}

                 {taskForm.targetAudience === 'individual' && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Select Staff Members</label>
                     <select
                       multiple
                       value={taskForm.assignees}
                       onChange={(e) => setTaskForm({
                         ...taskForm, 
                         assignees: Array.from(e.target.selectedOptions, option => option.value)
                       })}
                       className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                       size="5"
                     >
                       {staff.map(s => (
                         <option key={s.email} value={s.email}>
                           {s.name} ({s.storeName}) - {s.role}
                         </option>
                       ))}
                     </select>
                   </div>
                 )}

                  {/* Multi-step Task Configuration */}
                  <div className="border-t pt-4">
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        checked={taskForm.hasSteps}
                        onChange={(e) => setTaskForm({...taskForm, hasSteps: e.target.checked})}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm font-medium text-gray-900">Multi-step Task (SOP)</label>
                    </div>

                    {taskForm.hasSteps && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Default Validation Method</label>
                          <select
                            value={taskForm.validationMethod}
                            onChange={(e) => setTaskForm({...taskForm, validationMethod: e.target.value})}
                            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                          >
                            <option value="checklist">Checklist (Simple checkboxes)</option>
                            <option value="image">Image (Photo proof required)</option>
                            <option value="voice">Voice Note (Audio recording)</option>
                            <option value="text">Text (Written response)</option>
                            <option value="none">No Validation</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Task Steps</label>
                          <div className="space-y-2">
                            {taskForm.steps.map((step, index) => (
                              <div key={index} className="border rounded p-3 bg-gray-50">
                                <div className="grid md:grid-cols-4 gap-2">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Step {index + 1}</label>
                                    <input
                                      type="text"
                                      value={step.title}
                                      onChange={(e) => {
                                        const newSteps = [...taskForm.steps];
                                        newSteps[index].title = e.target.value;
                                        setTaskForm({...taskForm, steps: newSteps});
                                      }}
                                      className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                                      placeholder="Step title"
                                    />
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700">Description</label>
                                    <input
                                      type="text"
                                      value={step.description}
                                      onChange={(e) => {
                                        const newSteps = [...taskForm.steps];
                                        newSteps[index].description = e.target.value;
                                        setTaskForm({...taskForm, steps: newSteps});
                                      }}
                                      className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                                      placeholder="Step description"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700">Validation</label>
                                    <select
                                      value={step.validationMethod}
                                      onChange={(e) => {
                                        const newSteps = [...taskForm.steps];
                                        newSteps[index].validationMethod = e.target.value;
                                        setTaskForm({...taskForm, steps: newSteps});
                                      }}
                                      className="mt-1 block w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                                    >
                                      <option value="checklist">Checklist</option>
                                      <option value="image">Image</option>
                                      <option value="voice">Voice</option>
                                      <option value="text">Text</option>
                                      <option value="none">None</option>
                                    </select>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newSteps = taskForm.steps.filter((_, i) => i !== index);
                                    setTaskForm({...taskForm, steps: newSteps});
                                  }}
                                  className="mt-2 text-red-600 hover:text-red-800 text-xs"
                                >
                                  Remove Step
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                const newStep = {
                                  order: taskForm.steps.length + 1,
                                  title: '',
                                  description: '',
                                  validationMethod: taskForm.validationMethod
                                };
                                setTaskForm({...taskForm, steps: [...taskForm.steps, newStep]});
                              }}
                              className="w-full border-2 border-dashed border-gray-300 rounded-md p-3 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
                            >
                              + Add Step
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={taskForm.recurring}
                    onChange={(e) => setTaskForm({...taskForm, recurring: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Recurring Task</label>
                </div>

                {taskForm.recurring && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Recurring Type</label>
                      <select
                        value={taskForm.recurringType}
                        onChange={(e) => setTaskForm({...taskForm, recurringType: e.target.value})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      >
                        <option value="hourly">Hourly</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Interval</label>
                      <input
                        type="number"
                        value={taskForm.recurringInterval}
                        onChange={(e) => setTaskForm({...taskForm, recurringInterval: parseInt(e.target.value)})}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                        min="1"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={taskForm.reminderEnabled}
                    onChange={(e) => setTaskForm({...taskForm, reminderEnabled: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">Enable Reminders</label>
                </div>

                {taskForm.reminderEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reminder Time</label>
                    <select
                      value={taskForm.reminderTime}
                      onChange={(e) => setTaskForm({...taskForm, reminderTime: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="1">1 hour before</option>
                      <option value="6">6 hours before</option>
                      <option value="24">1 day before</option>
                      <option value="48">2 days before</option>
                      <option value="168">1 week before</option>
                    </select>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Task Details Modal */}
      {showDetailsModal && selectedTask && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Task Details</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedTask.title}</h4>
                  <p className="text-gray-600 mt-1">{selectedTask.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm font-medium text-gray-500">Priority:</span>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedTask.priority)}`}>
                      {selectedTask.priority.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedTask.status)}`}>
                      {selectedTask.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Deadline:</span>
                    <span className="ml-2 text-sm text-gray-900">{formatDate(selectedTask.deadline)}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-500">Created:</span>
                    <span className="ml-2 text-sm text-gray-900">{formatDate(selectedTask.createdAt)}</span>
                  </div>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-500">Assigned To:</span>
                  <div className="mt-1">
                    {selectedTask.assignees?.map(email => (
                      <div key={email} className="text-sm text-gray-900">
                        {email} {selectedTask.completedBy?.includes(email) && '(Completed)'}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTask.recurring && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Recurring:</span>
                    <span className="ml-2 text-sm text-gray-900">
                      Every {selectedTask.recurringInterval} {selectedTask.recurringType}
                    </span>
                  </div>
                )}

                {selectedTask.hasSteps && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Task Steps:</span>
                    <div className="mt-2 space-y-2">
                      {selectedTask.steps?.map((step, index) => (
                        <div key={index} className="border rounded p-3 bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mr-2">
                                  Step {index + 1}
                                </span>
                                <span className="text-sm font-medium text-gray-900">{step.title}</span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                              <div className="flex items-center mt-2 space-x-2">
                                <span className="text-xs text-gray-500">Validation:</span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  step.validationMethod === 'image' ? 'bg-green-100 text-green-800' :
                                  step.validationMethod === 'voice' ? 'bg-purple-100 text-purple-800' :
                                  step.validationMethod === 'text' ? 'bg-blue-100 text-blue-800' :
                                  step.validationMethod === 'checklist' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {step.validationMethod?.toUpperCase() || 'NONE'}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <button className="text-blue-600 hover:text-blue-800 text-sm">
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowDetailsModal(false)}
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
