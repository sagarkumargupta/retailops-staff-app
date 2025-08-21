package com.retailops.staff.data.models

// User model
data class User(
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    val assignedStore: String?,
    val phone: String?,
    val address: String?,
    val salary: Double,
    val joiningDate: String?
)

// Store model
data class Store(
    val id: String,
    val name: String,
    val brand: String?,
    val address: String?,
    val phone: String?,
    val managerId: String?
)

// Attendance model
data class Attendance(
    val id: String,
    val userId: String,
    val storeId: String,
    val date: String,
    val checkInTime: String?,
    val checkOutTime: String?,
    val status: String,
    val location: String?,
    val isSynced: Boolean = false
)

// Sale model
data class Sale(
    val id: String,
    val storeId: String,
    val date: String,
    val amount: Double,
    val category: String,
    val paymentMethod: String,
    val customerName: String?,
    val customerPhone: String?,
    val notes: String?,
    val isSynced: Boolean = false
)

// Expense model
data class Expense(
    val id: String,
    val storeId: String,
    val date: String,
    val amount: Double,
    val category: String,
    val description: String,
    val requestedBy: String,
    val status: String,
    val approvedBy: String?,
    val approvedAt: String?,
    val isSynced: Boolean = false
)

// Salary Request model
data class SalaryRequest(
    val id: String,
    val userId: String,
    val storeId: String,
    val amount: Double,
    val reason: String,
    val requestedDate: String,
    val status: String,
    val approvedBy: String?,
    val approvedAt: String?,
    val isSynced: Boolean = false
)

// Leave Request model
data class LeaveRequest(
    val id: String,
    val userId: String,
    val storeId: String,
    val startDate: String,
    val endDate: String,
    val reason: String,
    val status: String,
    val approvedBy: String?,
    val approvedAt: String?,
    val isSynced: Boolean = false
)

// Target model
data class Target(
    val id: String,
    val storeId: String,
    val userId: String,
    val month: String,
    val year: Int,
    val targetAmount: Double,
    val achievedAmount: Double
)

// Rokar Entry model
data class RokarEntry(
    val id: String,
    val storeId: String,
    val date: String,
    val openingBalance: Double,
    val computerSale: Double,
    val manualSale: Double,
    val manualBilled: Double,
    val customerDuesPaid: Double,
    val duesGiven: Double,
    val paytm: Double,
    val phonepe: Double,
    val gpay: Double,
    val bankDeposit: Double,
    val home: Double,
    val expenseBreakup: String,
    val otherExpenseTotal: Double,
    val staffSalaryTotal: Double,
    val closingBalance: Double,
    val isSynced: Boolean = false
)

// Sync Status model
data class SyncStatus(
    val tableName: String,
    val lastSyncTime: Long,
    val isPending: Boolean
)

// API Response models
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val message: String?
)

data class LoginResponse(
    val user: User,
    val token: String
)

// UI State models
data class UiState<T>(
    val isLoading: Boolean = false,
    val data: T? = null,
    val error: String? = null
)

// Navigation models
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Attendance : Screen("attendance")
    object Sales : Screen("sales")
    object Expenses : Screen("expenses")
    object SalaryRequests : Screen("salary_requests")
    object LeaveRequests : Screen("leave_requests")
    object Targets : Screen("targets")
    object RokarEntry : Screen("rokar_entry")
    object Profile : Screen("profile")
    object Settings : Screen("settings")
    object SyncStatus : Screen("sync_status")
}
