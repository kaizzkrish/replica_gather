import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';
import Game from './components/Game';
import Chat from './components/Chat';
import Auth from './components/Auth';
import Profile from './components/Profile';
import './styles/index.css';

function App() {
  const { isAuthenticated, user, isLoading } = useAuth0();
  const [currUser, setCurrUser] = useState<any>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Use a local user state initially from Auth0
    setCurrUser({
      sub: user.sub,
      name: user.name,
      picture: user.picture,
      email: user.email,
      customization: { skinColor: '#ffdbac', hairColor: '#4b2c20', hairStyle: 'default', outfitColor: '#646cff', outfitId: 'basic' }
    });

    const socketUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/' : 'http://localhost:3001');
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    // Sync local user view with DB data immediately on joining
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

    newSocket.on('profileSync', updateLocalUser);
    newSocket.on('profileUpdated', updateLocalUser);

    return () => {
      newSocket.disconnect();
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
          </div>
          {showProfile && <Profile socket={socket} currUser={currUser} onClose={() => setShowProfile(false)} />}
          <h1>Collabio</h1>
          <div className="main-layout">
            <Game socket={socket} user={currUser || user} />
            <Chat socket={socket} user={currUser || user} />
          </div>
          <div className="instructions">
            <p>Use arrow keys to move and type in chat.</p>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
