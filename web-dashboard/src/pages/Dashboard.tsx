import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  TrendingUp,
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  MapPin,
  Truck,
  BarChart3,
  Database,
} from "lucide-react";
import { analyticsAPI, DashboardData } from "../api/analytics";
import { adminAPI, MLHealthStatus } from "../api/admin";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { StatCard } from "../components/ui/StatCard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/Card";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { LoadingSpinner, SkeletonCard } from "../components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: "bin" | "collection" | "alert" | "route";
  title: string;
  time: string;
  status: "success" | "error" | "warning" | "info";
  icon: React.ElementType;
  timestamp: Date;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "success":
      return CheckCircle;
    case "error":
      return XCircle;
    case "warning":
      return AlertTriangle;
    default:
      return Activity;
  }
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case "bin":
      return Trash2;
    case "collection":
      return Truck;
    case "alert":
      return AlertTriangle;
    case "route":
      return MapPin;
    default:
      return Activity;
  }
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mlHealth, setMlHealth] = useState<MLHealthStatus | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Add activity to the list
  const addActivity = React.useCallback((activity: Activity) => {
    setActivities((prev) => {
      const updated = [activity, ...prev].slice(0, 10); // Keep only last 10
      return updated;
    });
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = React.useCallback(async () => {
    try {
      setError(null);
      const data = await analyticsAPI.getDashboardData();
      setDashboardData(data);

      // Populate activities from API response
      if (data.recentActivity && data.recentActivity.length > 0) {
        const transformedActivities: Activity[] = data.recentActivity.map(
          (activity) => {
            const activityTime =
              activity.time instanceof Date
                ? activity.time
                : new Date(activity.time);

            // Determine the icon based on activity type
            const activityIcon = getActivityIcon(activity.type);

            return {
              id: activity.id,
              type: activity.type as "bin" | "collection" | "alert" | "route",
              title: activity.title,
              time: formatDistanceToNow(activityTime, { addSuffix: true }),
              status: activity.status as
                | "success"
                | "error"
                | "warning"
                | "info",
              icon: activityIcon,
              timestamp: activityTime,
            };
          },
        );

        // On initial load, replace activities. On refresh, merge and deduplicate
        if (isInitialLoad) {
          setActivities(transformedActivities);
          setIsInitialLoad(false);
        } else {
          // Merge API activities with socket activities, removing duplicates
          setActivities((prev) => {
            const combined = [...transformedActivities, ...prev];
            const unique = combined.filter(
              (activity, index, self) =>
                index === self.findIndex((a) => a.id === activity.id),
            );
            return unique.slice(0, 10); // Keep only last 10
          });
        }
      } else if (isInitialLoad) {
        // If no activities from API on initial load, set empty array
        setActivities([]);
        setIsInitialLoad(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [isInitialLoad]);

  // Fetch ML health status
  const fetchMLHealth = React.useCallback(async () => {
    try {
      const health = await adminAPI.getMLHealth();
      setMlHealth(health);
    } catch (err: any) {
      console.error("ML health check error:", err);
      // Set unhealthy status if check fails
      setMlHealth({ healthy: false, latencyMs: 0, model_trained: false });
    }
  }, []);

  // Manual refresh
  const handleRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
    fetchMLHealth();

    // Refresh every 30 seconds as fallback
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchMLHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData, fetchMLHealth]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!socket) return;

    // Bin updates
    socket.on("bin:update", (data: any) => {
      console.log("✅ Bin update received on Dashboard:", data);

      addActivity({
        id: `bin-${Date.now()}`,
        type: "bin",
        title: `Bin ${data.binId} updated - ${data.currentLevel}% full`,
        time: formatDistanceToNow(new Date(), { addSuffix: true }),
        status:
          data.currentLevel >= 90
            ? "error"
            : data.currentLevel >= 70
              ? "warning"
              : "info",
        icon: Trash2,
        timestamp: new Date(),
      });

      // Refresh dashboard data
      fetchDashboardData();
    });

    // Alert updates
    socket.on("alert:new", (data: any) => {
      console.log("Alert received:", data);
      toast.error(`🚨 Alert: ${data.type} - Bin ${data.binId}`);
      addActivity({
        id: `alert-${Date.now()}`,
        type: "alert",
        title: `Alert: Bin ${data.binId} - ${data.type}`,
        time: formatDistanceToNow(new Date(), { addSuffix: true }),
        status: "error",
        icon: AlertTriangle,
        timestamp: new Date(),
      });

      fetchDashboardData();
    });

    // Collection updates
    socket.on("collection:update", (data: any) => {
      console.log("Collection update received:", data);
      addActivity({
        id: `collection-${Date.now()}`,
        type: "collection",
        title: `Collection ${data.status}`,
        time: formatDistanceToNow(new Date(), { addSuffix: true }),
        status: data.status === "completed" ? "success" : "info",
        icon: Truck,
        timestamp: new Date(),
      });

      fetchDashboardData();
    });

    // Route updates
    socket.on("route:update", (data: any) => {
      console.log("Route update received:", data);
      addActivity({
        id: `route-${Date.now()}`,
        type: "route",
        title: `Route ${data.name} - ${data.status}`,
        time: formatDistanceToNow(new Date(), { addSuffix: true }),
        status: data.status === "completed" ? "success" : "info",
        icon: MapPin,
        timestamp: new Date(),
      });

      fetchDashboardData();
    });

    return () => {
      socket.off("bin:update");
      socket.off("alert:new");
      socket.off("collection:update");
      socket.off("route:update");
    };
  }, [socket, addActivity, fetchDashboardData]);

  // Loading state with skeleton
  if (loading && !dashboardData) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header Skeleton */}
        <div className="bg-gradient-eco rounded-2xl p-8 shadow-xl border border-emerald-600/20">
          <div className="h-10 bg-white/10 rounded w-1/3 mb-4 shimmer" />
          <div className="h-6 bg-white/10 rounded w-1/2 shimmer" />
        </div>

        {/* Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !dashboardData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Failed to Load Dashboard
          </h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchDashboardData} variant="primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  const stats = dashboardData?.stats || {
    totalBins: 0,
    collectionsToday: 0,
    overflowingBins: 0,
    routesActive: 0,
    activeBins: 0,
    alertsActive: 0,
    maintenanceBins: 0,
    systemHealth: 0,
  };

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Welcome Banner - Clean & Modern */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl shadow-lg border border-emerald-500/20 bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-600"
      >
        {/* Subtle Grid Pattern */}
        <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:3rem_3rem]" />
        
        {/* Decorative Blur */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

        <div className="relative z-10 p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                Welcome Back{user?.firstName ? `, ${user.firstName}` : ''}!{" "}
                <motion.span
                  animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.8, ease: "easeInOut" }}
                  className="inline-block"
                >
                  👋
                </motion.span>
              </h1>
              <p className="text-emerald-50 text-base font-medium">
                Real-time overview of your eco-friendly waste management system
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/30">
                <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-300 animate-pulse" : "bg-red-400"}`} />
                <span className="text-white text-sm font-semibold">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 h-9 w-9 rounded-lg"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/30">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-white text-xs font-semibold">Live Updates Active</span>
            </div>
            {dashboardData?.databaseConnected !== undefined && (
              <div className={`inline-flex items-center gap-2 backdrop-blur-sm rounded-full px-3 py-1.5 border ${
                dashboardData.databaseConnected
                  ? "bg-white/20 border-white/30"
                  : "bg-red-500/30 border-red-300/50"
              }`}>
                <Database className={`h-3 w-3 ${dashboardData.databaseConnected ? "text-white" : "text-red-200"}`} />
                <span className="text-white text-xs font-semibold">
                  {dashboardData.databaseConnected ? "Database Connected" : "Database Disconnected"}
                </span>
              </div>
            )}
            {dashboardData?.lastUpdated && (
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/25">
                <Clock className="h-3 w-3 text-white/90" />
                <span className="text-white text-xs font-medium">
                  Updated {formatDistanceToNow(
                    dashboardData.lastUpdated instanceof Date
                      ? dashboardData.lastUpdated
                      : new Date(dashboardData.lastUpdated),
                    { addSuffix: true },
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Key Metrics Cards - Uniform Size */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* Total Bins — with active rate trend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="h-full"
        >
          <StatCard
            title="Total Bins"
            value={stats.totalBins || 0}
            change={stats.totalBins > 0
              ? Math.round(((stats.activeBins || 0) / stats.totalBins) * 100) - 100
              : 0}
            changeLabel={`${stats.activeBins || 0} active`}
            icon={<Trash2 className="h-6 w-6" />}
            variant="default"
            isAnimated
          />
        </motion.div>

        {/* Collections Today — with system health as proxy trend */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="h-full"
        >
          <StatCard
            title="Collections Today"
            value={stats.collectionsToday || 0}
            change={stats.collectionsToday > 0 ? +(((stats.collectionsToday / Math.max(stats.totalBins, 1)) * 100).toFixed(1)) : 0}
            changeLabel="of bins served"
            icon={<Truck className="h-6 w-6" />}
            variant="success"
            isAnimated
          />
        </motion.div>

        {/* Overflowing Bins — negative trend when bins are overflowing */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="h-full"
        >
          <StatCard
            title="Overflowing Bins"
            value={stats.overflowingBins || 0}
            change={stats.totalBins > 0
              ? -(Math.round(((stats.overflowingBins || 0) / stats.totalBins) * 100))
              : 0}
            changeLabel={stats.overflowingBins > 0 ? "needs attention" : "all bins normal"}
            icon={<AlertTriangle className="h-6 w-6" />}
            variant={(stats.overflowingBins || 0) > 0 ? "danger" : "default"}
            isAnimated
          />
        </motion.div>

        {/* Active Routes — with % of active routes vs total */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="h-full"
        >
          <StatCard
            title="Active Routes"
            value={stats.routesActive || 0}
            change={stats.routesActive > 0 ? stats.routesActive : 0}
            changeLabel="in progress"
            icon={<MapPin className="h-6 w-6" />}
            variant="default"
            isAnimated
          />
        </motion.div>
      </motion.div>

      {/* Main Content Grid - Enhanced */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
        {/* Recent Activity - Clean Design */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="lg:col-span-2"
        >
          <Card className="h-full border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-gray-900">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Activity className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-lg font-bold">Recent Activity</span>
                </CardTitle>
                <Badge
                  variant="info"
                  className="bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {activities.length === 0 ? (
                <div className="text-center py-10">
                  <div className="flex justify-center mb-4">
                    <svg width="110" height="95" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <rect x="30" y="35" width="60" height="55" rx="6" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="2"/>
                      <rect x="22" y="27" width="76" height="12" rx="5" fill="#6ee7b7" stroke="#34d399" strokeWidth="2"/>
                      <rect x="47" y="20" width="26" height="10" rx="5" fill="#34d399"/>
                      <line x1="48" y1="48" x2="48" y2="80" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="60" y1="48" x2="60" y2="80" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="72" y1="48" x2="72" y2="80" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="15" cy="20" r="4" fill="#a7f3d0"/>
                      <circle cx="108" cy="28" r="3" fill="#6ee7b7"/>
                      <circle cx="102" cy="14" r="2" fill="#34d399"/>
                      <circle cx="18" cy="58" r="2" fill="#34d399"/>
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-800 mb-1">
                    All quiet so far
                  </h3>
                  <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Real-time events from bins, routes, alerts, and collections will show up here as they happen.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[32rem] overflow-y-auto pr-2">
                  {activities.map((activity, index) => {
                    const Icon = getActivityIcon(activity.type);
                    const statusColors = {
                      success: "bg-emerald-100 text-emerald-600",
                      error: "bg-red-100 text-red-600",
                      warning: "bg-amber-100 text-amber-600",
                      info: "bg-blue-100 text-blue-600",
                    };

                    return (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${statusColors[activity.status]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 mb-0.5">
                            {activity.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {activity.time}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          <span className="text-xs font-medium text-gray-600 capitalize">
                            {activity.status}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & System Status - Enhanced */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-6"
        >
          {/* Quick Actions - Role-aware */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                </div>
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2.5">
              {/* View Routes — all roles */}
              <Button
                variant="outline"
                className="w-full justify-start border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 h-12 font-semibold rounded-lg transition-all"
                onClick={() => navigate("/routes")}
              >
                <div className="p-1.5 bg-emerald-100 rounded-md mr-3">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                </div>
                View Routes
              </Button>

              {/* Schedule Collection — admin & municipal_officer only */}
              {['admin', 'municipal_officer'].includes(user?.role ?? '') && (
                <Button
                  variant="outline"
                  className="w-full justify-start border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 h-12 font-semibold rounded-lg transition-all"
                  onClick={() => navigate("/collections")}
                >
                  <div className="p-1.5 bg-emerald-100 rounded-md mr-3">
                    <Truck className="h-4 w-4 text-emerald-600" />
                  </div>
                  Schedule Collection
                </Button>
              )}

              {/* Add New Bin — admin & municipal_officer only */}
              {['admin', 'municipal_officer'].includes(user?.role ?? '') && (
                <Button
                  variant="outline"
                  className="w-full justify-start border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 h-12 font-semibold rounded-lg transition-all"
                  onClick={() => navigate("/bins")}
                >
                  <div className="p-1.5 bg-emerald-100 rounded-md mr-3">
                    <Trash2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  Add New Bin
                </Button>
              )}

              {/* View Analytics — admin, municipal_officer & supervisor */}
              {['admin', 'municipal_officer', 'supervisor'].includes(user?.role ?? '') && (
                <Button
                  variant="outline"
                  className="w-full justify-start border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 h-12 font-semibold rounded-lg transition-all"
                  onClick={() => navigate("/analytics")}
                >
                  <div className="p-1.5 bg-emerald-100 rounded-md mr-3">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                  </div>
                  View Analytics
                </Button>
              )}
            </CardContent>
          </Card>

          {/* System Status - Clean Design */}
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Activity className="h-4 w-4 text-emerald-600" />
                </div>
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {/* API Server */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-semibold text-gray-700">API Server</span>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-medium">
                  Online
                </Badge>
              </div>

              {/* WebSocket */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />
                  <span className="text-sm font-semibold text-gray-700">WebSocket</span>
                </div>
                <Badge className={`text-xs font-medium ${isConnected ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>

              {/* Active Bins */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 bg-emerald-100 rounded-md">
                    <Trash2 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Active Bins</span>
                </div>
                <span className="text-sm font-bold text-emerald-700">
                  {stats.activeBins || 0} / {stats.totalBins || 0}
                </span>
              </div>

              {/* Active Alerts */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="p-1 bg-amber-100 rounded-md">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Active Alerts</span>
                </div>
                <Badge className={`text-xs font-medium ${stats.alertsActive === 0 ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                  {stats.alertsActive || 0}
                </Badge>
              </div>

              {/* ML Service */}
              <div className="pt-3 mt-3 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3 p-2.5 rounded-lg bg-emerald-50/50">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 bg-emerald-100 rounded-md">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">ML Service</span>
                  </div>
                  <Badge className={`text-xs font-medium ${mlHealth?.healthy ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                    {mlHealth?.healthy ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="space-y-2 pl-3">
                  <div className="flex items-center justify-between text-xs p-2 rounded-md bg-gray-50">
                    <span className="text-gray-600 font-medium">Model Status:</span>
                    <Badge className={`text-xs font-medium ${mlHealth?.model_trained ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-amber-100 text-amber-700 border border-amber-200"}`}>
                      {mlHealth?.model_trained ? "Trained" : "Not Trained"}
                    </Badge>
                  </div>
                  {mlHealth?.latencyMs !== undefined && (
                    <div className="flex items-center justify-between text-xs p-2 rounded-md bg-gray-50">
                      <span className="text-gray-600 font-medium">Latency:</span>
                      <span className="text-emerald-700 font-bold">{mlHealth.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
