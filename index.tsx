
import { state } from './state';
import { cacheUiElements, showScreen, loadGlobalSettings } from './ui';
import { setupCanvas } from './renderer';
import { loadLibrary } from './library';
import { setupAllListeners } from './listeners';
import { Logger } from './logger';

/**
 * The main initialization function for the application.
 * Caches DOM elements and sets up initial state and listeners.
 * @public
 */
function init() {
    // The MIDI parser is now loaded on-demand in a Web Worker,
    // so we no longer need to wait for it on initial app load.
    Logger.info('Application initializing...', 'Init');
    cacheUiElements();
    setupCanvas();
    loadGlobalSettings();
    loadLibrary();
    setupAllListeners();
    showScreen(state.ui.library);
}

// --- Application Entry Point ---
// Use 'load' to ensure all external scripts (like libfluidsynth) are ready.
window.addEventListener('load', init);