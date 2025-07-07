import { state } from './state';
import { stopAnimation } from './game';
import { stopPitchDetection, initAudio } from './audio';
import { closeNoteEditor } from './editor';
import { handleResize } from './renderer';
import { $, cls, on, $$ } from './dom';
import { Logger } from './logger';
import type { InstrumentID } from './types';
import { renderSongLibrary } from './library-ui';

export function cacheUiElements() {
    state.ui = {
        loadingScreen: $('#loading-screen')!,
        library: $('#song-library-screen')!,
        practice: $('#practice-screen')!,
        tuner: $('#tuner-screen')!,
        summary: $('#summary-screen')!,
        songList: $('#song-list')!,
        addBtn: $('#add-song-btn')!,
        libraryTunerBtn: $('#library-tuner-btn')!,
        practiceTunerBtn: $('#practice-tuner-btn')!,
        fullscreenBtn: $('#fullscreen-btn')!,
        exportLibraryBtn: $('#export-library-btn')!,
        importLibraryInput: $('#import-library-input')!,
        midiFileInput: $('#midi-file-input')!,
        practiceBackBtn: $('#practice-back-btn')!,
        tunerBackBtn: $('#tuner-back-btn')!,
        settingsBtn: $('#settings-btn')!,
        settingsMenu: $('#settings-menu')!,
        settingsMenuContent: $('#settings-menu-content')!,
        settingsBackdrop: $('#settings-backdrop')!,
        tempoSlider: $('#tempo-slider')!,
        tempoValue: $('#tempo-value')!,
        noteSizeSlider: $('#note-size-slider')!,
        noteSizeValue: $('#note-size-value')!,
        stringSpacingSlider: $('#string-spacing-slider')!,
        stringSpacingValue: $('#string-spacing-value')!,
        stringThicknessSlider: $('#string-thickness-slider')!,
        stringThicknessValue: $('#string-thickness-value')!,
        zoomSlider: $('#zoom-slider')!,
        zoomValue: $('#zoom-value')!,
        tabDisplay: $('#tab-display')!,
        staticCanvas: $('#static-canvas')!,
        dynamicCanvas: $('#practice-canvas')!,
        playPauseBtn: $('#play-pause-btn')!,
        rewindBtn: $('#rewind-btn')!,
        editModeBtn: $('#edit-mode-btn')!,
        editModeActions: $('#edit-mode-actions')!,
        saveBtn: $('#save-btn')!,
        doneEditingBtn: $('#done-editing-btn')!,
        undoBtn: $('#undo-btn')!,
        redoBtn: $('#redo-btn')!,
        playIcon: $('#play-icon')!,
        pauseIcon: $('#pause-icon')!,
        pitchDisplay: $('#pitch-display')!,
        feedbackDisplay: $('#feedback-display')!,
        targetNoteDisplay: $('#target-note-display')!,
        practiceMicMsg: $('#practice-mic-msg')!,
        tunerMicMsg: $('#tuner-mic-msg')!,
        tunerNoteName: $('#tuner-note-name')!,
        tunerNeedle: $('#tuner-needle')!,
        tunerStatus: $('#tuner-status')!,
        tunerFreq: $('#tuner-freq')!,
        tunerCircle: $('#tuner-circle')!,
        scoreDisplay: $('#current-score-display')!,
        streakDisplay: $('#streak-display')!,
        summaryScore: $('#summary-score')!,
        summaryAccuracy: $('#summary-accuracy')!,
        summaryBackBtn: $('#summary-back-btn')!,
        transposeDownBtn: $('#transpose-down-btn')!,
        transposeUpBtn: $('#transpose-up-btn')!,
        transposeValue: $('#transpose-value')!,
        stringShiftDownBtn: $('#string-shift-down-btn')!,
        stringShiftUpBtn: $('#string-shift-up-btn')!,
        stringShiftValue: $('#string-shift-value')!,
        minimapCanvas: $('#minimap-canvas')!,
        libraryTitle: $('#library-title')!,
        instrumentNameDisplay: $('#instrument-name-display')!,
        selectGuitarBtn: $('#select-guitar-btn')!,
        selectUkuleleBtn: $('#select-ukulele-btn')!,
        librarySearchInput: $('#library-search-input')!,
        moreActionsBtn: $('#more-actions-btn')!,
        moreActionsMenu: $('#more-actions-menu')!,
        editButtonsContainer: $('#edit-buttons-container')!,
        noteEditorPopup: $('#note-editor-popup')!,
        editorCloseBtn: $('#editor-close-btn')!,
        editorFretDown: $('#editor-fret-down')!,
        editorFretUp: $('#editor-fret-up')!,
        editorFretValue: $('#editor-fret-value')!,
        editorFingerButtons: $('#editor-finger-buttons')!,
        editorDeleteBtn: $('#editor-delete-btn')!,
        logViewerBtn: $('#log-viewer-btn')!,
        logViewer: $('#log-viewer')!,
        logViewerBackdrop: $('#log-viewer-backdrop')!,
        logViewerContent: $('#log-viewer-content')!,
        clearLogsBtn: $('#clear-logs-btn')!,
        closeLogsBtn: $('#close-logs-btn')!,
        instrumentSelector: $('#instrument-selector')!,
        confirmDialogBackdrop: $('#confirm-dialog-backdrop')!,
        confirmDialog: $('#confirm-dialog')!,
        confirmDialogTitle: $('#confirm-dialog-title')!,
        confirmDialogMessage: $('#confirm-dialog-message')!,
        confirmDialogButtons: $('#confirm-dialog-buttons')!,
        practiceModeLabel: $('#practice-mode-label')!,
        performanceModeLabel: $('#performance-mode-label')!,
        editModeLabel: $('#edit-mode-label')!,
        practiceInfoContainer: $('#practice-info-container')!,
        modeSwitcher: $('#mode-switcher')!,
        selectPracticeBtn: $('#select-practice-btn')!,
        selectPerformanceBtn: $('#select-performance-btn')!,
    };
}

export const showScreen = (screenToShow: HTMLElement) => {
    [state.ui.loadingScreen, state.ui.library, state.ui.practice, state.ui.summary, state.ui.tuner].forEach(el => {
        if (el) cls(el, { 'hidden': !el.isEqualNode(screenToShow) });
    });
    Logger.info(`Showing screen: ${screenToShow.id}`, 'UI');
};

export function updateModeUI() {
    const isPractice = state.currentMode === 'practice';
    const isPerformance = state.currentMode === 'performance';
    const isEdit = state.isEditMode;

    // Labels
    cls(state.ui.practiceModeLabel, { 'hidden': !isPractice || isEdit, 'flex': isPractice && !isEdit });
    cls(state.ui.performanceModeLabel, { 'hidden': !isPerformance || isEdit, 'flex': isPerformance && !isEdit });
    cls(state.ui.editModeLabel, { 'hidden': !isEdit, 'flex': isEdit });

    // Score vs Edit Buttons
    cls(state.ui.practiceInfoContainer, { 'hidden': isEdit });
    cls(state.ui.editButtonsContainer, { 'hidden': !isEdit });

    // Mode Switcher Controls
    cls(state.ui.modeSwitcher, { 'hidden': isEdit, 'flex': !isEdit });
    cls(state.ui.selectPracticeBtn, { 'active': isPractice });
    cls(state.ui.selectPerformanceBtn, { 'active': isPerformance });

    // Disable controls in Performance or Edit mode
    const areControlsDisabled = isPerformance || isEdit;
    $$<HTMLButtonElement>('.local-setting-control').forEach(el => {
        el.disabled = areControlsDisabled;
    });
    (state.ui.settingsBtn as HTMLButtonElement).disabled = areControlsDisabled;
    (state.ui.practiceTunerBtn as HTMLButtonElement).disabled = isEdit;
}

export const showLibrary = () => {
    stopAnimation();
    stopPitchDetection();
    closeNoteEditor();
    renderSongLibrary();
    showScreen(state.ui.library);
};

export const showPracticeScreen = async () => {
    await initAudio(true);
    state.isTunerActive = false;
    showScreen(state.ui.practice);
    updateModeUI();
    handleResize();
};

export const showTunerScreen = async () => {
    await initAudio(true);
    state.isTunerActive = true;
    closeNoteEditor();
    showScreen(state.ui.tuner);
};

export const showSummaryScreen = () => {
    stopAnimation();
    stopPitchDetection();
    closeNoteEditor();
    showScreen(state.ui.summary);
};

export function openLogViewer() {
    cls(state.ui.logViewer, { 'hidden': false });
    cls(state.ui.logViewerBackdrop, { 'hidden': false });
    // Use timeout to allow the element to be visible before starting transition
    setTimeout(() => {
        cls(state.ui.logViewer, { 'open': true });
        cls(state.ui.logViewerBackdrop, { 'open': true });
    }, 10);
}

export function closeLogViewer() {
    cls(state.ui.logViewer, { 'open': false });
    cls(state.ui.logViewerBackdrop, { 'open': false });
    setTimeout(() => {
        cls(state.ui.logViewer, { 'hidden': true });
        cls(state.ui.logViewerBackdrop, { 'hidden': true });
    }, 300);
}

export function saveCurrentInstrument() {
    localStorage.setItem('fretflow_instrument', state.currentInstrument);
}

export function loadGlobalSettings() {
    const savedInstrument = localStorage.getItem('fretflow_instrument');
    if (savedInstrument && ['guitar', 'ukulele'].includes(savedInstrument)) {
        state.currentInstrument = savedInstrument as InstrumentID;
    }

    const savedSettings = localStorage.getItem('fretflow_global_settings');
    if (savedSettings) {
        const parsedSettings = JSON.parse(savedSettings);
        // Merge saved settings with defaults to avoid breaking changes
        state.globalSettings = { ...state.globalSettings, ...parsedSettings };
    }
    
    Logger.info('Loaded global settings', 'Settings', { instrument: state.currentInstrument, settings: state.globalSettings });

    (state.ui.noteSizeSlider as HTMLInputElement).value = String(state.globalSettings.noteSize);
    state.ui.noteSizeValue.textContent = `${Math.round(state.globalSettings.noteSize * 100)}%`;
    (state.ui.stringSpacingSlider as HTMLInputElement).value = String(state.globalSettings.stringSpacing);
    state.ui.stringSpacingValue.textContent = `${Math.round(state.globalSettings.stringSpacing * 100)}%`;
    (state.ui.stringThicknessSlider as HTMLInputElement).value = String(state.globalSettings.stringThickness);
    state.ui.stringThicknessValue.textContent = `${Math.round(state.globalSettings.stringThickness * 100)}%`;
    (state.ui.instrumentSelector as HTMLSelectElement).value = String(state.globalSettings.selectedInstrument);
}

export function saveGlobalSettings() {
    Logger.info('Saving global settings', 'Settings', state.globalSettings);
    localStorage.setItem('fretflow_global_settings', JSON.stringify(state.globalSettings));
}

export function showConfirmation(title: string, message: string, buttons: { text: string; classes: string; onClick: () => void }[]) {
    state.ui.confirmDialogTitle.textContent = title;
    state.ui.confirmDialogMessage.textContent = message;
    
    const buttonElements = buttons.map(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.text;
        button.className = btnInfo.classes;
        on(button, 'click', () => {
            hideConfirmation();
            btnInfo.onClick();
        });
        return button;
    });

    state.ui.confirmDialogButtons.replaceChildren(...buttonElements);
    
    cls(state.ui.confirmDialogBackdrop, { 'hidden': false });
    setTimeout(() => {
        cls(state.ui.confirmDialogBackdrop, { 'open': true });
        cls(state.ui.confirmDialog, { 'open': true });
    }, 10);
}

export function hideConfirmation() {
    cls(state.ui.confirmDialogBackdrop, { 'open': false });
    cls(state.ui.confirmDialog, { 'open': false });
    setTimeout(() => {
        cls(state.ui.confirmDialogBackdrop, { 'hidden': true });
    }, 200);
}