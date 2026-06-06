import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { SkipToContent } from '../utils/accessibility';

export const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 flex layout-container" style={{ margin: 0, padding: 0 }}>
      <SkipToContent />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col layout-container w-full min-w-0" style={{ margin: 0, padding: 0 }}>
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
          onLogout={handleLogout}
        />

        <main
          id="main-content"
          className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden"
          style={{ margin: 0 }}
          role="main"
          aria-label="Main content"
        >
          <div className="mx-auto max-w-7xl w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
