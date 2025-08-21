import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

// Default permissions for each role
export const getDefaultPermissions = (role) => {
  const permissions = {
    SUPER_ADMIN: {
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
      canCreateAdmins: true,
      canCreateOwners: true,
      canUseAITraining: true
    },
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
      canCreateManagers: true,
      canUseAITraining: true
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
      canCreateManagers: true,
      canUseAITraining: true
    },
    MANAGER: {
      canManageUsers: true,
      canManageStores: false,
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
      canCreateStaff: true,
      canUseAITraining: true
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

// Create a new user with proper hierarchical structure
export const createUser = async (userData) => {
  try {
    const { email, password, name, role, phone, assignedStore, assignedOwner, staffRole, salary } = userData;
    
    console.log('Creating Firebase Auth user for:', email);
    
    // Validate required fields
    if (!email || !password || !name || !role) {
      throw new Error('Missing required fields: email, password, name, and role are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password length (Firebase requirement)
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Create Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase(), password);
    
    // Prepare user profile data
    const userProfile = {
      email: email.toLowerCase(),
      name: name,
      role: role,
      phone: phone || '',
      createdAt: new Date(),
      isActive: true,
      permissions: getDefaultPermissions(role)
    };

         // Add role-specific data
     if (role === 'MANAGER') {
       userProfile.assignedStore = assignedStore || '';
       userProfile.assignedOwner = assignedOwner || '';
       
       // Set default store details (will be updated if store exists)
       userProfile.storeName = '';
       userProfile.storeBrand = '';
       userProfile.storeLocation = '';
       
       // Try to get store details if assignedStore exists
       if (assignedStore) {
         try {
           const storeDoc = await getDoc(doc(db, 'stores', assignedStore));
           if (storeDoc.exists()) {
             const storeData = storeDoc.data();
             userProfile.storeName = storeData.name || '';
             userProfile.storeBrand = storeData.brand || '';
             userProfile.storeLocation = storeData.location || '';
           }
         } catch (error) {
           console.warn('Could not fetch store details:', error);
           // Continue with empty store details
         }
       }
     } else if (role === 'STAFF') {
       userProfile.assignedStore = assignedStore || '';
       userProfile.staffRole = staffRole || 'STAFF';
       userProfile.salary = salary || 0;
       
       // Set default store details (will be updated if store exists)
       userProfile.storeName = '';
       userProfile.storeBrand = '';
       userProfile.storeLocation = '';
       
       // Try to get store details if assignedStore exists
       if (assignedStore) {
         try {
           const storeDoc = await getDoc(doc(db, 'stores', assignedStore));
           if (storeDoc.exists()) {
             const storeData = storeDoc.data();
             userProfile.storeName = storeData.name || '';
             userProfile.storeBrand = storeData.brand || '';
             userProfile.storeLocation = storeData.location || '';
           }
         } catch (error) {
           console.warn('Could not fetch store details:', error);
           // Continue with empty store details
         }
       }
     } else if (role === 'OWNER') {
       userProfile.assignedOwner = assignedOwner || '';
     }

    // Save user profile to Firestore
    await setDoc(doc(db, 'users', email.toLowerCase()), userProfile);

    // For staff, also add to store's staff subcollection for compatibility
    if (role === 'STAFF' && assignedStore) {
      const staffSubcollectionData = {
        name: name,
        email: email.toLowerCase(),
        phone: phone || '',
        role: staffRole || 'STAFF',
        salary: salary || 0,
        createdAt: new Date(),
        isActive: true
      };
      
      await setDoc(doc(collection(db, 'stores', assignedStore, 'staff')), staffSubcollectionData);
    }

    return {
      success: true,
      user: userCredential.user,
      profile: userProfile
    };
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Provide more specific error messages
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('A user with this email already exists');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address format');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters');
    } else if (error.code === 'auth/operation-not-allowed') {
      throw new Error('Email/password accounts are not enabled. Please contact administrator');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection');
    } else {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }
};

// Get stores for a specific owner
export const getStoresForOwner = async (ownerId) => {
  try {
    const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', ownerId));
    const storesSnap = await getDocs(storesQuery);
    return storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting stores for owner:', error);
    return [];
  }
};

// Get managers for a specific owner
export const getManagersForOwner = async (ownerId) => {
  try {
    const managersQuery = query(collection(db, 'users'), where('role', '==', 'MANAGER'), where('assignedOwner', '==', ownerId));
    const managersSnap = await getDocs(managersQuery);
    return managersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting managers for owner:', error);
    return [];
  }
};

// Get staff for a specific store
export const getStaffForStore = async (storeId) => {
  try {
    const staffQuery = query(collection(db, 'users'), where('role', '==', 'STAFF'), where('assignedStore', '==', storeId));
    const staffSnap = await getDocs(staffQuery);
    return staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting staff for store:', error);
    return [];
  }
};

// Update user profile
export const updateUserProfile = async (email, updates) => {
  try {
    await setDoc(doc(db, 'users', email.toLowerCase()), updates, { merge: true });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

// Delete user
export const deleteUser = async (email, role, assignedStore) => {
  try {
    // Delete from users collection
    await setDoc(doc(db, 'users', email.toLowerCase()), { isActive: false, deletedAt: new Date() });
    
    // If staff, also delete from store subcollection
    if (role === 'STAFF' && assignedStore) {
      const staffQuery = query(collection(db, 'stores', assignedStore, 'staff'), where('email', '==', email.toLowerCase()));
      const staffSnap = await getDocs(staffQuery);
      if (!staffSnap.empty) {
        await setDoc(doc(db, 'stores', assignedStore, 'staff', staffSnap.docs[0].id), { isActive: false, deletedAt: new Date() });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

// Check if user exists in Firestore but not in Auth, or vice versa
export const checkUserConsistency = async (email) => {
  try {
    const emailLower = email.toLowerCase();
    
    // Check if user exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', emailLower));
    const existsInFirestore = userDoc.exists();
    
    console.log(`User ${emailLower} exists in Firestore:`, existsInFirestore);
    
    if (existsInFirestore) {
      const userData = userDoc.data();
      console.log('User data in Firestore:', userData);
      return {
        exists: true,
        inFirestore: true,
        inAuth: true, // We can't directly check Auth, but if they can login, they exist
        userData: userData
      };
    } else {
      console.log(`User ${emailLower} does not exist in Firestore`);
      return {
        exists: false,
        inFirestore: false,
        inAuth: true, // Since we got the "already exists" error, they exist in Auth
        userData: null
      };
    }
  } catch (error) {
    console.error('Error checking user consistency:', error);
    throw error;
  }
};

// Update all users with missing AI training permissions
export const updateAllUsersWithAITrainingPermissions = async () => {
  try {
    console.log('Starting to update all users with AI training permissions...');
    
    // Get all users from Firestore
    const usersQuery = query(collection(db, 'users'));
    const usersSnap = await getDocs(usersQuery);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnap.docs) {
      try {
        const userData = userDoc.data();
        const userEmail = userDoc.id;
        
        // Get default permissions for the user's role
        const defaultPermissions = getDefaultPermissions(userData.role || 'STAFF');
        
        // Check if user already has permissions
        if (!userData.permissions) {
          // User has no permissions, add them
          await updateUserProfile(userEmail, {
            permissions: defaultPermissions
          });
          console.log(`Updated user ${userEmail} with permissions for role ${userData.role}`);
          updatedCount++;
        } else if (!userData.permissions.canUseAITraining) {
          // User has permissions but missing AI training permission
          const updatedPermissions = {
            ...userData.permissions,
            canUseAITraining: defaultPermissions.canUseAITraining
          };
          
          await updateUserProfile(userEmail, {
            permissions: updatedPermissions
          });
          console.log(`Updated user ${userEmail} with AI training permission`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating user ${userDoc.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`AI Training permissions update completed. Updated: ${updatedCount}, Errors: ${errorCount}`);
    return {
      success: true,
      updatedCount,
      errorCount
    };
    
  } catch (error) {
    console.error('Error updating users with AI training permissions:', error);
    throw error;
  }
};

// Fix orphaned user by creating Firestore profile
export const fixOrphanedUser = async (email, userData) => {
  try {
    const emailLower = email.toLowerCase();
    
    // Check if user already exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', emailLower));
    if (userDoc.exists()) {
      console.log(`User ${emailLower} already exists in Firestore`);
      return {
        success: true,
        message: 'User already exists in Firestore',
        userData: userDoc.data()
      };
    }
    
         // Create user profile in Firestore
     const userProfile = {
       email: emailLower,
       name: userData.name || 'Unknown User',
       role: userData.role || 'STAFF',
       phone: userData.phone || '',
       createdAt: new Date(),
       isActive: true,
       permissions: getDefaultPermissions(userData.role || 'STAFF'),
       assignedStore: userData.assignedStore || '',
       staffRole: userData.staffRole || 'STAFF',
       salary: userData.salary || 0,
       storeName: '',
       storeBrand: '',
       storeLocation: ''
     };
     
           // Try to get store details if assignedStore exists
      if (userData.assignedStore) {
        try {
          const storeDoc = await getDoc(doc(db, 'stores', userData.assignedStore));
          if (storeDoc.exists()) {
            const storeData = storeDoc.data();
            userProfile.storeName = storeData.name || '';
            userProfile.storeBrand = storeData.brand || '';
            userProfile.storeLocation = storeData.location || '';
          }
        } catch (storeError) {
          console.warn('Could not fetch store details:', storeError);
          // Continue with empty store details
        }
      }
    
    // Save to Firestore
    await setDoc(doc(db, 'users', emailLower), userProfile);
    
    // If it's a staff member, also add to store subcollection
    if (userData.role === 'STAFF' && userData.assignedStore) {
      const staffSubcollectionData = {
        name: userProfile.name,
        email: emailLower,
        phone: userProfile.phone,
        role: userData.staffRole || 'STAFF',
        salary: userData.salary || 0,
        createdAt: new Date(),
        isActive: true
      };
      
      await setDoc(doc(collection(db, 'stores', userData.assignedStore, 'staff')), staffSubcollectionData);
    }
    
    console.log(`Successfully created Firestore profile for ${emailLower}`);
    
    return {
      success: true,
      message: 'User profile created in Firestore',
      userData: userProfile
    };
  } catch (error) {
    console.error('Error fixing orphaned user:', error);
    throw error;
  }
};

// Remove orphaned Auth user (use with caution)
export const removeOrphanedAuthUser = async (email) => {
  try {
    // This would require Admin SDK, but for now we'll just mark as inactive in Firestore
    const emailLower = email.toLowerCase();
    
    await setDoc(doc(db, 'users', emailLower), {
      isActive: false,
      deletedAt: new Date(),
      deletionReason: 'Orphaned Auth user - no Firestore profile'
    }, { merge: true });
    
    console.log(`Marked orphaned user ${emailLower} as inactive`);
    
    return {
      success: true,
      message: 'User marked as inactive'
    };
  } catch (error) {
    console.error('Error removing orphaned user:', error);
    throw error;
  }
};

// User Status Management Functions
export const deactivateUser = async (email, reason = 'Admin deactivation') => {
  try {
    const emailLower = email.toLowerCase();
    
    // Update user status in Firestore
    await updateDoc(doc(db, 'users', emailLower), {
      isActive: false,
      deactivatedAt: serverTimestamp(),
      deactivatedBy: auth.currentUser?.email || 'System',
      deactivationReason: reason,
      status: 'INACTIVE'
    });
    
    console.log(`User ${emailLower} deactivated successfully`);
    
    return {
      success: true,
      message: 'User deactivated successfully'
    };
  } catch (error) {
    console.error('Error deactivating user:', error);
    throw error;
  }
};

export const activateUser = async (email) => {
  try {
    const emailLower = email.toLowerCase();
    
    // Update user status in Firestore
    await updateDoc(doc(db, 'users', emailLower), {
      isActive: true,
      activatedAt: serverTimestamp(),
      activatedBy: auth.currentUser?.email || 'System',
      deactivatedAt: null,
      deactivatedBy: null,
      deactivationReason: null,
      status: 'ACTIVE'
    });
    
    console.log(`User ${emailLower} activated successfully`);
    
    return {
      success: true,
      message: 'User activated successfully'
    };
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
};

export const archiveUser = async (email) => {
  try {
    const emailLower = email.toLowerCase();
    
    // Get current user data
    const userDoc = await getDoc(doc(db, 'users', emailLower));
    if (!userDoc.exists()) {
      throw new Error('User not found');
    }
    
    const userData = userDoc.data();
    
    // Create archive entry
    const archiveData = {
      ...userData,
      archivedAt: serverTimestamp(),
      archivedBy: auth.currentUser?.email || 'System',
      originalEmail: emailLower,
      archiveReason: '7 days inactive'
    };
    
    // Save to archive collection
    await setDoc(doc(db, 'archived_users', emailLower), archiveData);
    
    // Remove from active users (or keep with archived flag)
    await updateDoc(doc(db, 'users', emailLower), {
      isArchived: true,
      archivedAt: serverTimestamp(),
      archivedBy: auth.currentUser?.email || 'System'
    });
    
    console.log(`User ${emailLower} archived successfully`);
    
    return {
      success: true,
      message: 'User archived successfully'
    };
  } catch (error) {
    console.error('Error archiving user:', error);
    throw error;
  }
};

export const restoreUser = async (email) => {
  try {
    const emailLower = email.toLowerCase();
    
    // Get archived user data
    const archivedDoc = await getDoc(doc(db, 'archived_users', emailLower));
    if (!archivedDoc.exists()) {
      throw new Error('Archived user not found');
    }
    
    const archivedData = archivedDoc.data();
    
    // Restore to active users
    const restoredData = {
      ...archivedData,
      isActive: true,
      isArchived: false,
      restoredAt: serverTimestamp(),
      restoredBy: auth.currentUser?.email || 'System',
      status: 'ACTIVE'
    };
    
    // Remove archive-specific fields
    delete restoredData.archivedAt;
    delete restoredData.archivedBy;
    delete restoredData.originalEmail;
    delete restoredData.archiveReason;
    
    // Save back to users collection
    await setDoc(doc(db, 'users', emailLower), restoredData);
    
    // Remove from archive
    await deleteDoc(doc(db, 'archived_users', emailLower));
    
    console.log(`User ${emailLower} restored successfully`);
    
    return {
      success: true,
      message: 'User restored successfully'
    };
  } catch (error) {
    console.error('Error restoring user:', error);
    throw error;
  }
};

// Get users by status
export const getUsersByStatus = async (status = 'ACTIVE') => {
  try {
    let usersQuery;
    
    if (status === 'ARCHIVED') {
      // Get from archived_users collection
      const archivedSnap = await getDocs(collection(db, 'archived_users'));
      return archivedSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else if (status === 'ACTIVE') {
      // For active users, check both status field and isActive field
      // Get all users and filter them
      const allUsersSnap = await getDocs(collection(db, 'users'));
      const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter for active users (either status === 'ACTIVE' or isActive === true)
      const activeUsers = allUsers.filter(user => 
        (user.status === 'ACTIVE' || user.isActive === true) && 
        user.status !== 'INACTIVE' && 
        user.isActive !== false
      );
      
      return activeUsers;
    } else if (status === 'INACTIVE') {
      // For inactive users, check both status field and isActive field
      const allUsersSnap = await getDocs(collection(db, 'users'));
      const allUsers = allUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Filter for inactive users (either status === 'INACTIVE' or isActive === false)
      const inactiveUsers = allUsers.filter(user => 
        user.status === 'INACTIVE' || user.isActive === false
      );
      
      return inactiveUsers;
    } else {
      // Fallback to status field only
      usersQuery = query(
        collection(db, 'users'),
        where('status', '==', status)
      );
      const usersSnap = await getDocs(usersQuery);
      return usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  } catch (error) {
    console.error('Error getting users by status:', error);
    return [];
  }
};

// Check for users to archive (7 days inactive)
export const checkForArchiveCandidates = async () => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const inactiveUsersQuery = query(
      collection(db, 'users'),
      where('isActive', '==', false),
      where('deactivatedAt', '<', sevenDaysAgo)
    );
    
    const inactiveSnap = await getDocs(inactiveUsersQuery);
    const archiveCandidates = inactiveSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${archiveCandidates.length} users eligible for archiving`);
    
    return archiveCandidates;
  } catch (error) {
    console.error('Error checking for archive candidates:', error);
    return [];
  }
};

// Mark all managers as active
export const markAllManagersAsActive = async () => {
  try {
    console.log('Starting to mark all managers as active...');
    
    // Get all users with MANAGER role
    const managersQuery = query(
      collection(db, 'users'),
      where('role', '==', 'MANAGER')
    );
    
    const managersSnap = await getDocs(managersQuery);
    const managers = managersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${managers.length} managers to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Update each manager
    for (const manager of managers) {
      try {
        // Check if manager needs updating (not already active)
        if (manager.isActive === false || manager.status === 'INACTIVE') {
          await updateDoc(doc(db, 'users', manager.id), {
            isActive: true,
            status: 'ACTIVE',
            activatedAt: serverTimestamp(),
            activatedBy: auth.currentUser?.email || 'System',
            deactivatedAt: null,
            deactivatedBy: null,
            deactivationReason: null
          });
          updatedCount++;
          console.log(`Updated manager: ${manager.email}`);
        } else {
          skippedCount++;
          console.log(`Skipped manager (already active): ${manager.email}`);
        }
      } catch (error) {
        console.error(`Error updating manager ${manager.email}:`, error);
      }
    }
    
    console.log(`Mark all managers as active completed. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
    
    return {
      success: true,
      message: `Successfully marked ${updatedCount} managers as active. ${skippedCount} were already active.`,
      updatedCount,
      skippedCount,
      totalManagers: managers.length
    };
  } catch (error) {
    console.error('Error marking all managers as active:', error);
    throw error;
  }
};

// Mark all staff as active
export const markAllStaffAsActive = async (storeId = null) => {
  try {
    console.log('Starting to mark all staff as active...');
    
    // Get all users with STAFF role
    let staffQuery;
    if (storeId) {
      // If storeId provided, get staff for specific store
      staffQuery = query(
        collection(db, 'users'),
        where('role', '==', 'STAFF'),
        where('assignedStore', '==', storeId)
      );
    } else {
      // Get all staff
      staffQuery = query(
        collection(db, 'users'),
        where('role', '==', 'STAFF')
      );
    }
    
    const staffSnap = await getDocs(staffQuery);
    const staff = staffSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${staff.length} staff to update`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Update each staff member
    for (const staffMember of staff) {
      try {
        // Check if staff needs updating (not already active)
        if (staffMember.isActive === false || staffMember.status === 'INACTIVE') {
          await updateDoc(doc(db, 'users', staffMember.id), {
            isActive: true,
            status: 'ACTIVE',
            activatedAt: serverTimestamp(),
            activatedBy: auth.currentUser?.email || 'System',
            deactivatedAt: null,
            deactivatedBy: null,
            deactivationReason: null
          });
          updatedCount++;
          console.log(`Updated staff: ${staffMember.email}`);
        } else {
          skippedCount++;
          console.log(`Skipped staff (already active): ${staffMember.email}`);
        }
      } catch (error) {
        console.error(`Error updating staff ${staffMember.email}:`, error);
      }
    }
    
    console.log(`Mark all staff as active completed. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
    
    return {
      success: true,
      message: `Successfully marked ${updatedCount} staff as active. ${skippedCount} were already active.`,
      updatedCount,
      skippedCount,
      totalStaff: staff.length
    };
  } catch (error) {
    console.error('Error marking all staff as active:', error);
    throw error;
  }
};

