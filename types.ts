


declare global {
    // This makes MidiParser available as a global variable in all contexts (window, worker) for TypeScript.
    var MidiParser: any;
    
    interface Window {
        webkitAudioContext?: typeof AudioContext;
    }
}

export type InstrumentID = 'guitar' | 'ukulele';

export interface Note {
    pitch: number;
    startTime: number;
    duration: number;
    string: number;
    fret: number;
    finger: number;
    isAudioTriggered?: boolean;
    impactTime?: number;
    feedback?: 'perfect' | 'good' | 'okay' | 'late' | 'early' | 'wrong' | 'missed';
}

// A collection of notes played at the same time, from raw MIDI
export interface NoteEvent {
    notes: {
        pitch: number;
        startTime: number;
        duration: number;
    }[];
    isChord: boolean;
}

// A collection of notes with fingering information
export interface TabEvent {
    notes: Note[];
    isChord: boolean;
    isScored?: boolean;
}

export interface Song {
    id: string;
    title: string;
    highScore: number;
    accuracy?: number;
    tablature: string; // JSON string of TabEvent[]
    midiTempo: number;
    midiTimeSignature: string; // JSON string of {numerator, denominator}
    createdAt: string;
    playbackTempo: number;
    transpose: number;
    zoomLevel: number;
    stringShift?: number;
    isFavorite?: boolean;
}

export interface CurrentSongData extends Omit<Song, 'tablature'> {
    tablature: TabEvent[];
    totalDuration: number;
    minDuration: number;
    pixelsPerSecond: number;
}


export interface NoteId {
    eventIndex: number;
    noteIndex: number;
}

export interface MIDIData {
    notes: NoteEvent[];
    tempo: number;
    timeSignature: { numerator: number; denominator: number };
}
