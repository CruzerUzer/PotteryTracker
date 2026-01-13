import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, tokenManager } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check if we have a token before making API call
      const token = tokenManager.getAccessToken();

      if (!token) {
        // No token means user is not authenticated
        setUser(null);
        setLoading(false);
        return;
      }

      // We have a token, verify it with the backend
      const currentUser = await authAPI.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Auth check failed:', error);
      // If auth check fails, clear tokens and set user to null
      tokenManager.clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const user = await authAPI.login(username, password);
    setUser(user);
    return user;
  };

  const register = async (username, password) => {
    const user = await authAPI.register(username, password);
    setUser(user);
    return user;
  };

  const logout = async () => {
    await authAPI.logout();
    setUser(null);
  };

  const isAdmin = user?.is_admin === true;

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

