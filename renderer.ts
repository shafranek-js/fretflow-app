

import { state } from './state';
import * as InstrumentConfig from './config';
import { getMeasureDuration, findClosestNoteIndex } from './game';
import { FINGER_COLORS, FEEDBACK_COLORS, MINIMAP_HANDLE_W, MINIMAP_HANDLE_H } from './config';
import type { TabEvent, Note, NoteId } from './types';
import { cls } from './dom';

export const getPlayheadPx = () => state.ui.tabDisplay.clientWidth * 0.20;

export function getNeckGeometry() {
    const containerHeight = state.ui.tabDisplay.clientHeight;
    const neckHeight = (containerHeight * 0.8) * state.globalSettings.stringSpacing;
    const neckTopY = (containerHeight - neckHeight) / 2;
    return { neckTopY, neckHeight };
}

const makeStringTexture = (wound = false, ctx: CanvasRenderingContext2D) => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 4;
    const g = c.getContext('2d')!;
    if (wound) {
        g.fillStyle = '#9E8B55';
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = '#D4C28E';
        for (let x = 0; x < c.width; x += 4) g.fillRect(x, 0, 2, c.height);
    } else {
        const grad = g.createLinearGradient(0, 0, 0, c.height);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#d0d0d0');
        grad.addColorStop(1, '#8a8a8a');
        g.fillStyle = grad;
        g.fillRect(0, 0, c.width, c.height);
    }
    return ctx.createPattern(c, 'repeat')!;
};

const rebuildPatterns = () => {
    state.PLAIN_PATTERN = makeStringTexture(false, state.staticCtx!);
    state.WOUND_PATTERN = makeStringTexture(true, state.staticCtx!);
};

export const setupCanvas = () => {
    state.staticCanvas = state.ui.staticCanvas as HTMLCanvasElement;
    state.staticCtx = state.staticCanvas.getContext('2d')!;
    state.dynamicCanvas = state.ui.dynamicCanvas as HTMLCanvasElement;
    state.dynamicCtx = state.dynamicCanvas.getContext('2d')!;
    state.minimapCanvas = state.ui.minimapCanvas as HTMLCanvasElement;
    state.minimapCtx = state.minimapCanvas.getContext('2d')!;
    handleResize();
};

export const handleResize = () => {
    if (!state.dynamicCanvas || !state.staticCanvas || !state.minimapCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = state.ui.tabDisplay.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    state.staticCanvas.width = rect.width * dpr;
    state.staticCanvas.height = rect.height * dpr;
    state.staticCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.dynamicCanvas.width = rect.width * dpr;
    state.dynamicCanvas.height = rect.height * dpr;
    state.dynamicCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    const minimapRect = state.minimapCanvas.getBoundingClientRect();
    if (!minimapRect.width || !minimapRect.height) return;
    state.minimapCanvas.width = minimapRect.width * dpr;
    state.minimapCanvas.height = minimapRect.height * dpr;
    state.minimapCtx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildPatterns();
    if (state.ui.practice && !state.ui.practice.classList.contains('hidden')) {
        drawStaticLayer();
        drawDynamicLayer();
        renderMinimap();
    }
};

function drawNote(note: Note, noteId: NoteId, overrideY: number | null = null, precalculatedX: number, visualWidth: number) {
    if (!state.currentSongData) return;
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / InstrumentConfig.getInstrument(state.currentInstrument).numStrings;
    const noteHeight = 72 * state.globalSettings.noteSize;
    const baseWidth = noteHeight;
    const x = precalculatedX;
    const y = overrideY ?? (neckTopY + (note.string * stringHeight) + (stringHeight / 2));
    const isDraggedNote = state.draggedNoteIndex && state.draggedNoteIndex.eventIndex === noteId.eventIndex && state.draggedNoteIndex.noteIndex === noteId.noteIndex;
    const isSelectedNote = state.selectedNoteIndex && state.selectedNoteIndex.eventIndex === noteId.eventIndex && state.selectedNoteIndex.noteIndex === noteId.noteIndex;

    const inLoop = state.loopEndTime == null || (note.startTime >= state.loopStartTime && note.startTime < state.loopEndTime);
    const isOutsideLoop = !state.isEditMode && !inLoop;

    if (isOutsideLoop) {
        state.dynamicCtx!.globalAlpha = 0.4;
        state.dynamicCtx!.fillStyle = '#6b7280';
    } else if (note.feedback && ['perfect', 'good', 'okay', 'late', 'early'].includes(note.feedback)) {
        state.dynamicCtx!.globalAlpha = 1.0;
        state.dynamicCtx!.fillStyle = FEEDBACK_COLORS.good;
    } else {
        state.dynamicCtx!.globalAlpha = (note.feedback === 'missed' || note.feedback === 'wrong') ? 0.5 : (isDraggedNote ? 0.3 : 1.0);
        state.dynamicCtx!.fillStyle = FINGER_COLORS[note.finger || 0];
    }

    state.dynamicCtx!.beginPath();
    (state.dynamicCtx as any).roundRect(x, y - noteHeight / 2, visualWidth, noteHeight, noteHeight / 2);
    state.dynamicCtx!.fill();

    if (isSelectedNote) {
        state.dynamicCtx!.strokeStyle = '#3b82f6';
        state.dynamicCtx!.lineWidth = 3;
        state.dynamicCtx!.stroke();
    } else if (note.feedback === 'wrong' || note.feedback === 'missed') {
        state.dynamicCtx!.strokeStyle = FEEDBACK_COLORS.wrong;
        state.dynamicCtx!.lineWidth = 4;
        state.dynamicCtx!.stroke();
    }

    if (!isOutsideLoop && note.impactTime && (performance.now() - note.impactTime < 150)) {
        const flashProgress = (performance.now() - note.impactTime) / 150;
        state.dynamicCtx!.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - flashProgress)})`;
        state.dynamicCtx!.fill();
    }

    state.dynamicCtx!.globalAlpha = isOutsideLoop ? 0.6 : (isDraggedNote ? 0.5 : 1.0);
    state.dynamicCtx!.fillStyle = 'white';
    state.dynamicCtx!.shadowColor = 'rgba(0, 0, 0, 0.9)';
    state.dynamicCtx!.shadowBlur = 4;
    state.dynamicCtx!.shadowOffsetX = 0;
    state.dynamicCtx!.shadowOffsetY = 0;
    state.dynamicCtx!.font = `700 ${33 * state.globalSettings.noteSize}px Inter`;
    state.dynamicCtx!.textAlign = 'center';
    state.dynamicCtx!.textBaseline = 'middle';

    const fretToDisplay = note.fret;
    state.dynamicCtx!.fillText(String(fretToDisplay), x + baseWidth / 2, y + 1);
    state.dynamicCtx!.shadowColor = 'transparent';
    state.dynamicCtx!.shadowBlur = 0;
    state.dynamicCtx!.globalAlpha = 1.0;
}

function drawTabEvent(tabEvent: TabEvent, index: number, overrideY: number | null, x: number, visualWidth: number) {
    if (!state.currentSongData) return;
    const noteHeight = 72 * state.globalSettings.noteSize;
    const baseWidth = noteHeight;

    if (tabEvent.isChord && tabEvent.notes.length > 1) {
        const { neckTopY, neckHeight } = getNeckGeometry();
        const stringHeight = neckHeight / InstrumentConfig.getInstrument(state.currentInstrument).numStrings;
        const topNote = tabEvent.notes.reduce((min, n) => n.string < min.string ? n : min, tabEvent.notes[0]);
        const bottomNote = tabEvent.notes.reduce((max, n) => n.string > max.string ? n : max, tabEvent.notes[0]);
        const topY = neckTopY + (topNote.string * stringHeight) + (stringHeight / 2);
        const bottomY = neckTopY + (bottomNote.string * stringHeight) + (stringHeight / 2);

        state.dynamicCtx!.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        state.dynamicCtx!.lineWidth = 2;
        state.dynamicCtx!.beginPath();
        state.dynamicCtx!.moveTo(x + baseWidth / 2, topY);
        state.dynamicCtx!.lineTo(x + baseWidth / 2, bottomY);
        state.dynamicCtx!.stroke();
    }

    tabEvent.notes.forEach((note, noteIndex) => {
        const isDraggedNote = state.isDragging && state.draggedNoteIndex && state.draggedNoteIndex.eventIndex === index && state.draggedNoteIndex.noteIndex === noteIndex;
        drawNote(note, { eventIndex: index, noteIndex: noteIndex }, isDraggedNote ? overrideY : null, x, visualWidth);
    });
}

function drawPlayhead() {
    if (!state.currentSongData || !state.currentSongData.tablature || state.currentSongData.tablature.length === 0) return;
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / InstrumentConfig.getInstrument(state.currentInstrument).numStrings;
    const playheadX = getPlayheadPx();
    const currentTabEvent = state.currentSongData.tablature[state.currentNoteIndex];
    const nextTabEvent = state.currentSongData.tablature[state.currentNoteIndex + 1];
    if (!currentTabEvent) return;
    const getEventY = (tabEvent: TabEvent) => {
        const avgString = tabEvent.notes.reduce((sum, note) => sum + note.string, 0) / tabEvent.notes.length;
        return neckTopY + (avgString * stringHeight) + (stringHeight / 2);
    };
    if (state.isPlaying && nextTabEvent) {
        const timeSinceCurrentNote = state.songTime - currentTabEvent.notes[0].startTime;
        const timeBetweenNotes = nextTabEvent.notes[0].startTime - currentTabEvent.notes[0].startTime;
        if (timeBetweenNotes > 0) {
            const progress = Math.max(0, Math.min(1, timeSinceCurrentNote / timeBetweenNotes));
            const startY = getEventY(currentTabEvent);
            const endY = getEventY(nextTabEvent);
            const arcHeight = 30 + (currentTabEvent.notes[0].duration * 40);
            state.playheadY = startY + (endY - startY) * progress - (4 * arcHeight * progress * (1 - progress));
        } else {
            state.playheadY = getEventY(currentTabEvent);
        }
    } else {
        state.playheadY = getEventY(currentTabEvent);
    }
    state.dynamicCtx!.fillStyle = 'white';
    state.dynamicCtx!.shadowColor = 'rgba(255, 255, 255, 0.7)';
    state.dynamicCtx!.shadowBlur = 10;
    state.dynamicCtx!.beginPath();
    state.dynamicCtx!.arc(playheadX, state.playheadY, 18 * state.globalSettings.noteSize, 0, Math.PI * 2);
    state.dynamicCtx!.fill();
    state.dynamicCtx!.shadowColor = 'transparent';
    state.dynamicCtx!.shadowBlur = 0;
}

function drawPredictionArc() {
    if (!state.currentSongData || !state.currentSongData.tablature || state.currentSongData.tablature.length < 2) return;
    
    const tabData = state.currentSongData.tablature;
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / InstrumentConfig.getInstrument(state.currentInstrument).numStrings;
    const playheadX = getPlayheadPx();
    const pixelsPerSecond = state.currentSongData.pixelsPerSecond;
    const scrollPx = state.currentScrollX;
    const containerWidth = state.ui.tabDisplay.clientWidth;

    const getEventY = (tabEvent: TabEvent) => {
        const avgString = tabEvent.notes.reduce((sum, note) => sum + note.string, 0) / tabEvent.notes.length;
        return neckTopY + (avgString * stringHeight) + (stringHeight / 2);
    };
    
    const viewStartTime = (scrollPx - playheadX) / pixelsPerSecond;
    let startIndex = findClosestNoteIndex(viewStartTime);
    startIndex = Math.max(0, startIndex - 2); // Start a bit earlier to catch incoming arcs

    for (let i = startIndex; i < tabData.length - 1; i++) {
        const eventA = tabData[i];
        const eventB = tabData[i + 1];
        const xA = playheadX + (eventA.notes[0].startTime * pixelsPerSecond) - scrollPx;
        
        if (xA > containerWidth + 50) break; // Arc starts off-screen right

        const xB = playheadX + (eventB.notes[0].startTime * pixelsPerSecond) - scrollPx;
        if (xB < -50) continue; // Arc ends off-screen left

        const yA = getEventY(eventA);
        const yB = getEventY(eventB);

        state.dynamicCtx!.save();
        state.dynamicCtx!.beginPath();
        state.dynamicCtx!.moveTo(xA, yA);
        const controlX = (xA + xB) / 2;
        const arcHeight = 30 + (eventA.notes[0].duration * 40);
        const controlY = Math.min(yA, yB) - arcHeight;
        state.dynamicCtx!.quadraticCurveTo(controlX, controlY, xB, yB);
        const gradient = state.dynamicCtx!.createLinearGradient(xA, 0, xB, 0);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        state.dynamicCtx!.setLineDash([3, 5]);
        state.dynamicCtx!.strokeStyle = gradient;
        state.dynamicCtx!.lineWidth = 2;
        state.dynamicCtx!.stroke();
        state.dynamicCtx!.restore();
    }
}

export function drawStaticLayer() {
    if (!state.staticCtx) return;
    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    const containerWidth = state.ui.tabDisplay.clientWidth;
    const containerHeight = state.ui.tabDisplay.clientHeight;
    state.staticCtx.clearRect(0, 0, state.staticCanvas!.width, state.staticCanvas!.height);
    const { neckTopY, neckHeight } = getNeckGeometry();
    const stringHeight = neckHeight / config.numStrings;
    const skyGradient = state.staticCtx.createLinearGradient(0, 0, 0, neckTopY);
    skyGradient.addColorStop(0, '#111827');
    skyGradient.addColorStop(1, '#1f2937');
    state.staticCtx.fillStyle = skyGradient;
    state.staticCtx.fillRect(0, 0, containerWidth, neckTopY);
    state.staticCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    state.stars.forEach(star => {
        state.staticCtx!.beginPath();
        state.staticCtx!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        state.staticCtx!.fill();
    });
    state.staticCtx.fillStyle = '#374151';
    state.staticCtx.fillRect(0, neckTopY, containerWidth, neckHeight);
    for (let i = 0; i < config.numStrings; i++) {
        const y = neckTopY + (i * stringHeight) + (stringHeight / 2);
        const thickness = (config.stringGauges[i] || 1.5) * state.globalSettings.stringThickness;
        const isWound = config.woundStringIndices.includes(i);
        const pattern = isWound ? state.WOUND_PATTERN! : state.PLAIN_PATTERN!;
        if (pattern && (pattern as any).setTransform) {
            (pattern as any).setTransform(new DOMMatrix().scaleSelf(1, thickness / 2));
        }
        state.staticCtx.save();
        state.staticCtx.fillStyle = pattern;
        state.staticCtx.shadowColor = 'rgba(0,0,0,0.35)';
        state.staticCtx.shadowBlur = 1.5;
        state.staticCtx.fillRect(0, y - thickness / 2, containerWidth, thickness);
        state.staticCtx.restore();
    }
}

export function drawDynamicLayer(timestamp = 0) {
    if (!state.dynamicCtx || !state.currentSongData) return;
    const {
        tablature: tabData = [],
        pixelsPerSecond,
        totalDuration,
        minDuration
    } = state.currentSongData;
    
    const containerWidth = state.ui.tabDisplay.clientWidth;
    state.dynamicCtx.clearRect(0, 0, state.dynamicCanvas!.width, state.dynamicCanvas!.height);
    
    if (tabData.length === 0) {
        drawPlayhead();
        return;
    }

    const playheadPx = getPlayheadPx();
    const scrollPx = state.currentScrollX;
    const { neckTopY, neckHeight } = getNeckGeometry();
    const viewStartTime = (scrollPx - playheadPx) / pixelsPerSecond;

    // --- Optimized Measure Line Drawing ---
    const measureDurationInSeconds = getMeasureDuration();
    if (measureDurationInSeconds > 0) {
        const firstMeasureTime = Math.max(measureDurationInSeconds, Math.ceil(viewStartTime / measureDurationInSeconds) * measureDurationInSeconds);
        for (let t = firstMeasureTime; t < totalDuration + measureDurationInSeconds * 2; t += measureDurationInSeconds) {
            const x = playheadPx + (t * pixelsPerSecond) - scrollPx;
            if (x > containerWidth + 50) break;
            if (x > -50) {
                state.dynamicCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                state.dynamicCtx.fillRect(x, neckTopY, 1, neckHeight);
            }
        }
    }
    
    drawPredictionArc();

    // --- Optimized Note Drawing ---
    let startIndex = findClosestNoteIndex(viewStartTime);
    startIndex = Math.max(0, startIndex - 2); // Start a bit earlier to catch long notes

    for (let i = startIndex; i < tabData.length; i++) {
        const tabEvent = tabData[i];
        const firstNote = tabEvent.notes[0];
        const x = playheadPx + (firstNote.startTime * pixelsPerSecond) - scrollPx;

        if (x > containerWidth + 50) break;

        const noteHeight = 72 * state.globalSettings.noteSize;
        const baseWidth = noteHeight;
        const extraWidth = (firstNote.duration - minDuration) * pixelsPerSecond;
        const visualWidth = baseWidth + Math.max(0, extraWidth);

        if (x + visualWidth > -50) {
            let overrideY = null;
            if (state.mousePosition && state.isDragging && state.draggedNoteIndex?.eventIndex === i) {
                const rect = state.ui.dynamicCanvas.getBoundingClientRect();
                overrideY = state.mousePosition.y - rect.top;
            }
            drawTabEvent(tabEvent, i, overrideY, x, visualWidth);
        }
    }

    drawPlayhead();
}


export function renderMinimap() {
    if (!state.minimapCtx || !state.currentSongData || !state.currentSongData.tablature) return;
    const { width, height } = state.minimapCanvas!;
    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = width / dpr;
    const canvasHeight = height / dpr;
    state.minimapCtx.clearRect(0, 0, width, height);
    state.minimapCtx.fillStyle = '#111827';
    state.minimapCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    const tabData = state.currentSongData.tablature;
    const totalDuration = state.currentSongData.totalDuration;
    const config = InstrumentConfig.getInstrument(state.currentInstrument);
    const progressX = (state.songTime / totalDuration) * canvasWidth;
    state.minimapCtx.fillStyle = 'rgba(22, 101, 52, 0.5)';
    state.minimapCtx.fillRect(0, 0, progressX, canvasHeight);
    tabData.forEach(tabEvent => {
        tabEvent.notes.forEach(note => {
            const x = (note.startTime / totalDuration) * canvasWidth;
            const w = (note.duration / totalDuration) * canvasWidth;
            const y = ((note.string + 0.5) / config.numStrings) * canvasHeight;
            if (note.feedback && ['perfect', 'good', 'okay', 'late', 'early'].includes(note.feedback)) {
                state.minimapCtx!.fillStyle = FEEDBACK_COLORS.perfect;
            } else if (note.feedback === 'wrong' || note.feedback === 'missed') {
                state.minimapCtx!.fillStyle = FEEDBACK_COLORS.wrong;
            } else {
                state.minimapCtx!.fillStyle = FINGER_COLORS[note.finger || 0];
            }
            state.minimapCtx!.fillRect(x, y - 3, Math.max(2, w), 6);
        });
    });

    // In performance mode or edit mode, don't show the loop controls
    if (state.currentMode !== 'performance' && !state.isEditMode) {
        const loopStartX = (state.loopStartTime / totalDuration) * canvasWidth;
        const loopEndX = (state.loopEndTime !== null ? state.loopEndTime / totalDuration : 1) * canvasWidth;

        state.minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        state.minimapCtx.fillRect(0, 0, loopStartX, canvasHeight);
        if (state.loopEndTime !== null) {
            state.minimapCtx.fillRect(loopEndX, 0, canvasWidth - loopEndX, canvasHeight);
        }
        
        const hx = MINIMAP_HANDLE_W / 2;
        const safeStartX = Math.max(hx, Math.min(loopStartX, canvasWidth - hx));
        const safeEndX = Math.max(hx, Math.min(loopEndX, canvasWidth - hx));

        state.minimapCtx.fillStyle = '#facc15';
        state.minimapCtx.fillRect(safeStartX - 1, 0, 2, canvasHeight);
        state.minimapCtx.fillRect(safeEndX - 1, 0, 2, canvasHeight);

        state.minimapCtx.fillStyle = 'white';
        state.minimapCtx.fillRect(safeStartX - hx, 0, MINIMAP_HANDLE_W, MINIMAP_HANDLE_H);
        state.minimapCtx.fillRect(safeStartX - hx, canvasHeight - MINIMAP_HANDLE_H, MINIMAP_HANDLE_W, MINIMAP_HANDLE_H);
        state.minimapCtx.fillRect(safeEndX - hx, 0, MINIMAP_HANDLE_W, MINIMAP_HANDLE_H);
        state.minimapCtx.fillRect(safeEndX - hx, canvasHeight - MINIMAP_HANDLE_H, MINIMAP_HANDLE_W, MINIMAP_HANDLE_H);
    }

    state.minimapCtx.fillStyle = 'white';
    state.minimapCtx.shadowColor = 'rgba(255, 255, 255, 0.7)';
    state.minimapCtx.shadowBlur = 18;
    state.minimapCtx.beginPath();
    state.minimapCtx.arc(progressX, canvasHeight / 2, 15, 0, Math.PI * 2);
    state.minimapCtx.fill();
    state.minimapCtx.shadowColor = 'transparent';
    state.minimapCtx.shadowBlur = 0;
}