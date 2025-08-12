import React from 'react'
import { Navigate } from 'react-router-dom'
import useUserProfile from '../hooks/useUserProfile'
export default function RequireRole({allow=[],children}){
  const { user, profile, loading } = useUserProfile()
  if(!user) return <Navigate to="/login" replace />
  if(loading) return <div className="p-6">Loading…</div>
  if(!profile || !allow.includes(profile.role)) return <Navigate to="/dashboard" replace />
  return children
}