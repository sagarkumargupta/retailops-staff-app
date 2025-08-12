import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth } from '../firebase'
import { signOut } from 'firebase/auth'
import { useAuthState } from 'react-firebase-hooks/auth'
import useUserProfile from '../hooks/useUserProfile'
export default function Navbar(){
  const [user]=useAuthState(auth)
  const { profile } = useUserProfile()
  const nav=useNavigate()
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur ring-1 ring-slate-200">
      <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-extrabold">RetailOps</Link>
        <div className="hidden md:flex gap-4">
          {!user && (<Link to="/">Home</Link>)}
          {user && (<>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/rokar-entry">Rokar Entry</Link>
            <Link to="/bulk-upload">Bulk</Link>
            <Link to="/my-stores">Stores</Link>
            {profile?.role === 'ADMIN' && <Link to="/admin-managers">Managers</Link>}
            {profile?.role === 'ADMIN' && <Link to="/admin-employees">Employees</Link>}
            {profile?.role === 'ADMIN' && <Link to="/admin-seed">Seed Jan</Link>}
          </>)}
        </div>
        <div className="flex gap-3">
          {!user ? (<>
            <Link to="/login" className="px-3 py-1.5 bg-blue-600 text-white rounded">Login</Link>
            <Link to="/signup" className="px-3 py-1.5 border border-blue-600 text-blue-600 rounded">Sign Up</Link>
          </>) : (<button onClick={()=>{signOut(auth); nav('/login')}} className="px-3 py-1.5 bg-red-500 text-white rounded">Logout</button>)}
        </div>
      </div>
    </nav>
  )
}