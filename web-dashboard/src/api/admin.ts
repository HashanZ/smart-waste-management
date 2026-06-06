import { http, ApiSuccess } from './http';

export interface MLHealthStatus {
  healthy: boolean;
  latencyMs: number;
  model_trained?: boolean;
  model_path?: string | null;
}

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export const adminAPI = {
  getMLHealth: async (): Promise<MLHealthStatus> => {
    const response = await http.get<ApiSuccess<MLHealthStatus>>('/admin/ml/health');
    return response.data.data;
  },

  getCollectors: async (): Promise<User[]> => {
    const response = await http.get<ApiSuccess<User[]>>('/admin/users', {
      params: { role: 'collector', limit: 100 }
    });
    return (response.data as any).data || [];
  },

  getUsers: async (params?: { role?: string; page?: number; limit?: number }): Promise<User[]> => {
    const response = await http.get<ApiSuccess<User[]>>('/admin/users', { params });
    return (response.data as any).data || [];
  },
};







