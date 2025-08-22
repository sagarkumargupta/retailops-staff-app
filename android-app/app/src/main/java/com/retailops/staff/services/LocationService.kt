package com.retailops.staff.services

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.util.Log
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class LocationService(private val context: Context) {
    private val fusedLocationClient: FusedLocationProviderClient by lazy {
        LocationServices.getFusedLocationProviderClient(context)
    }
    
    companion object {
        private const val TAG = "LocationService"
        private const val LOCATION_UPDATE_INTERVAL = 10000L // 10 seconds
        private const val LOCATION_FASTEST_INTERVAL = 5000L // 5 seconds
    }
    
    // Check if location permission is granted
    fun hasLocationPermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    // Get current location once
    suspend fun getCurrentLocation(): Location? {
        return try {
            if (!hasLocationPermission()) {
                Log.w(TAG, "Location permission not granted")
                return null
            }
            
            fusedLocationClient.lastLocation.await()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting current location", e)
            null
        }
    }
    
    // Get location updates as a Flow
    fun getLocationUpdates(): Flow<Location> = callbackFlow {
        if (!hasLocationPermission()) {
            Log.w(TAG, "Location permission not granted")
            close(Exception("Location permission not granted"))
            return@callbackFlow
        }
        
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY)
            .setIntervalMillis(LOCATION_UPDATE_INTERVAL)
            .setMinUpdateIntervalMillis(LOCATION_FASTEST_INTERVAL)
            .build()
        
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                locationResult.lastLocation?.let { location ->
                    trySend(location)
                }
            }
        }
        
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                context.mainLooper
            ).await()
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting location updates", e)
            close(e)
        }
        
        awaitClose {
            fusedLocationClient.removeLocationUpdates(locationCallback)
        }
    }
    
    // Get address from coordinates (reverse geocoding)
    suspend fun getAddressFromLocation(location: Location): String {
        return try {
            val geocoder = android.location.Geocoder(context)
            val addresses = geocoder.getFromLocation(location.latitude, location.longitude, 1)
            
            if (!addresses.isNullOrEmpty()) {
                val address = addresses[0]
                val addressParts = mutableListOf<String>()
                
                // Build address string
                address.getAddressLine(0)?.let { addressParts.add(it) }
                address.locality?.let { addressParts.add(it) }
                address.adminArea?.let { addressParts.add(it) }
                
                addressParts.joinToString(", ")
            } else {
                "Unknown location"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting address from location", e)
            "Unknown location"
        }
    }
    
    // Calculate distance between two locations
    fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val results = FloatArray(1)
        Location.distanceBetween(lat1, lon1, lat2, lon2, results)
        return results[0]
    }
    
    // Check if location is within store radius (for attendance)
    fun isWithinStoreRadius(
        currentLat: Double,
        currentLon: Double,
        storeLat: Double,
        storeLon: Double,
        radiusMeters: Float = 100f
    ): Boolean {
        val distance = calculateDistance(currentLat, currentLon, storeLat, storeLon)
        return distance <= radiusMeters
    }
    
    // Stop location updates
    fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates { }
    }
}

