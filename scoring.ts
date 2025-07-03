
import * as Utils from './utils';
import type { TabEvent } from './types';

const TIMING_WINDOWS = { PERFECT: 0.150, GOOD: 0.300, OKAY: 0.450, LATE: 0.600 };
const PITCH_CONFIG = { CENTS_TOLERANCE_FOR_GAMEPLAY: 60, FFT_ENERGY_THRESHOLD: 180 };

/**
 * Detects if a chord is being played by checking for energy at target frequencies.
 * @private
 */
function detectChord(chordNotes: TabEvent['notes'], fftData: Uint8Array, audioContext: AudioContext, transposeOffset: number, analyser: AnalyserNode) {
    if (!fftData || !audioContext || !analyser) return false;
    for (const note of chordNotes) {
        const targetFreq = Utils.midiToFrequency(note.pitch + transposeOffset);
        const freqIndex = Math.round(targetFreq * (analyser.fftSize / 2) / audioContext.sampleRate);
        let maxEnergy = 0;
        // Check a small window around the target frequency index
        for (let i = -2; i <= 2; i++) {
            if (fftData[freqIndex + i] > maxEnergy) maxEnergy = fftData[freqIndex + i];
        }
        if (maxEnergy < PITCH_CONFIG.FFT_ENERGY_THRESHOLD) return false;
    }
    return true;
}

/**
 * Scores a single note/chord event based on timing and pitch.
 * @public
 */
export function scoreEvent(event: TabEvent, timeToPlayhead: number, detectedFrequency: number | null, fftData: Uint8Array, audioContext: AudioContext, transposeOffset: number, analyser: AnalyserNode) {
    const absTimeToPlayhead = Math.abs(timeToPlayhead);
    if (timeToPlayhead <= 0 && absTimeToPlayhead < TIMING_WINDOWS.LATE) {
        let correct = false;
        if (event.isChord) {
            correct = detectChord(event.notes, fftData, audioContext, transposeOffset, analyser);
        } else if (detectedFrequency !== null) {
            const note = event.notes[0];
            const targetFrequency = Utils.midiToFrequency(note.pitch + transposeOffset);
            let centsDifference = 1200 * Math.log2(detectedFrequency / targetFrequency);
            // Normalize cents difference to be within a reasonable range
            if (Math.abs(centsDifference) > 800) centsDifference %= 1200;
            correct = Math.abs(centsDifference) < PITCH_CONFIG.CENTS_TOLERANCE_FOR_GAMEPLAY;
        }

        if (correct) {
            if (absTimeToPlayhead < TIMING_WINDOWS.PERFECT) {
                return { scoreChange: 100, perfectNotesChange: 1, attemptedNotesChange: 1, wasCorrect: true, feedback: 'perfect' as const };
            } else {
                return { scoreChange: 75, perfectNotesChange: 0, attemptedNotesChange: 1, wasCorrect: true, feedback: (timeToPlayhead > 0 ? 'early' : 'late') as 'early' | 'late' };
            }
        } else if (timeToPlayhead < -TIMING_WINDOWS.GOOD) {
            return { scoreChange: 0, perfectNotesChange: 0, attemptedNotesChange: 1, wasCorrect: false, feedback: 'wrong' as const };
        }
    }
    // If the note is past the "late" window, it's a miss
    if (timeToPlayhead < -TIMING_WINDOWS.LATE) {
        return { scoreChange: 0, perfectNotesChange: 0, attemptedNotesChange: 1, wasCorrect: false, feedback: 'missed' as const };
    }
    return null;
}
