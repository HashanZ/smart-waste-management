import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'react-query';
import {
  AlertTriangle,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  MapPin,
  Filter,
  Bell,
  BellOff,
  Eye,
  X,
  Package,
} from 'lucide-react';
import { alertsAPI, Alert } from '../api/alerts';
import { useSocket } from '../contexts/SocketContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { StatCard } from '../components/ui/StatCard';
import { LoadingSpinner, SkeletonCard } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';

type FilterType = 'all' | 'active' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type TypeFilter = 'all' | 'overflow' | 'full' | 'maintenance' | 'offline';

export const Alerts: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [filter, setFilter] = useState<FilterType>('all');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch alerts from API
  const { data: alerts = [], isLoading, error, refetch } = useQuery<Alert[]>(
    ['alerts', filter],
    () => alertsAPI.getAlerts({
      status: filter === 'all' ? undefined : filter,
      limit: 100
    }),
    {
      refetchInterval: 30000,
      staleTime: 10000,
    }
  );

  // Fetch alert summary
  const { data: alertSummary } = useQuery(
    ['alert-summary'],
    () => alertsAPI.getAlertSummary(),
    {
      refetchInterval: 60000,
      staleTime: 30000,
    }
  );

  // Listen for real-time alert updates via WebSocket
  useEffect(() => {
    if (!socket) return;

    socket.on('alert:new', (data: any) => {
      console.log('✅ Alert received on Alerts page:', data);
      toast.error(`🚨 New Alert: ${data.type} - Bin ${data.binId}`, {
        duration: 4000,
        icon: '🚨',
      });
      refetch();
    });

    return () => {
      socket.off('alert:new');
    };
  }, [socket, refetch]);

  // Filter and search alerts
  const filteredAlerts = useMemo(() => {
    let result = alerts;

    // Status filter
    if (filter !== 'all') {
      result = result.filter((a) => a.status === filter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter((a) => a.severity === severityFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter((a) => a.type === typeFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.title?.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query) ||
          a.binId?.toLowerCase().includes(query) ||
          a.type?.toLowerCase().includes(query)
      );
    }

    // Sort by severity and timestamp (critical first, then by time)
    result = [...result].sort((a, b) => {
      const severityOrder: { [key: string]: number } = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      const severityDiff = (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
      if (severityDiff !== 0) return severityDiff;

      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return bTime - aTime; // Newest first
    });

    return result;
  }, [alerts, filter, severityFilter, typeFilter, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = alerts.length;
    const active = alerts.filter((a) => a.status === 'active').length;
    const resolved = alerts.filter((a) => a.status === 'resolved').length;
    const critical = alerts.filter((a) => a.severity === 'critical').length;
    const high = alerts.filter((a) => a.severity === 'high').length;

    return { total, active, resolved, critical, high };
  }, [alerts]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'danger';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'bg-red-100';
      case 'medium':
        return 'bg-amber-100';
      case 'low':
        return 'bg-blue-100';
      default:
        return 'bg-gray-100';
    }
  };

  const getSeverityIconColor = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-amber-600';
      case 'low':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'overflow':
        return Trash2;
      case 'maintenance':
        return AlertTriangle;
      case 'offline':
        return Clock;
      case 'full':
        return AlertTriangle;
      default:
        return AlertTriangle;
    }
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      overflow: 'bg-red-100 text-red-700',
      full: 'bg-orange-100 text-orange-700',
      maintenance: 'bg-amber-100 text-amber-700',
      offline: 'bg-gray-100 text-gray-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  const handleViewLocation = (alert: Alert) => {
    if (alert.location) {
      const url = `https://www.google.com/maps?q=${alert.location.latitude},${alert.location.longitude}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading && alerts.length === 0) {
    return <LoadingState showHeader={true} statCards={5} contentCards={3} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Alerts"
        message={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <PageHeader
        title="Alerts & Notifications"
        description="Monitor system alerts and respond to issues in real-time"
        isConnected={isConnected}
        onRefresh={() => refetch()}
        stats={[
          { label: 'Total Alerts', value: stats.total },
          { label: 'Active', value: stats.active },
          { label: 'Critical', value: stats.critical },
          { label: 'High Priority', value: stats.high },
          { label: 'Resolved', value: stats.resolved },
        ]}
      />

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search alerts by title, description, bin ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  rightIcon={
                    searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : undefined
                  }
                />
              </div>

              {/* Filter Buttons - Compact Horizontal Layout */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    { key: 'all', label: 'All', count: stats.total },
                    { key: 'active', label: 'Active', count: stats.active },
                    { key: 'resolved', label: 'Resolved', count: stats.resolved },
                  ] as const
                ).map(({ key, label, count }) => (
                  <Button
                    key={key}
                    variant={filter === key ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(key as FilterType)}
                  >
                    {label} ({count})
                  </Button>
                ))}
                {(
                  [
                    { key: 'all', label: 'All Severity' },
                    { key: 'critical', label: 'Critical' },
                    { key: 'high', label: 'High' },
                    { key: 'medium', label: 'Medium' },
                    { key: 'low', label: 'Low' },
                  ] as const
                ).map(({ key, label }) => (
                  <Button
                    key={`severity-${key}`}
                    variant={severityFilter === key ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setSeverityFilter(key as SeverityFilter)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Alerts List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  <Bell className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts found</h3>
              <p className="text-gray-500">
                {searchQuery || filter !== 'all' || severityFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No active alerts at the moment. All systems are operating normally.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <AnimatePresence>
              {filteredAlerts.map((alert, index) => {
                const AlertIcon = getAlertIcon(alert.type);
                const isCritical = alert.severity === 'critical' || alert.severity === 'high';

                return (
                  <motion.div
                    key={alert.alertId || alert.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <Card
                      variant="elevated"
                      className={`border-l-4 ${
                        isCritical
                          ? 'border-red-500 hover:border-red-600'
                          : alert.severity === 'medium'
                            ? 'border-amber-500 hover:border-amber-600'
                            : 'border-blue-500 hover:border-blue-600'
                      } hover-lift border border-gray-200`}
                    >
                      <CardContent className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-2">
                          {/* Left Section - Icon & Main Info */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Icon */}
                            <div className="flex-shrink-0">
                              <div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center border ${getSeverityBgColor(alert.severity)} ${
                                  isCritical ? 'border-red-300' : alert.severity === 'medium' ? 'border-amber-300' : 'border-blue-300'
                                }`}
                              >
                                <AlertIcon
                                  className={`h-4 w-4 ${getSeverityIconColor(alert.severity)}`}
                                />
                              </div>
                            </div>

                            {/* Content - Compact Horizontal Layout */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <h3 className="text-sm font-bold text-gray-900 truncate">
                                  {alert.title}
                                </h3>
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    isCritical ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                                  }`}></div>
                                  <span className="text-xs font-medium text-gray-600">
                                    {alert.severity}
                                  </span>
                                </div>
                                <Badge
                                  className={getTypeColor(alert.type)}
                                  size="sm"
                                >
                                  {alert.type}
                                </Badge>
                              </div>
                              
                              {/* Compact Info Row */}
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <div className="flex items-center gap-0.5">
                                  <Package className="h-3 w-3 text-gray-400" />
                                  <span className="font-medium">{alert.binId}</span>
                                </div>
                                {alert.currentLevel !== undefined && (
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-gray-500">Fill:</span>
                                    <span className="font-semibold">{alert.currentLevel}%</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-0.5">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                  <span className="whitespace-nowrap text-[11px]">{formatTimestamp(alert.timestamp)}</span>
                                </div>
                                <StatusBadge
                                  status={alert.status === 'active' ? 'danger' : 'success'}
                                  size="sm"
                                />
                                {alert.location && (
                                  <div className="flex items-center gap-0.5 text-gray-500">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate max-w-[100px] text-[11px]">
                                      {alert.location.address ||
                                        `${alert.location.latitude.toFixed(4)}, ${alert.location.longitude.toFixed(4)}`}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {alert.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                  {alert.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right Section - Action Buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {alert.location && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewLocation(alert);
                                }}
                                className="min-w-[65px] text-[11px] py-0.5 px-2 h-6"
                              >
                                <MapPin className="h-3 w-3 mr-0.5" />
                                Map
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAlert(alert);
                                setIsModalOpen(true);
                              }}
                              className="min-w-[65px] text-[11px] py-0.5 px-2 h-6 border-primary-500 text-primary-600 hover:bg-primary-50"
                            >
                              <Eye className="h-3 w-3 mr-0.5" />
                              Details
                            </Button>
                          </div>
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

      {/* Alert Details Modal */}
      {selectedAlert && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Alert Details: ${selectedAlert.title}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Severity</p>
                <StatusBadge status={getSeverityColor(selectedAlert.severity)} />
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <StatusBadge
                  status={selectedAlert.status === 'active' ? 'danger' : 'success'}
                />
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Type:</span>
                <Badge className={getTypeColor(selectedAlert.type)}>
                  {selectedAlert.type}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Bin ID:</span>
                <span className="text-gray-900 font-medium">{selectedAlert.binId}</span>
              </div>
              {selectedAlert.currentLevel !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Fill Level:</span>
                  <span className="text-gray-900 font-medium">{selectedAlert.currentLevel}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Timestamp:</span>
                <span className="text-gray-900 font-medium">
                  {format(new Date(selectedAlert.timestamp), 'PPpp')}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Description:</span>
                <p className="text-gray-900 font-medium mt-1">{selectedAlert.description}</p>
              </div>
              {selectedAlert.location && (
                <div>
                  <span className="text-gray-600">Location:</span>
                  <p className="text-gray-900 font-medium mt-1">
                    {selectedAlert.location.address ||
                      `${selectedAlert.location.latitude}, ${selectedAlert.location.longitude}`}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewLocation(selectedAlert)}
                    className="mt-2"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Open in Maps
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
