/**
 * Unified Assignment Utility
 * Handles assignment logic consistently across Tasks, Training, and Tests
 */

/**
 * Check if a user is assigned to an item (task, training, test)
 * @param {Object} item - The item to check assignment for
 * @param {Object} userProfile - The user's profile
 * @returns {boolean} - Whether the user is assigned
 */
export const isUserAssigned = (item, userProfile) => {
  if (!item || !userProfile) {
    console.log('Assignment check failed: Missing item or user profile', {
      hasItem: !!item,
      hasUserProfile: !!userProfile,
      itemId: item?.id,
      userEmail: userProfile?.email,
      userRole: userProfile?.role
    });
    return false;
  }

  console.log('Checking assignment:', {
    itemId: item.id,
    itemTitle: item.title,
    targetAudience: item.targetAudience,
    assignees: item.assignees,
    userEmail: userProfile.email,
    userRole: userProfile.role,
    assignedStore: userProfile.assignedStore
  });

  // Super Admin and Admin have access to everything
  if (userProfile.role === 'SUPER_ADMIN' || userProfile.role === 'ADMIN') {
    console.log('User is admin, granting access');
    return true;
  }

  // Check based on target audience
  switch (item.targetAudience) {
    case 'all_staff':
      const allStaffAccess = userProfile.role === 'STAFF' || userProfile.role === 'MANAGER';
      console.log('All staff check:', { userRole: userProfile.role, hasAccess: allStaffAccess });
      return allStaffAccess;

    case 'all_managers':
      const managerAccess = userProfile.role === 'MANAGER';
      console.log('Manager check:', { userRole: userProfile.role, hasAccess: managerAccess });
      return managerAccess;

    case 'location':
      const locationAccess = checkLocationAssignment(item, userProfile);
      console.log('Location check:', { 
        assignedStore: userProfile.assignedStore, 
        itemStores: item.assignedStores,
        hasAccess: locationAccess 
      });
      return locationAccess;

    case 'individual':
      const individualAccess = item.assignees && item.assignees.includes(userProfile.email);
      console.log('Individual check:', { 
        userEmail: userProfile.email, 
        assignees: item.assignees,
        hasAccess: individualAccess 
      });
      return individualAccess;

    default:
      // Fallback: check if user is in assignees list (for old trainings)
      if (item.assignees && Array.isArray(item.assignees)) {
        const fallbackAccess = item.assignees.includes(userProfile.email);
        console.log('Fallback assignees check:', { 
          userEmail: userProfile.email, 
          assignees: item.assignees,
          hasAccess: fallbackAccess 
        });
        return fallbackAccess;
      }
      // Additional fallback: check if user created the training
      if (item.createdBy === userProfile.email) {
        console.log('Creator access granted');
        return true;
      }
      console.log('No assignment found');
      return false;
  }
};

/**
 * Check location-based assignment
 * @param {Object} item - The item to check
 * @param {Object} userProfile - The user's profile
 * @returns {boolean} - Whether the user is assigned based on location
 */
const checkLocationAssignment = (item, userProfile) => {
  if (!item.assignedStores || !Array.isArray(item.assignedStores)) {
    return false;
  }

  if (userProfile.role === 'MANAGER') {
    // For managers, check if any of their assigned stores match
    const managerStores = getManagerStores(userProfile);
    return item.assignedStores.some(storeId => managerStores.includes(storeId));
  }

  if (userProfile.role === 'STAFF') {
    // For staff, check if their assigned store matches
    return item.assignedStores.includes(userProfile.assignedStore);
  }

  return false;
};

/**
 * Get manager's assigned stores
 * @param {Object} userProfile - The manager's profile
 * @returns {Array} - Array of store IDs
 */
const getManagerStores = (userProfile) => {
  if (!userProfile) return [];

  // If manager has assignedStore (single store)
  if (userProfile.assignedStore) {
    return [userProfile.assignedStore];
  }

  // If manager has stores object (multiple stores)
  if (userProfile.stores && typeof userProfile.stores === 'object') {
    return Object.keys(userProfile.stores).filter(key => userProfile.stores[key] === true);
  }

  return [];
};

/**
 * Filter items based on user assignment
 * @param {Array} items - Array of items to filter
 * @param {Object} userProfile - The user's profile
 * @returns {Array} - Filtered array of assigned items
 */
export const filterAssignedItems = (items, userProfile) => {
  if (!items || !Array.isArray(items)) {
    return [];
  }

  if (!userProfile) {
    return [];
  }

  return items.filter(item => isUserAssigned(item, userProfile));
};

/**
 * Get assignment summary for debugging
 * @param {Object} item - The item to analyze
 * @param {Object} userProfile - The user's profile
 * @returns {Object} - Assignment analysis
 */
export const getAssignmentSummary = (item, userProfile) => {
  return {
    itemId: item?.id,
    itemTitle: item?.title,
    targetAudience: item?.targetAudience,
    assignedStores: item?.assignedStores,
    assignees: item?.assignees,
    userRole: userProfile?.role,
    userEmail: userProfile?.email,
    userStore: userProfile?.assignedStore,
    isAssigned: isUserAssigned(item, userProfile)
  };
};
