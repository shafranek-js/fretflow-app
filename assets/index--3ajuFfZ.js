import{GoogleGenAI as _t}from"@google/genai";(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))o(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&o(a)}).observe(document,{childList:!0,subtree:!0});function i(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function o(r){if(r.ep)return;r.ep=!0;const s=i(r);fetch(r.href,s)}})();const t={currentInstrument:"guitar",songs:[],currentSongData:null,isPlaying:!1,isPaused:!1,isEditMode:!1,isTunerActive:!1,isScrubbingMinimap:!1,isAudioInitialized:!1,animationFrameId:null,pitchDetectionFrameId:null,songTime:0,lastTimestamp:0,currentScrollX:0,currentNoteIndex:0,loopStartTime:0,loopEndTime:null,dragMode:null,gameState:{score:0,perfectNotes:0,attemptedNotes:0,streak:0,multiplier:1},originalTablature:[],editedTablature:[],editHistory:[],historyIndex:-1,pendingEdits:!1,isDragging:!1,wasDragged:!1,draggedNoteIndex:null,selectedNoteIndex:null,hoveredNoteIndex:null,transposeOffset:0,zoomLevel:1,globalSettings:{noteSize:1,stringSpacing:1,stringThickness:1},audioContext:null,analyser:null,micStream:null,synthMasterGain:null,pitchDetectionBuffer:null,fftData:null,activeOscillators:[],currentDetectedMidi:null,currentDetectedFrequency:null,hmmState:null,staticCanvas:null,staticCtx:null,dynamicCanvas:null,dynamicCtx:null,minimapCanvas:null,minimapCtx:null,PLAIN_PATTERN:null,WOUND_PATTERN:null,stars:[],playheadY:0,ui:{}};function Rt(){t.gameState={score:0,perfectNotes:0,attemptedNotes:0,streak:0,multiplier:1}}const J=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"],U=n=>440*Math.pow(2,(n-69)/12),Mt=n=>n>0?12*Math.log2(n/440)+69:null;function Ot(n){if(!n||n<=0)return null;const e=12*(Math.log(n/440)/Math.log(2)),i=Math.round(e)+69,o=U(i);return{noteName:J[i%12],octave:Math.floor(i/12)-1,frequency:n,cents:1200*Math.log2(n/o)}}function Gt(n){const e=Math.floor(n/12)-1;return`${J[n%12]}${e}`}const ct={guitar:{name:"Guitar",numStrings:6,numFrets:22,tuning:[64,59,55,50,45,40],stringGauges:[4,5,6,7,8,9],woundStringIndices:[3,4,5]},ukulele:{name:"Ukulele",numStrings:4,numFrets:15,tuning:[69,64,60,67],stringGauges:[4,5.2,6.4,4.4],woundStringIndices:[]}},T=n=>ct[n],O={BUFFER_SIZE:4096,RMS_THRESHOLD:.01,YIN_THRESHOLD:.1,IN_TUNE_CENTS_THRESHOLD:10},R=20,lt=100,K=20,ut=Math.ceil((lt-R)*100/K),D=ut+1,X=ut,dt={0:"#9ca3af",1:"#f59e0b",2:"#a855f7",3:"#0ea5e9",4:"#ef4444"},G={perfect:"#4ade80",good:"#4ade80",wrong:"#f87171",missed:"#f87171"},A=16,w=12,$t=4,$=.04,zt=Object.freeze(Object.defineProperty({__proto__:null,FADE_TIME:$,FEEDBACK_COLORS:G,FINGER_COLORS:dt,HMM_CENTS_PER_BIN:K,HMM_NUM_PITCH_BINS:ut,HMM_NUM_STATES:D,HMM_PITCH_MAX_MIDI:lt,HMM_PITCH_MIN_MIDI:R,HMM_UNVOICED_STATE_INDEX:X,INSTRUMENT_CONFIG:ct,MINIMAP_HANDLE_H:w,MINIMAP_HANDLE_W:A,MINIMAP_HIT_PAD:$t,PITCH_DETECTION_CONFIG:O,getInstrument:T},Symbol.toStringTag,{value:"Module"})),Y=()=>t.ui.tabDisplay.clientWidth*.2;function M(){const n=t.ui.tabDisplay.clientHeight,e=n*.8*t.globalSettings.stringSpacing;return{neckTopY:(n-e)/2,neckHeight:e}}const bt=(n=!1,e)=>{const i=document.createElement("canvas");i.width=32,i.height=4;const o=i.getContext("2d");if(n){o.fillStyle="#9E8B55",o.fillRect(0,0,i.width,i.height),o.fillStyle="#D4C28E";for(let r=0;r<i.width;r+=4)o.fillRect(r,0,2,i.height)}else{const r=o.createLinearGradient(0,0,0,i.height);r.addColorStop(0,"#ffffff"),r.addColorStop(.5,"#d0d0d0"),r.addColorStop(1,"#8a8a8a"),o.fillStyle=r,o.fillRect(0,0,i.width,i.height)}return e.createPattern(i,"repeat")},Wt=()=>{t.PLAIN_PATTERN=bt(!1,t.staticCtx),t.WOUND_PATTERN=bt(!0,t.staticCtx)},Ut=()=>{t.staticCanvas=t.ui.staticCanvas,t.staticCtx=t.staticCanvas.getContext("2d"),t.dynamicCanvas=t.ui.dynamicCanvas,t.dynamicCtx=t.dynamicCanvas.getContext("2d"),t.minimapCanvas=t.ui.minimapCanvas,t.minimapCtx=t.minimapCanvas.getContext("2d"),gt()},gt=()=>{if(!t.dynamicCanvas||!t.staticCanvas||!t.minimapCanvas)return;const n=window.devicePixelRatio||1,e=t.ui.tabDisplay.getBoundingClientRect();if(!e.width||!e.height)return;t.staticCanvas.width=e.width*n,t.staticCanvas.height=e.height*n,t.staticCtx.setTransform(n,0,0,n,0,0),t.dynamicCanvas.width=e.width*n,t.dynamicCanvas.height=e.height*n,t.dynamicCtx.setTransform(n,0,0,n,0,0);const i=t.minimapCanvas.getBoundingClientRect();!i.width||!i.height||(t.minimapCanvas.width=i.width*n,t.minimapCanvas.height=i.height*n,t.minimapCtx.setTransform(n,0,0,n,0,0),Wt(),t.ui.practice&&!t.ui.practice.classList.contains("hidden")&&(nt(),I(),B()))};function Yt(n,e,i=null,o,r){if(!t.currentSongData)return;const{neckTopY:s,neckHeight:a}=M(),c=a/T(t.currentInstrument).numStrings,l=72*t.globalSettings.noteSize,g=l,p=o,d=i??s+n.string*c+c/2,m=t.draggedNoteIndex&&t.draggedNoteIndex.eventIndex===e.eventIndex&&t.draggedNoteIndex.noteIndex===e.noteIndex,y=t.selectedNoteIndex&&t.selectedNoteIndex.eventIndex===e.eventIndex&&t.selectedNoteIndex.noteIndex===e.noteIndex,x=t.loopEndTime==null||n.startTime>=t.loopStartTime&&n.startTime<t.loopEndTime,S=!t.isEditMode&&!x;if(S?(t.dynamicCtx.globalAlpha=.4,t.dynamicCtx.fillStyle="#6b7280"):n.feedback&&["perfect","good","okay","late","early"].includes(n.feedback)?(t.dynamicCtx.globalAlpha=1,t.dynamicCtx.fillStyle=G.good):(t.dynamicCtx.globalAlpha=n.feedback==="missed"||n.feedback==="wrong"?.5:m?.3:1,t.dynamicCtx.fillStyle=dt[n.finger||0]),t.dynamicCtx.beginPath(),t.dynamicCtx.roundRect(p,d-l/2,r,l,l/2),t.dynamicCtx.fill(),y?(t.dynamicCtx.strokeStyle="#3b82f6",t.dynamicCtx.lineWidth=3,t.dynamicCtx.stroke()):(n.feedback==="wrong"||n.feedback==="missed")&&(t.dynamicCtx.strokeStyle=G.wrong,t.dynamicCtx.lineWidth=4,t.dynamicCtx.stroke()),!S&&n.impactTime&&performance.now()-n.impactTime<150){const C=(performance.now()-n.impactTime)/150;t.dynamicCtx.fillStyle=`rgba(255, 255, 255, ${.7*(1-C)})`,t.dynamicCtx.fill()}t.dynamicCtx.globalAlpha=S?.6:m?.5:1,t.dynamicCtx.fillStyle="white",t.dynamicCtx.shadowColor="rgba(0, 0, 0, 0.9)",t.dynamicCtx.shadowBlur=4,t.dynamicCtx.shadowOffsetX=0,t.dynamicCtx.shadowOffsetY=0,t.dynamicCtx.font=`700 ${33*t.globalSettings.noteSize}px Inter`,t.dynamicCtx.textAlign="center",t.dynamicCtx.textBaseline="middle";const b=t.isEditMode?n.fret:n.fret+t.transposeOffset;t.dynamicCtx.fillText(String(b),p+g/2,d+1),t.dynamicCtx.shadowColor="transparent",t.dynamicCtx.shadowBlur=0,t.dynamicCtx.globalAlpha=1}function Vt(n,e,i,o,r){if(!t.currentSongData)return;const a=72*t.globalSettings.noteSize;if(n.isChord&&n.notes.length>1){const{neckTopY:c,neckHeight:l}=M(),g=l/T(t.currentInstrument).numStrings,p=n.notes.reduce((x,S)=>S.string<x.string?S:x,n.notes[0]),d=n.notes.reduce((x,S)=>S.string>x.string?S:x,n.notes[0]),m=c+p.string*g+g/2,y=c+d.string*g+g/2;t.dynamicCtx.strokeStyle="rgba(255, 255, 255, 0.2)",t.dynamicCtx.lineWidth=2,t.dynamicCtx.beginPath(),t.dynamicCtx.moveTo(o+a/2,m),t.dynamicCtx.lineTo(o+a/2,y),t.dynamicCtx.stroke()}n.notes.forEach((c,l)=>{const g=t.isDragging&&t.draggedNoteIndex&&t.draggedNoteIndex.eventIndex===e&&t.draggedNoteIndex.noteIndex===l;Yt(c,{eventIndex:e,noteIndex:l},g?i:null,o,r)})}function Ct(){if(!t.currentSongData||!t.currentSongData.tablature||t.currentSongData.tablature.length===0)return;const{neckTopY:n,neckHeight:e}=M(),i=e/T(t.currentInstrument).numStrings,o=Y(),r=t.currentSongData.tablature[t.currentNoteIndex],s=t.currentSongData.tablature[t.currentNoteIndex+1];if(!r)return;const a=c=>{const l=c.notes.reduce((g,p)=>g+p.string,0)/c.notes.length;return n+l*i+i/2};if(t.isPlaying&&s){const c=t.songTime-r.notes[0].startTime,l=s.notes[0].startTime-r.notes[0].startTime;if(l>0){const g=Math.max(0,Math.min(1,c/l)),p=a(r),d=a(s),m=30+r.notes[0].duration*40;t.playheadY=p+(d-p)*g-4*m*g*(1-g)}else t.playheadY=a(r)}else t.playheadY=a(r);t.dynamicCtx.fillStyle="white",t.dynamicCtx.shadowColor="rgba(255, 255, 255, 0.7)",t.dynamicCtx.shadowBlur=10,t.dynamicCtx.beginPath(),t.dynamicCtx.arc(o,t.playheadY,18*t.globalSettings.noteSize,0,Math.PI*2),t.dynamicCtx.fill(),t.dynamicCtx.shadowColor="transparent",t.dynamicCtx.shadowBlur=0}function jt(){if(!t.currentSongData||!t.currentSongData.tablature||t.currentSongData.tablature.length<2)return;const n=t.currentSongData.tablature,{neckTopY:e,neckHeight:i}=M(),o=i/T(t.currentInstrument).numStrings,r=Y(),s=t.currentSongData.pixelsPerSecond,a=t.currentScrollX,c=t.ui.tabDisplay.clientWidth,l=d=>{const m=d.notes.reduce((y,x)=>y+x.string,0)/d.notes.length;return e+m*o+o/2},g=(a-r)/s;let p=V(g);p=Math.max(0,p-2);for(let d=p;d<n.length-1;d++){const m=n[d],y=n[d+1],x=r+m.notes[0].startTime*s-a;if(x>c+50)break;const S=r+y.notes[0].startTime*s-a;if(S<-50)continue;const b=l(m),C=l(y);t.dynamicCtx.save(),t.dynamicCtx.beginPath(),t.dynamicCtx.moveTo(x,b);const N=(x+S)/2,P=30+m.notes[0].duration*40,H=Math.min(b,C)-P;t.dynamicCtx.quadraticCurveTo(N,H,S,C);const F=t.dynamicCtx.createLinearGradient(x,0,S,0);F.addColorStop(0,"rgba(255, 255, 255, 0)"),F.addColorStop(.5,"rgba(255, 255, 255, 0.5)"),F.addColorStop(1,"rgba(255, 255, 255, 0)"),t.dynamicCtx.setLineDash([3,5]),t.dynamicCtx.strokeStyle=F,t.dynamicCtx.lineWidth=2,t.dynamicCtx.stroke(),t.dynamicCtx.restore()}}function nt(){if(!t.staticCtx)return;const n=T(t.currentInstrument),e=t.ui.tabDisplay.clientWidth;t.ui.tabDisplay.clientHeight,t.staticCtx.clearRect(0,0,t.staticCanvas.width,t.staticCanvas.height);const{neckTopY:i,neckHeight:o}=M(),r=o/n.numStrings,s=t.staticCtx.createLinearGradient(0,0,0,i);s.addColorStop(0,"#111827"),s.addColorStop(1,"#1f2937"),t.staticCtx.fillStyle=s,t.staticCtx.fillRect(0,0,e,i),t.staticCtx.fillStyle="rgba(255, 255, 255, 0.4)",t.stars.forEach(a=>{t.staticCtx.beginPath(),t.staticCtx.arc(a.x,a.y,a.r,0,Math.PI*2),t.staticCtx.fill()}),t.staticCtx.fillStyle="#374151",t.staticCtx.fillRect(0,i,e,o);for(let a=0;a<n.numStrings;a++){const c=i+a*r+r/2,l=(n.stringGauges[a]||1.5)*t.globalSettings.stringThickness,p=n.woundStringIndices.includes(a)?t.WOUND_PATTERN:t.PLAIN_PATTERN;p&&p.setTransform&&p.setTransform(new DOMMatrix().scaleSelf(1,l/2)),t.staticCtx.save(),t.staticCtx.fillStyle=p,t.staticCtx.shadowColor="rgba(0,0,0,0.35)",t.staticCtx.shadowBlur=1.5,t.staticCtx.fillRect(0,c-l/2,e,l),t.staticCtx.restore()}}function I(n=0,e=null){var x;if(!t.dynamicCtx||!t.currentSongData)return;const{tablature:i=[],pixelsPerSecond:o,totalDuration:r,minDuration:s}=t.currentSongData,a=t.ui.tabDisplay.clientWidth;if(t.dynamicCtx.clearRect(0,0,t.dynamicCanvas.width,t.dynamicCanvas.height),i.length===0){Ct();return}const c=Y(),l=t.currentScrollX,{neckTopY:g,neckHeight:p}=M(),d=(l-c)/o,m=ht();if(m>0){const S=Math.max(m,Math.ceil(d/m)*m);for(let b=S;b<r+m*2;b+=m){const C=c+b*o-l;if(C>a+50)break;C>-50&&(t.dynamicCtx.fillStyle="rgba(255, 255, 255, 0.2)",t.dynamicCtx.fillRect(C,g,1,p))}}jt();let y=V(d);y=Math.max(0,y-2);for(let S=y;S<i.length;S++){const b=i[S],C=b.notes[0],N=c+C.startTime*o-l;if(N>a+50)break;const H=72*t.globalSettings.noteSize,F=(C.duration-s)*o,yt=H+Math.max(0,F);if(N+yt>-50){let xt=null;if(e&&t.isDragging&&((x=t.draggedNoteIndex)==null?void 0:x.eventIndex)===S){const Ht=t.ui.dynamicCanvas.getBoundingClientRect();xt=e.clientY-Ht.top}Vt(b,S,xt,N,yt)}}Ct()}function B(){if(!t.minimapCtx||!t.currentSongData||!t.currentSongData.tablature)return;const{width:n,height:e}=t.minimapCanvas,i=window.devicePixelRatio||1,o=n/i,r=e/i;t.minimapCtx.clearRect(0,0,n,e),t.minimapCtx.fillStyle="#111827",t.minimapCtx.fillRect(0,0,o,r);const s=t.currentSongData.tablature,a=t.currentSongData.totalDuration,c=T(t.currentInstrument),l=t.songTime/a*o;t.minimapCtx.fillStyle="rgba(22, 101, 52, 0.5)",t.minimapCtx.fillRect(0,0,l,r),s.forEach(S=>{S.notes.forEach(b=>{const C=b.startTime/a*o,N=b.duration/a*o,P=(b.string+.5)/c.numStrings*r;b.feedback==="perfect"||b.feedback==="good"?t.minimapCtx.fillStyle=G.perfect:b.feedback==="wrong"||b.feedback==="missed"?t.minimapCtx.fillStyle=G.wrong:t.minimapCtx.fillStyle=dt[b.finger||0],t.minimapCtx.fillRect(C,P-3,Math.max(2,N),6)})});const g=t.loopStartTime/a*o,p=(t.loopEndTime!==null?t.loopEndTime/a:1)*o;t.minimapCtx.fillStyle="rgba(0, 0, 0, 0.5)",t.minimapCtx.fillRect(0,0,g,r),t.loopEndTime!==null&&t.minimapCtx.fillRect(p,0,o-p,r);const d=t.loopEndTime!==null&&t.loopEndTime<a&&t.loopEndTime-t.loopStartTime>.1;t.ui.getAiAdviceBtn.disabled=!d;const m=A/2,y=Math.max(m,Math.min(g,o-m)),x=Math.max(m,Math.min(p,o-m));t.minimapCtx.fillStyle="#facc15",t.minimapCtx.fillRect(y-1,0,2,r),t.minimapCtx.fillRect(x-1,0,2,r),t.minimapCtx.fillStyle="white",t.minimapCtx.fillRect(y-m,0,A,w),t.minimapCtx.fillRect(y-m,r-w,A,w),t.minimapCtx.fillRect(x-m,0,A,w),t.minimapCtx.fillRect(x-m,r-w,A,w),t.minimapCtx.fillStyle="white",t.minimapCtx.shadowColor="rgba(255, 255, 255, 0.7)",t.minimapCtx.shadowBlur=18,t.minimapCtx.beginPath(),t.minimapCtx.arc(l,r/2,15,0,Math.PI*2),t.minimapCtx.fill(),t.minimapCtx.shadowColor="transparent",t.minimapCtx.shadowBlur=0}function qt(n,e="General"){console.error(`[${e}]`,n)}const v={log:qt},u=(n,e=document)=>e.querySelector(n),it=(n,e=document)=>[...e.querySelectorAll(n)],f=(n,e,i,o)=>n.addEventListener(e,i,o),h=(n,e)=>{Object.entries(e).forEach(([i,o])=>n.classList.toggle(i,o))},mt=(n,e)=>{let i=0;return(...o)=>{const r=performance.now();r-i>e&&(i=r,n(...o))}};async function Nt(n=!1){if(t.isAudioInitialized&&t.audioContext&&t.audioContext.state==="running"){n&&!t.pitchDetectionFrameId&&ot();return}t.audioContext&&t.audioContext.state==="suspended"&&await t.audioContext.resume();try{t.audioContext||(t.audioContext=new(window.AudioContext||window.webkitAudioContext),t.synthMasterGain=t.audioContext.createGain(),t.synthMasterGain.connect(t.audioContext.destination)),t.micStream||(t.micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!1,noiseSuppression:!1,autoGainControl:!1}}),t.analyser=t.audioContext.createAnalyser(),t.analyser.fftSize=O.BUFFER_SIZE,t.pitchDetectionBuffer=new Float32Array(O.BUFFER_SIZE),t.fftData=new Uint8Array(t.analyser.frequencyBinCount),t.audioContext.createMediaStreamSource(t.micStream).connect(t.analyser)),[t.ui.practiceMicMsg,t.ui.tunerMicMsg].forEach(e=>h(e,{hidden:!0})),t.isAudioInitialized=!0,n&&(wt(),ot())}catch(e){[t.ui.practiceMicMsg,t.ui.tunerMicMsg].forEach(i=>h(i,{hidden:!1})),v.log(e,"AudioInit"),t.isAudioInitialized=!1}}function Dt(){t.pitchDetectionFrameId&&(cancelAnimationFrame(t.pitchDetectionFrameId),t.pitchDetectionFrameId=null),t.isTunerActive=!1}function Xt(){if(!t.analyser||!t.pitchDetectionBuffer)return[];t.analyser.getFloatTimeDomainData(t.pitchDetectionBuffer);let n=0;for(let r=0;r<t.pitchDetectionBuffer.length;r++)n+=t.pitchDetectionBuffer[r]*t.pitchDetectionBuffer[r];if(n=Math.sqrt(n/t.pitchDetectionBuffer.length),n<O.RMS_THRESHOLD)return[];const e=new Float32Array(Math.floor(t.pitchDetectionBuffer.length/2));let i=0;e[0]=1;for(let r=1;r<e.length;r++){let s=0;for(let a=0;a<e.length;a++){const c=t.pitchDetectionBuffer[a]-t.pitchDetectionBuffer[a+r];s+=c*c}i+=s,e[r]=s/(i/r+1e-6)}const o=[];for(let r=.05;r<.5;r+=.05){let s=-1;for(let a=2;a<e.length-1;a++)if(e[a]<r&&e[a]<e[a-1]&&e[a]<e[a+1]){s=a;break}if(s!==-1){const a=t.audioContext.sampleRate/s,c=1-e[s]/r;o.push({pitch:a,probability:c})}}return o}function wt(){t.hmmState={T1:new Float32Array(D).fill(1/D),T2:Array.from({length:D},()=>[]),path:[]}}function Jt(n){t.hmmState||wt();const e=new Float32Array(D).fill(1e-6);n.length===0?e[X]=1:(n.forEach(c=>{const l=Mt(c.pitch);if(l!==null&&l>=R&&l<=lt){const g=Math.floor((l-R)*100/K);e[g]=Math.max(e[g],c.probability)}}),e[X]=1-Math.max(...e));const i=new Float32Array(D),o=new Int32Array(D);for(let c=0;c<D;c++){let l=0,g=0;for(let p=0;p<D;p++){const d=p===c?.9:Math.abs(p-c)===1?.05:1e-4,m=t.hmmState.T1[p]*d;m>l&&(l=m,g=p)}i[c]=l*e[c],o[c]=g}const r=i.reduce((c,l)=>c+l,0);if(r>0)for(let c=0;c<i.length;c++)i[c]/=r;t.hmmState.T1=i;let s=0,a=0;for(let c=0;c<t.hmmState.T1.length;c++)t.hmmState.T1[c]>a&&(a=t.hmmState.T1[c],s=c);return s===X?null:U(R+s*K/100)}function ot(){try{t.analyser&&t.analyser.getByteFrequencyData(t.fftData);const n=Xt(),e=Jt(n);if(t.currentDetectedFrequency=e&&e>60&&e<1600?e:null,t.isTunerActive){const i=t.currentDetectedFrequency?Ot(t.currentDetectedFrequency):null;Kt(i)}else{const i=t.currentDetectedFrequency?Mt(t.currentDetectedFrequency):null;t.currentDetectedMidi=i?Math.round(i):null}}catch(n){v.log(n,"PitchDetectionLoop"),t.pitchDetectionFrameId&&(cancelAnimationFrame(t.pitchDetectionFrameId),t.pitchDetectionFrameId=null);return}t.pitchDetectionFrameId=requestAnimationFrame(ot)}function Kt(n){const e=t.ui;if(!n){e.tunerNoteName.textContent="-",e.tunerStatus.textContent="...",e.tunerStatus.className="text-xl font-semibold text-gray-500 h-7",e.tunerFreq.textContent="0 Hz",e.tunerNeedle.style.transform="rotate(0deg)",h(e.tunerCircle,{good:!1});return}const{noteName:i,frequency:o,cents:r}=n;e.tunerNoteName.textContent=i,e.tunerFreq.textContent=`${o.toFixed(2)} Hz`;const s=Math.max(-45,Math.min(45,r*.9));e.tunerNeedle.style.transform=`rotate(${s}deg)`,Math.abs(r)<O.IN_TUNE_CENTS_THRESHOLD?(e.tunerStatus.textContent="Good Job!",e.tunerStatus.className="text-xl font-semibold text-green-400 h-7",h(e.tunerCircle,{good:!0})):r<0?(e.tunerStatus.textContent="Too Low",e.tunerStatus.className="text-xl font-semibold text-yellow-400 h-7",h(e.tunerCircle,{good:!1})):(e.tunerStatus.textContent="Too High",e.tunerStatus.className="text-xl font-semibold text-red-400 h-7",h(e.tunerCircle,{good:!1}))}function Zt(){if(!t.audioContext)return;const n=t.audioContext.currentTime;t.activeOscillators.forEach(({osc:e,gain:i})=>{try{i.gain.cancelAndHoldAtTime(n),i.gain.linearRampToValueAtTime(0,n+$),e.stop(n+$)}catch{}}),t.activeOscillators=[]}function Tt(n){if(!t.synthMasterGain||!t.audioContext)return;const e=t.audioContext.currentTime,i=n?1e-4:1;t.synthMasterGain.gain.cancelScheduledValues(e),t.synthMasterGain.gain.linearRampToValueAtTime(i,e+$)}function Qt(n){if(!t.audioContext||!n)return;const e=t.audioContext.createOscillator(),i=t.audioContext.createGain();e.connect(i).connect(t.synthMasterGain);const o=n.pitch+t.transposeOffset;e.frequency.value=U(o),e.type="sine";const r=t.audioContext.currentTime,s=parseInt(t.ui.tempoSlider.value)/100,a=n.duration/s;i.gain.setValueAtTime(0,r),i.gain.linearRampToValueAtTime(.5,r+.01),i.gain.linearRampToValueAtTime(0,r+a),e.start(r),e.stop(r+a+$),t.activeOscillators.push({osc:e,gain:i})}const It={PERFECT:.15,LATE:.6},kt={CENTS_TOLERANCE_FOR_GAMEPLAY:60,FFT_ENERGY_THRESHOLD:180};function te(n,e,i,o,r){if(!e||!i||!r)return!1;for(const s of n){const a=U(s.pitch+o),c=Math.round(a*(r.fftSize/2)/i.sampleRate);let l=0;for(let g=-2;g<=2;g++)e[c+g]>l&&(l=e[c+g]);if(l<kt.FFT_ENERGY_THRESHOLD)return!1}return!0}function ee(n,e,i,o,r,s,a){const c=Math.abs(e);if(e<=0&&c<It.LATE){let l=!1;if(n.isChord)l=te(n.notes,o,r,s,a);else if(i!==null){const g=n.notes[0],p=U(g.pitch+s);let d=1200*Math.log2(i/p);Math.abs(d)>800&&(d%=1200),l=Math.abs(d)<kt.CENTS_TOLERANCE_FOR_GAMEPLAY}if(l)return c<It.PERFECT?{scoreChange:100,perfectNotesChange:1,attemptedNotesChange:1,wasCorrect:!0,feedback:"perfect"}:{scoreChange:75,perfectNotesChange:0,attemptedNotesChange:1,wasCorrect:!0,feedback:e>0?"early":"late"};if(e<-.3)return{scoreChange:0,perfectNotesChange:0,attemptedNotesChange:1,wasCorrect:!1,feedback:"wrong"}}return e<-.6?{scoreChange:0,perfectNotesChange:0,attemptedNotesChange:1,wasCorrect:!1,feedback:"missed"}:null}function ne(n){const e=t.ui;n?(t.gameState.streak+=1,t.gameState.streak>0&&t.gameState.streak%10===0&&t.gameState.multiplier<8&&(t.gameState.multiplier+=1)):(t.gameState.streak=0,t.gameState.multiplier=1),e.streakDisplay.textContent=`${t.gameState.multiplier}x`,n&&(h(e.streakDisplay,{"streak-increased":!1}),e.streakDisplay.offsetWidth,h(e.streakDisplay,{"streak-increased":!0}))}function ie(n){if(!t.currentSongData||!t.analyser)return;const e=t.loopEndTime!==null&&t.loopEndTime<t.currentSongData.totalDuration,i=t.currentSongData.tablature[t.currentNoteIndex];if(i){const c=i.notes[0].pitch+t.transposeOffset,l=i.isChord?"Chord":J[c%12];t.ui.targetNoteDisplay.textContent=`Target: ${l}`;const g=t.currentDetectedMidi!==null?J[t.currentDetectedMidi%12]:"--";t.ui.pitchDisplay.textContent=`Detected: ${g}`}const o=5,r=5,s=Math.max(0,t.currentNoteIndex-o),a=Math.min(t.currentSongData.tablature.length,t.currentNoteIndex+r);for(let c=s;c<a;c++){const l=t.currentSongData.tablature[c];if(l.isScored)continue;const g=l.notes[0].startTime-t.songTime;if(!t.isScrubbingMinimap&&g<.05&&!l.notes[0].isAudioTriggered&&l.notes.forEach(m=>{Qt(m),m.isAudioTriggered=!0,m.impactTime=n}),!(!e||t.songTime>=t.loopStartTime&&t.songTime<t.loopEndTime))continue;const d=ee(l,g,t.currentDetectedFrequency,t.fftData,t.audioContext,t.transposeOffset,t.analyser);if(d){l.isScored=!0,t.gameState.score+=d.scoreChange*t.gameState.multiplier,t.gameState.perfectNotes+=d.perfectNotesChange,t.gameState.attemptedNotes+=d.attemptedNotesChange,ne(d.wasCorrect),l.notes.forEach(y=>y.feedback=d.feedback);const m={perfect:"Perfect!",good:"Good!",early:"Early",late:"Late",wrong:"Wrong Note",missed:"Missed"};t.ui.feedbackDisplay.textContent=`Feedback: ${m[d.feedback]||"--"}`,t.ui.scoreDisplay.textContent=`Score: ${t.gameState.score}`}}}function Z(n){if(!t.isPlaying||t.isPaused||!t.currentSongData||!t.currentSongData.tablature){t.animationFrameId=null;return}if(t.lastTimestamp===0){t.lastTimestamp=n,t.animationFrameId=requestAnimationFrame(Z);return}const e=(n-t.lastTimestamp)/1e3;t.lastTimestamp=n;const i=parseInt(t.ui.tempoSlider.value)/100;if(t.songTime+=e*i,t.loopEndTime!==null&&t.songTime>=t.loopEndTime){const o=ht(),r=Math.floor(t.loopStartTime/o)*o,s=Math.max(0,r-o);t.songTime=s,t.currentScrollX=t.songTime*t.currentSongData.pixelsPerSecond,t.currentSongData.tablature.forEach(a=>{a.notes[0].startTime>=s&&(a.notes.forEach(c=>{delete c.isAudioTriggered,delete c.impactTime,delete c.feedback}),delete a.isScored)})}t.currentScrollX=t.songTime*t.currentSongData.pixelsPerSecond,t.currentNoteIndex=V(t.songTime),ie(n),I(n),B(),t.currentSongData.totalDuration&&t.songTime>t.currentSongData.totalDuration+2&&(t.loopEndTime===null||t.loopEndTime>=t.currentSongData.totalDuration)?re():t.animationFrameId=requestAnimationFrame(Z)}function z(){if(!t.currentSongData||t.isPlaying||!t.currentSongData.tablature||t.currentSongData.tablature.length===0)return;if(t.loopEndTime!==null&&t.loopEndTime<t.currentSongData.totalDuration&&t.songTime<=t.loopStartTime){const e=ht(),i=Math.floor(t.loopStartTime/e)*e,o=Math.max(0,i-e);t.songTime=o}t.synthMasterGain&&t.audioContext&&(t.synthMasterGain.gain.cancelScheduledValues(t.audioContext.currentTime),t.synthMasterGain.gain.setValueAtTime(1,t.audioContext.currentTime)),t.isPlaying=!0,t.isPaused=!1,h(t.ui.playIcon,{hidden:!0}),h(t.ui.pauseIcon,{hidden:!1}),t.lastTimestamp=0,t.animationFrameId=requestAnimationFrame(Z)}function ft(){!t.isPlaying||t.isPaused||(t.isPaused=!0,h(t.ui.playIcon,{hidden:!1}),h(t.ui.pauseIcon,{hidden:!0}),t.synthMasterGain&&t.audioContext&&t.synthMasterGain.gain.exponentialRampToValueAtTime(1e-4,t.audioContext.currentTime+.05))}function pt(){!t.isPlaying||!t.isPaused||(t.isPaused=!1,h(t.ui.playIcon,{hidden:!0}),h(t.ui.pauseIcon,{hidden:!1}),t.lastTimestamp=0,t.synthMasterGain&&t.audioContext&&(t.synthMasterGain.gain.cancelScheduledValues(t.audioContext.currentTime),t.synthMasterGain.gain.setValueAtTime(1,t.audioContext.currentTime)),t.animationFrameId||(t.animationFrameId=requestAnimationFrame(Z)))}function L(n=!1){t.animationFrameId&&cancelAnimationFrame(t.animationFrameId),t.animationFrameId=null,t.isPlaying=!1,t.isPaused=!1,h(t.ui.playIcon,{hidden:!1}),h(t.ui.pauseIcon,{hidden:!0}),t.currentSongData&&oe(n)}function oe(n=!1){Rt(),n&&t.currentSongData?t.songTime=t.loopStartTime:(t.songTime=0,t.currentSongData&&(t.loopStartTime=0,t.loopEndTime=t.currentSongData.totalDuration)),t.currentScrollX=t.currentSongData?t.songTime*t.currentSongData.pixelsPerSecond:0,t.lastTimestamp=0,t.currentNoteIndex=V(t.songTime),t.ui.scoreDisplay.textContent="Score: 0",t.ui.streakDisplay.textContent="1x",t.ui.targetNoteDisplay.textContent="Target: --",t.ui.feedbackDisplay.textContent="Feedback: --",t.ui.pitchDisplay.textContent="Detected: --",t.stars=[];for(let e=0;e<100;e++){const{neckTopY:i}=M();t.stars.push({x:Math.random()*t.ui.tabDisplay.clientWidth,y:Math.random()*i,r:Math.random()*1.5})}t.currentSongData&&t.currentSongData.tablature&&t.currentSongData.tablature.forEach(e=>{e.notes[0].startTime>=t.songTime&&(delete e.isScored,e.notes.forEach(i=>{delete i.isAudioTriggered,delete i.impactTime,delete i.feedback}))}),I(),B()}function re(){if(!t.currentSongData)return;const n=t.currentSongData.highScore||0;t.ui.summaryScore.textContent=String(t.gameState.score);const e=t.gameState.attemptedNotes>0?Math.round(t.gameState.perfectNotes/t.gameState.attemptedNotes*100):0;if(t.ui.summaryAccuracy.textContent=`${e}%`,L(),ue(),t.gameState.score>n){const i=t.songs.find(o=>o.id===t.currentSongData.id);i&&(i.highScore=t.gameState.score,localStorage.setItem(`fretflow_songs_${t.currentInstrument}`,JSON.stringify(t.songs)))}}function V(n){var s,a,c;const e=(s=t.currentSongData)==null?void 0:s.tablature;if(!e||e.length===0)return 0;let i=0,o=e.length-1,r=0;for(;i<=o;){const l=i+Math.floor((o-i)/2),g=(c=(a=e[l])==null?void 0:a.notes[0])==null?void 0:c.startTime;if(g===void 0){o=l-1;continue}g<=n?(r=l,i=l+1):o=l-1}return r}function ht(){if(!t.currentSongData)return 2;const{midiTempo:n,midiTimeSignature:e}=t.currentSongData,i=n||5e5,o=e?JSON.parse(e):{numerator:4},r=i/1e6,s=o.numerator||4;return r*s}function k(){t.currentSongData&&(t.currentSongData.tablature=t.isEditMode?t.editedTablature:t.originalTablature||[],I(),B(),t.ui.transposeValue.textContent=t.transposeOffset>0?`+${t.transposeOffset}`:String(t.transposeOffset))}async function _(){if(!(!t.currentSongData||!t.currentSongData.id||t.isEditMode))try{const n=t.songs.find(e=>e.id===t.currentSongData.id);n&&(n.playbackTempo=parseInt(t.ui.tempoSlider.value),n.transpose=t.transposeOffset,n.zoomLevel=t.zoomLevel,localStorage.setItem(`fretflow_songs_${t.currentInstrument}`,JSON.stringify(t.songs)))}catch(n){v.log(n,"SavePracticeSettings")}}function Q(n){if(!t.originalTablature||t.originalTablature.length===0)return!0;const e=T(t.currentInstrument),i=t.isEditMode?t.editedTablature:t.originalTablature;for(const o of i)for(const r of o.notes){const s=r.fret+n;if(s<0||s>e.numFrets)return!1}return!0}function rt(){t.currentSongData&&(t.ui.transposeUpBtn.disabled=!Q(t.transposeOffset+1),t.ui.transposeDownBtn.disabled=!Q(t.transposeOffset-1))}function at(n){if(!t.currentSongData)return{mode:null,time:0};const e=t.ui.minimapCanvas.getBoundingClientRect(),i=n.clientX-e.left,o=i/e.width*t.currentSongData.totalDuration;if(t.isEditMode)return{mode:"seek",time:o};const{MINIMAP_HANDLE_W:r,MINIMAP_HIT_PAD:s}=zt,a=r/2,c=t.loopStartTime/t.currentSongData.totalDuration*e.width,l=t.loopEndTime/t.currentSongData.totalDuration*e.width,g=Math.abs(i-c)<a+s,p=Math.abs(i-l)<a+s;return g?{mode:"start",time:o}:p?{mode:"end",time:o}:{mode:"seek",time:o}}function vt(n){if(!t.currentSongData)return;const{time:e}=at(n);t.dragMode==="start"?t.loopStartTime=Math.max(0,Math.min(e,t.loopEndTime-.1)):t.dragMode==="end"?t.loopEndTime=Math.min(t.currentSongData.totalDuration,Math.max(e,t.loopStartTime+.1)):t.dragMode==="seek"&&(t.songTime=Math.max(0,Math.min(e,t.currentSongData.totalDuration))),t.currentSongData.tablature.forEach(i=>{i.notes[0].startTime>=t.songTime&&(delete i.isScored,i.notes.forEach(o=>{delete o.isAudioTriggered,delete o.impactTime,delete o.feedback}))}),t.currentScrollX=t.songTime*t.currentSongData.pixelsPerSecond,t.currentNoteIndex=V(t.songTime),I(),B()}async function ae(n){let e=JSON.parse(n.tablature||"[]");e.length>0&&e[0].pitch!==void 0&&e[0].notes===void 0&&(v.log("Migrating old song data structure to new format.","SongLoad"),e=e.map(l=>({notes:[l],isChord:!1}))),t.originalTablature=e,t.transposeOffset=n.transpose||0,t.zoomLevel=n.zoomLevel||1;const i=n.playbackTempo||100,o=e.length>0?e[e.length-1]:{notes:[{startTime:0,duration:0}]},r=o.notes[0].startTime+o.notes[0].duration,s=e.flatMap(l=>l.notes).map(l=>l.duration).filter(l=>l>0),a=s.length>0?Math.min(...s):.1,c=Math.max(150,(72*t.globalSettings.noteSize+8)/a)*t.zoomLevel;t.ui.tempoSlider.value=String(i),t.ui.tempoValue.textContent=`${i}%`,t.ui.zoomSlider.value=String(t.zoomLevel),t.ui.zoomValue.textContent=`${Math.round(t.zoomLevel*100)}%`,t.currentSongData={...n,tablature:t.originalTablature,totalDuration:r,minDuration:a,pixelsPerSecond:c},t.loopStartTime=0,t.loopEndTime=r,k(),rt(),await ce(),L(),z()}function Et(){t.ui.undoBtn.disabled=t.historyIndex<0,t.ui.redoBtn.disabled=t.historyIndex>=t.editHistory.length-1}function Pt(){if(t.historyIndex<0)return;const n=t.editHistory[t.historyIndex],e=t.editedTablature[n.noteId.eventIndex].notes[n.noteId.noteIndex];switch(n.type){case"finger":e.finger=n.oldValue;break;case"position":e.string=n.oldValue.string,e.fret=n.oldValue.fret;break;case"pitch":e.pitch=n.oldValue.pitch,e.fret=n.oldValue.fret;break}t.historyIndex--,t.pendingEdits=!0,k(),Et(),t.selectedNoteIndex&&t.selectedNoteIndex.eventIndex===n.noteId.eventIndex&&t.selectedNoteIndex.noteIndex===n.noteId.noteIndex&&W(t.selectedNoteIndex)}function Ft(){if(t.historyIndex>=t.editHistory.length-1)return;t.historyIndex++;const n=t.editHistory[t.historyIndex],e=t.editedTablature[n.noteId.eventIndex].notes[n.noteId.noteIndex];switch(n.type){case"finger":e.finger=n.newValue;break;case"position":e.string=n.newValue.string,e.fret=n.newValue.fret;break;case"pitch":e.pitch=n.newValue.pitch,e.fret=n.newValue.fret;break}t.pendingEdits=!0,k(),Et(),t.selectedNoteIndex&&t.selectedNoteIndex.eventIndex===n.noteId.eventIndex&&t.selectedNoteIndex.noteIndex===n.noteId.noteIndex&&W(t.selectedNoteIndex)}function W(n){var p;if(!n||!t.currentSongData)return;const{eventIndex:e,noteIndex:i}=n,o=(p=t.editedTablature[e])==null?void 0:p.notes[i];if(!o)return;t.selectedNoteIndex=n,t.ui.editorFretValue.textContent=String(o.fret),it(".finger-btn",t.ui.editorFingerButtons).forEach(d=>{h(d,{active:parseInt(d.dataset.finger)===o.finger})});const{neckTopY:r,neckHeight:s}=M(),a=s/T(t.currentInstrument).numStrings,c=Y()+o.startTime*t.currentSongData.pixelsPerSecond-t.currentScrollX,l=r+o.string*a+a/2,g=t.ui.noteEditorPopup;g.style.left=`${c+35}px`,g.style.top=`${l-g.offsetHeight/2}px`,h(g,{hidden:!1}),setTimeout(()=>{h(g,{"opacity-0":!1,"pointer-events-none":!1})},10),I()}function E(){t.selectedNoteIndex=null,h(t.ui.noteEditorPopup,{"opacity-0":!0,"pointer-events-none":!0}),setTimeout(()=>h(t.ui.noteEditorPopup,{hidden:!0}),150),I()}function tt(n,e){var p;if(!((p=t.currentSongData)!=null&&p.tablature))return null;const i=t.ui.dynamicCanvas.getBoundingClientRect(),o=n-i.left,r=e-i.top,s=T(t.currentInstrument),{neckTopY:a,neckHeight:c}=M(),l=c/s.numStrings,g=t.isEditMode?t.editedTablature:t.currentSongData.tablature;for(let d=g.length-1;d>=0;d--){const m=g[d];for(let y=0;y<m.notes.length;y++){const x=m.notes[y],S=Y()+x.startTime*t.currentSongData.pixelsPerSecond-t.currentScrollX,b=a+x.string*l+l/2,C=72*t.globalSettings.noteSize,N=C,P=(x.duration-t.currentSongData.minDuration)*t.currentSongData.pixelsPerSecond,H=N+Math.max(0,P);if(o>=S&&o<=S+H&&r>=b-C/2&&r<=b+C/2)return{eventIndex:d,noteIndex:y}}}return null}function se(){t.ui={loadingScreen:u("#loading-screen"),library:u("#song-library-screen"),practice:u("#practice-screen"),tuner:u("#tuner-screen"),summary:u("#summary-screen"),songList:u("#song-list"),addModal:u("#add-song-modal"),addBtn:u("#add-song-btn"),tunerNavBtn:u("#tuner-nav-btn"),fullscreenBtn:u("#fullscreen-btn"),exportLibraryBtn:u("#export-library-btn"),importLibraryInput:u("#import-library-input"),cancelBtn:u("#cancel-btn"),formError:u("#form-error"),midiFileInput:u("#midi-file-input"),modalLoader:u("#modal-loading-overlay"),modalProgressText:u("#modal-progress-text"),practiceBackBtn:u("#practice-back-btn"),tunerBackBtn:u("#tuner-back-btn"),settingsBtn:u("#settings-btn"),settingsMenu:u("#settings-menu"),settingsMenuContent:u("#settings-menu-content"),settingsBackdrop:u("#settings-backdrop"),tempoSlider:u("#tempo-slider"),tempoValue:u("#tempo-value"),noteSizeSlider:u("#note-size-slider"),noteSizeValue:u("#note-size-value"),stringSpacingSlider:u("#string-spacing-slider"),stringSpacingValue:u("#string-spacing-value"),stringThicknessSlider:u("#string-thickness-slider"),stringThicknessValue:u("#string-thickness-value"),zoomSlider:u("#zoom-slider"),zoomValue:u("#zoom-value"),tabDisplay:u("#tab-display"),staticCanvas:u("#static-canvas"),dynamicCanvas:u("#practice-canvas"),playPauseBtn:u("#play-pause-btn"),rewindBtn:u("#rewind-btn"),editModeBtn:u("#edit-mode-btn"),undoBtn:u("#undo-btn"),redoBtn:u("#redo-btn"),playIcon:u("#play-icon"),pauseIcon:u("#pause-icon"),pitchDisplay:u("#pitch-display"),feedbackDisplay:u("#feedback-display"),targetNoteDisplay:u("#target-note-display"),practiceMicMsg:u("#practice-mic-msg"),tunerMicMsg:u("#tuner-mic-msg"),tunerNoteName:u("#tuner-note-name"),tunerNeedle:u("#tuner-needle"),tunerStatus:u("#tuner-status"),tunerFreq:u("#tuner-freq"),tunerCircle:u("#tuner-circle"),scoreDisplay:u("#current-score-display"),streakDisplay:u("#streak-display"),summaryScore:u("#summary-score"),summaryAccuracy:u("#summary-accuracy"),summaryBackBtn:u("#summary-back-btn"),transposeDownBtn:u("#transpose-down-btn"),transposeUpBtn:u("#transpose-up-btn"),transposeValue:u("#transpose-value"),minimapCanvas:u("#minimap-canvas"),libraryTitle:u("#library-title"),selectGuitarBtn:u("#select-guitar-btn"),selectUkuleleBtn:u("#select-ukulele-btn"),editButtonsContainer:u("#edit-buttons-container"),noteEditorPopup:u("#note-editor-popup"),editorCloseBtn:u("#editor-close-btn"),editorFretDown:u("#editor-fret-down"),editorFretUp:u("#editor-fret-up"),editorFretValue:u("#editor-fret-value"),editorFingerButtons:u("#editor-finger-buttons"),getAiAdviceBtn:u("#get-ai-advice-btn"),aiAdviceModal:u("#ai-advice-modal"),aiAdviceContent:u("#ai-advice-content"),aiAdviceCloseBtn:u("#ai-advice-close-btn"),aiAdviceLoading:u("#ai-advice-loading")}}const j=n=>{[t.ui.loadingScreen,t.ui.library,t.ui.practice,t.ui.summary,t.ui.tuner].forEach(e=>{e&&h(e,{hidden:!e.isEqualNode(n)})})},st=()=>{L(),Dt(),E(),j(t.ui.library)},ce=async()=>{await Nt(!0),t.isTunerActive=!1,j(t.ui.practice),gt()},le=async()=>{await Nt(!0),t.isTunerActive=!0,E(),j(t.ui.tuner)},ue=()=>{L(),Dt(),E(),j(t.ui.summary)},de=()=>h(t.ui.addModal,{hidden:!1}),At=()=>{h(t.ui.addModal,{hidden:!0}),h(t.ui.formError,{hidden:!0})},ge=`
// --- Inlined from logger.ts ---
const isDev = true;
const Logger = {
    log(e, ctx = 'General') {
        if (isDev) {
            console.error('[Worker-' + ctx + ']', e);
        }
    }
};

// --- Inlined from config.ts ---
const INSTRUMENT_CONFIG = {
    guitar: {
        name: "Guitar",
        numStrings: 6,
        numFrets: 22,
        tuning: [64, 59, 55, 50, 45, 40], // E4, B3, G3, D3, A2, E2
        stringGauges: [4.0, 5.0, 6.0, 7.0, 8.0, 9.0],
        woundStringIndices: [3, 4, 5],
    },
    ukulele: {
        name: "Ukulele",
        numStrings: 4,
        numFrets: 15,
        tuning: [69, 64, 60, 67], // A4, E4, C4, G4 (re-entrant gCEA)
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

    // High Fret Penalty
    const HIGH_FRET_THRESHOLD = 12;
    const HIGH_FRET_PENALTY_FACTOR = 0.3;
    if (frets.length > 0) {
        frets.forEach(fret => {
            if (fret > HIGH_FRET_THRESHOLD) {
                cost += Math.pow(fret - HIGH_FRET_THRESHOLD, 2) * HIGH_FRET_PENALTY_FACTOR;
            }
        });
    }

    // Fret Span Penalty
    if (frets.length > 1) {
        cost += Math.pow(Math.max(...frets) - Math.min(...frets), 2) * 0.5;
    }

    // Open String Reward
    if (nextFingering.some(n => n.fret === 0)) {
        cost -= 2.0;
    }

    // Hand Movement Penalty
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

    // Tie-breaker penalty for general fret position
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
        const notesWithPossiblePositions = event.notes
            .map(note => ({
                note,
                positions: findPossiblePositions(note.pitch, instrumentId)
            }))
            .filter(item => item.positions.length > 0);
            
        if (notesWithPossiblePositions.length === 0) {
            if (event.notes.length > 0) {
                 Logger.log('Skipping event at time ' + event.notes[0].startTime.toFixed(2) + 's: No playable notes found for this event.', 'TablatureGeneration');
            }
            continue;
        }

        if (notesWithPossiblePositions.length < event.notes.length) {
            Logger.log('Simplified chord at time ' + event.notes[0].startTime.toFixed(2) + 's: Some notes were out of range.', 'TablatureGeneration');
        }

        if (notesWithPossiblePositions.length > instrumentConfig.numStrings) {
            Logger.log('Skipping event at time ' + event.notes[0].startTime.toFixed(2) + 's: Chord has more notes (' + notesWithPossiblePositions.length + ') than available strings (' + instrumentConfig.numStrings + ').', 'TablatureGeneration');
            continue;
        }

        const playableNotes = notesWithPossiblePositions.map(item => item.note);
        const notePositions = notesWithPossiblePositions.map(item => item.positions);

        const allChordFingerings = [];

        function findCombinations(noteIndex, currentFingering, usedStrings) {
            if (noteIndex === playableNotes.length) {
                allChordFingerings.push(currentFingering);
                return;
            }
            
            if (!notePositions[noteIndex] || notePositions[noteIndex].length === 0) {
                return;
            }

            for (const pos of notePositions[noteIndex]) {
                if (!usedStrings.has(pos.string)) {
                    const newNote = { ...playableNotes[noteIndex], ...pos, finger: 0 };
                    const newFingering = [...currentFingering, newNote];
                    const newUsedStrings = new Set(usedStrings).add(pos.string);
                    findCombinations(noteIndex + 1, newFingering, newUsedStrings);
                }
            }
        }

        findCombinations(0, [], new Set());

        if (allChordFingerings.length > 0) {
            const newEvent = {
                notes: playableNotes,
                isChord: playableNotes.length > 1
            };
            trellis.push(allChordFingerings);
            filteredNoteEvents.push(newEvent);
        } else {
            if (event.notes.length > 0) {
                Logger.log('Skipping unplayable event at time ' + event.notes[0].startTime.toFixed(2) + 's', 'TablatureGeneration');
            }
        }
    }

    if (trellis.length === 0) {
        Logger.log("No playable notes found.", 'TablatureGeneration');
        return [];
    }

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

    const optimalPathIndices = [];
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

function assignFingering(tablature) {
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

// --- Inlined from worker.ts ---
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
                        }
                        else if (event.type === 8 || (event.type === 9 && event.data[1] === 0)) {
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
                    const firstNote = rawNotes[i];
                    const chordNotes = [firstNote];
                    let j = i + 1;
                    while (j < rawNotes.length && Math.abs(rawNotes[j].startTime - firstNote.startTime) < 0.01) {
                        chordNotes.push(rawNotes[j]);
                        j++;
                    }
                    noteEvents.push({ notes: chordNotes, isChord: chordNotes.length > 1 });
                    i = j;
                }
                res({ notes: noteEvents, tempo, timeSignature });
            } catch (err) {
                rej(new Error("Could not read MIDI file. It may be corrupt."));
            }
        };
        reader.onerror = (err) => rej(err);
        reader.readAsDataURL(file);
    });
}

self.onmessage = async (event) => {
    const { file, instrumentId } = event.data;
    const title = file.name.replace(/\\.(mid|midi)$/i, '').replace(/_/g, ' ');

    try {
        const songData = await parseMidiFile(file);
        if (songData.notes.length === 0) {
            Logger.log('Skipping ' + file.name + ': No notes found.', 'Worker');
            self.postMessage({ status: 'skipped', title });
            return;
        }

        let tabWithPositions = generateTablature(songData.notes, instrumentId);
        
        if (tabWithPositions.length > 0 && tabWithPositions[0].notes.length > 0) {
            const firstNoteTime = tabWithPositions[0].notes[0].startTime;
            const measureDuration = ((songData.tempo || 500000) / 1000000) * (songData.timeSignature?.numerator || 4);
            if (firstNoteTime < measureDuration) {
                tabWithPositions.forEach(tabEvent => tabEvent.notes.forEach(note => note.startTime += measureDuration));
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
        
        self.postMessage({ status: 'success', song: newSong, title: newSong.title });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        Logger.log(error, 'Worker_FileProcess: ' + file.name);
        self.postMessage({ status: 'error', title, error: errorMessage });
    }
};

self.onerror = (error) => {
    console.error('Unhandled worker error:', error);
};
`,Lt=()=>`fretflow_songs_${t.currentInstrument}`;function me(){localStorage.setItem("fretflow_current_instrument",t.currentInstrument)}function et(){localStorage.setItem("fretflow_global_settings",JSON.stringify(t.globalSettings))}function fe(){const n=localStorage.getItem("fretflow_global_settings");if(n)try{t.globalSettings={...t.globalSettings,...JSON.parse(n)}}catch(e){v.log(e,"LocalStorageParse_GlobalSettings")}t.ui.noteSizeSlider.value=String(t.globalSettings.noteSize),t.ui.noteSizeValue.textContent=`${Math.round(t.globalSettings.noteSize*100)}%`,t.ui.stringSpacingSlider.value=String(t.globalSettings.stringSpacing),t.ui.stringSpacingValue.textContent=`${Math.round(t.globalSettings.stringSpacing*100)}%`,t.ui.stringThicknessSlider.value=String(t.globalSettings.stringThickness),t.ui.stringThicknessValue.textContent=`${Math.round(t.globalSettings.stringThickness*100)}%`}function Bt(){const n=localStorage.getItem("fretflow_current_instrument");n&&ct[n]&&(t.currentInstrument=n);const e=localStorage.getItem(Lt());if(e)try{t.songs=JSON.parse(e)}catch(i){v.log(i,"LocalStorageParse_Songs"),t.songs=[]}else t.songs=[];t.ui.libraryTitle.textContent=`${T(t.currentInstrument).name} Library`,q()}function St(){localStorage.setItem(Lt(),JSON.stringify(t.songs))}async function pe(n){const e=n.target.files;if(!e||e.length===0)return;h(t.ui.modalLoader,{hidden:!1}),de();const i=new Blob([ge],{type:"application/javascript"}),o=URL.createObjectURL(i),r=new Worker(o);let s=0;const a=e.length;r.onmessage=c=>{const{status:l,song:g,title:p,error:d}=c.data;s++,t.ui.modalProgressText.textContent=`Processing ${s} of ${a}: ${p}`,l==="success"&&g?t.songs.push(g):l==="error"&&(v.log(new Error(d),"AddSong_FileProcess"),t.ui.formError.textContent=`Error processing ${p}: ${d}`,h(t.ui.formError,{hidden:!1})),s===a&&(St(),q(),h(t.ui.modalLoader,{hidden:!0}),At(),n.target.value="",r.terminate(),URL.revokeObjectURL(o))},r.onerror=c=>{v.log(c,"WorkerError"),t.ui.formError.textContent=`A critical worker error occurred: ${c.message}. Please refresh the page.`,h(t.ui.formError,{hidden:!1}),h(t.ui.modalLoader,{hidden:!0}),n.target.value="",r.terminate(),URL.revokeObjectURL(o)};for(const c of Array.from(e))r.postMessage({file:c,instrumentId:t.currentInstrument})}function he(n){t.songs=t.songs.filter(e=>e.id!==n),St(),q()}function Se(n){const e=document.createElement("div");e.className="song-item bg-gray-800 p-4 rounded-lg flex justify-between items-center shadow-md",e.setAttribute("data-id",n.id),e.innerHTML=`<div><h2 class="text-xl font-semibold">${n.title}</h2><p class="text-sm text-gray-400">High Score: ${n.highScore||0}</p></div><button class="delete-song-btn p-2 rounded-full text-gray-500 hover:text-red-500"><svg class="h-6 w-6 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>`,t.ui.songList.appendChild(e)}function q(){if(t.ui.songList.innerHTML="",t.songs.length===0){t.ui.songList.innerHTML=`<p class="text-gray-500">Your ${T(t.currentInstrument).name} library is empty. Click "Add Song" to start!</p>`;return}t.songs.sort((e,i)=>(e.createdAt||0)<(i.createdAt||0)?1:-1).forEach(Se)}function ye(n){var o;const e=(o=n.target.files)==null?void 0:o[0];if(!e)return;const i=new FileReader;i.onload=r=>{try{const s=JSON.parse(r.target.result);if(Array.isArray(s))t.songs=s,St(),q();else throw new Error("Imported file is not a valid song library.")}catch(s){v.log(s,"ImportLibrary"),t.ui.formError.textContent="Error: Could not import library. File may be corrupt.",h(t.ui.formError,{hidden:!1})}},i.readAsText(e)}function xe(){if(t.songs.length===0){t.ui.songList.innerHTML='<p class="text-yellow-400">Your library is empty. Nothing to export.</p>',setTimeout(()=>q(),3e3);return}const n="data:text/json;charset=utf-8,"+encodeURIComponent(JSON.stringify(t.songs,null,2)),e=document.createElement("a");e.setAttribute("href",n),e.setAttribute("download",`fretflow_library_${t.currentInstrument}.json`),document.body.appendChild(e),e.click(),e.remove()}async function be(n){const e=n.target.closest(".song-item");if(!e)return;const i=e.getAttribute("data-id");if(n.target.closest(".delete-song-btn")){i&&he(i);return}const o=t.songs.find(r=>r.id===i);o&&await ae(o)}const Ce="AIzaSyC2RiRWGoh6BqcCTKT2UXUsYT8M25TdM5c",Te=new _t({apiKey:Ce});function Ie(n){return n.split(/\n\s*\n/).map(i=>{if(i.trim()==="")return"";let o=i.replace(/\*\*(.*?)\*\*/g,"<h3>$1</h3>").replace(/\*(.*?)\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,'<code class="bg-gray-700 rounded px-1 py-0.5 text-amber-300">$1</code>');return o.match(/^\s*[\-\*]/)?`<ul>${o.split(`
`).map(s=>`<li>${s.replace(/^\s*[\-\*]\s*/,"")}</li>`).join("")}</ul>`:`<p>${o.replace(/\n/g,"<br>")}</p>`}).join("")}async function ve(n,e){if(n.length===0)return Promise.resolve("<p>No notes selected to analyze. Please create a loop to get advice.</p>");const i=T(e),o=i.name,r=i.tuning.map(d=>Gt(d)).join(", "),s=n.length,a={perfect:0,timing_issue:0,mistake:0,unplayed:0};n.forEach(d=>{switch(d.feedback){case"perfect":case"good":a.perfect++;break;case"late":case"early":a.timing_issue++;break;case"wrong":case"missed":a.mistake++;break;default:a.unplayed++;break}});let c="This section hasn't been played yet, or the performance data is not available.";const l=s-a.unplayed;if(l>0){const d=Math.round(a.perfect/l*100),m=Math.round(a.timing_issue/l*100),y=Math.round(a.mistake/l*100);c=`On my recent attempts at this section, my performance was:
- **Correct Notes:** ${d}%
- **Timing Issues (early/late):** ${m}%
- **Mistakes (wrong/missed notes):** ${y}%`}const g=n.map(d=>{const m=d.feedback?` (My last attempt: ${d.feedback})`:"";return`- String ${d.string+1}, Fret ${d.fret}${m}`}).join(`
`),p=`
Act as an expert music instructor for stringed instruments. Your advice must be clear, encouraging, and easy for a student to understand.

I am a student practicing a passage on a ${o} with standard tuning (${r}).

Here is the tablature for the passage I'm practicing, along with my performance feedback on each note if available:
${g}

Here is a summary of my overall performance on this section:
${c}

Based on both the tablature AND my specific performance data, please provide personalized practice advice.
1.  **Analysis of Mistakes:** Look at the notes I'm getting wrong, late, or missing. Analyze *why* I might be making these specific errors (e.g., "The jump from the G chord to the C note on the next string is challenging, which could explain the 'late' timing.").
2.  **Recommended Fingering:** Suggest an efficient fretting-hand fingering for the entire passage. Explain why it's good (e.g., minimizes movement, prepares for upcoming notes, uses an anchor finger).
3.  **Targeted Practice Exercises:** Give me one or two specific, simple practice exercises designed to fix my problem areas. For example, if I'm struggling with a specific transition, suggest an exercise that isolates and repeats that move.

Format the response using simple markdown. Use headings for each section (e.g., "**Analysis**", "**Recommended Fingering**", "**Practice Exercises**").
    `;try{const m=(await Te.models.generateContent({model:"gemini-2.5-flash-preview-04-17",contents:p,config:{systemInstruction:"You are an expert music instructor for stringed instruments. Your advice is clear, encouraging, and easy for a student to understand, acting as a personal coach."}})).text;return Ie(m)}catch(d){return v.log(d,"GeminiAPI"),`<p class="text-red-400"><strong>Error:</strong> Could not get advice from the AI. ${(d==null?void 0:d.message)||"An unknown error occurred."}</p>`}}function Me(){const n=()=>{const i=t.currentInstrument==="guitar";h(t.ui.selectGuitarBtn,{"bg-blue-600":i,"text-white":i}),h(t.ui.selectUkuleleBtn,{"bg-blue-600":!i,"text-white":!i})},e=i=>{t.currentInstrument!==i&&(t.currentInstrument=i,me(),Bt(),n())};f(t.ui.selectGuitarBtn,"click",()=>e("guitar")),f(t.ui.selectUkuleleBtn,"click",()=>e("ukulele")),f(t.ui.midiFileInput,"change",pe),f(t.ui.exportLibraryBtn,"click",xe),f(t.ui.importLibraryInput,"change",ye),f(t.ui.songList,"click",be),f(t.ui.cancelBtn,"click",At),n()}function Ne(){f(t.ui.playPauseBtn,"click",()=>{t.isPlaying?t.isPaused?pt():ft():z()}),f(t.ui.rewindBtn,"click",()=>{L(!0),z()}),f(t.ui.practiceBackBtn,"click",async()=>{await _(),st()}),f(t.ui.editModeBtn,"click",async()=>{const n=t.isEditMode;if(t.isEditMode=!t.isEditMode,h(t.ui.practice,{"in-edit-mode":t.isEditMode}),E(),t.isEditMode)L(),t.editedTablature=JSON.parse(JSON.stringify(t.originalTablature)),t.editHistory=[],t.historyIndex=-1,t.ui.undoBtn.disabled=!0,t.ui.redoBtn.disabled=!0,t.ui.editModeBtn.textContent="Save & Exit",it(".local-setting-control").forEach(e=>e.disabled=!0),h(t.ui.editButtonsContainer,{hidden:!1});else{t.ui.editModeBtn.disabled=!0,t.ui.editModeBtn.textContent="Saving...";try{if(n&&t.pendingEdits){const e=t.songs.find(i=>i.id===t.currentSongData.id);e&&(e.tablature=JSON.stringify(t.editedTablature),t.originalTablature=JSON.parse(JSON.stringify(t.editedTablature)),localStorage.setItem(`fretflow_songs_${t.currentInstrument}`,JSON.stringify(t.songs)))}}catch(e){v.log(e,"SaveEdits")}finally{t.pendingEdits=!1,t.ui.editModeBtn.textContent="Edit",t.ui.editModeBtn.disabled=!1,it(".local-setting-control").forEach(e=>e.disabled=!1),h(t.ui.editButtonsContainer,{hidden:!0})}}k()})}function De(){f(t.ui.tempoSlider,"input",n=>{t.ui.tempoValue.textContent=`${n.target.value}%`}),f(t.ui.tempoSlider,"change",_),f(t.ui.zoomSlider,"input",n=>{if(t.zoomLevel=parseFloat(n.target.value),t.ui.zoomValue.textContent=`${Math.round(t.zoomLevel*100)}%`,t.currentSongData){const e=Math.max(150,(72*t.globalSettings.noteSize+8)/t.currentSongData.minDuration);t.currentSongData.pixelsPerSecond=e*t.zoomLevel,I(),B()}}),f(t.ui.zoomSlider,"change",_),f(t.ui.transposeDownBtn,"click",()=>{t.isEditMode||Q(t.transposeOffset-1)&&(t.transposeOffset--,k(),_(),rt())}),f(t.ui.transposeUpBtn,"click",()=>{t.isEditMode||Q(t.transposeOffset+1)&&(t.transposeOffset++,k(),_(),rt())}),f(t.ui.noteSizeSlider,"input",n=>{t.globalSettings.noteSize=parseFloat(n.target.value),t.ui.noteSizeValue.textContent=`${Math.round(t.globalSettings.noteSize*100)}%`,k()}),f(t.ui.noteSizeSlider,"change",et),f(t.ui.stringSpacingSlider,"input",n=>{t.globalSettings.stringSpacing=parseFloat(n.target.value),t.ui.stringSpacingValue.textContent=`${Math.round(t.globalSettings.stringSpacing*100)}%`,nt(),I()}),f(t.ui.stringSpacingSlider,"change",et),f(t.ui.stringThicknessSlider,"input",n=>{t.globalSettings.stringThickness=parseFloat(n.target.value),t.ui.stringThicknessValue.textContent=`${Math.round(t.globalSettings.stringThickness*100)}%`,nt(),I()}),f(t.ui.stringThicknessSlider,"change",et)}function we(){f(t.ui.undoBtn,"click",Pt),f(t.ui.redoBtn,"click",Ft),f(t.ui.editorCloseBtn,"click",E),f(t.ui.editorFretUp,"click",()=>n(1)),f(t.ui.editorFretDown,"click",()=>n(-1)),f(t.ui.editorFingerButtons,"click",e=>{const i=e.target.closest(".finger-btn");if(i&&t.selectedNoteIndex){const o=parseInt(i.dataset.finger),{eventIndex:r,noteIndex:s}=t.selectedNoteIndex,a=t.editedTablature[r].notes[s];a.finger!==o&&(a.finger=o,t.pendingEdits=!0,W(t.selectedNoteIndex))}});function n(e){if(!t.selectedNoteIndex)return;const i=T(t.currentInstrument),{eventIndex:o,noteIndex:r}=t.selectedNoteIndex,s=t.editedTablature[o].notes[r],a=s.fret+e;if(a>=0&&a<=i.numFrets){const c=i.tuning[s.string]+a;s.fret=a,s.pitch=c,t.pendingEdits=!0,W(t.selectedNoteIndex)}}}function ke(){f(t.ui.dynamicCanvas,"mousedown",e=>{if(t.isEditMode){const i=tt(e.clientX,e.clientY);i?(t.isDragging=!0,t.wasDragged=!1,t.draggedNoteIndex=i,h(t.ui.dynamicCanvas,{grabbing:!0})):E()}}),f(t.ui.dynamicCanvas,"click",e=>{t.isEditMode||(t.isPlaying?t.isPaused?pt():ft():z())});const n=mt(e=>{if(!t.isEditMode||!t.currentSongData||t.isDragging)return;const i=tt(e.clientX,e.clientY);JSON.stringify(i)!==JSON.stringify(t.hoveredNoteIndex)&&(t.hoveredNoteIndex=i,I())},50);f(t.ui.dynamicCanvas,"mousemove",e=>{if(t.isDragging){t.wasDragged=!0,requestAnimationFrame(()=>I(0,e));return}n(e)}),f(t.ui.dynamicCanvas,"mouseup",e=>{if(!t.currentSongData)return;const i=T(t.currentInstrument);if(t.wasDragged&&t.draggedNoteIndex){const o=t.ui.dynamicCanvas.getBoundingClientRect(),r=e.clientY-o.top,{neckTopY:s,neckHeight:a}=M(),c=a/i.numStrings,l=Math.max(0,Math.min(i.numStrings-1,Math.round((r-s)/c-.5))),{eventIndex:g,noteIndex:p}=t.draggedNoteIndex,d=t.editedTablature[g].notes[p],m=d.pitch-i.tuning[l];m>=0&&m<=i.numFrets&&l!==d.string&&(d.string=l,d.fret=m,t.pendingEdits=!0)}else if(t.isEditMode&&!t.wasDragged){const o=tt(e.clientX,e.clientY);o&&(t.selectedNoteIndex&&t.selectedNoteIndex.eventIndex===o.eventIndex&&t.selectedNoteIndex.noteIndex===o.noteIndex?E():W(o))}t.isDragging=!1,t.draggedNoteIndex=null,t.wasDragged=!1,h(t.ui.dynamicCanvas,{grabbing:!1}),I()}),f(t.ui.dynamicCanvas,"mouseleave",()=>{t.isDragging&&(t.isDragging=!1,t.draggedNoteIndex=null,t.wasDragged=!1,h(t.ui.dynamicCanvas,{grabbing:!1}),I())})}function Ee(){f(t.ui.minimapCanvas,"mousedown",i=>{if(!t.currentSongData)return;t.isScrubbingMinimap=!0,Zt(),Tt(!0);const{mode:o}=at(i);t.dragMode=o,vt(i)});const n=mt(vt,16);f(window,"mousemove",i=>{if(t.isScrubbingMinimap)n(i);else{if(!t.currentSongData||t.isEditMode){t.ui.minimapCanvas.style.cursor="pointer";return}const{mode:o}=at(i);t.ui.minimapCanvas.style.cursor=o==="start"||o==="end"?"ew-resize":"pointer"}});function e(){t.isScrubbingMinimap&&(t.isScrubbingMinimap=!1,t.dragMode=null,requestAnimationFrame(()=>Tt(!1)))}f(window,"mouseup",e),f(window,"mouseleave",e)}function Pe(){function n(){const o=t.ui.fullscreenBtn.innerHTML;t.ui.fullscreenBtn.textContent="Fullscreen N/A",t.ui.fullscreenBtn.disabled=!0,setTimeout(()=>{t.ui.fullscreenBtn.innerHTML=o,t.ui.fullscreenBtn.disabled=!1},2500)}f(t.ui.fullscreenBtn,"click",async()=>{if(!document.fullscreenEnabled){n();return}try{document.fullscreenElement?await document.exitFullscreen():await document.documentElement.requestFullscreen()}catch(o){v.log(o,"Fullscreen"),n()}}),f(t.ui.tunerNavBtn,"click",le),f(t.ui.summaryBackBtn,"click",st),f(t.ui.tunerBackBtn,"click",st);const e=()=>{h(t.ui.settingsMenu,{open:!1}),h(t.ui.settingsBackdrop,{open:!1})};f(t.ui.settingsBtn,"click",o=>{o.stopPropagation(),h(t.ui.settingsMenu,{open:!0}),h(t.ui.settingsBackdrop,{open:!0})}),f(t.ui.settingsBackdrop,"click",e),f(document,"click",o=>{!t.ui.settingsMenuContent.contains(o.target)&&!t.ui.settingsBtn.contains(o.target)&&e()}),f(document,"keydown",o=>{if(o.target.tagName==="INPUT"||(o.code==="Space"&&!t.ui.practice.classList.contains("hidden")&&(o.preventDefault(),t.isEditMode||(t.isPlaying?t.isPaused?pt():ft():z())),!t.isEditMode))return;const r=(o.metaKey||o.ctrlKey)&&o.key==="z"&&!o.shiftKey,s=(o.metaKey||o.ctrlKey)&&(o.key==="y"||o.key==="z"&&o.shiftKey);r&&(o.preventDefault(),Pt()),s&&(o.preventDefault(),Ft())}),f(window,"resize",mt(gt,100));const i=()=>h(t.ui.aiAdviceModal,{hidden:!0});f(t.ui.aiAdviceCloseBtn,"click",i),f(t.ui.aiAdviceModal,"click",o=>{o.target===t.ui.aiAdviceModal&&i()}),f(t.ui.getAiAdviceBtn,"click",async()=>{if(!t.currentSongData||t.loopEndTime===null)return;h(t.ui.aiAdviceModal,{hidden:!1}),h(t.ui.aiAdviceLoading,{hidden:!1}),t.ui.aiAdviceContent.innerHTML="",t.ui.aiAdviceContent.appendChild(t.ui.aiAdviceLoading);const o=t.currentSongData.tablature.filter(s=>s.notes[0].startTime>=t.loopStartTime&&s.notes[0].startTime<t.loopEndTime).flatMap(s=>s.notes),r=await ve(o,t.currentInstrument);h(t.ui.aiAdviceLoading,{hidden:!0}),t.ui.aiAdviceContent.innerHTML=r})}function Fe(){Me(),Ne(),De(),we(),ke(),Ee(),Pe()}function Ae(){se(),Ut(),fe(),Bt(),Fe(),j(t.ui.library)}document.addEventListener("DOMContentLoaded",Ae);
