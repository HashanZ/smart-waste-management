import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from 'react-query';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Package,
  Truck,
  MapPin,
  Activity,
} from 'lucide-react';
import { analyticsAPI, Metrics, BinStatusSummary, CollectionSummary, RoutePerformance, PredictionMetrics } from '../api/analytics';
import { collectionsAPI } from '../api/collections';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner, SkeletonCard } from '../components/ui/LoadingSpinner';
import { format, subDays } from 'date-fns';
import { BIN_TYPE_COLORS_HEX } from '../utils/binUtils';

type DateRange = '7d' | '30d' | '90d';

// Chart color palette matching design system
const CHART_COLORS = {
  primary: '#22c55e',
  primaryDark: '#16a34a',
  secondary: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  gray: '#6b7280',
};

const WASTE_TYPE_COLORS = BIN_TYPE_COLORS_HEX;

export const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  // Calculate date range
  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    switch (dateRange) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }
    // Set to start of day for startDate and end of day for endDate
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };

  // Fetch analytics data
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useQuery<Metrics>(
    ['analytics-metrics', dateRange],
    () => {
      const dateRangeParams = getDateRange();
      return analyticsAPI.getMetrics({
        startDate: dateRangeParams.startDate,
        endDate: dateRangeParams.endDate
      });
    },
    {
      refetchInterval: 60000,
      staleTime: 30000,
      onError: (error) => {
        console.error('Analytics metrics fetch error:', error);
      },
      onSuccess: (data) => {
        console.log('Analytics metrics fetched:', data);
      },
    }
  );

  const { data: binStatus, isLoading: binStatusLoading } = useQuery<BinStatusSummary>(
    ['analytics-bin-status'],
    () => analyticsAPI.getBinStatusSummary(),
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  const { data: collectionSummary, isLoading: collectionLoading } = useQuery<CollectionSummary>(
    ['analytics-collection-summary'],
    () => analyticsAPI.getCollectionSummary(),
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  const { data: routePerformance, isLoading: routeLoading } = useQuery<RoutePerformance>(
    ['analytics-route-performance'],
    () => analyticsAPI.getRoutePerformance(),
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  // Fetch prediction metrics
  const { data: predictionMetrics, isLoading: predictionMetricsLoading } = useQuery<PredictionMetrics>(
    ['analytics-prediction-metrics', dateRange],
    () => {
      const dateRangeParams = getDateRange();
      return analyticsAPI.getPredictionMetrics({
        startDate: dateRangeParams.startDate,
        endDate: dateRangeParams.endDate,
      });
    },
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  const isLoading = metricsLoading || binStatusLoading || collectionLoading || routeLoading || predictionMetricsLoading;

  // Calculate efficiency from collections
  const efficiency = collectionSummary?.efficiency || metrics?.efficiency || 0;
  const avgFillLevel = metrics?.avgFillLevel || 0;
  const wasteGenerated = metrics?.wasteGenerated || {
    general: 0,
    recyclable: 0,
    organic: 0,
    hazardous: 0
  };

  const totalBins = metrics?.totalBins || binStatus?.total || 0;
  const activeBins = metrics?.activeBins || binStatus?.active || 0;
  const overflowingBins = metrics?.overflowingBins || binStatus?.overflowing || 0;
  const collectionsToday = metrics?.collectionsToday || collectionSummary?.completedToday || 0;

  // Prepare data for waste type pie chart
  const wasteTypeData = useMemo(() => {
    const total = Object.values(wasteGenerated).reduce((sum, val) => sum + val, 0);
    if (total === 0) return [];

    return Object.entries(wasteGenerated)
      .filter(([_, value]) => value > 0)
      .map(([type, value]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value,
        percentage: ((value / total) * 100).toFixed(1),
        color: WASTE_TYPE_COLORS[type as keyof typeof WASTE_TYPE_COLORS],
      }));
  }, [wasteGenerated]);

  // Fetch collections for trend data
  const { data: collectionsData } = useQuery(
    ['analytics-collections-trend', dateRange],
    () => collectionsAPI.getCollections({
      startDate: getDateRange().startDate,
      endDate: getDateRange().endDate,
      limit: 100 // Backend max limit is 100
    }),
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  // Generate real trend data from collections
  const fillLevelTrendData = useMemo(() => {
    if (!collectionsData?.data || collectionsData.data.length === 0) {
      // If no historical data, show current snapshot
      return [{
        date: format(new Date(), 'MMM dd'),
        fillLevel: avgFillLevel || 0,
        collections: collectionsToday || 0,
      }];
    }

    // Group collections by date
    const collectionsByDate = collectionsData.data.reduce((acc: any, collection: any) => {
      const date = format(new Date(collection.actualDate || collection.scheduledDate || collection.collectionDate || new Date()), 'MMM dd');
      if (!acc[date]) {
        acc[date] = { date, collections: 0, totalFillLevel: 0, count: 0 };
      }
      acc[date].collections += 1;
      acc[date].count += 1;
      return acc;
    }, {});

    // Convert to array and calculate average fill level
    return Object.values(collectionsByDate).map((item: any) => ({
      date: item.date,
      fillLevel: avgFillLevel || 0, // Use current avg since we don't have historical fill levels
      collections: item.collections,
    }));
  }, [collectionsData, avgFillLevel, collectionsToday]);

  // Collection efficiency trend data from real collections
  const efficiencyTrendData = useMemo(() => {
    if (!collectionsData?.data || collectionsData.data.length === 0) {
      // If no historical data, show current snapshot
      return [{
        date: format(new Date(), 'MMM dd'),
        efficiency: efficiency * 100 || 0,
        collections: collectionsToday || 0,
      }];
    }

    // Group collections by date and calculate efficiency
    const collectionsByDate = collectionsData.data.reduce((acc: any, collection: any) => {
      const date = format(new Date(collection.actualDate || collection.scheduledDate || collection.collectionDate || new Date()), 'MMM dd');
      if (!acc[date]) {
        acc[date] = { date, completed: 0, total: 0 };
      }
      acc[date].total += 1;
      if (collection.status === 'completed') {
        acc[date].completed += 1;
      }
      return acc;
    }, {});

    // Convert to array and calculate efficiency
    return Object.values(collectionsByDate).map((item: any) => ({
      date: item.date,
      efficiency: item.total > 0 ? (item.completed / item.total) * 100 : 0,
      collections: item.total,
    }));
  }, [collectionsData, efficiency, collectionsToday]);

  // Bin status distribution
  const binStatusData = useMemo(() => {
    if (!binStatus) return [];
    return [
      { name: 'Active', value: binStatus.active, color: CHART_COLORS.primary },
      { name: 'Overflowing', value: binStatus.overflowing, color: CHART_COLORS.danger },
      { name: 'Maintenance', value: binStatus.maintenance || 0, color: CHART_COLORS.warning },
      { name: 'Inactive', value: (binStatus.total || 0) - (binStatus.active || 0) - (binStatus.overflowing || 0) - (binStatus.maintenance || 0), color: CHART_COLORS.gray },
    ].filter(item => item.value > 0);
  }, [binStatus]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
              {entry.dataKey === 'fillLevel' && '%'}
              {entry.dataKey === 'efficiency' && '%'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading && !metrics && !binStatus && !collectionSummary) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gradient-eco rounded-2xl p-8 shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-eco rounded-2xl p-8 shadow-xl relative overflow-hidden"
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl font-heading font-bold text-white mb-2">
                Analytics & Insights
              </h1>
              <p className="text-primary-100 text-lg">
                Comprehensive performance metrics and data visualization
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {(['7d', '30d', '90d'] as DateRange[]).map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                  className={dateRange === range ? 'bg-white text-primary-600' : 'bg-white/10 text-white hover:bg-white/20'}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard
          title="Total Bins"
          value={totalBins}
          icon={<Package className="h-6 w-6" />}
          variant="default"
        />
        <StatCard
          title="Efficiency"
          value={efficiency * 100}
          suffix="%"
          icon={<TrendingUp className="h-6 w-6" />}
          variant="primary"
        />
        <StatCard
          title="Collections Today"
          value={collectionsToday}
          icon={<Truck className="h-6 w-6" />}
          variant="default"
        />
        <StatCard
          title="Avg Fill Level"
          value={avgFillLevel}
          suffix="%"
          icon={<Activity className="h-6 w-6" />}
          variant={avgFillLevel > 70 ? "warning" : "success"}
        />
      </motion.div>

      {/* Status Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        <StatCard
          title="Active Bins"
          value={activeBins}
          icon={<Package className="h-6 w-6" />}
          variant="success"
        />
        <StatCard
          title="Overflowing"
          value={overflowingBins}
          icon={<AlertTriangle className="h-6 w-6" />}
          variant="danger"
        />
        <StatCard
          title="Maintenance"
          value={binStatus?.maintenance || 0}
          icon={<Clock className="h-6 w-6" />}
          variant="warning"
        />
        <StatCard
          title="Routes Completed"
          value={routePerformance?.completedRoutes || 0}
          icon={<MapPin className="h-6 w-6" />}
          variant="default"
        />
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fill Level Trends - Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-6 w-6 text-primary-600" />
                <span>Fill Level Trends</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={fillLevelTrendData}>
                  <defs>
                    <linearGradient id="fillLevelGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="fillLevel"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    fill="url(#fillLevelGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Collection Efficiency - Line Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-primary-600" />
                <span>Collection Efficiency</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={efficiencyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickLine={false}
                    domain={[60, 100]}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="efficiency"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={3}
                    dot={{ fill: CHART_COLORS.primary, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* Waste Generation by Type - Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-6 w-6 text-primary-600" />
                <span>Waste Generation by Type</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wasteTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={wasteTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {wasteTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value, entry: any) => (
                        <span style={{ color: entry.color }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No waste data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Bin Status Distribution - Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-6 w-6 text-primary-600" />
                <span>Bin Status Distribution</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {binStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={binStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={12}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      radius={[8, 8, 0, 0]}
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {binStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No bin status data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collection Performance */}
        {collectionSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
          >
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Truck className="h-6 w-6 text-primary-600" />
                  <span>Collection Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Collections</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {collectionSummary.totalCollections}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Pending</p>
                    <p className="text-2xl font-bold text-amber-600">
                      {collectionSummary.pending}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Avg Weight</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {collectionSummary.avgWeight.toFixed(1)} kg
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Efficiency</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(collectionSummary.efficiency * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Route Performance */}
        {routePerformance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <Card variant="elevated">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-6 w-6 text-primary-600" />
                  <span>Route Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Routes</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {routePerformance.totalRoutes}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Avg Distance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {routePerformance.avgDistance.toFixed(1)} km
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Efficiency</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(routePerformance.efficiency * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">CO₂ Saved</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {routePerformance.co2Saved.toFixed(1)} kg
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Prediction Analytics Section */}
      {predictionMetrics && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.9 }}
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">ML Prediction Analytics</h2>
          </motion.div>

          {/* Prediction Accuracy Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
            >
              <Card variant="elevated">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Mean Absolute Error</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {predictionMetrics.accuracy.mae.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Lower is better</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
            >
              <Card variant="elevated">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Root Mean Squared Error</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {predictionMetrics.accuracy.rmse.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Lower is better</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 }}
            >
              <Card variant="elevated">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Mean Absolute % Error</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {predictionMetrics.accuracy.mape.toFixed(2)}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Lower is better</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.3 }}
            >
              <Card variant="elevated">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Sample Count</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {predictionMetrics.accuracy.sampleCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Predictions evaluated</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Prediction Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Prediction Trends: Predicted vs Actual */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.4 }}
            >
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-6 w-6 text-primary-600" />
                    <span>Prediction Trends (Predicted vs Actual)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {predictionMetrics.trends && predictionMetrics.trends.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={predictionMetrics.trends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={12}
                          tickLine={false}
                          domain={[0, 100]}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="predicted"
                          name="Predicted"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2}
                          dot={{ fill: CHART_COLORS.primary, r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="Actual"
                          stroke={CHART_COLORS.info}
                          strokeWidth={2}
                          dot={{ fill: CHART_COLORS.info, r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <TrendingUp className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                        <p>No prediction trend data available</p>
                        <p className="text-sm mt-1">Data will appear after predictions are evaluated</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* ML vs Fallback Breakdown */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.5 }}
            >
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-6 w-6 text-primary-600" />
                    <span>ML vs Fallback Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-green-900">ML Service</span>
                        <Badge variant="success" size="sm">
                          {predictionMetrics.sourceBreakdown.ml.count} predictions
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <p className="text-xs text-green-700">MAE</p>
                          <p className="text-lg font-bold text-green-900">
                            {predictionMetrics.sourceBreakdown.ml.mae.toFixed(2)}
                          </p>
                        </div>
                        {predictionMetrics.sourceBreakdown.ml.accuracy !== null && (
                          <div>
                            <p className="text-xs text-green-700">Accuracy</p>
                            <p className="text-lg font-bold text-green-900">
                              {predictionMetrics.sourceBreakdown.ml.accuracy.toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-amber-900">Fallback</span>
                        <Badge variant="warning" size="sm">
                          {predictionMetrics.sourceBreakdown.fallback.count} predictions
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <p className="text-xs text-amber-700">MAE</p>
                          <p className="text-lg font-bold text-amber-900">
                            {predictionMetrics.sourceBreakdown.fallback.mae.toFixed(2)}
                          </p>
                        </div>
                        {predictionMetrics.sourceBreakdown.fallback.accuracy !== null && (
                          <div>
                            <p className="text-xs text-amber-700">Accuracy</p>
                            <p className="text-lg font-bold text-amber-900">
                              {predictionMetrics.sourceBreakdown.fallback.accuracy.toFixed(1)}%
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total Predictions</span>
                        <span className="font-semibold text-gray-900">
                          {predictionMetrics.totalPredictions}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm mt-1">
                        <span className="text-gray-600">With Actual Values</span>
                        <span className="font-semibold text-gray-900">
                          {predictionMetrics.predictionsWithActuals}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Confidence Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.6 }}
            >
              <Card variant="elevated">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-6 w-6 text-primary-600" />
                    <span>Prediction Confidence Distribution</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {predictionMetrics.confidenceDistribution && (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: 'High (≥80%)',
                              value: predictionMetrics.confidenceDistribution.high,
                              color: CHART_COLORS.primary,
                            },
                            {
                              name: 'Medium (60-79%)',
                              value: predictionMetrics.confidenceDistribution.medium,
                              color: CHART_COLORS.warning,
                            },
                            {
                              name: 'Low (<60%)',
                              value: predictionMetrics.confidenceDistribution.low,
                              color: CHART_COLORS.danger,
                            },
                          ].filter(item => item.value > 0)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'High', color: CHART_COLORS.primary },
                            { name: 'Medium', color: CHART_COLORS.warning },
                            { name: 'Low', color: CHART_COLORS.danger },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};
