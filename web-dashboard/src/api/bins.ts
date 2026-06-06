import { http, ApiSuccess } from "./http";

export type Bin = {
  _id: string;
  binId: string;
  name?: string;
  binType: "general" | "recyclable" | "organic" | "hazardous";
  status: "active" | "maintenance" | "inactive" | "overflowing";
  capacity: number;
  currentLevel?: number;
  location?: {
    type?: "Point";
    coordinates?: [number, number];
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  lastEmptied?: string;
  nextCollection?: string;
  collectionFrequency?: number;
  isOverflowing?: boolean;
  metadata?: {
    installationDate?: string;
    lastMaintenance?: string;
    batteryLevel?: number;
    signalStrength?: number;
    lastDataReceived?: string;
  };
  prediction?: {
    predictedLevel: number;
    timeToFullHours?: number | null;
    riskLevel: "low" | "medium" | "high" | "critical";
    recommendedCollectionTime?: string | null;
    confidence?: number;
    source: "ml-service" | "fallback";
    createdAt?: string;
  } | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  activeBins?: number;
  overflowingBins?: number;
};

export async function fetchBins(params?: Record<string, any>) {
  const response = await http.get<ApiSuccess<Bin[]>>("/bins", { params });
  // Backend returns { success, message, data: Bin[], pagination: { page, limit, total, pages, activeBins?, overflowingBins? } }
  // Transform to { items: Bin[], page, limit, total, activeBins?, overflowingBins? }
  const bins = response.data.data || [];
  const pagination = (response.data as any).pagination || {
    page: 1,
    limit: 100,
    total: bins.length,
    pages: 1,
  };

  return {
    items: bins,
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    activeBins: pagination.activeBins,
    overflowingBins: pagination.overflowingBins,
  };
}

export type CreateBinRequest = {
  binId: string;
  binType: "general" | "recyclable" | "organic" | "hazardous";
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  capacity: number;
  currentLevel?: number;
  status?: "active" | "inactive" | "maintenance" | "full";
  collectionFrequency?: number;
};

export async function createBin(data: CreateBinRequest): Promise<Bin> {
  const response = await http.post<ApiSuccess<Bin>>("/bins", data);
  return response.data.data;
}

export async function deleteBin(id: string): Promise<void> {
  await http.delete(`/bins/${id}`);
}
