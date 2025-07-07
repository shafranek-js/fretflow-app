
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

export const MIDI_INSTRUMENTS = [
  { category: 'PIANO', instruments: [
    { name: 'Acoustic Grand', program: 0 }, { name: 'Bright Acoustic', program: 1 }, { name: 'Electric Grand', program: 2 }, { name: 'Honky-Tonk', program: 3 }, { name: 'Electric Piano 1', program: 4 }, { name: 'Electric Piano 2', program: 5 }, { name: 'Harpsichord', program: 6 }, { name: 'Clavinet', program: 7 }
  ]},
  { category: 'CHROM. PERCUS.', instruments: [
    { name: 'Celesta', program: 8 }, { name: 'Glockenspiel', program: 9 }, { name: 'Music Box', program: 10 }, { name: 'Vibraphone', program: 11 }, { name: 'Marimba', program: 12 }, { name: 'Xylophone', program: 13 }, { name: 'Tubular Bells', program: 14 }, { name: 'Dulcimer', program: 15 }
  ]},
  { category: 'ORGAN', instruments: [
    { name: 'Drawbar Organ', program: 16 }, { name: 'Percussive Organ', program: 17 }, { name: 'Rock Organ', program: 18 }, { name: 'Church Organ', program: 19 }, { name: 'Reed Organ', program: 20 }, { name: 'Accoridan', program: 21 }, { name: 'Harmonica', program: 22 }, { name: 'Tango Accordian', program: 23 }
  ]},
  { category: 'GUITAR', instruments: [
    { name: 'Nylon String Guitar', program: 24 }, { name: 'Steel String Guitar', program: 25 }, { name: 'Electric Jazz Guitar', program: 26 }, { name: 'Electric Clean Guitar', program: 27 }, { name: 'Electric Muted Guitar', program: 28 }, { name: 'Overdriven Guitar', program: 29 }, { name: 'Distortion Guitar', program: 30 }, { name: 'Guitar Harmonics', program: 31 }
  ]},
  { category: 'BASS', instruments: [
    { name: 'Acoustic Bass', program: 32 }, { name: 'Electric Bass(finger)', program: 33 }, { name: 'Electric Bass(pick)', program: 34 }, { name: 'Fretless Bass', program: 35 }, { name: 'Slap Bass 1', program: 36 }, { name: 'Slap Bass 2', program: 37 }, { name: 'Synth Bass 1', program: 38 }, { name: 'Synth Bass 2', program: 39 }
  ]},
  { category: 'SOLO STRINGS', instruments: [
    { name: 'Violin', program: 40 }, { name: 'Viola', program: 41 }, { name: 'Cello', program: 42 }, { name: 'Contrabass', program: 43 }, { name: 'Tremolo Strings', program: 44 }, { name: 'Pizzicato Strings', program: 45 }, { name: 'Orchestral Strings', program: 46 }, { name: 'Timpani', program: 47 }
  ]},
  { category: 'ENSEMBLE', instruments: [
    { name: 'String Ensemble 1', program: 48 }, { name: 'String Ensemble 2', program: 49 }, { name: 'SynthStrings 1', program: 50 }, { name: 'SynthStrings 2', program: 51 }, { name: 'Choir Aahs', program: 52 }, { name: 'Voice Oohs', program: 53 }, { name: 'Synth Voice', program: 54 }, { name: 'Orchestra Hit', program: 55 }
  ]},
  { category: 'BRASS', instruments: [
    { name: 'Trumpet', program: 56 }, { name: 'Trombone', program: 57 }, { name: 'Tuba', program: 58 }, { name: 'Muted Trumpet', program: 59 }, { name: 'French Horn', program: 60 }, { name: 'Brass Section', program: 61 }, { name: 'SynthBrass 1', program: 62 }, { name: 'SynthBrass 2', program: 63 }
  ]},
  { category: 'REED', instruments: [
    { name: 'Soprano Sax', program: 64 }, { name: 'Alto Sax', program: 65 }, { name: 'Tenor Sax', program: 66 }, { name: 'Baritone Sax', program: 67 }, { name: 'Oboe', program: 68 }, { name: 'English Horn', program: 69 }, { name: 'Bassoon', program: 70 }, { name: 'Clarinet', program: 71 }
  ]},
  { category: 'PIPE', instruments: [
    { name: 'Piccolo', program: 72 }, { name: 'Flute', program: 73 }, { name: 'Recorder', program: 74 }, { name: 'Pan Flute', program: 75 }, { name: 'Blown Bottle', program: 76 }, { name: 'Skakuhachi', program: 77 }, { name: 'Whistle', program: 78 }, { name: 'Ocarina', program: 79 }
  ]},
  { category: 'SYNTH LEAD', instruments: [
    { name: 'Square Wave', program: 80 }, { name: 'Saw Wave', program: 81 }, { name: 'Syn. Calliope', program: 82 }, { name: 'Chiffer Lead', program: 83 }, { name: 'Charang', program: 84 }, { name: 'Solo Vox', program: 85 }, { name: '5th Saw Wave', program: 86 }, { name: 'Bass& Lead', program: 87 }
  ]},
  { category: 'SYNTH PAD', instruments: [
    { name: 'Fantasia', program: 88 }, { name: 'Warm Pad', program: 89 }, { name: 'Polysynth', program: 90 }, { name: 'Space Voice', program: 91 }, { name: 'Bowed Glass', program: 92 }, { name: 'Metal Pad', program: 93 }, { name: 'Halo Pad', program: 94 }, { name: 'Sweep Pad', program: 95 }
  ]},
  { category: 'SYNTH EFFECTS', instruments: [
    { name: 'Ice Rain', program: 96 }, { name: 'Soundtrack', program: 97 }, { name: 'Crystal', program: 98 }, { name: 'Atmosphere', program: 99 }, { name: 'Brightness', program: 100 }, { name: 'Goblin', program: 101 }, { name: 'Echo Drops', program: 102 }, { name: 'Star Theme', program: 103 }
  ]},
  { category: 'ETHNIC', instruments: [
    { name: 'Sitar', program: 104 }, { name: 'Banjo', program: 105 }, { name: 'Shamisen', program: 106 }, { name: 'Koto', program: 107 }, { name: 'Kalimba', program: 108 }, { name: 'Bagpipe', program: 109 }, { name: 'Fiddle', program: 110 }, { name: 'Shanai', program: 111 }
  ]},
  { category: 'PERCUSSIVE', instruments: [
    { name: 'Tinkle Bell', program: 112 }, { name: 'Agogo', program: 113 }, { name: 'Steel Drums', program: 114 }, { name: 'Woodblock', program: 115 }, { name: 'Taiko Drum', program: 116 }, { name: 'Melodic Tom', program: 117 }, { name: 'Synth Drum', program: 118 }, { name: 'Reverse Cymbal', program: 119 }
  ]},
  { category: 'SOUND EFFECTS', instruments: [
    { name: 'Guitar Fret Noise', program: 120 }, { name: 'Breath Noise', program: 121 }, { name: 'Seashore', program: 122 }, { name: 'Bird Tweet', program: 123 }, { name: 'Telephone Ring', program: 124 }, { name: 'Helicopter', program: 125 }, { name: 'Applause', program: 126 }, { name: 'Gunshot', program: 127 }
  ]},
];
