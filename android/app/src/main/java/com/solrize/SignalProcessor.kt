package com.solrize

import com.github.psambit9791.jdsp.filter.Butterworth
import com.github.psambit9791.jdsp.signal.peaks.FindPeak
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

data class DataPoint(val timestamp: Long, val value: Double)

data class HrvResult(
    val heartRateBpm: Int,
    val rmssd: Int,
    val sdnn: Int,
    val stressScore: Int,    // Baevsky SI
    val stressBand: String,
    val confidence: Int
)

class SignalProcessor {
    companion object {
        const val TARGET_FPS = 30.0
        const val MIN_RR_MS = 300   // 200 bpm
        const val MAX_RR_MS = 1500  // 40 bpm
    }

    fun process(rawSignal: List<DataPoint>): HrvResult? {
        if (rawSignal.size < 300) return null

        val resampled = resample(rawSignal, TARGET_FPS)
        if (resampled.size < 300) return null

        val detrended = detrend(resampled, TARGET_FPS.toInt())

        val bw = Butterworth(TARGET_FPS)
        val filtered = bw.bandPassFilter(detrended, 4, 0.75, 3.5)

        val fp = FindPeak(filtered)
        val peaksObj = fp.detectPeaks()
        val jdspPeaks = peaksObj.filterByPeakDistance(9)
        
        val rrIntervalsMs = computeRRIntervals(jdspPeaks.toList(), TARGET_FPS)

        if (rrIntervalsMs.size < 50) return null

        return computeHrv(rrIntervalsMs)
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

    private fun computeHrv(rrIntervalsMs: List<Double>): HrvResult {
        var sumRR = 0.0
        for (rr in rrIntervalsMs) sumRR += rr
        val meanRR = sumRR / rrIntervalsMs.size
        val bpm = (60000.0 / meanRR).toInt()

        var sumSqDiff = 0.0
        for (i in 1 until rrIntervalsMs.size) {
            val diff = rrIntervalsMs[i] - rrIntervalsMs[i-1]
            sumSqDiff += diff * diff
        }
        val rmssd = sqrt(sumSqDiff / (rrIntervalsMs.size - 1)).toInt()

        var sumSqDev = 0.0
        for (rr in rrIntervalsMs) {
            val dev = rr - meanRR
            sumSqDev += dev * dev
        }
        val sdnn = sqrt(sumSqDev / rrIntervalsMs.size).toInt()

        // -----------------------------------------------------
        // Baevsky Stress Index (SI)
        // Formula: SI = AMo / (2 * MxDMn * Mo)
        // -----------------------------------------------------
        
        // 1. Bucket RR intervals into 50ms bins (0.05s bins)
        val binWidthMs = 50.0
        val binCounts = mutableMapOf<Int, Int>()
        
        var minRR = Double.MAX_VALUE
        var maxRR = Double.MIN_VALUE
        
        for (rr in rrIntervalsMs) {
            if (rr < minRR) minRR = rr
            if (rr > maxRR) maxRR = rr
            
            // e.g. 810ms / 50ms = 16 (which represents the bin 800-850ms)
            val binIdx = (rr / binWidthMs).toInt()
            binCounts[binIdx] = (binCounts[binIdx] ?: 0) + 1
        }
        
        // Find the modal bin (Mo)
        var maxCount = 0
        var modalBinIdx = 0
        for ((binIdx, count) in binCounts) {
            if (count > maxCount) {
                maxCount = count
                modalBinIdx = binIdx
            }
        }
        
        // Mo is the representative value of the modal bin, in SECONDS
        // We take the midpoint of the bin. For bin 16 (800-850ms), midpoint is 825ms = 0.825s
        val moSeconds = (modalBinIdx * binWidthMs + (binWidthMs / 2)) / 1000.0
        
        // AMo is the percentage of all RR intervals that fell into the modal bin (0 to 100%)
        val amoPercent = (maxCount.toDouble() / rrIntervalsMs.size) * 100.0
        
        // MxDMn is the variation range in SECONDS
        // Note: some literature uses (max(RR) - min(RR)), but to avoid outliers skewing MxDMn heavily, 
        // researchers sometimes use the span of the bins, or just literal max-min. We use actual max-min.
        val mxdmnSeconds = (maxRR - minRR) / 1000.0
        
        // Safety check to prevent division by zero or extremely tiny variations
        val safeMxdmn = if (mxdmnSeconds < 0.001) 0.001 else mxdmnSeconds
        val safeMo = if (moSeconds < 0.001) 0.001 else moSeconds
        
        var si = amoPercent / (2.0 * safeMxdmn * safeMo)
        
        // Cap SI at 999 to prevent UI overflow on extreme cases
        si = si.coerceIn(0.0, 999.0)
        val stressIndex = si.toInt()

        val band = when {
            stressIndex > 500 -> "High"
            stressIndex > 150 -> "Moderate"
            else -> "Low"
        }

        return HrvResult(
            heartRateBpm = bpm,
            rmssd = rmssd,
            sdnn = sdnn,
            stressScore = stressIndex,
            stressBand = band,
            confidence = 100
        )
    }
}
