import { state } from './state';
import { cacheUiElements, showScreen } from './ui';
import { setupCanvas } from './renderer';
import { loadGlobalSettings, loadLibraryFromLocalStorage } from './library';
import { setupAllListeners } from './listeners';

/**
 * The main initialization function for the application.
 * Caches DOM elements and sets up initial state and listeners.
 * @public
 */
function init() {
    // The MIDI parser is now loaded on-demand in a Web Worker,
    // so we no longer need to wait for it on initial app load.
    cacheUiElements();
    setupCanvas();
    loadGlobalSettings();
    loadLibraryFromLocalStorage();
    setupAllListeners();
    showScreen(state.ui.library);
}

// --- Application Entry Point ---
document.addEventListener('DOMContentLoaded', init);