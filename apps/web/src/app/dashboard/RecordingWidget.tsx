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
        duration: number;
    }) => void;
}

export default function RecordingWidget({
    onClose,
    onSave,
}: RecordingWidgetProps) {
    // ── State ──────────────────────────────────────────────
    const [phase, setPhase] = useState<RecordingPhase>('mic_select');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [title, setTitle] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
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
                title: title || 'Dashboard Recording',
                duration: elapsed,
            });
        }, 200);
    }, [title, elapsed, onSave]);

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
                        <img src="/logo.svg" alt="Amebo Logo" width={16} height={16} /> Start Amebo
                    </button>

                    <label className={styles.dontShowLabel}>
                        <input type="checkbox" />
                        Don&apos;t show again
                    </label>
                </div>
            </div>
        );
    }

    // ── Render: Simple Timer UI ────────────────────
    return (
        <div className={styles.widget} style={{ width: '380px', minHeight: 'auto', borderRadius: '16px', overflow: 'hidden' }}>
            <div className={styles.widgetHeader} style={{ justifyContent: 'center', backgroundColor: '#f8f9fa', padding: '16px' }}>
                <span className={styles.widgetTitle} style={{ fontWeight: 600, color: '#333' }}>Recording Meeting</span>
            </div>

            <div className={styles.scratchpad} style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#fff' }}>
                <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: `radial-gradient(circle, rgba(239, 68, 68, ${0.1 + audioLevel * 0.4}) 0%, rgba(239, 68, 68, 0) 70%)` }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(239, 68, 68, 0.2)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </div>
                </div>

                <div style={{ fontSize: '32px', fontWeight: 'bold', fontFamily: 'monospace', color: '#111', marginTop: '16px' }}>
                    {fmt(elapsed)}
                </div>
                <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                    Speak clearly into the microphone
                </div>
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
            <div className={styles.bottomBar} style={{ justifyContent: 'center', backgroundColor: '#f8f9fa', padding: '16px' }}>
                <button className={styles.stopBtn} onClick={stopRecording} style={{ width: '100%', padding: '12px 24px', fontSize: '16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className={styles.stopIcon} style={{ marginRight: '8px' }} />
                    Stop Recording
                </button>
            </div>
        </div>
    );
}
