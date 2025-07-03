
import { on, throttle, cls, $$ } from './dom';
import { state } from './state';
import { Logger } from './logger';
import { getNoteIdAt, openNoteEditor, closeNoteEditor, handleUndo, handleRedo } from './editor';
import { handleAddSong, handleExport, handleImport, saveCurrentInstrument, loadLibraryFromLocalStorage, renderSongLibrary, saveGlobalSettings, handleSongClick } from './library';
import { startAnimation, pauseAnimation, resumeAnimation, stopAnimation, endSession } from './game';
import { handleResize, drawDynamicLayer, renderMinimap, getNeckGeometry, drawStaticLayer } from './renderer';
import { showTunerScreen, showLibrary, showSummaryScreen } from './ui';
import { updateAndRenderTablature, saveCurrentPracticeSettings, checkTransposeBounds, isTransposePossible, handleMinimapInteraction, hitTestMinimap } from './practice';
import * as InstrumentConfig from './config';
import { stopAllOscillators, setMasterMute } from './audio';
import type { InstrumentID } from './types';

function setupLibraryListeners() {
    const updateInstrumentButtons = () => {
        const isGuitar = state.currentInstrument === 'guitar';
        cls(state.ui.selectGuitarBtn, { 'bg-blue-600': isGuitar, 'text-white': isGuitar });
        cls(state.ui.selectUkuleleBtn, { 'bg-blue-600': !isGuitar, 'text-white': !isGuitar });
    };

    const switchInstrument = (instrument: InstrumentID) => {
        if (state.currentInstrument === instrument) return;
        state.currentInstrument = instrument;
        saveCurrentInstrument();
        loadLibraryFromLocalStorage();
        updateInstrumentButtons();
    };

    on(state.ui.selectGuitarBtn, 'click', () => switchInstrument('guitar'));
    on(state.ui.selectUkuleleBtn, 'click', () => switchInstrument('ukulele'));
    on(state.ui.midiFileInput, 'change', handleAddSong);
    on(state.ui.exportLibraryBtn, 'click', handleExport);
    on(state.ui.importLibraryInput, 'change', handleImport);
    on(state.ui.songList, 'click', handleSongClick);
    updateInstrumentButtons();
}

function setupPracticeControlListeners() {
    on(state.ui.playPauseBtn, 'click', () => {
        if (!state.isPlaying) startAnimation(); else if (state.isPaused) resumeAnimation(); else pauseAnimation();
    });
    on(state.ui.rewindBtn, 'click', () => {
        stopAnimation(true);
        startAnimation();
    });
    on(state.ui.practiceBackBtn, 'click', async () => {
        await saveCurrentPracticeSettings();
        showLibrary();
    });
    on(state.ui.editModeBtn, 'click', async () => {
        const leavingEditMode = state.isEditMode;
        state.isEditMode = !state.isEditMode;
        cls(state.ui.practice, { 'in-edit-mode': state.isEditMode });
        closeNoteEditor();
        if (state.isEditMode) {
            stopAnimation();
            state.editedTablature = JSON.parse(JSON.stringify(state.originalTablature));
            state.editHistory = [];
            state.historyIndex = -1;
            (state.ui.undoBtn as HTMLButtonElement).disabled = true;
            (state.ui.redoBtn as HTMLButtonElement).disabled = true;
            state.ui.editModeBtn.textContent = 'Save & Exit';
            $$<HTMLButtonElement>('.local-setting-control').forEach(el => el.disabled = true);
            cls(state.ui.editButtonsContainer, { 'hidden': false });
        } else {
            (state.ui.editModeBtn as HTMLButtonElement).disabled = true;
            state.ui.editModeBtn.textContent = 'Saving...';
            try {
                if (leavingEditMode && state.pendingEdits) {
                    const songToUpdate = state.songs.find(s => s.id === state.currentSongData!.id);
                    if (songToUpdate) {
                        songToUpdate.tablature = JSON.stringify(state.editedTablature);
                        state.originalTablature = JSON.parse(JSON.stringify(state.editedTablature));
                        localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
                    }
                }
            } catch (error) {
                Logger.log(error as Error, "SaveEdits");
            } finally {
                state.pendingEdits = false;
                state.ui.editModeBtn.textContent = 'Edit';
                (state.ui.editModeBtn as HTMLButtonElement).disabled = false;
                $$<HTMLButtonElement>('.local-setting-control').forEach(el => el.disabled = false);
                cls(state.ui.editButtonsContainer, { 'hidden': true });
            }
        }
        updateAndRenderTablature();
    });
}

function setupSettingsListeners() {
    // Local Settings
    on(state.ui.tempoSlider, 'input', (e: Event) => {
        state.ui.tempoValue.textContent = `${(e.target as HTMLInputElement).value}%`;
    });
    on(state.ui.tempoSlider, 'change', saveCurrentPracticeSettings);
    on(state.ui.zoomSlider, 'input', (e: Event) => {
        state.zoomLevel = parseFloat((e.target as HTMLInputElement).value);
        state.ui.zoomValue.textContent = `${Math.round(state.zoomLevel * 100)}%`;
        if (state.currentSongData) {
            const basePixelsPerSecond = Math.max(150, ((72 * state.globalSettings.noteSize) + 8) / state.currentSongData.minDuration);
            state.currentSongData.pixelsPerSecond = basePixelsPerSecond * state.zoomLevel;
            drawDynamicLayer();
            renderMinimap();
        }
    });
    on(state.ui.zoomSlider, 'change', saveCurrentPracticeSettings);
    on(state.ui.transposeDownBtn, 'click', () => {
        if (state.isEditMode) return;
        if (isTransposePossible(state.transposeOffset - 1)) {
            state.transposeOffset--;
            updateAndRenderTablature();
            saveCurrentPracticeSettings();
            checkTransposeBounds();
        }
    });
    on(state.ui.transposeUpBtn, 'click', () => {
        if (state.isEditMode) return;
        if (isTransposePossible(state.transposeOffset + 1)) {
            state.transposeOffset++;
            updateAndRenderTablature();
            saveCurrentPracticeSettings();
            checkTransposeBounds();
        }
    });

    // Global Settings
    on(state.ui.noteSizeSlider, 'input', (e: Event) => {
        state.globalSettings.noteSize = parseFloat((e.target as HTMLInputElement).value);
        state.ui.noteSizeValue.textContent = `${Math.round(state.globalSettings.noteSize * 100)}%`;
        updateAndRenderTablature();
    });
    on(state.ui.noteSizeSlider, 'change', saveGlobalSettings);
    on(state.ui.stringSpacingSlider, 'input', (e: Event) => {
        state.globalSettings.stringSpacing = parseFloat((e.target as HTMLInputElement).value);
        state.ui.stringSpacingValue.textContent = `${Math.round(state.globalSettings.stringSpacing * 100)}%`;
        drawStaticLayer();
        drawDynamicLayer();
    });
    on(state.ui.stringSpacingSlider, 'change', saveGlobalSettings);
    on(state.ui.stringThicknessSlider, 'input', (e: Event) => {
        state.globalSettings.stringThickness = parseFloat((e.target as HTMLInputElement).value);
        state.ui.stringThicknessValue.textContent = `${Math.round(state.globalSettings.stringThickness * 100)}%`;
        drawStaticLayer();
        drawDynamicLayer();
    });
    on(state.ui.stringThicknessSlider, 'change', saveGlobalSettings);
}

function setupEditorControlListeners() {
    on(state.ui.undoBtn, 'click', handleUndo);
    on(state.ui.redoBtn, 'click', handleRedo);
    on(state.ui.editorCloseBtn, 'click', closeNoteEditor);
    on(state.ui.editorFretUp, 'click', () => changeFret(1));
    on(state.ui.editorFretDown, 'click', () => changeFret(-1));
    on(state.ui.editorFingerButtons, 'click', (e: MouseEvent) => {
        const button = (e.target as HTMLElement).closest('.finger-btn') as HTMLButtonElement;
        if (button && state.selectedNoteIndex) {
            const newFinger = parseInt(button.dataset.finger!);
            const { eventIndex, noteIndex } = state.selectedNoteIndex;
            const note = state.editedTablature[eventIndex].notes[noteIndex];
            if (note.finger !== newFinger) {
                // This is a direct state manipulation, it should use a function from editor.ts
                note.finger = newFinger;
                state.pendingEdits = true;
                openNoteEditor(state.selectedNoteIndex);
            }
        }
    });
    function changeFret(delta: number) {
        if (!state.selectedNoteIndex) return;
        const config = InstrumentConfig.getInstrument(state.currentInstrument);
        const { eventIndex, noteIndex } = state.selectedNoteIndex;
        const note = state.editedTablature[eventIndex].notes[noteIndex];
        const newFret = note.fret + delta;
        if (newFret >= 0 && newFret <= config.numFrets) {
            const newPitch = config.tuning[note.string] + newFret;
            note.fret = newFret;
            note.pitch = newPitch;
            state.pendingEdits = true;
            openNoteEditor(state.selectedNoteIndex);
        }
    }
}

function setupCanvasListeners() {
    on(state.ui.dynamicCanvas, 'mousedown', (e: MouseEvent) => {
        if (state.isEditMode) {
            const clickedId = getNoteIdAt(e.clientX, e.clientY);
            if (clickedId) {
                state.isDragging = true;
                state.wasDragged = false;
                state.draggedNoteIndex = clickedId;
                cls(state.ui.dynamicCanvas, { 'grabbing': true });
            } else {
                closeNoteEditor();
            }
        }
    });
    on(state.ui.dynamicCanvas, 'click', (e: MouseEvent) => {
        if (!state.isEditMode) {
            if (!state.isPlaying) startAnimation(); else if (state.isPaused) resumeAnimation(); else pauseAnimation();
        }
    });
    const handleCanvasHover = throttle((e: MouseEvent) => {
        if (!state.isEditMode || !state.currentSongData || state.isDragging) return;
        const newHoveredId = getNoteIdAt(e.clientX, e.clientY);
        if (JSON.stringify(newHoveredId) !== JSON.stringify(state.hoveredNoteIndex)) {
            state.hoveredNoteIndex = newHoveredId;
            drawDynamicLayer();
        }
    }, 50);
    on(state.ui.dynamicCanvas, 'mousemove', (e: MouseEvent) => {
        if (state.isDragging) {
            state.wasDragged = true;
            requestAnimationFrame(() => drawDynamicLayer(0, e));
            return;
        }
        handleCanvasHover(e);
    });
    on(state.ui.dynamicCanvas, 'mouseup', (e: MouseEvent) => {
        if (!state.currentSongData) return;
        const config = InstrumentConfig.getInstrument(state.currentInstrument);
        if (state.wasDragged && state.draggedNoteIndex) {
            const rect = state.ui.dynamicCanvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const { neckTopY, neckHeight } = getNeckGeometry();
            const stringHeight = neckHeight / config.numStrings;
            const targetString = Math.max(0, Math.min(config.numStrings - 1, Math.round((y - neckTopY) / stringHeight - 0.5)));
            const { eventIndex, noteIndex } = state.draggedNoteIndex;
            const noteToMove = state.editedTablature[eventIndex].notes[noteIndex];
            const newFret = noteToMove.pitch - config.tuning[targetString];
            if (newFret >= 0 && newFret <= config.numFrets && targetString !== noteToMove.string) {
                noteToMove.string = targetString;
                noteToMove.fret = newFret;
                state.pendingEdits = true;
            }
        } else if (state.isEditMode && !state.wasDragged) {
            const clickedId = getNoteIdAt(e.clientX, e.clientY);
            if (clickedId) {
                const isSameNote = state.selectedNoteIndex && state.selectedNoteIndex.eventIndex === clickedId.eventIndex && state.selectedNoteIndex.noteIndex === clickedId.noteIndex;
                if (isSameNote) closeNoteEditor(); else openNoteEditor(clickedId);
            }
        }
        state.isDragging = false;
        state.draggedNoteIndex = null;
        state.wasDragged = false;
        cls(state.ui.dynamicCanvas, { 'grabbing': false });
        drawDynamicLayer();
    });
    on(state.ui.dynamicCanvas, 'mouseleave', () => {
        if (state.isDragging) {
            state.isDragging = false;
            state.draggedNoteIndex = null;
            state.wasDragged = false;
            cls(state.ui.dynamicCanvas, { 'grabbing': false });
            drawDynamicLayer();
        }
    });
}

function setupMinimapListeners() {
    on(state.ui.minimapCanvas, 'mousedown', (e: MouseEvent) => {
        if (!state.currentSongData) return;
        state.isScrubbingMinimap = true;
        stopAllOscillators();
        setMasterMute(true);
        const { mode } = hitTestMinimap(e);
        state.dragMode = mode;
        handleMinimapInteraction(e);
    });
    const throttledMinimapInteraction = throttle(handleMinimapInteraction, 16);
    on(window, 'mousemove', (e: MouseEvent) => {
        if (state.isScrubbingMinimap) {
            throttledMinimapInteraction(e);
        } else {
            if (!state.currentSongData || state.isEditMode) {
                (state.ui.minimapCanvas as HTMLElement).style.cursor = 'pointer';
                return;
            }
            const { mode } = hitTestMinimap(e);
            (state.ui.minimapCanvas as HTMLElement).style.cursor = (mode === 'start' || mode === 'end') ? 'ew-resize' : 'pointer';
        }
    });
    function finishScrub() {
        if (!state.isScrubbingMinimap) return;
        state.isScrubbingMinimap = false;
        state.dragMode = null;
        requestAnimationFrame(() => setMasterMute(false));
    }
    on(window, 'mouseup', finishScrub);
    on(window, 'mouseleave', finishScrub);
}

function setupGlobalListeners() {
    function notifyFullscreenBlocked() {
        const originalHTML = state.ui.fullscreenBtn.innerHTML;
        state.ui.fullscreenBtn.textContent = 'Fullscreen N/A';
        (state.ui.fullscreenBtn as HTMLButtonElement).disabled = true;
        setTimeout(() => {
            state.ui.fullscreenBtn.innerHTML = originalHTML;
            (state.ui.fullscreenBtn as HTMLButtonElement).disabled = false;
        }, 2500);
    }
    on(state.ui.fullscreenBtn, 'click', async () => {
        if (!document.fullscreenEnabled) {
            notifyFullscreenBlocked();
            return;
        }
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            Logger.log(err as Error, 'Fullscreen');
            notifyFullscreenBlocked();
        }
    });
    on(state.ui.tunerNavBtn, 'click', showTunerScreen);
    on(state.ui.summaryBackBtn, 'click', showLibrary);
    on(state.ui.tunerBackBtn, 'click', showLibrary);

    const closeSettings = () => {
        cls(state.ui.settingsMenu, { 'open': false });
        cls(state.ui.settingsBackdrop, { 'open': false });
    }
    on(state.ui.settingsBtn, 'click', (e: Event) => {
        e.stopPropagation();
        cls(state.ui.settingsMenu, { 'open': true });
        cls(state.ui.settingsBackdrop, { 'open': true });
    });
    on(state.ui.settingsBackdrop, 'click', closeSettings);
    on(document, 'click', (e: Event) => {
        if (!state.ui.settingsMenuContent.contains(e.target as Node) && !state.ui.settingsBtn.contains(e.target as Node)) {
            closeSettings();
        }
    });
    on(document, 'keydown', (e: KeyboardEvent) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        if (e.code === 'Space' && !state.ui.practice.classList.contains('hidden')) {
            e.preventDefault();
            if (!state.isEditMode) {
                if (!state.isPlaying) startAnimation(); else if (state.isPaused) resumeAnimation(); else pauseAnimation();
            }
        }
        if (!state.isEditMode) return;
        const isUndo = (e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey;
        const isRedo = (e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));
        if (isUndo) { e.preventDefault(); handleUndo(); }
        if (isRedo) { e.preventDefault(); handleRedo(); }
    });
    on(window, 'resize', throttle(handleResize, 100));
}

export function setupAllListeners() {
    setupLibraryListeners();
    setupPracticeControlListeners();
    setupSettingsListeners();
    setupEditorControlListeners();
    setupCanvasListeners();
    setupMinimapListeners();
    setupGlobalListeners();
}