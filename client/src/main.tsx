import './polyfills';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.tsx'

const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSecure ? (
      <Auth0Provider
        domain="dev-ok6ae40ujzf8r7yh.us.auth0.com"
        clientId="JesibSqqqWnMUrpj0xWNmU9Bb5RVLxVT"
        authorizationParams={{
          redirect_uri: window.location.origin
        }}
        cacheLocation="localstorage"
        useRefreshTokens={true}
      >
        <App />
      </Auth0Provider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
