import React, { useState, useEffect, useRef } from 'react';
import { Bars3Icon, BellIcon, SignalIcon } from '@heroicons/react/24/outline';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { alertsAPI, Alert } from '../api/alerts';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, XCircle, Trash2 } from 'lucide-react';

interface User {
  name?: string;
  email?: string;
  role?: string;
}

interface HeaderProps {
  onMenuClick: () => void;
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, user, onLogout }) => {
  const { isConnected, socket } = useSocket();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/bins': 'Waste Bins',
    '/collections': 'Collections',
    '/routes': 'Routes',
    '/analytics': 'Analytics',
    '/alerts': 'Alerts',
    '/settings': 'Settings',
  };
  const pageTitle = pageTitles[location.pathname] ?? 'SmartWaste';

  type UserRole = 'admin' | 'municipal_officer' | 'supervisor' | 'collector';
  const roleLabels: Record<UserRole, { label: string; color: string }> = {
    admin: { label: 'Admin', color: 'bg-red-500' },
    municipal_officer: { label: 'Officer', color: 'bg-blue-500' },
    supervisor: { label: 'Supervisor', color: 'bg-purple-500' },
    collector: { label: 'Collector', color: 'bg-emerald-500' },
  };
  const userRole = (authUser?.role as UserRole) ?? 'collector';
  const roleMeta = roleLabels[userRole] ?? roleLabels.collector;
  const initials = authUser
    ? `${authUser.firstName?.[0] ?? ''}${authUser.lastName?.[0] ?? ''}`.toUpperCase()
    : 'U';
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Fetch active alerts for notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const alerts = await alertsAPI.getAlerts({ status: 'active', limit: 10 });
        setNotifications(alerts);
        setUnreadCount(alerts.length);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };

    fetchNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for real-time alert updates
  useEffect(() => {
    if (!socket) return;

    socket.on('alert:new', (data: any) => {
      console.log('New alert notification:', data);
      // Add new alert to notifications
      const newAlert: Alert = {
        id: `alert-${Date.now()}`,
        alertId: data.alertId || `alert-${Date.now()}`,
        type: data.type || 'overflow',
        severity: data.severity || 'high',
        title: data.title || `Alert: ${data.type} - Bin ${data.binId}`,
        description: data.description || `Bin ${data.binId} requires attention`,
        binId: data.binId,
        timestamp: new Date().toISOString(),
        status: 'active',
        currentLevel: data.currentLevel,
      };
      setNotifications((prev) => [newAlert, ...prev].slice(0, 10));
      setUnreadCount((prev) => prev + 1);
    });

    return () => {
      socket.off('alert:new');
    };
  }, [socket]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };

    if (isNotificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationOpen]);

  const handleNotificationClick = () => {
    setIsNotificationOpen(!isNotificationOpen);
    if (unreadCount > 0) {
      setUnreadCount(0);
    }
  };

  const handleNotificationItemClick = (alert: Alert) => {
    setIsNotificationOpen(false);
    navigate('/alerts');
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'overflow':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'full':
        return <Trash2 className="h-4 w-4 text-orange-500" />;
      case 'maintenance':
        return <XCircle className="h-4 w-4 text-yellow-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <header
      className="bg-white shadow-lg border-b border-gray-200 backdrop-blur-sm header-container relative z-50"
      style={{
        margin: 0,
        padding: 0,
        width: '100%',
        flexShrink: 0
      }}
      role="banner"
      aria-label="Site header"
    >
      <div className="flex items-center justify-between h-14 sm:h-16 px-3 sm:px-4 md:px-6 lg:px-8" style={{ margin: 0 }}>
        {/* Left side - Menu button and title */}
        <div className="flex items-center flex-1 min-w-0">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 lg:hidden transition-all duration-200 touch-manipulation"
            aria-label="Toggle menu"
          >
            <Bars3Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
          <div className="hidden sm:flex items-center gap-2 ml-2 md:ml-4">
            <span className="text-base sm:text-lg font-bold text-gray-800 truncate">
              {pageTitle}
            </span>
          </div>
        </div>

        {/* Right side - Connection status, Notifications and user menu */}
        <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0">
          {/* Connection Status - Hidden on very small screens, icon only on small */}
          <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gray-50">
            <SignalIcon className={`h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ${isConnected ? 'text-emerald-500' : 'text-red-500'}`} />
            <span className={`text-xs sm:text-sm font-medium hidden xs:inline ${isConnected ? 'text-emerald-700' : 'text-red-700'}`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
            <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
          </div>

          {/* Notifications - Icon only on mobile */}
          <div className="relative z-[10000]" ref={notificationRef}>
            <button
              onClick={handleNotificationClick}
              className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-all duration-200 touch-manipulation"
              aria-label="Notifications"
              aria-expanded={isNotificationOpen}
            >
              <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-1 right-1 h-4 w-4 sm:h-5 sm:w-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  aria-label={`${unreadCount} new notifications`}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
            </button>

            {/* Notification Dropdown */}
            <AnimatePresence>
              {isNotificationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] max-h-[32rem] overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-green-50">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Notifications List */}
                  <div className="overflow-y-auto max-h-[28rem] custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-12 text-center">
                        <BellIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500 font-medium">No notifications</p>
                        <p className="text-xs text-gray-400 mt-1">You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {notifications.map((notification) => (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={() => handleNotificationItemClick(notification)}
                            className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-0.5">
                                {getAlertIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {notification.title}
                                  </p>
                                  <span
                                    className={`ml-2 flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${getSeverityColor(
                                      notification.severity
                                    )}`}
                                  >
                                    {notification.severity}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                  {notification.description}
                                </p>
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-500">
                                    {formatDistanceToNow(new Date(notification.timestamp), {
                                      addSuffix: true,
                                    })}
                                  </span>
                                  {notification.binId && (
                                    <span className="text-xs font-medium text-emerald-600">
                                      Bin {notification.binId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                      <button
                        onClick={() => {
                          setIsNotificationOpen(false);
                          navigate('/alerts');
                        }}
                        className="w-full text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        View all alerts →
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User menu */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="flex items-center space-x-2 sm:space-x-3 bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2">
              {/* Avatar with initials */}
              <div className="h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              {/* Name + email (md+) */}
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-gray-900 truncate max-w-[130px]">
                  {authUser ? `${authUser.firstName} ${authUser.lastName}` : user?.name || user?.email || 'User'}
                </p>
                <p className="text-[10px] text-gray-500 truncate max-w-[130px]">
                  {authUser?.email || user?.email || ''}
                </p>
              </div>
              {/* Role badge */}
              <span className={`hidden sm:inline-flex flex-shrink-0 text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${roleMeta.color}`}>
                {roleMeta.label}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="text-xs sm:text-sm text-gray-500 hover:text-red-600 focus:outline-none focus:underline transition-colors duration-200 px-2 py-1 rounded hover:bg-red-50 touch-manipulation"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
