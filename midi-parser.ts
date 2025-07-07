// midi-parser.ts

// This utility file contains the functions necessary to parse a raw MIDI file buffer
// into a structured object representing its tracks and events.

// --- Simplified Logger for this module ---
const Logger = {
    log(level: 'info' | 'warn' | 'error', message: string, ctx = 'General', data?: any) {
        // This is a utility file, so we'll just use console for simplicity.
        // The main app's Logger can wrap calls to this if needed.
        const fullMessage = `[MidiParser:${ctx}] ${message}`;
        if (data) {
            console[level](fullMessage, data);
        } else {
            console[level](fullMessage);
        }
    },
    warn(message: string, ctx?: string, data?: any) { this.log('warn', message, ctx, data) },
};

// --- MIDI PARSER LOGIC ---
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

export function parseMidi(uint8array: Uint8Array) {
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
