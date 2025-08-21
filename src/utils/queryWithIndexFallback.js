import { query, collection, where, orderBy, getDocs } from 'firebase/firestore';

/**
 * Execute a Firestore query with fallback for index errors
 * @param {Object} db - Firestore database instance
 * @param {string} collectionName - Name of the collection
 * @param {Array} conditions - Array of where conditions
 * @param {Array} orderByConditions - Array of orderBy conditions
 * @returns {Promise<Array>} - Array of documents
 */
export const executeQueryWithFallback = async (db, collectionName, conditions = [], orderByConditions = []) => {
  try {
    // Try the full query first
    let q = collection(db, collectionName);
    
    // Add where conditions
    conditions.forEach(condition => {
      q = query(q, where(condition.field, condition.operator, condition.value));
    });
    
    // Add orderBy conditions
    orderByConditions.forEach(orderByCondition => {
      q = query(q, orderBy(orderByCondition.field, orderByCondition.direction || 'desc'));
    });
    
    const snapshot = await getDocs(q);
    const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return documents;
  } catch (error) {
    console.log('Query failed, trying fallback:', error.message);
    
    // If it's an index error, try without orderBy
    if (error.message.includes('requires an index') && orderByConditions.length > 0) {
      try {
        console.log('Trying fallback without orderBy');
        let q = collection(db, collectionName);
        
        // Add where conditions
        conditions.forEach(condition => {
          q = query(q, where(condition.field, condition.operator, condition.value));
        });
        
        const snapshot = await getDocs(q);
        let documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort client-side
        documents = documents.sort((a, b) => {
          for (const orderByCondition of orderByConditions) {
            const field = orderByCondition.field;
            const direction = orderByCondition.direction || 'desc';
            
            let valueA = a[field];
            let valueB = b[field];
            
            // Handle Firestore timestamps
            if (valueA?.toDate) valueA = valueA.toDate();
            if (valueB?.toDate) valueB = valueB.toDate();
            
            // Convert to Date objects if they're date strings
            if (typeof valueA === 'string' && !isNaN(Date.parse(valueA))) {
              valueA = new Date(valueA);
            }
            if (typeof valueB === 'string' && !isNaN(Date.parse(valueB))) {
              valueB = new Date(valueB);
            }
            
            if (valueA < valueB) return direction === 'desc' ? 1 : -1;
            if (valueA > valueB) return direction === 'desc' ? -1 : 1;
          }
          return 0;
        });
        
        return documents;
      } catch (fallbackError) {
        console.error('Fallback query also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
};

/**
 * Execute a query for manager's assigned stores with fallback
 * @param {Object} db - Firestore database instance
 * @param {string} collectionName - Name of the collection
 * @param {Array} managerStoreIds - Array of store IDs the manager is assigned to
 * @param {string} orderByField - Field to order by (default: 'createdAt')
 * @returns {Promise<Array>} - Array of documents
 */
export const executeManagerStoreQuery = async (db, collectionName, managerStoreIds, orderByField = 'createdAt') => {
  if (!managerStoreIds || managerStoreIds.length === 0) {
    // If no stores assigned, load all documents
    return executeQueryWithFallback(db, collectionName, [], [{ field: orderByField, direction: 'desc' }]);
  }
  
  return executeQueryWithFallback(
    db,
    collectionName,
    [{ field: 'assignedStores', operator: 'array-contains-any', value: managerStoreIds }],
    [{ field: orderByField, direction: 'desc' }]
  );
};

/**
 * Helper function for common query patterns
 */
export const queryHelpers = {
  // Query attendance by staff email and date range
  attendanceByStaff: (staffEmail, startDate, endDate) => {
    return executeQueryWithFallback(
      'attendance',
      [
        { field: 'staffEmail', operator: '==', value: staffEmail },
        { field: 'date', operator: '>=', value: startDate },
        { field: 'date', operator: '<=', value: endDate }
      ],
      { field: 'date', direction: 'desc' }
    );
  },
  
  // Query rokar by store and date
  rokarByStore: (storeId, orderDirection = 'desc') => {
    return executeQueryWithFallback(
      'rokar',
      [{ field: 'storeId', operator: '==', value: storeId }],
      { field: 'date', direction: orderDirection }
    );
  },
  
  // Query tasks by assigned user
  tasksByUser: (assignedTo) => {
    return executeQueryWithFallback(
      'tasks',
      [{ field: 'assignedTo', operator: '==', value: assignedTo }],
      { field: 'createdAt', direction: 'desc' }
    );
  },
  
  // Query customers by status
  customersByStatus: (status) => {
    return executeQueryWithFallback(
      'customers',
      [{ field: 'status', operator: '==', value: status }],
      { field: 'name', direction: 'asc' }
    );
  }
};

