
import { state } from './state';
import * as InstrumentConfig from './config';
import { Logger } from './logger';
import { drawDynamicLayer, renderMinimap } from './renderer';
import { startAnimation, stopAnimation, findClosestNoteIndex } from './game';
import { showPracticeScreen } from './ui';
import { setMasterMute, stopAllOscillators } from './audio';
import type { Song, TabEvent, Note } from './types';

export function updateAndRenderTablature() {
    if (!state.currentSongData) return;
    state.currentSongData.tablature = state.isEditMode ? state.editedTablature : (state.originalTablature || []);
    drawDynamicLayer();
    renderMinimap();
    state.ui.transposeValue.textContent = state.transposeOffset > 0 ? `+${state.transposeOffset}` : String(state.transposeOffset);
}

export async function saveCurrentPracticeSettings() {
    if (!state.currentSongData || !state.currentSongData.id || state.isEditMode) return;
    try {
        const songToUpdate = state.songs.find(s => s.id === state.currentSongData!.id);
        if (songToUpdate) {
            songToUpdate.playbackTempo = parseInt((state.ui.tempoSlider as HTMLInputElement).value);
            songToUpdate.transpose = state.transposeOffset;
            songToUpdate.zoomLevel = state.zoomLevel;
            // This is a side-effect that should be handled by a dedicated library/storage manager
            localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
        }
    } catch (error) {
        Logger.log(error as Error, "SavePracticeSettings");
    }
}

export function isTransposePossible(offset: number) {
    if (!state.originalTablature || state.originalTablature.length === 0) return true;
    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    const sourceTab = state.isEditMode ? state.editedTablature : state.originalTablature;
    for (const tabEvent of sourceTab) {
        for (const note of tabEvent.notes) {
            const newFret = note.fret + offset;
            if (newFret < 0 || newFret > config.numFrets) {
                return false;
            }
        }
    }
    return true;
}

export function checkTransposeBounds() {
    if (!state.currentSongData) return;
    (state.ui.transposeUpBtn as HTMLButtonElement).disabled = !isTransposePossible(state.transposeOffset + 1);
    (state.ui.transposeDownBtn as HTMLButtonElement).disabled = !isTransposePossible(state.transposeOffset - 1);
}

export function hitTestMinimap(e: MouseEvent) {
    if (!state.currentSongData) return { mode: null, time: 0 };
    const rect = state.ui.minimapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * state.currentSongData.totalDuration;
    if (state.isEditMode) return { mode: 'seek' as const, time };

    const { MINIMAP_HANDLE_W, MINIMAP_HIT_PAD } = InstrumentConfig;
    const hx = MINIMAP_HANDLE_W / 2;
    const loopStartX = (state.loopStartTime / state.currentSongData.totalDuration) * rect.width;
    const loopEndX = (state.loopEndTime! / state.currentSongData.totalDuration) * rect.width;
    const onStartHandle = Math.abs(x - loopStartX) < (hx + MINIMAP_HIT_PAD);
    const onEndHandle = Math.abs(x - loopEndX) < (hx + MINIMAP_HIT_PAD);

    if (onStartHandle) return { mode: 'start' as const, time };
    if (onEndHandle) return { mode: 'end' as const, time };
    return { mode: 'seek' as const, time };
}

export function handleMinimapInteraction(e: MouseEvent) {
    if (!state.currentSongData) return;
    const { time } = hitTestMinimap(e);

    if (state.dragMode === 'start') {
        state.loopStartTime = Math.max(0, Math.min(time, state.loopEndTime! - 0.1));
    } else if (state.dragMode === 'end') {
        state.loopEndTime = Math.min(state.currentSongData.totalDuration, Math.max(time, state.loopStartTime + 0.1));
    } else if (state.dragMode === 'seek') {
        state.songTime = Math.max(0, Math.min(time, state.currentSongData.totalDuration));
    }

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

    state.currentScrollX = state.songTime * state.currentSongData.pixelsPerSecond;
    state.currentNoteIndex = findClosestNoteIndex(state.songTime);
    drawDynamicLayer();
    renderMinimap();
}

export async function loadSongToPractice(songData: Song) {
    let parsedTablature = JSON.parse(songData.tablature || '[]');
    if (parsedTablature.length > 0 && parsedTablature[0].pitch !== undefined && parsedTablature[0].notes === undefined) {
        Logger.log("Migrating old song data structure to new format.", "SongLoad");
        parsedTablature = parsedTablature.map((note: any) => ({ notes: [note], isChord: false }));
    }
    state.originalTablature = parsedTablature;
    state.transposeOffset = songData.transpose || 0;
    state.zoomLevel = songData.zoomLevel || 1.0;
    const playbackTempo = songData.playbackTempo || 100;

    const lastEvent = parsedTablature.length > 0 ? parsedTablature[parsedTablature.length - 1] : { notes: [{ startTime: 0, duration: 0 }] };
    const totalDuration = lastEvent.notes[0].startTime + lastEvent.notes[0].duration;
    const durations = parsedTablature.flatMap((e: TabEvent) => e.notes).map((n: Note) => n.duration).filter((d: number) => d > 0);
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0.1;
    const pixelsPerSecond = Math.max(150, ((72 * state.globalSettings.noteSize) + 8) / minDuration) * state.zoomLevel;
    
    (state.ui.tempoSlider as HTMLInputElement).value = String(playbackTempo);
    state.ui.tempoValue.textContent = `${playbackTempo}%`;
    (state.ui.zoomSlider as HTMLInputElement).value = String(state.zoomLevel);
    state.ui.zoomValue.textContent = `${Math.round(state.zoomLevel * 100)}%`;
    
    state.currentSongData = { ...songData, tablature: state.originalTablature, totalDuration: totalDuration, minDuration: minDuration, pixelsPerSecond: pixelsPerSecond };
    
    state.loopStartTime = 0;
    state.loopEndTime = totalDuration;

    updateAndRenderTablature();
    checkTransposeBounds();
    await showPracticeScreen();
    stopAnimation();
    startAnimation();
}
