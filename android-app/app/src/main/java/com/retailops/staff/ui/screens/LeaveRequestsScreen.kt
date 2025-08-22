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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.retailops.staff.data.local.AppDatabase
import com.retailops.staff.data.sync.DataSyncManager
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveRequestsScreen(
    navController: NavController,
    database: AppDatabase,
    syncManager: DataSyncManager
) {
    var startDate by remember { mutableStateOf("") }
    var endDate by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var showHistory by remember { mutableStateOf(false) }
    
    val leaveReasons = listOf(
        "Personal Leave",
        "Medical Leave",
        "Family Emergency",
        "Wedding",
        "Religious Festival",
        "Other"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Leave Request") },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = { showHistory = !showHistory }) {
                        Icon(Icons.Default.History, contentDescription = "History")
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
                .padding(16.dp)
        ) {
            if (!showHistory) {
                // New Leave Request Form
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Submit Leave Request",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Date Range Selection
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = startDate,
                                onValueChange = { startDate = it },
                                label = { Text("Start Date") },
                                modifier = Modifier.weight(1f),
                                leadingIcon = { Icon(Icons.Default.DateRange, contentDescription = null) }
                            )
                            
                            OutlinedTextField(
                                value = endDate,
                                onValueChange = { endDate = it },
                                label = { Text("End Date") },
                                modifier = Modifier.weight(1f),
                                leadingIcon = { Icon(Icons.Default.DateRange, contentDescription = null) }
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Leave Type Dropdown
                        ExposedDropdownMenuBox(
                            expanded = false,
                            onExpandedChange = { },
                        ) {
                            OutlinedTextField(
                                value = reason,
                                onValueChange = { },
                                readOnly = true,
                                label = { Text("Leave Type") },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(),
                                leadingIcon = { Icon(Icons.Default.Event, contentDescription = null) }
                            )
                            
                            DropdownMenu(
                                expanded = false,
                                onDismissRequest = { }
                            ) {
                                leaveReasons.forEach { r ->
                                    DropdownMenuItem(
                                        text = { Text(r) },
                                        onClick = { reason = r }
                                    )
                                }
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Additional Details
                        OutlinedTextField(
                            value = "",
                            onValueChange = { },
                            label = { Text("Additional Details (Optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 3,
                            leadingIcon = { Icon(Icons.Default.Description, contentDescription = null) }
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        // Submit Button
                        Button(
                            onClick = {
                                // TODO: Implement leave request submission
                                isSubmitting = true
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = startDate.isNotEmpty() && endDate.isNotEmpty() && reason.isNotEmpty() && !isSubmitting
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Submit Leave Request")
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Leave Balance Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Leave Balance",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        
                        Spacer(modifier = Modifier.height(12.dp))
                        
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            LeaveBalanceItem(
                                type = "Casual Leave",
                                available = "12",
                                used = "3"
                            )
                            LeaveBalanceItem(
                                type = "Sick Leave",
                                available = "15",
                                used = "1"
                            )
                        }
                        
                        Spacer(modifier = Modifier.height(8.dp))
                        
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            LeaveBalanceItem(
                                type = "Earned Leave",
                                available = "30",
                                used = "8"
                            )
                            LeaveBalanceItem(
                                type = "Other Leave",
                                available = "5",
                                used = "0"
                            )
                        }
                    }
                }
            } else {
                // Leave Request History
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp)
                    ) {
                        Text(
                            text = "Leave Request History",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Sample history items
                        LeaveRequestHistoryItem(
                            type = "Medical Leave",
                            startDate = "2024-12-20",
                            endDate = "2024-12-22",
                            status = "Approved"
                        )
                        
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        
                        LeaveRequestHistoryItem(
                            type = "Personal Leave",
                            startDate = "2024-12-25",
                            endDate = "2024-12-26",
                            status = "Pending"
                        )
                        
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        
                        LeaveRequestHistoryItem(
                            type = "Family Emergency",
                            startDate = "2024-12-10",
                            endDate = "2024-12-12",
                            status = "Rejected"
                        )
                    }
                }
            }
            
            if (message.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = message,
                    color = if (message.contains("success", ignoreCase = true)) 
                        MaterialTheme.colorScheme.primary 
                    else 
                        MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
fun LeaveBalanceItem(
    type: String,
    available: String,
    used: String
) {
    Card(
        modifier = Modifier.weight(1f),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = type,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Text(
                text = available,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            
            Text(
                text = "Available",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
            
            Spacer(modifier = Modifier.height(4.dp))
            
            Text(
                text = used,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )
            
            Text(
                text = "Used",
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
fun LeaveRequestHistoryItem(
    type: String,
    startDate: String,
    endDate: String,
    status: String
) {
    val statusColor = when (status.lowercase()) {
        "approved" -> MaterialTheme.colorScheme.primary
        "pending" -> MaterialTheme.colorScheme.tertiary
        "rejected" -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurface
    }
    
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = type,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "$startDate to $endDate",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
        
        Card(
            colors = CardDefaults.cardColors(
                containerColor = statusColor.copy(alpha = 0.1f)
            )
        ) {
            Text(
                text = status,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = statusColor
            )
        }
    }
}

