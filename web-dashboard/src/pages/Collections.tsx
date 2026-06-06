import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  Package,
  MapPin,
  User,
  Eye,
  Play,
  Loader,
} from 'lucide-react';
import { useQuery } from 'react-query';
import { collectionsAPI, Collection } from '../api/collections';
import { useSocket } from '../contexts/SocketContext';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, StatusBadge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { LoadingSpinner, SkeletonCard } from '../components/ui/LoadingSpinner';
import { PageHeader } from '../components/ui/PageHeader';
import { ErrorState } from '../components/ui/ErrorState';
import { LoadingState } from '../components/ui/LoadingState';
import toast from 'react-hot-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { getCollectionStatusColor } from '../utils/statusUtils';
import { getBinTypeColorClasses } from '../utils/binUtils';
import { formatDateTime } from '../utils/dateUtils';

type FilterType = 'all' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export const Collections: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch collections from API
  const { data, isLoading, error, refetch } = useQuery<{ data: Collection[]; total: number }>(
    ['collections', filter],
    () => collectionsAPI.getCollections({
      page: 1,
      limit: 100,
      status: filter === 'all' ? undefined : filter
    }),
    {
      refetchInterval: 30000,
      staleTime: 10000,
    }
  );

  const collections = data?.data || [];

  // Listen for real-time collection updates via WebSocket
  React.useEffect(() => {
    if (!socket) return;

    socket.on('collection:update', (updatedCollection: any) => {
      console.log('✅ Collection update received:', updatedCollection);
      toast.success(`Collection ${updatedCollection.collectionId || updatedCollection._id?.slice(-6)} updated`, {
        icon: '🔄'
      });
      refetch();
    });

    socket.on('collection:created', (newCollection: any) => {
      console.log('✅ New collection created:', newCollection);
      toast.success(`New collection scheduled`, {
        icon: '📅'
      });
      refetch();
    });

    return () => {
      socket.off('collection:update');
      socket.off('collection:created');
    };
  }, [socket, refetch]);

  // Filter and search collections
  const filteredCollections = useMemo(() => {
    let result = collections;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.collectionId?.toLowerCase().includes(query) ||
          c.binId?.toLowerCase().includes(query) ||
          c.collectorId?.toLowerCase().includes(query) ||
          c.wasteType?.toLowerCase().includes(query) ||
          (c.bin?.binId?.toLowerCase().includes(query) ?? false)
      );
    }

    return result;
  }, [collections, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = collections.length;
    const scheduled = collections.filter((c) => c.status === 'scheduled').length;
    const inProgress = collections.filter((c) => c.status === 'in_progress').length;
    const completed = collections.filter((c) => c.status === 'completed').length;
    const totalWeight = collections
      .filter((c) => c.weight)
      .reduce((sum, c) => sum + (c.weight || 0), 0);

    return { total, scheduled, inProgress, completed, totalWeight };
  }, [collections]);

  // Use shared utilities
  const getStatusColor = getCollectionStatusColor;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'in_progress':
        return Loader;
      case 'scheduled':
        return Clock;
      case 'cancelled':
        return XCircle;
      default:
        return AlertCircle;
    }
  };

  // Use shared utility
  const getWasteTypeColor = getBinTypeColorClasses;

  // Use shared utility
  const formatDate = formatDateTime;

  const handleStartCollection = async (collection: Collection) => {
    try {
      await collectionsAPI.updateCollection(collection._id, { status: 'in_progress' });
      toast.success('Collection started', { icon: '▶️' });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start collection');
    }
  };

  const handleCompleteCollection = async (collection: Collection) => {
    try {
      await collectionsAPI.completeCollection(collection._id);
      toast.success('Collection completed', { icon: '✅' });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete collection');
    }
  };

  if (isLoading && !data) {
    return <LoadingState showHeader={true} statCards={4} contentCards={3} />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to Load Collections"
        message={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <PageHeader
        title="Collections Management"
        description="Track and manage waste collection activities in real-time"
        isConnected={isConnected}
        onRefresh={() => refetch()}
        stats={[
          { label: 'Total Collections', value: stats.total },
          { label: 'Scheduled', value: stats.scheduled },
          { label: 'In Progress', value: stats.inProgress },
          { label: 'Total Weight', value: `${stats.totalWeight.toFixed(1)} kg` },
        ]}
      />

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              {/* Search */}
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by collection ID, bin ID, collector..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    { key: 'all', label: 'All', count: stats.total },
                    { key: 'scheduled', label: 'Scheduled', count: stats.scheduled },
                    { key: 'in_progress', label: 'In Progress', count: stats.inProgress },
                    { key: 'completed', label: 'Completed', count: stats.completed },
                  ] as const
                ).map(({ key, label, count }) => (
                  <Button
                    key={key}
                    variant={filter === key ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(key as FilterType)}
                    className="text-xs py-1.5 px-3"
                  >
                    {label} ({count})
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Collections List */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {filteredCollections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-gray-100 rounded-full">
                  <Truck className="h-10 w-10 text-gray-400" />
                </div>
              </div>
              <h3 className="text-base font-medium text-gray-900 mb-1">No collections found</h3>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : filter === 'all'
                    ? 'No collections have been scheduled yet.'
                    : `No ${filter} collections available.`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            <AnimatePresence>
              {filteredCollections.map((collection, index) => {
                return (
                  <motion.div
                    key={collection._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                  >
                    <Card variant="elevated" className="hover-lift border border-gray-200">
                      <CardContent className="py-2.5 px-3">
                        <div className="flex items-center justify-between gap-2">
                          {/* Left Section - Icon & Main Info */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Icon */}
                            <div className="flex-shrink-0">
                              <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center border border-amber-200">
                                <Truck className="h-4 w-4 text-amber-600" />
                              </div>
                            </div>

                            {/* Content - Compact Horizontal Layout */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <h3 className="text-sm font-bold text-gray-900 truncate">
                                  {collection.collectionId || `Collection ${collection._id.slice(-6)}`}
                                </h3>
                                <div className="flex items-center gap-1">
                                  <div className={`w-1.5 h-1.5 rounded-full ${
                                    collection.status === 'completed' ? 'bg-green-500' :
                                    collection.status === 'in_progress' ? 'bg-blue-500' :
                                    collection.status === 'scheduled' ? 'bg-amber-500' : 'bg-gray-500'
                                  }`}></div>
                                  <span className="text-xs font-medium text-gray-600">
                                    {collection.status === 'scheduled' ? 'Scheduled' :
                                     collection.status === 'in_progress' ? 'In Progress' :
                                     collection.status === 'completed' ? 'Completed' : 'Cancelled'}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Compact Info Row */}
                              <div className="flex items-center gap-2 text-xs text-gray-600">
                                <div className="flex items-center gap-0.5">
                                  <Package className="h-3 w-3 text-gray-400" />
                                  <span className="font-medium">{collection.binId}</span>
                                </div>
                                <Badge className={getWasteTypeColor(collection.wasteType)} size="sm">
                                  {collection.wasteType}
                                </Badge>
                                <div className="flex items-center gap-0.5">
                                  <User className="h-3 w-3 text-gray-400" />
                                  <span className="truncate max-w-[90px]">
                                    {collection.collector?.firstName && collection.collector?.lastName
                                      ? `${collection.collector.firstName} ${collection.collector.lastName}`
                                      : collection.collector?.email || collection.collectorId || 'Unassigned'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Calendar className="h-3 w-3 text-gray-400" />
                                  <span className="whitespace-nowrap text-[11px]">{formatDate(collection.scheduledDate || collection.collectionDate)}</span>
                                </div>
                                {collection.bin?.location?.address && (
                                  <div className="flex items-center gap-0.5 text-gray-500">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate max-w-[100px] text-[11px]">{collection.bin.location.address}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right Section - Action Buttons */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {collection.status === 'scheduled' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartCollection(collection);
                                }}
                                className="min-w-[65px] text-[11px] py-0.5 px-2 h-6"
                              >
                                <Play className="h-3 w-3 mr-0.5" />
                                Start
                              </Button>
                            )}
                            {collection.status === 'in_progress' && (
                              <Button
                                variant="success"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCompleteCollection(collection);
                                }}
                                className="min-w-[65px] text-[11px] py-0.5 px-2 h-6"
                              >
                                <CheckCircle className="h-3 w-3 mr-0.5" />
                                Complete
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCollection(collection);
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

      {/* Collection Details Modal */}
      {selectedCollection && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Collection Details: ${selectedCollection.collectionId || selectedCollection._id.slice(-6)}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Status Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <StatusBadge status={getStatusColor(selectedCollection.status)} />
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Waste Type</p>
                <Badge className={getWasteTypeColor(selectedCollection.wasteType)}>
                  {selectedCollection.wasteType}
                </Badge>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Bin ID:</span>
                <span className="text-gray-900 font-medium">{selectedCollection.binId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Collector:</span>
                <span className="text-gray-900 font-medium">
                  {selectedCollection.collectorId || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Scheduled Date:</span>
                <span className="text-gray-900 font-medium">
                  {formatDate(selectedCollection.scheduledDate || selectedCollection.collectionDate)}
                </span>
              </div>
              {selectedCollection.actualDate && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed Date:</span>
                  <span className="text-gray-900 font-medium">
                    {formatDate(selectedCollection.actualDate)}
                  </span>
                </div>
              )}
              {selectedCollection.weight && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Weight:</span>
                  <span className="text-gray-900 font-medium">{selectedCollection.weight} kg</span>
                </div>
              )}
              {selectedCollection.volume && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Volume:</span>
                  <span className="text-gray-900 font-medium">{selectedCollection.volume} L</span>
                </div>
              )}
              {selectedCollection.bin?.location?.address && (
                <div>
                  <span className="text-gray-600">Location:</span>
                  <p className="text-gray-900 font-medium mt-1">
                    {selectedCollection.bin.location.address}
                  </p>
                </div>
              )}
              {selectedCollection.notes && (
                <div>
                  <span className="text-gray-600">Notes:</span>
                  <p className="text-gray-900 font-medium mt-1">{selectedCollection.notes}</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
