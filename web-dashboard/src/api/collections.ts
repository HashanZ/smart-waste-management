import { http, ApiSuccess } from './http';

export interface Collection {
  _id: string;
  collectionId: string;
  binId: string;
  bin: {
    binId: string;
    binType: string;
    location: {
      coordinates?: [number, number];
      latitude?: number;
      longitude?: number;
      address?: string;
    };
  };
  collectorId: string;
  collector: {
    firstName: string;
    lastName: string;
    email: string;
  };
  scheduledDate: string;
  actualDate?: string;
  collectionDate?: string; // Legacy field, use scheduledDate
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'missed';
  wasteType: 'general' | 'recyclable' | 'organic' | 'hazardous';
  weight?: number;
  volume?: number;
  notes?: string;
  images?: string[];
  routeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionInput {
  collectionId: string;
  binId: string;
  collectorId: string;
  scheduledDate: string;
  wasteType: 'general' | 'recyclable' | 'organic' | 'hazardous';
  routeId?: string;
}

export interface UpdateCollectionInput {
  scheduledDate?: string;
  actualDate?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'missed';
  weight?: number;
  volume?: number;
  notes?: string;
  images?: string[];
}

export const collectionsAPI = {
  getCollections: async (params?: {
    status?: string;
    binId?: string;
    collectorId?: string;
    wasteType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Collection[]; total: number }> => {
    const response = await http.get<ApiSuccess<Collection[]>>('/collections', { params });
    // Backend returns { success, message, data: Collection[], pagination: { page, limit, total, pages } }
    const collections = response.data.data || [];
    const pagination = (response.data as any).pagination || { page: 1, limit: 10, total: collections.length, pages: 1 };

    return {
      data: collections,
      total: pagination.total,
    };
  },

  getAll: async (params?: {
    status?: string;
    binId?: string;
    collectorId?: string;
    wasteType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ collections: Collection[]; total: number; page: number; totalPages: number }> => {
    const response = await http.get<ApiSuccess<Collection[]>>('/collections', { params });
    // Backend returns { success, message, data: Collection[], pagination: { page, limit, total, pages } }
    // Transform to { collections: Collection[], total, page, totalPages }
    const collections = response.data.data || [];
    const pagination = (response.data as any).pagination || { page: 1, limit: 10, total: collections.length, pages: 1 };

    return {
      collections,
      total: pagination.total,
      page: pagination.page,
      totalPages: pagination.pages,
    };
  },

  getById: async (id: string): Promise<Collection> => {
    const response = await http.get<ApiSuccess<Collection>>(`/collections/${id}`);
    return response.data.data;
  },

  create: async (data: CreateCollectionInput): Promise<Collection> => {
    const response = await http.post<ApiSuccess<Collection>>('/collections', data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateCollectionInput): Promise<Collection> => {
    const response = await http.put<ApiSuccess<Collection>>(`/collections/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await http.delete(`/collections/${id}`);
  },

  completeCollection: async (
    id: string,
    data?: { weight?: number; volume?: number; notes?: string }
  ): Promise<Collection> => {
    const response = await http.post<ApiSuccess<Collection>>(`/collections/${id}/complete`, data || {});
    return response.data.data;
  },

  complete: async (
    id: string,
    data: { weight?: number; volume?: number; notes?: string }
  ): Promise<Collection> => {
    const response = await http.post<ApiSuccess<Collection>>(`/collections/${id}/complete`, data);
    return response.data.data;
  },

  updateCollection: async (id: string, data: UpdateCollectionInput): Promise<Collection> => {
    const response = await http.put<ApiSuccess<Collection>>(`/collections/${id}`, data);
    return response.data.data;
  },

  cancel: async (id: string, reason?: string): Promise<Collection> => {
    const response = await http.post<ApiSuccess<Collection>>(`/collections/${id}/cancel`, {
      reason,
    });
    return response.data.data;
  },
};

























