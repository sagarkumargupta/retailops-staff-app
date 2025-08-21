import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const clearAllData = async () => {
  try {
    console.log('🚀 Starting data cleanup...');
    
    // Collections to clear
    const collectionsToClear = [
      'users',
      'stores', 
      'rokar',
      'invites',
      'attendance',
      'salary_requests',
      'leave_requests',
      'other_expenses',
      'tasks',
      'task_executions',
      'trainings',
      'training_completions',
      'tests',
      'test_results',
      'customers',
      'bulk_uploads',
      'reports',
      'opening_balances'
    ];

    let totalDeleted = 0;

    for (const collectionName of collectionsToClear) {
      try {
        console.log(`🗑️ Clearing collection: ${collectionName}`);
        
        const querySnapshot = await getDocs(collection(db, collectionName));
        let deletedCount = 0;
        
        for (const document of querySnapshot.docs) {
          // Skip the super admin user
          if (collectionName === 'users' && document.id === 'sagar.gupta56@gmail.com') {
            console.log(`✅ Keeping super admin user: ${document.id}`);
            continue;
          }
          
          await deleteDoc(doc(db, collectionName, document.id));
          deletedCount++;
        }
        
        console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
        totalDeleted += deletedCount;
        
      } catch (error) {
        console.error(`❌ Error clearing ${collectionName}:`, error);
      }
    }

    console.log(`🎉 Data cleanup completed! Total documents deleted: ${totalDeleted}`);
    console.log('✅ Super admin user (sagar.gupta56@gmail.com) has been preserved');
    
    return {
      success: true,
      totalDeleted,
      message: `Successfully cleared ${totalDeleted} documents. Super admin user preserved.`
    };
    
  } catch (error) {
    console.error('❌ Error during data cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to clear specific collection
export const clearCollection = async (collectionName) => {
  try {
    console.log(`🗑️ Clearing collection: ${collectionName}`);
    
    const querySnapshot = await getDocs(collection(db, collectionName));
    let deletedCount = 0;
    
    for (const document of querySnapshot.docs) {
      // Skip the super admin user if clearing users collection
      if (collectionName === 'users' && document.id === 'sagar.gupta56@gmail.com') {
        console.log(`✅ Keeping super admin user: ${document.id}`);
        continue;
      }
      
      await deleteDoc(doc(db, collectionName, document.id));
      deletedCount++;
    }
    
    console.log(`✅ Deleted ${deletedCount} documents from ${collectionName}`);
    return {
      success: true,
      deletedCount,
      message: `Successfully cleared ${deletedCount} documents from ${collectionName}`
    };
    
  } catch (error) {
    console.error(`❌ Error clearing ${collectionName}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};




