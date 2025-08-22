package com.retailops.staff.firebase

import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.messaging.FirebaseMessaging

object FirebaseConfig {
    private lateinit var auth: FirebaseAuth
    private lateinit var firestore: FirebaseFirestore
    private lateinit var storage: FirebaseStorage
    private lateinit var messaging: FirebaseMessaging
    
    // Firebase project configuration matching web app
    const val PROJECT_ID = "retailopsapp"
    const val STORAGE_BUCKET = "retailopsapp.appspot.com"
    const val API_KEY = "AIzaSyBOe0c22Tug8CoWenydHGxgkP6iPM_VLfI"
    
    fun initialize(app: FirebaseApp) {
        auth = FirebaseAuth.getInstance(app)
        firestore = FirebaseFirestore.getInstance(app)
        storage = FirebaseStorage.getInstance(app)
        messaging = FirebaseMessaging.getInstance(app)
    }
    
    fun getAuth(): FirebaseAuth = auth
    fun getFirestore(): FirebaseFirestore = firestore
    fun getStorage(): FirebaseStorage = storage
    fun getMessaging(): FirebaseMessaging = messaging
}
