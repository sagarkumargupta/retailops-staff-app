package com.retailops.staff.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.retailops.staff.data.local.DatabaseHelper
import com.retailops.staff.data.sync.DataSyncManager
import com.retailops.staff.ui.screens.*
import com.retailops.staff.data.models.Screen

@Composable
fun StaffNavigation(
    navController: NavHostController,
    databaseHelper: DatabaseHelper,
    dataSyncManager: DataSyncManager
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                navController = navController,
                databaseHelper = databaseHelper,
                dataSyncManager = dataSyncManager
            )
        }
        
        composable(Screen.Attendance.route) {
            AttendanceScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.Sales.route) {
            SalesScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.Expenses.route) {
            ExpensesScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.SalaryRequests.route) {
            SalaryRequestsScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.LeaveRequests.route) {
            LeaveRequestsScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.Targets.route) {
            TargetsScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.RokarEntry.route) {
            RokarEntryScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.Profile.route) {
            ProfileScreen(
                navController = navController,
                databaseHelper = databaseHelper
            )
        }
        
        composable(Screen.Settings.route) {
            SettingsScreen(
                navController = navController,
                dataSyncManager = dataSyncManager
            )
        }
        
        composable(Screen.SyncStatus.route) {
            SyncStatusScreen(
                navController = navController,
                dataSyncManager = dataSyncManager
            )
        }
    }
}
