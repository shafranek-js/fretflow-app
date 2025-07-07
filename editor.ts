import { state } from './state';
import * as InstrumentConfig from './config';
import { updateAndRenderTablature } from './practice';
import { drawDynamicLayer, getNeckGeometry, getPlayheadPx } from './renderer';
import { cls, on, $$ } from './dom';
import type { NoteId } from './types';
import { Logger } from './logger';
import { FINGER_COLORS } from './config';

function updateUndoRedoButtons() {
    (state.ui.undoBtn as HTMLButtonElement).disabled = state.historyIndex < 0;
    (state.ui.redoBtn as HTMLButtonElement).disabled = state.historyIndex >= state.editHistory.length - 1;
}

export function addEditHistory(edit: any) {
    if (state.historyIndex < state.editHistory.length - 1) {
        state.editHistory = state.editHistory.slice(0, state.historyIndex + 1);
    }
    state.editHistory.push(edit);
    state.historyIndex++;
    updateUndoRedoButtons();
    
    if (!state.pendingEdits) {
        state.pendingEdits = true;
        (state.ui.saveBtn as HTMLButtonElement).disabled = false;
        state.ui.doneEditingBtn.textContent = 'Done';
        cls(state.ui.doneEditingBtn, { 
            'bg-green-600': true, 'hover:bg-green-700': true, 
            'bg-gray-600': false, 'hover:bg-gray-700': false 
        });
    }
    Logger.info('Added edit to history', 'Editor', edit);
}

export function handleNoteDelete() {
    if (!state.selectedNoteIndex) return;

    const { eventIndex, noteIndex } = state.selectedNoteIndex;
    const event = state.editedTablature[eventIndex];
    if (!event) return;

    const noteToDelete = event.notes[noteIndex];
    const wasLastNoteInEvent = event.notes.length === 1;

    // Add to history BEFORE modifying state
    addEditHistory({
        type: 'delete',
        eventIndex,
        noteIndex,
        deletedNote: JSON.parse(JSON.stringify(noteToDelete)),
        wasLastNoteInEvent,
    });

    // Remove the note
    event.notes.splice(noteIndex, 1);
    
    // If the event is now empty, remove the whole event.
    // This has implications for other history items with now-invalid indices,
    // but is necessary for correct playback and rendering logic.
    if (wasLastNoteInEvent) {
        state.editedTablature.splice(eventIndex, 1);
    } else {
        // Otherwise, just update its chord status
        event.isChord = event.notes.length > 1;
    }

    Logger.info('Deleted note', 'Editor', { noteId: state.selectedNoteIndex });
    closeNoteEditor();
    updateAndRenderTablature();
}

export function handleUndo() {
    if (state.historyIndex < 0) return;
    const edit = state.editHistory[state.historyIndex];
    Logger.info('Performing undo', 'Editor', edit);

    switch (edit.type) {
        case 'delete': {
            const { eventIndex, noteIndex, deletedNote, wasLastNoteInEvent } = edit;
            if (wasLastNoteInEvent) {
                // If the whole event was removed, re-create and insert it.
                const restoredEvent = { notes: [deletedNote], isChord: false };
                state.editedTablature.splice(eventIndex, 0, restoredEvent);
            } else {
                // Otherwise, add the note back to its event.
                const event = state.editedTablature[eventIndex];
                event.notes.splice(noteIndex, 0, deletedNote);
                event.isChord = event.notes.length > 1;
            }
            break;
        }
        case 'finger': {
            const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
            note.finger = edit.oldValue;
            break;
        }
        case 'position': {
            const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
            note.string = edit.oldValue.string;
            note.fret = edit.oldValue.fret;
            break;
        }
        case 'pitch': {
            const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
            note.pitch = edit.oldValue.pitch;
            note.fret = edit.oldValue.fret;
            break;
        }
    }

    state.historyIndex--;
    updateAndRenderTablature();
    updateUndoRedoButtons();

    // If we've undone all the way back to the last saved state
    if (state.historyIndex < 0 && state.pendingEdits) {
        state.pendingEdits = false;
        (state.ui.saveBtn as HTMLButtonElement).disabled = true;
        state.ui.doneEditingBtn.textContent = 'Exit';
        cls(state.ui.doneEditingBtn, { 
            'bg-green-600': false, 'hover:bg-green-700': false, 
            'bg-gray-600': true, 'hover:bg-gray-700': true 
        });
    }

    if (state.selectedNoteIndex && edit.type !== 'delete') {
        if (state.selectedNoteIndex.eventIndex === edit.noteId.eventIndex && state.selectedNoteIndex.noteIndex === edit.noteId.noteIndex) {
            openNoteEditor(state.selectedNoteIndex);
        }
    }
}

export function handleRedo() {
    if (state.historyIndex >= state.editHistory.length - 1) return;
    state.historyIndex++;
    const edit = state.editHistory[state.historyIndex];
    Logger.info('Performing redo', 'Editor', edit);

    switch (edit.type) {
        case 'delete': {
            const { eventIndex, noteIndex, wasLastNoteInEvent } = edit;
            const event = state.editedTablature[eventIndex];
            event.notes.splice(noteIndex, 1);
            if (wasLastNoteInEvent) {
                state.editedTablature.splice(eventIndex, 1);
            } else {
                event.isChord = event.notes.length > 1;
            }
            break;
        }
        case 'finger': {
            const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
            note.finger = edit.newValue;
            break;
        }
        case 'position': {
            const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
            note.string = edit.newValue.string;
            note.fret = edit.newValue.fret;
            break;
        }
        case 'pitch': {
            const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
            note.pitch = edit.newValue.pitch;
            note.fret = edit.newValue.fret;
            break;
        }
    }

    updateAndRenderTablature();
    updateUndoRedoButtons();
    
    if (!state.pendingEdits) {
        state.pendingEdits = true;
        (state.ui.saveBtn as HTMLButtonElement).disabled = false;
        state.ui.doneEditingBtn.textContent = 'Done';
        cls(state.ui.doneEditingBtn, { 
            'bg-green-600': true, 'hover:bg-green-700': true, 
            'bg-gray-600': false, 'hover:bg-gray-700': false 
        });
    }

    if (state.selectedNoteIndex && edit.type !== 'delete') {
        if (state.selectedNoteIndex.eventIndex === edit.noteId.eventIndex && state.selectedNoteIndex.noteIndex === edit.noteId.noteIndex) {
            openNoteEditor(state.selectedNoteIndex);
        }
    }
}

export function openNoteEditor(noteId: NoteId) {
    if (!noteId || !state.currentSongData) return;
    const { eventIndex, noteIndex } = noteId;
    
    // Data for the editor comes from the editable source of truth
    const note = state.editedTablature[eventIndex]?.notes[noteIndex];
    if (!note) return;

    // Position for the editor comes from the *rendered* note on screen
    const renderedNote = state.currentSongData.tablature[eventIndex]?.notes[noteIndex];
    if (!renderedNote) return;

    Logger.info('Opening note editor', 'Editor', { noteId });
    state.selectedNoteIndex = noteId;
    state.ui.editorFretValue.textContent = String(note.fret);
    $$<HTMLButtonElement>('.finger-btn', state.ui.editorFingerButtons).forEach(btn => {
        const finger = parseInt(btn.dataset.finger!);
        const isActive = finger === note.finger;
        cls(btn, { 'active': isActive });

        // Always set the background color based on the finger's color
        btn.style.backgroundColor = FINGER_COLORS[finger];
        btn.style.color = 'white';
    });
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / InstrumentConfig.getInstrument(state.currentInstrument).numStrings;
    
    // Use the rendered note's properties for positioning
    const noteX = getPlayheadPx() + (renderedNote.startTime * state.currentSongData.pixelsPerSecond) - state.currentScrollX;
    const noteY = neckTopY + (renderedNote.string * stringHeight) + (stringHeight / 2);
    
    const popup = state.ui.noteEditorPopup;
    popup.style.left = `${noteX + 35}px`;
    popup.style.top = `${noteY - popup.offsetHeight / 2}px`;
    cls(popup, { 'hidden': false });
    setTimeout(() => {
        cls(popup, { 'opacity-0': false, 'pointer-events-none': false });
    }, 10);
    drawDynamicLayer();
}

export function closeNoteEditor() {
    if (!state.selectedNoteIndex) return;
    Logger.info('Closing note editor', 'Editor');
    state.selectedNoteIndex = null;
    cls(state.ui.noteEditorPopup, { 'opacity-0': true, 'pointer-events-none': true });
    setTimeout(() => cls(state.ui.noteEditorPopup, { 'hidden': true }), 150);
    drawDynamicLayer();
}

export function getNoteIdAt(clientX: number, clientY: number): NoteId | null {
    if (!state.currentSongData?.tablature) return null;
    const rect = state.ui.dynamicCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / config.numStrings;

    // ALWAYS use the currently rendered tablature for hit detection, as its
    // string/fret values match what's on screen. The indices will still
    // correctly map to state.editedTablature.
    const tabData = state.currentSongData.tablature;

    for (let i = tabData.length - 1; i >= 0; i--) {
        const tabEvent = tabData[i];
        for (let j = 0; j < tabEvent.notes.length; j++) {
            const note = tabEvent.notes[j];
            const noteLeft = getPlayheadPx() + (note.startTime * state.currentSongData.pixelsPerSecond) - state.currentScrollX;
            
            // Use the rendered note's string position for an accurate Y coordinate
            const noteY = neckTopY + (note.string * stringHeight) + (stringHeight / 2);

            const noteHeight = 72 * state.globalSettings.noteSize;
            const baseWidth = noteHeight;
            const extraWidth = (note.duration - state.currentSongData.minDuration) * state.currentSongData.pixelsPerSecond;
            const visualWidth = baseWidth + Math.max(0, extraWidth);
            if (x >= noteLeft && x <= noteLeft + visualWidth && y >= noteY - noteHeight / 2 && y <= noteY + noteHeight / 2) {
                return { eventIndex: i, noteIndex: j };
            }
        }
    }
    return null;
}