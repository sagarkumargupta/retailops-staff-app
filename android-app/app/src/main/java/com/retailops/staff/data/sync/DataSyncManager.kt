package com.retailops.staff.data.sync

import android.content.Context
import android.util.Log
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.retailops.staff.data.local.AppDatabase
import com.retailops.staff.data.local.entities.*
import com.retailops.staff.firebase.FirebaseConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.util.*

class DataSyncManager(private val context: Context) {
    private val database = AppDatabase.getDatabase(context)
    private val firestore = FirebaseConfig.getFirestore()
    
    companion object {
        private const val TAG = "DataSyncManager"
    }
    
    // Sync status tracking
    suspend fun getSyncStatus(): Map<String, Int> {
        return withContext(Dispatchers.IO) {
            val status = mutableMapOf<String, Int>()
            
            // Count unsynced records for each table
            database.userDao().getUnsyncedUsers().collect { users ->
                status["users"] = users.size
            }
            
            database.attendanceDao().getUnsyncedAttendance().collect { attendance ->
                status["attendance"] = attendance.size
            }
            
            database.saleDao().getUnsyncedSales().collect { sales ->
                status["sales"] = sales.size
            }
            
            database.expenseDao().getUnsyncedExpenses().collect { expenses ->
                status["expenses"] = expenses.size
            }
            
            database.rokarDao().getUnsyncedRokar().collect { rokar ->
                status["rokar"] = rokar.size
            }
            
            status
        }
    }
    
    // Manual sync trigger
    suspend fun manualSync(onComplete: (Boolean) -> Unit) {
        try {
            withContext(Dispatchers.IO) {
                // Upload local changes
                uploadLocalChanges()
                
                // Download remote changes
                downloadRemoteChanges()
                
                onComplete(true)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Manual sync failed", e)
            onComplete(false)
        }
    }
    
    // Upload local changes to Firebase
    private suspend fun uploadLocalChanges() {
        // Upload users
        database.userDao().getUnsyncedUsers().collect { users ->
            users.forEach { user ->
                try {
                    val userData = mapOf(
                        "id" to user.id,
                        "email" to user.email,
                        "name" to user.name,
                        "role" to user.role,
                        "assignedStore" to user.assignedStore,
                        "phone" to user.phone,
                        "address" to user.address,
                        "salary" to user.salary,
                        "joiningDate" to user.joiningDate
                    )
                    
                    firestore.collection("users").document(user.id).set(userData).await()
                    database.userDao().markUserSynced(user.id)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to upload user ${user.id}", e)
                }
            }
        }
        
        // Upload attendance
        database.attendanceDao().getUnsyncedAttendance().collect { attendance ->
            attendance.forEach { att ->
                try {
                    val attData = mapOf(
                        "id" to att.id,
                        "userId" to att.userId,
                        "storeId" to att.storeId,
                        "date" to att.date,
                        "checkInTime" to att.checkInTime,
                        "checkOutTime" to att.checkOutTime,
                        "status" to att.status,
                        "location" to att.location,
                        "latitude" to att.latitude,
                        "longitude" to att.longitude,
                        "dayType" to att.dayType,
                        "dayFraction" to att.dayFraction
                    )
                    
                    firestore.collection("attendance").document(att.id).set(attData).await()
                    database.attendanceDao().markAttendanceSynced(att.id)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to upload attendance ${att.id}", e)
                }
            }
        }
        
        // Upload sales
        database.saleDao().getUnsyncedSales().collect { sales ->
            sales.forEach { sale ->
                try {
                    val saleData = mapOf(
                        "id" to sale.id,
                        "storeId" to sale.storeId,
                        "date" to sale.date,
                        "amount" to sale.amount,
                        "category" to sale.category,
                        "paymentMethod" to sale.paymentMethod,
                        "customerName" to sale.customerName,
                        "customerPhone" to sale.customerPhone,
                        "notes" to sale.notes
                    )
                    
                    firestore.collection("sales").document(sale.id).set(saleData).await()
                    database.saleDao().markSaleSynced(sale.id)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to upload sale ${sale.id}", e)
                }
            }
        }
        
        // Upload expenses
        database.expenseDao().getUnsyncedExpenses().collect { expenses ->
            expenses.forEach { expense ->
                try {
                    val expenseData = mapOf(
                        "id" to expense.id,
                        "storeId" to expense.storeId,
                        "date" to expense.date,
                        "amount" to expense.amount,
                        "category" to expense.category,
                        "description" to expense.description,
                        "requestedBy" to expense.requestedBy,
                        "status" to expense.status,
                        "approvedBy" to expense.approvedBy,
                        "approvedAt" to expense.approvedAt,
                        "receiptImagePath" to expense.receiptImagePath
                    )
                    
                    firestore.collection("other_expenses").document(expense.id).set(expenseData).await()
                    database.expenseDao().markExpenseSynced(expense.id)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to upload expense ${expense.id}", e)
                }
            }
        }
        
        // Upload rokar entries
        database.rokarDao().getUnsyncedRokar().collect { rokarEntries ->
            rokarEntries.forEach { rokar ->
                try {
                    val rokarData = mapOf(
                        "id" to rokar.id,
                        "storeId" to rokar.storeId,
                        "date" to rokar.date,
                        "openingBalance" to rokar.openingBalance,
                        "computerSale" to rokar.computerSale,
                        "manualSale" to rokar.manualSale,
                        "manualBilled" to rokar.manualBilled,
                        "customerDuesPaid" to rokar.customerDuesPaid,
                        "duesGiven" to rokar.duesGiven,
                        "paytm" to rokar.paytm,
                        "phonepe" to rokar.phonepe,
                        "gpay" to rokar.gpay,
                        "bankDeposit" to rokar.bankDeposit,
                        "home" to rokar.home,
                        "expenseBreakup" to rokar.expenseBreakup,
                        "otherExpenseTotal" to rokar.otherExpenseTotal,
                        "staffSalaryTotal" to rokar.staffSalaryTotal,
                        "closingBalance" to rokar.closingBalance
                    )
                    
                    firestore.collection("rokar").document(rokar.id).set(rokarData).await()
                    database.rokarDao().markRokarSynced(rokar.id)
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to upload rokar ${rokar.id}", e)
                }
            }
        }
    }
    
    // Download remote changes from Firebase
    private suspend fun downloadRemoteChanges() {
        // Download users
        try {
            val usersSnapshot = firestore.collection("users").get().await()
            usersSnapshot.documents.forEach { doc ->
                val userData = doc.data
                if (userData != null) {
                    val user = UserEntity(
                        id = doc.id,
                        email = userData["email"] as? String ?: "",
                        name = userData["name"] as? String ?: "",
                        role = userData["role"] as? String ?: "",
                        assignedStore = userData["assignedStore"] as? String,
                        phone = userData["phone"] as? String,
                        address = userData["address"] as? String,
                        salary = (userData["salary"] as? Number)?.toDouble() ?: 0.0,
                        joiningDate = userData["joiningDate"] as? String
                    )
                    database.userDao().insertUser(user)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download users", e)
        }
        
        // Download attendance
        try {
            val attendanceSnapshot = firestore.collection("attendance").get().await()
            attendanceSnapshot.documents.forEach { doc ->
                val attData = doc.data
                if (attData != null) {
                    val attendance = AttendanceEntity(
                        id = doc.id,
                        userId = attData["userId"] as? String ?: "",
                        storeId = attData["storeId"] as? String ?: "",
                        date = attData["date"] as? String ?: "",
                        checkInTime = attData["checkInTime"] as? String,
                        checkOutTime = attData["checkOutTime"] as? String,
                        status = attData["status"] as? String ?: "",
                        location = attData["location"] as? String,
                        latitude = (attData["latitude"] as? Number)?.toDouble(),
                        longitude = (attData["longitude"] as? Number)?.toDouble(),
                        dayType = attData["dayType"] as? String ?: "FULL",
                        dayFraction = (attData["dayFraction"] as? Number)?.toDouble() ?: 1.0
                    )
                    database.attendanceDao().insertAttendance(attendance)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download attendance", e)
        }
        
        // Download sales
        try {
            val salesSnapshot = firestore.collection("sales").get().await()
            salesSnapshot.documents.forEach { doc ->
                val saleData = doc.data
                if (saleData != null) {
                    val sale = SaleEntity(
                        id = doc.id,
                        storeId = saleData["storeId"] as? String ?: "",
                        date = saleData["date"] as? String ?: "",
                        amount = (saleData["amount"] as? Number)?.toDouble() ?: 0.0,
                        category = saleData["category"] as? String ?: "",
                        paymentMethod = saleData["paymentMethod"] as? String ?: "",
                        customerName = saleData["customerName"] as? String,
                        customerPhone = saleData["customerPhone"] as? String,
                        notes = saleData["notes"] as? String
                    )
                    database.saleDao().insertSale(sale)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download sales", e)
        }
        
        // Download expenses
        try {
            val expensesSnapshot = firestore.collection("other_expenses").get().await()
            expensesSnapshot.documents.forEach { doc ->
                val expenseData = doc.data
                if (expenseData != null) {
                    val expense = ExpenseEntity(
                        id = doc.id,
                        storeId = expenseData["storeId"] as? String ?: "",
                        date = expenseData["date"] as? String ?: "",
                        amount = (expenseData["amount"] as? Number)?.toDouble() ?: 0.0,
                        category = expenseData["category"] as? String ?: "",
                        description = expenseData["description"] as? String ?: "",
                        requestedBy = expenseData["requestedBy"] as? String ?: "",
                        status = expenseData["status"] as? String ?: "",
                        approvedBy = expenseData["approvedBy"] as? String,
                        approvedAt = expenseData["approvedAt"] as? String,
                        receiptImagePath = expenseData["receiptImagePath"] as? String
                    )
                    database.expenseDao().insertExpense(expense)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download expenses", e)
        }
        
        // Download rokar entries
        try {
            val rokarSnapshot = firestore.collection("rokar").get().await()
            rokarSnapshot.documents.forEach { doc ->
                val rokarData = doc.data
                if (rokarData != null) {
                    val rokar = RokarEntity(
                        id = doc.id,
                        storeId = rokarData["storeId"] as? String ?: "",
                        date = rokarData["date"] as? String ?: "",
                        openingBalance = (rokarData["openingBalance"] as? Number)?.toDouble() ?: 0.0,
                        computerSale = (rokarData["computerSale"] as? Number)?.toDouble() ?: 0.0,
                        manualSale = (rokarData["manualSale"] as? Number)?.toDouble() ?: 0.0,
                        manualBilled = (rokarData["manualBilled"] as? Number)?.toDouble() ?: 0.0,
                        customerDuesPaid = (rokarData["customerDuesPaid"] as? Number)?.toDouble() ?: 0.0,
                        duesGiven = (rokarData["duesGiven"] as? Number)?.toDouble() ?: 0.0,
                        paytm = (rokarData["paytm"] as? Number)?.toDouble() ?: 0.0,
                        phonepe = (rokarData["phonepe"] as? Number)?.toDouble() ?: 0.0,
                        gpay = (rokarData["gpay"] as? Number)?.toDouble() ?: 0.0,
                        bankDeposit = (rokarData["bankDeposit"] as? Number)?.toDouble() ?: 0.0,
                        home = (rokarData["home"] as? Number)?.toDouble() ?: 0.0,
                        expenseBreakup = rokarData["expenseBreakup"] as? String ?: "{}",
                        otherExpenseTotal = (rokarData["otherExpenseTotal"] as? Number)?.toDouble() ?: 0.0,
                        staffSalaryTotal = (rokarData["staffSalaryTotal"] as? Number)?.toDouble() ?: 0.0,
                        closingBalance = (rokarData["closingBalance"] as? Number)?.toDouble() ?: 0.0
                    )
                    database.rokarDao().insertRokar(rokar)
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to download rokar entries", e)
        }
    }
}
