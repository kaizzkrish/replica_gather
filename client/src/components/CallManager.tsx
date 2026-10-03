import React, { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import Peer from 'simple-peer';
import '../styles/callManager.css';
import { API_BASE } from '../config/env';

interface CallManagerProps {
    socket: Socket | null;
    user: any;
}

type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'reconnecting';

interface CallPeerInfo {
    userId: string;
    name: string;
    picture?: string;
}

// ICE reports 'disconnected' for brief, self-healing blips constantly (a wifi
// hiccup, a NAT re-binding) — only escalate to a full reconnect if it hasn't
// recovered on its own after this long, so day-long calls don't flap on
// every tiny network wobble.
const ICE_RECOVERY_GRACE_MS = 6000;

// Survives a page refresh (sessionStorage, not localStorage — a closed tab
// should NOT come back and auto-call someone hours later). How long after
// refreshing we'll still try to silently resume, and how long the *other*
// side will auto-accept a fresh invite from the same partner without
// re-showing the ring UI (their session saw us go offline, then saw us
// invite them again seconds later — that's a refresh, not a new call).
const RESUME_WINDOW_MS = 15000;
const CALL_SESSION_KEY = 'activeCallSession';

interface StoredCallSession extends CallPeerInfo {
    ts: number;
}

const CallManager: React.FC<CallManagerProps> = ({ socket, user }) => {
    const myUserId = user?.sub;
    const [status, setStatus] = useState<CallStatus>('idle');
    const [peerInfo, setPeerInfo] = useState<CallPeerInfo | null>(null);
    const [muted, setMuted] = useState(false);
    const [sharingScreen, setSharingScreen] = useState(false);
    const [remoteSharingScreen, setRemoteSharingScreen] = useState(false);
    const [elapsedSec, setElapsedSec] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const peerRef = useRef<Peer.Instance | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);
    const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const callStartRef = useRef<number>(0);
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const statusRef = useRef<CallStatus>('idle');
    const peerInfoRef = useRef<CallPeerInfo | null>(null);
    // Set only when a call ends because the partner dropped off the socket
    // (see handlePartnerOffline) — a fresh invite from this exact userId
    // within RESUME_WINDOW_MS is treated as them resuming after a refresh,
    // not a brand new call, so it's auto-accepted without re-ringing.
    const lastDroppedPartnerRef = useRef<{ userId: string, until: number } | null>(null);
    const hasAttemptedResumeRef = useRef(false);

    useEffect(() => { statusRef.current = status; }, [status]);
    useEffect(() => { peerInfoRef.current = peerInfo; }, [peerInfo]);

    // Persists "I'm actively on/attempting a call" across a page refresh.
    // Only while genuinely trying to connect — 'incoming' (not yet accepted)
    // is deliberately excluded, since there's nothing established to resume.
    useEffect(() => {
        if (!peerInfo) return;
        if (status === 'outgoing' || status === 'connecting' || status === 'connected' || status === 'reconnecting') {
            const session: StoredCallSession = { ...peerInfo, ts: Date.now() };
            sessionStorage.setItem(CALL_SESSION_KEY, JSON.stringify(session));
        }
    }, [status, peerInfo]);

    // Time-limited TURN credentials, fetched once per call attempt (not
    // cached across calls — they expire, and a fresh fetch is cheap).
    const fetchIceServers = async (): Promise<RTCIceServer[]> => {
        try {
            const res = await fetch(`${API_BASE}/api/turn-credentials?userId=${encodeURIComponent(myUserId || 'anon')}`);
            const data = await res.json();
            if (Array.isArray(data?.iceServers)) return data.iceServers;
        } catch (err) {
            console.warn('TURN credential fetch failed, falling back to STUN-only', err);
        }
        return [{ urls: 'stun:stun.l.google.com:19302' }];
    };

    const cleanupMedia = () => {
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        screenStreamRef.current?.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
    };

    const resetCallState = (opts?: { droppedByPartner?: boolean }) => {
        sessionStorage.removeItem(CALL_SESSION_KEY);
        if (opts?.droppedByPartner && peerInfoRef.current) {
            lastDroppedPartnerRef.current = { userId: peerInfoRef.current.userId, until: Date.now() + RESUME_WINDOW_MS };
        }
        if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
        peerRef.current?.destroy();
        peerRef.current = null;
        cleanupMedia();
        setStatus('idle');
        setPeerInfo(null);
        setMuted(false);
        setSharingScreen(false);
        setRemoteSharingScreen(false);
        setElapsedSec(0);
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
    };

    const attachIceWatcher = (pc: RTCPeerConnection, partnerUserId: string) => {
        pc.oniceconnectionstatechange = () => {
            const state = pc.iceConnectionState;
            if (state === 'connected' || state === 'completed') {
                if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
                setStatus('connected');
            } else if (state === 'disconnected') {
                setStatus('reconnecting');
                if (!recoveryTimerRef.current) {
                    recoveryTimerRef.current = setTimeout(() => {
                        recoveryTimerRef.current = null;
                        if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
                            renegotiate(partnerUserId, true);
                        }
                    }, ICE_RECOVERY_GRACE_MS);
                }
            } else if (state === 'failed') {
                if (recoveryTimerRef.current) { clearTimeout(recoveryTimerRef.current); recoveryTimerRef.current = null; }
                renegotiate(partnerUserId, true);
            }
        };
    };

    // Tears down the current peer and builds a fresh one from scratch, re-
    // using whatever local media (mic + screen-share, if active) was already
    // captured. A full fresh handshake is simpler and far more reliable than
    // trying to coax simple-peer through an in-place ICE restart, and the
    // ~1-2s blip is a fair trade for a call that's supposed to survive hours.
    const renegotiate = async (partnerUserId: string, asInitiator: boolean) => {
        if (!socket || !localStreamRef.current) return;
        setStatus('reconnecting');
        peerRef.current?.destroy();

        const iceServers = await fetchIceServers();
        iceServersRef.current = iceServers;
        const streams = [localStreamRef.current, ...(screenStreamRef.current ? [screenStreamRef.current] : [])];
        const peer = new Peer({
            initiator: asInitiator,
            trickle: false,
            streams,
            config: { iceServers },
        });
        wirePeerEvents(peer, partnerUserId);
        peerRef.current = peer;
    };

    const wirePeerEvents = (peer: Peer.Instance, partnerUserId: string) => {
        peer.on('signal', (signal) => {
            socket?.emit('call:signal', { toUserId: partnerUserId, signal });
        });

        peer.on('stream', (remoteStream: MediaStream) => {
            if (remoteStream.getVideoTracks().length > 0) {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
                setRemoteSharingScreen(true);
                remoteStream.getVideoTracks()[0].addEventListener('ended', () => setRemoteSharingScreen(false));
            } else if (remoteStream.getAudioTracks().length > 0) {
                if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
            }
        });

        peer.on('connect', () => {
            setStatus('connected');
            callStartRef.current = callStartRef.current || Date.now();
            const pc = (peer as any)._pc as RTCPeerConnection | undefined;
            if (pc) attachIceWatcher(pc, partnerUserId);
        });

        peer.on('close', () => {
            if (statusRef.current !== 'idle') resetCallState();
        });

        peer.on('error', (err) => {
            console.error('Call peer error:', err);
        });
    };

    const startCallAsInitiator = async (partner: CallPeerInfo) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            if (localAudioRef.current) localAudioRef.current.srcObject = stream;

            const iceServers = await fetchIceServers();
            iceServersRef.current = iceServers;
            const peer = new Peer({ initiator: true, trickle: false, streams: [stream], config: { iceServers } });
            wirePeerEvents(peer, partner.userId);
            peerRef.current = peer;
            setStatus('connecting');
        } catch (err) {
            console.error('Failed to get microphone for call:', err);
            setErrorMsg('Could not access your microphone.');
            resetCallState();
        }
    };

    const startCallAsCallee = async (partner: CallPeerInfo) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;
            if (localAudioRef.current) localAudioRef.current.srcObject = stream;
            setStatus('connecting');
            // Peer is created lazily when the caller's offer arrives via
            // 'call:signal' (see the socket listener below) — the callee
            // doesn't know the caller's ICE servers choice matters here;
            // what matters is accepting whatever offer signal shows up.
        } catch (err) {
            console.error('Failed to get microphone for call:', err);
            setErrorMsg('Could not access your microphone.');
            socket?.emit('call:decline', { toUserId: partner.userId });
            resetCallState();
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleCallRequest = (e: Event) => {
            const detail = (e as CustomEvent<CallPeerInfo>).detail;
            if (!detail?.userId || statusRef.current !== 'idle') return;
            setPeerInfo(detail);
            setStatus('outgoing');
            setErrorMsg(null);
            socket.emit('call:invite', { toUserId: detail.userId });
        };

        const handleIncoming = (data: { fromUserId: string, fromName: string, fromPicture?: string }) => {
            if (statusRef.current !== 'idle') {
                // Already on a call — silently unavailable, matches normal phone behavior.
                socket.emit('call:decline', { toUserId: data.fromUserId });
                return;
            }
            const partner: CallPeerInfo = { userId: data.fromUserId, name: data.fromName, picture: data.fromPicture };

            const dropped = lastDroppedPartnerRef.current;
            if (dropped && dropped.userId === data.fromUserId && Date.now() < dropped.until) {
                // They just reconnected after losing their own connection
                // (refresh/brief drop) — resume straight through, no re-ring.
                lastDroppedPartnerRef.current = null;
                socket.emit('call:accept', { toUserId: partner.userId });
                setPeerInfo(partner);
                startCallAsCallee(partner);
                return;
            }

            setPeerInfo(partner);
            setStatus('incoming');
        };

        const handleAccepted = (data: { byUserId: string }) => {
            if (statusRef.current !== 'outgoing' || peerInfoRef.current?.userId !== data.byUserId) return;
            startCallAsInitiator(peerInfoRef.current);
        };

        const handleDeclined = () => {
            if (statusRef.current !== 'outgoing') return;
            setErrorMsg(`${peerInfoRef.current?.name || 'They'} declined the call.`);
            resetCallState();
        };

        const handleUnavailable = () => {
            if (statusRef.current !== 'outgoing') return;
            setErrorMsg(`${peerInfoRef.current?.name || 'User'} is offline.`);
            resetCallState();
        };

        const handleSignal = (data: { fromUserId: string, signal: any }) => {
            if (!peerInfoRef.current || peerInfoRef.current.userId !== data.fromUserId) return;

            if (peerRef.current) {
                // Either the normal answer to our own offer, or (if we're
                // already 'connected') the other side renegotiating after a
                // drop — simple-peer's .signal() handles both transparently.
                peerRef.current.signal(data.signal);
                return;
            }

            // No local peer yet: we're the callee receiving the initial offer
            // (startCallAsCallee already grabbed our mic and is waiting), or
            // we're mid-reconnect and the other side renegotiated first.
            if (!localStreamRef.current) return;
            const streams = [localStreamRef.current, ...(screenStreamRef.current ? [screenStreamRef.current] : [])];
            const peer = new Peer({
                initiator: false,
                trickle: false,
                streams,
                config: { iceServers: iceServersRef.current },
            });
            wirePeerEvents(peer, data.fromUserId);
            peer.signal(data.signal);
            peerRef.current = peer;
        };

        const handleEnded = (data: { byUserId: string }) => {
            if (peerInfoRef.current?.userId === data.byUserId) resetCallState();
        };

        const handlePartnerOffline = (data: { userId?: string }) => {
            if (data?.userId && peerInfoRef.current?.userId === data.userId && statusRef.current !== 'idle') {
                setErrorMsg(`${peerInfoRef.current?.name || 'They'} disconnected.`);
                resetCallState({ droppedByPartner: true });
            }
        };

        window.addEventListener('call-request', handleCallRequest);
        socket.on('call:incoming', handleIncoming);
        socket.on('call:accepted', handleAccepted);
        socket.on('call:declined', handleDeclined);
        socket.on('call:unavailable', handleUnavailable);
        socket.on('call:signal', handleSignal);
        socket.on('call:ended', handleEnded);
        socket.on('userStatusChange', (d: { userId: string, isOnline: boolean }) => {
            if (!d.isOnline) handlePartnerOffline({ userId: d.userId });
        });

        return () => {
            window.removeEventListener('call-request', handleCallRequest);
            socket.off('call:incoming', handleIncoming);
            socket.off('call:accepted', handleAccepted);
            socket.off('call:declined', handleDeclined);
            socket.off('call:unavailable', handleUnavailable);
            socket.off('call:signal', handleSignal);
            socket.off('call:ended', handleEnded);
            socket.off('userStatusChange');
        };
    }, [socket, myUserId]);

    // Resume a call that was active when THIS tab last refreshed. Waits for
    // an actual 'connect' rather than just a non-null socket — React
    // StrictMode's dev-only double-invoke tears down and recreates the
    // socket once on mount, and firing on that first, soon-to-be-discarded
    // socket (before it's even connected) would burn the one-shot guard
    // without the invite ever really going anywhere.
    useEffect(() => {
        if (!socket) return;

        const attemptResume = () => {
            if (hasAttemptedResumeRef.current) return;
            hasAttemptedResumeRef.current = true;

            const raw = sessionStorage.getItem(CALL_SESSION_KEY);
            if (!raw) return;
            sessionStorage.removeItem(CALL_SESSION_KEY);

            try {
                const saved: StoredCallSession = JSON.parse(raw);
                if (Date.now() - saved.ts > RESUME_WINDOW_MS) return; // stale — don't surprise-call someone a minute later
                setPeerInfo({ userId: saved.userId, name: saved.name, picture: saved.picture });
                setStatus('outgoing');
                socket.emit('call:invite', { toUserId: saved.userId });
            } catch {
                // malformed entry, ignore
            }
        };

        if (socket.connected) attemptResume();
        else socket.once('connect', attemptResume);

        return () => { socket.off('connect', attemptResume); };
    }, [socket]);

    // Call duration ticker
    useEffect(() => {
        if (status !== 'connected') return;
        if (!callStartRef.current) callStartRef.current = Date.now();
        const interval = setInterval(() => {
            setElapsedSec(Math.floor((Date.now() - callStartRef.current) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [status]);

    const handleAccept = () => {
        if (!peerInfo || !socket) return;
        socket.emit('call:accept', { toUserId: peerInfo.userId });
        startCallAsCallee(peerInfo);
    };

    const handleDecline = () => {
        if (!peerInfo || !socket) return;
        socket.emit('call:decline', { toUserId: peerInfo.userId });
        resetCallState();
    };

    const handleCancelOutgoing = () => {
        resetCallState();
    };

    const handleEndCall = () => {
        if (peerInfo && socket) socket.emit('call:end', { toUserId: peerInfo.userId });
        resetCallState();
    };

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = muted; // currently muted -> enable; currently unmuted -> disable
        setMuted(!muted);
    };

    const toggleScreenShare = async () => {
        if (!peerInfo) return;
        if (sharingScreen) {
            screenStreamRef.current?.getTracks().forEach((t) => t.stop());
            if (screenStreamRef.current && peerRef.current) {
                peerRef.current.removeStream(screenStreamRef.current);
            }
            screenStreamRef.current = null;
            if (localVideoRef.current) localVideoRef.current.srcObject = null;
            setSharingScreen(false);
            return;
        }

        try {
            // audio: true matters even though system/tab audio capture is
            // actually granted by the Electron main process (see main.js's
            // setDisplayMediaRequestHandler, which passes audio: 'loopback')
            // — if this request itself says audio: false, Chromium drops
            // the audio track before it ever reaches the peer connection,
            // regardless of what the main process offered.
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            screenStreamRef.current = screenStream;
            if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
            if (peerRef.current) peerRef.current.addStream(screenStream);
            setSharingScreen(true);
            screenStream.getVideoTracks()[0].addEventListener('ended', () => {
                screenStreamRef.current = null;
                if (localVideoRef.current) localVideoRef.current.srcObject = null;
                setSharingScreen(false);
            });
        } catch (err) {
            console.warn('Screen share cancelled or failed:', err);
        }
    };

    const formatDuration = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
    };

    useEffect(() => {
        if (!errorMsg) return;
        const t = setTimeout(() => setErrorMsg(null), 4000);
        return () => clearTimeout(t);
    }, [errorMsg]);

    return (
        <>
            <audio ref={localAudioRef} muted autoPlay style={{ display: 'none' }} />
            <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

            {errorMsg && <div className="call-toast">{errorMsg}</div>}

            {status === 'outgoing' && peerInfo && (
                <div className="call-overlay">
                    <div className="call-card">
                        <div className="call-avatar">{peerInfo.picture ? <img src={peerInfo.picture} alt="" /> : peerInfo.name[0]}</div>
                        <p className="call-name-text">{peerInfo.name}</p>
                        <p className="call-status-text">Calling...</p>
                        <div className="call-actions-row">
                            <button className="call-round-btn call-round-end" onClick={handleCancelOutgoing} title="Cancel">
                                <i className="ph-fill ph-phone-x"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {status === 'incoming' && peerInfo && (
                <div className="call-overlay">
                    <div className="call-card">
                        <div className="call-avatar">{peerInfo.picture ? <img src={peerInfo.picture} alt="" /> : peerInfo.name[0]}</div>
                        <p className="call-name-text">{peerInfo.name}</p>
                        <p className="call-status-text">Incoming call...</p>
                        <div className="call-actions-row">
                            <button className="call-round-btn call-round-decline" onClick={handleDecline} title="Decline">
                                <i className="ph-fill ph-phone-x"></i>
                            </button>
                            <button className="call-round-btn call-round-accept" onClick={handleAccept} title="Accept">
                                <i className="ph-fill ph-phone"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(status === 'connecting' || status === 'connected' || status === 'reconnecting') && peerInfo && (
                <div className="call-bar">
                    <div className="call-bar-info">
                        <div className="call-avatar small">{peerInfo.picture ? <img src={peerInfo.picture} alt="" /> : peerInfo.name[0]}</div>
                        <div>
                            <div className="call-bar-name">{peerInfo.name}</div>
                            <div className={`call-bar-status status-${status}`}>
                                {status === 'connecting' && 'Connecting…'}
                                {status === 'reconnecting' && 'Reconnecting…'}
                                {status === 'connected' && (
                                    <>
                                        <i className="ph-fill ph-wifi-high"></i>
                                        Voice Connected · {formatDuration(elapsedSec)}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className={`call-screens ${(remoteSharingScreen || sharingScreen) ? '' : 'call-screens-empty'}`}>
                        <video
                            ref={remoteVideoRef}
                            className="call-screen-video"
                            style={{ display: remoteSharingScreen ? 'block' : 'none' }}
                            autoPlay
                            playsInline
                        />
                        <video
                            ref={localVideoRef}
                            className="call-screen-video self"
                            style={{ display: sharingScreen ? 'block' : 'none' }}
                            autoPlay
                            playsInline
                            muted
                        />
                    </div>

                    <div className="call-bar-actions">
                        <button className={`call-icon-btn ${muted ? 'active' : ''}`} onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                            <i className={`ph-bold ${muted ? 'ph-microphone-slash' : 'ph-microphone'}`}></i>
                        </button>
                        <button className={`call-icon-btn ${sharingScreen ? 'active' : ''}`} onClick={toggleScreenShare} title={sharingScreen ? 'Stop sharing' : 'Share screen'}>
                            <i className="ph-bold ph-monitor-play"></i>
                        </button>
                        <button className="call-icon-btn call-icon-end" onClick={handleEndCall} title="End call">
                            <i className="ph-bold ph-phone-x"></i>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default CallManager;
