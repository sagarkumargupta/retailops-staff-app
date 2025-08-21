package com.retailops.staff.data.local

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import com.retailops.staff.data.models.*

class DatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_NAME = "RetailOpsStaff.db"
        private const val DATABASE_VERSION = 1

        // Table names
        const val TABLE_USERS = "users"
        const val TABLE_STORES = "stores"
        const val TABLE_ATTENDANCE = "attendance"
        const val TABLE_SALES = "sales"
        const val TABLE_EXPENSES = "expenses"
        const val TABLE_SALARY_REQUESTS = "salary_requests"
        const val TABLE_LEAVE_REQUESTS = "leave_requests"
        const val TABLE_TARGETS = "targets"
        const val TABLE_ROKAR_ENTRIES = "rokar_entries"
        const val TABLE_SYNC_STATUS = "sync_status"
    }

    override fun onCreate(db: SQLiteDatabase) {
        // Users table
        db.execSQL("""
            CREATE TABLE $TABLE_USERS (
                id TEXT PRIMARY KEY,
                email TEXT,
                name TEXT,
                role TEXT,
                assignedStore TEXT,
                phone TEXT,
                address TEXT,
                salary REAL,
                joiningDate TEXT,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Stores table
        db.execSQL("""
            CREATE TABLE $TABLE_STORES (
                id TEXT PRIMARY KEY,
                name TEXT,
                brand TEXT,
                address TEXT,
                phone TEXT,
                managerId TEXT,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Attendance table
        db.execSQL("""
            CREATE TABLE $TABLE_ATTENDANCE (
                id TEXT PRIMARY KEY,
                userId TEXT,
                storeId TEXT,
                date TEXT,
                checkInTime TEXT,
                checkOutTime TEXT,
                status TEXT,
                location TEXT,
                isSynced INTEGER DEFAULT 0,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Sales table
        db.execSQL("""
            CREATE TABLE $TABLE_SALES (
                id TEXT PRIMARY KEY,
                storeId TEXT,
                date TEXT,
                amount REAL,
                category TEXT,
                paymentMethod TEXT,
                customerName TEXT,
                customerPhone TEXT,
                notes TEXT,
                isSynced INTEGER DEFAULT 0,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Expenses table
        db.execSQL("""
            CREATE TABLE $TABLE_EXPENSES (
                id TEXT PRIMARY KEY,
                storeId TEXT,
                date TEXT,
                amount REAL,
                category TEXT,
                description TEXT,
                requestedBy TEXT,
                status TEXT,
                approvedBy TEXT,
                approvedAt TEXT,
                isSynced INTEGER DEFAULT 0,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Salary requests table
        db.execSQL("""
            CREATE TABLE $TABLE_SALARY_REQUESTS (
                id TEXT PRIMARY KEY,
                userId TEXT,
                storeId TEXT,
                amount REAL,
                reason TEXT,
                requestedDate TEXT,
                status TEXT,
                approvedBy TEXT,
                approvedAt TEXT,
                isSynced INTEGER DEFAULT 0,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Leave requests table
        db.execSQL("""
            CREATE TABLE $TABLE_LEAVE_REQUESTS (
                id TEXT PRIMARY KEY,
                userId TEXT,
                storeId TEXT,
                startDate TEXT,
                endDate TEXT,
                reason TEXT,
                status TEXT,
                approvedBy TEXT,
                approvedAt TEXT,
                isSynced INTEGER DEFAULT 0,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Targets table
        db.execSQL("""
            CREATE TABLE $TABLE_TARGETS (
                id TEXT PRIMARY KEY,
                storeId TEXT,
                userId TEXT,
                month TEXT,
                year INTEGER,
                targetAmount REAL,
                achievedAmount REAL,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Rokar entries table
        db.execSQL("""
            CREATE TABLE $TABLE_ROKAR_ENTRIES (
                id TEXT PRIMARY KEY,
                storeId TEXT,
                date TEXT,
                openingBalance REAL,
                computerSale REAL,
                manualSale REAL,
                manualBilled REAL,
                customerDuesPaid REAL,
                duesGiven REAL,
                paytm REAL,
                phonepe REAL,
                gpay REAL,
                bankDeposit REAL,
                home REAL,
                expenseBreakup TEXT,
                otherExpenseTotal REAL,
                staffSalaryTotal REAL,
                closingBalance REAL,
                isSynced INTEGER DEFAULT 0,
                lastSyncTime INTEGER
            )
        """.trimIndent())

        // Sync status table
        db.execSQL("""
            CREATE TABLE $TABLE_SYNC_STATUS (
                tableName TEXT PRIMARY KEY,
                lastSyncTime INTEGER,
                isPending INTEGER DEFAULT 0
            )
        """.trimIndent())
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Handle database upgrades here
        db.execSQL("DROP TABLE IF EXISTS $TABLE_USERS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_STORES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ATTENDANCE")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SALES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_EXPENSES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SALARY_REQUESTS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_LEAVE_REQUESTS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_TARGETS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_ROKAR_ENTRIES")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SYNC_STATUS")
        onCreate(db)
    }

    // User operations
    fun insertUser(user: User) {
        val values = ContentValues().apply {
            put("id", user.id)
            put("email", user.email)
            put("name", user.name)
            put("role", user.role)
            put("assignedStore", user.assignedStore)
            put("phone", user.phone)
            put("address", user.address)
            put("salary", user.salary)
            put("joiningDate", user.joiningDate)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_USERS, null, values)
    }

    fun getUserById(userId: String): User? {
        val cursor = readableDatabase.query(
            TABLE_USERS,
            null,
            "id = ?",
            arrayOf(userId),
            null,
            null,
            null
        )
        return if (cursor.moveToFirst()) {
            User(
                id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                email = cursor.getString(cursor.getColumnIndexOrThrow("email")),
                name = cursor.getString(cursor.getColumnIndexOrThrow("name")),
                role = cursor.getString(cursor.getColumnIndexOrThrow("role")),
                assignedStore = cursor.getString(cursor.getColumnIndexOrThrow("assignedStore")),
                phone = cursor.getString(cursor.getColumnIndexOrThrow("phone")),
                address = cursor.getString(cursor.getColumnIndexOrThrow("address")),
                salary = cursor.getDouble(cursor.getColumnIndexOrThrow("salary")),
                joiningDate = cursor.getString(cursor.getColumnIndexOrThrow("joiningDate"))
            )
        } else null
    }

    // Attendance operations
    fun insertAttendance(attendance: Attendance) {
        val values = ContentValues().apply {
            put("id", attendance.id)
            put("userId", attendance.userId)
            put("storeId", attendance.storeId)
            put("date", attendance.date)
            put("checkInTime", attendance.checkInTime)
            put("checkOutTime", attendance.checkOutTime)
            put("status", attendance.status)
            put("location", attendance.location)
            put("isSynced", if (attendance.isSynced) 1 else 0)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_ATTENDANCE, null, values)
    }

    fun getAttendanceByDate(userId: String, date: String): Attendance? {
        val cursor = readableDatabase.query(
            TABLE_ATTENDANCE,
            null,
            "userId = ? AND date = ?",
            arrayOf(userId, date),
            null,
            null,
            null
        )
        return if (cursor.moveToFirst()) {
            Attendance(
                id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                userId = cursor.getString(cursor.getColumnIndexOrThrow("userId")),
                storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                date = cursor.getString(cursor.getColumnIndexOrThrow("date")),
                checkInTime = cursor.getString(cursor.getColumnIndexOrThrow("checkInTime")),
                checkOutTime = cursor.getString(cursor.getColumnIndexOrThrow("checkOutTime")),
                status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
                location = cursor.getString(cursor.getColumnIndexOrThrow("location")),
                isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
            )
        } else null
    }

    fun getUnsyncedAttendance(): List<Attendance> {
        val cursor = readableDatabase.query(
            TABLE_ATTENDANCE,
            null,
            "isSynced = 0",
            null,
            null,
            null,
            "date DESC"
        )
        val attendanceList = mutableListOf<Attendance>()
        while (cursor.moveToNext()) {
            attendanceList.add(
                Attendance(
                    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    userId = cursor.getString(cursor.getColumnIndexOrThrow("userId")),
                    storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                    date = cursor.getString(cursor.getColumnIndexOrThrow("date")),
                    checkInTime = cursor.getString(cursor.getColumnIndexOrThrow("checkInTime")),
                    checkOutTime = cursor.getString(cursor.getColumnIndexOrThrow("checkOutTime")),
                    status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
                    location = cursor.getString(cursor.getColumnIndexOrThrow("location")),
                    isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
                )
            )
        }
        cursor.close()
        return attendanceList
    }

    // Sales operations
    fun insertSale(sale: Sale) {
        val values = ContentValues().apply {
            put("id", sale.id)
            put("storeId", sale.storeId)
            put("date", sale.date)
            put("amount", sale.amount)
            put("category", sale.category)
            put("paymentMethod", sale.paymentMethod)
            put("customerName", sale.customerName)
            put("customerPhone", sale.customerPhone)
            put("notes", sale.notes)
            put("isSynced", if (sale.isSynced) 1 else 0)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_SALES, null, values)
    }

    fun getSalesByDate(storeId: String, date: String): List<Sale> {
        val cursor = readableDatabase.query(
            TABLE_SALES,
            null,
            "storeId = ? AND date = ?",
            arrayOf(storeId, date),
            null,
            null,
            "lastSyncTime DESC"
        )
        val salesList = mutableListOf<Sale>()
        while (cursor.moveToNext()) {
            salesList.add(
                Sale(
                    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                    date = cursor.getString(cursor.getColumnIndexOrThrow("date")),
                    amount = cursor.getDouble(cursor.getColumnIndexOrThrow("amount")),
                    category = cursor.getString(cursor.getColumnIndexOrThrow("category")),
                    paymentMethod = cursor.getString(cursor.getColumnIndexOrThrow("paymentMethod")),
                    customerName = cursor.getString(cursor.getColumnIndexOrThrow("customerName")),
                    customerPhone = cursor.getString(cursor.getColumnIndexOrThrow("customerPhone")),
                    notes = cursor.getString(cursor.getColumnIndexOrThrow("notes")),
                    isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
                )
            )
        }
        cursor.close()
        return salesList
    }

    // Expense operations
    fun insertExpense(expense: Expense) {
        val values = ContentValues().apply {
            put("id", expense.id)
            put("storeId", expense.storeId)
            put("date", expense.date)
            put("amount", expense.amount)
            put("category", expense.category)
            put("description", expense.description)
            put("requestedBy", expense.requestedBy)
            put("status", expense.status)
            put("approvedBy", expense.approvedBy)
            put("approvedAt", expense.approvedAt)
            put("isSynced", if (expense.isSynced) 1 else 0)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_EXPENSES, null, values)
    }

    fun getExpensesByStore(storeId: String): List<Expense> {
        val cursor = readableDatabase.query(
            TABLE_EXPENSES,
            null,
            "storeId = ?",
            arrayOf(storeId),
            null,
            null,
            "date DESC"
        )
        val expensesList = mutableListOf<Expense>()
        while (cursor.moveToNext()) {
            expensesList.add(
                Expense(
                    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                    date = cursor.getString(cursor.getColumnIndexOrThrow("date")),
                    amount = cursor.getDouble(cursor.getColumnIndexOrThrow("amount")),
                    category = cursor.getString(cursor.getColumnIndexOrThrow("category")),
                    description = cursor.getString(cursor.getColumnIndexOrThrow("description")),
                    requestedBy = cursor.getString(cursor.getColumnIndexOrThrow("requestedBy")),
                    status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
                    approvedBy = cursor.getString(cursor.getColumnIndexOrThrow("approvedBy")),
                    approvedAt = cursor.getString(cursor.getColumnIndexOrThrow("approvedAt")),
                    isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
                )
            )
        }
        cursor.close()
        return expensesList
    }

    // Salary request operations
    fun insertSalaryRequest(salaryRequest: SalaryRequest) {
        val values = ContentValues().apply {
            put("id", salaryRequest.id)
            put("userId", salaryRequest.userId)
            put("storeId", salaryRequest.storeId)
            put("amount", salaryRequest.amount)
            put("reason", salaryRequest.reason)
            put("requestedDate", salaryRequest.requestedDate)
            put("status", salaryRequest.status)
            put("approvedBy", salaryRequest.approvedBy)
            put("approvedAt", salaryRequest.approvedAt)
            put("isSynced", if (salaryRequest.isSynced) 1 else 0)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_SALARY_REQUESTS, null, values)
    }

    fun getSalaryRequestsByUser(userId: String): List<SalaryRequest> {
        val cursor = readableDatabase.query(
            TABLE_SALARY_REQUESTS,
            null,
            "userId = ?",
            arrayOf(userId),
            null,
            null,
            "requestedDate DESC"
        )
        val requestsList = mutableListOf<SalaryRequest>()
        while (cursor.moveToNext()) {
            requestsList.add(
                SalaryRequest(
                    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    userId = cursor.getString(cursor.getColumnIndexOrThrow("userId")),
                    storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                    amount = cursor.getDouble(cursor.getColumnIndexOrThrow("amount")),
                    reason = cursor.getString(cursor.getColumnIndexOrThrow("reason")),
                    requestedDate = cursor.getString(cursor.getColumnIndexOrThrow("requestedDate")),
                    status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
                    approvedBy = cursor.getString(cursor.getColumnIndexOrThrow("approvedBy")),
                    approvedAt = cursor.getString(cursor.getColumnIndexOrThrow("approvedAt")),
                    isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
                )
            )
        }
        cursor.close()
        return requestsList
    }

    // Leave request operations
    fun insertLeaveRequest(leaveRequest: LeaveRequest) {
        val values = ContentValues().apply {
            put("id", leaveRequest.id)
            put("userId", leaveRequest.userId)
            put("storeId", leaveRequest.storeId)
            put("startDate", leaveRequest.startDate)
            put("endDate", leaveRequest.endDate)
            put("reason", leaveRequest.reason)
            put("status", leaveRequest.status)
            put("approvedBy", leaveRequest.approvedBy)
            put("approvedAt", leaveRequest.approvedAt)
            put("isSynced", if (leaveRequest.isSynced) 1 else 0)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_LEAVE_REQUESTS, null, values)
    }

    fun getLeaveRequestsByUser(userId: String): List<LeaveRequest> {
        val cursor = readableDatabase.query(
            TABLE_LEAVE_REQUESTS,
            null,
            "userId = ?",
            arrayOf(userId),
            null,
            null,
            "startDate DESC"
        )
        val requestsList = mutableListOf<LeaveRequest>()
        while (cursor.moveToNext()) {
            requestsList.add(
                LeaveRequest(
                    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    userId = cursor.getString(cursor.getColumnIndexOrThrow("userId")),
                    storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                    startDate = cursor.getString(cursor.getColumnIndexOrThrow("startDate")),
                    endDate = cursor.getString(cursor.getColumnIndexOrThrow("endDate")),
                    reason = cursor.getString(cursor.getColumnIndexOrThrow("reason")),
                    status = cursor.getString(cursor.getColumnIndexOrThrow("status")),
                    approvedBy = cursor.getString(cursor.getColumnIndexOrThrow("approvedBy")),
                    approvedAt = cursor.getString(cursor.getColumnIndexOrThrow("approvedAt")),
                    isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
                )
            )
        }
        cursor.close()
        return requestsList
    }

    // Target operations
    fun insertTarget(target: Target) {
        val values = ContentValues().apply {
            put("id", target.id)
            put("storeId", target.storeId)
            put("userId", target.userId)
            put("month", target.month)
            put("year", target.year)
            put("targetAmount", target.targetAmount)
            put("achievedAmount", target.achievedAmount)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_TARGETS, null, values)
    }

    fun getTargetsByUser(userId: String): List<Target> {
        val cursor = readableDatabase.query(
            TABLE_TARGETS,
            null,
            "userId = ?",
            arrayOf(userId),
            null,
            null,
            "year DESC, month DESC"
        )
        val targetsList = mutableListOf<Target>()
        while (cursor.moveToNext()) {
            targetsList.add(
                Target(
                    id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                    storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                    userId = cursor.getString(cursor.getColumnIndexOrThrow("userId")),
                    month = cursor.getString(cursor.getColumnIndexOrThrow("month")),
                    year = cursor.getInt(cursor.getColumnIndexOrThrow("year")),
                    targetAmount = cursor.getDouble(cursor.getColumnIndexOrThrow("targetAmount")),
                    achievedAmount = cursor.getDouble(cursor.getColumnIndexOrThrow("achievedAmount"))
                )
            )
        }
        cursor.close()
        return targetsList
    }

    // Rokar entry operations
    fun insertRokarEntry(rokarEntry: RokarEntry) {
        val values = ContentValues().apply {
            put("id", rokarEntry.id)
            put("storeId", rokarEntry.storeId)
            put("date", rokarEntry.date)
            put("openingBalance", rokarEntry.openingBalance)
            put("computerSale", rokarEntry.computerSale)
            put("manualSale", rokarEntry.manualSale)
            put("manualBilled", rokarEntry.manualBilled)
            put("customerDuesPaid", rokarEntry.customerDuesPaid)
            put("duesGiven", rokarEntry.duesGiven)
            put("paytm", rokarEntry.paytm)
            put("phonepe", rokarEntry.phonepe)
            put("gpay", rokarEntry.gpay)
            put("bankDeposit", rokarEntry.bankDeposit)
            put("home", rokarEntry.home)
            put("expenseBreakup", rokarEntry.expenseBreakup)
            put("otherExpenseTotal", rokarEntry.otherExpenseTotal)
            put("staffSalaryTotal", rokarEntry.staffSalaryTotal)
            put("closingBalance", rokarEntry.closingBalance)
            put("isSynced", if (rokarEntry.isSynced) 1 else 0)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.insert(TABLE_ROKAR_ENTRIES, null, values)
    }

    fun getRokarEntryByDate(storeId: String, date: String): RokarEntry? {
        val cursor = readableDatabase.query(
            TABLE_ROKAR_ENTRIES,
            null,
            "storeId = ? AND date = ?",
            arrayOf(storeId, date),
            null,
            null,
            null
        )
        return if (cursor.moveToFirst()) {
            RokarEntry(
                id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
                storeId = cursor.getString(cursor.getColumnIndexOrThrow("storeId")),
                date = cursor.getString(cursor.getColumnIndexOrThrow("date")),
                openingBalance = cursor.getDouble(cursor.getColumnIndexOrThrow("openingBalance")),
                computerSale = cursor.getDouble(cursor.getColumnIndexOrThrow("computerSale")),
                manualSale = cursor.getDouble(cursor.getColumnIndexOrThrow("manualSale")),
                manualBilled = cursor.getDouble(cursor.getColumnIndexOrThrow("manualBilled")),
                customerDuesPaid = cursor.getDouble(cursor.getColumnIndexOrThrow("customerDuesPaid")),
                duesGiven = cursor.getDouble(cursor.getColumnIndexOrThrow("duesGiven")),
                paytm = cursor.getDouble(cursor.getColumnIndexOrThrow("paytm")),
                phonepe = cursor.getDouble(cursor.getColumnIndexOrThrow("phonepe")),
                gpay = cursor.getDouble(cursor.getColumnIndexOrThrow("gpay")),
                bankDeposit = cursor.getDouble(cursor.getColumnIndexOrThrow("bankDeposit")),
                home = cursor.getDouble(cursor.getColumnIndexOrThrow("home")),
                expenseBreakup = cursor.getString(cursor.getColumnIndexOrThrow("expenseBreakup")),
                otherExpenseTotal = cursor.getDouble(cursor.getColumnIndexOrThrow("otherExpenseTotal")),
                staffSalaryTotal = cursor.getDouble(cursor.getColumnIndexOrThrow("staffSalaryTotal")),
                closingBalance = cursor.getDouble(cursor.getColumnIndexOrThrow("closingBalance")),
                isSynced = cursor.getInt(cursor.getColumnIndexOrThrow("isSynced")) == 1
            )
        } else null
    }

    // Sync operations
    fun markAsSynced(tableName: String, recordId: String) {
        val values = ContentValues().apply {
            put("isSynced", 1)
            put("lastSyncTime", System.currentTimeMillis())
        }
        writableDatabase.update(tableName, values, "id = ?", arrayOf(recordId))
    }

    fun getUnsyncedRecords(tableName: String): Int {
        val cursor = readableDatabase.query(
            tableName,
            arrayOf("COUNT(*)"),
            "isSynced = 0",
            null,
            null,
            null,
            null
        )
        return if (cursor.moveToFirst()) {
            cursor.getInt(0)
        } else 0
    }
}
