import axios, { AxiosInstance, AxiosError } from "axios";
import { config } from "@/config/config";
import { logger } from "@/utils/logger";

// Type definitions
interface BinLocation {
  bin_id: string;
  latitude: number;
  longitude: number;
  bin_type: string;
  current_level: number;
  capacity: number;
  priority: number;
}

interface CollectorLocation {
  latitude: number;
  longitude: number;
}

interface RouteOptimizationParams {
  time_windows?: Record<string, { start?: number; end?: number }>;
  traffic_multiplier?: number;
}

interface RouteStepDetail {
  order: number;
  bin_id: string;
  bin_type: string;
  location: { latitude: number; longitude: number };
  waste_level: number;
  estimated_arrival: string;
}

interface RouteOptimization {
  optimized_route: string[];
  total_distance_km: number;
  estimated_duration_hours: number;
  total_waste_collected: number;
  efficiency_score: number;
  route_details: RouteStepDetail[];
}

interface WastePrediction {
  bin_id: string;
  predicted_level: number;
  confidence: number;
  time_to_full_hours: number | null;
  recommended_collection_time: Date | null;
  risk_level: string;
  factors: string[];
}


interface CollectionScheduleRouteBin {
  bin_id: string;
  location: { latitude?: number; longitude?: number } | Record<string, unknown>;
  waste_level: number;
}

interface CollectionScheduleRoute {
  route_id: string;
  bins: CollectionScheduleRouteBin[];
  estimated_duration: number;
}

interface CollectionSchedule {
  date: Date;
  routes: CollectionScheduleRoute[];
  total_bins: number;
  estimated_duration_hours: number;
  resource_requirements: Record<string, any>;
}

export class MLClient {
  private client: AxiosInstance;
  private maxRetries: number = 3;
  private timeout: number = 120000; // 120 seconds (training can take time)

  constructor() {
    const serviceUrl = config.ml.serviceUrl;
    logger.info("Initializing ML Client", { serviceUrl, timeout: this.timeout });

    this.client = axios.create({
      baseURL: serviceUrl,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.jwt.secret}`, // Simple auth for now
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => this.handleError(error),
    );
  }

  /**
   * Optimize collection route using ML service
   */
  async optimizeRoute(
    bins: BinLocation[],
    collectorLocation: CollectorLocation,
    params?: RouteOptimizationParams,
  ): Promise<RouteOptimization> {
    try {
      logger.info("Calling ML service for route optimization", {
        binsCount: bins.length,
        location: collectorLocation,
        hasTimeWindows: Boolean(params?.time_windows),
        trafficMultiplier: params?.traffic_multiplier,
      });

      const response = await this.retryRequest(async () => {
        return await this.client.post("/optimize/route", {
          bins,
          collector_location: collectorLocation,
          max_route_duration_hours: 8.0,
          vehicle_capacity: 1000.0,
          time_windows: params
            ? {
                traffic_multiplier: params.traffic_multiplier,
                windows: params.time_windows,
              }
            : undefined,
        });
      });

      logger.info("Route optimization successful", {
        distance: response.data.total_distance_km,
        efficiency: response.data.efficiency_score,
      });

      return response.data;
    } catch (error: unknown) {
      logger.error("Route optimization failed", { error });
      throw new Error("ML service route optimization failed");
    }
  }

  /**
   * Predict waste accumulation for a bin
   */
  async predictWaste(
    binId: string,
    binType: string,
    currentLevel: number,
    capacity: number,
    location: { latitude?: number; longitude?: number; coordinates?: [number, number] } | any,
    timeHorizon: number = 24,
  ): Promise<WastePrediction> {
    try {
      logger.info("Calling ML service for waste prediction", {
        binId,
        timeHorizon,
      });

      // Normalize location format for ML service
      // ML service expects: { latitude: float, longitude: float }
      let normalizedLocation: { latitude: number; longitude: number };

      if (location.coordinates && Array.isArray(location.coordinates)) {
        // GeoJSON format: [longitude, latitude]
        normalizedLocation = {
          latitude: location.coordinates[1],
          longitude: location.coordinates[0],
        };
      } else if (location.latitude !== undefined && location.longitude !== undefined) {
        // Already in correct format
        normalizedLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
      } else {
        // Default to Colombo, Sri Lanka if location is missing
        logger.warn(`Missing location for bin ${binId}, using default`);
        normalizedLocation = {
          latitude: 6.9271,
          longitude: 79.8612,
        };
      }

      const response = await this.retryRequest(async () => {
        return await this.client.post("/predict/waste", {
          bin_id: binId,
          bin_type: binType,
          current_level: currentLevel,
          capacity,
          location: normalizedLocation,
          time_horizon_hours: timeHorizon,
          historical_data: [],
          weather_data: null,
        });
      });

      return response.data;
    } catch (error: unknown) {
      logger.error("Waste prediction failed", { error, binId });
      throw new Error("ML service waste prediction failed");
    }
  }

  // bin status removed per requirement

  /**
   * Generate collection schedule
   */
  async generateSchedule(scheduleData: {
    bins: Array<{
      bin_id: string;
      current_level?: number;
      location?:
        | { latitude?: number; longitude?: number }
        | Record<string, unknown>;
    }>;
    start_date?: Date;
    end_date?: Date;
  }): Promise<CollectionSchedule> {
    try {
      const response = await this.retryRequest(async () => {
        return await this.client.post("/schedule/collections", scheduleData);
      });

      return response.data;
    } catch (error: unknown) {
      logger.error("Schedule generation failed", { error });
      throw new Error("ML service schedule generation failed");
    }
  }

  // model status removed per requirement

  /**
   * Retry logic for failed requests
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries: number = this.maxRetries,
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: unknown) {
      if (retries > 0 && this.isRetryableError(error)) {
        logger.warn(
          `Retrying ML service request, attempts remaining: ${retries}`,
        );
        await this.delay(1000 * (this.maxRetries - retries + 1)); // Exponential backoff
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const err = error as AxiosError | undefined;
    if (!err || !err.response) {
      // Network error, timeout, etc.
      return true;
    }

    const status = err.response.status;
    // Retry on 5xx errors and rate limiting
    return status >= 500 || status === 429;
  }

  /**
   * Error handling
   */
  private handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      // Server responded with error
      const errorDetails = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        url: error.config?.url,
        method: error.config?.method,
      };
      logger.error("ML service error response", errorDetails);
      // Also log to console for debugging
      console.error("🔴 ML Service Error Details:", JSON.stringify(errorDetails, null, 2));
    } else if (error.request) {
      // Request made but no response
      const errorDetails = {
        message: "ML service did not respond",
        url: error.config?.url,
        method: error.config?.method,
        code: error.code,
        timeout: error.config?.timeout,
        baseURL: error.config?.baseURL,
      };
      logger.error("ML service no response", errorDetails);
      console.error("🔴 ML Service No Response:", JSON.stringify(errorDetails, null, 2));
    } else {
      // Error setting up request
      const errorDetails = {
        message: error.message,
        stack: error.stack,
      };
      logger.error("ML service request setup error", errorDetails);
      console.error("🔴 ML Service Setup Error:", JSON.stringify(errorDetails, null, 2));
    }

    return Promise.reject(error);
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check for ML service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get("/health", { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      logger.warn("ML service health check failed");
      return false;
    }
  }

  /**
   * Train waste prediction model
   */
  async trainModel(trainingData: Array<{
    binId: string;
    timestamp: string;
    fillLevel: number;
    binType: string;
    latitude: number;
    longitude: number;
    dayOfWeek: number;
    hourOfDay: number;
    actualFillLevel24h: number;
  }>): Promise<{ success: boolean; message?: string; train_score?: number; test_score?: number; n_samples?: number }> {
    try {
      const fullUrl = `${config.ml.serviceUrl}/train/model`;
      logger.info("Training ML model", {
        sampleCount: trainingData.length,
        url: fullUrl,
        baseURL: config.ml.serviceUrl
      });

      const response = await this.retryRequest(async () => {
        logger.info("Sending training request to ML service", { url: fullUrl });
        return await this.client.post("/train/model", trainingData);
      });

      logger.info("Model training completed", response.data);
      return response.data;
    } catch (error: unknown) {
      logger.error("Model training failed", { error });
      throw new Error("ML service model training failed");
    }
  }
}

// Export singleton instance
export const mlClient = new MLClient();
