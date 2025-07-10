import { state } from './state';
import { Logger } from './logger';
import { parseMidi } from './midi-parser';
import { preProcessXml, processXmlData } from './xml-processor';
import { generateTablature, assignFingering } from './tablature';
import { getInstrument } from './config';
import type { Song, InstrumentID, NoteEvent, TabEvent } from './types';
import { renderSongLibrary } from './library-ui';

const ROMANZA_DEMO_MIDI_B64 = "TVRoZAAAAAYAAQABAeBNVHJrAAAEFQD/AwdVa3VsZWxlAP9YBAkDGAgA/1kCAAAA/1EDB6EgALB5AABkAABlAAAGDABkfwBlfwDAGACwB2QACkAAWwAAXQAA/yEBAACQR1CFT0cAAUdQhU9HAAFHUIVPRwABR1CFT0cAAUVQhU9FAAFDUIVPQwABQ1CFT0MAAUJQhU9CAAFAUIVPQAABQFCFT0AAAUNQhU9DAAFHUIVPRwABTFCFT0wAAUxQhU9MAAFMUIVPTAABTFCFT0wAAUpQhU9KAAFIUIVPSAABSFCFT0gAAUdQhU9HAAFFUIVPRQABRVCFT0UAAUdQhU9HAAFIUIVPSAABR1CFT0cAAUhQhU9IAAFHUIVPRwABS1CFT0sAAUhQhU9IAAFHUIVPRwABR1CFT0cAAUVQhU9FAAFDUIVPQwABQ1CFT0MAAUJQhU9CAAFAUIVPQAABQlCFT0IAAUJQhU9CAAFCUIVPQgABQlCFT0IAAUNQhU9DAAFCUIVPQgABQFCFT0AAAUBQhU9AAAFAUIVPQAABQFCFT0AAiyFEUIVPRAABRFCFT0QAAURQhU9EAAFEUIVPRAABQlCFT0IAAUBQhU9AAAFAUIVPQAABP1CFTz8AAT9QhU8/AAE/UIVPPwABPlCFTz4AAT9QhU8/AAFJUIVPSQABSVCFT0kAAUlQhU9JAAFJUIVPSQABS1CFT0sAAUlQhU9JAAFJUIVPSQABR1CFT0cAAUdQhU9HAAFHUIVPRwABSVCFT0kAAUtQhU9LAAFMUIVPTAABTFCFT0wAAUxQhU9MAAFMUIVPTAABS1CFT0sAAUpQhU9KAAFJUIVPSQABSVCFT0kAAUlQhU9JAAFJUIVPSQABR1CFT0cAAUVQhU9FAAFEUIVPRAABRFCFT0QAAURQhU9EAAFEUIVPRAABRVCFT0UAAUJQhU9CAAFAUIVPQAABQFCFT0AAAUBQhU9AAAFAUIVPQACLIUdQhU9HAAFHUIVPRwABR1CFT0cAAUdQhU9HAAFFUIVPRQABQ1CFT0MAAUNQhU9DAAFCUIVPQgABQFCFT0AAAUBQhU9AAAFDUIVPQwABR1CFT0cAAUxQhU9MAAFMUIVPTAABTFCFT0wAAUxQhU9MAAFKUIVPSgABSFCFT0gAAUhQhU9IAAFHUIVPRwABRVCFT0UAAUVQhU9FAAFHUIVPRwABSFCFT0gAAUdQhU9HAAFIUIVPSAABR1CFT0cAAUtQhU9LAAFIUIVPSAABR1CFT0cAAUdQhU9HAAFFUIVPRQABQ1CFT0MAAUNQhU9DAAFCUIVPQgABQFCFT0AAAUJQhU9CAAFCUIVPQgABQlCFT0IAAUJQhU9CAAFDUIVPQwABQlCFT0IAAUBQhU9AAAFAUIVPQAABQFCFT0AAAUBQhU9AAAH/LwA=";


/**
 * Takes a promise that resolves with song data, creates a song object,
 * and adds it to the library, handling UI updates and errors.
 */
async function completeAndAddSong(
    processingPromise: Promise<{ title: string; tablature: TabEvent[]; midiTempo: number; midiTimeSignature: any; }>,
    placeholderId: string,
    isDemo = false
) {
    try {
        const result = await processingPromise;
        const song: Song = {
            id: 'song_' + Date.now() + Math.random(),
            title: result.title,
            highScore: 0,
            isFavorite: false,
            tablature: JSON.stringify(result.tablature),
            midiTempo: result.midiTempo,
            midiTimeSignature: JSON.stringify(result.midiTimeSignature),
            createdAt: new Date().toISOString(),
            playbackTempo: 100,
            transpose: 0,
            zoomLevel: 1.0,
            stringShift: 0,
        };
        Logger.info(`Successfully processed and adding song: ${song.title}`, 'Library');
        state.songs.unshift(song);
        localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
    } catch (err: any) {
        const errorMessage = `Error adding song: ${err.message}`;
        if (!isDemo) {
            alert(errorMessage);
        }
        Logger.error(err, 'Song Addition');
    } finally {
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) placeholder.remove();
        // Re-render to show new song or to remove placeholder if library is empty
        renderSongLibrary();
    }
}

/**
 * Processes a MIDI file ArrayBuffer into tablature data.
 */
function processMidiFile(fileBuffer: ArrayBuffer, fileName: string, instrumentId: InstrumentID, isDemo: boolean): Promise<{ title: string; tablature: TabEvent[]; midiTempo: number; midiTimeSignature: any; }> {
    return new Promise((resolve, reject) => {
        try {
            const title = fileName.replace(/\.(mid|midi)$/i, '');
            const midi = parseMidi(new Uint8Array(fileBuffer));
            const division = midi.timeDivision;

            let allEvents: any[] = [];
            midi.tracks.forEach((track) => {
                let absoluteTicks = 0;
                track.forEach(event => {
                    absoluteTicks += event.deltaTime;
                    event.absoluteTicks = absoluteTicks;
                    allEvents.push(event);
                });
            });
            allEvents.sort((a, b) => a.absoluteTicks - b.absoluteTicks);

            const notes: { pitch: number; startTime: number; duration: number; absoluteTicks: number }[] = [];
            const openNotes: { [key: number]: { pitch: number; startTimeInSeconds: number; absoluteTicks: number }[] } = {};
            let currentTimeInSeconds = 0;
            let lastEventTicks = 0;
            let currentTempo = 500000;
            const ticksToSeconds = (ticks: number, tempo: number) => (ticks * (tempo / 1000000.0)) / division;

            allEvents.forEach(event => {
                const ticksSinceLastEvent = event.absoluteTicks - lastEventTicks;
                currentTimeInSeconds += ticksToSeconds(ticksSinceLastEvent, currentTempo);
                lastEventTicks = event.absoluteTicks;

                if (event.type === 'meta' && event.subtype === 0x51) {
                    currentTempo = event.data;
                } else if (event.type === 'channel') {
                    const pitch = event.param1;
                    if (event.subtype === 9 && event.param2 > 0) {
                        if (!openNotes[pitch]) openNotes[pitch] = [];
                        openNotes[pitch].push({ pitch, startTimeInSeconds: currentTimeInSeconds, absoluteTicks: event.absoluteTicks });
                    } else if (event.subtype === 8 || (event.subtype === 9 && event.param2 === 0)) {
                        if (openNotes[pitch] && openNotes[pitch].length > 0) {
                            const lastNoteOn = openNotes[pitch].pop()!;
                            const duration = currentTimeInSeconds - lastNoteOn.startTimeInSeconds;
                            if (duration > 0.001) {
                                notes.push({ pitch: lastNoteOn.pitch, startTime: lastNoteOn.startTimeInSeconds, duration, absoluteTicks: lastNoteOn.absoluteTicks });
                            }
                        }
                    }
                }
            });

            // Find tempo and time signature
            let midiTempo = 500000;
            let timeSignature = { numerator: 4, denominator: 4 };
            allEvents.find(e => { if (e.type === 'meta' && e.subtype === 0x51) { midiTempo = e.data; return true; } return false; });
            allEvents.find(e => { if (e.type === 'meta' && e.subtype === 0x58 && e.data) { timeSignature = { numerator: e.data[0], denominator: Math.pow(2, e.data[1]) }; return true; } return false; });

            // Calculate and add pre-roll measure
            const secondsPerBeat = midiTempo / 1000000.0;
            const beatsPerMeasure = timeSignature.numerator || 4;
            const measureDuration = secondsPerBeat * beatsPerMeasure;
            if (measureDuration > 0) {
                Logger.info(`Adding ${measureDuration.toFixed(2)}s pre-roll measure.`, 'MidiProcessing');
                notes.forEach(note => {
                    note.startTime += measureDuration;
                });
            }

            if (isDemo && notes.length > 0) {
                const instrumentConfig = getInstrument(instrumentId);
                const minInstrumentPitch = Math.min(...instrumentConfig.tuning);
                const maxInstrumentPitch = Math.max(...instrumentConfig.tuning) + instrumentConfig.numFrets;
                let bestTranspose = 0, maxPlayableNotes = 0;
                for (let transpose = -24; transpose <= 24; transpose++) {
                    const currentPlayableNotes = notes.filter(note => (note.pitch + transpose) >= minInstrumentPitch && (note.pitch + transpose) <= maxInstrumentPitch).length;
                    if (currentPlayableNotes > maxPlayableNotes || (currentPlayableNotes === maxPlayableNotes && Math.abs(transpose) < Math.abs(bestTranspose))) {
                        maxPlayableNotes = currentPlayableNotes; bestTranspose = transpose;
                    }
                }
                if (bestTranspose !== 0) notes.forEach(note => { note.pitch += bestTranspose; });
            }

            notes.sort((a, b) => a.absoluteTicks - b.absoluteTicks);
            const noteEvents: NoteEvent[] = [];
            for (let i = 0; i < notes.length; ) {
                const simultaneousNotes = [notes[i]];
                let j = i + 1;
                while (j < notes.length && notes[j].absoluteTicks === notes[i].absoluteTicks) simultaneousNotes.push(notes[j++]);
                noteEvents.push({ notes: simultaneousNotes.map(n => ({ pitch: n.pitch, startTime: n.startTime, duration: n.duration })).sort((a, b) => a.pitch - b.pitch), isChord: simultaneousNotes.length > 1 });
                i = j;
            }

            const tablature = generateTablature(noteEvents, instrumentId);
            const fingeredTablature = assignFingering(tablature);
            if (fingeredTablature.length === 0) throw new Error('No playable notes found. The MIDI might be empty, corrupted, or out of the instrument range.');

            resolve({ title, tablature: fingeredTablature, midiTempo, midiTimeSignature: timeSignature });
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Processes a MusicXML file string into tablature data.
 */
function processXmlFile(fileContent: string, fileName: string, instrumentId: InstrumentID): Promise<{ title: string; tablature: TabEvent[]; midiTempo: number; midiTimeSignature: any; }> {
    return new Promise((resolve, reject) => {
        try {
            const doc = new DOMParser().parseFromString(fileContent, "application/xml");
            const preProcessedData = preProcessXml(doc, fileName);
            const result = processXmlData(preProcessedData, instrumentId);
            resolve(result);
        } catch (e) {
            reject(e);
        }
    });
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function addDemoSong() {
    Logger.info('Adding demo song to library.', 'Library');
    const placeholderId = 'demo-song-placeholder';
    renderSongLibrary(placeholderId, 'Romanza (Demo)');
    
    const fileBuffer = base64ToArrayBuffer(ROMANZA_DEMO_MIDI_B64);
    const processingPromise = processMidiFile(fileBuffer, 'Romanza (Demo)', state.currentInstrument, true);
    
    completeAndAddSong(processingPromise, placeholderId, true);
}

export function loadLibrary() {
    Logger.info(`Loading library for instrument: ${state.currentInstrument}`, 'Library');
    const savedSongs = localStorage.getItem(`fretflow_songs_${state.currentInstrument}`);
    state.songs = savedSongs ? JSON.parse(savedSongs) : [];
    if (state.songs.length === 0) {
        addDemoSong();
    } else {
        renderSongLibrary();
    }
}

export function handleImport(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    Logger.info(`Importing library from file: ${file.name}`, 'Library');
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedSongs: Song[] = JSON.parse(event.target!.result as string);
            if (Array.isArray(importedSongs)) {
                const newSongs = importedSongs.filter(impS => !state.songs.some(exS => exS.id === impS.id));
                state.songs.push(...newSongs);
                localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
                renderSongLibrary();
                Logger.info(`Imported ${newSongs.length} new songs.`, 'Library');
                alert(`Imported ${newSongs.length} new songs.`);
            } else {
                throw new Error("Invalid library format. Expected an array of songs.");
            }
        } catch (err) {
            alert(`Failed to import library: ${err}`);
            Logger.error(err as Error, "LibraryImport");
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}

export function handleImportSong(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    Logger.info(`Importing single song from file: ${file.name}`, 'Library');
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const importedSong: Song = JSON.parse(event.target!.result as string);

            // Basic validation
            if (!importedSong.title || !importedSong.tablature || !importedSong.id) {
                throw new Error("Invalid song file format. Missing required properties (id, title, tablature).");
            }
            
            // Check for duplicates
            const existingSong = state.songs.find(s => s.id === importedSong.id);
            if (existingSong) {
                // To avoid overwriting, give it a new ID and updated title
                const originalId = importedSong.id;
                importedSong.id = 'song_' + Date.now() + Math.random();
                importedSong.title = `${importedSong.title} (Imported)`;
                Logger.warn(`Imported song with duplicate ID. Assigned new ID and title.`, 'Library', { oldId: originalId, newId: importedSong.id });
            }

            state.songs.unshift(importedSong); // Add to the top of the list
            localStorage.setItem(`fretflow_songs_${state.currentInstrument}`, JSON.stringify(state.songs));
            renderSongLibrary();
            Logger.info(`Successfully imported song: ${importedSong.title}`, 'Library');
            alert(`Successfully imported "${importedSong.title}".`);

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            alert(`Failed to import song: ${errorMessage}`);
            Logger.error(err as Error, "SongImport");
        } finally {
            input.value = ''; // Reset input to allow importing the same file again
        }
    };
    reader.readAsText(file);
}

export function handleExport() {
    if (state.songs.length === 0) {
        alert("Library is empty, nothing to export.");
        return;
    }
    Logger.info('Exporting library', 'Library', { songCount: state.songs.length });
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.songs, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `fretflow_library_${state.currentInstrument}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

export function handleAddSong(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    Logger.info(`Adding ${files.length} new song(s).`, 'Library');

    for (const file of files) {
        const lowerCaseName = file.name.toLowerCase();
        const isMidi = lowerCaseName.endsWith('.mid') || lowerCaseName.endsWith('.midi');
        const isXml = lowerCaseName.endsWith('.xml');

        if (!isMidi && !isXml) {
            Logger.warn(`Skipping unsupported file type: ${file.name}`, 'Library');
            alert(`Skipping unsupported file type: ${file.name}`);
            continue;
        }

        const reader = new FileReader();
        const placeholderId = `placeholder-${Date.now()}-${Math.random()}`;
        renderSongLibrary(placeholderId, file.name);

        reader.onload = (event) => {
            const fileContent = event.target!.result;
            let processingPromise;

            if (isMidi) {
                processingPromise = processMidiFile(fileContent as ArrayBuffer, file.name, state.currentInstrument, false);
            } else { // isXml
                processingPromise = processXmlFile(fileContent as string, file.name, state.currentInstrument);
            }
            completeAndAddSong(processingPromise, placeholderId);
        };

        reader.onerror = () => {
             Logger.error(`FileReader error for file: ${file.name}`, 'Library');
             const placeholder = document.getElementById(placeholderId);
             if (placeholder) placeholder.remove();
        };

        if (isMidi) {
            reader.readAsArrayBuffer(file);
        } else { // isXml
            reader.readAsText(file);
        }
    }
    input.value = '';
}