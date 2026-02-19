'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './micDetector.module.css';

interface MicDetectorProps {
    onStartRecording: () => void;
    isRecording: boolean;
}

/**
 * MicDetector — Passively monitors mic activity.
 * When audio above threshold is detected, shows a floating widget
 * prompting the user to start recording with Amebo.
 */
export default function MicDetector({ onStartRecording, isRecording }: MicDetectorProps) {
    const [micActive, setMicActive] = useState(false);
    const [dismissed, setDismissed] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const contextRef = useRef<AudioContext | null>(null);

    const THRESHOLD = 15; // Audio level threshold to count as "active"
    const SILENCE_TIMEOUT = 5000; // 5s of silence before hiding

    const startMonitoring = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
            });

            streamRef.current = stream;
            setPermissionGranted(true);

            const audioContext = new AudioContext();
            contextRef.current = audioContext;
            const source = audioContext.createMediaStreamSource(stream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            analyserRef.current = analyser;

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const checkLevel = () => {
                if (!analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);

                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avg = sum / dataArray.length;
                setAudioLevel(Math.min(100, avg * 1.5));

                if (avg > THRESHOLD) {
                    setMicActive(true);
                    // Clear silence timer if speaking
                    if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                    }
                } else if (micActive) {
                    // Start silence timer
                    if (!silenceTimerRef.current) {
                        silenceTimerRef.current = setTimeout(() => {
                            setMicActive(false);
                            silenceTimerRef.current = null;
                        }, SILENCE_TIMEOUT);
                    }
                }

                animFrameRef.current = requestAnimationFrame(checkLevel);
            };

            checkLevel();
        } catch (err) {
            console.log('[MicDetector] Mic access denied or unavailable:', err);
        }
    }, [micActive]);

    const stopMonitoring = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (contextRef.current) {
            contextRef.current.close();
            contextRef.current = null;
        }
        analyserRef.current = null;
    }, []);

    useEffect(() => {
        // Check if mic permission is already granted
        navigator.permissions?.query({ name: 'microphone' as PermissionName }).then(result => {
            if (result.state === 'granted') {
                startMonitoring();
            }
        }).catch(() => {
            // Permissions API not supported, try directly
            startMonitoring();
        });

        return () => stopMonitoring();
    }, [startMonitoring, stopMonitoring]);

    // Re-enable after being dismissed for 30s
    useEffect(() => {
        if (dismissed) {
            const timer = setTimeout(() => setDismissed(false), 30000);
            return () => clearTimeout(timer);
        }
    }, [dismissed]);

    // Don't show if recording, dismissed, or no mic activity
    if (isRecording || dismissed || !micActive || !permissionGranted) {
        return null;
    }

    const handleRecord = () => {
        stopMonitoring();
        onStartRecording();
    };

    return (
        <div className={styles.widget}>
            <div className={styles.widgetInner}>
                {/* Pulsing mic indicator */}
                <div className={styles.micIndicator}>
                    <div className={styles.micPulse} />
                    <div className={styles.micIcon}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                    </div>
                </div>

                {/* Audio level bar */}
                <div className={styles.levelBar}>
                    <div
                        className={styles.levelFill}
                        style={{ width: `${audioLevel}%` }}
                    />
                </div>

                {/* Text */}
                <div className={styles.textContent}>
                    <p className={styles.title}>🎙️ Mic activity detected</p>
                    <p className={styles.subtitle}>It looks like you&apos;re in a meeting. Want Amebo to capture it?</p>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button className={styles.recordBtn} onClick={handleRecord}>
                        <span className={styles.recordDot} />
                        Start Recording
                    </button>
                    <button className={styles.dismissBtn} onClick={() => setDismissed(true)}>
                        Not now
                    </button>
                </div>
            </div>
        </div>
    );
}
