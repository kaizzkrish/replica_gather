import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
interface Message {
    id: string;
    name: string;
    message: string;
    timestamp: string;
}

interface ChatProps {
    socket: Socket | null;
}

const Chat: React.FC<ChatProps> = ({ socket }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [nearbyPlayers, setNearbyPlayers] = useState<{ ids: string[], names: string[] }>({ ids: [], names: [] });
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!socket) return;

        socket.on('newMessage', (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
        });

        const handleNearbyChange = (e: any) => {
            setNearbyPlayers({
                ids: e.detail.playerIds,
                names: e.detail.playerNames
            });
        };

        window.addEventListener('nearby-players-change', handleNearbyChange);

        return () => {
            socket.off('newMessage');
            window.removeEventListener('nearby-players-change', handleNearbyChange);
        };
    }, [socket]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && socket) {
            // If nearby players exist, target only them
            socket.emit('chatMessage', {
                message: inputValue,
                targets: nearbyPlayers.ids.length > 0 ? nearbyPlayers.ids : undefined
            });
            setInputValue('');
        }
    };

    const isProximity = nearbyPlayers.ids.length > 0;

    return (
        <div className="chat-container whatsapp-style">
            <div className={`chat-header ${isProximity ? 'proximity' : 'global'}`}>
                <div className="header-info">
                    <h3>{isProximity ? 'Proximity Chat' : 'Global Chat'}</h3>
                    <p>{isProximity ? `With: ${nearbyPlayers.names.join(', ')}` : 'Chat with everyone'}</p>
                </div>
            </div>

            <div className="messages-list">
                {messages.map((msg, index) => (
                    <div key={index} className={`message-bubble ${msg.id === socket?.id ? 'sent' : 'received'}`}>
                        {msg.id !== socket?.id && <span className="sender-name">{msg.name}</span>}
                        <div className="message-content">
                            <span className="text">{msg.message}</span>
                            <span className="time">
                                {msg.timestamp}
                                {msg.id === socket?.id && <span className="status-checks">✓✓</span>}
                            </span>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isProximity ? "Say something to nearby players..." : "Type a message for everyone..."}
                />
                <button type="submit" className="send-btn">
                    <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                </button>
            </form>
        </div>
    );
};

export default Chat;
