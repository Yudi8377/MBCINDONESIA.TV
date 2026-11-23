package tv.mbcindonesia.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import tv.mbcindonesia.app.databinding.ActivityMainBinding

/**
 * MBC INDONESIA — klien Android resmi.
 *
 * Menampilkan MBCINDONESIA.TV (situs publik + PWA) di dalam WebView yang aman:
 *  - Hanya HTTPS (cleartext dimatikan di network_security_config.xml)
 *  - Sertifikat SSL tidak valid TIDAK pernah di-bypass
 *  - Navigasi keluar domain membuka browser sistem
 *  - File access & akses konten lokal dimatikan
 *  - Mendukung App Links (https://mbcindonesia.tv membuka aplikasi)
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val baseUrl: String by lazy { getString(R.string.base_url) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val webView = binding.webView
        webView.settings.apply {
            javaScriptEnabled = true                 // diperlukan pemutar video & PWA
            domStorageEnabled = true                 // localStorage aplikasi web
            mediaPlaybackRequiresUserGesture = false // video live boleh autoplay (dibisukan)
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            allowFileAccess = false
            allowContentAccess = false
            loadWithOverviewMode = true
            useWideViewPort = true
            setSupportZoom(false)
            cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString + " MBCIndonesiaAndroid/1.0"
        }
        CookieManager.getInstance().setAcceptCookie(true)

        webView.webViewClient = MbcWebViewClient()
        webView.webChromeClient = MbcWebChromeClient()

        binding.swipeRefresh.setOnRefreshListener {
            binding.offlineView.visibility = View.GONE
            webView.reload()
        }
        binding.retryButton.setOnClickListener {
            binding.offlineView.visibility = View.GONE
            webView.loadUrl(baseUrl)
        }

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            // App Links: https://mbcindonesia.tv/... langsung ke halaman tujuan
            val target = intent?.dataString?.takeIf { it.startsWith("https://mbcindonesia.tv") || it.startsWith("https://www.mbcindonesia.tv") } ?: baseUrl
            webView.loadUrl(target)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        binding.webView.saveState(outState)
    }

    /** Tombol back: mundur di riwayat WebView dulu, baru keluar aplikasi. */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (binding.webView.canGoBack()) binding.webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        binding.webView.destroy()
        super.onDestroy()
    }

    private inner class MbcWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url ?: return true
            // Domain milik sendiri tetap di dalam aplikasi
            if (url.host == "mbcindonesia.tv" || url.host == "www.mbcindonesia.tv") return false
            // Skema non-http(s) (tel:, mailto:, intent:, market:) → aplikasi eksternal
            return try {
                startActivity(Intent(Intent.ACTION_VIEW, url))
                true
            } catch (e: Exception) {
                true
            }
        }

        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
            binding.offlineView.visibility = View.GONE
            binding.webView.visibility = View.VISIBLE
            binding.progressBar.visibility = View.VISIBLE
            binding.progressBar.progress = 15
        }

        override fun onPageFinished(view: WebView?, url: String?) {
            binding.swipeRefresh.isRefreshing = false
            binding.progressBar.visibility = View.GONE
        }

        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
            // Hanya tampilkan layar offline untuk kegagalan halaman utama, bukan sub-resource
            if (request?.isForMainFrame == true) {
                binding.swipeRefresh.isRefreshing = false
                binding.progressBar.visibility = View.GONE
                binding.offlineView.visibility = View.VISIBLE
                binding.webView.visibility = View.GONE
            }
        }

        override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
            // JANGAN PERNAH proceed() — sertifikat tidak valid = koneksi ditolak
            handler?.cancel()
        }
    }

    private inner class MbcWebChromeClient : WebChromeClient() {
        override fun onProgressChanged(view: WebView?, newProgress: Int) {
            binding.progressBar.progress = newProgress
            if (newProgress >= 95) binding.progressBar.visibility = View.GONE
        }
    }
}
