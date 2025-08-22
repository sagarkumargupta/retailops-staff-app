package com.retailops.staff.data.local.dao

import androidx.room.*
import com.retailops.staff.data.local.entities.AttendanceEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {
    @Query("SELECT * FROM attendance WHERE userId = :userId AND date = :date")
    suspend fun getAttendanceByUserAndDate(userId: String, date: String): AttendanceEntity?
    
    @Query("SELECT * FROM attendance WHERE storeId = :storeId AND date = :date")
    suspend fun getAttendanceByStoreAndDate(storeId: String, date: String): List<AttendanceEntity>
    
    @Query("SELECT * FROM attendance WHERE userId = :userId ORDER BY date DESC")
    fun getAttendanceHistory(userId: String): Flow<List<AttendanceEntity>>
    
    @Query("SELECT * FROM attendance WHERE userId = :userId AND date >= :startDate AND date <= :endDate")
    suspend fun getAttendanceByDateRange(userId: String, startDate: String, endDate: String): List<AttendanceEntity>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAttendance(attendance: AttendanceEntity)
    
    @Update
    suspend fun updateAttendance(attendance: AttendanceEntity)
    
    @Delete
    suspend fun deleteAttendance(attendance: AttendanceEntity)
    
    @Query("SELECT * FROM attendance WHERE isSynced = 0")
    fun getUnsyncedAttendance(): Flow<List<AttendanceEntity>>
    
    @Query("UPDATE attendance SET isSynced = 1, lastSyncTime = :syncTime WHERE id = :attendanceId")
    suspend fun markAttendanceSynced(attendanceId: String, syncTime: Long = System.currentTimeMillis())
    
    @Query("SELECT COUNT(*) FROM attendance WHERE userId = :userId AND date = :date AND status = 'PRESENT'")
    suspend fun getPresentDaysCount(userId: String, date: String): Int
}

