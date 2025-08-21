// Script to create admin user in Firebase
// Run this in browser console or as a separate script

import { doc, setDoc } from 'firebase/firestore';
import { db } from './src/firebase';

const createAdminUser = async () => {
  try {
    const adminProfile = {
      email: 'admin@retailops.com',
      name: 'Admin User',
      role: 'ADMIN',
      stores: {},
      createdAt: new Date(),
      isActive: true,
      permissions: {
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
        canAccessAllStores: true
      }
    };

    await setDoc(doc(db, 'users', 'admin@retailops.com'), adminProfile);
    console.log('Admin user created successfully!');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Uncomment to run
// createAdminUser();




