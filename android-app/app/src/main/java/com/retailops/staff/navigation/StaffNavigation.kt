package com.retailops.staff.navigation

sealed class StaffNavigation(val route: String) {
    object Login : StaffNavigation("login")
    object Dashboard : StaffNavigation("dashboard")
    object Attendance : StaffNavigation("attendance")
    object Sales : StaffNavigation("sales")
    object Expenses : StaffNavigation("expenses")
    object SalaryRequests : StaffNavigation("salary_requests")
    object LeaveRequests : StaffNavigation("leave_requests")
    object Targets : StaffNavigation("targets")
    object RokarEntry : StaffNavigation("rokar_entry")
    object Profile : StaffNavigation("profile")
    object Settings : StaffNavigation("settings")
    object SyncStatus : StaffNavigation("sync_status")
}
