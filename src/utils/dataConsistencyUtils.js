/**
 * Data Consistency Utilities
 * Ensures consistent data structure and prevents duplicates across all modules
 */

import { isUserAssigned } from './assignmentUtils';

/**
 * Standardize assignment data structure
 * @param {Object} item - Task, Training, or Test item
 * @returns {Object} - Standardized item with unified assignment fields
 */
export const standardizeAssignmentData = (item) => {
  if (!item) return null;

  // Ensure we have the unified targetAudience field
  const standardized = {
    ...item,
    targetAudience: item.targetAudience || item.assignTo || 'all_staff'
  };

  // Ensure assignees is always an array
  if (!standardized.assignees || !Array.isArray(standardized.assignees)) {
    standardized.assignees = [];
  }

  // Ensure assignedStores is always an array
  if (!standardized.assignedStores || !Array.isArray(standardized.assignedStores)) {
    standardized.assignedStores = [];
  }

  // Ensure completedBy is always an array
  if (!standardized.completedBy || !Array.isArray(standardized.completedBy)) {
    standardized.completedBy = [];
  }

  return standardized;
};

/**
 * Validate data structure consistency
 * @param {Object} item - Item to validate
 * @param {string} itemType - Type of item ('task', 'training', 'test')
 * @returns {Object} - Validation result with errors array
 */
export const validateDataStructure = (item, itemType) => {
  const errors = [];
  
  if (!item) {
    errors.push('Item is null or undefined');
    return { isValid: false, errors };
  }

  // Required fields
  const requiredFields = ['title', 'createdBy', 'createdAt'];
  requiredFields.forEach(field => {
    if (!item[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Assignment validation
  if (!item.targetAudience && !item.assignTo) {
    errors.push('Missing assignment information (targetAudience or assignTo)');
  }

  // Array field validation
  const arrayFields = ['assignees', 'assignedStores', 'completedBy'];
  arrayFields.forEach(field => {
    if (item[field] && !Array.isArray(item[field])) {
      errors.push(`${field} must be an array`);
    }
  });

  // Type-specific validation
  switch (itemType) {
    case 'task':
      if (item.hasSteps && (!item.steps || !Array.isArray(item.steps))) {
        errors.push('Task with steps must have steps array');
      }
      break;
    case 'training':
      if (!item.content && !item.videoUrl) {
        errors.push('Training must have content or videoUrl');
      }
      break;
    case 'test':
      if (!item.questions || !Array.isArray(item.questions) || item.questions.length === 0) {
        errors.push('Test must have questions array');
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Remove duplicate items based on unique identifiers
 * @param {Array} items - Array of items to deduplicate
 * @param {string} idField - Field to use as unique identifier (default: 'id')
 * @returns {Array} - Deduplicated array
 */
export const removeDuplicates = (items, idField = 'id') => {
  if (!Array.isArray(items)) return [];
  
  const seen = new Set();
  return items.filter(item => {
    const id = item[idField];
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
};

/**
 * Merge duplicate items with conflict resolution
 * @param {Array} items - Array of items that may have duplicates
 * @param {string} idField - Field to use as unique identifier
 * @param {Function} mergeStrategy - Function to merge conflicting items
 * @returns {Array} - Merged array without duplicates
 */
export const mergeDuplicates = (items, idField = 'id', mergeStrategy = null) => {
  if (!Array.isArray(items)) return [];
  
  const grouped = items.reduce((acc, item) => {
    const id = item[idField];
    if (!acc[id]) {
      acc[id] = [];
    }
    acc[id].push(item);
    return acc;
  }, {});

  return Object.values(grouped).map(group => {
    if (group.length === 1) {
      return group[0];
    }
    
    if (mergeStrategy) {
      return mergeStrategy(group);
    }
    
    // Default merge strategy: keep the most recent item
    return group.sort((a, b) => {
      const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(a.updatedAt || 0);
      const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(b.updatedAt || 0);
      return dateB - dateA;
    })[0];
  });
};

/**
 * Normalize user data for consistency
 * @param {Object} user - User object to normalize
 * @returns {Object} - Normalized user object
 */
export const normalizeUserData = (user) => {
  if (!user) return null;

  return {
    ...user,
    email: user.email?.toLowerCase() || '',
    role: user.role?.toUpperCase() || 'STAFF',
    assignedStore: user.assignedStore || null,
    assignedOwner: user.assignedOwner || null,
    permissions: user.permissions || {},
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
};

/**
 * Normalize store data for consistency
 * @param {Object} store - Store object to normalize
 * @returns {Object} - Normalized store object
 */
export const normalizeStoreData = (store) => {
  if (!store) return null;

  return {
    ...store,
    name: store.name || '',
    brand: store.brand || '',
    city: store.city || '',
    address: store.address || '',
    manager: store.manager || null,
    staff: store.staff || [],
    createdAt: store.createdAt || null,
    updatedAt: store.updatedAt || null
  };
};

/**
 * Check for data inconsistencies across collections
 * @param {Object} collections - Object containing different collections
 * @returns {Object} - Inconsistency report
 */
export const checkDataInconsistencies = (collections) => {
  const inconsistencies = [];

  // Check for orphaned references
  if (collections.users && collections.stores) {
    const userEmails = new Set(collections.users.map(u => u.email));
    const storeIds = new Set(collections.stores.map(s => s.id));

    // Check for users referencing non-existent stores
    collections.users.forEach(user => {
      if (user.assignedStore && !storeIds.has(user.assignedStore)) {
        inconsistencies.push({
          type: 'orphaned_reference',
          collection: 'users',
          field: 'assignedStore',
          value: user.assignedStore,
          itemId: user.email,
          description: `User ${user.email} references non-existent store ${user.assignedStore}`
        });
      }
    });

    // Check for stores referencing non-existent managers
    collections.stores.forEach(store => {
      if (store.manager && !userEmails.has(store.manager)) {
        inconsistencies.push({
          type: 'orphaned_reference',
          collection: 'stores',
          field: 'manager',
          value: store.manager,
          itemId: store.id,
          description: `Store ${store.name} references non-existent manager ${store.manager}`
        });
      }
    });
  }

  // Check for duplicate emails in users
  if (collections.users) {
    const emailCounts = {};
    collections.users.forEach(user => {
      const email = user.email?.toLowerCase();
      if (email) {
        emailCounts[email] = (emailCounts[email] || 0) + 1;
      }
    });

    Object.entries(emailCounts).forEach(([email, count]) => {
      if (count > 1) {
        inconsistencies.push({
          type: 'duplicate_email',
          collection: 'users',
          value: email,
          count,
          description: `Duplicate email ${email} found ${count} times`
        });
      }
    });
  }

  return {
    hasInconsistencies: inconsistencies.length > 0,
    inconsistencies,
    count: inconsistencies.length
  };
};

/**
 * Generate data consistency report
 * @param {Object} collections - Collections to analyze
 * @returns {Object} - Comprehensive consistency report
 */
export const generateConsistencyReport = (collections) => {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalCollections: Object.keys(collections).length,
      totalItems: 0,
      inconsistencies: 0
    },
    collections: {},
    inconsistencies: checkDataInconsistencies(collections)
  };

  // Analyze each collection
  Object.entries(collections).forEach(([collectionName, items]) => {
    if (!Array.isArray(items)) return;

    const collectionReport = {
      count: items.length,
      validItems: 0,
      invalidItems: 0,
      errors: []
    };

    items.forEach((item, index) => {
      const validation = validateDataStructure(item, collectionName.slice(0, -1)); // Remove 's' from collection name
      if (validation.isValid) {
        collectionReport.validItems++;
      } else {
        collectionReport.invalidItems++;
        collectionReport.errors.push({
          index,
          itemId: item.id || item.email || index,
          errors: validation.errors
        });
      }
    });

    report.collections[collectionName] = collectionReport;
    report.summary.totalItems += items.length;
  });

  report.summary.inconsistencies = report.inconsistencies.count;

  return report;
};

/**
 * Clean and standardize data for a collection
 * @param {Array} items - Items to clean
 * @param {string} itemType - Type of items
 * @returns {Array} - Cleaned and standardized items
 */
export const cleanCollectionData = (items, itemType) => {
  if (!Array.isArray(items)) return [];

  return items
    .filter(item => item !== null && item !== undefined)
    .map(item => standardizeAssignmentData(item))
    .filter(item => {
      const validation = validateDataStructure(item, itemType);
      return validation.isValid;
    });
};

export default {
  standardizeAssignmentData,
  validateDataStructure,
  removeDuplicates,
  mergeDuplicates,
  normalizeUserData,
  normalizeStoreData,
  checkDataInconsistencies,
  generateConsistencyReport,
  cleanCollectionData
};
