package com.retailops.staff

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.google.firebase.FirebaseApp
import com.retailops.staff.data.local.AppDatabase
import com.retailops.staff.data.sync.DataSyncManager
import com.retailops.staff.firebase.FirebaseConfig
import com.retailops.staff.navigation.StaffNavigation
import com.retailops.staff.ui.screens.DashboardScreen
import com.retailops.staff.ui.screens.LoginScreen
import com.retailops.staff.ui.screens.AttendanceScreen
import com.retailops.staff.ui.screens.SalesScreen
import com.retailops.staff.ui.screens.ExpensesScreen
import com.retailops.staff.ui.screens.RokarEntryScreen
import com.retailops.staff.ui.screens.SalaryRequestsScreen
import com.retailops.staff.ui.screens.LeaveRequestsScreen
import com.retailops.staff.ui.screens.ProfileScreen
import com.retailops.staff.ui.screens.SettingsScreen
import com.retailops.staff.ui.screens.TargetsScreen
import com.retailops.staff.ui.theme.RetailOpsStaffTheme

class MainActivity : ComponentActivity() {
    private lateinit var database: AppDatabase
    private lateinit var syncManager: DataSyncManager
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize Firebase
        FirebaseApp.initializeApp(this)
        FirebaseConfig.initialize(FirebaseApp.getInstance())
        
        // Initialize database and sync manager
        database = AppDatabase.getDatabase(this)
        syncManager = DataSyncManager(this)
        
        setContent {
            RetailOpsStaffTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    RetailOpsStaffApp(database, syncManager)
                }
            }
        }
    }
}

@Composable
fun RetailOpsStaffApp(
    database: AppDatabase,
    syncManager: DataSyncManager
) {
    val navController = rememberNavController()
    
    NavHost(
        navController = navController,
        startDestination = StaffNavigation.Login.route
    ) {
        composable(StaffNavigation.Login.route) {
            LoginScreen(
                navController = navController,
                database = database
            )
        }
        
        composable(StaffNavigation.Dashboard.route) {
            DashboardScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.Attendance.route) {
            AttendanceScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.Sales.route) {
            SalesScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.Expenses.route) {
            ExpensesScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.SalaryRequests.route) {
            SalaryRequestsScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.LeaveRequests.route) {
            LeaveRequestsScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.Targets.route) {
            TargetsScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.RokarEntry.route) {
            RokarEntryScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
        
        composable(StaffNavigation.Profile.route) {
            ProfileScreen(
                navController = navController,
                database = database
            )
        }
        
        composable(StaffNavigation.Settings.route) {
            SettingsScreen(
                navController = navController,
                database = database,
                syncManager = syncManager
            )
        }
    }
}
