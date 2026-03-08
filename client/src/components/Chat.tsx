import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';

interface Message {
    id: string; // socketId of sender
    senderUserId: string; // persistent userId
    name: string;
    message: string;
    timestamp: string;
    to: string; // 'global' or userId
    isRead?: boolean;
    picture?: string;
}

interface ChatProps {
    socket: Socket | null;
    user?: any;
}

interface PlayerStatus {
    id: string; // socketId
    userId: string;
    name: string;
    picture: string;
    isOnline: boolean;
    lastSeen?: string;
}

interface ChatItem {
    id: string; // 'global' or persistent userId
    name: string;
    lastMessage: string;
    lastTime: string;
    picture?: string;
    unreadCount: number;
    isOnline?: boolean;
    lastSeen?: string;
}

const Chat: React.FC<ChatProps> = ({ socket, user }) => {
    const userId = user?.sub;
    const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>({ 'global': [] });
    const [activeChatId, setActiveChatId] = useState<string>('global');
    const [inputValue, setInputValue] = useState('');
    const [players, setPlayers] = useState<Record<string, PlayerStatus>>({});
    const [isExpanded, setIsExpanded] = useState(false);
    const [unreadTotal, setUnreadTotal] = useState(0);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!socket) return;

        socket.on('currentPlayers', (playerMap: any) => {
            const newPlayers: Record<string, PlayerStatus> = {};
            Object.keys(playerMap).forEach(sid => {
                if (sid === socket.id) return;
                const p = playerMap[sid];
                if (p.userId) {
                    newPlayers[p.userId] = {
                        id: sid,
                        userId: p.userId,
                        name: p.name,
                        picture: p.picture,
                        isOnline: true
                    };
                }
            });
            setPlayers(prev => ({ ...prev, ...newPlayers }));
        });

        socket.on('newPlayer', (player: any) => {
            if (player.id === socket.id) return;
            setPlayers(prev => ({
                ...prev,
                [player.userId]: {
                    id: player.id,
                    userId: player.userId,
                    name: player.name,
                    picture: player.picture,
                    isOnline: true
                }
            }));
        });

        socket.on('playerDisconnected', (socketId: string) => {
            setPlayers(prev => {
                const next = { ...prev };
                const entry = Object.values(next).find(p => p.id === socketId);
                if (entry) {
                    next[entry.userId] = {
                        ...next[entry.userId],
                        isOnline: false,
                        lastSeen: new Date().toISOString()
                    };
                }
                return next;
            });
        });

        socket.on('userStatusChange', (data: { userId: string, isOnline: boolean, lastSeen: string }) => {
            setPlayers(prev => ({
                ...prev,
                [data.userId]: {
                    ...(prev[data.userId] || { name: 'User', picture: '' }),
                    userId: data.userId,
                    isOnline: data.isOnline,
                    lastSeen: data.lastSeen
                }
            }));
        });

        socket.on('chatHistory', (history: Message[]) => {
            const historyMap: Record<string, Message[]> = { 'global': [] };
            const historyPlayers: Record<string, any> = {};

            history.forEach(msg => {
                let chatKey = 'global';
                if (msg.to && msg.to !== 'global') {
                    const isFromMe = msg.senderUserId === userId;
                    chatKey = isFromMe ? msg.to : msg.senderUserId;
                }
                historyMap[chatKey] = [...(historyMap[chatKey] || []), msg];

                // Collect profile data from history for sidebar
                if (msg.senderUserId !== userId && msg.picture) {
                    historyPlayers[msg.senderUserId] = {
                        userId: msg.senderUserId,
                        name: msg.name,
                        picture: msg.picture,
                        isOnline: false // Will be updated by currentPlayers/newPlayer if online
                    };
                }
            });

            if (Object.keys(historyPlayers).length > 0) {
                setPlayers(prev => ({ ...historyPlayers, ...prev }));
            }
            setChatHistory(historyMap);
        });

        socket.on('newMessage', (msg: Message) => {
            let chatKey = 'global';
            if (msg.to && msg.to !== 'global') {
                const isFromMe = msg.senderUserId === userId;
                chatKey = isFromMe ? msg.to : msg.senderUserId;
            }

            setChatHistory(prev => ({
                ...prev,
                [chatKey]: [...(prev[chatKey] || []), msg]
            }));

            if (!isExpanded && msg.senderUserId !== userId) {
                setUnreadTotal(prev => prev + 1);
            }
        });

        socket.on('profileUpdated', (pData: any) => {
            setPlayers(prev => ({
                ...prev,
                [pData.userId]: {
                    ...(prev[pData.userId] || { id: '', isOnline: true }),
                    name: pData.name,
                    picture: pData.picture
                }
            }));
        });

        socket.on('messagesMarkedRead', (data: { by: string }) => {
            setChatHistory(prev => {
                const thread = prev[data.by];
                if (!thread) return prev;
                return {
                    ...prev,
                    [data.by]: thread.map(m => (m.senderUserId === userId && m.to === data.by) ? { ...m, isRead: true } : m)
                };
            });
        });

        socket.emit('requestChatHistory');

        return () => {
            socket.off('newMessage');
            socket.off('currentPlayers');
            socket.off('newPlayer');
            socket.off('playerDisconnected');
            socket.off('chatHistory');
            socket.off('userStatusChange');
            socket.off('messagesMarkedRead');
            socket.off('profileUpdated');
        };
    }, [socket, userId, isExpanded]);

    // Seen Logic
    useEffect(() => {
        if (isExpanded && activeChatId !== 'global' && socket) {
            socket.emit('markAsRead', { partnerUserId: activeChatId });

            setChatHistory(prev => {
                const currentMsgs = prev[activeChatId];
                if (!currentMsgs) return prev;
                const hasUnread = currentMsgs.some(m => m.senderUserId !== userId && !m.isRead);
                if (!hasUnread) return prev;

                return {
                    ...prev,
                    [activeChatId]: currentMsgs.map(m =>
                        m.senderUserId !== userId ? { ...m, isRead: true } : m
                    )
                };
            });
        }
    }, [isExpanded, activeChatId, chatHistory[activeChatId]?.length, socket, userId]);

    // Sync unread total badge
    useEffect(() => {
        const allUnreadCount = Object.values(chatHistory)
            .flat()
            .filter(m => m.senderUserId !== userId && !m.isRead)
            .length;
        setUnreadTotal(allUnreadCount);

        if (isExpanded) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, isExpanded, userId]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() && socket) {
            socket.emit('chatMessage', {
                message: inputValue,
                to: activeChatId
            });
            setInputValue('');
        }
    };

    const getChatList = (): ChatItem[] => {
        const chats: Map<string, ChatItem> = new Map();

        const globalMsgs = chatHistory['global'] || [];
        const lastGlobal = globalMsgs[globalMsgs.length - 1];
        chats.set('global', {
            id: 'global',
            name: 'Global Group Chat',
            lastMessage: lastGlobal ? `${lastGlobal.name}: ${lastGlobal.message}` : 'Start a conversation...',
            lastTime: lastGlobal ? lastGlobal.timestamp : '',
            unreadCount: 0
        });

        const allThreadKeys = new Set([...Object.keys(chatHistory), ...Object.keys(players)]);
        allThreadKeys.forEach(key => {
            if (key === 'global' || key === userId) return;
            const player = players[key];
            const msgs = chatHistory[key] || [];
            const last = msgs[msgs.length - 1];

            // Priority: Players state (online) > Last message (history) > Default
            const name = player?.name || (last ? last.name : 'Unknown');
            const picture = player?.picture || (last ? last.picture : undefined);

            chats.set(key, {
                id: key,
                name,
                picture,
                lastMessage: last ? last.message : 'Private chat',
                lastTime: last ? last.timestamp : '',
                unreadCount: msgs.filter(m => m.senderUserId !== userId && !m.isRead).length,
                isOnline: player?.isOnline,
                lastSeen: player?.lastSeen
            });
        });

        return Array.from(chats.values()).sort((a, b) => {
            if (a.id === 'global') return -1;
            if (b.id === 'global') return 1;
            return 0;
        });
    };

    const currentChatItem = getChatList().find(c => c.id === activeChatId) || getChatList()[0];
    const messages = chatHistory[activeChatId] || [];

    const formatLastSeen = (iso?: string) => {
        if (!iso) return 'Offline';
        const date = new Date(iso);
        return `last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    return (
        <>
            <div className="chat-floating-trigger" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? (
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                ) : (
                    <>
                        <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                        </svg>
                        {unreadTotal > 0 && <span className="unread-badge">{unreadTotal}</span>}
                    </>
                )}
            </div>

            <div className={`chat-app-container ${isExpanded ? 'expanded' : ''}`}>
                <div className="sidebar">
                    <div className="sidebar-header">
                        <div className="user-icon" onClick={() => (window as any).dispatchEvent(new CustomEvent('toggle-profile'))}>
                            {user?.picture ? (
                                <img
                                    src={user.picture}
                                    alt=""
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const parent = (e.target as HTMLImageElement).parentElement;
                                        if (parent) {
                                            const fallback = document.createElement('div');
                                            fallback.innerText = (user?.name || '?')[0];
                                            fallback.style.cssText = "font-size: 1.2rem; color: #aebac1; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;";
                                            parent.appendChild(fallback);
                                        }
                                    }}
                                />
                            ) : (
                                <div style={{ fontSize: '1.2rem', color: '#aebac1' }}>{user?.name?.[0] || '👤'}</div>
                            )}
                        </div>
                        <div className="sidebar-actions"><span>💬</span><span>⋮</span></div>
                    </div>
                    <div className="search-bar">
                        <div className="search-container">
                            <span className="search-icon">🔍</span>
                            <input type="text" placeholder="Search or start new chat" />
                        </div>
                    </div>
                    <div className="chat-list">
                        {getChatList().map(chat => (
                            <div
                                key={chat.id}
                                className={`chat-list-item ${activeChatId === chat.id ? 'active' : ''}`}
                                onClick={() => setActiveChatId(chat.id)}
                            >
                                <div className="avatar">
                                    {chat.picture ? (
                                        <img
                                            src={chat.picture}
                                            alt=""
                                            style={{ objectFit: 'cover' }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                const parent = (e.target as HTMLImageElement).parentElement;
                                                if (parent) {
                                                    const placeholder = document.createElement('div');
                                                    placeholder.className = 'avatar-placeholder';
                                                    placeholder.innerText = (chat.name || '?')[0];
                                                    parent.appendChild(placeholder);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="avatar-placeholder">{chat.name?.[0] || '?'}</div>
                                    )}
                                    {chat.isOnline && <div className="online-indicator"></div>}
                                </div>
                                <div className="chat-info">
                                    <div className="chat-top">
                                        <span className={`chat-name text-truncate ${chat.unreadCount > 0 ? 'unread' : ''}`}>{chat.name}</span>
                                        <span className="chat-time">{chat.lastTime}</span>
                                    </div>
                                    <div className="chat-bottom">
                                        <span className={`chat-preview text-truncate ${chat.unreadCount > 0 ? 'unread' : ''}`}>
                                            {chat.id !== 'global' && chatHistory[chat.id]?.slice(-1)[0]?.senderUserId === userId && (
                                                <span className={`status-checks-small ${chatHistory[chat.id]?.slice(-1)[0]?.isRead ? 'read' : ''}`}>✓✓ </span>
                                            )}
                                            {chat.lastMessage}
                                        </span>
                                        {chat.unreadCount > 0 && <span className="unread-count-bubble">{chat.unreadCount}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="chat-main-area">
                    <div className={`chat-header ${activeChatId === 'global' ? 'global' : 'personal'}`}>
                        <div className="avatar-small">
                            {currentChatItem.picture ? (
                                <img
                                    src={currentChatItem.picture}
                                    alt=""
                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const parent = (e.target as HTMLImageElement).parentElement;
                                        if (parent) {
                                            const placeholder = document.createElement('div');
                                            placeholder.className = 'avatar-placeholder';
                                            placeholder.innerText = (currentChatItem.name || '?')[0];
                                            parent.appendChild(placeholder);
                                        }
                                    }}
                                />
                            ) : (
                                <div className="avatar-placeholder">{currentChatItem.name?.[0] || '?'}</div>
                            )}
                        </div>
                        <div className="header-info">
                            <h3>{currentChatItem.name}</h3>
                            <p>
                                {activeChatId === 'global'
                                    ? `${Object.values(players).filter(p => p.isOnline).length + 1} online`
                                    : (currentChatItem.isOnline ? 'online' : formatLastSeen(currentChatItem.lastSeen))}
                            </p>
                        </div>
                    </div>

                    <div className="messages-list">
                        {messages.map((msg, index) => (
                            <div key={index} className={`message-bubble ${msg.senderUserId === userId ? 'sent' : 'received'}`}>
                                {activeChatId === 'global' && msg.senderUserId !== userId && <span className="sender-name">{msg.name}</span>}
                                <div className="message-content">
                                    <span className="text">{msg.message}</span>
                                    <span className="time">
                                        {msg.timestamp}
                                        {msg.senderUserId === userId && (
                                            <span className={`status-checks ${msg.isRead ? 'read' : ''}`}>✓✓</span>
                                        )}
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
                            placeholder="Type a message..."
                        />
                        <button type="submit" className="send-btn">
                            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

export default Chat;
