import { http, ApiSuccess } from './http';

export interface DashboardData {
  stats: {
    totalBins: number;
    activeBins: number;
    overflowingBins: number;
    maintenanceBins: number;
    collectionsToday: number;
    routesActive: number;
    alertsActive: number;
    systemHealth: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    time: string | Date;
    status: string;
  }>;
  lastUpdated: string | Date;
  databaseConnected?: boolean;
}

export interface BinStatusSummary {
  total: number;
  active: number;
  maintenance: number;
  inactive: number;
  overflowing: number;
  byType: {
    [key: string]: number;
  };
}

export interface CollectionSummary {
  totalCollections: number;
  completedToday: number;
  pending: number;
  cancelled: number;
  avgWeight: number;
  avgVolume: number;
  efficiency: number;
}

export interface RoutePerformance {
  totalRoutes: number;
  completedRoutes: number;
  avgDuration: number;
  avgDistance: number;
  efficiency: number;
  fuelConsumption: number;
  co2Saved: number;
}

export interface AlertSummary {
  totalAlerts: number;
  activeAlerts: number;
  resolvedToday: number;
  byType: {
    [key: string]: number;
  };
  bySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export interface Metrics {
  totalBins: number;
  activeBins: number;
  overflowingBins: number;
  collectionsToday: number;
  avgFillLevel: number;
  efficiency: number;
  wasteGenerated: {
    general: number;
    recyclable: number;
    organic: number;
    hazardous: number;
  };
  trends: {
    fillLevels: any[];
    collectionFrequency: any[];
    routeEfficiency: any[];
  };
}

export const analyticsAPI = {
  getDashboardData: async (): Promise<DashboardData> => {
    const response = await http.get<ApiSuccess<DashboardData>>('/analytics/dashboard');
    return response.data.data;
  },

  getMetrics: async (params?: {
    startDate?: string;
    endDate?: string;
    binType?: string;
  }): Promise<Metrics> => {
    const response = await http.get<ApiSuccess<Metrics>>('/analytics/metrics', { params });
    return response.data.data;
  },

  getBinStatusSummary: async (): Promise<BinStatusSummary> => {
    const response = await http.get<ApiSuccess<BinStatusSummary>>('/analytics/bins/status');
    return response.data.data;
  },

  getCollectionSummary: async (): Promise<CollectionSummary> => {
    const response = await http.get<ApiSuccess<CollectionSummary>>('/analytics/collections/summary');
    return response.data.data;
  },

  getRoutePerformance: async (): Promise<RoutePerformance> => {
    const response = await http.get<ApiSuccess<RoutePerformance>>('/analytics/routes/performance');
    return response.data.data;
  },

  getAlertSummary: async (): Promise<AlertSummary> => {
    const response = await http.get<ApiSuccess<AlertSummary>>('/analytics/alert-summary');
    return response.data.data;
  },

  getPredictions: async (binId: string, days?: number): Promise<any> => {
    const response = await http.get<ApiSuccess<any>>('/analytics/predictions', {
      params: { binId, days },
    });
    return response.data.data;
  },

  getPredictionMetrics: async (params?: {
    startDate?: string;
    endDate?: string;
    binId?: string;
  }): Promise<PredictionMetrics> => {
    const response = await http.get<ApiSuccess<PredictionMetrics>>('/analytics/predictions/metrics', { params });
    return response.data.data;
  },
};

export interface PredictionMetrics {
  accuracy: {
    mae: number;
    rmse: number;
    mape: number;
    sampleCount: number;
  };
  sourceBreakdown: {
    ml: {
      count: number;
      mae: number;
      accuracy: number | null;
    };
    fallback: {
      count: number;
      mae: number;
      accuracy: number | null;
    };
  };
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  trends: Array<{
    date: string;
    predicted: number;
    actual: number;
    count: number;
  }>;
  totalPredictions: number;
  predictionsWithActuals: number;
}

























