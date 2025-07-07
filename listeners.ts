import { on, throttle, cls, $$ } from './dom';
import { state } from './state';
import { Logger, LogLevel, type LogEntry } from './logger';
import { getNoteIdAt, openNoteEditor, closeNoteEditor, handleUndo, handleRedo, addEditHistory, handleNoteDelete } from './editor';
import { handleAddSong, handleExport, handleImport, loadLibrary } from './library';
import { handleSongClick, renderSongLibrary } from './library-ui';
import { startAnimation, pauseAnimation, resumeAnimation, stopAnimation } from './game';
import { handleResize, drawDynamicLayer, renderMinimap, getNeckGeometry, drawStaticLayer } from './renderer';
import { showTunerScreen, showLibrary, openLogViewer, closeLogViewer, saveCurrentInstrument, saveGlobalSettings, showConfirmation, updateModeUI, showPracticeScreen } from './ui';
import { updateAndRenderTablature, saveCurrentPracticeSettings, checkAllBounds, handleMinimapInteraction, hitTestMinimap } from './practice';
import * as InstrumentConfig from './config';
import { stopAllSounds, setMasterMute, loadInstrument } from './audio';
import type { InstrumentID } from './types';
import { MIDI_INSTRUMENTS } from './config';

function setupLibraryListeners() {
    const updateInstrumentButtons = () => {
        const isGuitar = state.currentInstrument === 'guitar';
        cls(state.ui.selectGuitarBtn, { 'active': isGuitar });
        cls(state.ui.selectUkuleleBtn, { 'active': !isGuitar });
        state.ui.instrumentNameDisplay.textContent = InstrumentConfig.getInstrument(state.currentInstrument).name;
    };

    const switchInstrument = (instrument: InstrumentID) => {
        if (state.currentInstrument === instrument) return;
        Logger.info(`Switching instrument to ${instrument}`, 'Library');
        state.currentInstrument = instrument;
        saveCurrentInstrument();
        loadLibrary();
        updateInstrumentButtons();
    };

    on(state.ui.selectGuitarBtn, 'click', () => switchInstrument('guitar'));
    on(state.ui.selectUkuleleBtn, 'click', () => switchInstrument('ukulele'));
    on(state.ui.librarySearchInput, 'input', () => renderSongLibrary());
    on(state.ui.libraryTunerBtn, 'click', showTunerScreen);
    on(state.ui.midiFileInput, 'change', handleAddSong);
    on(state.ui.exportLibraryBtn, 'click', handleExport);
    on(state.ui.importLibraryInput, 'change', handleImport);
    on(state.ui.songList, 'click', handleSongClick);
    updateInstrumentButtons();
}

async function saveEdits() {
    const saveBtn = state.ui.saveBtn as HTMLButtonElement;
    if (!state.pendingEdits || saveBtn.disabled) return;

    Logger.info('Saving edited tablature...', 'Editor');
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
        const songToUpdate = state.songs.find(s => s.id === state.currentSongData!.id);
        if (songToUpdate) {
            songToUpdate.tablature = JSON.stringify(state.editedTablature);
            // The saved edits become the new "original" state for this session
            state.originalTablature = JSON.parse(JSON.stringify(state.editedTablature));
            localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
            
            state.pendingEdits = false;
            state.editHistory = [];
            state.historyIndex = -1;

            (state.ui.undoBtn as HTMLButtonElement).disabled = true;
            (state.ui.redoBtn as HTMLButtonElement).disabled = true;
            
            state.ui.doneEditingBtn.textContent = 'Exit';
            cls(state.ui.doneEditingBtn, { 
                'bg-green-600': false, 'hover:bg-green-700': false, 
                'bg-gray-600': true, 'hover:bg-gray-700': true 
            });

            saveBtn.textContent = 'Saved!';
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        Logger.error(error as Error, "SaveEdits");
        alert('Error saving changes. Please check the logs.');
        saveBtn.textContent = 'Error!';
        await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
        saveBtn.textContent = 'Save';
        // It remains disabled because there are no longer pending edits
    }
}

function exitEditMode() {
    state.isEditMode = false;
    Logger.info('Exiting edit mode', 'Editor');
    
    // Reset state
    state.pendingEdits = false;
    state.editedTablature = [];
    state.editHistory = [];
    state.historyIndex = -1;
    closeNoteEditor();
    
    // Update UI
    cls(state.ui.practice, { 'in-edit-mode': false });
    cls(state.ui.editModeBtn, { 'hidden': false });
    cls(state.ui.editModeActions, { 'hidden': true });
    
    updateModeUI();
    updateAndRenderTablature();
}

function enterEditMode() {
    if (!state.currentSongData) return;
    
    state.isEditMode = true;
    Logger.info('Entering edit mode', 'Editor');
    
    stopAnimation();
    
    // Initialize editing state
    state.editedTablature = JSON.parse(JSON.stringify(state.originalTablature));
    state.editHistory = [];
    state.historyIndex = -1;
    state.pendingEdits = false;

    // Update UI for edit mode
    cls(state.ui.practice, { 'in-edit-mode': true });
    cls(state.ui.editModeBtn, { 'hidden': true });
    cls(state.ui.editModeActions, { 'hidden': false });
    
    // Set initial button states
    (state.ui.undoBtn as HTMLButtonElement).disabled = true;
    (state.ui.redoBtn as HTMLButtonElement).disabled = true;
    (state.ui.saveBtn as HTMLButtonElement).disabled = true;
    state.ui.doneEditingBtn.textContent = 'Exit';
    cls(state.ui.doneEditingBtn, { 
        'bg-green-600': false, 'hover:bg-green-700': false, 
        'bg-gray-600': true, 'hover:bg-gray-700': true 
    });

    updateModeUI();
    updateAndRenderTablature();
}

function switchMode(mode: 'practice' | 'performance') {
    if (state.currentMode === mode || state.isEditMode) return;
    
    // Close settings if open
    if (state.ui.settingsMenu.classList.contains('open')) {
        cls(state.ui.settingsMenu, { 'open': false });
        cls(state.ui.settingsBackdrop, { 'open': false });
    }

    state.currentMode = mode;
    Logger.info(`Switched to ${mode} mode`, 'Game');
    
    // In performance mode, ensure we do a full playthrough
    if (mode === 'performance' && state.currentSongData) {
        state.loopStartTime = 0;
        state.loopEndTime = state.currentSongData.totalDuration;
    }
    
    // Resetting the song is important for a clean run in the new mode
    stopAnimation(true); // Rewinds to loop start and resets score
    startAnimation();
    
    updateModeUI();
}

function setupPracticeControlListeners() {
    on(state.ui.playPauseBtn, 'click', () => {
        if (!state.isPlaying) startAnimation(); else if (state.isPaused) resumeAnimation(); else pauseAnimation();
    });
    on(state.ui.rewindBtn, 'click', () => {
        Logger.info('Rewinding song to loop start', 'Practice');
        stopAnimation(true);
        startAnimation();
    });
    on(state.ui.practiceBackBtn, 'click', async () => {
        if (state.isEditMode) {
            if (state.pendingEdits) {
                showConfirmation(
                    "Return to Library?",
                    "You have unsaved changes. What would you like to do before leaving?",
                    [
                        { 
                            text: 'Cancel', 
                            classes: 'px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 rounded-md text-white', 
                            onClick: () => {} 
                        },
                        { 
                            text: 'Discard & Leave', 
                            classes: 'px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md text-white', 
                            onClick: () => {
                                exitEditMode();
                                showLibrary();
                            }
                        },
                        { 
                            text: 'Save & Leave', 
                            classes: 'px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md text-white', 
                            onClick: async () => {
                                await saveEdits();
                                exitEditMode();
                                showLibrary();
                            }
                        },
                    ]
                );
            } else {
                exitEditMode();
                showLibrary();
            }
        } else {
            await saveCurrentPracticeSettings();
            showLibrary();
        }
    });
    
    on(state.ui.practiceTunerBtn, 'click', () => {
        if (state.isPlaying && !state.isPaused) {
            pauseAnimation();
        }
        showTunerScreen();
    });

    // Mode Switcher Listeners
    on(state.ui.selectPracticeBtn, 'click', () => switchMode('practice'));
    on(state.ui.selectPerformanceBtn, 'click', () => switchMode('performance'));

    // Listener to ENTER edit mode
    on(state.ui.editModeBtn, 'click', enterEditMode);
    
    // Listeners for WITHIN edit mode
    on(state.ui.saveBtn, 'click', saveEdits);
    on(state.ui.doneEditingBtn, 'click', async () => {
        if (state.pendingEdits) {
            showConfirmation(
                "Unsaved Changes",
                "You have unsaved changes. What would you like to do?",
                [
                    { text: 'Cancel', classes: 'px-4 py-2 text-sm bg-gray-500 hover:bg-gray-600 rounded-md text-white', onClick: () => {} },
                    { text: 'Discard & Exit', classes: 'px-4 py-2 text-sm bg-red-600 hover:bg-red-700 rounded-md text-white', onClick: exitEditMode },
                    { text: 'Save & Exit', classes: 'px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md text-white', onClick: async () => {
                        await saveEdits();
                        exitEditMode();
                    }},
                ]
            );
        } else {
            exitEditMode();
        }
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
        state.transposeOffset--;
        updateAndRenderTablature({ recalculateFingering: true });
        saveCurrentPracticeSettings();
        checkAllBounds();
    });
    on(state.ui.transposeUpBtn, 'click', () => {
        if (state.isEditMode) return;
        state.transposeOffset++;
        updateAndRenderTablature({ recalculateFingering: true });
        saveCurrentPracticeSettings();
        checkAllBounds();
    });

    on(state.ui.stringShiftDownBtn, 'click', () => {
        if (state.isEditMode) return;
        state.stringShiftOffset++;
        updateAndRenderTablature({ recalculateFingering: true });
        saveCurrentPracticeSettings();
        checkAllBounds();
    });
    on(state.ui.stringShiftUpBtn, 'click', () => {
        if (state.isEditMode) return;
        state.stringShiftOffset--;
        updateAndRenderTablature({ recalculateFingering: true });
        saveCurrentPracticeSettings();
        checkAllBounds();
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
    on(state.ui.editorDeleteBtn, 'click', handleNoteDelete);

    on(state.ui.editorFingerButtons, 'click', (e: MouseEvent) => {
        const button = (e.target as HTMLElement).closest('.finger-btn') as HTMLButtonElement;
        if (button && state.selectedNoteIndex) {
            const newFinger = parseInt(button.dataset.finger!);
            const { eventIndex, noteIndex } = state.selectedNoteIndex;
            const note = state.editedTablature[eventIndex].notes[noteIndex];
            if (note.finger !== newFinger) {
                addEditHistory({
                    type: 'finger',
                    noteId: state.selectedNoteIndex,
                    oldValue: note.finger,
                    newValue: newFinger
                });
                note.finger = newFinger;
                openNoteEditor(state.selectedNoteIndex);
                updateAndRenderTablature();
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
            const oldPitch = note.pitch;
            const oldFret = note.fret;
            const newPitch = config.tuning[note.string] + newFret;

            addEditHistory({
                type: 'pitch',
                noteId: state.selectedNoteIndex,
                oldValue: { pitch: oldPitch, fret: oldFret },
                newValue: { pitch: newPitch, fret: newFret }
            });
            
            note.fret = newFret;
            note.pitch = newPitch;
            openNoteEditor(state.selectedNoteIndex);
            updateAndRenderTablature();
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
                state.mousePosition = { x: e.clientX, y: e.clientY };
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
            state.mousePosition = { x: e.clientX, y: e.clientY };
            drawDynamicLayer();
            return;
        }
        handleCanvasHover(e);
    });
    on(state.ui.dynamicCanvas, 'mouseup', (e: MouseEvent) => {
        if (!state.currentSongData) return;
    
        const wasADrag = state.wasDragged;
    
        // Handle the drop logic if a drag occurred
        if (wasADrag && state.draggedNoteIndex) {
            const config = InstrumentConfig.getInstrument(state.currentInstrument);
            const rect = state.ui.dynamicCanvas.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const { neckTopY, neckHeight } = getNeckGeometry();
            const stringHeight = neckHeight / config.numStrings;
            const targetString = Math.max(0, Math.min(config.numStrings - 1, Math.round((y - neckTopY) / stringHeight - 0.5)));
            
            const { eventIndex, noteIndex } = state.draggedNoteIndex;
            const noteToMove = state.editedTablature[eventIndex].notes[noteIndex];
    
            const oldString = noteToMove.string;
            const oldFret = noteToMove.fret;
            
            const newFret = noteToMove.pitch - config.tuning[targetString];
            const isValidMove = newFret >= 0 && newFret <= config.numFrets;
    
            if (isValidMove && targetString !== oldString) {
                addEditHistory({
                    type: 'position',
                    noteId: state.draggedNoteIndex,
                    oldValue: { string: oldString, fret: oldFret },
                    newValue: { string: targetString, fret: newFret },
                });
                noteToMove.string = targetString;
                noteToMove.fret = newFret;
            }
        } else if (state.isEditMode && !wasADrag) {
            // This is a click, not a drag. Handle editor opening/closing.
            const clickedId = getNoteIdAt(e.clientX, e.clientY);
            if (clickedId) {
                const isSameNote = state.selectedNoteIndex && state.selectedNoteIndex.eventIndex === clickedId.eventIndex && state.selectedNoteIndex.noteIndex === clickedId.noteIndex;
                if (isSameNote) {
                    closeNoteEditor();
                } else {
                    openNoteEditor(clickedId);
                }
            }
        }
    
        // Reset all drag-related state regardless of what happened
        state.isDragging = false;
        state.draggedNoteIndex = null;
        state.wasDragged = false;
        state.mousePosition = null;
        cls(state.ui.dynamicCanvas, { 'grabbing': false });
    
        // If it was a drag, we MUST call updateAndRenderTablature to persist the change visually.
        // This ensures the note either snaps to its new valid position or
        // snaps back to its original position if the move was invalid.
        // If it was a click, open/closeNoteEditor already handled the rendering.
        if (wasADrag) {
            updateAndRenderTablature();
        }
    });
    on(state.ui.dynamicCanvas, 'mouseleave', () => {
        if (state.isDragging) {
            state.isDragging = false;
            state.draggedNoteIndex = null;
            state.wasDragged = false;
            state.mousePosition = null;
            cls(state.ui.dynamicCanvas, { 'grabbing': false });
            // Rerender to remove the dragged note ghost
            updateAndRenderTablature();
        }
    });
}

function setupMinimapListeners() {
    on(state.ui.minimapCanvas, 'mousedown', (e: MouseEvent) => {
        if (!state.currentSongData) return;
        state.isScrubbingMinimap = true;
        stopAllSounds();
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

function setupLogViewer() {
    const contentEl = state.ui.logViewerContent;

    const formatTime = (date: Date) => {
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(3, '0')}`;
    };

    const createLogElement = (log: LogEntry): HTMLElement => {
        const el = document.createElement('div');
        el.className = `log-entry log-entry-${log.level}`;
        const dataStr = log.data ? `\nData: ${JSON.stringify(log.data, null, 2)}` : '';
        el.innerHTML = `<span class="log-meta">${formatTime(log.timestamp)}</span> <span class="log-context">[${log.context}]</span> ${log.message}${dataStr}`;
        return el;
    };
    
    const renderLogs = () => {
        const logs = Logger.getLogs();
        const logElements = logs.map(createLogElement);
        contentEl.replaceChildren(...logElements);
        contentEl.scrollTop = contentEl.scrollHeight;
    };

    const appendLog = (log: LogEntry) => {
        if (state.ui.logViewer.classList.contains('hidden')) return;
        const el = createLogElement(log);
        const isScrolledToBottom = contentEl.scrollHeight - contentEl.clientHeight <= contentEl.scrollTop + 5; // 5px tolerance
        contentEl.appendChild(el);
        if (isScrolledToBottom) {
            contentEl.scrollTop = contentEl.scrollHeight;
        }
    };
    
    Logger.subscribe(appendLog);

    on(state.ui.logViewerBtn, 'click', () => {
        renderLogs(); // Full re-render when opening
        openLogViewer();
    });
    
    on(state.ui.closeLogsBtn, 'click', closeLogViewer);
    on(state.ui.logViewerBackdrop, 'click', closeLogViewer);
    
    on(state.ui.clearLogsBtn, 'click', () => {
        Logger.clear();
        renderLogs(); // Re-render to show empty state
    });
}

function setupInstrumentSelector() {
    const selector = state.ui.instrumentSelector as HTMLSelectElement;
    selector.innerHTML = ''; // Clear "Loading..."

    MIDI_INSTRUMENTS.forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category.category;
        category.instruments.forEach(instrument => {
            const option = document.createElement('option');
            option.value = String(instrument.program);
            // Remove the number prefix for a cleaner look
            option.textContent = instrument.name.replace(/^\d+\s*-\s*/, '');
            if (instrument.program === state.globalSettings.selectedInstrument) {
                option.selected = true;
            }
            optgroup.appendChild(option);
        });
        selector.appendChild(optgroup);
    });

    on(selector, 'change', async (e: Event) => {
        const newProgram = parseInt((e.target as HTMLSelectElement).value);
        state.globalSettings.selectedInstrument = newProgram;
        await loadInstrument(newProgram); // Asynchronously load the new instrument
        saveGlobalSettings();
        Logger.info(`Changed synth instrument to program ${newProgram}`, 'Audio');
    });
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
            Logger.warn('Fullscreen API is not available or is blocked.', 'UI');
            notifyFullscreenBlocked();
            return;
        }
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
                Logger.info('Entered fullscreen mode.', 'UI');
            } else {
                await document.exitFullscreen();
                Logger.info('Exited fullscreen mode.', 'UI');
            }
        } catch (err) {
            Logger.error(err as Error, 'Fullscreen');
            notifyFullscreenBlocked();
        }
    });

    on(state.ui.summaryBackBtn, 'click', showLibrary);

    on(state.ui.tunerBackBtn, 'click', () => {
        if (state.currentSongData) {
            // Came from practice screen, go back to it
            showPracticeScreen();
        } else {
            // Came from library
            showLibrary();
        }
    });

    const closeSettings = () => {
        cls(state.ui.settingsMenu, { 'open': false });
        cls(state.ui.settingsBackdrop, { 'open': false });
    }
    on(state.ui.settingsBtn, 'click', (e: Event) => {
        e.stopPropagation();
        cls(state.ui.settingsMenu, { 'open': true });
        cls(state.ui.settingsBackdrop, { 'open': true });
    });
    
    on(state.ui.moreActionsBtn, 'click', (e: Event) => {
        e.stopPropagation();
        const menu = state.ui.moreActionsMenu;
        const isCurrentlyOpen = menu.classList.contains('open');
        cls(menu, { 
            'open': !isCurrentlyOpen,
            'hidden': isCurrentlyOpen 
        });
    });
    
    on(state.ui.moreActionsMenu, 'click', () => {
        cls(state.ui.moreActionsMenu, { 'open': false, 'hidden': true });
    });

    on(document, 'click', (e: Event) => {
        if (!state.ui.settingsMenuContent.contains(e.target as Node) && !state.ui.settingsBtn.contains(e.target as Node)) {
            closeSettings();
        }
        if (!state.ui.moreActionsBtn.contains(e.target as Node) && !state.ui.moreActionsMenu.contains(e.target as Node)) {
             cls(state.ui.moreActionsMenu, { 'open': false, 'hidden': true });
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
    setupInstrumentSelector();
    setupLogViewer();
}