import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import Peer from 'simple-peer';

interface ProximityAudioProps {
    socket: Socket | null;
}

const ProximityAudio = ({ socket }: ProximityAudioProps) => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const peersRef = useRef<Map<string, Peer.Instance>>(new Map());
    const audioContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('⚠️ Proximity Audio requires a Secure Origin (HTTPS/Localhost). Audio disabled.');
            return;
        }

        // Request microphone access
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then((currentStream) => {
                setStream(currentStream);
            })
            .catch((err) => {
                console.error('Failed to get local stream', err);
            });

        return () => {
            stream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    useEffect(() => {
        if (!socket || !stream) return;

        const handleNearbyChange = (event: any) => {
            const nearbyIds: string[] = event.detail.playerIds;
            
            // 1. Identify players who are no longer nearby
            peersRef.current.forEach((peer, id) => {
                if (!nearbyIds.includes(id)) {
                    console.log(`📡 Disconnecting audio from ${id}`);
                    peer.destroy();
                    peersRef.current.delete(id);
                    // Remove audio element
                    const audioEl = document.getElementById(`audio-${id}`);
                    if (audioEl) audioEl.remove();
                }
            });

            // 2. Identify new nearby players to connect with
            nearbyIds.forEach((receiverId) => {
                if (!peersRef.current.has(receiverId)) {
                    // Only initiate if my ID is lexicographically smaller to avoid double connection
                    // Actually, simple-peer handles collision if we use proper signaling, 
                    // but a simple "initiator" logic based on ID is safer.
                    if (socket.id && socket.id < receiverId) {
                        console.log(`📡 Initiating audio connection to ${receiverId}`);
                        const peer = createPeer(receiverId, socket.id, stream);
                        peersRef.current.set(receiverId, peer);
                    }
                }
            });
        };

        const createPeer = (userToCall: string, callerId: string, stream: MediaStream) => {
            const peer = new Peer({
                initiator: true,
                trickle: false,
                stream,
            });

            peer.on('signal', (signal) => {
                socket.emit('call-user', {
                    to: userToCall,
                    from: callerId,
                    signal,
                });
            });

            peer.on('stream', (remoteStream) => {
                addRemoteAudio(userToCall, remoteStream);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                peer.destroy();
                peersRef.current.delete(userToCall);
            });

            return peer;
        };

        const addPeer = (incomingSignal: any, callerId: string, stream: MediaStream) => {
            const peer = new Peer({
                initiator: false,
                trickle: false,
                stream,
            });

            peer.on('signal', (signal) => {
                socket.emit('answer-call', { signal, to: callerId, from: socket.id });
            });

            peer.on('stream', (remoteStream) => {
                addRemoteAudio(callerId, remoteStream);
            });

            peer.on('error', (err) => {
                console.error('Peer error:', err);
                peer.destroy();
                peersRef.current.delete(callerId);
            });

            peer.signal(incomingSignal);
            return peer;
        };

        const addRemoteAudio = (id: string, remoteStream: MediaStream) => {
            if (document.getElementById(`audio-${id}`)) return;
            
            const audio = document.createElement('audio');
            audio.id = `audio-${id}`;
            audio.srcObject = remoteStream;
            audio.autoplay = true;
            if (audioContainerRef.current) {
                audioContainerRef.current.appendChild(audio);
            }
        };

        socket.on('incoming-call', (data: { signal: any, from: string }) => {
            console.log(`📡 Incoming audio call from ${data.from}`);
            // Check if we are already connected
            if (!peersRef.current.has(data.from)) {
                const peer = addPeer(data.signal, data.from, stream);
                peersRef.current.set(data.from, peer);
            }
        });

        socket.on('call-accepted', (data: { signal: any, from: string }) => {
            console.log(`📡 Audio call accepted from ${data.from}`);
            const peer = peersRef.current.get(data.from);
            if (peer && !peer.connected) {
                peer.signal(data.signal);
            }
        });

        window.addEventListener('nearby-players-change', handleNearbyChange);

        return () => {
            window.removeEventListener('nearby-players-change', handleNearbyChange);
            socket.off('incoming-call');
            socket.off('call-accepted');
            peersRef.current.forEach(peer => peer.destroy());
            peersRef.current.clear();
        };
    }, [socket, stream]);

    return (
        <div ref={audioContainerRef} style={{ display: 'none' }} />
    );
};

export default ProximityAudio;
