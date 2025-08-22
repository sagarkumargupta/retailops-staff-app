package com.retailops.staff.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "expenses")
data class ExpenseEntity(
    @PrimaryKey
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
    val receiptImagePath: String?,
    val isSynced: Boolean = false,
    val lastSyncTime: Long = System.currentTimeMillis()
)

