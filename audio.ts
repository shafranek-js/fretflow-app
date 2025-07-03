
import { state } from './state';
import * as Utils from './utils';
import { Logger } from './logger';
import { PITCH_DETECTION_CONFIG, HMM_PITCH_MIN_MIDI, HMM_PITCH_MAX_MIDI, HMM_CENTS_PER_BIN, HMM_NUM_STATES, HMM_UNVOICED_STATE_INDEX, FADE_TIME } from './config';
import { cls } from './dom';
import type { Note } from './types';

export async function initAudio(startNow = false) {
    if (state.isAudioInitialized && state.audioContext && state.audioContext.state === 'running') {
        if (startNow && !state.pitchDetectionFrameId) updatePitch();
        return;
    }
    if (state.audioContext && state.audioContext.state === 'suspended') await state.audioContext.resume();

    try {
        if (!state.audioContext) {
            state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            state.synthMasterGain = state.audioContext.createGain();
            state.synthMasterGain.connect(state.audioContext.destination);
        }
        if (!state.micStream) {
            state.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
            state.analyser = state.audioContext.createAnalyser();
            state.analyser.fftSize = PITCH_DETECTION_CONFIG.BUFFER_SIZE;
            state.pitchDetectionBuffer = new Float32Array(PITCH_DETECTION_CONFIG.BUFFER_SIZE);
            state.fftData = new Uint8Array(state.analyser.frequencyBinCount);
            state.audioContext.createMediaStreamSource(state.micStream).connect(state.analyser);
        }

        [state.ui.practiceMicMsg, state.ui.tunerMicMsg].forEach(el => cls(el, { 'hidden': true }));
        state.isAudioInitialized = true;
        if (startNow) {
            resetHmmState();
            updatePitch();
        }
    } catch (err) {
        [state.ui.practiceMicMsg, state.ui.tunerMicMsg].forEach(el => cls(el, { 'hidden': false }));
        Logger.log(err as Error, "AudioInit");
        state.isAudioInitialized = false;
    }
}

export function stopPitchDetection() {
    if (state.pitchDetectionFrameId) {
        cancelAnimationFrame(state.pitchDetectionFrameId);
        state.pitchDetectionFrameId = null;
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
        Logger.log(error as Error, "PitchDetectionLoop");
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

export function stopAllOscillators() {
    if (!state.audioContext) return;
    const now = state.audioContext.currentTime;
    state.activeOscillators.forEach(({ osc, gain }) => {
        try {
            gain.gain.cancelAndHoldAtTime(now);
            gain.gain.linearRampToValueAtTime(0, now + FADE_TIME);
            osc.stop(now + FADE_TIME);
        } catch (_) { /* already stopped */
        }
    });
    state.activeOscillators = [];
}

export function setMasterMute(mute: boolean) {
    if (!state.synthMasterGain || !state.audioContext) return;
    const now = state.audioContext.currentTime;
    const target = mute ? 0.0001 : 1.0;
    state.synthMasterGain.gain.cancelScheduledValues(now);
    state.synthMasterGain.gain.linearRampToValueAtTime(target, now + FADE_TIME);
}

export function playImmediateNote(note: Note) {
    if (!state.audioContext || !note) return;
    const osc = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    osc.connect(gain).connect(state.synthMasterGain!);

    const transposedPitch = note.pitch + state.transposeOffset;
    osc.frequency.value = Utils.midiToFrequency(transposedPitch);
    osc.type = 'sine';

    const now = state.audioContext.currentTime;
    const tempoRate = parseInt((state.ui.tempoSlider as HTMLInputElement).value) / 100;
    const noteDuration = note.duration / tempoRate;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + noteDuration);

    osc.start(now);
    osc.stop(now + noteDuration + FADE_TIME);

    state.activeOscillators.push({ osc, gain });
}
