import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import RequireRole from './components/RequireRole'
import Home from './pages/HomePublic'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Forgot from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import StoresAdmin from './pages/StoresAdmin'
import AdminManagers from './pages/AdminManagers'
import AdminEmployees from './pages/AdminEmployees'
import BulkUpload from './pages/BulkUpload'
import AdminSeed from './pages/AdminSeed'
import RokarEntry from './pages/RokarEntry'

export default function App(){
  return (
    <div>
      <Navbar/>
      <div className="mx-auto max-w-7xl px-6 pt-20 pb-10">
        <Routes>
          <Route path="/" element={<Home/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/signup" element={<Signup/>} />
          <Route path="/forgot-password" element={<Forgot/>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard/></ProtectedRoute>} />
          <Route path="/my-stores" element={<ProtectedRoute><StoresAdmin/></ProtectedRoute>} />
          <Route path="/admin-managers" element={<RequireRole allow={['ADMIN']}><AdminManagers/></RequireRole>} />
          <Route path="/admin-employees" element={<RequireRole allow={['ADMIN']}><AdminEmployees/></RequireRole>} />
          <Route path="/bulk-upload" element={<ProtectedRoute><BulkUpload/></ProtectedRoute>} />
          <Route path="/admin-seed" element={<RequireRole allow={['ADMIN']}><AdminSeed/></RequireRole>} />
          <Route path="/rokar-entry" element={<RequireRole allow={['ADMIN','MANAGER']}><RokarEntry/></RequireRole>} />
        </Routes>
      </div>
    </div>
  )
}