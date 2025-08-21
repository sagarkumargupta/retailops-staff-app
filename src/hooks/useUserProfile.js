import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';

export default function useUserProfile() {
  const [user, userLoading] = useAuthState(auth);
  const [profile, setProfile] = useState(null);
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setHasProfile(false);
      return;
    }

    const userEmail = user.email.toLowerCase();
    const userDocRef = doc(db, 'users', userEmail);

    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setProfile(userData);
        setHasProfile(true);
      } else {
        setProfile(null);
        setHasProfile(false);
      }
    }, (error) => {
      console.error('Error fetching user profile:', error);
      setProfile(null);
      setHasProfile(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Helper function to check if user has a specific permission
  const hasPermission = (permission) => {
    if (!profile || !profile.permissions) return false;
    return profile.permissions[permission] === true;
  };

  // Helper function to check if user can access a specific store
  const canAccessStore = (storeId) => {
    if (!profile) return false;
    
    if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'OWNER') {
      return true;
    }
    
    if (profile.role === 'MANAGER' && profile.assignedStore === storeId) {
      return true;
    }
    
    if (profile.role === 'STAFF' && profile.assignedStore === storeId) {
      return true;
    }
    
    return false;
  };

  // Helper function to check if user can access owner's data
  const canAccessOwner = (ownerId) => {
    if (!profile) return false;
    
    if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'OWNER') {
      return true;
    }
    
    if (profile.role === 'MANAGER' && profile.assignedOwner === ownerId) {
      return true;
    }
    
    return false;
  };

  // Helper function to get user's assigned store
  const getAssignedStore = () => {
    if (!profile) return null;
    return profile.assignedStore;
  };

  // Helper function to get user's assigned owner
  const getAssignedOwner = () => {
    if (!profile) return null;
    return profile.assignedOwner;
  };

  // Helper function to get user's store name
  const getStoreName = () => {
    if (!profile) return null;
    return profile.storeName;
  };

  // Helper function to get user's store brand
  const getStoreBrand = () => {
    if (!profile) return null;
    return profile.storeBrand;
  };

  // Helper function to get user's store location
  const getStoreLocation = () => {
    if (!profile) return null;
    return profile.storeLocation;
  };

  // Helper function to get all stores user can access (for backward compatibility)
  const getAssignedStores = () => {
    if (!profile) return [];
    
    if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'OWNER') {
      return []; // These roles can access all stores, so return empty array to indicate "all"
    }
    
    if (profile.role === 'MANAGER' && profile.assignedStore) {
      return [profile.assignedStore];
    }
    
    if (profile.role === 'STAFF' && profile.assignedStore) {
      return [profile.assignedStore];
    }
    
    return [];
  };

  // Helper function to check if user can access all stores
  const canAccessAllStores = () => {
    if (!profile) return false;
    return profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'OWNER';
  };

  // Helper function to get stores for filtering (for backward compatibility with old code)
  const getStoresForFiltering = () => {
    if (!profile) return [];
    
    if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'OWNER') {
      return []; // These roles can access all stores
    }
    
    if (profile.role === 'MANAGER' && profile.assignedStore) {
      return [profile.assignedStore];
    }
    
    if (profile.role === 'STAFF' && profile.assignedStore) {
      return [profile.assignedStore];
    }
    
    return [];
  };

  return {
    profile,
    hasProfile,
    userLoading,
    hasPermission,
    canAccessStore,
    canAccessOwner,
    getAssignedStore,
    getAssignedOwner,
    getStoreName,
    getStoreBrand,
    getStoreLocation,
    getAssignedStores,
    canAccessAllStores,
    getStoresForFiltering
  };
}