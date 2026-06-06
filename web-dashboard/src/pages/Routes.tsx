import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Clock,
  CheckCircle,
  Play,
  Plus,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  Route as RouteIcon,
  User,
  Calendar,
  Package,
  Eye,
  Navigation,
  XCircle,
  Loader,
  X,
  Pencil,
  Save,
} from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L, { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { routesAPI, Route } from "../api/routes";
import { useBins } from "../hooks/useBins";
import { RouteOptimizer } from "../components/RouteOptimizer";
import { useSocket } from "../contexts/SocketContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { LoadingSpinner, SkeletonCard } from "../components/ui/LoadingSpinner";
import { PageHeader } from "../components/ui/PageHeader";
import { ErrorState } from "../components/ui/ErrorState";
import { LoadingState } from "../components/ui/LoadingState";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { getRouteStatusColor } from "../utils/statusUtils";
import { adminAPI, User as UserType } from "../api/admin";

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});
const makeStopIcon = (n: number, color: string) =>
  L.divIcon({
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:12px;box-shadow:0 2px 4px rgba(0,0,0,.35)">${n}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

type FilterType = "all" | "scheduled" | "active" | "completed" | "draft";

interface EditForm {
  name: string;
  collectorId: string;
  scheduledDate: string;
}

export const Routes: React.FC = () => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [routes, setRoutes] = useState<Route[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOptimizer, setShowOptimizer] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", collectorId: "", scheduledDate: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [collectors, setCollectors] = useState<UserType[]>([]);
  const [scheduleDateTime, setScheduleDateTime] = useState<string>("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  const { data: binsResponse } = useBins({ page: 1, limit: 100 });
  const bins = binsResponse?.items || [];
  const { socket, isConnected } = useSocket();

  // Fetch collectors for the edit dropdown
  useEffect(() => {
    adminAPI.getCollectors().then(setCollectors).catch(() => {});
  }, []);

  // Fetch routes
  const fetchRoutes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await routesAPI.getRoutes({ page: 1, limit: 50 });
      setRoutes(response.data);
    } catch (err: any) {
      console.error("Failed to fetch routes:", err);
      setError(err.message || "Failed to load routes");
      toast.error("Failed to load routes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // Socket.io real-time updates
  useEffect(() => {
    if (!socket) return;

    socket.on("route:update", (updatedRoute: Route) => {
      console.log("✅ Route update received:", updatedRoute);
      setRoutes((prev) =>
        prev.map((route) =>
          route._id === updatedRoute._id ? updatedRoute : route,
        ),
      );
      toast.success(`Route ${updatedRoute.name} updated`, { icon: "🔄" });
    });

    socket.on("route:created", (newRoute: Route) => {
      console.log("✅ New route created:", newRoute);
      setRoutes((prev) => [newRoute, ...prev]);
      toast.success(`New route created: ${newRoute.name}`, { icon: "🗺️" });
    });

    return () => {
      socket.off("route:update");
      socket.off("route:created");
    };
  }, [socket]);

  const handleRouteCreated = () => {
    toast.success("Route created successfully!", { icon: "✅" });
    fetchRoutes();
  };

  const handleStartRoute = async (route: Route) => {
    try {
      await routesAPI.start(route._id);
      toast.success(`Route ${route.name} started`, { icon: "▶️" });
      fetchRoutes();
    } catch (err: any) {
      toast.error(err.message || "Failed to start route");
    }
  };

  const handleCompleteRoute = async (route: Route) => {
    try {
      await routesAPI.complete(route._id);
      toast.success(`Route ${route.name} completed`, { icon: "✅" });
      fetchRoutes();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete route");
    }
  };

  const handleUpdateRoute = async () => {
    if (!selectedRoute) return;
    setIsSaving(true);
    try {
      await routesAPI.update(selectedRoute._id, {
        name: editForm.name || selectedRoute.name,
        ...(editForm.collectorId ? { collectorId: editForm.collectorId } : {}),
        ...(editForm.scheduledDate ? { scheduledDate: new Date(editForm.scheduledDate).toISOString() } : {}),
      });
      toast.success("Route updated");
      setIsEditing(false);
      fetchRoutes();
      // Update selectedRoute in-place so the drawer reflects the change immediately
      setSelectedRoute((prev) => prev ? {
        ...prev,
        name: editForm.name || prev.name,
        collectorId: editForm.collectorId || prev.collectorId,
        scheduledDate: editForm.scheduledDate ? new Date(editForm.scheduledDate).toISOString() : prev.scheduledDate,
      } : null);
    } catch (e: any) {
      toast.error(e.message || "Failed to update route");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (route: Route) => {
    setEditForm({
      name: route.name,
      collectorId: typeof route.collectorId === "string" ? route.collectorId : "",
      scheduledDate: route.scheduledDate ? format(new Date(route.scheduledDate), "yyyy-MM-dd'T'HH:mm") : "",
    });
    setIsEditing(true);
  };

  const filteredRoutes = (routes || []).filter((route) => {
    if (filter === "all") return true;
    return route.status === filter;
  });

  const stats = {
    total: routes.length,
    scheduled: routes.filter((r) => r.status === "scheduled").length,
    active: routes.filter((r) => r.status === "active").length,
    completed: routes.filter((r) => r.status === "completed").length,
  };

  // Use shared utility
  const getStatusColor = getRouteStatusColor;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle;
      case "active":
        return Loader;
      case "scheduled":
        return Clock;
      case "draft":
        return AlertCircle;
      default:
        return RouteIcon;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700";
      case "high":
        return "bg-orange-100 text-orange-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      case "low":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading && routes.length === 0) {
    return <LoadingState showHeader={true} statCards={4} contentCards={2} contentGridCols={2} />;
  }

  if (error && routes.length === 0) {
    return (
      <ErrorState
        title="Failed to Load Routes"
        message={error}
        onRetry={fetchRoutes}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <PageHeader
        title="Collection Routes"
        description="Optimize and manage waste collection routes efficiently"
        isConnected={isConnected}
        onRefresh={fetchRoutes}
        stats={[
          { label: 'Total Routes', value: stats.total },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'Active', value: stats.active },
          { label: 'Completed', value: stats.completed },
        ]}
        actions={
          <Button
            variant="secondary"
            onClick={() => setShowOptimizer(!showOptimizer)}
            className="bg-white text-primary-600 hover:bg-white/90"
          >
            <Plus className="h-5 w-5 mr-2" />
            {showOptimizer ? "Hide Optimizer" : "Create Route"}
          </Button>
        }
      />

      {/* Route Optimizer */}
      <AnimatePresence>
        {showOptimizer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {bins.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="p-4 bg-amber-100 rounded-full">
                      <AlertCircle className="h-8 w-8 text-amber-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No bins available
                  </h3>
                  <p className="text-gray-600 mb-4">
                    You need to create bins first before creating routes.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => (window.location.href = "/bins")}
                  >
                    Go to Bins Page
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <RouteOptimizer bins={bins} onRouteCreated={handleRouteCreated} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  { key: "all", label: "All", count: stats.total },
                  { key: "scheduled", label: "Scheduled", count: stats.scheduled },
                  { key: "active", label: "Active", count: stats.active },
                  { key: "completed", label: "Completed", count: stats.completed },
                ] as const
              ).map(({ key, label, count }) => (
                <Button
                  key={key}
                  variant={filter === key ? "primary" : "outline"}
                  size="sm"
                  onClick={() => setFilter(key as FilterType)}
                >
                  {label} ({count})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Routes Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {filteredRoutes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  <RouteIcon className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No routes found
              </h3>
              <p className="text-gray-500 mb-4">
                {filter === "all"
                  ? "Get started by creating a new route."
                  : `No ${filter} routes available.`}
              </p>
              {filter === "all" && (
                <Button variant="primary" onClick={() => setShowOptimizer(true)}>
                  <Plus className="h-5 w-5 mr-2" />
                  Create First Route
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AnimatePresence>
              {filteredRoutes.map((route, index) => {
                return (
                  <motion.div
                    key={route._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card variant="elevated" className="h-full hover-lift border border-gray-200">
                      <CardContent className="p-5">
                        {/* Header Section */}
                        <div className="flex items-start gap-4 mb-5">
                          {/* Icon */}
                          <div className="flex-shrink-0">
                            <div className="w-14 h-14 bg-blue-500 rounded-lg flex items-center justify-center border-2 border-blue-600 shadow-sm">
                              <RouteIcon className="h-7 w-7 text-white" />
                            </div>
                          </div>

                          {/* Title and Description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-900 capitalize">
                                {route.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded-full border border-gray-200">
                                  <div className="w-1.5 h-1.5 rounded-full bg-gray-600"></div>
                                  <span className="text-xs font-medium text-gray-700">
                                    {route.status === "completed" ? "Completed" :
                                     route.status === "active" ? "Active" :
                                     route.status === "scheduled" ? "Scheduled" :
                                     route.status === "draft" ? "Draft" : "Info"}
                                  </span>
                                </div>
                                {route.priority && (
                                  <Badge
                                    className={
                                      route.priority === "urgent" ? "bg-red-100 text-red-700" :
                                      route.priority === "high" ? "bg-orange-100 text-orange-700" :
                                      route.priority === "medium" ? "bg-amber-100 text-amber-700" :
                                      "bg-gray-100 text-gray-700"
                                    }
                                    size="sm"
                                  >
                                    {route.priority}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {route.description && (
                              <p className="text-sm text-gray-600">
                                {route.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-5">
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Collector</p>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span className="truncate">
                                {route.collectorId || "Unassigned"}
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Scheduled</p>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-gray-400" />
                              <span>{format(new Date(route.scheduledDate), "MMM dd, yyyy")}</span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Duration</p>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              <span>
                                {route.estimatedDuration || route.actualDuration || "N/A"} min
                              </span>
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Distance</p>
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                              <Navigation className="h-3.5 w-3.5 text-gray-400" />
                              <span>
                                {route.totalDistance
                                  ? `${route.totalDistance.toFixed(1)} km`
                                  : "N/A"}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Bins in Route Section */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-gray-500">Bins in Route</p>
                            <span className="text-xs font-semibold text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">
                              {route.bins?.length || 0} total
                            </span>
                          </div>
                          {route.bins && route.bins.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {route.bins.slice(0, 4).map((binId) => {
                                // Try to resolve the ObjectId to a friendly bin name
                                const matchedBin = bins.find(
                                  (b) => b._id === binId || b._id === String(binId)
                                );
                                const label = matchedBin?.binId || matchedBin?.name || String(binId).slice(-6);
                                const fill = matchedBin?.currentLevel ?? null;
                                return (
                                  <span
                                    key={String(binId)}
                                    title={matchedBin ? `${matchedBin.binId} — ${fill}% full` : String(binId)}
                                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                                      fill !== null && fill >= 90
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : fill !== null && fill >= 70
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {fill !== null && (
                                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                                        fill >= 90 ? 'bg-red-500' : fill >= 70 ? 'bg-amber-500' : 'bg-green-500'
                                      }`} />
                                    )}
                                    {label}
                                  </span>
                                );
                              })}
                              {route.bins.length > 4 && (
                                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">
                                  +{route.bins.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Progress Bar for Active Routes */}
                        {route.status === "active" && route.completionPercentage !== undefined && (
                          <div className="mb-5">
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-gray-600 font-medium">Progress</span>
                              <span className="font-semibold text-gray-900">
                                {route.completionPercentage}%
                              </span>
                            </div>
                            <div className="bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${route.completionPercentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedRoute(route)}
                            className="border-gray-300 text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                          {route.status === "draft" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await routesAPI.update(route._id, { status: 'scheduled' });
                                  fetchRoutes();
                                } catch (e: any) {
                                  toast.error(e.message || 'Failed to schedule route');
                                }
                              }}
                              className="border-blue-300 text-blue-600 hover:bg-blue-50"
                            >
                              <Calendar className="h-4 w-4 mr-2" />
                              Schedule
                            </Button>
                          )}
                          {route.status === "scheduled" && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStartRoute(route)}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Start Route
                            </Button>
                          )}
                          {route.status === "active" && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleCompleteRoute(route)}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Complete
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
      {/* ── Route Detail Drawer ───────────────────────────────── */}
      <AnimatePresence>
        {selectedRoute && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setSelectedRoute(null)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white capitalize">{selectedRoute.name}</h2>
                  <p className="text-blue-200 text-xs mt-0.5">{selectedRoute.routeId} · <span className="capitalize">{selectedRoute.status}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && selectedRoute.status !== "completed" && (
                    <button onClick={() => openEdit(selectedRoute)} className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors" title="Edit route">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => { setSelectedRoute(null); setIsEditing(false); setShowSchedulePicker(false); }} className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {isEditing ? (
                  /* ── EDIT MODE (Issues 3 & 4) ── */
                  <div className="p-5 space-y-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edit Route</p>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Route Name</label>
                      <input type="text" value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assign Collector</label>
                      {collectors.length > 0 ? (
                        <select value={editForm.collectorId} onChange={(e) => setEditForm(f => ({ ...f, collectorId: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                          <option value="">— Unassigned —</option>
                          {collectors.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
                        </select>
                      ) : (
                        <p className="text-xs text-gray-400 italic">No collector accounts found in the system.</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date &amp; Time</label>
                      <input type="datetime-local" value={editForm.scheduledDate} onChange={(e) => setEditForm(f => ({ ...f, scheduledDate: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={handleUpdateRoute} disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                        {isSaving ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="h-4 w-4" />}
                        {isSaving ? "Saving…" : "Save Changes"}
                      </button>
                      <button onClick={() => setIsEditing(false)}
                        className="flex-1 border border-gray-300 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Map */}
                    <div className="h-64 w-full">
                      {(() => {
                        const COLOMBO: LatLngTuple = [6.9271, 79.8612];
                        const stopCoords: LatLngTuple[] = [];
                        const stopBins: Array<{ bin: any; coord: LatLngTuple }> = [];
                        (selectedRoute.bins || []).forEach((binId: any) => {
                          const b = bins.find(b => b._id === String(binId));
                          if (!b) return;
                          let coord: LatLngTuple = COLOMBO;
                          if ((b.location as any)?.coordinates?.length === 2) coord = [(b.location as any).coordinates[1], (b.location as any).coordinates[0]];
                          else if ((b.location as any)?.latitude !== undefined) coord = [(b.location as any).latitude, (b.location as any).longitude];
                          stopCoords.push(coord);
                          stopBins.push({ bin: b, coord });
                        });
                        const center: LatLngTuple = stopCoords.length > 0 ? stopCoords[0] : COLOMBO;
                        const polyline: LatLngTuple[] = [COLOMBO, ...stopCoords, COLOMBO];
                        return (
                          <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
                            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <Marker position={COLOMBO} icon={makeStopIcon(0, "#6b7280")}><Popup><strong>Start / Depot</strong></Popup></Marker>
                            {stopBins.map(({ bin, coord }, i) => {
                              const fill = bin.currentLevel ?? 0; // Issue 5: live from useBins
                              const color = fill >= 90 ? "#ef4444" : fill >= 70 ? "#f59e0b" : "#22c55e";
                              return (
                                <Marker key={bin._id} position={coord} icon={makeStopIcon(i + 1, color)}>
                                  <Popup><strong>Stop {i + 1}: {bin.binId}</strong><br />{bin.name}<br />Fill: {fill}% (live)</Popup>
                                </Marker>
                              );
                            })}
                            {polyline.length > 2 && <Polyline positions={polyline} color="#2563eb" weight={3} opacity={0.7} dashArray="6 4" />}
                          </MapContainer>
                        );
                      })()}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-100">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Distance</p>
                        <p className="text-base font-bold text-gray-900">{selectedRoute.totalDistance ? `${selectedRoute.totalDistance.toFixed(1)} km` : "N/A"}</p>
                      </div>
                      <div className="text-center border-l border-gray-100">
                        <p className="text-xs text-gray-500">Duration</p>
                        <p className="text-base font-bold text-gray-900">{selectedRoute.estimatedDuration ? `${selectedRoute.estimatedDuration} min` : "N/A"}</p>
                      </div>
                    </div>

                    {/* Scheduled date banner (Issue 6) */}
                    {selectedRoute.scheduledDate && (
                      <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                        <Calendar className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-blue-700">Scheduled for</p>
                          <p className="text-sm font-bold text-blue-900">{format(new Date(selectedRoute.scheduledDate), "PPP p")}</p>
                        </div>
                      </div>
                    )}

                    {/* Collector info (Issue 4 — shows assigned collector name) */}
                    {selectedRoute.collectorId && (
                      <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">Assigned Collector</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {(() => { const c = collectors.find(c => c._id === String(selectedRoute.collectorId)); return c ? `${c.firstName} ${c.lastName}` : String(selectedRoute.collectorId); })()}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bin stop list with LIVE fill levels (Issue 5) */}
                    <div className="p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Stop Order</p>
                      <div className="space-y-2">
                        {(selectedRoute.bins || []).map((binId: any, i: number) => {
                          const b = bins.find(b => b._id === String(binId));
                          const fill = b?.currentLevel ?? null; // live from useBins hook
                          return (
                            <div key={String(binId)} className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${fill !== null && fill >= 90 ? 'bg-red-500' : fill !== null && fill >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`}>{i + 1}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{b?.binId || String(binId).slice(-8)}</p>
                                {b?.name && <p className="text-xs text-gray-500 truncate">{b.name}</p>}
                              </div>
                              {fill !== null ? (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${fill >= 90 ? 'bg-red-100 text-red-700' : fill >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {fill}% <span className="font-normal opacity-60">live</span>
                                </span>
                              ) : <span className="text-xs text-gray-400">—</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer actions */}
              {!isEditing && (
                <div className="flex gap-3 px-5 py-4 border-t border-gray-200 flex-shrink-0">
                  {selectedRoute.status === "draft" && (
                    showSchedulePicker ? (
                      <div className="flex-1 space-y-2">
                        <input type="datetime-local" value={scheduleDateTime} onChange={(e) => setScheduleDateTime(e.target.value)}
                          className="w-full px-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                        <div className="flex gap-2">
                          <button onClick={async () => {
                            try {
                              await routesAPI.update(selectedRoute._id, { status: 'scheduled', ...(scheduleDateTime ? { scheduledDate: new Date(scheduleDateTime).toISOString() } : {}) });
                              setShowSchedulePicker(false); setScheduleDateTime(""); fetchRoutes(); setSelectedRoute(null);
                            } catch (e: any) { toast.error(e.message || 'Failed'); }
                          }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-1.5 rounded-lg transition-colors">
                            Confirm Schedule
                          </button>
                          <button onClick={() => setShowSchedulePicker(false)} className="px-3 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">✕</button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" className="flex-1 border-blue-300 text-blue-600 hover:bg-blue-50" onClick={() => setShowSchedulePicker(true)}>
                        <Calendar className="h-4 w-4 mr-2" />Schedule
                      </Button>
                    )
                  )}
                  {selectedRoute.status === "scheduled" && (
                    <Button variant="primary" className="flex-1" onClick={() => { handleStartRoute(selectedRoute); setSelectedRoute(null); }}>
                      <Play className="h-4 w-4 mr-2" />Start Route
                    </Button>
                  )}
                  {selectedRoute.status === "active" && (
                    <Button variant="success" className="flex-1" onClick={() => { handleCompleteRoute(selectedRoute); setSelectedRoute(null); }}>
                      <CheckCircle className="h-4 w-4 mr-2" />Complete
                    </Button>
                  )}
                  <Button variant="outline" className="flex-1" onClick={() => { setSelectedRoute(null); setIsEditing(false); setShowSchedulePicker(false); }}>
                    Close
                  </Button>
                </div>
              )}
            </motion.div>

          </>
        )}
      </AnimatePresence>
    </div>
  );
};
