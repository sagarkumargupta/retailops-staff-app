import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where, orderBy, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';
import { deactivateUser, activateUser, archiveUser, restoreUser, getUsersByStatus, markAllManagersAsActive } from '../utils/userManagement';

export default function AdminManagers() {
  const { profile, hasPermission } = useUserProfile();
  const [managers, setManagers] = useState([]);
  const [inactiveManagers, setInactiveManagers] = useState([]);
  const [archivedManagers, setArchivedManagers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newManagerCredentials, setNewManagerCredentials] = useState(null);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'inactive', 'archived'
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    selectedStoreId: '',
    role: 'MANAGER'
  });

  useEffect(() => {
    if (profile && hasPermission('canManageUsers')) {
      loadData();
    }
  }, [profile]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load stores
      const storesSnap = await getDocs(collection(db, 'stores'));
      const storesList = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStores(storesList);

      // Load all managers first, then categorize them
      const allUsersSnap = await getDocs(collection(db, 'users'));
      const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter managers
      const allManagers = allUsers.filter(user => user.role === 'MANAGER');
      
      // Categorize managers by status
      const activeManagersList = allManagers.filter(manager => 
        (manager.status === 'ACTIVE' || manager.isActive === true) && 
        manager.status !== 'INACTIVE' && 
        manager.isActive !== false
      );
      
      const inactiveManagersList = allManagers.filter(manager => 
        manager.status === 'INACTIVE' || manager.isActive === false
      );
      
      // Load archived managers from separate collection
      const archivedUsers = await getUsersByStatus('ARCHIVED');
      const archivedManagersList = archivedUsers.filter(user => user.role === 'MANAGER');
      
      setManagers(activeManagersList);
      setInactiveManagers(inactiveManagersList);
      setArchivedManagers(archivedManagersList);
      
      console.log('Manager counts:', {
        active: activeManagersList.length,
        inactive: inactiveManagersList.length,
        archived: archivedManagersList.length,
        total: allManagers.length
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleCreateManager = async (e) => {
    e.preventDefault();
    
    if (!createForm.name || !createForm.email || !createForm.password || !createForm.selectedStoreId) {
      alert('Please fill all required fields');
      return;
    }

    try {
      // Check if manager already exists
      const existingManager = managers.find(m => m.email === createForm.email);
      if (existingManager) {
        alert('Manager with this email already exists!');
        return;
      }

      // Check if store already has a manager
      const storeHasManager = managers.find(m => 
        m.stores && m.stores[createForm.selectedStoreId] === true
      );
      if (storeHasManager) {
        alert('This store already has a manager assigned!');
        return;
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        createForm.email, 
        createForm.password
      );

      // Get store details for automatic assignment
      const selectedStore = stores.find(store => store.id === createForm.selectedStoreId);
      
      // Create manager profile in Firestore
      const managerData = {
        name: createForm.name,
        email: createForm.email,
        phone: createForm.phone,
        role: 'MANAGER',
        stores: { [createForm.selectedStoreId]: true },
        assignedStore: createForm.selectedStoreId,
        storeName: selectedStore?.name || '',
        storeBrand: selectedStore?.brand || '',
        storeLocation: selectedStore?.location || selectedStore?.city || '',
        createdAt: serverTimestamp(),
        createdBy: profile.email,
        isActive: true,
        permissions: {
          canManageUsers: true,
          canManageStores: false,
          canManageTasks: true,
          canManageTrainings: false,
          canManageTests: false,
          canManageCustomers: true,
          canManageDues: true,
          canViewReports: true,
          canManageAttendance: true,
          canManageSalary: true,
          canManageLeave: true,
          canManageRokar: true,
          canAccessAllStores: false,
          canCreateStaff: true
        }
      };

      await setDoc(doc(db, 'users', createForm.email), managerData);

      // Show credentials to admin
      setNewManagerCredentials({
        email: createForm.email,
        password: createForm.password,
        name: createForm.name
      });

      setShowCreateModal(false);
      setShowPasswordModal(true);
      
      // Reset form
      setCreateForm({
        name: '',
        email: '',
        phone: '',
        password: '',
        selectedStoreId: '',
        role: 'MANAGER'
      });
      
      await loadData();
    } catch (error) {
      console.error('Error creating manager:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('A user with this email already exists!');
      } else {
        alert('Failed to create manager: ' + error.message);
      }
    }
  };

  const handleUpdateManager = async (managerId, updates) => {
    try {
      await updateDoc(doc(db, 'users', managerId), {
        ...updates,
        updatedAt: serverTimestamp(),
        updatedBy: profile.email
      });
      await loadData();
      alert('Manager updated successfully!');
    } catch (error) {
      console.error('Error updating manager:', error);
      alert('Failed to update manager');
    }
  };

  const handleDeactivateManager = async (managerEmail) => {
    if (!confirm('Are you sure you want to deactivate this manager? They will not be able to login until reactivated.')) return;

    try {
      await deactivateUser(managerEmail, 'Admin deactivation');
      await loadData();
      alert('Manager deactivated successfully!');
    } catch (error) {
      console.error('Error deactivating manager:', error);
      alert('Failed to deactivate manager');
    }
  };

  const handleActivateManager = async (managerEmail) => {
    if (!confirm('Are you sure you want to activate this manager? They will be able to login again.')) return;

    try {
      await activateUser(managerEmail);
      await loadData();
      alert('Manager activated successfully!');
    } catch (error) {
      console.error('Error activating manager:', error);
      alert('Failed to activate manager');
    }
  };

  const handleArchiveManager = async (managerEmail) => {
    if (!confirm('Are you sure you want to archive this manager? This will move them to the archive section.')) return;

    try {
      await archiveUser(managerEmail);
      await loadData();
      alert('Manager archived successfully!');
    } catch (error) {
      console.error('Error archiving manager:', error);
      alert('Failed to archive manager');
    }
  };

  const handleRestoreManager = async (managerEmail) => {
    if (!confirm('Are you sure you want to restore this manager? They will be activated and able to login again.')) return;

    try {
      await restoreUser(managerEmail);
      await loadData();
      alert('Manager restored successfully!');
    } catch (error) {
      console.error('Error restoring manager:', error);
      alert('Failed to restore manager');
    }
  };

  const handleMarkAllManagersAsActive = async () => {
    if (!confirm('Are you sure you want to mark ALL managers as active? This will activate all inactive and archived managers.')) return;

    try {
      setLoading(true);
      const result = await markAllManagersAsActive();
      await loadData();
      alert(result.message);
    } catch (error) {
      console.error('Error marking all managers as active:', error);
      alert('Failed to mark all managers as active: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStoreName = (storeId) => {
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : 'Unknown Store';
  };

  const getManagerStores = (manager) => {
    if (!manager.stores) return [];
    return Object.keys(manager.stores).filter(key => manager.stores[key] === true);
  };

  if (!profile || !hasPermission('canManageUsers')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manager Management</h1>
              <p className="mt-2 text-gray-600">Manage store managers and their assignments</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Manager
              </button>
              
              <button
                onClick={handleMarkAllManagersAsActive}
                disabled={loading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {loading ? 'Activating...' : 'Activate All Managers'}
              </button>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-5 gap-6 mb-8">
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
                <div className="text-2xl font-bold text-gray-900">{managers.length}</div>
                <div className="text-sm text-gray-600">Active Managers</div>
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
                <div className="text-2xl font-bold text-gray-900">{inactiveManagers.length}</div>
                <div className="text-sm text-gray-600">Inactive Managers</div>
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
                <div className="text-2xl font-bold text-gray-900">{archivedManagers.length}</div>
                <div className="text-sm text-gray-600">Archived Managers</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">{stores.length}</div>
                <div className="text-sm text-gray-600">Total Stores</div>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <div className="text-2xl font-bold text-gray-900">
                  {stores.filter(store => 
                    managers.some(manager => 
                      manager.stores && manager.stores[store.id] === true
                    )
                  ).length}
                </div>
                <div className="text-sm text-gray-600">Stores with Managers</div>
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
                Active Managers ({managers.length})
              </button>
              <button
                onClick={() => setActiveTab('inactive')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'inactive'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Inactive Managers ({inactiveManagers.length})
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'archived'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Archived Managers ({archivedManagers.length})
              </button>
            </nav>
          </div>
        </div>

        {/* Managers List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {activeTab === 'active' && 'Active Store Managers'}
              {activeTab === 'inactive' && 'Inactive Store Managers'}
              {activeTab === 'archived' && 'Archived Store Managers'}
            </h2>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-gray-600">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading managers...
              </div>
            </div>
          ) : (() => {
            const currentManagers = activeTab === 'active' ? managers : 
                                   activeTab === 'inactive' ? inactiveManagers : 
                                   archivedManagers;
            
            return currentManagers.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  {activeTab === 'active' && 'No active managers found'}
                  {activeTab === 'inactive' && 'No inactive managers found'}
                  {activeTab === 'archived' && 'No archived managers found'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {activeTab === 'active' && 'Get started by creating a new manager.'}
                  {activeTab === 'inactive' && 'No managers have been deactivated.'}
                  {activeTab === 'archived' && 'No managers have been archived.'}
                </p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Store</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentManagers.map((manager) => (
                    <tr key={manager.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-medium">
                              {manager.name?.charAt(0)?.toUpperCase() || 'M'}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{manager.name}</div>
                            <div className="text-sm text-gray-500">{manager.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{manager.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {getManagerStores(manager).map(storeId => getStoreName(storeId)).join(', ')}
                        </div>
                      </td>
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {manager.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          {activeTab === 'active' && (
                            <>
                              <button
                                onClick={() => handleDeactivateManager(manager.email)}
                                className="text-yellow-600 hover:text-yellow-900 hover:bg-yellow-50 text-sm px-3 py-1 rounded-md transition-colors"
                              >
                                Deactivate
                              </button>
                              <button
                                onClick={() => handleArchiveManager(manager.email)}
                                className="text-red-600 hover:text-red-900 hover:bg-red-50 text-sm px-3 py-1 rounded-md transition-colors"
                              >
                                Archive
                              </button>
                            </>
                          )}
                          {activeTab === 'inactive' && (
                            <>
                              <button
                                onClick={() => handleActivateManager(manager.email)}
                                className="text-green-600 hover:text-green-900 hover:bg-green-50 text-sm px-3 py-1 rounded-md transition-colors"
                              >
                                Activate
                              </button>
                              <button
                                onClick={() => handleArchiveManager(manager.email)}
                                className="text-red-600 hover:text-red-900 hover:bg-red-50 text-sm px-3 py-1 rounded-md transition-colors"
                              >
                                Archive
                              </button>
                            </>
                          )}
                          {activeTab === 'archived' && (
                            <button
                              onClick={() => handleRestoreManager(manager.email)}
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

        {/* Create Manager Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Create Store Manager</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleCreateManager} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={createForm.password}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter password or generate one"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setCreateForm(prev => ({ ...prev, password: generatePassword() }))}
                      className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Create a strong password or use the generate button
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Store *</label>
                  <select
                    value={createForm.selectedStoreId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, selectedStoreId: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select a store</option>
                    {stores
                      .filter(store => !managers.some(manager => 
                        manager.stores && manager.stores[store.id] === true
                      ))
                      .map(store => (
                        <option key={store.id} value={store.id}>
                          {store.name} - {store.city}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Only stores without managers are shown
                  </p>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create Manager
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password Display Modal */}
        {showPasswordModal && newManagerCredentials && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Manager Created Successfully!</h3>
                  <button
                    onClick={() => setShowPasswordModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Manager account created successfully!
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>Please share these credentials with the manager:</p>
                        <p className="mt-1 text-xs text-green-600">
                          Created by: {profile?.email} at {new Date().toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manager Name</label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{newManagerCredentials.name}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{newManagerCredentials.email}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{newManagerCredentials.password}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">
                        Important Instructions
                      </h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <ol className="list-decimal list-inside space-y-1">
                          <li>Share these credentials with the manager</li>
                          <li>Manager can login immediately with these details</li>
                          <li>Manager should change password after first login</li>
                          <li>Store these credentials securely</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


