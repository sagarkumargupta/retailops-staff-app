import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Add a new staff member to a store and create user record
 */
export const addStaffMember = async (storeId, staffData) => {
  try {
    // 1. Add to stores/{storeId}/staff collection
    const staffRef = doc(collection(db, 'stores', storeId, 'staff'));
    const staffDocData = {
      ...staffData,
      email: staffData.email.toLowerCase(),
      createdAt: new Date()
    };
    
    await setDoc(staffRef, staffDocData);
    
    // 2. Create user record with email-based ID
    const userEmailKey = staffData.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    const userData = {
      email: staffData.email.toLowerCase(),
      displayName: staffData.name,
      role: staffData.role || 'SALESMAN',
      stores: { [storeId]: true },
      staffId: staffRef.id,
      storeId: storeId,
      name: staffData.name,
      phone: staffData.phone,
      salary: Number(staffData.salary) || 0,
      leaveDays: Number(staffData.leaveDays) || 0,
      lunchAllowance: Number(staffData.lunchAllowance) || 0,
      extraSundayAllowance: Number(staffData.extraSundayAllowance) || 0,
      previousAdvance: Number(staffData.previousAdvance) || 0,
      createdAt: new Date()
    };
    
    await setDoc(doc(db, 'users', userEmailKey), userData);
    
    return { success: true, staffId: staffRef.id, userId: userEmailKey };
  } catch (error) {
    console.error('Error adding staff member:', error);
    throw error;
  }
};

/**
 * Find staff member by email
 */
export const findStaffByEmail = async (email) => {
  try {
    const storesSnap = await getDocs(collection(db, 'stores'));
    
    for (const storeDoc of storesSnap.docs) {
      const staffSnap = await getDocs(collection(db, 'stores', storeDoc.id, 'staff'));
      const staffDoc = staffSnap.docs.find(doc => 
        doc.data().email === email.toLowerCase()
      );
      
      if (staffDoc) {
        return {
          id: staffDoc.id,
          storeId: storeDoc.id,
          store: storeDoc.data(),
          ...staffDoc.data()
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding staff by email:', error);
    throw error;
  }
};

/**
 * Get staff member's user record
 */
export const getStaffUserRecord = async (email) => {
  try {
    const userEmailKey = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
    const userRef = doc(db, 'users', userEmailKey);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting staff user record:', error);
    throw error;
  }
};

/**
 * Update staff member data
 */
export const updateStaffMember = async (storeId, userDocId, updatedData, originalEmail = null) => {
  try {
    console.log('Updating staff member:', { storeId, userDocId, updatedData, originalEmail });
    
    // The userDocId is the document ID from the users collection (email-based)
    // We'll work directly with the users collection
    
    // If email has changed and we have the original email
    if (originalEmail && originalEmail.toLowerCase() !== updatedData.email.toLowerCase()) {
      console.log('Email changed, migrating user document...');
      
      const newEmailKey = updatedData.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      
      console.log('Using userDocId as original document ID:', userDocId);
      console.log('New email key will be:', newEmailKey);
      
      // Get the original user document using the userDocId (which is the current document ID)
      const originalUserRef = doc(db, 'users', userDocId);
      console.log('Looking for original user document at path:', `users/${userDocId}`);
      
      const originalUserSnap = await getDoc(originalUserRef);
      console.log('Original user document exists:', originalUserSnap.exists());
      
      if (originalUserSnap.exists()) {
        const userData = originalUserSnap.data();
        
        // Create new user document with updated email
        const updatedUserData = {
          ...userData,
          email: updatedData.email.toLowerCase(),
          name: updatedData.name,
          phone: updatedData.phone,
          role: updatedData.role,
          salary: Number(updatedData.salary) || 0,
          leaveDays: Number(updatedData.leaveDays) || 0,
          lunchAllowance: Number(updatedData.lunchAllowance) || 0,
          extraSundayAllowance: Number(updatedData.extraSundayAllowance) || 0,
          previousAdvance: Number(updatedData.previousAdvance) || 0,
          updatedAt: new Date()
        };
        
        // Create new document with new email key
        const newUserRef = doc(db, 'users', newEmailKey);
        await setDoc(newUserRef, updatedUserData);
        console.log('Created new user document:', newEmailKey, updatedUserData);
        
        // Mark old document as deleted
        await setDoc(originalUserRef, { 
          deleted: true, 
          deletedAt: new Date(),
          movedTo: newEmailKey 
        }, { merge: true });
        console.log('Marked old user document as deleted:', userDocId);
      } else {
        console.error('Original user document not found:', userDocId);
        throw new Error('Original user document not found');
      }
    } else {
      console.log('Email not changed, updating existing document...');
      
      // Email hasn't changed, just update the existing document
      const userRef = doc(db, 'users', userDocId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const updatedUserData = {
          ...userData,
          name: updatedData.name,
          phone: updatedData.phone,
          role: updatedData.role,
          email: updatedData.email.toLowerCase(), // Ensure email is lowercase
          salary: Number(updatedData.salary) || 0,
          leaveDays: Number(updatedData.leaveDays) || 0,
          lunchAllowance: Number(updatedData.lunchAllowance) || 0,
          extraSundayAllowance: Number(updatedData.extraSundayAllowance) || 0,
          previousAdvance: Number(updatedData.previousAdvance) || 0,
          updatedAt: new Date()
        };
        
        await setDoc(userRef, updatedUserData, { merge: true });
        console.log('Updated existing user document:', userDocId, updatedUserData);
      } else {
        console.error('User document not found:', userDocId);
        throw new Error('User document not found');
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating staff member:', error);
    throw error;
  }
};

/**
 * Delete staff member
 */
export const deleteStaffMember = async (storeId, staffId, email) => {
  try {
    // Delete from staff collection
    const staffRef = doc(db, 'stores', storeId, 'staff', staffId);
    await setDoc(staffRef, { deleted: true, deletedAt: new Date() }, { merge: true });
    
    // Delete from users collection
    if (email) {
      const userEmailKey = email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_');
      const userRef = doc(db, 'users', userEmailKey);
      await setDoc(userRef, { deleted: true, deletedAt: new Date() }, { merge: true });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting staff member:', error);
    throw error;
  }
};

