import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth0 } from '@auth0/auth0-react';
import Game from './components/Game';
import Chat from './components/Chat';
import Auth from './components/Auth';
import './App.css';

function App() {
  const { isAuthenticated, user, isLoading, logout } = useAuth0();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

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
            <span>Welcome, <strong>{user?.name}</strong>!</span>
            <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })} className="logout-btn">
              Logout
            </button>
          </div>
          <h1>Gather Replica</h1>
          <div className="main-layout">
            <Game socket={socket} user={user} />
            <Chat socket={socket} />
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
