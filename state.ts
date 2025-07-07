
import type { Song, TabEvent, CurrentSongData, NoteId, InstrumentID, Note } from './types';

export const state = {
    // App status
    currentInstrument: 'guitar' as InstrumentID,
    currentMode: 'practice' as 'practice' | 'performance',
    songs: [] as Song[],
    currentSongData: null as CurrentSongData | null,
    isPlaying: false,
    isPaused: false,
    isEditMode: false,
    isTunerActive: false,
    isScrubbingMinimap: false,
    isAudioInitialized: false,

    // Animation & Timestamps
    animationFrameId: null as number | null,
    pitchDetectionFrameId: null as number | null,
    songTime: 0,
    lastTimestamp: 0,
    currentScrollX: 0,
    currentNoteIndex: 0,

    // Practice Loop
    loopStartTime: 0,
    loopEndTime: null as number | null,
    dragMode: null as 'start' | 'end' | 'seek' | null,

    // Game State
    gameState: { score: 0, perfectNotes: 0, attemptedNotes: 0, streak: 0, multiplier: 1 },
    
    // Edit Mode State
    originalTablature: [] as TabEvent[],
    editedTablature: [] as TabEvent[],
    editHistory: [] as any[],
    historyIndex: -1,
    pendingEdits: false,
    isDragging: false,
    wasDragged: false,
    draggedNoteIndex: null as NoteId | null,
    selectedNoteIndex: null as NoteId | null,
    hoveredNoteIndex: null as NoteId | null,
    mousePosition: null as { x: number, y: number } | null,
    
    // Settings
    transposeOffset: 0,
    stringShiftOffset: 0,
    zoomLevel: 1.0,
    globalSettings: { 
        noteSize: 1.0, 
        stringSpacing: 1.0, 
        stringThickness: 1.0,
        selectedInstrument: 25, // Default to Steel String Guitar
    },

    // Audio
    audioContext: null as AudioContext | null,
    analyser: null as AnalyserNode | null,
    micStream: null as MediaStream | null,
    synthMasterGain: null as GainNode | null,
    synth: null as any, // soundfont-player instance
    isSoundfontLoading: false,
    pitchDetectionBuffer: null as Float32Array | null,
    fftData: null as Uint8Array | null,
    currentDetectedMidi: null as number | null,
    currentDetectedFrequency: null as number | null,
    
    // HMM Pitch Detection
    hmmState: null as { T1: Float32Array, T2: any[], path: any[] } | null,
    
    // Canvas & Rendering
    staticCanvas: null as HTMLCanvasElement | null,
    staticCtx: null as CanvasRenderingContext2D | null,
    dynamicCanvas: null as HTMLCanvasElement | null,
    dynamicCtx: null as CanvasRenderingContext2D | null,
    minimapCanvas: null as HTMLCanvasElement | null,
    minimapCtx: null as CanvasRenderingContext2D | null,
    PLAIN_PATTERN: null as CanvasPattern | null,
    WOUND_PATTERN: null as CanvasPattern | null,
    stars: [] as { x: number, y: number, r: number }[],
    playheadY: 0,

    // DOM Elements
    ui: {} as Record<string, HTMLElement>
};

export function resetGameState() {
    state.gameState = { score: 0, perfectNotes: 0, attemptedNotes: 0, streak: 0, multiplier: 1 };
}