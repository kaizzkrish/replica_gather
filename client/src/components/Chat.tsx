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
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!socket) return;

        socket.on('newMessage', (msg: Message) => {
            setMessages((prev) => [...prev, msg]);
        });

        return () => {
            socket.off('newMessage');
        };
    }, [socket]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && socket) {
            socket.emit('chatMessage', inputValue);
            setInputValue('');
        }
    };

    return (
        <div className="chat-container">
            <div className="messages-list">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.id === socket?.id ? 'own-message' : ''}`}>
                        <span className="msg-time">{msg.timestamp}</span>
                        <span className="msg-id">{msg.name || msg.id.substring(0, 5)}: </span>
                        <span className="msg-text">{msg.message}</span>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="chat-input-form">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                />
                <button type="submit">Send</button>
            </form>
        </div>
    );
};

export default Chat;
