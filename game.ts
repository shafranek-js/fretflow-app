

import { state, resetGameState } from './state';
import { Logger } from './logger';
import * as Utils from './utils';
import { drawDynamicLayer, renderMinimap, getNeckGeometry } from './renderer';
import { showSummaryScreen } from './ui';
import { playImmediateNote } from './audio';
import type { TabEvent } from './types';
import { cls } from './dom';
import { scoreEvent } from './scoring';

function updateStreak(wasCorrect: boolean) {
    const ui = state.ui;
    if (wasCorrect) {
        state.gameState.streak += 1;
        if (state.gameState.streak > 0 && state.gameState.streak % 10 === 0 && state.gameState.multiplier < 8) {
            state.gameState.multiplier += 1;
        }
    } else {
        state.gameState.streak = 0;
        state.gameState.multiplier = 1;
    }
    ui.streakDisplay.textContent = `${state.gameState.multiplier}x`;
    if (wasCorrect) {
        cls(ui.streakDisplay, { 'streak-increased': false });
        void ui.streakDisplay.offsetWidth; // Trigger reflow
        cls(ui.streakDisplay, { 'streak-increased': true });
    }
}

function scoringLogic(timestamp: number) {
    if (!state.currentSongData || !state.analyser) return;

    const isLooping = state.loopEndTime !== null && state.loopEndTime < state.currentSongData.totalDuration;
    const currentTabEvent = state.currentSongData.tablature[state.currentNoteIndex];

    // Update UI with target/detected note info
    if (currentTabEvent) {
        const targetPitch = currentTabEvent.notes[0].pitch;
        const targetNoteName = currentTabEvent.isChord ? "Chord" : Utils.NOTE_NAMES[targetPitch % 12];
        state.ui.targetNoteDisplay.textContent = `Target: ${targetNoteName}`;
        const detectedNoteName = state.currentDetectedMidi !== null ? Utils.NOTE_NAMES[state.currentDetectedMidi % 12] : '--';
        state.ui.pitchDisplay.textContent = `Detected: ${detectedNoteName}`;
    }

    // --- OPTIMIZATION ---
    // Instead of iterating all notes, only check a small window around the current playhead position.
    // This dramatically improves performance on long songs.
    const scoringWindowLookbehind = 5; // How many notes back to check for late hits
    const scoringWindowLookahead = 5; // How many notes forward to check
    const startIndex = Math.max(0, state.currentNoteIndex - scoringWindowLookbehind);
    const endIndex = Math.min(state.currentSongData.tablature.length, state.currentNoteIndex + scoringWindowLookahead);

    for (let i = startIndex; i < endIndex; i++) {
        const tabEvent = state.currentSongData.tablature[i];
        if (tabEvent.isScored) continue; // Skip already scored notes

        const timeToPlayhead = tabEvent.notes[0].startTime - state.songTime;

        // Trigger synth sound just before the note is hit
        if (!state.isScrubbingMinimap && timeToPlayhead < 0.05 && !tabEvent.notes[0].isAudioTriggered) {
            tabEvent.notes.forEach(note => {
                playImmediateNote(note);
                note.isAudioTriggered = true;
                note.impactTime = timestamp;
            });
        }

        // Only score notes that are within the loop region if a loop is active
        const isInsideScoringRegion = !isLooping || (state.songTime >= state.loopStartTime && state.songTime < state.loopEndTime!);
        if (!isInsideScoringRegion) continue;

        // Call the centralized scoring function
        const scoreDelta = scoreEvent(tabEvent, timeToPlayhead, state.currentDetectedFrequency, state.fftData!, state.audioContext!, state.analyser!);
        
        if (scoreDelta) {
            tabEvent.isScored = true;
            state.gameState.score += scoreDelta.scoreChange * state.gameState.multiplier;
            state.gameState.perfectNotes += scoreDelta.perfectNotesChange;
            state.gameState.attemptedNotes += scoreDelta.attemptedNotesChange;
            updateStreak(scoreDelta.wasCorrect);
            tabEvent.notes.forEach(n => n.feedback = scoreDelta.feedback);
            const feedbackText = { perfect: 'Perfect!', good: 'Good!', early: 'Early', late: 'Late', wrong: 'Wrong Note', missed: 'Missed' };
            state.ui.feedbackDisplay.textContent = `Feedback: ${feedbackText[scoreDelta.feedback] || '--'}`;
            state.ui.scoreDisplay.textContent = `Score: ${state.gameState.score}`;
        }
    }
}

function animationLoop(timestamp: number) {
    if (!state.isPlaying || state.isPaused || !state.currentSongData || !state.currentSongData.tablature) {
        state.animationFrameId = null;
        return;
    }
    if (state.lastTimestamp === 0) {
        state.lastTimestamp = timestamp;
        state.animationFrameId = requestAnimationFrame(animationLoop);
        return;
    }
    const deltaTime = (timestamp - state.lastTimestamp) / 1000;
    state.lastTimestamp = timestamp;
    const tempoRate = parseInt((state.ui.tempoSlider as HTMLInputElement).value) / 100;
    state.songTime += deltaTime * tempoRate;

    // In practice mode, handle looping. In performance mode, play once.
    if (state.currentMode === 'practice' && state.loopEndTime !== null && state.songTime >= state.loopEndTime) {
        const measureDuration = getMeasureDuration();
        const loopStartMeasureTime = Math.floor(state.loopStartTime / measureDuration) * measureDuration;
        const preRollStartTime = Math.max(0, loopStartMeasureTime - measureDuration);
        state.songTime = preRollStartTime;
        state.currentScrollX = state.songTime * state.currentSongData.pixelsPerSecond;
        state.currentSongData.tablature.forEach(tabEvent => {
            if (tabEvent.notes[0].startTime >= preRollStartTime) {
                tabEvent.notes.forEach(note => {
                    delete note.isAudioTriggered;
                    delete note.impactTime;
                    delete note.feedback;
                });
                delete tabEvent.isScored;
            }
        });
        Logger.info('Looping back to start', 'Game', { loopStartTime: state.loopStartTime, newSongTime: state.songTime });
    }

    state.currentScrollX = state.songTime * state.currentSongData.pixelsPerSecond;
    state.currentNoteIndex = findClosestNoteIndex(state.songTime);
    scoringLogic(timestamp);
    drawDynamicLayer(timestamp);
    renderMinimap();
    
    // Check if the song has ended
    if (state.currentSongData.totalDuration && state.songTime > state.currentSongData.totalDuration + 2) {
        endSession();
    } else {
        state.animationFrameId = requestAnimationFrame(animationLoop);
    }
}

export function startAnimation() {
    if (!state.currentSongData || state.isPlaying || !state.currentSongData.tablature || state.currentSongData.tablature.length === 0) return;
    Logger.info('Starting animation', 'Game');
    const isLooping = state.loopEndTime !== null && state.loopEndTime < state.currentSongData.totalDuration;
    if (isLooping && state.songTime <= state.loopStartTime) {
        const measureDuration = getMeasureDuration();
        const loopStartMeasureTime = Math.floor(state.loopStartTime / measureDuration) * measureDuration;
        const preRollStartTime = Math.max(0, loopStartMeasureTime - measureDuration);
        state.songTime = preRollStartTime;
    }
    if (state.synthMasterGain && state.audioContext) {
        state.synthMasterGain.gain.cancelScheduledValues(state.audioContext.currentTime);
        state.synthMasterGain.gain.setValueAtTime(1.0, state.audioContext.currentTime);
    }
    state.isPlaying = true;
    state.isPaused = false;
    cls(state.ui.playIcon, { 'hidden': true });
    cls(state.ui.pauseIcon, { 'hidden': false });
    state.lastTimestamp = 0;
    state.animationFrameId = requestAnimationFrame(animationLoop);
}

export function pauseAnimation() {
    if (!state.isPlaying || state.isPaused) return;
    Logger.info('Pausing animation', 'Game');
    state.isPaused = true;
    cls(state.ui.playIcon, { 'hidden': false });
    cls(state.ui.pauseIcon, { 'hidden': true });
    if (state.synthMasterGain && state.audioContext) state.synthMasterGain.gain.exponentialRampToValueAtTime(0.0001, state.audioContext.currentTime + 0.05);
}

export function resumeAnimation() {
    if (!state.isPlaying || !state.isPaused) return;
    Logger.info('Resuming animation', 'Game');
    state.isPaused = false;
    cls(state.ui.playIcon, { 'hidden': true });
    cls(state.ui.pauseIcon, { 'hidden': false });
    state.lastTimestamp = 0;
    if (state.synthMasterGain && state.audioContext) {
        state.synthMasterGain.gain.cancelScheduledValues(state.audioContext.currentTime);
        state.synthMasterGain.gain.setValueAtTime(1.0, state.audioContext.currentTime);
    }
    if (!state.animationFrameId) state.animationFrameId = requestAnimationFrame(animationLoop);
}

export function stopAnimation(rewindToLoopStart = false) {
    if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
    state.isPlaying = false;
    state.isPaused = false;
    cls(state.ui.playIcon, { 'hidden': false });
    cls(state.ui.pauseIcon, { 'hidden': true });
    if (state.currentSongData) resetSongState(rewindToLoopStart);
}

export function resetSongState(rewindToLoopStart = false) {
    resetGameState();
    if (rewindToLoopStart && state.currentSongData) {
        state.songTime = state.loopStartTime;
    } else {
        state.songTime = 0;
        if (state.currentSongData) {
            state.loopStartTime = 0;
            state.loopEndTime = state.currentSongData.totalDuration;
        }
    }
    state.currentScrollX = state.currentSongData ? state.songTime * state.currentSongData.pixelsPerSecond : 0;
    state.lastTimestamp = 0;
    state.currentNoteIndex = findClosestNoteIndex(state.songTime);
    state.ui.scoreDisplay.textContent = 'Score: 0';
    state.ui.streakDisplay.textContent = '1x';
    state.ui.targetNoteDisplay.textContent = 'Target: --';
    state.ui.feedbackDisplay.textContent = 'Feedback: --';
    state.ui.pitchDisplay.textContent = 'Detected: --';
    state.stars = [];
    for (let i = 0; i < 100; i++) {
        const { neckTopY } = getNeckGeometry();
        state.stars.push({ x: Math.random() * state.ui.tabDisplay.clientWidth, y: Math.random() * neckTopY, r: Math.random() * 1.5 });
    }
    if (state.currentSongData && state.currentSongData.tablature) {
        state.currentSongData.tablature.forEach(tabEvent => {
            if (tabEvent.notes[0].startTime >= state.songTime) {
                delete tabEvent.isScored;
                tabEvent.notes.forEach(note => {
                    delete note.isAudioTriggered;
                    delete note.impactTime;
                    delete note.feedback;
                });
            }
        });
    }
    drawDynamicLayer();
    renderMinimap();
}

export function endSession() {
    if (!state.currentSongData) return;
    Logger.info(`Session ended in ${state.currentMode} mode.`, 'Game', { score: state.gameState.score, perfect: state.gameState.perfectNotes, attempted: state.gameState.attemptedNotes });
    
    // Capture score BEFORE it gets reset by stopAnimation()
    const finalScore = state.gameState.score;
    const oldHighScore = state.currentSongData.highScore || 0;

    // Update summary screen UI
    state.ui.summaryScore.textContent = String(finalScore);
    const accuracy = state.gameState.attemptedNotes > 0 ? Math.round((state.gameState.perfectNotes / state.gameState.attemptedNotes) * 100) : 0;
    state.ui.summaryAccuracy.textContent = `${accuracy}%`;

    // Save high score if applicable
    if (state.currentMode === 'performance' && finalScore > oldHighScore) {
        Logger.info(`New high score achieved in Performance Mode: ${finalScore} with ${accuracy}% accuracy.`, 'Game');
        const songToUpdate = state.songs.find(s => s.id === state.currentSongData!.id);
        if (songToUpdate) {
            songToUpdate.highScore = finalScore;
            songToUpdate.accuracy = accuracy;
            localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
        }
    } else if (state.currentMode === 'practice') {
        Logger.info(`Practice session score ${finalScore} will not be saved.`, 'Game');
    }
    
    // Now stop the animation and show the summary
    stopAnimation();
    showSummaryScreen();
}

export function findClosestNoteIndex(time: number) {
    const tabData = state.currentSongData?.tablature;
    if (!tabData || tabData.length === 0) return 0;

    let low = 0;
    let high = tabData.length - 1;
    let ans = 0;

    while (low <= high) {
        const mid = low + Math.floor((high - low) / 2);
        const noteTime = tabData[mid]?.notes[0]?.startTime;
        
        if (noteTime === undefined) {
            high = mid - 1;
            continue;
        }

        if (noteTime <= time) {
            ans = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return ans;
}

export function getMeasureDuration() {
    if (!state.currentSongData) return 2;
    const { midiTempo, midiTimeSignature } = state.currentSongData;
    const tempo = midiTempo || 500000;
    const timeSignature = midiTimeSignature ? JSON.parse(midiTimeSignature) : { numerator: 4, denominator: 4 };
    const secondsPerBeat = tempo / 1000000;
    const beatsPerMeasure = timeSignature.numerator || 4;
    return secondsPerBeat * beatsPerMeasure;
}