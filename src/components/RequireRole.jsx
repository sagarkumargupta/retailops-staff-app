import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '../firebase'
import useUserProfile from '../hooks/useUserProfile'

export default function RequireRole({allow=[],children}){
  const [user, userLoading] = useAuthState(auth)
  const { profile, hasProfile } = useUserProfile()
  
  // Debug logging
  console.log('RequireRole Debug:', {
    user: user?.email,
    userLoading,
    profile: profile?.role,
    hasProfile,
    allowedRoles: allow,
    profileData: profile
  });
  
  // Show loading while user or profile is loading
  if(userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user profile...</p>
        </div>
      </div>
    );
  }
  
  // Redirect to login if no user
  if(!user) {
    console.log('No user, redirecting to login');
    return <Navigate to="/login" replace />
  }
  
  // Show loading while profile is being fetched
  if(!hasProfile && profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user permissions...</p>
        </div>
      </div>
    );
  }
  
  // Check if user has profile and role
  if(!profile || !profile.role) {
    console.log('No profile or role, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />
  }
  
  // Check if user's role is allowed
  if(!allow.includes(profile.role)) {
    console.log('Role not allowed, redirecting to dashboard. User role:', profile.role, 'Allowed roles:', allow);
    return <Navigate to="/dashboard" replace />
  }
  
  console.log('Access granted for role:', profile.role);
  return children;
}