
import { state } from './state';
import { stopAnimation } from './game';
import { stopPitchDetection, initAudio } from './audio';
import { closeNoteEditor } from './editor';
import { handleResize } from './renderer';
import { $, cls } from './dom';

export function cacheUiElements() {
    state.ui = {
        loadingScreen: $('#loading-screen')!,
        library: $('#song-library-screen')!,
        practice: $('#practice-screen')!,
        tuner: $('#tuner-screen')!,
        summary: $('#summary-screen')!,
        songList: $('#song-list')!,
        addBtn: $('#add-song-btn')!,
        tunerNavBtn: $('#tuner-nav-btn')!,
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
        minimapCanvas: $('#minimap-canvas')!,
        libraryTitle: $('#library-title')!,
        selectGuitarBtn: $('#select-guitar-btn')!,
        selectUkuleleBtn: $('#select-ukulele-btn')!,
        editButtonsContainer: $('#edit-buttons-container')!,
        noteEditorPopup: $('#note-editor-popup')!,
        editorCloseBtn: $('#editor-close-btn')!,
        editorFretDown: $('#editor-fret-down')!,
        editorFretUp: $('#editor-fret-up')!,
        editorFretValue: $('#editor-fret-value')!,
        editorFingerButtons: $('#editor-finger-buttons')!,
    };
}

export const showScreen = (screenToShow: HTMLElement) => {
    [state.ui.loadingScreen, state.ui.library, state.ui.practice, state.ui.summary, state.ui.tuner].forEach(el => {
        if (el) cls(el, { 'hidden': !el.isEqualNode(screenToShow) });
    });
};

export const showLibrary = () => {
    stopAnimation();
    stopPitchDetection();
    closeNoteEditor();
    showScreen(state.ui.library);
};

export const showPracticeScreen = async () => {
    await initAudio(true);
    state.isTunerActive = false;
    showScreen(state.ui.practice);
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