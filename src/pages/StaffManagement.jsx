import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { createUser, getStaffForStore, deleteUser, checkUserConsistency, fixOrphanedUser, deactivateUser, activateUser, archiveUser, restoreUser, getUsersByStatus, markAllStaffAsActive } from '../utils/userManagement';

export default function StaffManagement() {
  const { profile } = useUserProfile();
  const [staff, setStaff] = useState([]);
  const [inactiveStaff, setInactiveStaff] = useState([]);
  const [archivedStaff, setArchivedStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newStaffCredentials, setNewStaffCredentials] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'inactive', 'archived'
  const [orphanedUserEmail, setOrphanedUserEmail] = useState('');
  const [showOrphanedUserModal, setShowOrphanedUserModal] = useState(false);
  const [orphanedUserData, setOrphanedUserData] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'SALESMAN',
    salary: '',
    leaveDays: '',
    lunchAllowance: '',
    extraSundayAllowance: '',
    previousAdvance: ''
  });

  useEffect(() => {
    if (profile?.assignedStore) {
      loadStaff();
    }
  }, [profile?.assignedStore]);

  const loadStaff = async () => {
    if (!profile?.assignedStore) return;
    
    try {
      setLoading(true);
      
      // Load all staff for this store, then categorize them
      const allUsersSnap = await getDocs(collection(db, 'users'));
      const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter staff for this store
      const allStaff = allUsers.filter(user => 
        user.role === 'STAFF' && user.assignedStore === profile.assignedStore
      );
      
      // Categorize staff by status
      const activeStaffList = allStaff.filter(staff => 
        (staff.status === 'ACTIVE' || staff.isActive === true) && 
        staff.status !== 'INACTIVE' && 
        staff.isActive !== false
      );
      
      const inactiveStaffList = allStaff.filter(staff => 
        staff.status === 'INACTIVE' || staff.isActive === false
      );
      
      // Load archived staff from separate collection
      const archivedUsers = await getUsersByStatus('ARCHIVED');
      const archivedStaffList = archivedUsers.filter(user => 
        user.role === 'STAFF' && user.assignedStore === profile.assignedStore
      );
      
      setStaff(activeStaffList);
      setInactiveStaff(inactiveStaffList);
      setArchivedStaff(archivedStaffList);
      
      console.log('Staff counts:', {
        active: activeStaffList.length,
        inactive: inactiveStaffList.length,
        archived: archivedStaffList.length,
        total: allStaff.length
      });
    } catch (error) {
      console.error('Error loading staff:', error);
      alert('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!createForm.name || !createForm.email || !createForm.password) {
      alert('Please fill all required fields');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createForm.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Password validation (Firebase requires at least 6 characters)
    if (createForm.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    // Name validation
    if (createForm.name.trim().length < 2) {
      alert('Name must be at least 2 characters long');
      return;
    }

    // Profile validation
    if (!profile) {
      alert('User profile not loaded. Please refresh the page and try again.');
      return;
    }

    if (profile.role !== 'MANAGER') {
      alert('Only managers can create staff members.');
      return;
    }

    console.log('Profile validation passed:', {
      email: profile.email,
      role: profile.role,
      assignedStore: profile.assignedStore,
      storeName: profile.storeName
    });

    try {
      setLoading(true);
      
      const existingStaff = staff.find(s => s.email === createForm.email.toLowerCase());
      if (existingStaff) {
        alert('Staff with this email already exists!');
        return;
      }

                    // Simple check - if manager has assigned store, use it; otherwise, proceed without store assignment
              if (!profile.assignedStore) {
                console.log('Manager has no assigned store, proceeding without store assignment');
              } else {
                console.log('Manager assigned store:', profile.assignedStore);
              }

      const userData = {
        email: createForm.email.toLowerCase().trim(),
        password: createForm.password,
        name: createForm.name.trim(),
        role: 'STAFF',
        phone: createForm.phone?.trim() || '',
        assignedStore: profile.assignedStore || '',
        staffRole: createForm.role,
        salary: Number(createForm.salary) || 0
      };

      console.log('Creating user with data:', { ...userData, password: '[HIDDEN]' });
      const result = await createUser(userData);

      setNewStaffCredentials({
        email: createForm.email.toLowerCase(),
        password: createForm.password,
        name: createForm.name,
        storeName: profile.storeName || 'Not assigned',
        storeBrand: profile.storeBrand || 'Not assigned'
      });

      setShowCreateModal(false);
      setShowPasswordModal(true);
      
      // Reset form
      setCreateForm({
        name: '', email: '', phone: '', password: '', role: 'SALESMAN', salary: '',
        leaveDays: '', lunchAllowance: '', extraSundayAllowance: '', previousAdvance: ''
      });

      await loadStaff();
    } catch (error) {
      console.error('Error creating staff:', error);
      
      // Enhanced error handling with specific messages
      if (error.message.includes('already exists')) {
        // Check if this is an orphaned user issue
        const email = createForm.email.toLowerCase().trim();
        try {
          const consistencyCheck = await checkUserConsistency(email);
          if (!consistencyCheck.inFirestore) {
            // This is an orphaned user - show fix option
            setOrphanedUserEmail(email);
            setOrphanedUserData({
              name: createForm.name.trim(),
              role: 'STAFF',
              phone: createForm.phone?.trim() || '',
              assignedStore: profile.assignedStore || '',
              staffRole: createForm.role,
              salary: Number(createForm.salary) || 0
            });
            setShowOrphanedUserModal(true);
            return;
          }
        } catch (checkError) {
          console.error('Error checking user consistency:', checkError);
        }
        alert('A user with this email already exists!');
      } else if (error.message.includes('Invalid email')) {
        alert('Please enter a valid email address');
      } else if (error.message.includes('Password must be at least 6 characters')) {
        alert('Password must be at least 6 characters long');
      } else if (error.message.includes('Password is too weak')) {
        alert('Password is too weak. Please use a stronger password');
      } else if (error.message.includes('Network error')) {
        alert('Network error. Please check your internet connection and try again');
      } else if (error.message.includes('operation-not-allowed')) {
        alert('Email/password accounts are not enabled. Please contact administrator');
      } else {
        alert('Failed to create staff: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateStaff = async (staffEmail) => {
    if (!confirm('Are you sure you want to deactivate this staff member? They will not be able to login until reactivated.')) return;

    try {
      await deactivateUser(staffEmail, 'Manager deactivation');
      await loadStaff();
      alert('Staff deactivated successfully!');
    } catch (error) {
      console.error('Error deactivating staff:', error);
      alert('Failed to deactivate staff');
    }
  };

  const handleActivateStaff = async (staffEmail) => {
    if (!confirm('Are you sure you want to activate this staff member? They will be able to login again.')) return;

    try {
      await activateUser(staffEmail);
      await loadStaff();
      alert('Staff activated successfully!');
    } catch (error) {
      console.error('Error activating staff:', error);
      alert('Failed to activate staff');
    }
  };

  const handleArchiveStaff = async (staffEmail) => {
    if (!confirm('Are you sure you want to archive this staff member? This will move them to the archive section.')) return;

    try {
      await archiveUser(staffEmail);
      await loadStaff();
      alert('Staff archived successfully!');
    } catch (error) {
      console.error('Error archiving staff:', error);
      alert('Failed to archive staff');
    }
  };

  const handleRestoreStaff = async (staffEmail) => {
    if (!confirm('Are you sure you want to restore this staff member? They will be activated and able to login again.')) return;

    try {
      await restoreUser(staffEmail);
      await loadStaff();
      alert('Staff restored successfully!');
    } catch (error) {
      console.error('Error restoring staff:', error);
      alert('Failed to restore staff');
    }
  };

  const handleMarkAllStaffAsActive = async () => {
    if (!confirm('Are you sure you want to mark ALL staff as active? This will activate all inactive and archived staff.')) return;

    try {
      setLoading(true);
      const result = await markAllStaffAsActive(profile.assignedStore);
      await loadStaff();
      alert(result.message);
    } catch (error) {
      console.error('Error marking all staff as active:', error);
      alert('Failed to mark all staff as active: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const handleFixOrphanedUser = async () => {
    try {
      setLoading(true);
      
      const result = await fixOrphanedUser(orphanedUserEmail, orphanedUserData);
      
      if (result.success) {
        alert('User profile created successfully! The user can now login.');
        setShowOrphanedUserModal(false);
        setOrphanedUserEmail('');
        setOrphanedUserData(null);
        
        // Reset form
        setCreateForm({
          name: '', email: '', phone: '', password: '', role: 'SALESMAN', salary: '',
          leaveDays: '', lunchAllowance: '', extraSundayAllowance: '', previousAdvance: ''
        });
        
        // Reload staff list
        await loadStaff();
      }
    } catch (error) {
      console.error('Error fixing orphaned user:', error);
      alert('Failed to fix user: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return <div className="p-6">Loading...</div>;
  }

  if (profile.role !== 'MANAGER') {
    return (
      <div className="p-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h3>
          <p className="text-gray-600">Only managers can access staff management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Staff Management</h1>
          <p className="text-gray-600">Manage staff for your store: {profile.storeName}</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add New Staff
          </button>
          
          <button
            onClick={handleMarkAllStaffAsActive}
            disabled={loading}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Activating...' : 'Activate All Staff'}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{staff.length}</div>
              <div className="text-sm text-gray-600">Active Staff</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{inactiveStaff.length}</div>
              <div className="text-sm text-gray-600">Inactive Staff</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">{archivedStaff.length}</div>
              <div className="text-sm text-gray-600">Archived Staff</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <div className="text-2xl font-bold text-gray-900">
                ₹{staff.reduce((sum, member) => sum + (member.salary || 0), 0).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Salary</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Staff ({staff.length})
            </button>
            <button
              onClick={() => setActiveTab('inactive')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inactive'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Inactive Staff ({inactiveStaff.length})
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'archived'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Archived Staff ({archivedStaff.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Staff List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">
            {activeTab === 'active' && 'Active Staff Members'}
            {activeTab === 'inactive' && 'Inactive Staff Members'}
            {activeTab === 'archived' && 'Archived Staff Members'}
          </h2>
        </div>
        
        {loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading staff...</p>
          </div>
        ) : (() => {
          const currentStaff = activeTab === 'active' ? staff : 
                              activeTab === 'inactive' ? inactiveStaff : 
                              archivedStaff;
          
          return currentStaff.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p>
                {activeTab === 'active' && 'No active staff members found.'}
                {activeTab === 'inactive' && 'No inactive staff members found.'}
                {activeTab === 'archived' && 'No archived staff members found.'}
              </p>
              <p className="text-sm mt-1">
                {activeTab === 'active' && 'Click "Add New Staff" to get started.'}
                {activeTab === 'inactive' && 'No staff have been deactivated.'}
                {activeTab === 'archived' && 'No staff have been archived.'}
              </p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentStaff.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {member.staffRole || 'STAFF'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{member.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{member.salary || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        activeTab === 'active' ? 'bg-green-100 text-green-800' :
                        activeTab === 'inactive' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {activeTab === 'active' ? 'Active' : 
                         activeTab === 'inactive' ? 'Inactive' : 'Archived'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {activeTab === 'active' && (
                          <>
                            <button
                              onClick={() => handleDeactivateStaff(member.email)}
                              className="text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 text-sm px-3 py-1 rounded-md transition-colors"
                            >
                              Deactivate
                            </button>
                            <button
                              onClick={() => handleArchiveStaff(member.email)}
                              className="text-red-600 hover:text-red-900 hover:bg-red-50 text-sm px-3 py-1 rounded-md transition-colors"
                            >
                              Archive
                            </button>
                          </>
                        )}
                        {activeTab === 'inactive' && (
                          <>
                            <button
                              onClick={() => handleActivateStaff(member.email)}
                              className="text-green-600 hover:text-green-900 hover:bg-green-50 text-sm px-3 py-1 rounded-md transition-colors"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => handleArchiveStaff(member.email)}
                              className="text-red-600 hover:text-red-900 hover:bg-red-50 text-sm px-3 py-1 rounded-md transition-colors"
                            >
                              Archive
                            </button>
                          </>
                        )}
                        {activeTab === 'archived' && (
                          <button
                            onClick={() => handleRestoreStaff(member.email)}
                            className="text-green-600 hover:text-green-900 hover:bg-green-50 text-sm px-3 py-1 rounded-md transition-colors"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        })()}
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add New Staff</h2>
            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  className={`w-full p-2 border rounded ${
                    createForm.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email) ? 'border-red-300' : 
                    createForm.email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email) ? 'border-green-300' : ''
                  }`}
                  required
                  placeholder="Enter valid email address"
                />
                {createForm.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email) && (
                  <p className="text-xs text-red-500 mt-1">Please enter a valid email address</p>
                )}
                {createForm.email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email) && (
                  <p className="text-xs text-green-500 mt-1">✓ Valid email format</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  className={`w-full p-2 border rounded ${
                    createForm.password.length > 0 && createForm.password.length < 6 ? 'border-red-300' : 
                    createForm.password.length >= 6 ? 'border-green-300' : ''
                  }`}
                  required
                  placeholder="Enter password (minimum 6 characters)"
                  minLength={6}
                />
                <div className="text-xs mt-1">
                  {createForm.password.length > 0 && createForm.password.length < 6 && (
                    <p className="text-red-500">Password must be at least 6 characters long</p>
                  )}
                  {createForm.password.length >= 6 && (
                    <p className="text-green-500">✓ Password meets requirements</p>
                  )}
                  <p className="text-gray-500">This password will be shown to the staff member</p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="SALESMAN">Salesman</option>
                  <option value="CASHIER">Cashier</option>
                  <option value="HELPER">Helper</option>
                  <option value="SECURITY">Security</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary (₹)</label>
                <input
                  type="number"
                  value={createForm.salary}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, salary: e.target.value }))}
                  className="w-full p-2 border rounded"
                  placeholder="0"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Creating...' : 'Create Staff'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Display Modal */}
      {showPasswordModal && newStaffCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-green-600">✅ Staff Created Successfully!</h2>
            
            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-green-800 mb-2">Staff Credentials</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {newStaffCredentials.name}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {newStaffCredentials.email}
                </div>
                <div>
                  <span className="font-medium">Password:</span> {newStaffCredentials.password}
                </div>
                <div>
                  <span className="font-medium">Store:</span> {newStaffCredentials.storeName}
                </div>
                <div className="pt-2 border-t border-green-200">
                  <span className="font-medium text-green-700">Created by:</span> {profile?.email} at {new Date().toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-yellow-800 mb-2">Important Instructions</h3>
              <ol className="text-sm text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Share these credentials with the staff member</li>
                <li>Ask them to change their password after first login</li>
                <li>They can access the system immediately</li>
                <li>Store these credentials securely</li>
              </ol>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  copyToClipboard(`Email: ${newStaffCredentials.email}\nPassword: ${newStaffCredentials.password}`);
                }}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
              >
                Copy Credentials
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewStaffCredentials(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orphaned User Fix Modal */}
      {showOrphanedUserModal && orphanedUserData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 text-orange-600">⚠️ Orphaned User Detected</h2>
            
            <div className="bg-orange-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-orange-800 mb-2">Issue Found</h3>
              <p className="text-sm text-orange-700 mb-2">
                User <strong>{orphanedUserEmail}</strong> exists in Firebase Authentication but doesn't have a profile in the database.
              </p>
              <p className="text-sm text-orange-700">
                This can happen if user creation was interrupted or failed partway through.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-blue-800 mb-2">User Details</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <div><strong>Name:</strong> {orphanedUserData.name}</div>
                <div><strong>Email:</strong> {orphanedUserEmail}</div>
                <div><strong>Role:</strong> {orphanedUserData.staffRole}</div>
                <div><strong>Phone:</strong> {orphanedUserData.phone || 'Not provided'}</div>
                <div><strong>Salary:</strong> ₹{orphanedUserData.salary}</div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold text-green-800 mb-2">Solution</h3>
              <p className="text-sm text-green-700">
                Click "Fix User Profile" to create the missing database profile. The user will then be able to login normally.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleFixOrphanedUser}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:bg-gray-400"
              >
                {loading ? 'Fixing...' : 'Fix User Profile'}
              </button>
              <button
                onClick={() => {
                  setShowOrphanedUserModal(false);
                  setOrphanedUserEmail('');
                  setOrphanedUserData(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
