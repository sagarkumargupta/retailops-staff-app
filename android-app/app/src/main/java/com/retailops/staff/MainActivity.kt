package com.retailops.staff

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import com.retailops.staff.ui.theme.RetailOpsStaffTheme
import com.retailops.staff.navigation.StaffNavigation
import com.retailops.staff.data.local.DatabaseHelper
import com.retailops.staff.data.sync.DataSyncManager

class MainActivity : ComponentActivity() {
    private lateinit var databaseHelper: DatabaseHelper
    private lateinit var dataSyncManager: DataSyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Initialize database and sync manager
        databaseHelper = DatabaseHelper(this)
        dataSyncManager = DataSyncManager(this, databaseHelper)
        
        setContent {
            RetailOpsStaffTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    
                    StaffNavigation(
                        navController = navController,
                        databaseHelper = databaseHelper,
                        dataSyncManager = dataSyncManager
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        databaseHelper.close()
    }
}
