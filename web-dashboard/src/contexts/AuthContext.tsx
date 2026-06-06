import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import toast from 'react-hot-toast';
import { loginApi, registerApi, meApi, User as ApiUser, RegisterRequest } from '../api/auth';

type User = ApiUser;

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const me = await meApi();
          setUser(me);
        }
      } catch (err) {
        console.error('Failed to load current user', err);
        localStorage.removeItem('token');
      } finally {
        setIsLoading(false);
      }
    };
    void init();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await loginApi({ email, password });
      localStorage.setItem('token', data.token);
      setUser(data.user);
      toast.success('Logged in successfully');
    } catch (error) {
      console.error('Login error:', error);
      toast.error((error as Error).message || 'Login failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest) => {
    setIsLoading(true);
    try {
      const data = await registerApi(userData);
      localStorage.setItem('token', data.token);
      setUser(data.user);
      toast.success('Account created successfully');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error((error as Error).message || 'Registration failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    toast.success('Logged out');
  };

  const refreshUser = async () => {
    try {
      const me = await meApi();
      setUser(me);
    } catch (error) {
      console.error('Failed to refresh user', error);
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    refreshUser,
    isLoading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};







