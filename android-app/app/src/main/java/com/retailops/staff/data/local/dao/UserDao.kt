package com.retailops.staff.data.local.dao

import androidx.room.*
import com.retailops.staff.data.local.entities.UserEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface UserDao {
    @Query("SELECT * FROM users WHERE id = :userId")
    suspend fun getUserById(userId: String): UserEntity?
    
    @Query("SELECT * FROM users WHERE email = :email")
    suspend fun getUserByEmail(email: String): UserEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUser(user: UserEntity)
    
    @Update
    suspend fun updateUser(user: UserEntity)
    
    @Delete
    suspend fun deleteUser(user: UserEntity)
    
    @Query("SELECT * FROM users WHERE isSynced = 0")
    fun getUnsyncedUsers(): Flow<List<UserEntity>>
    
    @Query("UPDATE users SET isSynced = 1, lastSyncTime = :syncTime WHERE id = :userId")
    suspend fun markUserSynced(userId: String, syncTime: Long = System.currentTimeMillis())
}

