/**
 * Responsive Utilities
 * Helper functions and hooks for responsive design
 */

import { useEffect, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface BreakpointConfig {
  xs: number; // 0px
  sm: number; // 640px
  md: number; // 768px
  lg: number; // 1024px
  xl: number; // 1280px
  '2xl': number; // 1536px
}

export const breakpoints: BreakpointConfig = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

/**
 * Hook to get current breakpoint
 */
export const useBreakpoint = (): Breakpoint => {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('sm');

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;

      if (width >= breakpoints['2xl']) {
        setBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setBreakpoint('md');
      } else if (width >= breakpoints.sm) {
        setBreakpoint('sm');
      } else {
        setBreakpoint('xs');
      }
    };

    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  return breakpoint;
};

/**
 * Hook to check if screen is mobile
 */
export const useIsMobile = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'xs' || breakpoint === 'sm';
};

/**
 * Hook to check if screen is tablet
 */
export const useIsTablet = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'md';
};

/**
 * Hook to check if screen is desktop
 */
export const useIsDesktop = (): boolean => {
  const breakpoint = useBreakpoint();
  return breakpoint === 'lg' || breakpoint === 'xl' || breakpoint === '2xl';
};

/**
 * Hook to get window dimensions
 */
export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
};

/**
 * Get responsive grid columns based on breakpoint
 */
export const getGridCols = (
  breakpoint: Breakpoint,
  config: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  }
): number => {
  switch (breakpoint) {
    case 'xs':
      return config.xs || 1;
    case 'sm':
      return config.sm || config.xs || 1;
    case 'md':
      return config.md || config.sm || config.xs || 2;
    case 'lg':
      return config.lg || config.md || config.sm || 2;
    case 'xl':
      return config.xl || config.lg || config.md || 3;
    case '2xl':
      return config['2xl'] || config.xl || config.lg || 4;
    default:
      return 1;
  }
};

/**
 * Check if device is touch-enabled
 */
export const isTouchDevice = (): boolean => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-ignore
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0)
  );
};

/**
 * Get responsive padding based on breakpoint
 */
export const getResponsivePadding = (breakpoint: Breakpoint): string => {
  switch (breakpoint) {
    case 'xs':
      return 'p-3';
    case 'sm':
      return 'p-4';
    case 'md':
      return 'p-5';
    case 'lg':
    case 'xl':
    case '2xl':
      return 'p-6';
    default:
      return 'p-4';
  }
};

/**
 * Get responsive text size based on breakpoint
 */
export const getResponsiveTextSize = (
  breakpoint: Breakpoint,
  size: 'sm' | 'md' | 'lg' | 'xl'
): string => {
  const sizeMap = {
    sm: { xs: 'text-sm', sm: 'text-sm', md: 'text-base', lg: 'text-base', xl: 'text-lg', '2xl': 'text-lg' },
    md: { xs: 'text-base', sm: 'text-base', md: 'text-lg', lg: 'text-xl', xl: 'text-xl', '2xl': 'text-2xl' },
    lg: { xs: 'text-lg', sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl', xl: 'text-4xl', '2xl': 'text-4xl' },
    xl: { xs: 'text-xl', sm: 'text-2xl', md: 'text-3xl', lg: 'text-4xl', xl: 'text-5xl', '2xl': 'text-6xl' },
  };

  return sizeMap[size][breakpoint] || sizeMap[size].sm;
};











