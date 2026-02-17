'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './recording.module.css';

type RecordingPhase = 'mic_select' | 'recording' | 'stopped';

interface TranscriptSegment {
    speaker: string;
    text: string;
    start: number;
    end: number;
}

interface RecordingWidgetProps {
    onClose: () => void;
    onSave: (data: {
        audioBlob: Blob | null;
        title: string;
        notes: string;
        duration: number;
        transcript: TranscriptSegment[];
    }) => void;
    whisperEndpoint?: string;
    whisperApiKey?: string;
}

export default function RecordingWidget({
    onClose,
    onSave,
    whisperEndpoint,
    whisperApiKey,
}: RecordingWidgetProps) {
    // ── State ──────────────────────────────────────────────
    const [phase, setPhase] = useState<RecordingPhase>('mic_select');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
    const [shortMeetingWarning, setShortMeetingWarning] = useState(false);

    // ── Refs ───────────────────────────────────────────────
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const startTimeRef = useRef(0);

    // ── Enumerate microphones ─────────────────────────────
    useEffect(() => {
        async function getMics() {
            try {
                // Need temporary permission to enumerate
                const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                tempStream.getTracks().forEach(t => t.stop());

                const allDevices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
                setDevices(audioInputs);
                if (audioInputs.length > 0) {
                    setSelectedDeviceId(audioInputs[0].deviceId);
                }
            } catch (err) {
                console.error('Mic permission denied:', err);
            }
        }
        getMics();
    }, []);

    // ── Audio level visualization ─────────────────────────
    const startAudioVisualizer = useCallback((stream: MediaStream) => {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
            analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(avg / 255);
            animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
    }, []);

    // ── Start Recording ───────────────────────────────────
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,
                },
            });

            streamRef.current = stream;
            startAudioVisualizer(stream);

            const recorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                    ? 'audio/webm;codecs=opus'
                    : 'audio/webm',
            });

            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.start(5000); // chunk every 5 seconds
            mediaRecorderRef.current = recorder;
            startTimeRef.current = Date.now();

            // Timer
            timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
            }, 1000);

            setPhase('recording');
        } catch (err) {
            console.error('Failed to start recording:', err);
            alert('Could not access the microphone. Please check permissions.');
        }
    }, [selectedDeviceId, startAudioVisualizer]);

    // ── Stop Recording ────────────────────────────────────
    const stopRecording = useCallback(() => {
        if (elapsed < 300) {
            // Less than 5 minutes
            setShortMeetingWarning(true);
            return;
        }
        doStop();
    }, [elapsed]);

    const doStop = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }

        streamRef.current?.getTracks().forEach(t => t.stop());

        setPhase('stopped');

        // Build audio blob
        setTimeout(() => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            onSave({
                audioBlob: blob,
                title: title || 'Untitled Meeting',
                notes,
                duration: elapsed,
                transcript,
            });
        }, 200);
    }, [title, notes, elapsed, transcript, onSave]);

    const forceStop = useCallback(() => {
        setShortMeetingWarning(false);
        doStop();
    }, [doStop]);

    const cancelStop = useCallback(() => {
        setShortMeetingWarning(false);
    }, []);

    // ── Cleanup on unmount ────────────────────────────────
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            streamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // ── Format time ───────────────────────────────────────
    const fmt = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    // ── Render: Mic Select ────────────────────────────────
    if (phase === 'mic_select') {
        return (
            <div className={styles.overlay}>
                <div className={styles.micModal}>
                    <button className={styles.modalClose} onClick={onClose}>✕</button>
                    <h2 className={styles.modalTitle}>Select microphone</h2>
                    <p className={styles.modalSub}>You can also change the microphone later during the meeting.</p>

                    <select
                        className={styles.micSelect}
                        value={selectedDeviceId}
                        onChange={e => setSelectedDeviceId(e.target.value)}
                    >
                        {devices.map(d => (
                            <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                            </option>
                        ))}
                    </select>

                    <button className={styles.startBtn} onClick={startRecording}>
                        ⚡ Start Amebo
                    </button>

                    <label className={styles.dontShowLabel}>
                        <input type="checkbox" />
                        Don&apos;t show again
                    </label>
                </div>
            </div>
        );
    }

    // ── Render: Scratchpad (Recording) ────────────────────
    return (
        <div className={styles.widget}>
            {/* Title bar */}
            <div className={styles.widgetHeader}>
                <button className={styles.expandBtn} title="Expand">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                    </svg>
                </button>
                <span className={styles.widgetTitle}>Scratchpad</span>
                <div className={styles.widgetControls}>
                    <button className={styles.winBtn} onClick={() => { }}>─</button>
                    <button className={styles.winBtn} onClick={() => { }}>□</button>
                    <button className={styles.winBtn} onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Scratchpad body */}
            <div className={styles.scratchpad}>
                <input
                    className={styles.meetingTitleInput}
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Meeting title..."
                />
                <textarea
                    className={styles.notesArea}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Write private notes..."
                />
            </div>

            {/* Short meeting warning */}
            {shortMeetingWarning && (
                <div className={styles.warningCard}>
                    <div className={styles.warningHeader}>
                        <span className={styles.warningIcon}>⏱</span>
                        <strong>Short meeting</strong>
                        <button className={styles.warningClose} onClick={cancelStop}>✕</button>
                    </div>
                    <p>Amebo works best with meetings of over 5 minutes. Continue?</p>
                    <label className={styles.dontShowLabel}>
                        <input type="checkbox" />
                        Don&apos;t show this message again
                    </label>
                    <div className={styles.warningActions}>
                        <button className={styles.cancelBtn} onClick={cancelStop}>Cancel &amp; continue</button>
                        <button className={styles.stopBtnRed} onClick={forceStop}>Stop</button>
                    </div>
                </div>
            )}

            {/* Bottom bar */}
            <div className={styles.bottomBar}>
                <span className={styles.timer}>{fmt(elapsed)}</span>
                <div className={styles.audioViz}>
                    <div className={styles.vizBar} style={{ transform: `scaleY(${0.3 + audioLevel * 0.7})` }} />
                    <div className={styles.vizBar} style={{ transform: `scaleY(${0.2 + audioLevel * 0.8})` }} />
                    <div className={styles.vizBar} style={{ transform: `scaleY(${0.4 + audioLevel * 0.6})` }} />
                    <div className={styles.vizBar} style={{ transform: `scaleY(${0.1 + audioLevel * 0.9})` }} />
                    <div className={styles.vizBar} style={{ transform: `scaleY(${0.35 + audioLevel * 0.65})` }} />
                </div>
                <button className={styles.micToggle} title="Mute microphone">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                </button>
                <button className={styles.stopBtn} onClick={stopRecording}>
                    <span className={styles.stopIcon} />
                    Stop
                </button>
            </div>
        </div>
    );
}
