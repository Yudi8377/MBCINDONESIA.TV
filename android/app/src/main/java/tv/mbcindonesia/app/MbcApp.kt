package tv.mbcindonesia.app

import android.app.Application

/**
 * Application class MBC INDONESIA.
 * Tempat inisialisasi SDK di masa depan (analytics, crash reporting, dll).
 * Sengaja ringan: tidak ada SDK pihak ketiga yang diaktifkan tanpa justifikasi
 * bisnis, keamanan, dan biaya (Blueprint §9.2).
 */
class MbcApp : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
