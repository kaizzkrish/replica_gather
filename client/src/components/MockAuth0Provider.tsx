import React, { createContext, useContext } from 'react';

const MockAuth0Context = createContext<any>({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  loginWithRedirect: () => {},
  logout: () => {},
  getAccessTokenSilently: () => Promise.resolve(''),
});

export const MockAuth0Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <MockAuth0Context.Provider value={{
            isAuthenticated: false,
            user: null,
            isLoading: false,
            loginWithRedirect: () => { window.location.href += "?guest=true" },
            logout: () => { window.location.href = window.location.origin },
            getAccessTokenSilently: () => Promise.resolve(''),
        }}>
            {children}
        </MockAuth0Context.Provider>
    );
};

// This is the trick: if we are on an insecure origin, we use this mock
export const useMockAuth0 = () => useContext(MockAuth0Context);
