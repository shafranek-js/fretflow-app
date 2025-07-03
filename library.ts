
import { state } from './state';
import * as InstrumentConfig from './config';
import { Logger } from './logger';
import { loadSongToPractice } from './practice';
import type { Song, InstrumentID } from './types';

// --- START OF INLINED WORKER SCRIPT ---
// This script is bundled into a string and loaded as a Blob to bypass CORS issues in sandboxed environments.
const worker_script = `
// --- Inlined from logger.ts ---
const isDev = true;
const Logger = {
    log(e, ctx = 'General') {
        if (isDev) {
            console.error('[Worker-' + ctx + ']', e);
        }
    }
};

// --- Inlined parts of config.ts ---
const INSTRUMENT_CONFIG = {
    guitar: {
        name: "Guitar",
        numStrings: 6,
        numFrets: 22,
        tuning: [64, 59, 55, 50, 45, 40],
        stringGauges: [4.0, 5.0, 6.0, 7.0, 8.0, 9.0],
        woundStringIndices: [3, 4, 5],
    },
    ukulele: {
        name: "Ukulele",
        numStrings: 4,
        numFrets: 15,
        tuning: [69, 64, 60, 67],
        stringGauges: [4.0, 5.2, 6.4, 4.4],
        woundStringIndices: [],
    },
};
const getInstrument = (id) => INSTRUMENT_CONFIG[id];

// --- Inlined from tablature.ts ---
function findPossiblePositions(midiNote, instrumentId, usedStrings = new Set()) {
    const positions = [];
    const instrumentConfig = getInstrument(instrumentId);
    instrumentConfig.tuning.forEach((openStringMidi, stringIndex) => {
        if (usedStrings.has(stringIndex)) return;
        const fret = midiNote - openStringMidi;
        if (fret >= 0 && fret <= instrumentConfig.numFrets) {
            positions.push({ string: stringIndex, fret: fret });
        }
    });
    return positions;
}

function calculateCost(previousFingering, nextFingering) {
    let cost = 0;
    const frets = nextFingering.map(n => n.fret).filter(f => f > 0);
    const HIGH_FRET_THRESHOLD = 12;
    const HIGH_FRET_PENALTY_FACTOR = 0.3;
    if (frets.length > 0) {
        frets.forEach(fret => {
            if (fret > HIGH_FRET_THRESHOLD) {
                cost += Math.pow(fret - HIGH_FRET_THRESHOLD, 2) * HIGH_FRET_PENALTY_FACTOR;
            }
        });
    }
    if (frets.length > 1) {
        cost += Math.pow(Math.max(...frets) - Math.min(...frets), 2) * 0.5;
    }
    if (nextFingering.some(n => n.fret === 0)) {
        cost -= 2.0;
    }
    if (previousFingering && previousFingering.length > 0) {
        const prevFrets = previousFingering.map(n => n.fret).filter(f => f > 0);
        if (frets.length > 0 && prevFrets.length > 0) {
            const avgNextFret = frets.reduce((s, f) => s + f, 0) / frets.length;
            const avgPrevFret = prevFrets.reduce((s, f) => s + f, 0) / prevFrets.length;
            cost += Math.abs(avgNextFret - avgPrevFret) * 1.5;
        }
        const avgNextString = nextFingering.reduce((s, n) => s + n.string, 0) / nextFingering.length;
        const avgPrevString = previousFingering.reduce((s, n) => s + n.string, 0) / previousFingering.length;
        cost += Math.abs(avgNextString - avgPrevString) * 0.2;
    }
    if (frets.length > 0) {
        cost += frets.reduce((s, f) => s + f, 0) / frets.length * 0.1;
    }
    return cost;
}

function generateTablature(noteEvents, instrumentId) {
    if (!noteEvents || noteEvents.length === 0) return [];
    const instrumentConfig = getInstrument(instrumentId);
    const trellis = [];
    const filteredNoteEvents = [];
    for (const event of noteEvents) {
        const notesWithPossiblePositions = event.notes.map(note => ({ note, positions: findPossiblePositions(note.pitch, instrumentId) })).filter(item => item.positions.length > 0);
        if (notesWithPossiblePositions.length === 0) continue;
        if (notesWithPossiblePositions.length > instrumentConfig.numStrings) continue;
        const playableNotes = notesWithPossiblePositions.map(item => item.note);
        const notePositions = notesWithPossiblePositions.map(item => item.positions);
        const allChordFingerings = [];
        function findCombinations(noteIndex, currentFingering, usedStrings) {
            if (noteIndex === playableNotes.length) {
                allChordFingerings.push(currentFingering);
                return;
            }
            if (!notePositions[noteIndex] || notePositions[noteIndex].length === 0) return;
            for (const pos of notePositions[noteIndex]) {
                if (!usedStrings.has(pos.string)) {
                    const newNote = { ...playableNotes[noteIndex], ...pos, finger: 0 };
                    findCombinations(noteIndex + 1, [...currentFingering, newNote], new Set(usedStrings).add(pos.string));
                }
            }
        }
        findCombinations(0, [], new Set());
        if (allChordFingerings.length > 0) {
            trellis.push(allChordFingerings);
            filteredNoteEvents.push({ notes: playableNotes, isChord: playableNotes.length > 1 });
        }
    }
    if (trellis.length === 0) return [];
    const costs = [trellis[0].map(fingering => calculateCost(null, fingering))];
    const backpointers = [new Array(trellis[0].length).fill(0)];
    for (let t = 1; t < trellis.length; t++) {
        const currentCosts = [];
        const currentBackpointers = [];
        for (let i = 0; i < trellis[t].length; i++) {
            let minCost = Infinity, bestPrevNode = -1;
            const currentFingering = trellis[t][i];
            for (let j = 0; j < trellis[t - 1].length; j++) {
                const totalCost = costs[t - 1][j] + calculateCost(trellis[t - 1][j], currentFingering);
                if (totalCost < minCost) { minCost = totalCost; bestPrevNode = j; }
            }
            currentCosts.push(minCost);
            currentBackpointers.push(bestPrevNode);
        }
        costs.push(currentCosts);
        backpointers.push(currentBackpointers);
    }
    const optimalPathIndices = [];
    let lastLayerIndex = -1, minFinalCost = Infinity;
    const lastCosts = costs[costs.length - 1];
    for (let i = 0; i < lastCosts.length; i++) {
        if (lastCosts[i] < minFinalCost) { minFinalCost = lastCosts[i]; lastLayerIndex = i; }
    }
    if (lastLayerIndex === -1) return [];
    optimalPathIndices.push(lastLayerIndex);
    let currentBestNodeIndex = lastLayerIndex;
    for (let t = trellis.length - 2; t >= 0; t--) {
        const prevNodeIndex = backpointers[t + 1][currentBestNodeIndex];
        optimalPathIndices.unshift(prevNodeIndex);
        currentBestNodeIndex = prevNodeIndex;
    }
    return optimalPathIndices.map((nodeIndex, t) => {
        const fingering = trellis[t][nodeIndex];
        fingering.sort((a, b) => a.string - b.string);
        return { notes: fingering, isChord: fingering.length > 1 };
    });
}

function assignFingering(tablature) {
    let handPosition = 1;
    return tablature.map(tabEvent => {
        const newNotes = tabEvent.notes.map(note => {
            if (note.finger !== undefined && note.finger !== null && note.finger !== 0) {
                if (note.fret > 0) handPosition = note.fret - note.finger + 1;
                return note;
            }
            if (note.fret === 0) return { ...note, finger: 0 };
            if (Math.abs(note.fret - handPosition) > 4 && note.fret > 0) {
                handPosition = note.fret <= 4 ? 1 : note.fret - 1;
            }
            let finger = note.fret - handPosition + 1;
            finger = Math.max(1, Math.min(4, finger));
            return { ...note, finger };
        });
        return { ...tabEvent, notes: newNotes };
    });
}

// --- Worker's main logic ---
importScripts('https://cdn.jsdelivr.net/npm/midi-parser-js');

function parseMidiFile(file) {
    return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const base64 = e.target.result.split(',')[1];
                const midi = MidiParser.parse(base64);
                const ticksPerBeat = midi.timeDivision;
                let tempo = 500000;
                let timeSignature = { numerator: 4, denominator: 4 };
                for (const event of midi.track[0].event) {
                    if (event.metaType === 81) tempo = event.data;
                    if (event.metaType === 88) timeSignature = { numerator: event.data[0], denominator: Math.pow(2, event.data[1]) };
                }
                const secondsPerTick = (tempo / ticksPerBeat) / 1000000;
                const rawNotes = [];
                for (const track of midi.track) {
                    const openNotes = {};
                    let currentTime = 0;
                    for (const event of track.event) {
                        currentTime += event.deltaTime;
                        if (event.type === 9 && event.data[1] > 0) {
                            openNotes[event.data[0]] = currentTime;
                        } else if (event.type === 8 || (event.type === 9 && event.data[1] === 0)) {
                            const pitch = event.data[0];
                            const startTimeTicks = openNotes[pitch];
                            if (startTimeTicks !== undefined) {
                                const durationTicks = currentTime - startTimeTicks;
                                rawNotes.push({ pitch: pitch, startTime: startTimeTicks * secondsPerTick, duration: durationTicks * secondsPerTick });
                                delete openNotes[pitch];
                            }
                        }
                    }
                }
                rawNotes.sort((a, b) => a.startTime - b.startTime);
                const noteEvents = [];
                let i = 0;
                while (i < rawNotes.length) {
                    const chordNotes = [rawNotes[i]];
                    let j = i + 1;
                    while (j < rawNotes.length && Math.abs(rawNotes[j].startTime - rawNotes[i].startTime) < 0.01) {
                        chordNotes.push(rawNotes[j++]);
                    }
                    noteEvents.push({ notes: chordNotes, isChord: chordNotes.length > 1 });
                    i = j;
                }
                res({ notes: noteEvents, tempo, timeSignature });
            } catch (err) { rej(new Error("Could not read MIDI file.")); }
        };
        reader.onerror = (err) => rej(err);
        reader.readAsDataURL(file);
    });
}

onmessage = async (event) => {
    const { file, instrumentId } = event.data;
    const title = file.name.replace(/\\.(mid|midi)$/i, '').replace(/_/g, ' ');
    try {
        const songData = await parseMidiFile(file);
        if (songData.notes.length === 0) {
            postMessage({ status: 'skipped', title });
            return;
        }
        let tabWithPositions = generateTablature(songData.notes, instrumentId);
        if (tabWithPositions.length > 0 && tabWithPositions[0].notes.length > 0) {
            const firstNoteTime = tabWithPositions[0].notes[0].startTime;
            const measureDuration = ((songData.tempo || 500000) / 1000000) * (songData.timeSignature?.numerator || 4);
            if (firstNoteTime < measureDuration) {
                tabWithPositions.forEach(ev => ev.notes.forEach(n => n.startTime += measureDuration));
            }
        }
        const finalTablature = assignFingering(tabWithPositions);
        const newSong = {
            id: crypto.randomUUID(),
            title: title,
            highScore: 0,
            tablature: JSON.stringify(finalTablature),
            midiTempo: songData.tempo,
            midiTimeSignature: JSON.stringify(songData.timeSignature),
            createdAt: new Date().toISOString(),
            playbackTempo: 100,
            transpose: 0,
            zoomLevel: 1.0
        };
        postMessage({ status: 'success', song: newSong, title: newSong.title });
    } catch (error) {
        postMessage({ status: 'error', title, error: error.message });
    }
};
`;
// --- END OF INLINED WORKER SCRIPT ---

const getLocalStorageKey = () => `fretflow_songs_${state.currentInstrument}`;

export function saveCurrentInstrument() {
    localStorage.setItem('fretflow_current_instrument', state.currentInstrument);
}

export function saveGlobalSettings() {
    localStorage.setItem('fretflow_global_settings', JSON.stringify(state.globalSettings));
}

export function loadGlobalSettings() {
    const savedSettings = localStorage.getItem('fretflow_global_settings');
    if (savedSettings) {
        try {
            state.globalSettings = { ...state.globalSettings, ...JSON.parse(savedSettings) };
        } catch (e) {
            Logger.log(e as Error, "LocalStorageParse_GlobalSettings");
        }
    }
    (state.ui.noteSizeSlider as HTMLInputElement).value = String(state.globalSettings.noteSize);
    state.ui.noteSizeValue.textContent = `${Math.round(state.globalSettings.noteSize * 100)}%`;
    (state.ui.stringSpacingSlider as HTMLInputElement).value = String(state.globalSettings.stringSpacing);
    state.ui.stringSpacingValue.textContent = `${Math.round(state.globalSettings.stringSpacing * 100)}%`;
    (state.ui.stringThicknessSlider as HTMLInputElement).value = String(state.globalSettings.stringThickness);
    state.ui.stringThicknessValue.textContent = `${Math.round(state.globalSettings.stringThickness * 100)}%`;
}

export function loadLibraryFromLocalStorage() {
    const savedInstrument = localStorage.getItem('fretflow_current_instrument');
    if (savedInstrument && InstrumentConfig.INSTRUMENT_CONFIG[savedInstrument as InstrumentID]) {
        state.currentInstrument = savedInstrument as InstrumentID;
    }
    const savedSongs = localStorage.getItem(getLocalStorageKey());
    if (savedSongs) {
        try {
            state.songs = JSON.parse(savedSongs);
        } catch (e) {
            Logger.log(e as Error, "LocalStorageParse_Songs");
            state.songs = [];
        }
    } else {
        state.songs = [];
    }
    state.ui.libraryTitle.textContent = `${InstrumentConfig.getInstrument(state.currentInstrument).name} Library`;
    renderSongLibrary();
}

export function saveLibraryToLocalStorage() {
    localStorage.setItem(getLocalStorageKey(), JSON.stringify(state.songs));
}

function createSongItemHTML(song: Song): string {
    return `<div><h2 class="text-xl font-semibold">${song.title}</h2><p class="text-sm text-gray-400">High Score: ${song.highScore || 0}</p></div><button class="delete-song-btn p-2 rounded-full text-gray-500 hover:text-red-500"><svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>`;
}

function createSongItemElement(song: Song): HTMLElement {
    const item = document.createElement('div');
    item.className = 'song-item bg-gray-800 p-4 rounded-lg flex justify-between items-center shadow-md';
    item.setAttribute('data-id', song.id);
    item.innerHTML = createSongItemHTML(song);
    return item;
}

function renderProcessingPlaceholder(title: string, placeholderId: string) {
    const item = document.createElement('div');
    item.id = placeholderId;
    item.className = 'song-item-placeholder bg-gray-800 p-4 rounded-lg flex justify-between items-center shadow-md opacity-50';
    item.innerHTML = `
        <div><h2 class="text-xl font-semibold">${title}</h2><p class="text-sm text-yellow-400">Processing...</p></div>
        <div class="spinner"></div>`;
    state.ui.songList.prepend(item);
}


export async function handleAddSong(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    const blob = new Blob([worker_script], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    const emptyMsg = state.ui.songList.querySelector('p');
    if (emptyMsg) emptyMsg.remove();

    const placeholderMap = new Map<string, string>();
    Array.from(files).forEach(file => {
        const placeholderId = `placeholder-${crypto.randomUUID()}`;
        const title = file.name.replace(/\.(mid|midi)$/i, '').replace(/_/g, ' ');
        placeholderMap.set(title, placeholderId);
        renderProcessingPlaceholder(title, placeholderId);
    });

    worker.onmessage = (event: MessageEvent<{ status: 'success' | 'error' | 'skipped', song?: Song, title: string, error?: string }>) => {
        const { status, song, title, error } = event.data;
        const placeholderId = placeholderMap.get(title);
        if (!placeholderId) return;

        const placeholderEl = document.getElementById(placeholderId);
        if (!placeholderEl) return;

        if (status === 'success' && song) {
            state.songs.push(song);
            state.songs.sort((a, b) => (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1);
            saveLibraryToLocalStorage();
            const newSongEl = createSongItemElement(song);
            placeholderEl.replaceWith(newSongEl);
        } else {
            const errorMessage = error || "Skipped";
            placeholderEl.className = 'song-item-placeholder bg-red-900/50 p-4 rounded-lg flex justify-between items-center shadow-md';
            placeholderEl.innerHTML = `
                <div><h2 class="text-xl font-semibold">${title}</h2><p class="text-sm text-red-400">Failed: ${errorMessage}</p></div>
                <div class="text-red-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>`;
        }
    };

    worker.onerror = (error) => {
        Logger.log(error as any, 'WorkerError');
    };

    for (const file of Array.from(files)) {
        worker.postMessage({ file, instrumentId: state.currentInstrument });
    }

    (e.target as HTMLInputElement).value = '';
}

export function deleteSong(songId: string) {
    state.songs = state.songs.filter(s => s.id !== songId);
    saveLibraryToLocalStorage();
    renderSongLibrary();
}

export function renderSongLibrary() {
    state.ui.songList.innerHTML = '';
    if (state.songs.length === 0) {
        state.ui.songList.innerHTML = `<p class="text-gray-500">Your ${InstrumentConfig.getInstrument(state.currentInstrument).name} library is empty. Click "Add Song" to start!</p>`;
        return;
    }
    const sortedSongs = state.songs.sort((a, b) => (a.createdAt || 0) < (b.createdAt || 0) ? 1 : -1);
    sortedSongs.forEach(song => {
        state.ui.songList.appendChild(createSongItemElement(song));
    });
}

export function handleImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedSongs = JSON.parse(e.target!.result as string);
            if (Array.isArray(importedSongs)) {
                state.songs = importedSongs;
                saveLibraryToLocalStorage();
                renderSongLibrary();
            } else {
                throw new Error("Imported file is not a valid song library.");
            }
        } catch (err) {
            Logger.log(err as Error, "ImportLibrary");
        }
    };
    reader.readAsText(file);
}

export function handleExport() {
    if (state.songs.length === 0) {
        state.ui.songList.innerHTML = '<p class="text-yellow-400">Your library is empty. Nothing to export.</p>';
        setTimeout(() => renderSongLibrary(), 3000);
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.songs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `fretflow_library_${state.currentInstrument}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

export async function handleSongClick(e: MouseEvent) {
    const songItem = (e.target as HTMLElement).closest('.song-item');
    if (!songItem) return;
    const songId = songItem.getAttribute('data-id');
    if ((e.target as HTMLElement).closest('.delete-song-btn')) {
        if (songId) deleteSong(songId);
        return;
    }
    const songData = state.songs.find(s => s.id === songId);
    if (songData) {
        await loadSongToPractice(songData);
    }
}
