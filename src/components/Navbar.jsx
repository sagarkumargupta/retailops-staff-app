import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../firebase';
import useUserProfile from '../hooks/useUserProfile';

export default function Navbar() {
  const [user, userLoading] = useAuthState(auth);
  const { profile, hasPermission } = useUserProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState({});

  // Debug logging
  console.log('Navbar Debug:', {
    user: user?.email,
    userLoading,
    profile: profile?.role,
    hasProfile: !!profile
  });

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleDropdown = (menuName) => {
    setIsDropdownOpen(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }));
  };

  const isActive = (path) => location.pathname === path;

  const getRoleDisplayName = () => {
    switch (profile?.role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'ADMIN': return 'Admin';
      case 'OWNER': return 'Store Owner';
      case 'MANAGER': return 'Store Manager';
      case 'STAFF': return 'Staff Member';
      default: return 'User';
    }
  };

  const getRoleColor = () => {
    switch (profile?.role) {
      case 'ADMIN': return 'bg-red-100 text-red-800';
      case 'OWNER': return 'bg-purple-100 text-purple-800';
      case 'MANAGER': return 'bg-blue-100 text-blue-800';
      case 'STAFF': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Show public navigation for non-authenticated users
  if (!profile) {
    return (
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">RetailOps</h1>
                  <p className="text-xs text-gray-500">Management System</p>
                </div>
              </Link>
            </div>

            {/* Public Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                Home
              </Link>
              <Link
                to="/our-stores"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/our-stores')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                Our Stores
              </Link>
              <Link
                to="/about-us"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/about-us')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                About Us
              </Link>
              <Link
                to="/reviews"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/reviews')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                Reviews
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Login
              </Link>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">Open main menu</span>
                <svg className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                <Link
                  to="/"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  to="/our-stores"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/our-stores')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Our Stores
                </Link>
                <Link
                  to="/about-us"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/about-us')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  About Us
                </Link>
                <Link
                  to="/reviews"
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive('/reviews')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Reviews
                </Link>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded-md text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">RetailOps</h1>
                <p className="text-xs text-gray-500">Management System</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            
            {/* Dashboard */}
            <Link
              to="/dashboard"
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/dashboard')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
                </svg>
                <span>Dashboard</span>
              </div>
            </Link>

            {/* User Management - Super Admin Only */}
            {(profile?.role === 'SUPER_ADMIN') && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('users')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/user-management')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  <span>Users</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.users ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.users && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <Link
                      to="/user-management"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      User Management
                    </Link>
                    <Link
                      to="/data-cleanup"
                      className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Data Cleanup
                    </Link>
                    <Link
                      to="/data-audit"
                      className="block px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Data Audit
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Store Management - Admin/Owner Only */}
            {(hasPermission('canManageStores')) && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('stores')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/stores-admin') || isActive('/admin-managers') || isActive('/admin-employees')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Stores</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.stores ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.stores && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <Link
                      to="/stores-admin"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Store Management
                    </Link>
                    <Link
                      to="/admin-managers"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Manager Management
                    </Link>
                    <Link
                      to="/admin-employees"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Employee Management
                    </Link>
                    {(profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                      <Link
                        to="/bulk-upload"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setIsDropdownOpen({})}
                      >
                        Bulk Upload
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Team Management - Admin/Owner/Manager */}
            {(hasPermission('canManageTasks') || hasPermission('canManageTrainings') || hasPermission('canManageTests') || profile?.role === 'MANAGER') && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('teamManagement')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/task-management') || isActive('/task-performance') || isActive('/task-reports') || isActive('/task-responses') ||
                    isActive('/training-management') || isActive('/training-performance') ||
                    isActive('/test-management') || isActive('/test-performance') || isActive('/test-completion-tracking')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Team Management</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.teamManagement ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.teamManagement && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {/* Task Management */}
                    {(hasPermission('canManageTasks') || profile?.role === 'MANAGER') && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Tasks
                        </div>
                        <Link
                          to="/task-management"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Task Management
                        </Link>
                        <Link
                          to="/task-performance"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Performance Dashboard
                        </Link>
                        <Link
                          to="/task-reports"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Task Reports
                        </Link>
                        <Link
                          to="/task-responses"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Task Responses
                        </Link>
                      </>
                    )}
                    
                    {/* Training Management */}
                    {(hasPermission('canManageTrainings') || profile?.role === 'MANAGER') && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Training
                        </div>
                        <Link
                          to="/training-management"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Training Management
                        </Link>
                        <Link
                          to="/training-performance"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Performance Dashboard
                        </Link>
                        <Link
                          to="/ai-training-generator"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          🤖 AI Training Generator
                        </Link>
                        <Link
                          to="/ai-test-generator"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          🧠 AI Test Generator
                        </Link>
                        <Link
                          to="/ai-face-companion"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          👤 AI Face Companion
                        </Link>
                      </>
                    )}
                    
                    {/* Test Management */}
                    {(hasPermission('canManageTests') || profile?.role === 'MANAGER') && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Tests
                        </div>
                        <Link
                          to="/test-management"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Test Management
                        </Link>
                        <Link
                          to="/test-performance"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Performance Dashboard
                        </Link>
                        <Link
                          to="/test-completion-tracking"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Completion Tracking
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}



            {/* Operations - Manager Only */}
            {profile?.role === 'MANAGER' && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('managerOperations')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/staff-management') || isActive('/staff-attendance') || isActive('/staff-salary') ||
                    isActive('/attendance') || isActive('/salary') ||
                    isActive('/salary-approvals') || isActive('/leave-approvals') || isActive('/other-expense-request')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Operations</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.managerOperations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.managerOperations && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {/* Staff Management Section */}
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      Staff Management
                    </div>
                    <Link
                      to="/staff-management"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Staff Management
                    </Link>
                    <Link
                      to="/staff-attendance"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Staff Attendance
                    </Link>
                    <Link
                      to="/staff-salary"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Staff Salary
                    </Link>
                    <Link
                      to="/staff-data-verification"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Data Verification
                    </Link>
                    
                    {/* Ledgers Section */}
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      Ledgers
                    </div>
                    <Link
                      to="/staff-payment-ledger"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Staff Payment Ledger
                    </Link>
                    <Link
                      to="/staff-attendance-ledger"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Staff Attendance Ledger
                    </Link>
                    <Link
                      to="/customer-payment-ledger"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Customer Payment Ledger
                    </Link>
                    
                    {/* Management Section */}
                    {(hasPermission('canManageAttendance') || hasPermission('canManageSalary')) && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Management
                        </div>
                        {hasPermission('canManageAttendance') && (
                          <Link
                            to="/attendance"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Attendance Management
                          </Link>
                        )}
                        {hasPermission('canManageSalary') && (
                          <Link
                            to="/salary"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Salary Management
                          </Link>
                        )}
                      </>
                    )}
                    
                    {/* Approvals Section */}
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      Approvals
                    </div>
                    <Link
                      to="/salary-approvals"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Salary Approvals
                    </Link>
                    <Link
                      to="/leave-approvals"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Leave Approvals
                    </Link>
                    
                    {/* Requests Section */}
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      Requests
                    </div>
                    <Link
                      to="/other-expense-request"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Expense Request
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Staff Functions - Staff Only */}
            {profile?.role === 'STAFF' && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('staff')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/my-tasks') || isActive('/my-trainings') || isActive('/my-tests')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>My Account</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.staff ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.staff && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <Link
                      to="/staff-dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      My Dashboard
                    </Link>
                    <Link
                      to="/my-tasks"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      My Tasks
                    </Link>
                    <Link
                      to="/my-trainings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      My Trainings
                    </Link>
                    <Link
                      to="/my-tests"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      My Tests
                    </Link>
                    <Link
                      to="/self-attendance"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      My Attendance
                    </Link>
                    <Link
                      to="/leave-request"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Leave Request
                    </Link>
                    <Link
                      to="/salary-request"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Salary Request
                    </Link>
                    <Link
                      to="/staff-notifications"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Notifications
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Operations Management - Admin/Owner Only */}
            {(hasPermission('canManageAttendance') || hasPermission('canManageSalary') || hasPermission('canManageLeave')) && (profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('operations')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/attendance') || isActive('/salary') || isActive('/leave-approvals') || isActive('/salary-approvals') || 
                    isActive('/other-expense-approvals') || isActive('/customer-management') || isActive('/auto-attendance') || isActive('/opening-balance-manager')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>Operations</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.operations ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.operations && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {/* Management Section */}
                    {(hasPermission('canManageAttendance') || hasPermission('canManageSalary')) && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Management
                        </div>
                        {hasPermission('canManageAttendance') && (
                          <Link
                            to="/attendance"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Attendance Management
                          </Link>
                        )}
                        {hasPermission('canManageSalary') && (
                          <Link
                            to="/salary"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Salary Management
                          </Link>
                        )}
                        {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER') && (
                          <Link
                            to="/target-management"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Target Management
                          </Link>
                        )}
                        {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER') && (
                          <Link
                            to="/staff-data-verification"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Staff Data Verification
                          </Link>
                        )}
                      </>
                    )}
                    
                    {/* Ledgers Section */}
                    {(profile?.role === 'ADMIN' || profile?.role === 'OWNER' || profile?.role === 'MANAGER') && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Ledgers
                        </div>
                        <Link
                          to="/staff-payment-ledger"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Staff Payment Ledger
                        </Link>
                        <Link
                          to="/staff-attendance-ledger"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Staff Attendance Ledger
                        </Link>
                        <Link
                          to="/customer-payment-ledger"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Customer Payment Ledger
                        </Link>
                      </>
                    )}
                    
                    {/* Approvals Section */}
                    {(hasPermission('canManageLeave') || hasPermission('canManageSalary') || profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                      <>
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                          Approvals
                        </div>
                        {(profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                          <Link
                            to="/customer-management"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Customer Approvals
                          </Link>
                        )}
                        {(hasPermission('canManageSalary') || profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                          <Link
                            to="/salary-approvals"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Salary Approvals
                          </Link>
                        )}
                        {(hasPermission('canManageLeave') || profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                          <Link
                            to="/leave-approvals"
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            onClick={() => setIsDropdownOpen({})}
                          >
                            Leave Approvals
                          </Link>
                        )}
                        {(profile?.role === 'ADMIN' || profile?.role === 'OWNER') && (
                          <>
                            <Link
                              to="/other-expense-approvals"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setIsDropdownOpen({})}
                            >
                              Expense Approvals
                            </Link>
                            <Link
                              to="/expense-debug"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setIsDropdownOpen({})}
                            >
                              Expense Debug
                            </Link>
                            <Link
                              to="/auto-attendance"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setIsDropdownOpen({})}
                            >
                              Auto Attendance Manager
                            </Link>
                            <Link
                              to="/staff-data-verification"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setIsDropdownOpen({})}
                            >
                              Data Verification
                            </Link>
                            <Link
                              to="/opening-balance-manager"
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              onClick={() => setIsDropdownOpen({})}
                            >
                              Opening Balance Manager
                            </Link>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Financial Management */}
            {(hasPermission('canManageDues') || hasPermission('canManageRokar')) && (
              <div className="relative">
                <button
                  onClick={() => toggleDropdown('financial')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                    isActive('/dues-dashboard') || isActive('/dues-ledger') || isActive('/customer-management') || isActive('/rokar-entry') || isActive('/rokar-tab')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                  <span>Financial</span>
                  <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.financial ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isDropdownOpen.financial && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    {hasPermission('canManageDues') && (
                      <>
                                            <Link
                      to="/dues-dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Dues Dashboard
                    </Link>
                    <Link
                      to="/dues-ledger"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Dues Ledger
                    </Link>
                    <Link
                      to="/customer-management"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setIsDropdownOpen({})}
                    >
                      Customer Management
                    </Link>
                      </>
                    )}
                    {hasPermission('canManageRokar') && (
                      <>
                        <Link
                          to="/rokar-entry"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Rokar Entry
                        </Link>
                        <Link
                          to="/rokar-tab"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsDropdownOpen({})}
                        >
                          Rokar Book
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Reports - Admin/Owner/Manager Only */}
            {(hasPermission('canViewReports')) && (
              <Link
                to="/reports"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/reports')
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Reports</span>
                </div>
              </Link>
            )}

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => toggleDropdown('profile')}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-sm font-medium text-gray-900">{profile?.name || 'User'}</div>
                  <div className="text-xs text-gray-500">{getRoleDisplayName()}</div>
                </div>
                <svg className={`w-4 h-4 transition-transform ${isDropdownOpen.profile ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {isDropdownOpen.profile && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">{profile?.name || 'User'}</div>
                    <div className="text-xs text-gray-500">{profile?.email}</div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-1 ${getRoleColor()}`}>
                      {getRoleDisplayName()}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <svg className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
            <Link
              to="/dashboard"
              className={`block px-3 py-2 rounded-md text-base font-medium ${
                isActive('/dashboard')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-blue-50'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            
            {/* Add mobile menu items based on permissions */}
            {hasPermission('canManageStores') && (
              <>
                <Link
                  to="/stores-admin"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Store Management
                </Link>
                <Link
                  to="/admin-managers"
                  className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Manager Management
                </Link>
              </>
            )}
            
            {hasPermission('canManageTasks') && (
              <Link
                to="/task-management"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Task Management
              </Link>
            )}
            
            {hasPermission('canViewReports') && (
              <Link
                to="/reports"
                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Reports
              </Link>
            )}
            
            <button
              onClick={handleSignOut}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}