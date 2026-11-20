package com.yugm.app.core.api

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import io.livekit.android.audio.AudioBufferCallback
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean

/** Decodes a picked audio document into a bounded, real-time PCM queue. */
internal class RoomMusicPcmDecoder(
    private val context: Context,
    uri: Uri,
    private val seekToMs: Long = 0L,
    private val onCompleted: () -> Unit,
    private val onError: (String) -> Unit
) : AudioBufferCallback {
    private val stopped = AtomicBoolean(false)
    private val paused = AtomicBoolean(false)
    private val decoderFinished = AtomicBoolean(false)
    private val callbackSent = AtomicBoolean(false)
    @Volatile private var failureMessage: String? = null
    @Volatile private var volume = 1f
    private val pcm = ArrayBlockingQueue<ShortArray>(64)
    private var current = ShortArray(0)
    private var currentOffset = 0
    private val decoderThread = Thread({ decode(uri) }, "yugm-room-music-decoder").apply {
        isDaemon = true
        start()
    }

    fun pause(value: Boolean) { paused.set(value) }
    fun setVolume(value: Float) { volume = value.coerceIn(0f, 1f) }
    fun stop() {
        stopped.set(true)
        decoderThread.interrupt()
        pcm.clear()
    }

    override fun onBuffer(buffer: ByteBuffer, audioFormat: Int, channelCount: Int, sampleRate: Int, bytesRead: Int, captureTimeNs: Long): Long {
        if (paused.get() || stopped.get() || audioFormat != android.media.AudioFormat.ENCODING_PCM_16BIT) {
            buffer.position(0)
            repeat(bytesRead.coerceAtMost(buffer.capacity())) { buffer.put(0) }
            return captureTimeNs
        }
        val channels = channelCount.coerceAtLeast(1)
        val frames = (bytesRead / (2 * channels)).coerceAtLeast(0)
        buffer.position(0)
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        repeat(frames) {
            if (currentOffset >= current.size) {
                current = pcm.poll() ?: ShortArray(0)
                currentOffset = 0
                if (current.isEmpty() && decoderFinished.get() && callbackSent.compareAndSet(false, true)) {
                    val failure = failureMessage
                    if (failure == null) onCompleted() else onError(failure)
                }
            }
            val rawSample = if (currentOffset < current.size) current[currentOffset++] else 0
            val sample = (rawSample * volume).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
            repeat(channels) { buffer.putShort(sample) }
        }
        while (buffer.position() < bytesRead.coerceAtMost(buffer.capacity())) buffer.put(0)
        return captureTimeNs
    }

    private fun decode(uri: Uri) {
        var extractor: MediaExtractor? = null
        var codec: MediaCodec? = null
        try {
            extractor = MediaExtractor().apply { setDataSource(context, uri, null) }
            var audioFormat: MediaFormat? = null
            for (index in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(index)
                if (format.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
                    audioFormat = format
                    extractor.selectTrack(index)
                    break
                }
            }
            val format = audioFormat ?: throw IllegalArgumentException("This file has no playable audio track")
            if (seekToMs > 0) {
                runCatching { extractor.seekTo(seekToMs * 1000, MediaExtractor.SEEK_TO_PREVIOUS_SYNC) }
            }
            val sourceRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            val sourceChannels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!).apply {
                configure(format, null, null, 0)
                start()
            }
            val info = MediaCodec.BufferInfo()
            var inputEnded = false
            var outputEnded = false
            var outputRate = sourceRate
            var outputChannels = sourceChannels
            var frameAccumulator = ShortArray(0)
            var accumulatorSize = 0
            while (!stopped.get() && !outputEnded) {
                if (paused.get()) {
                    Thread.sleep(30)
                    continue
                }
                if (!inputEnded) {
                    val inputIndex = codec.dequeueInputBuffer(10_000)
                    if (inputIndex >= 0) {
                        val input = codec.getInputBuffer(inputIndex)!!
                        val size = extractor.readSampleData(input, 0)
                        if (size < 0) {
                            codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputEnded = true
                        } else {
                            codec.queueInputBuffer(inputIndex, 0, size, extractor.sampleTime, 0)
                            extractor.advance()
                        }
                    }
                }
                when (val outputIndex = codec.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        val output = codec.outputFormat
                        outputRate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE)
                        outputChannels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
                    }
                    MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    else -> if (outputIndex >= 0) {
                        if (info.size > 0) {
                            val output = codec.getOutputBuffer(outputIndex)!!
                            output.position(info.offset)
                            output.limit(info.offset + info.size)
                            val shorts = output.slice().order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
                            val sourceFrames = shorts.remaining() / outputChannels.coerceAtLeast(1)
                            val targetCount = (sourceFrames.toLong() * 48_000L / outputRate.coerceAtLeast(1)).toInt()
                            if (accumulatorSize + targetCount > frameAccumulator.size) {
                                frameAccumulator = frameAccumulator.copyOf(maxOf(accumulatorSize + targetCount, frameAccumulator.size * 2, 2048))
                            }
                            for (frame in 0 until targetCount) {
                                val sourcePosition = frame.toDouble() * outputRate / 48_000.0
                                val first = sourcePosition.toInt().coerceAtMost(sourceFrames - 1)
                                val second = (first + 1).coerceAtMost(sourceFrames - 1)
                                val fraction = sourcePosition - first
                                var a = 0
                                var b = 0
                                for (channel in 0 until outputChannels) {
                                    a += shorts.get(first * outputChannels + channel).toInt()
                                    b += shorts.get(second * outputChannels + channel).toInt()
                                }
                                val monoA = a / outputChannels
                                val monoB = b / outputChannels
                                frameAccumulator[accumulatorSize++] = (monoA + (monoB - monoA) * fraction).toInt().coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
                            }
                            var offset = 0
                            while (accumulatorSize - offset >= 960) {
                                pcm.put(frameAccumulator.copyOfRange(offset, offset + 960))
                                offset += 960
                            }
                            if (offset > 0) {
                                frameAccumulator.copyInto(frameAccumulator, 0, offset, accumulatorSize)
                                accumulatorSize -= offset
                            }
                        }
                        outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        codec.releaseOutputBuffer(outputIndex, false)
                    }
                }
            }
            if (accumulatorSize > 0 && !stopped.get()) pcm.put(frameAccumulator.copyOf(accumulatorSize))
            if (!stopped.get()) decoderFinished.set(true)
        } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
        } catch (error: Exception) {
            if (!stopped.get()) {
                failureMessage = error.message ?: "This audio file could not be decoded"
                decoderFinished.set(true)
            }
        } finally {
            runCatching { codec?.stop() }
            runCatching { codec?.release() }
            runCatching { extractor?.release() }
        }
    }
}
