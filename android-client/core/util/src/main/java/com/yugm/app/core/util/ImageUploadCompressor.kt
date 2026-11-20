package com.yugm.app.core.util

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.net.Uri
import java.io.ByteArrayOutputStream

/** Decodes, bounds, and JPEG-compresses a picked image before upload. Call from Dispatchers.IO. */
fun compressImageUpload(
    context: Context,
    uri: Uri,
    maxDimension: Int,
    targetBytes: Int
): Pair<String, ByteArray> {
    require(maxDimension > 0 && targetBytes > 0)
    val resolver = context.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        ?: error("Could not read the selected image")
    require(bounds.outWidth > 0 && bounds.outHeight > 0) { "The selected file is not a valid image." }

    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxDimension) sample *= 2
    val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.ARGB_8888 }
    val decoded = resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }
        ?: error("Could not decode the selected image")
    var bitmap = decoded
    val longest = maxOf(decoded.width, decoded.height)
    if (longest > maxDimension) {
        val scale = maxDimension.toFloat() / longest
        bitmap = Bitmap.createScaledBitmap(decoded, (decoded.width * scale).toInt().coerceAtLeast(1), (decoded.height * scale).toInt().coerceAtLeast(1), true)
        if (bitmap !== decoded) decoded.recycle()
    }

    try {
        var quality = 86
        var result: ByteArray
        do {
            val output = ByteArrayOutputStream()
            val opaque = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.RGB_565)
            Canvas(opaque).apply { drawColor(Color.WHITE); drawBitmap(bitmap, Matrix(), null) }
            opaque.compress(Bitmap.CompressFormat.JPEG, quality, output)
            opaque.recycle()
            result = output.toByteArray()
            if (result.size <= targetBytes || quality <= 50) break
            quality -= 8
        } while (true)
        require(result.size <= targetBytes) { "Could not compress this image small enough. Choose a smaller image." }
        return "image/jpeg" to result
    } finally {
        bitmap.recycle()
    }
}
