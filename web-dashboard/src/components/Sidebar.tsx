import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  TrashIcon,
  TruckIcon,
  MapIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CogIcon,
  XMarkIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type UserRole = 'admin' | 'municipal_officer' | 'supervisor' | 'collector';

const allNavigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    roles: ['admin', 'municipal_officer', 'supervisor', 'collector'] as UserRole[],
  },
  {
    name: 'Bins',
    href: '/bins',
    icon: TrashIcon,
    roles: ['admin', 'municipal_officer', 'supervisor', 'collector'] as UserRole[],
  },
  {
    name: 'Collections',
    href: '/collections',
    icon: TruckIcon,
    roles: ['admin', 'municipal_officer', 'supervisor', 'collector'] as UserRole[],
  },
  {
    name: 'Routes',
    href: '/routes',
    icon: MapIcon,
    roles: ['admin', 'municipal_officer', 'supervisor', 'collector'] as UserRole[],
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    roles: ['admin', 'municipal_officer', 'supervisor'] as UserRole[],
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: ExclamationTriangleIcon,
    roles: ['admin', 'municipal_officer', 'supervisor'] as UserRole[],
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: CogIcon,
    roles: ['admin'] as UserRole[],
  },
];

const roleLabels: Record<UserRole, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-red-500' },
  municipal_officer: { label: 'Officer', color: 'bg-blue-500' },
  supervisor: { label: 'Supervisor', color: 'bg-purple-500' },
  collector: { label: 'Collector', color: 'bg-emerald-500' },
};

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();
  const { user } = useAuth();

  const userRole = (user?.role as UserRole) ?? 'collector';
  const navigation = allNavigation.filter((item) => item.roles.includes(userRole));
  const roleMeta = roleLabels[userRole] ?? roleLabels.collector;

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={onClose} />
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 border-r border-gray-200 lg:flex-shrink-0 flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ zIndex: 50 }}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-emerald-800/40 bg-gradient-to-r from-emerald-700 to-teal-700">
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center border border-white/30">
              <TrashIcon className="h-4 w-4 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">SmartWaste</h1>
              <p className="text-[10px] text-emerald-200 leading-tight">Management System</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-white hover:bg-white hover:bg-opacity-20 transition-all duration-200"
            aria-label="Close navigation menu"
            aria-expanded={isOpen}
          >
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Nav items — role-filtered */}
        <nav className="flex-1 mt-4 px-3 overflow-y-auto" aria-label="Main navigation">
          <ul className="space-y-1" role="list">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name} role="listitem">
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={`
                      group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                      ${isActive
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }
                    `}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon
                      className={`
                        mr-3 h-5 w-5 flex-shrink-0
                        ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}
                      `}
                      aria-hidden="true"
                    />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
};
