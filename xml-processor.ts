import { Logger } from './logger';
import { generateTablature, assignFingering } from './tablature';
import { getInstrument } from './config';
import type { InstrumentID, NoteEvent, TabEvent } from './types';


const NOTE_VALUES: { [key: string]: number } = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };

function pitchNodeToMidi(pitchNode: Element): number {
    const step = pitchNode.querySelector('step')?.textContent;
    const octave = pitchNode.querySelector('octave')?.textContent;
    const alter = parseInt(pitchNode.querySelector('alter')?.textContent || '0');
    if (!step || !octave || !NOTE_VALUES.hasOwnProperty(step)) return 60; // C4 as fallback
    return 12 * (parseInt(octave) + 1) + NOTE_VALUES[step] + alter;
}

/**
 * Parses a MusicXML document on the main thread into a simple,
 * serializable object that can be sent to a worker for heavy processing.
 * This function extracts pitch and timing information, ignoring layout and style.
 */
export function preProcessXml(doc: Document, fileName: string): any {
    const errorNode = doc.querySelector('parsererror');
    if (errorNode) {
        throw new Error(`XML Parsing Error: ${errorNode.textContent?.trim()}`);
    }

    const title = doc.querySelector('work-title')?.textContent?.trim() || fileName.replace(/\.xml$/i, '');
    const partNodes = doc.querySelectorAll('part-list > score-part');
    const partMap = new Map<string, string>();
    partNodes.forEach(pn => {
        const id = pn.getAttribute('id');
        const name = pn.querySelector('part-name')?.textContent || 'Unknown Part';
        if (id) partMap.set(id, name);
    });

    const parts: any[] = [];
    const partDataNodes = doc.querySelectorAll('part');
    
    // Find initial tempo and time signature
    const firstAttributes = doc.querySelector('part > measure > attributes');
    const tempoEl = doc.querySelector('sound[tempo]') || firstAttributes?.querySelector('direction sound[tempo]');
    const initialTempoBpm = tempoEl ? parseFloat(tempoEl.getAttribute('tempo')!) : 120;
    const timeEl = firstAttributes?.querySelector('time');
    const initialTimeSignature = {
        numerator: parseInt(timeEl?.querySelector('beats')?.textContent || '4', 10),
        denominator: parseInt(timeEl?.querySelector('beat-type')?.textContent || '4', 10),
    };

    partDataNodes.forEach(partNode => {
        const partId = partNode.getAttribute('id')!;
        const notes: any[] = [];
        let absoluteTime = 0;
        let divisions = 1;
        let currentTempoBpm = initialTempoBpm;

        const measures = partNode.querySelectorAll('measure');
        measures.forEach(measure => {
            let measureTime = 0;

            const attributes = measure.querySelector('attributes');
            if (attributes) {
                const newDivisions = attributes.querySelector('divisions')?.textContent;
                if (newDivisions) divisions = parseInt(newDivisions, 10);
            }
            
            const directionTempo = measure.querySelector('direction sound[tempo]');
            if (directionTempo) {
                currentTempoBpm = parseFloat(directionTempo.getAttribute('tempo')!);
            }
            const secondsPerDivision = (60 / currentTempoBpm) / divisions;

            for (const node of measure.childNodes) {
                const nodeName = node.nodeName.toLowerCase();
                const el = node as Element;
                
                if (nodeName === 'note') {
                    if (el.querySelector('rest')) {
                        if (!el.querySelector('chord')) {
                           measureTime += parseInt(el.querySelector('duration')?.textContent || '0', 10) * secondsPerDivision;
                        }
                        continue;
                    }

                    const pitchEl = el.querySelector('pitch');
                    if (pitchEl) {
                        let durationTicks = parseInt(el.querySelector('duration')?.textContent || '0', 10);
                        let durationSeconds = durationTicks * secondsPerDivision;

                        // Add duration for dotted notes
                        el.querySelectorAll('dot').forEach(() => {
                            durationTicks /= 2;
                            durationSeconds += durationTicks * secondsPerDivision;
                        });

                        const noteData = {
                            pitch: pitchNodeToMidi(pitchEl),
                            startTime: absoluteTime + (el.querySelector('chord') ? (measureTime - (parseInt(el.querySelector('duration')?.textContent || '0', 10) * secondsPerDivision)) : measureTime),
                            duration: durationSeconds,
                            staff: parseInt(el.querySelector('staff')?.textContent || '1', 10),
                            voice: el.querySelector('voice')?.textContent || '1',
                            isTieStart: !!(el.querySelector('tie[type="start"]') || el.querySelector('notations > tied[type="start"]')),
                            isTieStop: !!(el.querySelector('tie[type="stop"]') || el.querySelector('notations > tied[type="stop"]')),
                        };
                        notes.push(noteData);
                    }
                    if (!el.querySelector('chord')) {
                       measureTime += parseInt(el.querySelector('duration')?.textContent || '0', 10) * secondsPerDivision;
                    }
                } else if (nodeName === 'backup') {
                    measureTime -= parseInt(el.querySelector('duration')?.textContent || '0', 10) * secondsPerDivision;
                } else if (nodeName === 'forward') {
                     measureTime += parseInt(el.querySelector('duration')?.textContent || '0', 10) * secondsPerDivision;
                }
            }
            absoluteTime += measureTime;
        });

        if (notes.length > 0) {
            parts.push({
                id: partId,
                name: partMap.get(partId) || 'Unknown Part',
                notes: notes
            });
        }
    });

    if (parts.length === 0) {
        throw new Error('MusicXML file contains no parsable instrument parts with notes.');
    }
    
    return {
        title,
        parts,
        initialTempo: 60_000_000 / initialTempoBpm,
        initialTimeSignature,
    };
}


/**
 * Processes pre-parsed MusicXML data into a song.
 * This function performs the tablature generation.
 */
export function processXmlData(data: any, instrumentId: InstrumentID): {
    title: string;
    tablature: TabEvent[];
    midiTempo: number;
    midiTimeSignature: { numerator: number, denominator: number };
} {
    const { title, parts, initialTempo, initialTimeSignature } = data;
    Logger.info(`Processing pre-parsed XML data for: ${title}`, 'XmlProcessing');

    // Find the most likely part for the selected instrument
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

    // Add pre-roll measure
    const secondsPerBeat = initialTempo / 1000000.0;
    const beatsPerMeasure = initialTimeSignature.numerator || 4;
    const measureDuration = secondsPerBeat * beatsPerMeasure;

    if (measureDuration > 0) {
        Logger.info(`Adding ${measureDuration.toFixed(2)}s pre-roll measure.`, 'XmlProcessing');
        noteEvents.forEach(event => {
            event.notes.forEach(note => {
                note.startTime += measureDuration;
            });
        });
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