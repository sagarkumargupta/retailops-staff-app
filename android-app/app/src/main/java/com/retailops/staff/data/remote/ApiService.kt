package com.retailops.staff.data.remote

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.retailops.staff.data.models.*
import kotlinx.coroutines.tasks.await
import java.util.*

class ApiService {
    private val db = FirebaseFirestore.getInstance()

    // Authentication
    suspend fun login(email: String, password: String): LoginResponse? {
        return try {
            // Implement Firebase Auth login
            // For now, return mock data
            null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // Users
    suspend fun getUsers(): List<User> {
        return try {
            val snapshot = db.collection("users").get().await()
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(User::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun getUserById(userId: String): User? {
        return try {
            val doc = db.collection("users").document(userId).get().await()
            doc.toObject(User::class.java)?.copy(id = doc.id)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // Stores
    suspend fun getStores(): List<Store> {
        return try {
            val snapshot = db.collection("stores").get().await()
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(Store::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    // Attendance
    suspend fun getAttendance(userId: String): List<Attendance> {
        return try {
            val snapshot = db.collection("attendance")
                .whereEqualTo("userId", userId)
                .orderBy("date", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(Attendance::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun uploadAttendance(attendance: Attendance): Boolean {
        return try {
            val docRef = if (attendance.id.isNotEmpty()) {
                db.collection("attendance").document(attendance.id)
            } else {
                db.collection("attendance").document()
            }
            
            docRef.set(attendance.copy(id = docRef.id)).await()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Sales
    suspend fun getSales(storeId: String): List<Sale> {
        return try {
            val snapshot = db.collection("sales")
                .whereEqualTo("storeId", storeId)
                .orderBy("date", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(Sale::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun uploadSale(sale: Sale): Boolean {
        return try {
            val docRef = if (sale.id.isNotEmpty()) {
                db.collection("sales").document(sale.id)
            } else {
                db.collection("sales").document()
            }
            
            docRef.set(sale.copy(id = docRef.id)).await()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Expenses
    suspend fun getExpenses(storeId: String): List<Expense> {
        return try {
            val snapshot = db.collection("other_expenses")
                .whereEqualTo("storeId", storeId)
                .orderBy("date", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(Expense::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun uploadExpense(expense: Expense): Boolean {
        return try {
            val docRef = if (expense.id.isNotEmpty()) {
                db.collection("other_expenses").document(expense.id)
            } else {
                db.collection("other_expenses").document()
            }
            
            docRef.set(expense.copy(id = docRef.id)).await()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Salary Requests
    suspend fun getSalaryRequests(userId: String): List<SalaryRequest> {
        return try {
            val snapshot = db.collection("salary_requests")
                .whereEqualTo("userId", userId)
                .orderBy("requestedDate", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(SalaryRequest::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun uploadSalaryRequest(salaryRequest: SalaryRequest): Boolean {
        return try {
            val docRef = if (salaryRequest.id.isNotEmpty()) {
                db.collection("salary_requests").document(salaryRequest.id)
            } else {
                db.collection("salary_requests").document()
            }
            
            docRef.set(salaryRequest.copy(id = docRef.id)).await()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Leave Requests
    suspend fun getLeaveRequests(userId: String): List<LeaveRequest> {
        return try {
            val snapshot = db.collection("leave_requests")
                .whereEqualTo("userId", userId)
                .orderBy("startDate", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(LeaveRequest::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun uploadLeaveRequest(leaveRequest: LeaveRequest): Boolean {
        return try {
            val docRef = if (leaveRequest.id.isNotEmpty()) {
                db.collection("leave_requests").document(leaveRequest.id)
            } else {
                db.collection("leave_requests").document()
            }
            
            docRef.set(leaveRequest.copy(id = docRef.id)).await()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Targets
    suspend fun getTargets(userId: String): List<Target> {
        return try {
            val snapshot = db.collection("targets")
                .whereEqualTo("userId", userId)
                .orderBy("year", Query.Direction.DESCENDING)
                .orderBy("month", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(Target::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    // Rokar Entries
    suspend fun getRokarEntries(storeId: String): List<RokarEntry> {
        return try {
            val snapshot = db.collection("rokar")
                .whereEqualTo("storeId", storeId)
                .orderBy("date", Query.Direction.DESCENDING)
                .get().await()
            
            snapshot.documents.mapNotNull { doc ->
                doc.toObject(RokarEntry::class.java)?.copy(id = doc.id)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    suspend fun uploadRokarEntry(rokarEntry: RokarEntry): Boolean {
        return try {
            val docRef = if (rokarEntry.id.isNotEmpty()) {
                db.collection("rokar").document(rokarEntry.id)
            } else {
                db.collection("rokar").document()
            }
            
            docRef.set(rokarEntry.copy(id = docRef.id)).await()
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    // Utility functions
    suspend fun checkConnection(): Boolean {
        return try {
            db.collection("users").limit(1).get().await()
            true
        } catch (e: Exception) {
            false
        }
    }
}
