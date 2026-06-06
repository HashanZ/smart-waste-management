import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Use same origin (proxy) when API is localhost, so CRA proxy forwards to backend
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
    const socketUrl =
      !apiUrl || apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')
        ? 'http://localhost:3000'
        : apiUrl.replace('/api', '');
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket connected');

      // Join role-based rooms for real-time updates
      // For admin and municipal officer roles, join their respective rooms
      if (user) {
        const role = user.role || 'user';
        newSocket.emit('join-role', role);
        console.log(`Joined role room: ${role}`);

        // Also join admin room if user is admin or municipal officer
        if (role === 'admin' || role === 'municipal_officer') {
          newSocket.emit('join-role', 'admin');
        }
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user]);

  // Re-join rooms when user changes
  useEffect(() => {
    if (socket && socket.connected && user) {
      const role = user.role || 'user';
      socket.emit('join-role', role);
      if (role === 'admin' || role === 'municipal_officer') {
        socket.emit('join-role', 'admin');
      }
    }
  }, [socket, user]);

  const value: SocketContextType = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};










































