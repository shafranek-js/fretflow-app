
import Soundfont from 'soundfont-player';
import { state } from './state';
import * as Utils from './utils';
import { Logger } from './logger';
import { PITCH_DETECTION_CONFIG, HMM_PITCH_MIN_MIDI, HMM_PITCH_MAX_MIDI, HMM_CENTS_PER_BIN, HMM_NUM_STATES, HMM_UNVOICED_STATE_INDEX, FADE_TIME } from './config';
import { cls } from './dom';
import type { Note } from './types';

// Maps General MIDI program numbers to soundfont-player instrument names.
// This allows dynamic loading of specific instrument sounds.
// This list has been greatly expanded to cover most of the GM instrument set.
const GM_TO_SOUNDFONT_PLAYER_MAP: Record<number, string> = {
    // Piano
    0: 'acoustic_grand_piano', 1: 'bright_acoustic_piano', 2: 'electric_grand_piano', 3: 'honky_tonk_piano', 4: 'electric_piano_1', 5: 'electric_piano_2', 6: 'harpsichord', 7: 'clavinet',
    // Chromatic Percussion
    8: 'celesta', 9: 'glockenspiel', 10: 'music_box', 11: 'vibraphone', 12: 'marimba', 13: 'xylophone', 14: 'tubular_bells', 15: 'dulcimer',
    // Organ
    16: 'drawbar_organ', 17: 'percussive_organ', 18: 'rock_organ', 19: 'church_organ', 20: 'reed_organ', 21: 'accordion', 22: 'harmonica', 23: 'tango_accordion',
    // Guitar
    24: 'acoustic_guitar_nylon', 25: 'acoustic_guitar_steel', 26: 'electric_guitar_jazz', 27: 'electric_guitar_clean', 28: 'electric_guitar_muted', 29: 'overdriven_guitar', 30: 'distortion_guitar', 31: 'guitar_harmonics',
    // Bass
    32: 'acoustic_bass', 33: 'electric_bass_finger', 34: 'electric_bass_pick', 35: 'fretless_bass', 36: 'slap_bass_1', 37: 'slap_bass_2', 38: 'synth_bass_1', 39: 'synth_bass_2',
    // Strings
    40: 'violin', 41: 'viola', 42: 'cello', 43: 'contrabass', 44: 'tremolo_strings', 45: 'pizzicato_strings', 46: 'orchestral_harp', 47: 'timpani',
    // Ensemble
    48: 'string_ensemble_1', 49: 'string_ensemble_2', 50: 'synth_strings_1', 51: 'synth_strings_2', 52: 'choir_aahs', 53: 'voice_oohs', 54: 'synth_voice', 55: 'orchestra_hit',
    // Brass
    56: 'trumpet', 57: 'trombone', 58: 'tuba', 59: 'muted_trumpet', 60: 'french_horn', 61: 'brass_section', 62: 'synth_brass_1', 63: 'synth_brass_2',
    // Reed
    64: 'soprano_sax', 65: 'alto_sax', 66: 'tenor_sax', 67: 'baritone_sax', 68: 'oboe', 69: 'english_horn', 70: 'bassoon', 71: 'clarinet',
    // Pipe
    72: 'piccolo', 73: 'flute', 74: 'recorder', 75: 'pan_flute', 76: 'blown_bottle', 77: 'shakuhachi', 78: 'whistle', 79: 'ocarina',
    // Synth Lead
    80: 'lead_1_square', 81: 'lead_2_sawtooth', 82: 'lead_3_calliope', 83: 'lead_4_chiff', 84: 'lead_5_charang', 85: 'lead_6_voice', 86: 'lead_7_fifths', 87: 'lead_8_bass_and_lead',
    // Synth Pad
    88: 'pad_1_new_age', 89: 'pad_2_warm', 90: 'pad_3_polysynth', 91: 'pad_4_choir', 92: 'pad_5_bowed', 93: 'pad_6_metallic', 94: 'pad_7_halo', 95: 'pad_8_sweep',
    // Synth Effects
    96: 'fx_1_rain', 97: 'fx_2_soundtrack', 98: 'fx_3_crystal', 99: 'fx_4_atmosphere', 100: 'fx_5_brightness', 101: 'fx_6_goblins', 102: 'fx_7_echoes', 103: 'fx_8_sci_fi',
    // Ethnic
    104: 'sitar', 105: 'banjo', 106: 'shamisen', 107: 'koto', 108: 'kalimba', 109: 'bagpipe', 110: 'fiddle', 111: 'shanai',
    // Percussive
    112: 'tinkle_bell', 113: 'agogo', 114: 'steel_drums', 115: 'woodblock', 116: 'taiko_drum', 117: 'melodic_tom', 118: 'synth_drum', 119: 'reverse_cymbal',
    // Sound Effects
    120: 'guitar_fret_noise', 121: 'breath_noise', 122: 'seashore', 123: 'bird_tweet', 124: 'telephone_ring', 125: 'helicopter', 126: 'applause', 127: 'gunshot',
};

const DEFAULT_INSTRUMENT_NAME = 'acoustic_grand_piano';
const DEFAULT_INSTRUMENT_PROGRAM = 0;

export async function loadInstrument(program: number) {
    if (!state.audioContext) {
        Logger.warn('AudioContext not ready, cannot load instrument.', 'Audio');
        return;
    }
    
    let instrumentName = GM_TO_SOUNDFONT_PLAYER_MAP[program];
    if (!instrumentName) {
        Logger.warn(`No soundfont mapped for program ${program}. Falling back to default: ${DEFAULT_INSTRUMENT_NAME}.`, 'Audio');
        instrumentName = DEFAULT_INSTRUMENT_NAME;
        program = DEFAULT_INSTRUMENT_PROGRAM;
    }

    Logger.info(`Loading instrument: ${instrumentName} (program ${program})`, 'Audio');
    state.isSoundfontLoading = true;
    const instrumentSelector = state.ui.instrumentSelector as HTMLSelectElement;
    if (instrumentSelector) instrumentSelector.disabled = true;

    try {
        const player = await Soundfont.instrument(state.audioContext, instrumentName as any, {
            soundfont: 'MusyngKite',
            destination: state.synthMasterGain,
            gain: 2,
        });
        
        if (state.synth) state.synth.stop();
        state.synth = player;
        Logger.info(`Instrument ${instrumentName} loaded successfully.`, 'Audio');
        
    } catch (err) {
        const errorMessage = `Failed to load instrument: ${instrumentName}. It might not be available. Please try another one.`;
        Logger.error(err, 'LoadInstrument', { instrumentName, program });
        alert(errorMessage);
        
        // --- Fallback Logic ---
        Logger.warn(`Attempting to load fallback instrument '${DEFAULT_INSTRUMENT_NAME}'.`, 'Audio');
        try {
            const fallbackPlayer = await Soundfont.instrument(state.audioContext, DEFAULT_INSTRUMENT_NAME as any, {
                soundfont: 'MusyngKite',
                destination: state.synthMasterGain,
                gain: 2,
            });
            if (state.synth) state.synth.stop();
            state.synth = fallbackPlayer;
            // Update state and UI to reflect the fallback
            state.globalSettings.selectedInstrument = DEFAULT_INSTRUMENT_PROGRAM;
            if (instrumentSelector) instrumentSelector.value = String(DEFAULT_INSTRUMENT_PROGRAM);
            Logger.info('Fallback instrument loaded successfully.', 'Audio');
        } catch (fallbackErr) {
            Logger.error(fallbackErr, 'LoadInstrument', { instrumentName: DEFAULT_INSTRUMENT_NAME, program: DEFAULT_INSTRUMENT_PROGRAM, context: 'Fallback attempt' });
            alert('CRITICAL: Failed to load even the fallback instrument. Audio playback will not work.');
        }

    } finally {
        state.isSoundfontLoading = false;
        if (instrumentSelector) instrumentSelector.disabled = false;
    }
}


export async function initAudio(startNow = false) {
    if (state.isAudioInitialized && state.audioContext && state.audioContext.state === 'running') {
        if (startNow && !state.pitchDetectionFrameId) updatePitch();
        return;
    }
    if (state.audioContext && state.audioContext.state === 'suspended') {
        Logger.info('Resuming suspended AudioContext', 'Audio');
        await state.audioContext.resume();
    }

    try {
        if (!state.audioContext) {
            Logger.info('Initializing new AudioContext', 'Audio');
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            state.synthMasterGain = state.audioContext.createGain();
            state.synthMasterGain.connect(state.audioContext.destination);
            // Initialize the synth with the default instrument right after context is created
            await loadInstrument(state.globalSettings.selectedInstrument);
        }
        if (!state.micStream) {
            Logger.info('Requesting microphone access (getUserMedia)', 'Audio');
            state.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
            state.analyser = state.audioContext.createAnalyser();
            state.analyser.fftSize = PITCH_DETECTION_CONFIG.BUFFER_SIZE;
            state.pitchDetectionBuffer = new Float32Array(PITCH_DETECTION_CONFIG.BUFFER_SIZE);
            state.fftData = new Uint8Array(state.analyser.frequencyBinCount);
            state.audioContext.createMediaStreamSource(state.micStream).connect(state.analyser);
            Logger.info('Microphone access granted and audio chain configured', 'Audio');
        }

        [state.ui.practiceMicMsg, state.ui.tunerMicMsg].forEach(el => cls(el, { 'hidden': true }));
        state.isAudioInitialized = true;
        if (startNow) {
            resetHmmState();
            updatePitch();
        }
    } catch (err) {
        [state.ui.practiceMicMsg, state.ui.tunerMicMsg].forEach(el => cls(el, { 'hidden': false }));
        Logger.error(err as Error, "AudioInit");
        state.isAudioInitialized = false;
    }
}

export function stopPitchDetection() {
    if (state.pitchDetectionFrameId) {
        cancelAnimationFrame(state.pitchDetectionFrameId);
        state.pitchDetectionFrameId = null;
        Logger.info('Pitch detection stopped.', 'Audio');
    }
    state.isTunerActive = false;
}

function getPitchCandidates(): { pitch: number, probability: number }[] {
    if (!state.analyser || !state.pitchDetectionBuffer) return [];
    state.analyser.getFloatTimeDomainData(state.pitchDetectionBuffer);
    let rms = 0;
    for (let i = 0; i < state.pitchDetectionBuffer.length; i++) rms += state.pitchDetectionBuffer[i] * state.pitchDetectionBuffer[i];
    rms = Math.sqrt(rms / state.pitchDetectionBuffer.length);
    if (rms < PITCH_DETECTION_CONFIG.RMS_THRESHOLD) return [];
    const yinBuffer = new Float32Array(Math.floor(state.pitchDetectionBuffer.length / 2));
    let runningSum = 0;
    yinBuffer[0] = 1;
    for (let tau = 1; tau < yinBuffer.length; tau++) {
        let squaredDifference = 0;
        for (let i = 0; i < yinBuffer.length; i++) {
            const delta = state.pitchDetectionBuffer[i] - state.pitchDetectionBuffer[i + tau];
            squaredDifference += delta * delta;
        }
        runningSum += squaredDifference;
        yinBuffer[tau] = squaredDifference / (runningSum / tau + 1e-6);
    }
    const candidates: { pitch: number, probability: number }[] = [];
    for (let t = 0.05; t < 0.5; t += 0.05) {
        let tau = -1;
        for (let i = 2; i < yinBuffer.length - 1; i++) {
            if (yinBuffer[i] < t && yinBuffer[i] < yinBuffer[i - 1] && yinBuffer[i] < yinBuffer[i + 1]) {
                tau = i;
                break;
            }
        }
        if (tau !== -1) {
            const pitch = state.audioContext!.sampleRate / tau;
            const probability = 1.0 - (yinBuffer[tau] / t);
            candidates.push({ pitch, probability });
        }
    }
    return candidates;
}

function resetHmmState() {
    state.hmmState = {
        T1: new Float32Array(HMM_NUM_STATES).fill(1.0 / HMM_NUM_STATES),
        T2: Array.from({ length: HMM_NUM_STATES }, () => []),
        path: [],
    };
}

function updateHMM(candidates: { pitch: number, probability: number }[]): number | null {
    if (!state.hmmState) resetHmmState();
    const B = new Float32Array(HMM_NUM_STATES).fill(1e-6);
    if (candidates.length === 0) {
        B[HMM_UNVOICED_STATE_INDEX] = 1.0;
    } else {
        candidates.forEach(c => {
            const midi = Utils.frequencyToMidiNote(c.pitch);
            if (midi !== null && midi >= HMM_PITCH_MIN_MIDI && midi <= HMM_PITCH_MAX_MIDI) {
                const bin = Math.floor(((midi - HMM_PITCH_MIN_MIDI) * 100) / HMM_CENTS_PER_BIN);
                B[bin] = Math.max(B[bin], c.probability);
            }
        });
        B[HMM_UNVOICED_STATE_INDEX] = 1.0 - Math.max(...B);
    }
    const newT1 = new Float32Array(HMM_NUM_STATES);
    const newT2 = new Int32Array(HMM_NUM_STATES);
    for (let j = 0; j < HMM_NUM_STATES; j++) {
        let maxProb = 0, maxState = 0;
        for (let i = 0; i < HMM_NUM_STATES; i++) {
            const transitionProb = (i === j) ? 0.9 : (Math.abs(i - j) === 1 ? 0.05 : 1e-4);
            const prob = state.hmmState!.T1[i] * transitionProb;
            if (prob > maxProb) {
                maxProb = prob;
                maxState = i;
            }
        }
        newT1[j] = maxProb * B[j];
        newT2[j] = maxState;
    }
    const sum = newT1.reduce((a, b) => a + b, 0);
    if (sum > 0) {
        for (let i = 0; i < newT1.length; i++) newT1[i] /= sum;
    }
    state.hmmState!.T1 = newT1;
    let bestState = 0, maxProb = 0;
    for (let i = 0; i < state.hmmState!.T1.length; i++) {
        if (state.hmmState!.T1[i] > maxProb) {
            maxProb = state.hmmState!.T1[i];
            bestState = i;
        }
    }
    if (bestState === HMM_UNVOICED_STATE_INDEX) return null;
    else return Utils.midiToFrequency(HMM_PITCH_MIN_MIDI + (bestState * HMM_CENTS_PER_BIN) / 100.0);
}

function updatePitch() {
    try {
        if (state.analyser) state.analyser.getByteFrequencyData(state.fftData!);
        const candidates = getPitchCandidates();
        const freq = updateHMM(candidates);
        state.currentDetectedFrequency = (freq && freq > 60 && freq < 1600) ? freq : null;
        if (state.isTunerActive) {
            const noteInfo = state.currentDetectedFrequency ? Utils.frequencyToNoteInfo(state.currentDetectedFrequency) : null;
            updateTunerDisplay(noteInfo);
        } else {
            const midiNote = state.currentDetectedFrequency ? Utils.frequencyToMidiNote(state.currentDetectedFrequency) : null;
            state.currentDetectedMidi = midiNote ? Math.round(midiNote) : null;
        }
    } catch (error) {
        Logger.error(error as Error, "PitchDetectionLoop");
        if (state.pitchDetectionFrameId) {
            cancelAnimationFrame(state.pitchDetectionFrameId);
            state.pitchDetectionFrameId = null;
        }
        return;
    }
    state.pitchDetectionFrameId = requestAnimationFrame(updatePitch);
}

function updateTunerDisplay(noteInfo: { noteName: string, frequency: number, cents: number } | null) {
    const ui = state.ui;
    if (!noteInfo) {
        ui.tunerNoteName.textContent = "-";
        ui.tunerStatus.textContent = "...";
        ui.tunerStatus.className = "text-xl font-semibold text-gray-500 h-7";
        ui.tunerFreq.textContent = `0 Hz`;
        (ui.tunerNeedle as HTMLElement).style.transform = `rotate(0deg)`;
        cls(ui.tunerCircle, { 'good': false });
        return;
    }
    const { noteName, frequency, cents } = noteInfo;
    ui.tunerNoteName.textContent = noteName;
    ui.tunerFreq.textContent = `${frequency.toFixed(2)} Hz`;
    const rotation = Math.max(-45, Math.min(45, cents * 0.9));
    (ui.tunerNeedle as HTMLElement).style.transform = `rotate(${rotation}deg)`;
    if (Math.abs(cents) < PITCH_DETECTION_CONFIG.IN_TUNE_CENTS_THRESHOLD) {
        ui.tunerStatus.textContent = "Good Job!";
        ui.tunerStatus.className = "text-xl font-semibold text-green-400 h-7";
        cls(ui.tunerCircle, { 'good': true });
    } else if (cents < 0) {
        ui.tunerStatus.textContent = "Too Low";
        ui.tunerStatus.className = "text-xl font-semibold text-yellow-400 h-7";
        cls(ui.tunerCircle, { 'good': false });
    } else {
        ui.tunerStatus.textContent = "Too High";
        ui.tunerStatus.className = "text-xl font-semibold text-red-400 h-7";
        cls(ui.tunerCircle, { 'good': false });
    }
}

export function stopAllSounds() {
    if (state.synth) {
        // This stops all scheduled and playing notes for this instrument instance
        state.synth.stop();
    }
}

export function setMasterMute(mute: boolean) {
    if (!state.synthMasterGain || !state.audioContext) return;
    const now = state.audioContext.currentTime;
    const target = mute ? 0.0001 : 1.0;
    state.synthMasterGain.gain.cancelScheduledValues(now);
    state.synthMasterGain.gain.linearRampToValueAtTime(target, now + FADE_TIME);
}

export function playImmediateNote(note: Note) {
    if (!state.synth || state.isSoundfontLoading || !note) return;
    
    const tempoRate = parseInt((state.ui.tempoSlider as HTMLInputElement).value) / 100;
    const noteDurationSeconds = (note.duration / tempoRate);

    // soundfont-player handles note-off via the duration property.
    // The returned value is an AudioBufferSourceNode which can be used for more complex control,
    // but for simple playback, this is sufficient.
    state.synth.play(note.pitch, undefined, { duration: noteDurationSeconds });
}