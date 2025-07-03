
import { Logger } from './logger';
import { getInstrument } from './config';
import type { NoteEvent, TabEvent, InstrumentID, Note } from './types';

/**
 * Finds all possible fretboard positions for a given MIDI note.
 * @private
 */
function findPossiblePositions(midiNote: number, instrumentId: InstrumentID, usedStrings: Set<number> = new Set()) {
    const positions: { string: number; fret: number }[] = [];
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

/**
 * Calculates a cost for a given fingering to determine its playability.
 * A lower cost is better. This function penalizes awkward or difficult fingerings.
 * @private
 */
function calculateCost(previousFingering: Note[] | null, nextFingering: Note[]) {
    let cost = 0;
    const frets = nextFingering.map(n => n.fret).filter(f => f > 0);

    // --- High Fret Penalty (NEW) ---
    // Add a strong, non-linear penalty for using high frets (e.g., above 12th).
    // This encourages the algorithm to choose fingerings on higher strings with lower
    // frets, making passages with high notes more comfortable to play.
    const HIGH_FRET_THRESHOLD = 12;
    const HIGH_FRET_PENALTY_FACTOR = 0.3;
    if (frets.length > 0) {
        frets.forEach(fret => {
            if (fret > HIGH_FRET_THRESHOLD) {
                cost += Math.pow(fret - HIGH_FRET_THRESHOLD, 2) * HIGH_FRET_PENALTY_FACTOR;
            }
        });
    }

    // --- Existing Penalties (adjusted) ---
    // 1. Penalize large fret spans in chords (difficult stretches)
    if (frets.length > 1) {
        cost += Math.pow(Math.max(...frets) - Math.min(...frets), 2) * 0.5;
    }

    // 2. Reward using open strings (easy to play)
    if (nextFingering.some(n => n.fret === 0)) {
        cost -= 2.0;
    }

    // 3. Penalize hand movement between notes/chords
    if (previousFingering && previousFingering.length > 0) {
        const prevFrets = previousFingering.map(n => n.fret).filter(f => f > 0);
        if (frets.length > 0 && prevFrets.length > 0) {
            const avgNextFret = frets.reduce((s, f) => s + f, 0) / frets.length;
            const avgPrevFret = prevFrets.reduce((s, f) => s + f, 0) / prevFrets.length;
            cost += Math.abs(avgNextFret - avgPrevFret) * 1.5; // Big jumps are costly
        }
        const avgNextString = nextFingering.reduce((s, n) => s + n.string, 0) / nextFingering.length;
        const avgPrevString = previousFingering.reduce((s, n) => s + n.string, 0) / previousFingering.length;
        cost += Math.abs(avgNextString - avgPrevString) * 0.2; // String jumps have a smaller cost
    }
    
    // 4. Small general penalty for overall fret position to break ties
    if (frets.length > 0) {
        cost += frets.reduce((s, f) => s + f, 0) / frets.length * 0.1;
    }

    return cost;
}

/**
 * Generates optimal tablature from MIDI note events using a Viterbi-like algorithm.
 * @public
 */
export function generateTablature(noteEvents: NoteEvent[], instrumentId: InstrumentID): TabEvent[] {
    if (!noteEvents || noteEvents.length === 0) return [];
    
    const instrumentConfig = getInstrument(instrumentId);
    const trellis: Note[][][] = [];
    const filteredNoteEvents: NoteEvent[] = [];

    for (const event of noteEvents) {
        // 1. Filter out notes that are completely outside the instrument's range.
        const notesWithPossiblePositions = event.notes
            .map(note => ({
                note,
                positions: findPossiblePositions(note.pitch, instrumentId)
            }))
            .filter(item => item.positions.length > 0);
            
        if (notesWithPossiblePositions.length === 0) {
            // None of the notes in this event are playable, so skip it.
            if (event.notes.length > 0) {
                 Logger.log(`Skipping event at time ${event.notes[0].startTime.toFixed(2)}s: No playable notes found for this event.`, 'TablatureGeneration');
            }
            continue;
        }

        if (notesWithPossiblePositions.length < event.notes.length) {
            Logger.log(`Simplified chord at time ${event.notes[0].startTime.toFixed(2)}s: Some notes were out of range.`, 'TablatureGeneration');
        }

        // 2. Check if the number of notes to play exceeds the number of strings.
        if (notesWithPossiblePositions.length > instrumentConfig.numStrings) {
            Logger.log(`Skipping event at time ${event.notes[0].startTime.toFixed(2)}s: Chord has more notes (${notesWithPossiblePositions.length}) than available strings (${instrumentConfig.numStrings}).`, 'TablatureGeneration');
            continue;
        }

        const playableNotes = notesWithPossiblePositions.map(item => item.note);
        const notePositions = notesWithPossiblePositions.map(item => item.positions);

        const allChordFingerings: Note[][] = [];

        function findCombinations(noteIndex: number, currentFingering: Note[], usedStrings: Set<number>) {
            if (noteIndex === playableNotes.length) {
                allChordFingerings.push(currentFingering);
                return;
            }
            
            if (!notePositions[noteIndex] || notePositions[noteIndex].length === 0) {
                return;
            }

            for (const pos of notePositions[noteIndex]) {
                if (!usedStrings.has(pos.string)) {
                    // Create the full Note object here
                    const newNote: Note = { ...playableNotes[noteIndex], ...pos, finger: 0 };
                    const newFingering = [...currentFingering, newNote];
                    const newUsedStrings = new Set(usedStrings).add(pos.string);
                    findCombinations(noteIndex + 1, newFingering, newUsedStrings);
                }
            }
        }

        findCombinations(0, [], new Set());

        if (allChordFingerings.length > 0) {
            const newEvent: NoteEvent = {
                notes: playableNotes,
                isChord: playableNotes.length > 1
            };
            trellis.push(allChordFingerings);
            filteredNoteEvents.push(newEvent);
        } else {
            if (event.notes.length > 0) {
                Logger.log(`Skipping unplayable event at time ${event.notes[0].startTime.toFixed(2)}s`, 'TablatureGeneration');
            }
        }
    }

    if (trellis.length === 0) {
        Logger.log("No playable notes found.", 'TablatureGeneration');
        return [];
    }

    const costs: number[][] = [trellis[0].map(fingering => calculateCost(null, fingering))];
    const backpointers: number[][] = [new Array(trellis[0].length).fill(0)];

    for (let t = 1; t < trellis.length; t++) {
        const currentCosts: number[] = [];
        const currentBackpointers: number[] = [];
        for (let i = 0; i < trellis[t].length; i++) {
            let minCost = Infinity, bestPrevNode = -1;
            const currentFingering = trellis[t][i];
            for (let j = 0; j < trellis[t - 1].length; j++) {
                const totalCost = costs[t - 1][j] + calculateCost(trellis[t - 1][j], currentFingering);
                if (totalCost < minCost) {
                    minCost = totalCost;
                    bestPrevNode = j;
                }
            }
            currentCosts.push(minCost);
            currentBackpointers.push(bestPrevNode);
        }
        costs.push(currentCosts);
        backpointers.push(currentBackpointers);
    }

    const optimalPathIndices: number[] = [];
    let lastLayerIndex = -1, minFinalCost = Infinity;
    const lastCosts = costs[costs.length - 1];
    for (let i = 0; i < lastCosts.length; i++) {
        if (lastCosts[i] < minFinalCost) {
            minFinalCost = lastCosts[i];
            lastLayerIndex = i;
        }
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

/**
 * Assigns logical fretting fingers to a generated tablature.
 * @public
 */
export function assignFingering(tablature: TabEvent[]): TabEvent[] {
    let handPosition = 1;
    return tablature.map(tabEvent => {
        const newNotes = tabEvent.notes.map(note => {
            if (note.finger !== undefined && note.finger !== null && note.finger !== 0) {
                if (note.fret > 0) {
                    handPosition = note.fret - note.finger + 1;
                }
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
