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
fun SalaryRequestsScreen(
    navController: NavController,
    database: AppDatabase,
    syncManager: DataSyncManager
) {
    var amount by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    var showHistory by remember { mutableStateOf(false) }
    
    val commonReasons = listOf(
        "Medical Emergency",
        "Family Emergency", 
        "Education Expenses",
        "Home Repair",
        "Vehicle Repair",
        "Other"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Salary Request") },
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
                // New Request Form
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
                            text = "Request Salary Advance",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        OutlinedTextField(
                            value = amount,
                            onValueChange = { amount = it },
                            label = { Text("Request Amount") },
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                            ),
                            leadingIcon = { Icon(Icons.Default.AttachMoney, contentDescription = null) }
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Reason Dropdown
                        ExposedDropdownMenuBox(
                            expanded = false,
                            onExpandedChange = { },
                        ) {
                            OutlinedTextField(
                                value = reason,
                                onValueChange = { },
                                readOnly = true,
                                label = { Text("Reason for Request") },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .menuAnchor(),
                                leadingIcon = { Icon(Icons.Default.Info, contentDescription = null) }
                            )
                            
                            DropdownMenu(
                                expanded = false,
                                onDismissRequest = { }
                            ) {
                                commonReasons.forEach { r ->
                                    DropdownMenuItem(
                                        text = { Text(r) },
                                        onClick = { reason = r }
                                    )
                                }
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Additional Notes
                        OutlinedTextField(
                            value = "",
                            onValueChange = { },
                            label = { Text("Additional Notes (Optional)") },
                            modifier = Modifier.fillMaxWidth(),
                            minLines = 3,
                            leadingIcon = { Icon(Icons.Default.Note, contentDescription = null) }
                        )
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        
                        // Submit Button
                        Button(
                            onClick = {
                                // TODO: Implement salary request submission
                                isSubmitting = true
                            },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = amount.isNotEmpty() && reason.isNotEmpty() && !isSubmitting
                        ) {
                            if (isSubmitting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                            }
                            Text("Submit Request")
                        }
                    }
                }
            } else {
                // Request History
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
                            text = "Request History",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        // Sample history items
                        SalaryRequestHistoryItem(
                            amount = "₹5,000",
                            reason = "Medical Emergency",
                            date = "2024-12-15",
                            status = "Approved"
                        )
                        
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        
                        SalaryRequestHistoryItem(
                            amount = "₹3,000",
                            reason = "Education Expenses",
                            date = "2024-12-10",
                            status = "Pending"
                        )
                        
                        Divider(modifier = Modifier.padding(vertical = 8.dp))
                        
                        SalaryRequestHistoryItem(
                            amount = "₹2,500",
                            reason = "Vehicle Repair",
                            date = "2024-12-05",
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
fun SalaryRequestHistoryItem(
    amount: String,
    reason: String,
    date: String,
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
                text = amount,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = reason,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            Text(
                text = date,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
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

