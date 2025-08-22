package com.retailops.staff.data.local.dao

import androidx.room.*
import com.retailops.staff.data.local.entities.RokarEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface RokarDao {
    @Query("SELECT * FROM rokar_entries WHERE storeId = :storeId AND date = :date")
    suspend fun getRokarByStoreAndDate(storeId: String, date: String): RokarEntity?
    
    @Query("SELECT * FROM rokar_entries WHERE storeId = :storeId ORDER BY date DESC")
    fun getRokarHistory(storeId: String): Flow<List<RokarEntity>>
    
    @Query("SELECT * FROM rokar_entries WHERE storeId = :storeId AND date >= :startDate AND date <= :endDate")
    suspend fun getRokarByDateRange(storeId: String, startDate: String, endDate: String): List<RokarEntity>
    
    @Query("SELECT * FROM rokar_entries WHERE storeId = :storeId AND date < :date ORDER BY date DESC LIMIT 1")
    suspend fun getPreviousDayRokar(storeId: String, date: String): RokarEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRokar(rokar: RokarEntity)
    
    @Update
    suspend fun updateRokar(rokar: RokarEntity)
    
    @Delete
    suspend fun deleteRokar(rokar: RokarEntity)
    
    @Query("SELECT * FROM rokar_entries WHERE isSynced = 0")
    fun getUnsyncedRokar(): Flow<List<RokarEntity>>
    
    @Query("UPDATE rokar_entries SET isSynced = 1, lastSyncTime = :syncTime WHERE id = :rokarId")
    suspend fun markRokarSynced(rokarId: String, syncTime: Long = System.currentTimeMillis())
    
    @Query("SELECT SUM(computerSale + manualSale) FROM rokar_entries WHERE storeId = :storeId AND date >= :startDate AND date <= :endDate")
    suspend fun getTotalSalesForPeriod(storeId: String, startDate: String, endDate: String): Double?
}

