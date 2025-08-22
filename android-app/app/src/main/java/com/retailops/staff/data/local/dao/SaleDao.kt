package com.retailops.staff.data.local.dao

import androidx.room.*
import com.retailops.staff.data.local.entities.SaleEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface SaleDao {
    @Query("SELECT * FROM sales WHERE storeId = :storeId AND date = :date")
    suspend fun getSalesByStoreAndDate(storeId: String, date: String): List<SaleEntity>
    
    @Query("SELECT * FROM sales WHERE storeId = :storeId ORDER BY date DESC")
    fun getSalesHistory(storeId: String): Flow<List<SaleEntity>>
    
    @Query("SELECT * FROM sales WHERE storeId = :storeId AND date >= :startDate AND date <= :endDate")
    suspend fun getSalesByDateRange(storeId: String, startDate: String, endDate: String): List<SaleEntity>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSale(sale: SaleEntity)
    
    @Update
    suspend fun updateSale(sale: SaleEntity)
    
    @Delete
    suspend fun deleteSale(sale: SaleEntity)
    
    @Query("SELECT * FROM sales WHERE isSynced = 0")
    fun getUnsyncedSales(): Flow<List<SaleEntity>>
    
    @Query("UPDATE sales SET isSynced = 1, lastSyncTime = :syncTime WHERE id = :saleId")
    suspend fun markSaleSynced(saleId: String, syncTime: Long = System.currentTimeMillis())
    
    @Query("SELECT SUM(amount) FROM sales WHERE storeId = :storeId AND date = :date")
    suspend fun getTotalSalesForDate(storeId: String, date: String): Double?
}

