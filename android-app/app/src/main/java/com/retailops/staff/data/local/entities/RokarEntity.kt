package com.retailops.staff.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "rokar_entries")
data class RokarEntity(
    @PrimaryKey
    val id: String,
    val storeId: String,
    val date: String,
    val openingBalance: Double,
    val computerSale: Double,
    val manualSale: Double,
    val manualBilled: Double,
    val customerDuesPaid: Double,
    val duesGiven: Double,
    val paytm: Double,
    val phonepe: Double,
    val gpay: Double,
    val bankDeposit: Double,
    val home: Double,
    val expenseBreakup: String, // JSON string
    val otherExpenseTotal: Double,
    val staffSalaryTotal: Double,
    val closingBalance: Double,
    val isSynced: Boolean = false,
    val lastSyncTime: Long = System.currentTimeMillis()
)

