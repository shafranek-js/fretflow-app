
export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Converts a MIDI note number to its corresponding frequency in Hz.
 * @param {number} midi - The MIDI note number.
 * @returns {number} The frequency in Hz.
 */
export const midiToFrequency = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Converts a frequency in Hz to the nearest MIDI note number.
 * @param {number} freq - The frequency in Hz.
 * @returns {number|null} The MIDI note number or null if frequency is invalid.
 */
export const frequencyToMidiNote = (freq: number): number | null => freq > 0 ? 12 * (Math.log2(freq / 440)) + 69 : null;

/**
 * Converts a frequency to a detailed note object including name, octave, and cents offset.
 * @param {number} frequency - The frequency in Hz.
 * @returns {object|null} A note info object or null.
 */
export function frequencyToNoteInfo(frequency: number) {
    if (!frequency || frequency <= 0) return null;
    const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    const roundedNoteNum = Math.round(noteNum) + 69;
    const standardFrequency = midiToFrequency(roundedNoteNum);
    
    return {
        noteName: NOTE_NAMES[roundedNoteNum % 12],
        octave: Math.floor(roundedNoteNum / 12) - 1,
        frequency: frequency,
        cents: 1200 * Math.log2(frequency / standardFrequency),
    };
}

/**
 * Converts a MIDI number to a note name with octave (e.g., 60 -> C4).
 * @param midi The MIDI note number.
 * @returns The note name as a string.
 */
export function midiToNoteName(midi: number): string {
    const octave = Math.floor(midi / 12) - 1;
    const noteName = NOTE_NAMES[midi % 12];
    return `${noteName}${octave}`;
}
