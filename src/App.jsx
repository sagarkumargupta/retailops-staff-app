import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Homepage from './pages/Homepage'
import OurStores from './pages/OurStores'
import AboutUs from './pages/AboutUs'
import Reviews from './pages/Reviews'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import StoresAdmin from './pages/StoresAdmin'
import AdminManagers from './pages/AdminManagers'
import AdminEmployees from './pages/AdminEmployees'
import StaffManagement from './pages/StaffManagement'
import UserManagement from './pages/UserManagement'
import DataCleanup from './pages/DataCleanup'
import DataAudit from './pages/DataAudit'
import RokarEntry from './pages/RokarEntry'
import RokarTab from './pages/RokarTab'
import Attendance from './pages/Attendance'
import SelfAttendance from './pages/SelfAttendance'
import Salary from './pages/Salary'
import SalaryRequest from './pages/SalaryRequest'
import SalaryApprovals from './pages/SalaryApprovals'
import LeaveRequest from './pages/LeaveRequest'
import LeaveApprovals from './pages/LeaveApprovals'
import OtherExpenseRequest from './pages/OtherExpenseRequest'
import OtherExpenseApprovals from './pages/OtherExpenseApprovals'
import ExpenseDebug from './pages/ExpenseDebug'
import BulkUpload from './pages/BulkUpload'
import Reports from './pages/Reports'
import ProtectedRoute from './components/ProtectedRoute'
import RequireRole from './components/RequireRole'
import OpeningBalanceManager from './pages/OpeningBalanceManager'
import TargetManagement from './pages/TargetManagement'
import StaffPaymentLedger from './pages/StaffPaymentLedger'
import StaffAttendanceLedger from './pages/StaffAttendanceLedger'
import CustomerPaymentLedger from './pages/CustomerPaymentLedger'

// Task Management Pages
import TaskManagement from './pages/TaskManagement'
import TaskPerformance from './pages/TaskPerformance'
import TaskReports from './pages/TaskReports'
import TaskResponses from './pages/TaskResponses'

import TaskExecution from './pages/TaskExecution'
import MyTasks from './pages/MyTasks'

// Training Management Pages
import TrainingManagement from './pages/TrainingManagement'
import TrainingPerformance from './pages/TrainingPerformance'
import TrainingExecution from './pages/TrainingExecution'
import MyTrainings from './pages/MyTrainings'

// Test Management Pages
import TestManagement from './pages/TestManagement'
import TestPerformance from './pages/TestPerformance'
import TestExecution from './pages/TestExecution'
import MyTests from './pages/MyTests'
import TestCompletionTracking from './pages/TestCompletionTracking'

// Dues Management Pages
import DuesDashboard from './pages/DuesDashboard'
import DuesLedger from './pages/DuesLedger'
import DuesCustomer from './pages/DuesCustomer'

// Customer Management Pages
import CustomerManagement from './pages/CustomerManagement'
import StaffDashboard from './pages/StaffDashboard'
import ErrorBoundary from './components/ErrorBoundary'
import DebugUserProfile from './pages/DebugUserProfile'
import AutoAttendanceManager from './pages/AutoAttendanceManager'
import StaffDataVerification from './pages/StaffDataVerification'
import StaffNotifications from './pages/StaffNotifications'

// AI-Powered Training Components
import AITrainingGenerator from './pages/AITrainingGenerator'
import AITestGenerator from './pages/AITestGenerator'
import AIFaceCompanion from './pages/AIFaceCompanion'

// Layout component to include Navbar
function Layout({ children }) {
  return (
    <div>
      <Navbar />
      <div className="mx-auto max-w-7xl px-6 pt-6 pb-10">
        {children}
      </div>
    </div>
  );
}

// Simple Landing Page Component
function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">RetailOps</h1>
        <p className="text-xl text-gray-600 mb-8">Complete Retail Management Solution</p>
        <div className="space-x-4">
          <a 
            href="/login" 
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login
          </a>
          <a 
            href="/signup" 
            className="inline-block bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
}

// Create router with future flags to fix warnings
const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout><Homepage /></Layout>
  },
  {
    path: "/our-stores",
    element: <Layout><OurStores /></Layout>
  },
  {
    path: "/about-us",
    element: <Layout><AboutUs /></Layout>
  },
  {
    path: "/reviews",
    element: <Layout><Reviews /></Layout>
  },
  {
    path: "/login",
    element: <Login />
  },
  // Signup route removed - users are created by administrators only
  {
    path: "/dashboard",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF', 'OFFICE']}><Dashboard /></RequireRole></Layout>
  },
  {
    path: "/stores-admin",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><StoresAdmin /></RequireRole></Layout>
  },
  {
    path: "/admin-managers",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><AdminManagers /></RequireRole></Layout>
  },
  {
    path: "/admin-employees",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><AdminEmployees /></RequireRole></Layout>
  },
  {
    path: "/staff-management",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><StaffManagement /></RequireRole></Layout>
  },
  {
    path: "/user-management",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'MANAGER']}><UserManagement /></RequireRole></Layout>
  },
  {
    path: "/data-cleanup",
    element: <Layout><RequireRole allow={['SUPER_ADMIN']}><DataCleanup /></RequireRole></Layout>
  },
  {
    path: "/data-audit",
    element: <Layout><RequireRole allow={['SUPER_ADMIN']}><DataAudit /></RequireRole></Layout>
  },
  {
    path: "/rokar-entry",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><RokarEntry /></RequireRole></Layout>
  },
  {
    path: "/rokar-tab",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'OFFICE']}><RokarTab /></RequireRole></Layout>
  },
  {
    path: "/attendance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><Attendance /></RequireRole></Layout>
  },
  {
    path: "/staff-attendance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><Attendance /></RequireRole></Layout>
  },
  {
    path: "/self-attendance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><SelfAttendance /></RequireRole></Layout>
  },
  {
    path: "/staff-data-verification",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><StaffDataVerification /></RequireRole></Layout>
  },
  {
    path: "/staff-notifications",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><StaffNotifications /></RequireRole></Layout>
  },
  {
    path: "/salary",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><Salary /></RequireRole></Layout>
  },
  {
    path: "/staff-salary",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><Salary /></RequireRole></Layout>
  },
  {
    path: "/salary-request",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><SalaryRequest /></RequireRole></Layout>
  },
  {
    path: "/salary-approvals",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><SalaryApprovals /></RequireRole></Layout>
  },
  {
    path: "/leave-request",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><LeaveRequest /></RequireRole></Layout>
  },
  {
    path: "/leave-approvals",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><LeaveApprovals /></RequireRole></Layout>
  },
  {
    path: "/other-expense-request",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><OtherExpenseRequest /></RequireRole></Layout>
  },
  {
    path: "/other-expense-approvals",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><OtherExpenseApprovals /></RequireRole></Layout>
  },
  {
    path: "/expense-debug",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><ExpenseDebug /></RequireRole></Layout>
  },
  {
    path: "/bulk-upload",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><BulkUpload /></RequireRole></Layout>
  },
  {
    path: "/reports",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'OFFICE']}><Reports /></RequireRole></Layout>
  },
  {
    path: "/opening-balance-manager",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><OpeningBalanceManager /></RequireRole></Layout>
  },
          {
          path: "/target-management",
          element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TargetManagement /></RequireRole></Layout>
        },
        {
          path: "/staff-payment-ledger",
          element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><StaffPaymentLedger /></RequireRole></Layout>
        },
        {
          path: "/staff-attendance-ledger",
          element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><StaffAttendanceLedger /></RequireRole></Layout>
        },
        {
          path: "/customer-payment-ledger",
          element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><CustomerPaymentLedger /></RequireRole></Layout>
        },
  
  // Task Management Routes
  {
    path: "/task-management",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TaskManagement /></RequireRole></Layout>
  },
  {
    path: "/task-performance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TaskPerformance /></RequireRole></Layout>
  },
  {
    path: "/task-reports",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TaskReports /></RequireRole></Layout>
      },
    {
      path: "/task-responses",
      element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TaskResponses /></RequireRole></Layout>
    },
    {
    path: "/task-execution/:taskId",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><TaskExecution /></RequireRole></Layout>
  },
  {
    path: "/my-tasks",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><MyTasks /></RequireRole></Layout>
  },

  // Training Management Routes
  {
    path: "/training-management",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TrainingManagement /></RequireRole></Layout>
  },
  {
    path: "/training-performance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TrainingPerformance /></RequireRole></Layout>
  },
  {
    path: "/training-execution/:trainingId",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><TrainingExecution /></RequireRole></Layout>
  },
  {
    path: "/my-trainings",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><MyTrainings /></RequireRole></Layout>
  },

  // Test Management Routes
  {
    path: "/test-management",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TestManagement /></RequireRole></Layout>
  },
  {
    path: "/test-performance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TestPerformance /></RequireRole></Layout>
  },
  {
    path: "/test-execution/:testId",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><TestExecution /></RequireRole></Layout>
  },
  {
    path: "/my-tests",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><MyTests /></RequireRole></Layout>
  },
  {
    path: "/test-completion-tracking",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><TestCompletionTracking /></RequireRole></Layout>
  },

  // Dues Management Routes
  {
    path: "/dues-dashboard",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'OFFICE']}><DuesDashboard /></RequireRole></Layout>
  },
  {
    path: "/dues-ledger",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'OFFICE']}><DuesLedger /></RequireRole></Layout>
  },
  {
    path: "/dues-customer/:storeId/:customerKey",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'OFFICE']}><DuesCustomer /></RequireRole></Layout>
  },

  // Customer Management Routes
  {
    path: "/customer-management",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><CustomerManagement /></RequireRole></Layout>
  },

  // Staff Dashboard Route
  {
    path: "/staff-dashboard",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><StaffDashboard /></RequireRole></Layout>
  },

  // AI-Powered Training Routes
  {
    path: "/ai-training-generator",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><AITrainingGenerator /></RequireRole></Layout>
  },
  {
    path: "/ai-test-generator",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><AITestGenerator /></RequireRole></Layout>
  },
  {
    path: "/ai-face-companion",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER']}><AIFaceCompanion /></RequireRole></Layout>
  },

  // Debug Route
  {
    path: "/debug-profile",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER', 'MANAGER', 'STAFF']}><DebugUserProfile /></RequireRole></Layout>
  },

  // Auto Attendance Manager Route
  {
    path: "/auto-attendance",
    element: <Layout><RequireRole allow={['SUPER_ADMIN', 'ADMIN', 'OWNER']}><AutoAttendanceManager /></RequireRole></Layout>
  },

  // Catch-all route for 404 errors
  {
    path: "*",
    element: (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="mb-4">
            <svg className="h-12 w-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
          <a
            href="/dashboard"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    )
  }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
});

export default function App() {
  useEffect(() => {
    // Removed automatic super admin creation to avoid unintended privilege creation
  }, []);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}