import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { decodeJwt } from '../utils/decodeJwt.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [expiredBanner, setExpiredBanner] = useState(false);
  const navigate = useNavigate();

  const login = useCallback((newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setExpiredBanner(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    navigate('/login', { state: { justLoggedOut: true } });
  }, [navigate]);

  useEffect(() => {
    function handleExpiry() {
      setToken(null);
      setExpiredBanner(true);
      navigate('/login');
    }
    window.addEventListener('auth:logout', handleExpiry);
    return () => window.removeEventListener('auth:logout', handleExpiry);
  }, [navigate]);

  const username = token ? decodeJwt(token)?.username : null;

  return (
    <AuthContext.Provider value={{ token, isAuthed: !!token, username, login, logout, expiredBanner, clearExpiredBanner: () => setExpiredBanner(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
