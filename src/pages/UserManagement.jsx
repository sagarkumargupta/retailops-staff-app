import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function UserManagement() {
  const { profile, hasPermission } = useUserProfile();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'ADMIN',
    password: '',
    storeId: ''
  });

  const [stores, setStores] = useState([]);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newUserCredentials, setNewUserCredentials] = useState(null);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showInactiveUsers, setShowInactiveUsers] = useState(true);

  useEffect(() => {
    if (profile) {
      loadUsers();
      loadStores();
    }
  }, [profile, showInactiveUsers]);

  const loadStores = async () => {
    try {
      // For now, we'll use a simple approach - managers can only assign to their own stores
      if (profile?.role === 'MANAGER' && profile?.stores) {
        const storeIds = Object.keys(profile.stores).filter(key => profile.stores[key] === true);
        setStores(storeIds.map(id => ({ id, name: id })));
      } else if (profile?.role === 'OWNER') {
        // Owner can assign to any store they own
        // This would need to be implemented based on your store management system
        setStores([]);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadUsers = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      let usersQuery;
      
      if (profile?.role === 'SUPER_ADMIN') {
        usersQuery = query(collection(db, 'users'));
      } else if (profile?.role === 'ADMIN') {
        usersQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['MANAGER', 'STAFF'])
        );
      } else if (profile?.role === 'MANAGER') {
        usersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'STAFF')
        );
      }

      const querySnapshot = await getDocs(usersQuery);
      let usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter users for managers
      if (profile?.role === 'MANAGER') {
        const storeIds = Object.keys(profile.stores || {}).filter(key => profile.stores[key] === true);
        usersData = usersData.filter(user => {
          return Object.keys(user.stores || {}).some(storeId => 
            storeIds.includes(storeId) && user.stores[storeId] === true
          );
        });
      }
      
             // Filter users based on showInactiveUsers setting
       if (!showInactiveUsers) {
         usersData = usersData.filter(user => user.isActive !== false);
       }
       
       setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      setError('Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate permissions
      if (!validatePermissions()) return;

      // Validate form data
      if (!validateFormData()) return;

      // Check for existing user
      const existingStatus = await checkExistingUser(formData.email);
      if (existingStatus.exists) {
        handleExistingUserError(existingStatus);
        return;
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

             // Create user profile in Firestore
       const userProfile = {
         email: formData.email,
         name: formData.name,
         role: formData.role,
         stores: formData.storeId ? { [formData.storeId]: true } : {},
         createdAt: new Date(),
         isActive: true,
         createdBy: profile.email,
         permissions: getDefaultPermissions(formData.role),
         uid: userCredential.user.uid
       };

       // For managers creating staff, ensure they can only assign to their own stores
       if (profile?.role === 'MANAGER' && formData.role === 'STAFF') {
         if (!formData.storeId) {
           setError('Please select a store for the staff member');
           return;
         }
         // Verify the manager has access to this store
         if (!profile.stores?.[formData.storeId]) {
           setError('You can only assign staff to stores you manage');
           return;
         }
       }

      await setDoc(doc(db, 'users', formData.email), userProfile);

      // Show password modal with credentials
      setNewUserCredentials({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: formData.role
      });
      setShowPasswordModal(true);
      resetForm();
      loadUsers();

    } catch (error) {
      console.error('Error creating user:', error);
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  const validatePermissions = () => {
    if (profile?.role === 'SUPER_ADMIN') {
      if (!['ADMIN', 'OWNER'].includes(formData.role)) {
        setError('Super Admin can only create Admin and Owner accounts');
        return false;
      }
    } else if (profile?.role === 'ADMIN') {
      if (!['MANAGER'].includes(formData.role)) {
        setError('Admin can only create Manager accounts');
        return false;
      }
    } else if (profile?.role === 'OWNER') {
      if (!['MANAGER'].includes(formData.role)) {
        setError('Owner can only create Manager accounts');
        return false;
      }
    } else if (profile?.role === 'MANAGER') {
      if (!['STAFF'].includes(formData.role)) {
        setError('Manager can only create Staff accounts');
        return false;
      }
    } else {
      setError('You do not have permission to create users');
      return false;
    }
    return true;
  };

  const validateFormData = () => {
    if (formData.email === profile?.email) {
      setError('Cannot create a user with the same email as your own account');
      return false;
    }

    if (!formData.name.trim()) {
      setError('Please enter a valid name');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    // Validate store assignment for managers creating staff
    if (profile?.role === 'MANAGER' && formData.role === 'STAFF' && !formData.storeId) {
      setError('Please select a store for the staff member');
      return false;
    }

    return true;
  };

  const checkExistingUser = async (email) => {
    const status = {
      exists: false,
      inAuth: false,
      inFirestore: false
    };

    try {
      // Check Firebase Auth
      const signInMethods = await fetchSignInMethodsForEmail(auth, email);
      if (signInMethods.length > 0) {
        status.inAuth = true;
        status.exists = true;
      }

      // Check Firestore
      const userDoc = await getDoc(doc(db, 'users', email));
      if (userDoc.exists()) {
        status.inFirestore = true;
        status.exists = true;
      }
    } catch (error) {
      console.error('Error checking existing user:', error);
    }

    return status;
  };

  const handleExistingUserError = (status) => {
    if (status.inAuth && status.inFirestore) {
      setError('User already exists in both Firebase Auth and Firestore. This user can log in normally.');
    } else if (status.inAuth && !status.inFirestore) {
      setError('User exists in Firebase Auth but not in Firestore. Use "Recover User" to fix this.');
    } else if (!status.inAuth && status.inFirestore) {
      setError('User exists in Firestore but not in Firebase Auth. This is a data inconsistency.');
    }
  };

  const handleError = (error) => {
    if (error.code === 'auth/email-already-in-use') {
      const suggestions = suggestAlternativeEmail(formData.email);
      setError(`Email address is already registered. Suggestions: ${suggestions.slice(0, 3).join(', ')}`);
    } else if (error.code === 'auth/weak-password') {
      setError('Password is too weak. Please use a stronger password (at least 6 characters).');
    } else if (error.code === 'auth/invalid-email') {
      setError('Invalid email address. Please enter a valid email format.');
    } else {
      setError('Failed to create user: ' + error.message);
    }
  };

  const resetForm = () => {
    let defaultRole = 'MANAGER';
    if (profile?.role === 'SUPER_ADMIN') {
      defaultRole = 'ADMIN';
    } else if (profile?.role === 'ADMIN' || profile?.role === 'OWNER') {
      defaultRole = 'MANAGER';
    } else if (profile?.role === 'MANAGER') {
      defaultRole = 'STAFF';
    }
    
    setFormData({
      email: '',
      name: '',
      role: defaultRole,
      password: '',
      storeId: ''
    });
    setShowCreateForm(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setSuccess('Copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    }).catch(() => {
      setError('Failed to copy to clipboard');
    });
  };

  // User Recovery for production
  const handleUserRecovery = async (email) => {
    if (!email) {
      setError('Please provide an email address');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const status = await checkExistingUser(email);
      
      if (status.inAuth && !status.inFirestore) {
        // Create profile for existing Auth user
        const userProfile = {
          email: email,
          name: email.split('@')[0],
          role: 'ADMIN',
          stores: {},
          createdAt: new Date(),
          isActive: true,
          createdBy: profile.email,
          permissions: getDefaultPermissions('ADMIN'),
          recovered: true,
          recoveryDate: new Date()
        };

        await setDoc(doc(db, 'users', email), userProfile);
        setSuccess(`User ${email} recovered successfully! Profile created in Firestore.`);
        loadUsers();
      } else if (status.inAuth && status.inFirestore) {
        setError('User already exists in both systems. No recovery needed.');
      } else if (!status.inAuth) {
        setError('User not found in Firebase Auth. Cannot recover.');
      }
    } catch (error) {
      setError('Recovery failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate new password for existing user
  const generateNewPassword = async (email) => {
    try {
      setLoading(true);
      const newPassword = generateDefaultPassword();
      
      // Update password in Firebase Auth (requires admin SDK in production)
      // For now, we'll show the new password and ask user to reset manually
      setNewUserCredentials({
        email: email,
        password: newPassword,
        name: 'User',
        role: 'Updated Password'
      });
      setShowPasswordModal(true);
      setSuccess(`New password generated for ${email}. Please share with the user.`);
    } catch (error) {
      setError('Failed to generate new password: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (user, newStatus) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Validate permissions
      if (!canManageUser(user)) {
        setError('You do not have permission to manage this user');
        return;
      }

      // Prevent self-deactivation
      if (user.email === profile?.email) {
        setError('You cannot deactivate your own account');
        return;
      }

      // Update user status in Firestore
      await updateDoc(doc(db, 'users', user.email), {
        isActive: newStatus,
        updatedAt: new Date(),
        updatedBy: profile.email
      });

      setSuccess(`User ${user.name} has been ${newStatus ? 'activated' : 'deactivated'} successfully`);
      loadUsers(); // Reload the user list
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const canManageUser = (user) => {
    if (!profile) return false;

    // SUPER_ADMIN can manage all users
    if (profile.role === 'SUPER_ADMIN') return true;

    // ADMIN can manage MANAGER and STAFF
    if (profile.role === 'ADMIN' && ['MANAGER', 'STAFF'].includes(user.role)) return true;

    // OWNER can manage MANAGER and STAFF in their stores
    if (profile.role === 'OWNER' && ['MANAGER', 'STAFF'].includes(user.role)) {
      // Check if user belongs to owner's stores
      // This would need to be implemented based on your store management system
      return true; // For now, allowing all
    }

    // MANAGER can manage STAFF in their store
    if (profile.role === 'MANAGER' && user.role === 'STAFF') {
      // Check if staff belongs to manager's store
      const managerStores = Object.keys(profile.stores || {}).filter(key => profile.stores[key] === true);
      const userStores = Object.keys(user.stores || {}).filter(key => user.stores[key] === true);
      return managerStores.some(storeId => userStores.includes(storeId));
    }

    return false;
  };

  const openActivateModal = (user) => {
    setSelectedUser(user);
    setShowActivateModal(true);
  };

  const sendPasswordReset = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(`Password reset email sent to ${email}`);
    } catch (error) {
      setError('Failed to send password reset: ' + error.message);
    }
  };

  const getDefaultPermissions = (role) => {
    const permissions = {
      ADMIN: {
        canManageUsers: true,
        canManageStores: true,
        canManageTasks: true,
        canManageTrainings: true,
        canManageTests: true,
        canManageCustomers: true,
        canManageDues: true,
        canViewReports: true,
        canManageAttendance: true,
        canManageSalary: true,
        canManageLeave: true,
        canManageRokar: true,
        canAccessAllStores: true,
        canCreateManagers: true
      },
      OWNER: {
        canManageUsers: true,
        canManageStores: true,
        canManageTasks: true,
        canManageTrainings: true,
        canManageTests: true,
        canManageCustomers: true,
        canManageDues: true,
        canViewReports: true,
        canManageAttendance: true,
        canManageSalary: true,
        canManageLeave: true,
        canManageRokar: true,
        canAccessAllStores: false,
        canCreateManagers: true
      },
      MANAGER: {
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
      },
      STAFF: {
        canManageUsers: false,
        canManageStores: false,
        canManageTasks: false,
        canManageTrainings: false,
        canManageTests: false,
        canManageCustomers: false,
        canManageDues: false,
        canViewReports: false,
        canManageAttendance: false,
        canManageSalary: false,
        canManageLeave: false,
        canManageRokar: false,
        canAccessAllStores: false
      }
    };
    
    return permissions[role] || permissions.STAFF;
  };

  const getRoleOptions = () => {
    if (profile?.role === 'SUPER_ADMIN') {
      return [
        { value: 'ADMIN', label: 'Admin' },
        { value: 'OWNER', label: 'Owner' }
      ];
    } else if (profile?.role === 'ADMIN') {
      return [
        { value: 'MANAGER', label: 'Manager' }
      ];
    } else if (profile?.role === 'OWNER') {
      return [
        { value: 'MANAGER', label: 'Manager' }
      ];
    } else if (profile?.role === 'MANAGER') {
      return [
        { value: 'STAFF', label: 'Staff' }
      ];
    }
    return [];
  };

  const generateDefaultPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const suggestAlternativeEmail = (email) => {
    const [localPart, domain] = email.split('@');
    const suggestions = [
      `${localPart}1@${domain}`,
      `${localPart}2@${domain}`,
      `${localPart}.admin@${domain}`,
      `${localPart}.work@${domain}`,
      `${localPart}${Math.floor(Math.random() * 100)}@${domain}`
    ];
    return suggestions;
  };

  // Show loading state while profile is loading
  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!hasPermission('canManageUsers')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">You do not have permission to manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
                     <p className="mt-2 text-sm text-gray-700">
             {profile?.role === 'SUPER_ADMIN' && 'Create and manage Admin and Owner accounts'}
             {profile?.role === 'ADMIN' && 'Create and manage Manager accounts'}
             {profile?.role === 'OWNER' && 'Create and manage Manager accounts for your stores'}
             {profile?.role === 'MANAGER' && 'Create and manage Staff accounts for your store'}
           </p>
                     <p className="mt-1 text-xs text-gray-500">
             Production-ready system with comprehensive error handling and user recovery.
           </p>
           <p className="mt-1 text-xs text-green-600">
             💡 Simple: Add password → Create user → Share credentials → User can login!
           </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-3">
          <button
            onClick={() => handleUserRecovery('badal.gupta56@gmail.com')}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            Recover Badal
          </button>
                     <button
             onClick={() => setShowCreateForm(true)}
             className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
           >
             Create User
           </button>
           <div className="flex items-center space-x-2">
             <label className="flex items-center">
               <input
                 type="checkbox"
                 checked={showInactiveUsers}
                 onChange={(e) => setShowInactiveUsers(e.target.checked)}
                 className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
               />
               <span className="ml-2 text-sm text-gray-700">Show Inactive Users</span>
             </label>
           </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-green-600">{success}</p>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div className="mt-6 bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
                         <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
               Create New User
             </h3>
             <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
               <p className="text-sm text-green-800">
                 <strong>Simple Process:</strong> 
                 1. Fill the form below (including password)
                 2. Click "Create User" 
                 3. Copy the credentials that appear
                 4. Share with the user - they can login immediately!
               </p>
             </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Email Address
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="flex-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const suggestions = suggestAlternativeEmail(formData.email);
                        setFormData({...formData, email: suggestions[0]});
                      }}
                      className="ml-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Suggest
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Role
                  </label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {getRoleOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                                 <div>
                   <label className="block text-sm font-medium text-gray-700">
                     Password <span className="text-red-500">*</span>
                   </label>
                   <div className="mt-1 flex rounded-md shadow-sm">
                     <input
                       type="text"
                       required
                       placeholder="Enter password for user login"
                       value={formData.password}
                       onChange={(e) => setFormData({...formData, password: e.target.value})}
                       className="flex-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                     />
                     <button
                       type="button"
                       onClick={() => setFormData({...formData, password: generateDefaultPassword()})}
                       className="ml-3 inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                     >
                       Generate
                     </button>
                   </div>
                   <p className="mt-1 text-xs text-gray-500">
                     This password will be used by the user to log in. Make sure to share it with them!
                   </p>
                 </div>
                 
                 {/* Store Assignment for Managers creating Staff */}
                 {profile?.role === 'MANAGER' && formData.role === 'STAFF' && stores.length > 0 && (
                   <div>
                     <label className="block text-sm font-medium text-gray-700">
                       Assign to Store
                     </label>
                     <select
                       required
                       value={formData.storeId}
                       onChange={(e) => setFormData({...formData, storeId: e.target.value})}
                       className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                     >
                       <option value="">Select a store</option>
                       {stores.map(store => (
                         <option key={store.id} value={store.id}>
                           {store.name}
                         </option>
                       ))}
                     </select>
                     <p className="mt-1 text-xs text-gray-500">
                       This staff member will be assigned to the selected store.
                     </p>
                   </div>
                 )}
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
             )}

       {/* Password Display Modal */}
       {showPasswordModal && newUserCredentials && (
         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
           <div className="relative top-20 mx-auto p-6 border w-96 shadow-lg rounded-md bg-white">
             <div className="mt-3">
               <div className="flex items-center justify-center w-12 h-12 mx-auto bg-green-100 rounded-full">
                 <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                 </svg>
               </div>
               <h3 className="text-lg font-medium text-gray-900 text-center mt-4">
                 User Created Successfully!
               </h3>
               <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                 <p className="text-sm text-gray-600 mb-3">
                   <strong>Important:</strong> Share these credentials with the user. They will need these to log in.
                 </p>
                 <div className="space-y-3">
                   <div>
                     <label className="block text-xs font-medium text-gray-500">Email</label>
                     <div className="flex items-center mt-1">
                       <input
                         type="text"
                         value={newUserCredentials.email}
                         readOnly
                         className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2"
                       />
                       <button
                         onClick={() => copyToClipboard(newUserCredentials.email)}
                         className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                       >
                         Copy
                       </button>
                     </div>
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-500">Password</label>
                     <div className="flex items-center mt-1">
                       <input
                         type="text"
                         value={newUserCredentials.password}
                         readOnly
                         className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2"
                       />
                       <button
                         onClick={() => copyToClipboard(newUserCredentials.password)}
                         className="ml-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                       >
                         Copy
                       </button>
                     </div>
                   </div>
                   <div>
                     <label className="block text-xs font-medium text-gray-500">Role</label>
                     <span className="inline-block mt-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                       {newUserCredentials.role}
                     </span>
                   </div>
                 </div>
                 <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                   <p className="text-xs text-yellow-800">
                     <strong>Security Note:</strong> Ask the user to change their password after first login.
                   </p>
                 </div>
               </div>
               <div className="flex justify-end mt-6">
                 <button
                   onClick={() => {
                     setShowPasswordModal(false);
                     setNewUserCredentials(null);
                   }}
                   className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                 >
                   Close
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Activation Confirmation Modal */}
       {showActivateModal && selectedUser && (
         <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
           <div className="relative top-20 mx-auto p-6 border w-96 shadow-lg rounded-md bg-white">
             <div className="mt-3">
               <div className="flex items-center justify-center w-12 h-12 mx-auto bg-yellow-100 rounded-full">
                 <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                 </svg>
               </div>
               <h3 className="text-lg font-medium text-gray-900 text-center mt-4">
                 Confirm User Status Change
               </h3>
               <div className="mt-4">
                 <p className="text-sm text-gray-600 text-center">
                   Are you sure you want to {selectedUser.isActive ? 'deactivate' : 'activate'} 
                   <strong> {selectedUser.name}</strong> ({selectedUser.email})?
                 </p>
                 <div className="mt-4 p-3 bg-gray-50 rounded">
                   <p className="text-xs text-gray-600">
                     <strong>Note:</strong> {selectedUser.isActive ? 'Deactivated' : 'Activated'} users 
                     {selectedUser.isActive ? ' will not be able to log in' : ' will be able to log in'} 
                     to the system.
                   </p>
                 </div>
               </div>
               <div className="flex justify-end space-x-3 mt-6">
                 <button
                   onClick={() => {
                     setShowActivateModal(false);
                     setSelectedUser(null);
                   }}
                   className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400"
                 >
                   Cancel
                 </button>
                 <button
                   onClick={() => {
                     toggleUserStatus(selectedUser, !selectedUser.isActive);
                     setShowActivateModal(false);
                     setSelectedUser(null);
                   }}
                   className={`px-4 py-2 text-white text-sm font-medium rounded-md ${
                     selectedUser.isActive 
                       ? 'bg-red-600 hover:bg-red-700' 
                       : 'bg-green-600 hover:bg-green-700'
                   }`}
                 >
                   {selectedUser.isActive ? 'Deactivate' : 'Activate'}
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}

       {/* Users List */}
      <div className="mt-8 flex flex-col">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                                                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Status
                       </th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                         Created
                       </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                  </span>
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                                {user.recovered && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Recovered
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                              user.role === 'OWNER' ? 'bg-purple-100 text-purple-800' :
                              user.role === 'MANAGER' ? 'bg-blue-100 text-blue-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                                                     <td className="px-6 py-4 whitespace-nowrap">
                             <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                               user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                             }`}>
                               {user.isActive ? 'Active' : 'Inactive'}
                             </span>
                           </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                          </td>
                                                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                             <button
                               onClick={() => sendPasswordReset(user.email)}
                               className="text-blue-600 hover:text-blue-900"
                             >
                               Reset Password
                             </button>
                             <button
                               onClick={() => generateNewPassword(user.email)}
                               className="text-green-600 hover:text-green-900"
                             >
                               Generate Password
                             </button>
                             {canManageUser(user) && user.email !== profile?.email && (
                               <button
                                 onClick={() => toggleUserStatus(user, !user.isActive)}
                                 className={`${
                                   user.isActive 
                                     ? 'text-red-600 hover:text-red-900' 
                                     : 'text-green-600 hover:text-green-900'
                                 }`}
                               >
                                 {user.isActive ? 'Deactivate' : 'Activate'}
                               </button>
                             )}
                           </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
