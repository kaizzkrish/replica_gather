import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './hooks/useAuth';
import Game from './components/Game';
import Chat from './components/Chat';
import Auth from './components/Auth';
import Profile from './components/Profile';
import './styles/index.css';

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

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    setCurrUser({
      sub: user.sub,
      name: user.name,
      picture: user.picture || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png',
      email: (user as any).email || `guest-${guestUserId}@example.com`,
      customization: { skinColor: '#ffdbac', hairColor: '#4b2c20', hairStyle: 'default', outfitColor: '#646cff', outfitId: 'basic' }
    });

    let socketUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/' : 'http://localhost:707');
    
    // 🔥 Force IP detection as priority for AWS/IP based deployment
    const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(window.location.hostname);
    if (isIP || window.location.hostname !== 'localhost') {
      socketUrl = `http://${window.location.hostname}:707`;
    }

    console.log('📡 Game attempting to connect to:', socketUrl);

    const newSocket = io(socketUrl, {
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
            <div className="user-header">
              {currUser?.picture ? (
                <img
                  src={currUser.picture}
                  alt=""
                  className="user-avatar-small"
                  style={{ objectFit: 'cover' }}
                  onClick={() => setShowProfile(true)}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) {
                      const placeholder = document.createElement('div');
                      placeholder.className = 'user-avatar-small-placeholder';
                      placeholder.innerText = (currUser?.name || '?')[0];
                      placeholder.onclick = () => setShowProfile(true);
                      parent.appendChild(placeholder);
                    }
                  }}
                />
              ) : (
                <div
                  className="user-avatar-small-placeholder"
                  onClick={() => setShowProfile(true)}
                >
                  {(currUser?.name || user?.name || '?')[0]}
                </div>
              )}
              <span onClick={() => setShowProfile(true)}>
                Welcome, <strong>{currUser?.name || user?.name}</strong>!
              </span>
              <button 
                onClick={() => logout()}
                style={{ 
                  background: 'rgba(255, 0, 0, 0.2)', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '12px', 
                  padding: '4px 10px', 
                  cursor: 'pointer',
                  fontSize: '0.75rem' 
                }}
              >
                LOGOUT
              </button>
            </div>

            <div className="app-title-card">
               <h1>Our Princess Home</h1>
            </div>

            <Chat socket={socket} user={currUser || user} />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
