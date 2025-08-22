package com.retailops.staff.data.local.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey
    val id: String,
    val email: String,
    val name: String,
    val role: String,
    val assignedStore: String?,
    val phone: String?,
    val address: String?,
    val salary: Double,
    val joiningDate: String?,
    val lastSyncTime: Long = System.currentTimeMillis()
)

