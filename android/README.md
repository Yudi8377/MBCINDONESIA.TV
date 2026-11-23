# MBC INDONESIA — Aplikasi Android (native, Kotlin)

Klien resmi **MBCINDONESIA.TV** untuk Android. Menampilkan situs publik + PWA di dalam WebView yang dikunci ke HTTPS, dengan layar offline, pull-to-refresh, progress bar, dan dukungan **App Links** (`https://mbcindonesia.tv/...` membuka aplikasi).

> Catatan jujur: folder ini berisi **source code lengkap dan valid**, tetapi APK/AAB **belum** dibangun di sini karena Android SDK + Gradle tidak tersedia di sandbox. Build dilakukan di Android Studio (±2 menit, langkah di bawah) atau CI (GitHub Actions — contoh worklow di bawah).

## Cara build (Android Studio — disarankan)

1. Buka **Android Studio** → `Open` → pilih folder `android/` ini.
2. Tunggu **Gradle Sync** (IDE akan mengunduh AGP 8.7.3, Kotlin 2.0.21, dan membuat `gradle-wrapper.jar` otomatis bila belum ada).
   - Atau, jika Gradle terinstall: `gradle wrapper --gradle-version 8.11.1` lalu `./gradlew assembleDebug`.
3. Run ke perangkat/emulator (minSdk 24 / Android 7.0).
4. Release: **Build → Generate Signed App Bundle / APK** dengan keystore produksi Anda. Ganti `signingConfig` debug di `app/build.gradle.kts` dengan keystore rilis.

## Struktur

```
android/
├── settings.gradle.kts / build.gradle.kts / gradle.properties
└── app/
    ├── build.gradle.kts          # applicationId tv.mbcindonesia.app, minSdk 24, targetSdk 35
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml   # INTERNET only, cleartext DIMATIKAN, App Links autoVerify
        ├── java/tv/mbcindonesia/app/
        │   ├── MbcApp.kt         # Application class (kosong, siap untuk SDK — hanya dengan justifikasi)
        │   └── MainActivity.kt   # WebView aman: HTTPS-only, SSL-error cancel, back-nav, offline screen
        └── res/
            ├── layout/activity_main.xml  # SwipeRefreshLayout + WebView + ProgressBar + layar offline
            ├── drawable/ic_launcher_foreground.xml / ic_splash.xml / splash_background.xml
            ├── mipmap-anydpi-v26/ic_launcher(_round).xml
            └── xml/network_security_config.xml  # system CAs only, tanpa user CAs di rilis
```

## Keamanan (sesuai Blueprint §9.4)

- `usesCleartextTraffic=false`, tidak ada pengecualian domain; sertifikat tidak valid **ditolak** (`SslErrorHandler.cancel()`).
- `allowFileAccess=false`, `allowContentAccess=false`, `mixedContentMode=NEVER_ALLOW`.
- Backup aplikasi dimatikan (`allowBackup=false`).
- Navigasi ke domain luar dibuka di browser sistem, bukan di dalam aplikasi.
- App Links `autoVerify` membutuhkan `assetlinks.json` di `https://mbcindonesia.tv/.well-known/assetlinks.json` berisi SHA-256 fingerprint sertifikat rilis. Contoh:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {"namespace": "android_app", "package_name": "tv.mbcindonesia.app",
             "sha256_cert_fingerprints": ["AA:BB:CC:...:FF"]}
}]
```

## PWA vs APK — mana yang dipakai?

- **PWA** (`website/` — manifest + service worker): bisa langsung diinstal dari Chrome Android (ikon di homescreen), tanpa Play Store. Ini jalan tercepat untuk mencoba.
- **APK/AAB** (folder ini): identitas resmi di Play Store, App Links terverifikasi, kontrol penuh atas WebView, dan dasar untuk fitur native berikutnya (push notification, Chromecast, Picture-in-Picture).

## Roadmap fitur native (fase lanjutan)

1. Push notification jadwal tayang (FCM) — opt-in eksplisit.
2. Chromecast / Google Cast receiver untuk Live TV.
3. Picture-in-Picture saat keluar aplikasi.
4. Unduhan episode untuk ditonton offline (sesuai hak konten — Blueprint §6.4 MAM).
5. Share target internal.

## CI contoh (GitHub Actions)

```yaml
# .github/workflows/android.yml (ringkas)
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: 17 }
      - uses: gradle/actions/setup-gradle@v4
      - run: gradle wrapper --gradle-version 8.11.1
      - run: ./gradlew assembleRelease
```
