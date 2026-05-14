import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './hooks/useAuth';
import Game from './components/Game';
import Chat from './components/Chat';
import Auth from './components/Auth';
import Profile from './components/Profile';
import Sidebar from './components/Sidebar';
import { SOCKET_URL } from './config/env';
import './styles/index.css';
import './styles/sidebar.css';

function App() {
  const { isAuthenticated: authIsAuthenticated, user: authUser, isLoading: authIsLoading, logout } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const isGuestMode_Url = urlParams.get('guest') === 'true';

  const guestUserId = urlParams.get('userId') || '1';
  const isAuthenticated = authIsAuthenticated || isGuestMode_Url;
  
  // Choose user source: Auth hook (local login) or guest fallback
  const user = authIsAuthenticated ? authUser : (isGuestMode_Url ? {
    sub: `guest-explorer-${guestUserId}`,
    name: `Guest Explorer ${guestUserId}`,
    picture: 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png',
    email: `guest-${guestUserId}@example.com`
  } : null);

  const isLoading = authIsLoading;

  const [currUser, setCurrUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [activeSidebarItem, setActiveSidebarItem] = useState('connect');

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    setCurrUser({
      sub: user.sub,
      name: user.name,
      picture: user.picture || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png',
      email: (user as any).email || `guest-${guestUserId}@example.com`,
      customization: { skinColor: '#ffdbac', hairColor: '#4b2c20', hairStyle: 'default', outfitColor: '#646cff', outfitId: 'basic' }
    });

    console.log('📡 Game attempting to connect to:', SOCKET_URL);

    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
      timeout: 10000
    });
    setSocket(newSocket);

    const updateLocalUser = (pData: any) => {
      if (pData.userId === user.sub) {
        setCurrUser((prev: any) => ({
          ...prev,
          name: pData.name || user.name,
          picture: pData.picture || user.picture,
          customization: pData.customization || prev?.customization
        }));
      }
    };

    newSocket.on('connect', () => console.log('✅ Connected to Server:', newSocket.id));
    newSocket.on('connect_error', (err) => console.error('❌ Connection Error:', err));
    newSocket.on('disconnect', () => console.log('🔌 Disconnected from Server'));

    newSocket.on('profileSync', updateLocalUser);
    newSocket.on('profileUpdated', updateLocalUser);

    const handleOpenYouTube = () => {
      window.open('https://www.youtube.com', '_blank');
    };
    window.addEventListener('open-youtube' as any, handleOpenYouTube);

    return () => {
      newSocket.disconnect();
      window.removeEventListener('open-youtube' as any, handleOpenYouTube);
    };
  }, [isAuthenticated, user]);

  if (isLoading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <div className="App">
      {!isAuthenticated ? (
        <Auth />
      ) : (
        <>
          {showProfile && <Profile socket={socket} currUser={currUser} onClose={() => setShowProfile(false)} />}
          <Game socket={socket} user={currUser || user} />

          <div className="ui-overlay">
            <Sidebar 
              user={currUser || user} 
              onLogout={logout} 
              onProfileClick={() => setShowProfile(true)}
              activeItem={activeSidebarItem}
              onItemClick={(item) => {
                setActiveSidebarItem(item);
                if (item === 'chat') {
                  // If chat is clicked, we could toggle a global chat event or state
                  window.dispatchEvent(new CustomEvent('toggle-chat'));
                }
                if (item === 'settings') {
                  setShowProfile(true);
                }
              }}
            />

            <Chat socket={socket} user={currUser || user} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
