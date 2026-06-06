/**
 * Status-related utility functions
 * Centralized status color and icon mappings for different entity types
 */

/**
 * Get status color variant for bins
 */
export const getBinStatusColor = (status: string): 'danger' | 'success' | 'warning' | 'default' => {
  switch (status) {
    case 'overflowing':
      return 'danger';
    case 'active':
      return 'success';
    case 'maintenance':
      return 'warning';
    case 'inactive':
      return 'default';
    default:
      return 'default';
  }
};

/**
 * Get status color variant for routes
 */
export const getRouteStatusColor = (status: string): 'danger' | 'success' | 'info' | 'warning' | 'default' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'active':
      return 'info';
    case 'scheduled':
      return 'warning';
    case 'draft':
      return 'default';
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
};

/**
 * Get status color variant for collections
 */
export const getCollectionStatusColor = (status: string): 'danger' | 'success' | 'info' | 'warning' | 'default' => {
  switch (status) {
    case 'completed':
      return 'success';
    case 'in_progress':
      return 'info';
    case 'scheduled':
      return 'warning';
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
};

/**
 * Get alert severity color variant
 */
export const getAlertSeverityColor = (severity: string): 'danger' | 'warning' | 'info' | 'default' => {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'danger';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

/**
 * Get alert severity background color class
 */
export const getAlertSeverityBgColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'bg-red-100';
    case 'medium':
      return 'bg-amber-100';
    case 'low':
      return 'bg-blue-100';
    default:
      return 'bg-gray-100';
  }
};

/**
 * Get alert severity icon color class
 */
export const getAlertSeverityIconColor = (severity: string): string => {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-amber-600';
    case 'low':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};


