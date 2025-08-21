package com.retailops.staff.data.sync

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.retailops.staff.data.local.DatabaseHelper
import com.retailops.staff.data.models.*
import com.retailops.staff.data.remote.ApiService
import kotlinx.coroutines.*
import java.util.*

class DataSyncManager(
    private val context: Context,
    private val databaseHelper: DatabaseHelper
) {
    private val apiService = ApiService()
    private val syncScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var isSyncing = false

    // Check if device is online
    private fun isOnline(): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val activeNetwork = connectivityManager.getNetworkCapabilities(network) ?: return false
        
        return when {
            activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> true
            activeNetwork.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> true
            else -> false
        }
    }

    // Sync all data
    suspend fun syncAllData() {
        if (isSyncing || !isOnline()) return
        
        isSyncing = true
        try {
            // Sync in order of dependencies
            syncUsers()
            syncStores()
            syncAttendance()
            syncSales()
            syncExpenses()
            syncSalaryRequests()
            syncLeaveRequests()
            syncTargets()
            syncRokarEntries()
            
            // Upload local changes
            uploadLocalChanges()
            
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isSyncing = false
        }
    }

    // Sync users from server
    private suspend fun syncUsers() {
        try {
            val users = apiService.getUsers()
            users.forEach { user ->
                databaseHelper.insertUser(user)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync stores from server
    private suspend fun syncStores() {
        try {
            val stores = apiService.getStores()
            stores.forEach { store ->
                // Insert store logic here
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync attendance from server
    private suspend fun syncAttendance() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser != null) {
                val attendance = apiService.getAttendance(currentUser.id)
                attendance.forEach { att ->
                    databaseHelper.insertAttendance(att)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync sales from server
    private suspend fun syncSales() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser?.assignedStore != null) {
                val sales = apiService.getSales(currentUser.assignedStore)
                sales.forEach { sale ->
                    databaseHelper.insertSale(sale)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync expenses from server
    private suspend fun syncExpenses() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser?.assignedStore != null) {
                val expenses = apiService.getExpenses(currentUser.assignedStore)
                expenses.forEach { expense ->
                    databaseHelper.insertExpense(expense)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync salary requests from server
    private suspend fun syncSalaryRequests() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser != null) {
                val requests = apiService.getSalaryRequests(currentUser.id)
                requests.forEach { request ->
                    databaseHelper.insertSalaryRequest(request)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync leave requests from server
    private suspend fun syncLeaveRequests() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser != null) {
                val requests = apiService.getLeaveRequests(currentUser.id)
                requests.forEach { request ->
                    databaseHelper.insertLeaveRequest(request)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync targets from server
    private suspend fun syncTargets() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser != null) {
                val targets = apiService.getTargets(currentUser.id)
                targets.forEach { target ->
                    databaseHelper.insertTarget(target)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Sync rokar entries from server
    private suspend fun syncRokarEntries() {
        try {
            val currentUser = getCurrentUser()
            if (currentUser?.assignedStore != null) {
                val entries = apiService.getRokarEntries(currentUser.assignedStore)
                entries.forEach { entry ->
                    databaseHelper.insertRokarEntry(entry)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Upload local changes to server
    private suspend fun uploadLocalChanges() {
        try {
            // Upload unsynced attendance
            val unsyncedAttendance = databaseHelper.getUnsyncedAttendance()
            unsyncedAttendance.forEach { attendance ->
                try {
                    apiService.uploadAttendance(attendance)
                    databaseHelper.markAsSynced(DatabaseHelper.TABLE_ATTENDANCE, attendance.id)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            // Upload unsynced sales
            val unsyncedSales = databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_SALES)
            // Similar logic for sales

            // Upload unsynced expenses
            val unsyncedExpenses = databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_EXPENSES)
            // Similar logic for expenses

            // Upload unsynced salary requests
            val unsyncedSalaryRequests = databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_SALARY_REQUESTS)
            // Similar logic for salary requests

            // Upload unsynced leave requests
            val unsyncedLeaveRequests = databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_LEAVE_REQUESTS)
            // Similar logic for leave requests

            // Upload unsynced rokar entries
            val unsyncedRokarEntries = databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_ROKAR_ENTRIES)
            // Similar logic for rokar entries

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // Get current user from local storage
    private fun getCurrentUser(): User? {
        // This should get the current user from SharedPreferences or local storage
        // For now, return null - implement based on your auth system
        return null
    }

    // Start background sync
    fun startBackgroundSync() {
        syncScope.launch {
            while (true) {
                if (isOnline()) {
                    syncAllData()
                }
                delay(30 * 60 * 1000) // Sync every 30 minutes
            }
        }
    }

    // Manual sync
    fun manualSync(onComplete: (Boolean) -> Unit) {
        syncScope.launch {
            try {
                syncAllData()
                withContext(Dispatchers.Main) {
                    onComplete(true)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    onComplete(false)
                }
            }
        }
    }

    // Get sync status
    fun getSyncStatus(): Map<String, Int> {
        return mapOf(
            "attendance" to databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_ATTENDANCE),
            "sales" to databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_SALES),
            "expenses" to databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_EXPENSES),
            "salary_requests" to databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_SALARY_REQUESTS),
            "leave_requests" to databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_LEAVE_REQUESTS),
            "rokar_entries" to databaseHelper.getUnsyncedRecords(DatabaseHelper.TABLE_ROKAR_ENTRIES)
        )
    }

    // Cleanup
    fun cleanup() {
        syncScope.cancel()
    }
}
