package com.retailops.staff.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sales")
data class SaleEntity(
    @PrimaryKey
    val id: String,
    val storeId: String,
    val date: String,
    val amount: Double,
    val category: String,
    val paymentMethod: String,
    val customerName: String?,
    val customerPhone: String?,
    val notes: String?,
    val isSynced: Boolean = false,
    val lastSyncTime: Long = System.currentTimeMillis()
)

