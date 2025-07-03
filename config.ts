
import type { InstrumentID } from './types';

export const INSTRUMENT_CONFIG = {
    guitar: {
        name: "Guitar",
        numStrings: 6,
        numFrets: 22,
        tuning: [64, 59, 55, 50, 45, 40], // E4, B3, G3, D3, A2, E2
        stringGauges: [4.0, 5.0, 6.0, 7.0, 8.0, 9.0],
        woundStringIndices: [3, 4, 5],
    },
    ukulele: {
        name: "Ukulele",
        numStrings: 4,
        numFrets: 15,
        tuning: [69, 64, 60, 67], // A4, E4, C4, G4 (re-entrant gCEA)
        stringGauges: [4.0, 5.2, 6.4, 4.4],
        woundStringIndices: [],
    },
};

/**
 * Retrieves the configuration for a specific instrument.
 * @param {string} id - The ID of the instrument (e.g., 'guitar').
 * @returns {object} The instrument's configuration object.
 */
export const getInstrument = (id: InstrumentID) => INSTRUMENT_CONFIG[id];

export const PITCH_DETECTION_CONFIG = {
    BUFFER_SIZE: 4096,
    RMS_THRESHOLD: 0.01,
    YIN_THRESHOLD: 0.10,
    IN_TUNE_CENTS_THRESHOLD: 10,
};

export const HMM_PITCH_MIN_MIDI = 20;
export const HMM_PITCH_MAX_MIDI = 100;
export const HMM_CENTS_PER_BIN = 20;
export const HMM_NUM_PITCH_BINS = Math.ceil((HMM_PITCH_MAX_MIDI - HMM_PITCH_MIN_MIDI) * 100 / HMM_CENTS_PER_BIN);
export const HMM_NUM_STATES = HMM_NUM_PITCH_BINS + 1;
export const HMM_UNVOICED_STATE_INDEX = HMM_NUM_PITCH_BINS;

export const FINGER_COLORS: Record<number, string> = { 0: '#9ca3af', 1: '#f59e0b', 2: '#a855f7', 3: '#0ea5e9', 4: '#ef4444' };
export const FEEDBACK_COLORS: Record<string, string> = { perfect: '#4ade80', good: '#4ade80', wrong: '#f87171', missed: '#f87171' };

export const MINIMAP_HANDLE_W = 16;
export const MINIMAP_HANDLE_H = 12;
export const MINIMAP_HIT_PAD = 4;

export const FADE_TIME = 0.04;
