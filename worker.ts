// worker.ts

// --- This worker processes MIDI files and pre-parsed MusicXML data into playable tablature ---

'use strict';

import { generateTablature, assignFingering } from './tablature';
import { getInstrument } from './config';
import type { InstrumentID, NoteEvent, TabEvent } from './types';


// --- Simplified Logger for Worker ---
const Logger = {
    log(level: 'info' | 'warn' | 'error', message: string, ctx = 'General', data?: any) {
        const fullMessage = `[WORKER:${ctx}] ${message}`;
        if (data) {
            console[level](fullMessage, data);
        } else {
            console[level](fullMessage);
        }
    },
    info(message: string, ctx?: string, data?: any) { this.log('info', message, ctx, data) },
    warn(message: string, ctx?: string, data?: any) { this.log('warn', message, ctx, data) },
    error(error: unknown, ctx?: string, data?: any) {
        const message = error instanceof Error ? error.message : String(error);
        const logData = error instanceof Error ? { stack: error.stack, ...data } : data;
        this.log('error', message, ctx, logData);
    },
};

// --- MIDI PARSER LOGIC (Self-contained in worker) ---
class Stream {
    data: DataView;
    length: number;
    pos: number;

    constructor(uint8array: Uint8Array, opt_start?: number) {
        this.data = new DataView(uint8array.buffer, uint8array.byteOffset);
        this.length = this.data.byteLength;
        this.pos = opt_start || 0;
    }

    getc() { return this.data.getUint8(this.pos++); }
    peek() { return this.data.getUint8(this.pos); }
    read(length: number) {
        var a = new Uint8Array(this.data.buffer, this.data.byteOffset + this.pos, length);
        this.pos += length;
        return a;
    }
    readInt16() {
        var v = this.data.getUint16(this.pos, false);
        this.pos += 2;
        return v;
    }
    readInt32() {
        var v = this.data.getUint32(this.pos, false);
        this.pos += 4;
        return v;
    }
    readVarInt() {
        var v = 0, c;
        do {
            c = this.getc();
            v = (v << 7) | (c & 0x7f);
        } while(c & 0x80);
        return v;
    }
    readString(length: number) {
        var str = '';
        for (var i = 0; i < length; ++i) str += String.fromCharCode(this.getc());
        return str;
    }
}

function parseHeader(stream: Stream) {
    var id = stream.readString(4);
    if (id !== 'MThd') throw new Error('Invalid MThd signature');
    stream.readInt32(); // length
    var formatType = stream.readInt16();
    var trackCount = stream.readInt16();
    var timeDivision = stream.readInt16();
    if(timeDivision & 0x8000) throw new Error('Time division is not in ticks per quarter note.');
    return { formatType: formatType, trackCount: trackCount, timeDivision: timeDivision };
}

function parseTrack(stream: Stream) {
    var id = stream.readString(4);
    if (id !== 'MTrk') throw new Error('Invalid MTrk signature');
    var len = stream.readInt32();
    var trackEnd = stream.pos + len;
    var lastStatusByte: number | null = null;
    var events = [];
    while (stream.pos < trackEnd) {
        const deltaTime = stream.readVarInt();
        let statusByte = stream.peek();
        let event: any = { deltaTime };
        if ((statusByte & 0x80) === 0) {
            if (lastStatusByte === null) throw new Error('Running status byte is null. Invalid MIDI.');
            statusByte = lastStatusByte;
        } else {
            lastStatusByte = statusByte;
            stream.pos++;
        }
        const type = statusByte >> 4;
        const channel = statusByte & 0x0f;
        if (type >= 0x8 && type <= 0xE) {
            event.type = 'channel';
            event.subtype = type;
            event.channel = channel;
            switch(type) {
                case 0x8: case 0x9: case 0xA: case 0xB: case 0xE: // note off, note on, poly pressure, control change, pitch bend
                    event.param1 = stream.getc();
                    event.param2 = stream.getc();
                    break;
                case 0xC: case 0xD: // program change, channel pressure
                    event.param1 = stream.getc();
                    event.param2 = 0; // for consistency
                    break;
            }
        } else if (statusByte === 0xFF) {
            event.type = 'meta';
            const metaEvent = event;
            metaEvent.subtype = stream.getc();
            const len = stream.readVarInt();
            switch(metaEvent.subtype) {
                case 0x51: // tempo
                    metaEvent.data = (stream.getc() << 16) + (stream.getc() << 8) + stream.getc();
                    break;
                case 0x58: // time signature
                     metaEvent.data = stream.read(len);
                     break;
                default:
                    stream.pos += len;
            }
        } else if (statusByte === 0xF0 || statusByte === 0xF7) { // SysEx
            const len = stream.readVarInt();
            stream.pos += len;
            event.type = 'sysEx';
        } else {
             event.type = 'system';
             event.subtype = statusByte;
             let bytesToRead = 0;
             switch(statusByte) {
                case 0xF1: case 0xF3: bytesToRead = 1; break;
                case 0xF2: bytesToRead = 2; break;
             }
             if(bytesToRead > 0) stream.read(bytesToRead);
        }
        if (event.type) events.push(event);
    }
    return events;
}

function parseMidi(uint8array: Uint8Array) {
    const stream = new Stream(uint8array);
    const header = parseHeader(stream);
    const tracks = [];
    for(var i=0; i<header.trackCount; ++i) {
        try {
            tracks.push(parseTrack(stream));
        } catch(e: any) {
            Logger.warn(`Failed to parse track ${i+1}. Skipping. Reason: ${e.message}`, 'Parse');
        }
    }
    return { ...header, tracks };
}

function processMidi(fileBuffer: ArrayBuffer, fileName: string, instrumentId: InstrumentID, isDemo: boolean) {
    const title = fileName.replace(/\.(mid|midi)$/i, '');
    const midi = parseMidi(new Uint8Array(fileBuffer));
    const division = midi.timeDivision;
    Logger.info('MIDI file parsed. Extracting note events.', 'MidiProcessing', { tracks: midi.trackCount, division });

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
    let currentTempo = 500000; // Default 120 bpm
    const ticksToSeconds = (ticks: number, tempo: number) => (ticks * (tempo / 1000000.0)) / division;

    allEvents.forEach(event => {
        const ticksSinceLastEvent = event.absoluteTicks - lastEventTicks;
        currentTimeInSeconds += ticksToSeconds(ticksSinceLastEvent, currentTempo);
        lastEventTicks = event.absoluteTicks;

        if (event.type === 'meta' && event.subtype === 0x51) {
            currentTempo = event.data;
        } else if (event.type === 'channel') {
            const pitch = event.param1;
            if (event.subtype === 9 && event.param2 > 0) { // Note On
                if (!openNotes[pitch]) openNotes[pitch] = [];
                openNotes[pitch].push({
                    pitch: pitch,
                    startTimeInSeconds: currentTimeInSeconds,
                    absoluteTicks: event.absoluteTicks,
                });
            } else if (event.subtype === 8 || (event.subtype === 9 && event.param2 === 0)) { // Note Off
                if (openNotes[pitch] && openNotes[pitch].length > 0) {
                    const lastNoteOn = openNotes[pitch].pop()!;
                    const duration = currentTimeInSeconds - lastNoteOn.startTimeInSeconds;
                    if (duration > 0.001) { // Ignore grace notes
                         notes.push({
                            pitch: lastNoteOn.pitch,
                            startTime: lastNoteOn.startTimeInSeconds,
                            duration: duration,
                            absoluteTicks: lastNoteOn.absoluteTicks,
                        });
                    }
                }
            }
        }
    });
    
    Logger.info(`Extracted ${notes.length} notes from MIDI.`, 'MidiProcessing');

    if (isDemo && notes.length > 0) {
        const instrumentConfig = getInstrument(instrumentId);
        const minInstrumentPitch = Math.min(...instrumentConfig.tuning);
        const maxInstrumentPitch = Math.max(...instrumentConfig.tuning) + instrumentConfig.numFrets;

        let bestTranspose = 0;
        let maxPlayableNotes = 0;
        for (let transpose = -24; transpose <= 24; transpose++) {
            const currentPlayableNotes = notes.filter(note => {
                const transposedPitch = note.pitch + transpose;
                return transposedPitch >= minInstrumentPitch && transposedPitch <= maxInstrumentPitch;
            }).length;

            if (currentPlayableNotes > maxPlayableNotes || (currentPlayableNotes === maxPlayableNotes && Math.abs(transpose) < Math.abs(bestTranspose))) {
                maxPlayableNotes = currentPlayableNotes;
                bestTranspose = transpose;
            }
        }
        if (bestTranspose !== 0) {
            Logger.info(`Applying optimal auto-transpose of ${bestTranspose} semitones for demo song.`, 'MidiProcessing');
            notes.forEach(note => { note.pitch += bestTranspose; });
        }
    }
    
    notes.sort((a, b) => a.absoluteTicks - b.absoluteTicks);
    const noteEvents: NoteEvent[] = [];
    for (let i = 0; i < notes.length; ) {
        const currentNote = notes[i];
        const simultaneousNotes = [currentNote];
        let j = i + 1;
        while (j < notes.length && notes[j].absoluteTicks === currentNote.absoluteTicks) {
            simultaneousNotes.push(notes[j++]);
        }
        noteEvents.push({ 
            notes: simultaneousNotes.map(n => ({ pitch: n.pitch, startTime: n.startTime, duration: n.duration })).sort((a, b) => a.pitch - b.pitch), 
            isChord: simultaneousNotes.length > 1 
        });
        i = j;
    }

    Logger.info(`Starting tablature generation for ${noteEvents.length} events.`, 'MidiProcessing');
    const tablature = generateTablature(noteEvents, instrumentId);
    Logger.info(`Generated ${tablature.length} tablature events. Assigning fingering.`, 'MidiProcessing');
    const fingeredTablature = assignFingering(tablature);

    if (fingeredTablature.length === 0) {
        throw new Error('No playable notes found. The MIDI might be empty, corrupted, or out of the instrument range.');
    }

    let midiTempo = 500000;
    let timeSignature = { numerator: 4, denominator: 4 };
    allEvents.find(e => { if (e.type === 'meta' && e.subtype === 0x51) { midiTempo = e.data; return true; } });
    allEvents.find(e => { if (e.type === 'meta' && e.subtype === 0x58 && e.data) { timeSignature = { numerator: e.data[0], denominator: Math.pow(2, e.data[1]) }; return true; } });

    return { title, tablature: fingeredTablature, midiTempo, midiTimeSignature: timeSignature };
}

/**
 * Processes pre-parsed MusicXML data into a song.
 * This is the second stage of the XML import pipeline.
 */
function processXmlData(data: any, instrumentId: InstrumentID): {
    title: string;
    tablature: TabEvent[];
    midiTempo: number;
    midiTimeSignature: { numerator: number, denominator: number };
} {
    const { title, parts, initialTempo, initialTimeSignature } = data;
    Logger.info(`Processing pre-parsed XML data for: ${title}`, 'XmlProcessing');

    // Find the most likely part for the selected instrument
    const instrumentConfig = getInstrument(instrumentId);
    const instrumentPart = parts.find((p: any) => /guitar|ukulele/i.test(p.name)) || parts[0];
    if (!instrumentPart) {
        throw new Error("Could not find any instrument parts in the MusicXML file.");
    }
    
    Logger.info(`Selected part "${instrumentPart.name}" for tablature generation.`, 'XmlProcessing');
    
    const noteEvents: NoteEvent[] = [];
    const tiedNotes: { [key: string]: { pitch: number; startTime: number; duration: number; } } = {};

    instrumentPart.notes.sort((a: any, b: any) => a.startTime - b.startTime);

    for (let i = 0; i < instrumentPart.notes.length; ) {
        const currentNoteInfo = instrumentPart.notes[i];
        const simultaneousNotes = [currentNoteInfo];
        let j = i + 1;
        while (j < instrumentPart.notes.length && Math.abs(instrumentPart.notes[j].startTime - currentNoteInfo.startTime) < 0.001) {
            simultaneousNotes.push(instrumentPart.notes[j++]);
        }
        
        const eventNotes: { pitch: number; startTime: number; duration: number; }[] = [];
        
        simultaneousNotes.forEach((noteInfo: any) => {
            const voice = `${noteInfo.staff}-${noteInfo.voice}`;
            const activeTiedNote = tiedNotes[voice];
            
            if (noteInfo.isTieStop && activeTiedNote) {
                activeTiedNote.duration += noteInfo.duration;
            } else {
                const newNote = {
                    pitch: noteInfo.pitch,
                    startTime: noteInfo.startTime,
                    duration: noteInfo.duration,
                };
                eventNotes.push(newNote);
                if (noteInfo.isTieStart) {
                    tiedNotes[voice] = newNote;
                }
            }
            if (noteInfo.isTieStop && !noteInfo.isTieStart) {
                delete tiedNotes[voice];
            }
        });
        
        if (eventNotes.length > 0) {
            noteEvents.push({
                notes: eventNotes.sort((a, b) => a.pitch - b.pitch),
                isChord: eventNotes.length > 1
            });
        }
        i = j;
    }
    
    if (noteEvents.length === 0) {
         throw new Error(`The selected part "${instrumentPart.name}" contains no playable notes.`);
    }

    const tablature = generateTablature(noteEvents, instrumentId);
    const fingeredTablature = assignFingering(tablature);
    
    if (fingeredTablature.length === 0) {
        throw new Error('Could not generate playable tablature from the MusicXML file. Notes may be outside the instrument range.');
    }

    return {
        title: title,
        tablature: fingeredTablature,
        midiTempo: initialTempo,
        midiTimeSignature: initialTimeSignature,
    };
}


self.onmessage = async (e) => {
    const { type, payload, fileName, instrumentId, isDemo, placeholderId } = e.data;
    
    try {
        let result;
        if (type === 'midi') {
             Logger.info(`Received MIDI for processing: ${fileName}`, 'Worker', { instrumentId, isDemo });
             result = processMidi(payload, fileName, instrumentId, isDemo);
        } else if (type === 'xml') {
            Logger.info(`Received XML data for processing: ${fileName}`, 'Worker', { instrumentId });
            result = processXmlData(payload, instrumentId);
        } else {
            throw new Error(`Unknown file type received by worker: ${type}`);
        }
        
        const { title, tablature, midiTempo, midiTimeSignature } = result;

        Logger.info('Successfully generated tablature.', 'Worker', { song: fileName });
        self.postMessage({
            status: 'success',
            song: {
                id: 'song_' + Date.now() + Math.random(),
                title: title,
                highScore: 0,
                isFavorite: false,
                tablature: JSON.stringify(tablature),
                midiTempo: midiTempo,
                midiTimeSignature: JSON.stringify(midiTimeSignature),
                createdAt: new Date().toISOString(),
                playbackTempo: 100,
                transpose: 0,
                zoomLevel: 1.0,
            },
            isDemo,
            placeholderId
        });
    } catch (err: unknown) {
        Logger.error(err, 'FileProcessing');
        const message = err instanceof Error ? err.message : 'Failed to process file.';
        self.postMessage({ status: 'error', message, isDemo, placeholderId });
    }
};
