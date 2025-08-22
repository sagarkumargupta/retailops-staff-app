package com.retailops.staff.data.local.dao

import androidx.room.*
import com.retailops.staff.data.local.entities.ExpenseEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE requestedBy = :userId ORDER BY date DESC")
    fun getExpensesByUser(userId: String): Flow<List<ExpenseEntity>>
    
    @Query("SELECT * FROM expenses WHERE storeId = :storeId AND status = 'PENDING'")
    suspend fun getPendingExpenses(storeId: String): List<ExpenseEntity>
    
    @Query("SELECT * FROM expenses WHERE id = :expenseId")
    suspend fun getExpenseById(expenseId: String): ExpenseEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertExpense(expense: ExpenseEntity)
    
    @Update
    suspend fun updateExpense(expense: ExpenseEntity)
    
    @Delete
    suspend fun deleteExpense(expense: ExpenseEntity)
    
    @Query("SELECT * FROM expenses WHERE isSynced = 0")
    fun getUnsyncedExpenses(): Flow<List<ExpenseEntity>>
    
    @Query("UPDATE expenses SET isSynced = 1, lastSyncTime = :syncTime WHERE id = :expenseId")
    suspend fun markExpenseSynced(expenseId: String, syncTime: Long = System.currentTimeMillis())
    
    @Query("UPDATE expenses SET status = :status, approvedBy = :approvedBy, approvedAt = :approvedAt WHERE id = :expenseId")
    suspend fun updateExpenseStatus(expenseId: String, status: String, approvedBy: String?, approvedAt: String?)
}

