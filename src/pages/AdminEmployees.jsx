import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateEmail, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase';
import { addStaffMember, updateStaffMember, deleteStaffMember } from '../utils/staffUtils';
import { getEmailUpdateInstructions } from '../utils/authUtils';
import { deactivateUser, activateUser, archiveUser, restoreUser, getUsersByStatus, markAllStaffAsActive } from '../utils/userManagement';
import useUserProfile from '../hooks/useUserProfile';

export default function AdminEmployees() {
  const { profile, hasPermission } = useUserProfile();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    originalEmail: '',
    password: '',
    role: 'SALESMAN',
    salary: '',
    leaveDays: '',
    lunchAllowance: '',
    extraSundayAllowance: '',
    previousAdvance: ''
  });
  const [employees, setEmployees] = useState([]);
  const [inactiveEmployees, setInactiveEmployees] = useState([]);
  const [archivedEmployees, setArchivedEmployees] = useState([]);
  const [activeTab, setActiveTab] = useState('active');
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newStaffCredentials, setNewStaffCredentials] = useState(null);
  
  // Dashboard data states
  const [rokarStatus, setRokarStatus] = useState([]);
  const [storePerformance, setStorePerformance] = useState([]);
  const [staffPerformance, setStaffPerformance] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      loadEmployees();
    } else {
      setEmployees([]);
    }
  }, [selectedStore]);

  const loadStores = async () => {
    try {
      const storesSnap = await getDocs(collection(db, 'stores'));
      setStores(storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const loadEmployees = async () => {
    if (!selectedStore) return;
    setLoading(true);
    try {
      // Load all users, then filter by store and role
      const allUsersSnap = await getDocs(collection(db, 'users'));
      const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter staff for this store and exclude deleted documents
      const allStaff = allUsers.filter(user => 
        user.role === 'STAFF' && 
        user.assignedStore === selectedStore &&
        !user.deleted // Exclude deleted documents
      );
      
      console.log('All users loaded:', allUsers.length);
      console.log('Filtered staff for store:', allStaff.length);
      console.log('Staff emails:', allStaff.map(s => s.email));
      
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
        user.role === 'STAFF' && user.assignedStore === selectedStore
      );
      
      setEmployees(activeStaffList);
      setInactiveEmployees(inactiveStaffList);
      setArchivedEmployees(archivedStaffList);
      
      console.log('Employee counts:', {
        active: activeStaffList.length,
        inactive: inactiveStaffList.length,
        archived: archivedStaffList.length,
        total: allStaff.length
      });
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const reset = () => {
    setForm({
      name: '',
      phone: '',
      email: '',
      originalEmail: '',
      password: '',
      role: 'SALESMAN',
      salary: '',
      leaveDays: '',
      lunchAllowance: '',
      extraSundayAllowance: '',
      previousAdvance: ''
    });
    setEditingId(null);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!selectedStore) {
      alert('Please select a store first');
      return;
    }

    if (!form.password) {
      alert('Please enter a password for the staff member');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Check if email already exists in this store
    const existingEmployee = employees.find(emp => emp.email === form.email.toLowerCase() && emp.id !== editingId);
    if (existingEmployee) {
      alert('An employee with this email already exists in this store');
      return;
    }

    try {
      if (editingId) {
        // Update existing employee with password verification
        const updatePayload = {
          ...form,
          email: form.email.toLowerCase(),
          salary: Number(form.salary) || 0,
          leaveDays: Number(form.leaveDays) || 0,
          lunchAllowance: Number(form.lunchAllowance) || 0,
          extraSundayAllowance: Number(form.extraSundayAllowance) || 0,
          previousAdvance: Number(form.previousAdvance) || 0
        };
        
        // Verify password before updating
        if (!form.password || form.password.trim() === '') {
          alert('Please enter a password to confirm the changes');
          return;
        }
        
        // Here you could add additional password verification logic if needed
        // For now, we'll just ensure a password is provided
        
        delete updatePayload.password; // Remove password from update payload
        delete updatePayload.originalEmail; // Remove originalEmail from update payload
        
        console.log('About to update staff member:', {
          selectedStore,
          editingId,
          originalEmail: form.originalEmail,
          newEmail: form.email,
          emailChanged: form.originalEmail.toLowerCase() !== form.email.toLowerCase()
        });
        
        // Debug: Check what the editingId looks like vs email formats
        console.log('EditingId vs email formats:', {
          editingId: editingId,
          originalEmailRaw: form.originalEmail,
          originalEmailFormatted: form.originalEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_'),
          newEmailFormatted: form.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')
        });
        
        await updateStaffMember(selectedStore, editingId, updatePayload, form.originalEmail);
        
        console.log('Staff member update completed, waiting before reload...');
        
        // Add a small delay to ensure database operations complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Reloading employees...');
        
        // Check if email was changed and handle Firebase Auth
        if (form.originalEmail.toLowerCase() !== form.email.toLowerCase()) {
          try {
            console.log('Email changed, creating new Firebase Auth account...');
            
            // Create new Firebase Auth account with new email and provided password
            const userCredential = await createUserWithEmailAndPassword(
              auth, 
              form.email.toLowerCase(), 
              form.password
            );
            
            console.log('New Firebase Auth account created:', userCredential.user.uid);
            
            // Success message with new credentials
            alert(`Employee updated successfully!

IMPORTANT: New login account created!

Staff can now login with:
• Email: ${form.email}
• Password: ${form.password}

The old email (${form.originalEmail}) will no longer work for login.

Please share these credentials with the staff member securely.`);
            
          } catch (error) {
            console.error('Error creating new Firebase Auth account:', error);
            
            // Handle different error scenarios
            if (error.code === 'auth/email-already-in-use') {
              alert(`Employee data updated successfully!

WARNING: Could not create new login account because ${form.email} is already in use by another Firebase account.

Options:
1. The staff member should try logging in with: ${form.email} and their existing password
2. Use a different email address
3. Contact admin to resolve this conflict

Current database shows new email: ${form.email}
Old login email was: ${form.originalEmail}`);
            } else if (error.code === 'auth/weak-password') {
              alert(`Employee data updated successfully!

WARNING: Could not create login account - password too weak.

Please:
1. Edit this employee again
2. Set a stronger password (at least 6 characters)
3. Save to create the login account

Database has been updated with new email: ${form.email}`);
            } else {
              alert(`Employee data updated successfully!

WARNING: Could not create new login account automatically.
Error: ${error.message}

The staff member will need to:
1. Try logging in with old email: ${form.originalEmail}
2. Or contact admin for manual account creation
3. Or reset password using: ${form.email}

Database has been updated with new email: ${form.email}`);
            }
          }
        } else {
          // Email not changed, but check if password was provided for password update
          if (form.password && form.password.trim() !== '') {
            try {
              console.log('Password provided for existing user, creating new auth account with same email...');
              
              // Try to create new Firebase Auth account with same email and new password
              // This will fail if email already exists, which is expected
              const userCredential = await createUserWithEmailAndPassword(
                auth, 
                form.email.toLowerCase(), 
                form.password
              );
              
              console.log('New Firebase Auth account created with updated password');
              
              alert(`Employee updated successfully!

IMPORTANT: New login credentials created!

Staff can now login with:
• Email: ${form.email}
• Password: ${form.password}

Please share the new password with the staff member securely.`);
              
            } catch (error) {
              if (error.code === 'auth/email-already-in-use') {
                // This is expected - email already has an auth account
                alert(`Employee updated successfully!

NOTE: Password was provided but could not update Firebase Auth password directly.

The staff member should:
1. Login with email: ${form.email}
2. Use their existing password (not the one you entered)
3. If they forgot their password, they can use "Forgot Password" feature

Database has been updated with other changes.`);
              } else {
                console.error('Unexpected error:', error);
                alert(`Employee updated successfully!

WARNING: Could not update login password.
Error: ${error.message}

Database has been updated with other changes.`);
              }
            }
          } else {
        alert('Employee updated successfully!');
          }
        }
        
        reset();
        await loadEmployees(); // Make sure to await the reload
      } else {
        // Create new employee with Firebase Auth account
        const selectedStoreData = stores.find(store => store.id === selectedStore);
        
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(
          auth, 
          form.email.toLowerCase(), 
          form.password
        );

        // Create staff data with store information
        const staffData = {
          ...form,
          email: form.email.toLowerCase(),
          salary: Number(form.salary) || 0,
          leaveDays: Number(form.leaveDays) || 0,
          lunchAllowance: Number(form.lunchAllowance) || 0,
          extraSundayAllowance: Number(form.extraSundayAllowance) || 0,
          previousAdvance: Number(form.previousAdvance) || 0,
          assignedStore: selectedStore,
          storeName: selectedStoreData?.name || '',
          storeBrand: selectedStoreData?.brand || '',
          storeLocation: selectedStoreData?.location || selectedStoreData?.city || '',
          createdAt: serverTimestamp(),
          createdBy: profile?.email || 'admin'
        };

        // Add to store staff collection
        const result = await addStaffMember(selectedStore, staffData);

        // Create user profile in Firestore
        const userData = {
          name: form.name,
          email: form.email.toLowerCase(),
          phone: form.phone,
          role: 'STAFF',
          stores: { [selectedStore]: true },
          assignedStore: selectedStore,
          storeName: selectedStoreData?.name || '',
          storeBrand: selectedStoreData?.brand || '',
          storeLocation: selectedStoreData?.location || selectedStoreData?.city || '',
          staffId: result.staffId,
          salary: Number(form.salary) || 0,
          leaveDays: Number(form.leaveDays) || 0,
          lunchAllowance: Number(form.lunchAllowance) || 0,
          extraSundayAllowance: Number(form.extraSundayAllowance) || 0,
          previousAdvance: Number(form.previousAdvance) || 0,
          createdAt: serverTimestamp(),
          createdBy: profile?.email || 'admin',
          isActive: true,
          permissions: {
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

        await setDoc(doc(db, 'users', form.email.toLowerCase()), userData);

        // Show credentials to admin
        setNewStaffCredentials({
          email: form.email.toLowerCase(),
          password: form.password,
          name: form.name,
          storeName: selectedStoreData?.name || '',
          storeBrand: selectedStoreData?.brand || ''
        });

        setShowPasswordModal(true);
        reset();
        loadEmployees();
      }
    } catch (error) {
      console.error('Error saving employee:', error);
      if (error.code === 'auth/email-already-in-use') {
        alert('A user with this email already exists!');
      } else {
        alert('Error saving employee: ' + error.message);
      }
    }
  };

  const editRow = (employee) => {
    console.log('Editing employee:', employee);
    setForm({
      name: employee.name || '',
      phone: employee.phone || '',
      email: employee.email || '',
      originalEmail: employee.email || '', // Store original email for comparison
      password: '', // Empty password field for editing
      role: employee.role || 'SALESMAN',
      salary: employee.salary?.toString() || '',
      leaveDays: employee.leaveDays?.toString() || '',
      lunchAllowance: employee.lunchAllowance?.toString() || '',
      extraSundayAllowance: employee.extraSundayAllowance?.toString() || '',
      previousAdvance: employee.previousAdvance?.toString() || ''
    });
    setEditingId(employee.id);
    console.log('Set editingId to:', employee.id);
  };

  const handleDeactivateEmployee = async (employeeEmail) => {
    if (!confirm('Are you sure you want to deactivate this employee? They will not be able to login but their data will be preserved.')) return;

    try {
      await deactivateUser(employeeEmail, 'Deactivated by admin');
      await loadEmployees();
      alert('Employee deactivated successfully!');
    } catch (error) {
      console.error('Error deactivating employee:', error);
      alert('Failed to deactivate employee');
    }
  };

  const handleActivateEmployee = async (employeeEmail) => {
    if (!confirm('Are you sure you want to activate this employee? They will be able to login again.')) return;

    try {
      await activateUser(employeeEmail);
      await loadEmployees();
      alert('Employee activated successfully!');
    } catch (error) {
      console.error('Error activating employee:', error);
      alert('Failed to activate employee');
    }
  };

  const handleArchiveEmployee = async (employeeEmail) => {
    if (!confirm('Are you sure you want to archive this employee? They will be moved to archive and cannot login.')) return;

    try {
      await archiveUser(employeeEmail);
      await loadEmployees();
      alert('Employee archived successfully!');
    } catch (error) {
      console.error('Error archiving employee:', error);
      alert('Failed to archive employee');
    }
  };

  const handleRestoreEmployee = async (employeeEmail) => {
    if (!confirm('Are you sure you want to restore this employee? They will be activated and able to login again.')) return;

    try {
      await restoreUser(employeeEmail);
      await loadEmployees();
      alert('Employee restored successfully!');
    } catch (error) {
      console.error('Error restoring employee:', error);
      alert('Failed to restore employee');
    }
  };

  const handleMarkAllEmployeesAsActive = async () => {
    if (!confirm('Are you sure you want to mark ALL employees as active? This will activate all inactive and archived employees.')) return;

    try {
      setLoading(true);
      const result = await markAllStaffAsActive(selectedStore);
      await loadEmployees();
      alert(result.message);
    } catch (error) {
      console.error('Error marking all employees as active:', error);
      alert('Failed to mark all employees as active: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (employee) => {
    const newPassword = prompt(`Enter new password for ${employee.name} (${employee.email}):`);
    if (!newPassword || newPassword.trim() === '') {
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    try {
      console.log('Resetting password for:', employee.email);
      
      // Create new Firebase Auth account with new password
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        employee.email.toLowerCase(), 
        newPassword
      );
      
      console.log('New Firebase Auth account created with new password');
      
      alert(`Password reset successful!

${employee.name} can now login with:
• Email: ${employee.email}
• Password: ${newPassword}

Please share the new password with the staff member securely.

The old login credentials will no longer work.`);
      
    } catch (error) {
      console.error('Error resetting password:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        alert(`Could not reset password for ${employee.email} because this email already has a Firebase Auth account.

Options:
1. The staff member can use "Forgot Password" feature
2. Contact Firebase admin to manually reset the password
3. Use a different email address

Current database email: ${employee.email}`);
      } else if (error.code === 'auth/weak-password') {
        alert('Password is too weak. Please use a password with at least 6 characters.');
      } else {
        alert(`Failed to reset password: ${error.message}`);
      }
    }
  };

  const getRoleDisplayName = (role) => {
    const roleMap = {
      'SALESMAN': 'Salesman',
      'CASHIER': 'Cashier', 
      'TAILOR': 'Tailor',
      'GUARD': 'Guard',
      'MANAGER': 'Manager'
    };
    return roleMap[role] || role;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Store Staff</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Store</label>
        <select 
          value={selectedStore} 
          onChange={(e) => setSelectedStore(e.target.value)}
          className="p-2 border rounded w-full max-w-md"
        >
          <option value="">Select Store</option>
          {stores.map(store => (
            <option key={store.id} value={store.id}>
              {store.brand} — {store.name}
            </option>
          ))}
        </select>
      </div>

      {selectedStore && (
        <>
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">
              Managing Staff for: {stores.find(s => s.id === selectedStore)?.brand} — {stores.find(s => s.id === selectedStore)?.name}
            </h3>
            <p className="text-sm text-blue-600">
              Add, edit, or manage staff members for this store. Staff will be able to access the system using their email address.
            </p>
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
                  <div className="text-2xl font-bold text-gray-900">{employees.length}</div>
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
                  <div className="text-2xl font-bold text-gray-900">{inactiveEmployees.length}</div>
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
                  <div className="text-2xl font-bold text-gray-900">{archivedEmployees.length}</div>
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
                    ₹{employees.reduce((sum, member) => sum + (member.salary || 0), 0).toLocaleString()}
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
                  Active Staff ({employees.length})
                </button>
                <button
                  onClick={() => setActiveTab('inactive')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'inactive'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Inactive Staff ({inactiveEmployees.length})
                </button>
                <button
                  onClick={() => setActiveTab('archived')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'archived'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Archived Staff ({archivedEmployees.length})
                </button>
              </nav>
            </div>
          </div>

          <form onSubmit={save} className="mb-8 p-6 border rounded-lg bg-gray-50">
            <h3 className="font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Staff Member</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input name="name" value={form.name} onChange={onChange} placeholder="Full Name" className="w-full p-2 border rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input name="phone" value={form.phone} onChange={onChange} placeholder="Phone Number" className="w-full p-2 border rounded" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input name="email" type="email" value={form.email} onChange={onChange} placeholder="Email Address" className="w-full p-2 border rounded" required />
              </div>
              {!editingId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <div className="flex space-x-2">
                    <input 
                      name="password" 
                      type="text" 
                      value={form.password} 
                      onChange={onChange} 
                      placeholder="Enter password or generate one" 
                      className="flex-1 p-2 border rounded" 
                      required={!editingId}
                    />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, password: generatePassword() }))}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors font-medium"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Create a strong password or use the generate button
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password for Email Change *</label>
                  <div className="flex space-x-2">
                    <input 
                      name="password" 
                      type="password" 
                      value={form.password} 
                      onChange={onChange} 
                      placeholder="Enter password to confirm email change" 
                      className="flex-1 p-2 border rounded" 
                      required={editingId}
                    />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, password: generatePassword() }))}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors font-medium"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Password required to confirm staff details changes
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select name="role" value={form.role} onChange={onChange} className="w-full p-2 border rounded">
                  <option value="SALESMAN">Salesman</option>
                  <option value="CASHIER">Cashier</option>
                  <option value="TAILOR">Tailor</option>
                  <option value="GUARD">Guard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (₹)</label>
                <input name="salary" type="number" value={form.salary} onChange={onChange} placeholder="Monthly Salary" className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Days</label>
                <input name="leaveDays" type="number" value={form.leaveDays} onChange={onChange} placeholder="Leave Days" className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lunch Allowance (₹/day)</label>
                <input name="lunchAllowance" type="number" value={form.lunchAllowance} onChange={onChange} placeholder="Lunch Allowance" className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Extra Sunday (₹/day)</label>
                <input name="extraSundayAllowance" type="number" value={form.extraSundayAllowance} onChange={onChange} placeholder="Extra Sunday" className="w-full p-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previous Advance (₹)</label>
                <input name="previousAdvance" type="number" value={form.previousAdvance} onChange={onChange} placeholder="Previous Advance" className="w-full p-2 border rounded" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                {editingId ? 'Update' : 'Add'} Staff Member
              </button>
              <button type="button" onClick={reset} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                {editingId ? 'Cancel' : 'Reset'}
              </button>
              
              <button
                type="button"
                onClick={handleMarkAllEmployeesAsActive}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Activating...' : 'Activate All Staff'}
              </button>
            </div>
          </form>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold text-gray-800">
                {activeTab === 'active' && 'Active Staff Members'}
                {activeTab === 'inactive' && 'Inactive Staff Members'}
                {activeTab === 'archived' && 'Archived Staff Members'}
              </h3>
            </div>
            
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading staff members...</div>
            ) : (() => {
              const currentEmployees = activeTab === 'active' ? employees : 
                                      activeTab === 'inactive' ? inactiveEmployees : 
                                      archivedEmployees;
              
              return currentEmployees.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <p>
                    {activeTab === 'active' && 'No active staff members found for this store.'}
                    {activeTab === 'inactive' && 'No inactive staff members found for this store.'}
                    {activeTab === 'archived' && 'No archived staff members found for this store.'}
                  </p>
                  <p className="text-sm mt-1">
                    {activeTab === 'active' && 'Add new staff members using the form above.'}
                    {activeTab === 'inactive' && 'No staff have been deactivated.'}
                    {activeTab === 'archived' && 'No staff have been archived.'}
                  </p>
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="p-3 text-left text-sm font-medium text-gray-700">Name</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700">Phone</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700">Email</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700">Role</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700">Salary (₹)</th>
                      <th className="p-3 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="p-3 text-sm text-gray-900">{employee.name}</td>
                        <td className="p-3 text-sm text-gray-900">{employee.phone}</td>
                        <td className="p-3 text-sm text-gray-900">{employee.email}</td>
                        <td className="p-3 text-sm">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                            {getRoleDisplayName(employee.role)}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-900">
                          {employee.salary ? `₹${employee.salary.toLocaleString()}` : '-'}
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex space-x-2">
                            {activeTab === 'active' && (
                              <>
                                <button 
                                  onClick={() => editRow(employee)} 
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleResetPassword(employee)}
                                  className="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                                  title="Reset Login Password"
                                >
                                  Reset Pwd
                                </button>
                                <button
                                  onClick={() => handleDeactivateEmployee(employee.email)}
                                  className="px-3 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
                                >
                                  Deactivate
                                </button>
                                <button
                                  onClick={() => handleArchiveEmployee(employee.email)}
                                  className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                >
                                  Archive
                                </button>
                              </>
                            )}
                            {activeTab === 'inactive' && (
                              <>
                                <button
                                  onClick={() => handleActivateEmployee(employee.email)}
                                  className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
                                >
                                  Activate
                                </button>
                                <button
                                  onClick={() => handleArchiveEmployee(employee.email)}
                                  className="px-3 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                                >
                                  Archive
                                </button>
                              </>
                            )}
                            {activeTab === 'archived' && (
                              <button
                                onClick={() => handleRestoreEmployee(employee.email)}
                                className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600"
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
        </>
      )}

      {/* Password Display Modal */}
      {showPasswordModal && newStaffCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Staff Created Successfully!</h3>
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
                      Staff account created successfully!
                    </h3>
                    <div className="mt-2 text-sm text-green-700">
                      <p>Please share these credentials with the staff member:</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Staff Name</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{newStaffCredentials.name}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Store</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{newStaffCredentials.storeBrand} — {newStaffCredentials.storeName}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{newStaffCredentials.email}</span>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{newStaffCredentials.password}</span>
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
                        <li>Share these credentials with the staff member</li>
                        <li>Staff can login immediately with these details</li>
                        <li>Staff should change password after first login</li>
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
  );
}
