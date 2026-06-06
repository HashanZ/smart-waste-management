import { useEffect } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
}

/**
 * Hook for keyboard shortcuts
 * Provides keyboard navigation support
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const matches =
          event.key === shortcut.key &&
          (shortcut.ctrlKey === undefined || event.ctrlKey === shortcut.ctrlKey) &&
          (shortcut.shiftKey === undefined || event.shiftKey === shortcut.shiftKey) &&
          (shortcut.altKey === undefined || event.altKey === shortcut.altKey);

        if (matches) {
          // Don't trigger if user is typing in an input
          const target = event.target as HTMLElement;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          ) {
            return;
          }

          event.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

/**
 * Common keyboard shortcuts for the dashboard
 */
export const commonShortcuts: KeyboardShortcut[] = [
  {
    key: '/',
    action: () => {
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    },
    description: 'Focus search',
  },
  {
    key: 'Escape',
    action: () => {
      // Close modals, dropdowns, etc.
      const modals = document.querySelectorAll('[role="dialog"]');
      modals.forEach((modal) => {
        const closeButton = modal.querySelector('button[aria-label*="Close"], button[aria-label*="close"]') as HTMLButtonElement;
        if (closeButton) {
          closeButton.click();
        }
      });
    },
    description: 'Close dialogs',
  },
];











