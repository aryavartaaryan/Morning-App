package com.solrize

import com.github.psambit9791.jdsp.filter.Butterworth
import com.github.psambit9791.jdsp.signal.peaks.FindPeak
import com.github.psambit9791.jdsp.signal.peaks.Peak
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

data class DataPoint(val timestamp: Long, val value: Double)

data class HrvResult(
    val heartRateBpm: Int,
    val rmssd: Int,
    val sdnn: Int,
    val stressScore: Int,
    val stressBand: String,
    val confidence: Int
)

class SignalProcessor {
    companion object {
        const val TARGET_FPS = 30.0
        const val MIN_RR_MS = 300   // 200 bpm
        const val MAX_RR_MS = 1500  // 40 bpm
    }

    /**
     * Complete signal processing pipeline:
     * 1. Resample to fixed 30fps
     * 2. Detrend (remove DC offset)
     * 3. 4th-Order Butterworth Bandpass (0.75Hz - 3.5Hz) using jDSP
     * 4. Adaptive peak detection using jDSP
     * 5. HRV math (RMSSD, SDNN)
     */
    fun process(rawSignal: List<DataPoint>): HrvResult? {
        if (rawSignal.size < 300) return null

        val resampled = resample(rawSignal, TARGET_FPS)
        if (resampled.size < 300) return null

        // jDSP doesn't have a dedicated detrending function for moving averages
        // out-of-the-box in its standard filter package without polynomial fitting,
        // so we manually detrend with a rolling average to zero-center the signal
        // before applying the Butterworth filter to prevent initial transient spikes.
        val detrended = detrend(resampled, TARGET_FPS.toInt())

        // Use jDSP for 4th-order Butterworth bandpass (0.75 - 3.5 Hz)
        val bw = Butterworth(TARGET_FPS)
        val filtered = bw.bandPassFilter(detrended, 4, 0.75, 3.5)

        // Use jDSP for Peak Detection
        val fp = FindPeak(filtered)
        val peaksObj = fp.detectPeaks()
        
        // Filter peaks by requiring at least 300ms distance (9 frames at 30fps)
        val jdspPeaks = peaksObj.filterByPeakDistance(9)
        
        val rrIntervals = computeRRIntervals(jdspPeaks.toList(), TARGET_FPS)

        if (rrIntervals.size < 15) return null

        return computeHrv(rrIntervals)
    }

    private fun resample(signal: List<DataPoint>, targetFps: Double): DoubleArray {
        val startTime = signal.first().timestamp
        val endTime = signal.last().timestamp
        val durationMs = endTime - startTime
        val targetCount = (durationMs * targetFps / 1000.0).toInt()
        if (targetCount <= 0) return DoubleArray(0)
        
        val result = DoubleArray(targetCount)
        val intervalMs = 1000.0 / targetFps
        var sigIdx = 0

        for (i in 0 until targetCount) {
            val targetTime = startTime + i * intervalMs
            while (sigIdx < signal.size - 2 && signal[sigIdx + 1].timestamp < targetTime) {
                sigIdx++
            }
            val p1 = signal[sigIdx]
            val p2 = signal[sigIdx + 1]
            val t1 = p1.timestamp.toDouble()
            val t2 = p2.timestamp.toDouble()
            
            if (t2 == t1) {
                result[i] = p1.value
            } else {
                val fraction = (targetTime - t1) / (t2 - t1)
                result[i] = p1.value + fraction * (p2.value - p1.value)
            }
        }
        return result
    }

    // Moving average detrending (custom implementation)
    private fun detrend(signal: DoubleArray, windowSize: Int): DoubleArray {
        val result = DoubleArray(signal.size)
        for (i in signal.indices) {
            val start = max(0, i - windowSize / 2)
            val end = min(signal.size - 1, i + windowSize / 2)
            var sum = 0.0
            for (j in start..end) {
                sum += signal[j]
            }
            val avg = sum / (end - start + 1)
            result[i] = signal[i] - avg
        }
        return result
    }

    private fun computeRRIntervals(peaks: List<Int>, fps: Double): List<Double> {
        val rr = mutableListOf<Double>()
        for (i in 1 until peaks.size) {
            val intervalMs = (peaks[i] - peaks[i-1]) / fps * 1000.0
            if (intervalMs in MIN_RR_MS.toDouble()..MAX_RR_MS.toDouble()) {
                rr.add(intervalMs)
            }
        }
        return rr
    }

    private fun computeHrv(rrIntervals: List<Double>): HrvResult {
        var sumRR = 0.0
        for (rr in rrIntervals) sumRR += rr
        val meanRR = sumRR / rrIntervals.size
        val bpm = (60000.0 / meanRR).toInt()

        var sumSqDiff = 0.0
        for (i in 1 until rrIntervals.size) {
            val diff = rrIntervals[i] - rrIntervals[i-1]
            sumSqDiff += diff * diff
        }
        val rmssd = sqrt(sumSqDiff / (rrIntervals.size - 1)).toInt()

        var sumSqDev = 0.0
        for (rr in rrIntervals) {
            val dev = rr - meanRR
            sumSqDev += dev * dev
        }
        val sdnn = sqrt(sumSqDev / rrIntervals.size).toInt()

        var score = 100 - ((rmssd - 20).toDouble() / 60.0 * 100.0)
        score = score.coerceIn(1.0, 99.0)
        val stressScore = score.toInt()

        val band = when {
            stressScore > 70 -> "High"
            stressScore > 40 -> "Moderate"
            else -> "Low"
        }

        return HrvResult(
            heartRateBpm = bpm,
            rmssd = rmssd,
            sdnn = sdnn,
            stressScore = stressScore,
            stressBand = band,
            confidence = 100
        )
    }
}
