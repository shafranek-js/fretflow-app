
import { state } from './state';
import * as InstrumentConfig from './config';
import { Logger } from './logger';
import { drawDynamicLayer, renderMinimap } from './renderer';
import { startAnimation, stopAnimation, findClosestNoteIndex } from './game';
import { showPracticeScreen } from './ui';
import { stopAllSounds } from './audio';
import type { Song, TabEvent, Note, InstrumentID } from './types';
import { assignFingering, findPossiblePositions } from './tablature';

function getProcessedTablature(): TabEvent[] {
    const sourceTab = state.isEditMode ? state.editedTablature : state.originalTablature;
    if (!sourceTab || sourceTab.length === 0) return [];

    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    
    const newTab = JSON.parse(JSON.stringify(sourceTab)) as TabEvent[];

    for (let i = 0; i < newTab.length; i++) {
        const targetEvent = newTab[i];

        const notesData = targetEvent.notes.map((note, j) => {
            const sourceNote = sourceTab[i].notes[j];
            const newPitch = sourceNote.pitch + state.transposeOffset;
            note.pitch = newPitch; // Update pitch right away

            const preferredString = sourceNote.string + state.stringShiftOffset;
            const fretOnPreferredString = newPitch - config.tuning[preferredString];

            // Check if the preferred position is valid
            if (preferredString >= 0 && preferredString < config.numStrings && fretOnPreferredString >= 0 && fretOnPreferredString <= config.numFrets) {
                return { note, preferredString, isPlaced: false };
            } else {
                // If not, we'll have to find a new home for it.
                return { note, preferredString: -1, isPlaced: false }; // Mark as needing placement
            }
        });

        const usedStrings = new Set<number>();

        // First pass: place notes that have a valid preferred string.
        notesData.forEach(item => {
            if (item.preferredString !== -1 && !usedStrings.has(item.preferredString)) {
                item.note.string = item.preferredString;
                item.note.fret = item.note.pitch - config.tuning[item.preferredString];
                usedStrings.add(item.preferredString);
                item.isPlaced = true;
            }
        });

        // Second pass: place the remaining notes.
        notesData.forEach(item => {
            if (!item.isPlaced) {
                const allPositions = findPossiblePositions(item.note.pitch, state.currentInstrument);
                const alternative = allPositions
                    .filter(p => !usedStrings.has(p.string))
                    .sort((a, b) => a.fret - b.fret)[0]; // Pick lowest fret on available string

                if (alternative) {
                    item.note.string = alternative.string;
                    item.note.fret = alternative.fret;
                    usedStrings.add(alternative.string);
                    item.isPlaced = true;
                } else {
                    // Still couldn't place it. This should be prevented by isTransposePossible.
                    // Let's just put it somewhere, even if it conflicts.
                    if (allPositions.length > 0) {
                        item.note.string = allPositions[0].string;
                        item.note.fret = allPositions[0].fret;
                    } else {
                         item.note.fret = -1; // Mark as unplayable
                    }
                }
            }
        });
    }
    
    return assignFingering(newTab);
}


export function updateAndRenderTablature(options: { recalculateFingering?: boolean } = {}) {
    if (!state.currentSongData) return;

    if (options.recalculateFingering) {
        Logger.info('Global fingering override triggered. Resetting all manual fingerings.', 'Practice');
        // Modify the source of truth directly.
        state.originalTablature.forEach(event => {
            event.notes.forEach(note => {
                note.finger = 0; // Reset all fingerings to default.
            });
        });
        
        // Also persist this reset to localStorage immediately.
        const songToUpdate = state.songs.find(s => s.id === state.currentSongData!.id);
        if (songToUpdate) {
            songToUpdate.tablature = JSON.stringify(state.originalTablature);
            localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
            Logger.info('Persisted fingering reset to song library.', 'Practice');
        }
    }

    state.currentSongData.tablature = getProcessedTablature();
    drawDynamicLayer();
    renderMinimap();
    state.ui.transposeValue.textContent = state.transposeOffset > 0 ? `+${state.transposeOffset}` : String(state.transposeOffset);
    state.ui.stringShiftValue.textContent = state.stringShiftOffset > 0 ? `+${state.stringShiftOffset}` : String(state.stringShiftOffset);
}

export async function saveCurrentPracticeSettings() {
    if (!state.currentSongData || !state.currentSongData.id || state.isEditMode) return;
    try {
        const songToUpdate = state.songs.find(s => s.id === state.currentSongData!.id);
        if (songToUpdate) {
            const settings = {
                playbackTempo: parseInt((state.ui.tempoSlider as HTMLInputElement).value),
                transpose: state.transposeOffset,
                stringShift: state.stringShiftOffset,
                zoomLevel: state.zoomLevel,
            };
            Object.assign(songToUpdate, settings);
            // This is a side-effect that should be handled by a dedicated library/storage manager
            localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
            Logger.info(`Saved settings for song: ${songToUpdate.title}`, 'Practice', settings);
        }
    } catch (error) {
        Logger.error(error as Error, "SavePracticeSettings");
    }
}

export function isStringShiftPossible(shift: number): boolean {
    if (!state.originalTablature) return false;
    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    const sourceTab = state.isEditMode ? state.editedTablature : state.originalTablature;

    for (const tabEvent of sourceTab) {
        for (const note of tabEvent.notes) {
            const newString = note.string + shift;
            if (newString < 0 || newString >= config.numStrings) return false;

            const newFret = note.pitch - config.tuning[newString];
            if (newFret < 0 || newFret > config.numFrets) return false;
        }
    }
    return true;
}

export function isTransposePossible(transpose: number) {
    if (!state.originalTablature) return true;
    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    const sourceTab = state.isEditMode ? state.editedTablature : state.originalTablature;

    for (const tabEvent of sourceTab) {
        const notesToPlace = tabEvent.notes.map(note => {
            const newPitch = note.pitch + state.transposeOffset + transpose;
            return {
                pitch: newPitch,
                positions: findPossiblePositions(newPitch, state.currentInstrument)
            };
        });

        if (notesToPlace.some(n => n.positions.length === 0)) return false;
        if (notesToPlace.length > config.numStrings) return false;

        function canPlaceNotes(noteIndex: number, usedStrings: Set<number>): boolean {
            if (noteIndex === notesToPlace.length) return true;
            
            const note = notesToPlace[noteIndex];
            for (const pos of note.positions) {
                if (!usedStrings.has(pos.string)) {
                    if (canPlaceNotes(noteIndex + 1, new Set(usedStrings).add(pos.string))) {
                        return true;
                    }
                }
            }
            return false;
        }

        if (!canPlaceNotes(0, new Set())) return false;
    }

    return true;
}

export function checkAllBounds() {
    if (!state.currentSongData) return;
    // Check Transpose bounds
    (state.ui.transposeUpBtn as HTMLButtonElement).disabled = !isTransposePossible(1);
    (state.ui.transposeDownBtn as HTMLButtonElement).disabled = !isTransposePossible(-1);
    // Check String Shift bounds
    (state.ui.stringShiftUpBtn as HTMLButtonElement).disabled = !isStringShiftPossible(state.stringShiftOffset - 1); // Up arrow moves to smaller string index
    (state.ui.stringShiftDownBtn as HTMLButtonElement).disabled = !isStringShiftPossible(state.stringShiftOffset + 1);
}

export function hitTestMinimap(e: MouseEvent) {
    if (!state.currentSongData) return { mode: null, time: 0 };
    const rect = state.ui.minimapCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * state.currentSongData.totalDuration;
    
    if (state.isEditMode || state.currentMode === 'performance') {
        return { mode: 'seek' as const, time };
    }

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
    stopAllSounds(); // Ensure synth stops playing old notes
    drawDynamicLayer();
    renderMinimap();
}

export async function loadSongToPractice(songData: Song) {
    Logger.info(`Loading song to practice: ${songData.title}`, 'Practice', { id: songData.id });
    let parsedTablature = JSON.parse(songData.tablature || '[]');
    if (parsedTablature.length > 0 && parsedTablature[0].pitch !== undefined && parsedTablature[0].notes === undefined) {
        Logger.info("Migrating old song data structure to new format.", "SongLoad");
        parsedTablature = parsedTablature.map((note: any) => ({ notes: [note], isChord: false }));
    }
    state.originalTablature = parsedTablature;
    state.transposeOffset = songData.transpose || 0;
    state.stringShiftOffset = songData.stringShift || 0;
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
    
    state.currentSongData = { ...songData, tablature: [], totalDuration: totalDuration, minDuration: minDuration, pixelsPerSecond: pixelsPerSecond };
    
    state.loopStartTime = 0;
    state.loopEndTime = totalDuration;
    state.currentMode = 'practice'; // Default to practice mode

    updateAndRenderTablature();
    checkAllBounds();
    await showPracticeScreen();
    stopAnimation();
    startAnimation();
}