import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  MapPin,
  AlertTriangle,
  Map,
  Search,
  SortAsc,
  SortDesc,
  RefreshCw,
  X,
  Eye,
  TrendingUp,
  Clock,
  Plus,
  Trash,
  Activity,
} from "lucide-react";
import { useBins } from "../hooks/useBins";
import { BinMap, BinLocation } from "../components/BinMap";
import { useSocket } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge, StatusBadge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Drawer } from "../components/ui/Drawer";
import { SkeletonCard } from "../components/ui/LoadingSpinner";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { createBin, deleteBin, CreateBinRequest } from "../api/bins";
import { getBinTypeColorClasses, getFillLevelColor } from "../utils/binUtils";
import { getBinStatusColor } from "../utils/statusUtils";

type FilterType = "all" | "active" | "overflowing" | "maintenance" | "inactive";
type SortType = "fillLevel" | "lastEmptied" | "binId" | "binType" | "status";
type SortOrder = "asc" | "desc";

export const Bins: React.FC = () => {
  const [filter, setFilter] = useState<FilterType>("all");
  const [showMap, setShowMap] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("fillLevel");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedBin, setSelectedBin] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data, isLoading, error, refetch } = useBins({ page: 1, limit: 100 });
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();

  // Check if user can create bins (admin or municipal_officer)
  const canCreateBin =
    user?.role === "admin" || user?.role === "municipal_officer";

  // Debug: Log user role to help troubleshoot
  useEffect(() => {
    console.log("User role:", user?.role, "Can create bin:", canCreateBin);
  }, [user?.role, canCreateBin]);

  const items = useMemo(() => data?.items ?? [], [data]);

  // Real-time bin updates via Socket.io
  useEffect(() => {
    if (!socket) return;

    socket.on("bin:update", (data: any) => {
      console.log("✅ Bin update received on Bins page:", data);
      toast.success(`Bin ${data.binId} updated: ${data.currentLevel}%`, {
        duration: 2000,
        icon: "🔄",
      });
      refetch();
    });

    socket.on("alert:new", (data: any) => {
      console.log("Alert on Bins page:", data);
      if (data.type === "overflow") {
        toast.error(`⚠️ Bin ${data.binId} is overflowing!`, {
          duration: 4000,
          icon: "🚨",
        });
        refetch();
      }
    });

    return () => {
      socket.off("bin:update");
      socket.off("alert:new");
    };
  }, [socket, refetch]);

  // Filter and search bins
  const filteredBins = useMemo(() => {
    let result = items;

    // Filter by status
    if (filter !== "all") {
      result = result.filter((bin) => {
        if (filter === "overflowing") {
          return (
            bin.status === "overflowing" ||
            bin.isOverflowing ||
            (bin.currentLevel ?? 0) >= 90
          );
        }
        return bin.status === filter;
      });
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (bin) =>
          bin.binId.toLowerCase().includes(query) ||
          bin.binType.toLowerCase().includes(query) ||
          (bin.location?.address?.toLowerCase().includes(query) ?? false) ||
          (bin.name?.toLowerCase().includes(query) ?? false),
      );
    }

    // Sort bins
    result = [...result].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "fillLevel":
          comparison = (a.currentLevel ?? 0) - (b.currentLevel ?? 0);
          break;
        case "lastEmptied":
          const aDate = a.lastEmptied ? new Date(a.lastEmptied).getTime() : 0;
          const bDate = b.lastEmptied ? new Date(b.lastEmptied).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case "binId":
          comparison = a.binId.localeCompare(b.binId);
          break;
        case "binType":
          comparison = a.binType.localeCompare(b.binType);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [items, filter, searchQuery, sortBy, sortOrder]);

  // Get statistics
  const stats = useMemo(() => {
    // Use totals from pagination response (all bins in database) instead of items.length (only current page)
    const total = data?.total ?? items.length;
    // Get active and overflowing counts from pagination metadata (database totals)
    const active =
      data?.activeBins ?? items.filter((b) => b.status === "active").length;
    const overflowing =
      data?.overflowingBins ??
      items.filter(
        (b) =>
          b.status === "overflowing" ||
          b.isOverflowing ||
          (b.currentLevel ?? 0) >= 90,
      ).length;
    const avgFillLevel =
      items.length > 0
        ? items.reduce((sum, b) => sum + (b.currentLevel ?? 0), 0) /
          items.length
        : 0;

    return { total, active, overflowing, avgFillLevel };
  }, [items, data?.total, data?.activeBins, data?.overflowingBins]);

  // Convert bins to map-compatible format
  const binLocations: BinLocation[] = useMemo(() => {
    return filteredBins.map((bin) => {
      let location: { latitude: number; longitude: number; address?: string } =
        {
          latitude: 6.9271,
          longitude: 79.8612,
        };

      if (bin.location) {
        if ("coordinates" in bin.location && bin.location.coordinates) {
          location = {
            latitude: bin.location.coordinates[1],
            longitude: bin.location.coordinates[0],
            address: bin.location.address,
          };
        } else if (
          "latitude" in bin.location &&
          bin.location.latitude !== undefined &&
          bin.location.longitude !== undefined
        ) {
          location = {
            latitude: bin.location.latitude,
            longitude: bin.location.longitude,
            address: bin.location.address,
          };
        }
      }

      return {
        _id: bin._id,
        binId: bin.binId,
        binType: bin.binType,
        currentLevel: bin.currentLevel ?? 0,
        location,
        status: bin.status,
        isOverflowing:
          bin.isOverflowing ||
          bin.status === "overflowing" ||
          (bin.currentLevel ?? 0) >= 90,
        lastEmptied: bin.lastEmptied,
      };
    });
  }, [filteredBins]);

  // Use shared utilities
  const getStatusColor = getBinStatusColor;
  const getBinTypeColor = getBinTypeColorClasses;

  const handleBinClick = (bin: BinLocation) => {
    const fullBin = items.find((b) => b._id === bin._id);
    if (fullBin) {
      setSelectedBin(fullBin);
      setIsModalOpen(true);
    }
  };

  const handleSort = (field: SortType) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleCreateBin = async (formData: CreateBinRequest) => {
    setIsCreating(true);
    try {
      await createBin(formData);
      toast.success(`Bin ${formData.binId} created successfully!`);
      setIsAddModalOpen(false);
      refetch();
    } catch (error: any) {
      console.error("Create bin error:", error);
      toast.error(error.response?.data?.message || "Failed to create bin");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBin = async () => {
    if (!selectedBin) return;

    setIsDeleting(true);
    try {
      await deleteBin(selectedBin._id);
      toast.success(`Bin ${selectedBin.binId} deleted successfully!`);
      setIsModalOpen(false);
      setShowDeleteConfirm(false);
      setSelectedBin(null);
      refetch();
    } catch (error: any) {
      console.error("Delete bin error:", error);
      toast.error(error.response?.data?.message || "Failed to delete bin");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gradient-eco rounded-2xl p-8 shimmer" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Failed to Load Bins
            </h3>
            <p className="text-gray-600 mb-4">
              {(error as any)?.message || "Unknown error"}
            </p>
            <Button onClick={() => refetch()} variant="primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
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
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-white mb-2">
                Waste Bins Management
              </h1>
              <p className="text-primary-100 text-sm sm:text-base md:text-lg">
                Monitor and manage waste bins across the city in real-time
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Connection Status */}
              <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"
                  }`}
                />
                <span className="text-white text-sm font-medium">
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>

              {/* Add New Bin Button */}
              <Button
                variant="primary"
                onClick={() => setIsAddModalOpen(true)}
                className="bg-white text-primary-600 hover:bg-white/90 border-0 shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Bin
              </Button>

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetch()}
                className="bg-white/10 hover:bg-white/20 text-white border-0"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mt-4 sm:mt-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-primary-100 text-sm mb-1">Total Bins</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-primary-100 text-sm mb-1">Active</p>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-primary-100 text-sm mb-1">Overflowing</p>
              <p className="text-2xl font-bold text-white">
                {stats.overflowing}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-primary-100 text-sm mb-1">Avg Fill Level</p>
              <p className="text-2xl font-bold text-white">
                {Math.round(stats.avgFillLevel)}%
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters & Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search by bin ID, type, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                  rightIcon={
                    searchQuery ? (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : undefined
                  }
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    { key: "all", label: "All", count: items.length },
                    { key: "active", label: "Active", count: stats.active },
                    {
                      key: "overflowing",
                      label: "Overflowing",
                      count: stats.overflowing,
                    },
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

              {/* Map Toggle */}
              <Button
                variant={showMap ? "primary" : "outline"}
                size="lg"
                onClick={() => setShowMap(!showMap)}
              >
                <Map className="h-4 w-4 mr-2" />
                {showMap ? "Hide Map" : "Show Map"}
              </Button>
            </div>

            {/* Sort Options */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200">
              <span className="text-sm text-gray-600 font-medium">
                Sort by:
              </span>
              {(
                [
                  { key: "fillLevel", label: "Fill Level" },
                  { key: "lastEmptied", label: "Last Emptied" },
                  { key: "binId", label: "Bin ID" },
                  { key: "binType", label: "Type" },
                ] as const
              ).map(({ key, label }) => (
                <Button
                  key={key}
                  variant={sortBy === key ? "outline" : "ghost"}
                  size="sm"
                  onClick={() => handleSort(key as SortType)}
                  className="flex items-center gap-1"
                >
                  {sortBy === key &&
                    (sortOrder === "asc" ? (
                      <SortAsc className="h-3 w-3" />
                    ) : (
                      <SortDesc className="h-3 w-3" />
                    ))}
                  {label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Interactive Map */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Map className="h-6 w-6 text-primary-600" />
                  <span>Bin Locations</span>
                  <Badge variant="info" withDot>
                    {filteredBins.length} bins
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] sm:h-[500px] md:h-[600px] rounded-lg overflow-hidden">
                  <BinMap bins={binLocations} onBinClick={handleBinClick} />
                </div>
                <div className="mt-4 flex items-center justify-center flex-wrap gap-6 text-sm">
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-green-500 rounded-full mr-2 shadow-sm"></div>
                    <span className="text-gray-700 font-medium">
                      Normal (&lt; 70%)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-amber-500 rounded-full mr-2 shadow-sm"></div>
                    <span className="text-gray-700 font-medium">
                      Warning (70-89%)
                    </span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-4 h-4 bg-red-500 rounded-full mr-2 shadow-sm animate-pulse"></div>
                    <span className="text-gray-700 font-medium">
                      Critical (≥ 90%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bins Table List View (Windows Explorer Style) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-heading font-bold text-gray-900">
            Bin List
          </h2>
          <div className="flex items-center gap-3">
            <Badge variant="default">
              {filteredBins.length} {filteredBins.length === 1 ? "bin" : "bins"}
            </Badge>
            <Button
              variant="primary"
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add New Bin
            </Button>
          </div>
        </div>

        {filteredBins.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-gray-100 rounded-full">
                  <Trash2 className="h-12 w-12 text-gray-400" />
                </div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No bins found
              </h3>
              <p className="text-gray-500">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "No bins match the current filter"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Table Header */}
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2" onClick={() => handleSort("binId")}>
                        <span>Name</span>
                        {sortBy === "binId" && (
                          sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="hidden sm:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2" onClick={() => handleSort("binType")}>
                        <span>Type</span>
                        {sortBy === "binType" && (
                          sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2" onClick={() => handleSort("fillLevel")}>
                        <span>Fill</span>
                        {sortBy === "fillLevel" && (
                          sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2" onClick={() => handleSort("status")}>
                        <span>Status</span>
                        {sortBy === "status" && (
                          sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2" onClick={() => handleSort("lastEmptied")}>
                        <span>Last Emptied</span>
                        {sortBy === "lastEmptied" && (
                          sortOrder === "asc" ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="hidden lg:table-cell px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      ML Prediction
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                {/* Table Body */}
                <tbody className="bg-white divide-y divide-gray-200">
                  <AnimatePresence>
                    {filteredBins.map((bin, index) => (
                      <motion.tr
                        key={bin._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedBin(bin);
                          setIsModalOpen(true);
                        }}
                      >
                        {/* Name Column - always visible */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className={`p-1.5 rounded-lg flex-shrink-0 ${
                                bin.status === "overflowing"
                                  ? "bg-red-100"
                                  : (bin.currentLevel ?? 0) >= 70
                                    ? "bg-amber-100"
                                    : "bg-green-100"
                              }`}
                            >
                              <Trash2
                                className={`h-4 w-4 ${
                                  bin.status === "overflowing"
                                    ? "text-red-600"
                                    : (bin.currentLevel ?? 0) >= 70
                                      ? "text-amber-600"
                                      : "text-green-600"
                                }`}
                              />
                            </div>
                            <div className="text-sm font-semibold text-gray-900">
                              {bin.binId}
                            </div>
                          </div>
                        </td>
                        {/* Type - hidden on mobile, visible sm+ */}
                        <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={`${getBinTypeColor(bin.binType)}`}
                            size="sm"
                          >
                            {bin.binType}
                          </Badge>
                        </td>
                        {/* Fill Level - always visible, narrower on mobile */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-16 sm:w-24">
                              <div className="flex justify-between text-xs mb-1">
                                <span className={`font-bold ${
                                  (bin.currentLevel ?? 0) >= 90 ? 'text-red-600' :
                                  (bin.currentLevel ?? 0) >= 70 ? 'text-amber-600' : 'text-green-600'
                                }`}>
                                  {bin.currentLevel ?? 0}%
                                </span>
                              </div>
                              <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-1.5 rounded-full transition-all duration-500 ${getFillLevelColor(
                                    bin.currentLevel ?? 0,
                                  )}`}
                                  style={{ width: `${bin.currentLevel ?? 0}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                        {/* Status - always visible */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <StatusBadge
                            status={getStatusColor(bin.status)}
                            size="sm"
                          />
                        </td>
                        {/* Location - hidden on mobile + sm, visible md+ */}
                        <td className="hidden md:table-cell px-3 py-3">
                          <div className="flex items-center gap-1 text-sm text-gray-600 max-w-[160px]">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                            <span className="truncate text-xs">
                              {bin.location?.address ||
                                (bin.location?.latitude && bin.location?.longitude
                                  ? `${bin.location.latitude.toFixed(3)}, ${bin.location.longitude.toFixed(3)}`
                                  : "Unknown")}
                            </span>
                          </div>
                        </td>
                        {/* Last Emptied - hidden below lg */}
                        <td className="hidden lg:table-cell px-3 py-3 whitespace-nowrap text-sm text-gray-600">
                          {bin.lastEmptied ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-xs">
                                {formatDistanceToNow(new Date(bin.lastEmptied), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">Never</span>
                          )}
                        </td>
                        {/* ML Prediction - hidden below lg */}
                        <td className="hidden lg:table-cell px-3 py-3 whitespace-nowrap">
                          {bin.prediction ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant={
                                  bin.prediction.riskLevel === "critical"
                                    ? "danger"
                                    : bin.prediction.riskLevel === "high"
                                      ? "warning"
                                      : "info"
                                }
                                size="sm"
                              >
                                {bin.prediction.riskLevel}
                              </Badge>
                              <span className="text-xs text-gray-600">
                                {Math.round(bin.prediction.predictedLevel)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">N/A</span>
                          )}
                        </td>
                        {/* Actions - always visible */}
                        <td className="px-3 py-3 whitespace-nowrap text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBin(bin);
                              setIsModalOpen(true);
                            }}
                            className="text-xs"
                          >
                            <Eye className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </motion.div>

      {/* Bin Details Drawer (Side Panel) */}
      {selectedBin && (
        <Drawer
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedBin(null);
          }}
          title={`Bin Details: ${selectedBin.binId}`}
          position="right"
          size="xl"
        >
          <div className="space-y-4">
            {/* Status Overview - Compact Grid Layout */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-white to-gray-50 rounded-lg p-3 border border-gray-200 shadow-sm col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fill Level</p>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    (selectedBin.currentLevel ?? 0) >= 90 ? 'bg-red-500 animate-pulse' :
                    (selectedBin.currentLevel ?? 0) >= 70 ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                </div>
                <p className={`text-3xl font-extrabold mb-2 ${
                  (selectedBin.currentLevel ?? 0) >= 90 ? 'text-red-600' :
                  (selectedBin.currentLevel ?? 0) >= 70 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {selectedBin.currentLevel ?? 0}%
                </p>
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      (selectedBin.currentLevel ?? 0) >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                      (selectedBin.currentLevel ?? 0) >= 70 ? 'bg-gradient-to-r from-amber-500 to-amber-600' :
                      'bg-gradient-to-r from-green-500 to-green-600'
                    }`}
                    style={{ width: `${selectedBin.currentLevel ?? 0}%` }}
                  />
                </div>
              </div>
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-lg p-3 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Capacity</p>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <p className="text-2xl font-extrabold text-blue-600 mb-1">
                  {selectedBin.capacity ?? "N/A"}
                </p>
                <p className="text-xs text-gray-500 font-medium">Liters</p>
              </div>
              <div className="bg-gradient-to-br from-white to-purple-50 rounded-lg p-3 border border-purple-200 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</p>
                </div>
                <div className="mt-1">
                  <StatusBadge status={getStatusColor(selectedBin.status)} />
                </div>
              </div>
            </div>

            {/* Details - Compact Grid Layout */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Bin Type</p>
                <Badge className={getBinTypeColor(selectedBin.binType)}>
                  {selectedBin.binType}
                </Badge>
              </div>
              {selectedBin.collectionFrequency !== undefined && (
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Frequency</p>
                  <p className="text-sm text-gray-900 font-bold">
                    {selectedBin.collectionFrequency} hours
                  </p>
                </div>
              )}
              {selectedBin.lastEmptied && (
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Last Emptied</p>
                  <p className="text-sm text-gray-900 font-bold">
                    {new Date(selectedBin.lastEmptied).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(selectedBin.lastEmptied).toLocaleTimeString()}
                  </p>
                </div>
              )}
              {selectedBin.nextCollection && (
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Next Collection</p>
                  <p className="text-sm text-gray-900 font-bold">
                    {new Date(selectedBin.nextCollection).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(selectedBin.nextCollection).toLocaleTimeString()}
                  </p>
                </div>
              )}
              {selectedBin.location?.address && (
                <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm col-span-2">
                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Address</p>
                  <p className="text-sm text-gray-900 font-semibold">
                    📍 {selectedBin.location.address}
                  </p>
                </div>
              )}
            </div>

            {/* IoT Device Metadata - Compact Design */}
            {selectedBin.metadata && (
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-lg p-3 border border-emerald-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-emerald-900 flex items-center">
                    <Activity className="h-4 w-4 mr-2" />
                    IoT Device Status
                  </h3>
                  {selectedBin.metadata.lastDataReceived && (
                    <span className="text-xs text-gray-600 font-medium">
                      {formatDistanceToNow(
                        new Date(selectedBin.metadata.lastDataReceived),
                        { addSuffix: true },
                      )}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {selectedBin.metadata.batteryLevel !== undefined && (
                    <div className="bg-white rounded-lg p-3 border border-emerald-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Battery
                        </p>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedBin.metadata.batteryLevel > 50
                            ? "bg-emerald-500"
                            : selectedBin.metadata.batteryLevel > 20
                              ? "bg-amber-500"
                              : "bg-red-500 animate-pulse"
                        }`} />
                      </div>
                      <p className={`text-2xl font-extrabold mb-2 ${
                        selectedBin.metadata.batteryLevel > 50
                          ? "text-emerald-600"
                          : selectedBin.metadata.batteryLevel > 20
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}>
                        {selectedBin.metadata.batteryLevel}%
                      </p>
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            selectedBin.metadata.batteryLevel > 50
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                              : selectedBin.metadata.batteryLevel > 20
                                ? "bg-gradient-to-r from-amber-500 to-amber-600"
                                : "bg-gradient-to-r from-red-500 to-red-600"
                          }`}
                          style={{
                            width: `${selectedBin.metadata.batteryLevel}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {selectedBin.metadata.signalStrength !== undefined && (
                    <div className="bg-white rounded-lg p-3 border border-emerald-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                          Signal
                        </p>
                        <div className={`w-2 h-2 rounded-full ${
                          selectedBin.metadata.signalStrength > 70
                            ? "bg-emerald-500"
                            : selectedBin.metadata.signalStrength > 40
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`} />
                      </div>
                      <p className={`text-2xl font-extrabold mb-2 ${
                        selectedBin.metadata.signalStrength > 70
                          ? "text-emerald-600"
                          : selectedBin.metadata.signalStrength > 40
                            ? "text-amber-600"
                            : "text-red-600"
                      }`}>
                        {selectedBin.metadata.signalStrength}%
                      </p>
                      <div className="bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            selectedBin.metadata.signalStrength > 70
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                              : selectedBin.metadata.signalStrength > 40
                                ? "bg-gradient-to-r from-amber-500 to-amber-600"
                                : "bg-gradient-to-r from-red-500 to-red-600"
                          }`}
                          style={{
                            width: `${selectedBin.metadata.signalStrength}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bin Metadata - Compact Grid */}
            {(selectedBin.metadata?.installationDate || selectedBin.metadata?.lastMaintenance) && (
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center">
                  <Clock className="h-4 w-4 mr-2" />
                  Bin Information
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {selectedBin.metadata?.installationDate && (
                    <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Installation</p>
                      <p className="text-sm text-gray-900 font-bold">
                        {new Date(
                          selectedBin.metadata.installationDate,
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedBin.metadata?.lastMaintenance && (
                    <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Last Maintenance</p>
                      <p className="text-sm text-gray-900 font-bold">
                        {formatDistanceToNow(
                          new Date(selectedBin.metadata.lastMaintenance),
                          { addSuffix: true },
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prediction Details - Compact Design */}
            {selectedBin.prediction && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    ML Prediction
                  </h3>
                  <Badge
                    variant={
                      selectedBin.prediction.riskLevel === "critical"
                        ? "danger"
                        : selectedBin.prediction.riskLevel === "high"
                          ? "warning"
                          : "info"
                    }
                  >
                    {selectedBin.prediction.riskLevel}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                    <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                      Predicted (24h)
                    </p>
                    <p className="text-2xl font-extrabold text-blue-600">
                      {Math.round(selectedBin.prediction.predictedLevel)}%
                    </p>
                  </div>
                  {selectedBin.prediction.timeToFullHours !== null &&
                    selectedBin.prediction.timeToFullHours !== undefined && (
                      <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                        <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                          Time to Full
                        </p>
                        <p className="text-2xl font-extrabold text-blue-600">
                          {selectedBin.prediction.timeToFullHours < 24
                            ? `${Math.round(selectedBin.prediction.timeToFullHours)}h`
                            : `${Math.round(selectedBin.prediction.timeToFullHours / 24)}d`}
                        </p>
                      </div>
                    )}
                  {selectedBin.prediction.confidence && (
                    <div className="bg-white rounded-lg p-2.5 border border-blue-100">
                      <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                        Confidence
                      </p>
                      <p className="text-2xl font-extrabold text-blue-600 mb-1">
                        {Math.round(selectedBin.prediction.confidence * 100)}%
                      </p>
                      <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden shadow-inner">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${selectedBin.prediction.confidence * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {selectedBin.prediction.recommendedCollectionTime && (
                  <div className="bg-white rounded-lg p-2 border border-blue-100 mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        Recommended:
                      </span>
                      <span className="text-xs font-bold text-blue-600">
                        {new Date(
                          selectedBin.prediction.recommendedCollectionTime,
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
                {selectedBin.prediction.source && (
                  <div className="text-xs text-gray-500 font-medium bg-white rounded p-1.5 border border-blue-100 text-center">
                    Source:{" "}
                    <span className="font-bold text-blue-600">
                      {selectedBin.prediction.source === "ml-service"
                        ? "ML Model"
                        : "Fallback"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
              {canCreateBin && (
                <Button
                  variant="danger"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-2"
                >
                  <Trash className="h-4 w-4" />
                  Delete Bin
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedBin(null);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedBin && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title="Delete Bin"
          size="md"
        >
          <div className="space-y-4">
            <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900">
                  Warning: This action cannot be undone
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Are you sure you want to delete bin{" "}
                  <strong>{selectedBin.binId}</strong>?
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Bin Details:</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  Bin ID:{" "}
                  <span className="font-medium">{selectedBin.binId}</span>
                </p>
                <p>
                  Type:{" "}
                  <span className="font-medium">{selectedBin.binType}</span>
                </p>
                <p>
                  Status:{" "}
                  <span className="font-medium">{selectedBin.status}</span>
                </p>
                {selectedBin.location?.address && (
                  <p>
                    Location:{" "}
                    <span className="font-medium">
                      {selectedBin.location.address}
                    </span>
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteBin}
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4" />
                    Delete Bin
                  </>
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add New Bin Modal */}
      <AddBinModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateBin}
        isSubmitting={isCreating}
      />
    </div>
  );
};

// Add Bin Modal Component
interface AddBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateBinRequest) => void;
  isSubmitting: boolean;
}

const AddBinModal: React.FC<AddBinModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [formData, setFormData] = useState<CreateBinRequest>({
    binId: "",
    binType: "general",
    location: {
      latitude: 6.9271, // Default: Colombo
      longitude: 79.8612,
      address: "",
    },
    capacity: 100,
    currentLevel: 0,
    status: "active",
    collectionFrequency: 24,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.binId.trim()) {
      toast.error("Bin ID is required");
      return;
    }
    if (!formData.location.latitude || !formData.location.longitude) {
      toast.error("Location coordinates are required");
      return;
    }
    if (formData.capacity <= 0) {
      toast.error("Capacity must be greater than 0");
      return;
    }
    onSubmit(formData);
  };

  const handleReset = () => {
    setFormData({
      binId: "",
      binType: "general",
      location: {
        latitude: 6.9271,
        longitude: 79.8612,
        address: "",
      },
      capacity: 100,
      currentLevel: 0,
      status: "active",
      collectionFrequency: 24,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Bin" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bin ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bin ID <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            value={formData.binId}
            onChange={(e) =>
              setFormData({ ...formData, binId: e.target.value.toUpperCase() })
            }
            placeholder="e.g., BIN001"
            required
          />
        </div>

        {/* Bin Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bin Type <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.binType}
            onChange={(e) =>
              setFormData({
                ...formData,
                binType: e.target.value as CreateBinRequest["binType"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          >
            <option value="general">General</option>
            <option value="recyclable">Recyclable</option>
            <option value="organic">Organic</option>
            <option value="hazardous">Hazardous</option>
          </select>
        </div>

        {/* Location */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Location <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Latitude
              </label>
              <Input
                type="number"
                step="any"
                value={formData.location.latitude}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location: {
                      ...formData.location,
                      latitude: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="6.9271"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                Longitude
              </label>
              <Input
                type="number"
                step="any"
                value={formData.location.longitude}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location: {
                      ...formData.location,
                      longitude: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                placeholder="79.8612"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Address (Optional)
            </label>
            <Input
              type="text"
              value={formData.location.address || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  location: {
                    ...formData.location,
                    address: e.target.value,
                  },
                })
              }
              placeholder="Street address, city, country"
            />
          </div>
        </div>

        {/* Capacity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Capacity (Liters) <span className="text-red-500">*</span>
          </label>
          <Input
            type="number"
            min="1"
            value={formData.capacity}
            onChange={(e) =>
              setFormData({
                ...formData,
                capacity: parseInt(e.target.value) || 0,
              })
            }
            placeholder="100"
            required
          />
        </div>

        {/* Current Level */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Initial Fill Level (%)
          </label>
          <Input
            type="number"
            min="0"
            max="100"
            value={formData.currentLevel || 0}
            onChange={(e) =>
              setFormData({
                ...formData,
                currentLevel: parseInt(e.target.value) || 0,
              })
            }
            placeholder="0"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={formData.status || "active"}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as CreateBinRequest["status"],
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        {/* Collection Frequency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Collection Frequency (hours)
          </label>
          <Input
            type="number"
            min="1"
            value={formData.collectionFrequency || 24}
            onChange={(e) =>
              setFormData({
                ...formData,
                collectionFrequency: parseInt(e.target.value) || 24,
              })
            }
            placeholder="24"
          />
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleReset();
              onClose();
            }}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 mr-2 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Bin
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
