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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TargetsScreen(
    navController: NavController,
    database: AppDatabase,
    syncManager: DataSyncManager
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sales Targets") },
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
            // Monthly Target Overview
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
                        text = "December 2024 Target",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        TargetProgressCard(
                            title = "Daily Target",
                            target = "₹5,000",
                            achieved = "₹3,200",
                            progress = 0.64f
                        )
                        
                        TargetProgressCard(
                            title = "Weekly Target",
                            target = "₹35,000",
                            achieved = "₹22,400",
                            progress = 0.64f
                        )
                    }
                    
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    TargetProgressCard(
                        title = "Monthly Target",
                        target = "₹150,000",
                        achieved = "₹96,000",
                        progress = 0.64f
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Target Categories
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
                        text = "Target Categories",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    TargetCategoryItem(
                        category = "Computer Sales",
                        target = "₹80,000",
                        achieved = "₹52,000",
                        progress = 0.65f
                    )
                    
                    Divider(modifier = Modifier.padding(vertical = 8.dp))
                    
                    TargetCategoryItem(
                        category = "Manual Sales",
                        target = "₹50,000",
                        achieved = "₹32,000",
                        progress = 0.64f
                    )
                    
                    Divider(modifier = Modifier.padding(vertical = 8.dp))
                    
                    TargetCategoryItem(
                        category = "Accessories",
                        target = "₹20,000",
                        achieved = "₹12,000",
                        progress = 0.60f
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Performance Insights
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
                        text = "Performance Insights",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    InsightItem(
                        icon = Icons.Default.TrendingUp,
                        title = "On Track",
                        description = "You're performing well and on track to meet your monthly target"
                    )
                    
                    InsightItem(
                        icon = Icons.Default.Schedule,
                        title = "Best Performance",
                        description = "Your best day was Tuesday with ₹4,200 in sales"
                    )
                    
                    InsightItem(
                        icon = Icons.Default.Lightbulb,
                        title = "Recommendation",
                        description = "Focus on computer sales to maximize your commission"
                    )
                }
            }
        }
    }
}

@Composable
fun TargetProgressCard(
    title: String,
    target: String,
    achieved: String,
    progress: Float
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
                text = title,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            Text(
                text = achieved,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            
            Text(
                text = "of $target",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
            )
            
            Spacer(modifier = Modifier.height(8.dp))
            
            LinearProgressIndicator(
                progress = progress,
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.primary
            )
            
            Text(
                text = "${(progress * 100).toInt()}%",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
fun TargetCategoryItem(
    category: String,
    target: String,
    achieved: String,
    progress: Float
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = category,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            
            Text(
                text = "$achieved / $target",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
        
        Column(
            horizontalAlignment = Alignment.End
        ) {
            Text(
                text = "${(progress * 100).toInt()}%",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            
            LinearProgressIndicator(
                progress = progress,
                modifier = Modifier.width(60.dp),
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
fun InsightItem(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    description: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            icon,
            contentDescription = null,
            modifier = Modifier.size(24.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        
        Spacer(modifier = Modifier.width(16.dp))
        
        Column(
            modifier = Modifier.weight(1f)
        ) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = description,
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
            )
        }
    }
}

