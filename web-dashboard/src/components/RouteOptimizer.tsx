import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L, { LatLngTuple } from "leaflet";
import {
  SparklesIcon,
  MapPinIcon,
  ClockIcon,
  TruckIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { Bin } from "../api/bins";
import { routesAPI } from "../api/routes";
import { adminAPI, User } from "../api/admin";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom numbered marker icons
const createNumberedIcon = (number: number, color: string) => {
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${number}</div>`,
    className: "custom-numbered-icon",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

interface RouteOptimizerProps {
  bins: Bin[];
  onRouteCreated?: () => void;
}

interface OptimizedRoute {
  optimizedOrder: string[];
  totalDistance: number;
  estimatedDuration: number;
  efficiency: number;
  coordinates: LatLngTuple[];
}

// Component to fit map bounds
const MapBoundsUpdater: React.FC<{ bounds: L.LatLngBounds | null }> = ({
  bounds,
}) => {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
};

export const RouteOptimizer: React.FC<RouteOptimizerProps> = ({
  bins,
  onRouteCreated,
}) => {
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);
  const [startLocation] = useState<LatLngTuple>([6.9271, 79.8612]); // Default: Colombo
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [routeName, setRouteName] = useState("");
  const [collectorName, setCollectorName] = useState("");
  const [isCreatingRoute, setIsCreatingRoute] = useState(false);
  const [routeCreatedSuccess, setRouteCreatedSuccess] = useState(false);
  const [collectors, setCollectors] = useState<User[]>([]);
  const [collectorId, setCollectorId] = useState<string>("");
  // Ref-based snapshot immune to re-renders - populated before any state mutation
  const routeSnapshotRef = React.useRef<{
    coordinates: LatLngTuple[];
    stops: Array<{ id: string; label: string; name: string; fill: number; coord: LatLngTuple }>;
  } | null>(null);

  // Auto-select high-priority bins on initial load only
  const hasAutoSelected = React.useRef(false);
  useEffect(() => {
    if (hasAutoSelected.current || bins.length === 0) return;
    const highPriorityBins = bins
      .filter((bin) => (bin.currentLevel ?? 0) >= 70)
      .map((bin) => bin._id);
    setSelectedBinIds(highPriorityBins);
    hasAutoSelected.current = true;
  }, [bins]);

  // Fetch collectors on mount
  useEffect(() => {
    adminAPI.getCollectors().then(setCollectors).catch(() => setCollectors([]));
  }, []);

  // Get bin location as LatLngTuple
  const getBinLocation = (bin: Bin): LatLngTuple => {
    if (!bin.location) return [6.9271, 79.8612];

      if ("coordinates" in bin.location && bin.location.coordinates) {
        return [bin.location.coordinates[1], bin.location.coordinates[0]];
      } else if ("latitude" in bin.location && bin.location.latitude !== undefined && bin.location.longitude !== undefined) {
        return [bin.location.latitude, bin.location.longitude];
      }
    return [6.9271, 79.8612];
  };

  // Toggle bin selection
  const toggleBinSelection = (binId: string) => {
    setSelectedBinIds((prev) =>
      prev.includes(binId)
        ? prev.filter((id) => id !== binId)
        : [...prev, binId],
    );
  };

  // Select all bins
  const selectAll = () => {
    setSelectedBinIds(bins.map((bin) => bin._id));
  };

  // Deselect all bins
  const deselectAll = () => {
    setSelectedBinIds([]);
  };

  // Optimize route
  const optimizeRoute = async () => {
    if (selectedBinIds.length < 2) {
      setError("Please select at least 2 bins to optimize a route");
      return;
    }

    setIsOptimizing(true);
    setError(null);

    try {
      const selectedBins = bins.filter((bin) =>
        selectedBinIds.includes(bin._id),
      );
      const binData = selectedBins.map((bin) => {
        const location = getBinLocation(bin);
        return {
          binId: bin._id,
          location: {
            latitude: location[0],
            longitude: location[1],
          },
          fillLevel: bin.currentLevel ?? 0,
          priority:
            (bin.currentLevel ?? 0) >= 90
              ? "urgent"
              : (bin.currentLevel ?? 0) >= 70
                ? "high"
                : "medium",
        };
      });

      // Use the new direct optimization endpoint
      // Map bin data to include all required fields from actual bin objects
      const optimizationBins = selectedBins.map((bin) => {
        const location = getBinLocation(bin);
        return {
          binId: bin._id,
          _id: bin._id,
          location: {
            latitude: location[0],
            longitude: location[1],
          },
          currentLevel: bin.currentLevel ?? 0,
          fillLevel: bin.currentLevel ?? 0,
          binType: bin.binType || 'general',
          capacity: bin.capacity || 100,
          priority:
            (bin.currentLevel ?? 0) >= 90
              ? "urgent"
              : (bin.currentLevel ?? 0) >= 70
                ? "high"
                : "medium",
        };
      });

      const response = await routesAPI.optimizeRouteDirect({
        bins: optimizationBins,
        startLocation: {
          latitude: startLocation[0],
          longitude: startLocation[1],
        },
        vehicle: {
          capacity: 1000,
          speed: 30,
        },
      });

      // Map optimized order to coordinates
      const coordinates: LatLngTuple[] = [startLocation];
      response.optimizedOrder.forEach((binId) => {
        const bin = bins.find((b) => b._id === binId);
        if (bin) {
          coordinates.push(getBinLocation(bin));
        }
      });
      coordinates.push(startLocation); // Return to start

      setOptimizedRoute({
        optimizedOrder: response.optimizedOrder,
        totalDistance: response.totalDistance,
        estimatedDuration: response.estimatedDuration,
        efficiency: response.efficiency,
        coordinates,
      });
    } catch (err: any) {
      console.error("Route optimization error:", err);
      const errorMessage = err.response?.data?.message ||
                          err.message ||
                          "Failed to optimize route. Using fallback algorithm.";
      setError(errorMessage);

      // Fallback: Simple nearest-neighbor algorithm
      try {
        const fallbackRoute = createFallbackRoute();
        setOptimizedRoute(fallbackRoute);
      } catch (fallbackErr: any) {
        console.error("Fallback route creation failed:", fallbackErr);
        setError("Failed to create route. Please try again.");
      }
    } finally {
      setIsOptimizing(false);
    }
  };

  // Fallback route optimization (simple nearest-neighbor)
  const createFallbackRoute = (): OptimizedRoute => {
    const selectedBins = bins.filter((bin) => selectedBinIds.includes(bin._id));
    const visited = new Set<string>();
    const order: string[] = [];
    const coordinates: LatLngTuple[] = [startLocation];

    let currentLocation = startLocation;
    let totalDistance = 0;

    while (visited.size < selectedBins.length) {
      let nearestBin: Bin | null = null;
      let minDistance = Infinity;

      for (const bin of selectedBins) {
        if (!visited.has(bin._id)) {
          const binLocation = getBinLocation(bin);
          const distance = calculateDistance(currentLocation, binLocation);
          if (distance < minDistance) {
            minDistance = distance;
            nearestBin = bin;
          }
        }
      }

      if (nearestBin) {
        visited.add(nearestBin._id);
        order.push(nearestBin._id);
        const binLocation = getBinLocation(nearestBin);
        coordinates.push(binLocation);
        totalDistance += minDistance;
        currentLocation = binLocation;
      }
    }

    // Return to start
    totalDistance += calculateDistance(currentLocation, startLocation);
    coordinates.push(startLocation);

    return {
      optimizedOrder: order,
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      estimatedDuration: Math.round((totalDistance / 30) * 60), // Assuming 30 km/h
      efficiency: 85, // Fallback efficiency
      coordinates,
    };
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (
    point1: LatLngTuple,
    point2: LatLngTuple,
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2[0] - point1[0]) * Math.PI) / 180;
    const dLon = ((point2[1] - point1[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1[0] * Math.PI) / 180) *
        Math.cos((point2[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Create route
  const createRoute = async () => {
    if (!optimizedRoute) return;
    if (!routeName.trim()) {
      setError("Please enter a route name");
      return;
    }

    setIsCreatingRoute(true);
    setError(null);

    // SNAPSHOT all map data NOW into a ref, before any state changes happen.
    // This is immune to parent re-renders, bins prop changes, or optimizedRoute being cleared.
    routeSnapshotRef.current = {
      coordinates: [...optimizedRoute.coordinates],
      stops: optimizedRoute.optimizedOrder.map((binId) => {
        const b = bins.find((b) => b._id === binId);
        const coord: LatLngTuple = b ? getBinLocation(b) : startLocation;
        return {
          id: binId,
          label: b?.binId || binId,
          name: b?.name || "",
          fill: b?.currentLevel ?? 0,
          coord,
        };
      }),
    };

    try {
      await routesAPI.createRoute({
        name: routeName,
        collectorId: collectorId || collectorName || "Unassigned",
        bins: optimizedRoute.optimizedOrder,
        status: "draft",
        priority: "medium",
        scheduledDate: new Date().toISOString(),
        totalDistance: optimizedRoute.totalDistance,
        estimatedDuration: optimizedRoute.estimatedDuration,
        optimizationData: {
          efficiency: optimizedRoute.efficiency,
          route: optimizedRoute.optimizedOrder,
        },
      });

      setRouteCreatedSuccess(true);
      if (onRouteCreated) onRouteCreated();
    } catch (err: any) {
      console.error("Create route error:", err);
      routeSnapshotRef.current = null; // clear snapshot on error
      setError(err.response?.data?.message || "Failed to create route");
    } finally {
      setIsCreatingRoute(false);
    }
  };

  const resetOptimizer = () => {
    setRouteName("");
    setCollectorName("");
    setCollectorId("");
    setOptimizedRoute(null);
    setSelectedBinIds([]);
    setRouteCreatedSuccess(false);
    setError(null);
    routeSnapshotRef.current = null;
  };

  // Calculate map bounds
  const getMapBounds = (): L.LatLngBounds | null => {
    if (optimizedRoute && optimizedRoute.coordinates.length > 0) {
      return L.latLngBounds(optimizedRoute.coordinates);
    } else if (selectedBinIds.length > 0) {
      const selectedBins = bins.filter((bin) =>
        selectedBinIds.includes(bin._id),
      );
      const locations = selectedBins.map(getBinLocation);
      if (locations.length > 0) {
        return L.latLngBounds(locations);
      }
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <SparklesIcon className="h-7 w-7 mr-2 text-blue-600" />
            Route Optimizer
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Select bins and optimize collection route using AI
          </p>
        </div>
        <button
          onClick={() => setShowMap(!showMap)}
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {showMap ? "Hide Map" : "Show Map"}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Bin Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Select Bins ({selectedBinIds.length} selected)
            </h3>
            <div className="space-x-2">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-3">
            {bins.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No bins available
              </p>
            ) : (
              bins.map((bin) => (
                <div
                  key={bin._id}
                  className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedBinIds.includes(bin._id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                  onClick={() => toggleBinSelection(bin._id)}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedBinIds.includes(bin._id)}
                      onChange={() => toggleBinSelection(bin._id)}
                      className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">
                          {bin.binId}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            bin.binType === "general"
                              ? "bg-gray-200 text-gray-700"
                              : bin.binType === "recyclable"
                                ? "bg-blue-200 text-blue-700"
                                : bin.binType === "organic"
                                  ? "bg-green-200 text-green-700"
                                  : "bg-red-200 text-red-700"
                          }`}
                        >
                          {bin.binType}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">{bin.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold ${
                        (bin.currentLevel ?? 0) >= 90
                          ? "text-red-600"
                          : (bin.currentLevel ?? 0) >= 70
                            ? "text-yellow-600"
                            : "text-green-600"
                      }`}
                    >
                      {bin.currentLevel ?? 0}%
                    </div>
                    <div className="text-xs text-gray-500">fill level</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Optimize Button */}
          <button
            onClick={optimizeRoute}
            disabled={selectedBinIds.length < 2 || isOptimizing}
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {isOptimizing ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Optimizing...</span>
              </>
            ) : (
              <>
                <SparklesIcon className="h-5 w-5" />
                <span>Optimize Route</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div>
          {optimizedRoute ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Optimization Results
              </h3>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-blue-600 mb-1">
                    <TruckIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Distance</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {optimizedRoute.totalDistance} km
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-600 mb-1">
                    <ClockIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">Duration</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {optimizedRoute.estimatedDuration} min
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 col-span-2">
                  <div className="flex items-center space-x-2 text-purple-600 mb-1">
                    <SparklesIcon className="h-5 w-5" />
                    <span className="text-sm font-medium">
                      Efficiency Score
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {optimizedRoute.efficiency}%
                  </div>
                </div>
              </div>

              {/* Route Order */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Optimized Order:
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {optimizedRoute.optimizedOrder.map((binId, index) => {
                    const bin = bins.find((b) => b._id === binId);
                    return (
                      <div
                        key={binId}
                        className="flex items-center space-x-3 p-2 bg-gray-50 rounded"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {bin?.binId || binId}
                          </div>
                          <div className="text-xs text-gray-500">
                            {bin?.name}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-gray-700">
                          {bin?.currentLevel ?? 0}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Create Route Form / Success Banner */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                {routeCreatedSuccess ? (
                  /* Success state — map stays visible */
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                    <div className="flex items-center justify-center mb-2">
                      <CheckIcon className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-green-800 font-semibold text-sm mb-1">Route Created Successfully!</p>
                    <p className="text-green-600 text-xs mb-3">You can view it in the Routes list below.</p>
                    <button
                      onClick={resetOptimizer}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors"
                    >
                      + Create Another Route
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Route Name *
                      </label>
                      <input
                        type="text"
                        value={routeName}
                        onChange={(e) => setRouteName(e.target.value)}
                        placeholder="e.g., Downtown Morning Route"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign to Collector (optional)
                      </label>
                      {collectors.length > 0 ? (
                        <select
                          value={collectorId}
                          onChange={(e) => setCollectorId(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                        >
                          <option value="">— Unassigned —</option>
                          {collectors.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.firstName} {c.lastName}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={collectorName}
                          onChange={(e) => setCollectorName(e.target.value)}
                          placeholder="e.g., John Doe"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      )}
                    </div>
                    <button
                      onClick={createRoute}
                      disabled={isCreatingRoute || !routeName.trim()}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg shadow-md transition-all duration-200 flex items-center justify-center space-x-2"
                    >
                      {isCreatingRoute ? (
                        <>
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <CheckIcon className="h-5 w-5" />
                          <span>Create Route</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-center p-8">
              <div>
                <MapPinIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  Select bins and click "Optimize Route" to see results
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      {showMap && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Route Visualization
          </h3>
          <div className="h-[500px] rounded-lg overflow-hidden border border-gray-200">
            {routeCreatedSuccess && routeSnapshotRef.current ? (
              /* SUCCESS STATE: Render from the pre-computed snapshot.
                 Uses a fixed key 'map-created' so Leaflet NEVER remounts after creation.
                 All data comes from the ref — immune to any React re-renders. */
              <MapContainer
                key="map-created"
                center={routeSnapshotRef.current.stops[0]?.coord ?? startLocation}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={startLocation}>
                  <Popup><strong>Start / Depot</strong></Popup>
                </Marker>
                {routeSnapshotRef.current.stops.map((stop, i) => {
                  const color = stop.fill >= 90 ? "#ef4444" : stop.fill >= 70 ? "#f59e0b" : "#22c55e";
                  return (
                    <Marker key={stop.id} position={stop.coord} icon={createNumberedIcon(i + 1, color)}>
                      <Popup>
                        <strong>Stop {i + 1}: {stop.label}</strong><br />
                        {stop.name}<br />
                        Fill Level: {stop.fill}%
                      </Popup>
                    </Marker>
                  );
                })}
                <Polyline
                  positions={routeSnapshotRef.current.coordinates}
                  color="#2563eb"
                  weight={4}
                  opacity={0.8}
                />
              </MapContainer>
            ) : (
              /* NORMAL STATE: Original rendering logic */
              <MapContainer
                key={`map-optimize-${optimizedRoute?.optimizedOrder?.length ?? 0}-${selectedBinIds.length}`}
                center={startLocation}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBoundsUpdater bounds={getMapBounds()} />
                <Marker position={startLocation}>
                  <Popup><strong>Start Location</strong></Popup>
                </Marker>
                {optimizedRoute ? (
                  <>
                    {optimizedRoute.optimizedOrder.map((binId, index) => {
                      const bin = bins.find((b) => b._id === binId);
                      if (!bin) return null;
                      const location = getBinLocation(bin);
                      return (
                        <Marker key={binId} position={location} icon={createNumberedIcon(index + 1, "#2563eb")}>
                          <Popup>
                            <strong>Stop {index + 1}: {bin.binId}</strong>
                            <br />{bin.name}<br />Fill Level: {bin.currentLevel}%
                          </Popup>
                        </Marker>
                      );
                    })}
                    <Polyline positions={optimizedRoute.coordinates} color="#2563eb" weight={4} opacity={0.7} />
                  </>
                ) : (
                  selectedBinIds.map((binId) => {
                    const bin = bins.find((b) => b._id === binId);
                    if (!bin) return null;
                    const location = getBinLocation(bin);
                    const fillLevel = bin.currentLevel ?? 0;
                    const color = fillLevel >= 90 ? "#ef4444" : fillLevel >= 70 ? "#eab308" : "#22c55e";
                    return (
                      <Marker key={binId} position={location} icon={createNumberedIcon(selectedBinIds.indexOf(binId) + 1, color)}>
                        <Popup>
                          <strong>{bin.binId}</strong><br />{bin.name}<br />Fill Level: {fillLevel}%
                        </Popup>
                      </Marker>
                    );
                  })
                )}
              </MapContainer>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
