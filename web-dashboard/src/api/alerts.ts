import { http } from './http';
import { ApiSuccess } from './http';

export interface Alert {
  id: string;
  alertId: string;
  type: 'overflow' | 'full' | 'maintenance' | 'offline';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  binId: string;
  timestamp: string;
  status: 'active' | 'resolved';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  currentLevel?: number;
}

export interface AlertSummary {
  totalAlerts: number;
  activeAlerts: number;
  resolvedToday: number;
  byType: {
    overflow: number;
    maintenance: number;
    offline: number;
    full: number;
  };
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export const alertsAPI = {
  getAlerts: async (params?: {
    status?: 'active' | 'resolved';
    type?: 'overflow' | 'full' | 'maintenance' | 'offline';
    limit?: number;
  }): Promise<Alert[]> => {
    const response = await http.get<ApiSuccess<Alert[]>>('/alerts', { params });
    return response.data.data;
  },

  getAlertSummary: async (): Promise<AlertSummary> => {
    const response = await http.get<ApiSuccess<AlertSummary>>('/alerts/summary');
    return response.data.data;
  },
};












