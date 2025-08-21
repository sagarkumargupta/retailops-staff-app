package com.retailops.staff.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.retailops.staff.data.local.DatabaseHelper
import com.retailops.staff.data.sync.DataSyncManager
import com.retailops.staff.data.models.Screen
import com.retailops.staff.data.models.User
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    navController: NavController,
    databaseHelper: DatabaseHelper,
    dataSyncManager: DataSyncManager
) {
    var currentUser by remember { mutableStateOf<User?>(null) }
    var syncStatus by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var isOnline by remember { mutableStateOf(false) }
    
    LaunchedEffect(Unit) {
        // Load current user and sync status
        // This would be implemented based on your auth system
        syncStatus = dataSyncManager.getSyncStatus()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Staff Dashboard") },
                actions = {
                    IconButton(onClick = { navController.navigate(Screen.Profile.route) }) {
                        Icon(Icons.Default.Person, contentDescription = "Profile")
                    }
                    IconButton(onClick = { navController.navigate(Screen.Settings.route) }) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            // Welcome Section
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Welcome back!",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = currentUser?.name ?: "Staff Member",
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = SimpleDateFormat("EEEE, MMMM dd, yyyy", Locale.getDefault())
                            .format(Date()),
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }

            // Sync Status
            if (syncStatus.isNotEmpty()) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "Sync Status",
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Text(
                                text = if (isOnline) "Online" else "Offline",
                                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
                            )
                        }
                        Button(
                            onClick = {
                                dataSyncManager.manualSync { success ->
                                    // Handle sync result
                                }
                            },
                            enabled = isOnline
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Sync")
                        }
                    }
                }
            }

            // Quick Actions Grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.height(400.dp)
            ) {
                item {
                    DashboardCard(
                        title = "Attendance",
                        icon = Icons.Default.Schedule,
                        onClick = { navController.navigate(Screen.Attendance.route) },
                        backgroundColor = MaterialTheme.colorScheme.primary
                    )
                }
                item {
                    DashboardCard(
                        title = "Sales",
                        icon = Icons.Default.ShoppingCart,
                        onClick = { navController.navigate(Screen.Sales.route) },
                        backgroundColor = MaterialTheme.colorScheme.secondary
                    )
                }
                item {
                    DashboardCard(
                        title = "Expenses",
                        icon = Icons.Default.Receipt,
                        onClick = { navController.navigate(Screen.Expenses.route) },
                        backgroundColor = MaterialTheme.colorScheme.tertiary
                    )
                }
                item {
                    DashboardCard(
                        title = "Salary Requests",
                        icon = Icons.Default.Payment,
                        onClick = { navController.navigate(Screen.SalaryRequests.route) },
                        backgroundColor = MaterialTheme.colorScheme.error
                    )
                }
                item {
                    DashboardCard(
                        title = "Leave Requests",
                        icon = Icons.Default.Event,
                        onClick = { navController.navigate(Screen.LeaveRequests.route) },
                        backgroundColor = MaterialTheme.colorScheme.primary
                    )
                }
                item {
                    DashboardCard(
                        title = "Targets",
                        icon = Icons.Default.TrendingUp,
                        onClick = { navController.navigate(Screen.Targets.route) },
                        backgroundColor = MaterialTheme.colorScheme.secondary
                    )
                }
                item {
                    DashboardCard(
                        title = "Rokar Entry",
                        icon = Icons.Default.AccountBalance,
                        onClick = { navController.navigate(Screen.RokarEntry.route) },
                        backgroundColor = MaterialTheme.colorScheme.tertiary
                    )
                }
                item {
                    DashboardCard(
                        title = "Sync Status",
                        icon = Icons.Default.CloudSync,
                        onClick = { navController.navigate(Screen.SyncStatus.route) },
                        backgroundColor = MaterialTheme.colorScheme.error
                    )
                }
            }

            // Recent Activity Section
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Recent Activity",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    // This would show recent activities from local database
                    Text(
                        text = "No recent activity",
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            }
        }
    }
}

@Composable
fun DashboardCard(
    title: String,
    icon: ImageVector,
    onClick: () -> Unit,
    backgroundColor: androidx.compose.ui.graphics.Color
) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = backgroundColor
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(120.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = title,
                tint = MaterialTheme.colorScheme.onPrimary,
                modifier = Modifier.size(32.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = title,
                color = MaterialTheme.colorScheme.onPrimary,
                fontWeight = FontWeight.Medium,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
    }
}
