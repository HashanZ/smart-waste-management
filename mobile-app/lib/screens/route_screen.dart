import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/route_provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'bin_details_sheet.dart';
import 'login_screen.dart';

class RouteScreen extends StatefulWidget {
  const RouteScreen({super.key});

  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  final MapController _mapController = MapController();
  List<Marker> _markers = [];
  List<Polyline> _routePolylines = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // Ensure token is loaded before making API calls
      await ApiService().initialize();
      _loadRoutes();
    });
  }

  Future<void> _loadRoutes() async {
    try {
      final routeProvider = Provider.of<RouteProvider>(context, listen: false);
      // Add timeout to prevent infinite loading
      await routeProvider.loadRoutes().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('⚠️ Route loading timeout');
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Connection timeout. Please check your network.'),
                backgroundColor: Colors.orange,
              ),
            );
          }
        },
      );

      if (routeProvider.routes.isNotEmpty) {
        final route = routeProvider.routes[0];
        // Handle both _id (ObjectId) and id (string) formats
        // MongoDB ObjectId can be an object with $oid or a string
        dynamic routeIdValue = route['_id'] ?? route['id'];

        String? routeId;
        if (routeIdValue is String) {
          routeId = routeIdValue;
        } else if (routeIdValue is Map && routeIdValue['\$oid'] != null) {
          routeId = routeIdValue['\$oid'].toString();
        } else if (routeIdValue != null) {
          routeId = routeIdValue.toString();
        }

        // Validate MongoDB ObjectId format (24 hex characters)
        if (routeId != null &&
            routeId.isNotEmpty &&
            RegExp(r'^[0-9a-fA-F]{24}$').hasMatch(routeId)) {
          await routeProvider.loadRouteDetails(routeId);
          if (mounted) {
            _updateMap();
          }
        } else {
          print('⚠️ Invalid route ID format: $routeId (from route: $route)');
          // Error will be set by loadRouteDetails if it fails
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Invalid route ID format: ${routeId ?? "null"}'),
                backgroundColor: Colors.red,
              ),
            );
          }
        }
      }
    } catch (e) {
      print('❌ Error loading routes: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error loading routes: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  void _updateMap() {
    final routeProvider = Provider.of<RouteProvider>(context, listen: false);
    final route = routeProvider.currentRoute;

    if (route == null) return;

    final bins = route['bins'] as List? ?? [];
    final List<LatLng> routePoints = [];
    final List<Marker> markers = [];

    for (var bin in bins) {
      final location = bin['location'];
      if (location != null) {
        final lat = location['latitude']?.toDouble() ?? 0.0;
        final lng = location['longitude']?.toDouble() ?? 0.0;

        if (lat != 0.0 && lng != 0.0) {
          final point = LatLng(lat, lng);
          routePoints.add(point);

          final isCollected = bin['collected'] == true;
          final fillLevel = bin['currentLevel']?.toDouble() ?? 0.0;

          // Determine marker color based on status
          Color markerColor;
          if (isCollected) {
            markerColor = Colors.green;
          } else if (fillLevel > 80) {
            markerColor = Colors.red;
          } else {
            markerColor = Colors.orange;
          }

          markers.add(
            Marker(
              point: point,
              width: 50,
              height: 50,
              child: GestureDetector(
                onTap: () => _showBinDetails(bin),
                child: Container(
                  decoration: BoxDecoration(
                    color: markerColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(
                    isCollected ? Icons.check : Icons.delete,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
              ),
            ),
          );
        }
      }
    }

    setState(() {
      _markers = markers;
      if (routePoints.length > 1) {
        _routePolylines = [
          Polyline(
            points: routePoints,
            strokeWidth: 4,
            color: Colors.blue,
          ),
        ];
      } else {
        _routePolylines = [];
      }
    });

    // Fit map to show all markers
    if (routePoints.isNotEmpty && routePoints.length > 1) {
      final bounds = _boundsFromLatLngList(routePoints);
      // Calculate center and zoom to fit all points
      final center = bounds.center;
      final sw = bounds.southWest;
      final ne = bounds.northEast;
      final latDiff = ne.latitude - sw.latitude;
      final lngDiff = ne.longitude - sw.longitude;
      final zoom = _calculateZoom(latDiff, lngDiff);

      // Move map to show all markers
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          try {
            _mapController.move(center, zoom);
          } catch (e) {
            print('⚠️ Error moving map: $e');
          }
        }
      });
    } else if (routePoints.length == 1) {
      // Single point - just center on it
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _mapController.move(routePoints[0], 15.0);
        }
      });
    }
  }

  double _calculateZoom(double latDiff, double lngDiff) {
    // Simple zoom calculation - adjust as needed
    final maxDiff = latDiff > lngDiff ? latDiff : lngDiff;
    if (maxDiff > 0.1) return 11.0;
    if (maxDiff > 0.05) return 12.0;
    if (maxDiff > 0.01) return 13.0;
    return 14.0;
  }

  LatLngBounds _boundsFromLatLngList(List<LatLng> list) {
    if (list.isEmpty) {
      // Return default bounds (Colombo, Sri Lanka) if list is empty
      return LatLngBounds(
        const LatLng(6.8, 79.8),
        const LatLng(7.0, 80.0),
      );
    }

    double? minLat, maxLat, minLng, maxLng;
    for (var point in list) {
      minLat = minLat == null ? point.latitude : (minLat < point.latitude ? minLat : point.latitude);
      maxLat = maxLat == null ? point.latitude : (maxLat > point.latitude ? maxLat : point.latitude);
      minLng = minLng == null ? point.longitude : (minLng < point.longitude ? minLng : point.longitude);
      maxLng = maxLng == null ? point.longitude : (maxLng > point.longitude ? maxLng : point.longitude);
    }
    return LatLngBounds(
      LatLng(minLat ?? 0, minLng ?? 0),
      LatLng(maxLat ?? 0, maxLng ?? 0),
    );
  }

  void _showBinDetails(Map<String, dynamic> bin) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => BinDetailsSheet(bin: bin),
    );
  }

  Future<void> _openNavigation(double lat, double lng) async {
    // Validate coordinates
    if (lat == 0.0 && lng == 0.0) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.error_outline, color: Colors.white),
                SizedBox(width: 8),
                Expanded(child: Text('Invalid location coordinates. Cannot navigate.')),
              ],
            ),
            backgroundColor: Colors.orange,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Row(
              children: [
                Icon(Icons.error_outline, color: Colors.white),
                SizedBox(width: 8),
                Expanded(child: Text('Invalid location coordinates. Cannot navigate.')),
              ],
            ),
            backgroundColor: Colors.orange,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
      return;
    }

    HapticFeedback.mediumImpact();

    try {
      // Try Google Maps first
      final googleMapsUrl = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lng');

      // Also try the maps:// scheme for better compatibility
      final mapsUrl = Uri.parse('geo:$lat,$lng?q=$lat,$lng');

      bool launched = false;

      // Try Google Maps URL first
      if (await canLaunchUrl(googleMapsUrl)) {
        try {
          await launchUrl(googleMapsUrl, mode: LaunchMode.externalApplication);
          launched = true;
          print('✅ Opened Google Maps navigation');
        } catch (e) {
          print('⚠️ Failed to launch Google Maps URL: $e');
        }
      }

      // Fallback to geo: scheme if Google Maps URL failed
      if (!launched) {
        if (await canLaunchUrl(mapsUrl)) {
          try {
            await launchUrl(mapsUrl, mode: LaunchMode.externalApplication);
            launched = true;
            print('✅ Opened navigation using geo: scheme');
          } catch (e) {
            print('⚠️ Failed to launch geo: URL: $e');
          }
        }
      }

      if (!launched) {
        if (mounted) {
          HapticFeedback.heavyImpact();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('Cannot open navigation. Please install Google Maps or another map app.')),
                ],
              ),
              backgroundColor: Colors.orange,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Failed to open navigation: ${e.toString()}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Collection Route',
          style: TextStyle(fontWeight: FontWeight.w600),
        ),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: () {
              HapticFeedback.lightImpact();
              _loadRoutes();
            },
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) async {
              if (value == 'logout') {
                // Show confirmation dialog
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Logout'),
                    content: const Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Logout'),
                      ),
                    ],
                  ),
                );

                if (confirm == true && mounted) {
                  await Provider.of<AuthProvider>(context, listen: false).logout();
                  if (mounted) {
                    // Navigate to login screen
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(builder: (_) => const LoginScreen()),
                      (route) => false,
                    );
                  }
                }
              }
            },
            itemBuilder: (context) => [
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 20),
                    SizedBox(width: 8),
                    Text('Logout'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: Consumer<RouteProvider>(
        builder: (context, routeProvider, child) {
          // Show loading only for first load, not blocking
          if (routeProvider.isLoading && routeProvider.currentRoute == null && routeProvider.routes.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    'Loading your routes...',
                    style: TextStyle(color: Colors.grey[600]),
                  ),
                ],
              ),
            );
          }

          if (routeProvider.error != null && routeProvider.currentRoute == null) {
            return RefreshIndicator(
              onRefresh: _loadRoutes,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: SizedBox(
                  height: MediaQuery.of(context).size.height - 200,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.error_outline, size: 64, color: Colors.red[300]),
                          const SizedBox(height: 16),
                          Text(
                            'Oops! Something went wrong',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey[800],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            routeProvider.error ?? 'Unknown error',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.grey[600]),
                          ),
                          const SizedBox(height: 24),
                          ElevatedButton.icon(
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              _loadRoutes();
                            },
                            icon: const Icon(Icons.refresh),
                            label: const Text('Retry'),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          }

          final route = routeProvider.currentRoute;
          if (route == null) {
            // Show map even if no route - better UX
            return RefreshIndicator(
              onRefresh: _loadRoutes,
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.orange[50],
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.orange[200]!),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: Colors.orange[700], size: 24),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                routeProvider.isLoading
                                  ? 'Loading routes...'
                                  : 'No route assigned',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.orange[900],
                                ),
                              ),
                              if (!routeProvider.isLoading) ...[
                                const SizedBox(height: 4),
                                Text(
                                  'Please contact your supervisor to get assigned a route.',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.orange[700],
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        if (routeProvider.isLoading)
                          const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: FlutterMap(
                      mapController: _mapController,
                      options: const MapOptions(
                        initialCenter: LatLng(6.9271, 79.8612),
                        initialZoom: 13.0,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                          userAgentPackageName: 'com.example.smart_waste_collector',
                          maxZoom: 19,
                          minZoom: 3,
                          tileProvider: NetworkTileProvider(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }

          final bins = route['bins'] as List? ?? [];
          final collectedCount = bins.where((b) => b['collected'] == true).length;
          final totalCount = bins.length;
          final progress = totalCount > 0 ? collectedCount / totalCount : 0.0;

          return Column(
            children: [
              // Summary Card with Progress
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFFecfdf5), // emerald-50
                        Color(0xFFd1fae5), // teal-50
                      ],
                    ),
                    borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Progress Bar
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Route Progress',
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: Colors.grey[700],
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                    Text(
                                      '${(progress * 100).toStringAsFixed(0)}%',
                                      style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.bold,
                                        color: Color(0xFF22c55e), // emerald-500
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(8),
                                child: LinearProgressIndicator(
                                  value: progress,
                                  minHeight: 8,
                                  backgroundColor: Colors.grey[200],
                                      valueColor: AlwaysStoppedAnimation<Color>(
                                        progress >= 1.0
                                          ? const Color(0xFF10b981) // teal-500
                                          : const Color(0xFF22c55e), // emerald-500
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    // Stats
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                          _buildStatCard('Total', totalCount.toString(), Icons.delete_outline, const Color(0xFF3b82f6)), // blue-500
                          _buildStatCard('Collected', collectedCount.toString(), Icons.check_circle_outline, const Color(0xFF10b981)), // teal-500
                          _buildStatCard('Remaining', (totalCount - collectedCount).toString(), Icons.pending_outlined, const Color(0xFFf59e0b)), // amber-500
                      ],
                    ),
                  ],
                ),
              ),
              // Map
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadRoutes,
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: SizedBox(
                      height: MediaQuery.of(context).size.height * 0.5,
                      child: FlutterMap(
                        mapController: _mapController,
                        options: const MapOptions(
                          initialCenter: LatLng(6.9271, 79.8612), // Default: Colombo
                          initialZoom: 13.0,
                        ),
                        children: [
                          TileLayer(
                            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                            userAgentPackageName: 'com.example.smart_waste_collector',
                            maxZoom: 19,
                            minZoom: 3,
                            tileProvider: NetworkTileProvider(),
                          ),
                          if (_routePolylines.isNotEmpty)
                            PolylineLayer(
                              polylines: _routePolylines,
                            ),
                          MarkerLayer(
                            markers: _markers,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              // Bin List
              Container(
                height: 220,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      blurRadius: 10,
                      offset: const Offset(0, -4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // Handle bar
                    Container(
                      margin: const EdgeInsets.only(top: 8),
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          const Icon(Icons.list, color: Color(0xFF22c55e)), // emerald-500
                          const SizedBox(width: 8),
                          Text(
                            'Bins in Route',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.grey[800],
                            ),
                          ),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            decoration: BoxDecoration(
                              color: const Color(0xFFecfdf5), // emerald-50
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '$totalCount bins',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF22c55e), // emerald-500
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        itemCount: bins.length,
                        itemBuilder: (context, index) {
                          final bin = bins[index];
                          final isCollected = bin['collected'] == true;
                          final fillLevel = bin['currentLevel']?.toDouble() ?? 0.0;

                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            elevation: 2,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: InkWell(
                              onTap: () {
                                HapticFeedback.lightImpact();
                                _showBinDetails(bin);
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                leading: Container(
                                  width: 50,
                                  height: 50,
                                  decoration: BoxDecoration(
                                    color: isCollected
                                        ? Colors.green
                                        : (fillLevel > 80 ? Colors.red : fillLevel > 50 ? Colors.orange : Colors.blue),
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: (isCollected
                                            ? Colors.green
                                            : (fillLevel > 80 ? Colors.red : fillLevel > 50 ? Colors.orange : Colors.blue))
                                            .withOpacity(0.3),
                                        blurRadius: 8,
                                        offset: const Offset(0, 2),
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    isCollected ? Icons.check_circle : Icons.delete_outline,
                                    color: Colors.white,
                                    size: 24,
                                  ),
                                ),
                                title: Text(
                                  bin['binId'] ?? 'Bin ${index + 1}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w600,
                                    fontSize: 16,
                                  ),
                                ),
                                subtitle: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        Icon(Icons.water_drop, size: 14, color: Colors.grey[600]),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Fill: ${fillLevel.toStringAsFixed(0)}%',
                                          style: TextStyle(
                                            color: Colors.grey[700],
                                            fontSize: 13,
                                          ),
                                        ),
                                        if (isCollected) ...[
                                          const SizedBox(width: 12),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: Colors.green[100],
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              'Collected',
                                              style: TextStyle(
                                                color: Colors.green[800],
                                                fontSize: 11,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    if (!isCollected)
                                      IconButton(
                                        icon: const Icon(Icons.navigation),
                                        color: const Color(0xFF22c55e), // emerald-500
                                        tooltip: 'Navigate',
                                        onPressed: () {
                                          HapticFeedback.mediumImpact();
                                          final loc = bin['location'];
                                          if (loc != null) {
                                            _openNavigation(
                                              loc['latitude']?.toDouble() ?? 0.0,
                                              loc['longitude']?.toDouble() ?? 0.0,
                                            );
                                          }
                                        },
                                      ),
                                    IconButton(
                                      icon: const Icon(Icons.chevron_right),
                                      color: Colors.grey[600],
                                      onPressed: () {
                                        HapticFeedback.lightImpact();
                                        _showBinDetails(bin);
                                      },
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              color: Colors.grey[600],
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

