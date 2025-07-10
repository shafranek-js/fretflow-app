import type { Song, TabEvent } from './types';
import { Logger } from './logger';

// Helper to write a 32-bit integer in big-endian format
function writeInt32(arr: number[], value: number) {
    arr.push((value >> 24) & 0xFF);
    arr.push((value >> 16) & 0xFF);
    arr.push((value >> 8) & 0xFF);
    arr.push(value & 0xFF);
}

// Helper to write a 16-bit integer in big-endian format
function writeInt16(arr: number[], value: number) {
    arr.push((value >> 8) & 0xFF);
    arr.push(value & 0xFF);
}

// Helper to write a variable-length quantity for delta-time
function writeVarInt(arr: number[], value: number) {
    let buffer = value & 0x7F;
    while ((value >>= 7) > 0) {
        buffer <<= 8;
        buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
        arr.push(buffer & 0xFF);
        if (buffer & 0x80) {
            buffer >>= 8;
        } else {
            break;
        }
    }
}

export function songToMidi(song: Song): Uint8Array {
    const tablature: TabEvent[] = JSON.parse(song.tablature);
    const timeDivision = 480; // Ticks per quarter note, a common value
    const tempo = song.midiTempo || 500000; // Microseconds per quarter note (default 120 bpm)
    const timeSignature = song.midiTimeSignature ? JSON.parse(song.midiTimeSignature) : { numerator: 4, denominator: 4 };

    const secondsPerTick = (tempo / 1_000_000) / timeDivision;

    // --- Create MIDI Events ---
    const midiEvents: { tick: number, event: number[] }[] = [];

    // 1. Initial Meta Events
    // Time Signature
    midiEvents.push({
        tick: 0,
        event: [0xFF, 0x58, 0x04, timeSignature.numerator, Math.log2(timeSignature.denominator), 24, 8]
    });
    // Tempo
    const tempoBytes = [];
    // We need to push the bytes of the tempo value into an array to extract them.
    // The tempo value is 3 bytes (24 bits).
    tempoBytes.push((tempo >> 16) & 0xFF);
    tempoBytes.push((tempo >> 8) & 0xFF);
    tempoBytes.push(tempo & 0xFF);
    midiEvents.push({
        tick: 0,
        event: [0xFF, 0x51, 0x03, ...tempoBytes]
    });
     // Instrument Name (Program Name)
    const instrumentName = `FretFlow: ${song.title}`;
    const instrumentNameBytes = Array.from(instrumentName).map(c => c.charCodeAt(0));
    midiEvents.push({
        tick: 0,
        event: [0xFF, 0x03, instrumentNameBytes.length, ...instrumentNameBytes]
    });


    // 2. Note On/Off Events
    tablature.forEach(tabEvent => {
        tabEvent.notes.forEach(note => {
            const startTick = Math.round(note.startTime / secondsPerTick);
            const endTick = Math.round((note.startTime + note.duration) / secondsPerTick);
            
            // Note On: 0x90 (channel 0), pitch, velocity (e.g., 100)
            midiEvents.push({
                tick: startTick,
                event: [0x90, note.pitch, 100]
            });
            // Note Off: 0x80 (channel 0), pitch, velocity (e.g., 0)
            midiEvents.push({
                tick: endTick,
                event: [0x80, note.pitch, 0]
            });
        });
    });

    // Sort events by tick
    midiEvents.sort((a, b) => a.tick - b.tick);

    // --- Build Track Chunk ---
    const trackBytes: number[] = [];
    let lastTick = 0;
    midiEvents.forEach(midiEvent => {
        const deltaTick = midiEvent.tick - lastTick;
        writeVarInt(trackBytes, deltaTick);
        trackBytes.push(...midiEvent.event);
        lastTick = midiEvent.tick;
    });

    // Add End of Track event
    writeVarInt(trackBytes, 0);
    trackBytes.push(0xFF, 0x2F, 0x00);

    // --- Build Header and Final MIDI File ---
    const midiBytes: number[] = [];

    // Header Chunk
    midiBytes.push(...'MThd'.split('').map(c => c.charCodeAt(0)));
    writeInt32(midiBytes, 6); // Header length
    writeInt16(midiBytes, 1); // Format 1 (multiple tracks, though we only have one content track)
    writeInt16(midiBytes, 1); // Number of tracks
    writeInt16(midiBytes, timeDivision);

    // Track Chunk
    midiBytes.push(...'MTrk'.split('').map(c => c.charCodeAt(0)));
    writeInt32(midiBytes, trackBytes.length); // Track length
    midiBytes.push(...trackBytes);

    Logger.info(`Generated MIDI file for song: ${song.title}`, 'MidiGenerator', { bytes: midiBytes.length });
    return new Uint8Array(midiBytes);
}
