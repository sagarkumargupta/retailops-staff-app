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
import com.retailops.staff.data.local.entities.RokarEntity
import com.retailops.staff.data.sync.DataSyncManager
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RokarEntryScreen(
    navController: NavController,
    database: AppDatabase,
    syncManager: DataSyncManager
) {
    var date by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()).format(Date())) }
    var openingBalance by remember { mutableStateOf("0") }
    var computerSale by remember { mutableStateOf("0") }
    var manualSale by remember { mutableStateOf("0") }
    var manualBilled by remember { mutableStateOf("0") }
    var customerDuesPaid by remember { mutableStateOf("0") }
    var duesGiven by remember { mutableStateOf("0") }
    var paytm by remember { mutableStateOf("0") }
    var phonepe by remember { mutableStateOf("0") }
    var gpay by remember { mutableStateOf("0") }
    var bankDeposit by remember { mutableStateOf("0") }
    var home by remember { mutableStateOf("0") }
    var otherExpenseTotal by remember { mutableStateOf("0") }
    var staffSalaryTotal by remember { mutableStateOf("0") }
    var isSubmitting by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf("") }
    
    // Auto-calculate closing balance
    val closingBalance = remember {
        derivedStateOf {
            val opening = openingBalance.toDoubleOrNull() ?: 0.0
            val compSale = computerSale.toDoubleOrNull() ?: 0.0
            val manSale = manualSale.toDoubleOrNull() ?: 0.0
            val duesPaid = customerDuesPaid.toDoubleOrNull() ?: 0.0
            val paytmAmt = paytm.toDoubleOrNull() ?: 0.0
            val phonepeAmt = phonepe.toDoubleOrNull() ?: 0.0
            val gpayAmt = gpay.toDoubleOrNull() ?: 0.0
            val bank = bankDeposit.toDoubleOrNull() ?: 0.0
            val homeAmt = home.toDoubleOrNull() ?: 0.0
            val otherExp = otherExpenseTotal.toDoubleOrNull() ?: 0.0
            val salary = staffSalaryTotal.toDoubleOrNull() ?: 0.0
            val duesGivenAmt = duesGiven.toDoubleOrNull() ?: 0.0
            
            opening + compSale + manSale + duesPaid - paytmAmt - phonepeAmt - gpayAmt - bank - homeAmt - otherExp - salary - duesGivenAmt
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Rokar Entry") },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
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
            // Date and Opening Balance
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
                        text = "Daily Financial Entry",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    OutlinedTextField(
                        value = date,
                        onValueChange = { date = it },
                        label = { Text("Date") },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = { Icon(Icons.Default.DateRange, contentDescription = null) }
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = openingBalance,
                        onValueChange = { openingBalance = it },
                        label = { Text("Opening Balance") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.AccountBalance, contentDescription = null) }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Income Section
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
                        text = "Income",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = computerSale,
                        onValueChange = { computerSale = it },
                        label = { Text("Computer Sale") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.Computer, contentDescription = null) }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    OutlinedTextField(
                        value = manualSale,
                        onValueChange = { manualSale = it },
                        label = { Text("Manual Sale") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.ShoppingCart, contentDescription = null) }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    OutlinedTextField(
                        value = customerDuesPaid,
                        onValueChange = { customerDuesPaid = it },
                        label = { Text("Customer Dues Paid") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.Payment, contentDescription = null) }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Digital Payments Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Digital Payments",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = paytm,
                            onValueChange = { paytm = it },
                            label = { Text("Paytm") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                            )
                        )
                        
                        OutlinedTextField(
                            value = phonepe,
                            onValueChange = { phonepe = it },
                            label = { Text("PhonePe") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                            )
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = gpay,
                            onValueChange = { gpay = it },
                            label = { Text("GPay") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                            )
                        )
                        
                        OutlinedTextField(
                            value = bankDeposit,
                            onValueChange = { bankDeposit = it },
                            label = { Text("Bank Deposit") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                                keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                            )
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    OutlinedTextField(
                        value = home,
                        onValueChange = { home = it },
                        label = { Text("Home") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        )
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Expenses Section
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp)
                ) {
                    Text(
                        text = "Expenses",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    OutlinedTextField(
                        value = otherExpenseTotal,
                        onValueChange = { otherExpenseTotal = it },
                        label = { Text("Other Expenses Total") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.Receipt, contentDescription = null) }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    OutlinedTextField(
                        value = staffSalaryTotal,
                        onValueChange = { staffSalaryTotal = it },
                        label = { Text("Staff Salary Total") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.People, contentDescription = null) }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    OutlinedTextField(
                        value = duesGiven,
                        onValueChange = { duesGiven = it },
                        label = { Text("Dues Given") },
                        modifier = Modifier.fillMaxWidth(),
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        leadingIcon = { Icon(Icons.Default.MoneyOff, contentDescription = null) }
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Closing Balance Display
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Closing Balance",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Text(
                        text = "₹${String.format("%.2f", closingBalance.value)}",
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // Submit Button
            Button(
                onClick = {
                    // TODO: Implement rokar entry submission
                    isSubmitting = true
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = openingBalance.isNotEmpty() && !isSubmitting
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text("Save Rokar Entry")
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

