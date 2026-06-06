/**
 * Accessibility Utilities
 * Helper functions for accessibility features
 */

import React from 'react';

/**
 * Skip to main content link component
 * Allows keyboard users to skip navigation
 */
export const SkipToContent: React.FC = () => {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      onClick={(e) => {
        e.preventDefault();
        const main = document.getElementById('main-content');
        if (main) {
          main.focus();
          main.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }}
    >
      Skip to main content
    </a>
  );
};

/**
 * Get ARIA label for status badge
 */
export const getStatusAriaLabel = (status: string): string => {
  const statusMap: { [key: string]: string } = {
    active: 'Status: Active',
    inactive: 'Status: Inactive',
    maintenance: 'Status: Maintenance Required',
    overflowing: 'Status: Overflowing - Action Required',
    scheduled: 'Status: Scheduled',
    in_progress: 'Status: In Progress',
    completed: 'Status: Completed',
    cancelled: 'Status: Cancelled',
    resolved: 'Status: Resolved',
    critical: 'Severity: Critical',
    high: 'Severity: High',
    medium: 'Severity: Medium',
    low: 'Severity: Low',
  };
  return statusMap[status] || `Status: ${status}`;
};

/**
 * Get ARIA label for button based on action
 */
export const getButtonAriaLabel = (
  action: string,
  itemName?: string
): string => {
  if (itemName) {
    return `${action} ${itemName}`;
  }
  return action;
};

/**
 * Announce to screen readers
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Trap focus within a container (for modals, dropdowns)
 */
export const trapFocus = (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
};

/**
 * Check if element is visible in viewport
 */
export const isInViewport = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

/**
 * Scroll element into view with smooth behavior
 */
export const scrollIntoView = (element: HTMLElement, options?: ScrollIntoViewOptions) => {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    ...options,
  });
};

/**
 * Get accessible color contrast ratio
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  // Simplified contrast calculation
  // In production, use a library like 'tinycolor2' for accurate calculations
  return 4.5; // Placeholder - should be calculated based on actual colors
};

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Get accessible icon description
 */
export const getIconDescription = (iconName: string): string => {
  const descriptions: { [key: string]: string } = {
    trash: 'Waste bin',
    truck: 'Collection vehicle',
    map: 'Map location',
    chart: 'Analytics chart',
    alert: 'Alert notification',
    settings: 'Settings',
    home: 'Home dashboard',
    search: 'Search',
    filter: 'Filter',
    refresh: 'Refresh',
    close: 'Close',
    menu: 'Navigation menu',
    user: 'User account',
    bell: 'Notifications',
  };
  return descriptions[iconName.toLowerCase()] || iconName;
};
