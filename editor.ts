
import { state } from './state';
import * as InstrumentConfig from './config';
import { updateAndRenderTablature } from './practice';
import { drawDynamicLayer, getNeckGeometry, getPlayheadPx } from './renderer';
import { cls, on, $$ } from './dom';
import type { NoteId } from './types';

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
    state.pendingEdits = true;
}

export function handleUndo() {
    if (state.historyIndex < 0) return;
    const edit = state.editHistory[state.historyIndex];
    const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
    switch (edit.type) {
        case 'finger':
            note.finger = edit.oldValue;
            break;
        case 'position':
            note.string = edit.oldValue.string;
            note.fret = edit.oldValue.fret;
            break;
        case 'pitch':
            note.pitch = edit.oldValue.pitch;
            note.fret = edit.oldValue.fret;
            break;
    }
    state.historyIndex--;
    state.pendingEdits = true;
    updateAndRenderTablature();
    updateUndoRedoButtons();
    if (state.selectedNoteIndex && state.selectedNoteIndex.eventIndex === edit.noteId.eventIndex && state.selectedNoteIndex.noteIndex === edit.noteId.noteIndex) {
        openNoteEditor(state.selectedNoteIndex);
    }
}

export function handleRedo() {
    if (state.historyIndex >= state.editHistory.length - 1) return;
    state.historyIndex++;
    const edit = state.editHistory[state.historyIndex];
    const note = state.editedTablature[edit.noteId.eventIndex].notes[edit.noteId.noteIndex];
    switch (edit.type) {
        case 'finger':
            note.finger = edit.newValue;
            break;
        case 'position':
            note.string = edit.newValue.string;
            note.fret = edit.newValue.fret;
            break;
        case 'pitch':
            note.pitch = edit.newValue.pitch;
            note.fret = edit.newValue.fret;
            break;
    }
    state.pendingEdits = true;
    updateAndRenderTablature();
    updateUndoRedoButtons();
    if (state.selectedNoteIndex && state.selectedNoteIndex.eventIndex === edit.noteId.eventIndex && state.selectedNoteIndex.noteIndex === edit.noteId.noteIndex) {
        openNoteEditor(state.selectedNoteIndex);
    }
}

export function openNoteEditor(noteId: NoteId) {
    if (!noteId || !state.currentSongData) return;
    const { eventIndex, noteIndex } = noteId;
    const note = state.editedTablature[eventIndex]?.notes[noteIndex];
    if (!note) return;
    state.selectedNoteIndex = noteId;
    state.ui.editorFretValue.textContent = String(note.fret);
    $$<HTMLButtonElement>('.finger-btn', state.ui.editorFingerButtons).forEach(btn => {
        cls(btn, { 'active': parseInt(btn.dataset.finger!) === note.finger });
    });
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / InstrumentConfig.getInstrument(state.currentInstrument).numStrings;
    const noteX = getPlayheadPx() + (note.startTime * state.currentSongData.pixelsPerSecond) - state.currentScrollX;
    const noteY = neckTopY + (note.string * stringHeight) + (stringHeight / 2);
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
    const tabData = state.isEditMode ? state.editedTablature : state.currentSongData.tablature;
    for (let i = tabData.length - 1; i >= 0; i--) {
        const tabEvent = tabData[i];
        for (let j = 0; j < tabEvent.notes.length; j++) {
            const note = tabEvent.notes[j];
            const noteLeft = getPlayheadPx() + (note.startTime * state.currentSongData.pixelsPerSecond) - state.currentScrollX;
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
