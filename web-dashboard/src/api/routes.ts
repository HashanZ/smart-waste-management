import { http, ApiSuccess } from "./http";

export interface Route {
  _id: string;
  routeId: string;
  name: string;
  description?: string;
  collectorId: string;
  bins: string[];
  status: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  scheduledDate: string;
  actualStartTime?: string;
  actualEndTime?: string;
  totalDistance?: number;
  estimatedDuration?: number;
  actualDuration?: number;
  binsVisited: Array<{
    binId: string;
    visitedAt: string;
    skipped: boolean;
    skipReason?: string;
    photoUrl?: string;
    notes?: string;
  }>;
  optimizationData?: {
    efficiency: number;
    fuelEstimate?: number;
    route: string[];
  };
  completionPercentage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RouteOptimization {
  optimized_route: string[];
  total_distance_km: number;
  estimated_duration_hours: number;
  total_waste_collected: number;
  efficiency_score: number;
  route_details: Array<{
    step: number;
    bin_id: string;
    distance_km: number;
    travel_time_minutes: number;
  }>;
}

export interface CreateRouteInput {
  routeId?: string;
  name: string;
  description?: string;
  collectorId: string;
  bins: string[];
  status?: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  scheduledDate: string;
  totalDistance?: number;
  estimatedDuration?: number;
  optimizationData?: {
    efficiency: number;
    fuelEstimate?: number;
    route: string[];
  };
}

export interface RouteOptimizationRequest {
  bins: Array<{
    binId: string;
    location: {
      latitude: number;
      longitude: number;
    };
    fillLevel: number;
    priority: string;
  }>;
  startLocation: {
    latitude: number;
    longitude: number;
  };
  vehicle: {
    capacity: number;
    speed: number;
  };
}

export interface RouteOptimizationResponse {
  optimizedOrder: string[];
  totalDistance: number;
  estimatedDuration: number;
  efficiency: number;
}

export interface UpdateRouteInput {
  name?: string;
  description?: string;
  collectorId?: string;
  bins?: string[];
  status?: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  scheduledDate?: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export const routesAPI = {
  getRoutes: async (params?: {
    status?: string;
    priority?: string;
    collectorId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<Paginated<Route>> => {
    const response = await http.get<ApiSuccess<Route[]>>("/routes", { params });
    // Backend returns { success, message, data: Route[], pagination: { page, limit, total, pages } }
    // Transform to { data: Route[], total, page, totalPages }
    const routes = response.data.data || [];
    const pagination = (response.data as any).pagination || { page: 1, limit: 10, total: routes.length, pages: 1 };

    return {
      data: routes,
      total: pagination.total,
      page: pagination.page,
      totalPages: pagination.pages,
    };
  },

  getAll: async (params?: {
    status?: string;
    priority?: string;
    collectorId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    routes: Route[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const response = await http.get<ApiSuccess<Route[]>>("/routes", { params });
    // Backend returns { success, message, data: Route[], pagination: { page, limit, total, pages } }
    // Transform to { routes: Route[], total, page, totalPages }
    const routes = response.data.data || [];
    const pagination = (response.data as any).pagination || { page: 1, limit: 10, total: routes.length, pages: 1 };

    return {
      routes,
      total: pagination.total,
      page: pagination.page,
      totalPages: pagination.pages,
    };
  },

  getById: async (id: string): Promise<Route> => {
    const response = await http.get<ApiSuccess<Route>>(`/routes/${id}`);
    return response.data.data;
  },

  createRoute: async (data: CreateRouteInput): Promise<Route> => {
    const response = await http.post<ApiSuccess<Route>>("/routes", data);
    return response.data.data;
  },

  create: async (data: CreateRouteInput): Promise<Route> => {
    const response = await http.post<ApiSuccess<Route>>("/routes", data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateRouteInput): Promise<Route> => {
    const response = await http.put<ApiSuccess<Route>>(`/routes/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await http.delete(`/routes/${id}`);
  },

  optimize: async (
    id: string,
  ): Promise<{ route: Route; optimization: RouteOptimization }> => {
    const response = await http.post<ApiSuccess<any>>(`/routes/${id}/optimize`);
    return response.data.data;
  },

  optimizeRoute: async (
    id: string,
    data: RouteOptimizationRequest,
  ): Promise<RouteOptimizationResponse> => {
    const response = await http.post<ApiSuccess<RouteOptimizationResponse>>(
      `/routes/${id}/optimize`,
      data,
    );
    return response.data.data;
  },

  optimizeRouteDirect: async (
    data: RouteOptimizationRequest,
  ): Promise<RouteOptimizationResponse> => {
    try {
      console.log('Calling optimizeRouteDirect with data:', {
        binsCount: data.bins.length,
        startLocation: data.startLocation,
      });

      const response = await http.post<ApiSuccess<RouteOptimizationResponse>>(
        `/routes/optimize-direct`,
        {
          bins: data.bins,
          collector_location: {
            latitude: data.startLocation.latitude,
            longitude: data.startLocation.longitude,
          },
          traffic_multiplier: 1.0,
        },
      );

      console.log('Optimize route response:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('Optimize route API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  },

  start: async (id: string): Promise<Route> => {
    const response = await http.post<ApiSuccess<Route>>(`/routes/${id}/start`);
    return response.data.data;
  },

  complete: async (id: string): Promise<Route> => {
    const response = await http.post<ApiSuccess<Route>>(
      `/routes/${id}/complete`,
    );
    return response.data.data;
  },

  markBinVisited: async (
    id: string,
    binId: string,
    data?: { photoUrl?: string; notes?: string },
  ): Promise<Route> => {
    const response = await http.post<ApiSuccess<Route>>(
      `/routes/${id}/bins/${binId}/visit`,
      data,
    );
    return response.data.data;
  },

  markBinSkipped: async (
    id: string,
    binId: string,
    reason: string,
  ): Promise<Route> => {
    const response = await http.post<ApiSuccess<Route>>(
      `/routes/${id}/bins/${binId}/skip`,
      {
        reason,
      },
    );
    return response.data.data;
  },
};
