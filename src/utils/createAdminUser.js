import { doc, setDoc, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth } from '../firebase';

export async function ensureAdminUserExists() {
  try {
    const adminEmail = 'sagar.gupta56@gmail.com';
    const adminPassword = 'sagar123';
    
    // Check if user exists in Firestore
    const userDocRef = doc(db, 'users', adminEmail);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      console.log('Creating Super Admin user...');
      
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      
      // Create user profile in Firestore
      const adminProfile = {
        name: 'Super Admin',
        email: adminEmail,
        role: 'SUPER_ADMIN',
        isActive: true,
        createdAt: new Date(),
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
          canAccessAllStores: true,
          canCreateManagers: true,
          canCreateStaff: true
        }
      };
      
      await setDoc(userDocRef, adminProfile);
      console.log('Super Admin user created successfully!');
      console.log('Email:', adminEmail);
      console.log('Password:', adminPassword);
    } else {
      console.log('Super Admin user already exists');
      
      // Update existing user to ensure correct role
      const existingData = userDoc.data();
      if (existingData.role !== 'SUPER_ADMIN') {
        console.log('Updating user role to SUPER_ADMIN...');
        await setDoc(userDocRef, {
          ...existingData,
          role: 'SUPER_ADMIN',
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
            canAccessAllStores: true,
            canCreateManagers: true,
            canCreateStaff: true
          }
        }, { merge: true });
        console.log('User role updated to SUPER_ADMIN');
      }
    }
  } catch (error) {
    console.error('Error ensuring admin user exists:', error);
  }
}
