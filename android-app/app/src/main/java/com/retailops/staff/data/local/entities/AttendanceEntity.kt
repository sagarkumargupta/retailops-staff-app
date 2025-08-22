package com.retailops.staff.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "attendance")
data class AttendanceEntity(
    @PrimaryKey
    val id: String,
    val userId: String,
    val storeId: String,
    val date: String,
    val checkInTime: String?,
    val checkOutTime: String?,
    val status: String,
    val location: String?,
    val latitude: Double?,
    val longitude: Double?,
    val dayType: String = "FULL",
    val dayFraction: Double = 1.0,
    val isSynced: Boolean = false,
    val lastSyncTime: Long = System.currentTimeMillis()
)

