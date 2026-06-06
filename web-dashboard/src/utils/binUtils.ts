/**
 * Bin-related utility functions
 * Centralized functions for bin type colors, labels, and fill level calculations
 */

// Bin type color mappings (hex colors for maps/charts)
export const BIN_TYPE_COLORS_HEX: Record<string, string> = {
  general: '#6b7280',
  recyclable: '#3b82f6',
  organic: '#22c55e',
  hazardous: '#ef4444',
};

// Bin type color mappings (Tailwind classes for badges/components)
export const BIN_TYPE_COLORS_CLASSES: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700',
  recyclable: 'bg-blue-100 text-blue-700',
  organic: 'bg-green-100 text-green-700',
  hazardous: 'bg-red-100 text-red-700',
};

// Bin type labels
export const BIN_TYPE_LABELS: Record<string, string> = {
  general: 'General Waste',
  recyclable: 'Recyclable',
  organic: 'Organic',
  hazardous: 'Hazardous',
};

/**
 * Get bin type color as hex (for maps, charts, SVG)
 */
export const getBinTypeColorHex = (type: string): string => {
  return BIN_TYPE_COLORS_HEX[type] || BIN_TYPE_COLORS_HEX.general;
};

/**
 * Get bin type color as Tailwind classes (for badges, components)
 */
export const getBinTypeColorClasses = (type: string): string => {
  return BIN_TYPE_COLORS_CLASSES[type] || BIN_TYPE_COLORS_CLASSES.general;
};

/**
 * Get bin type label
 */
export const getBinTypeLabel = (type: string): string => {
  return BIN_TYPE_LABELS[type] || type;
};

/**
 * Get fill level color based on percentage
 * Returns Tailwind class for background color
 */
export const getFillLevelColor = (fillLevel: number): string => {
  if (fillLevel >= 90) return 'bg-red-500';
  if (fillLevel >= 70) return 'bg-amber-500';
  return 'bg-green-500';
};

/**
 * Get fill level color as hex (for charts, SVG)
 */
export const getFillLevelColorHex = (fillLevel: number): string => {
  if (fillLevel >= 90) return '#ef4444'; // red-500
  if (fillLevel >= 70) return '#f59e0b'; // amber-500
  return '#22c55e'; // green-500
};

/**
 * Get fill level status (normal, warning, critical)
 */
export const getFillLevelStatus = (fillLevel: number): 'normal' | 'warning' | 'critical' => {
  if (fillLevel >= 90) return 'critical';
  if (fillLevel >= 70) return 'warning';
  return 'normal';
};

/**
 * Check if bin is overflowing
 */
export const isBinOverflowing = (fillLevel: number, threshold: number = 90): boolean => {
  return fillLevel >= threshold;
};


