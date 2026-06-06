import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/route_provider.dart';

class BinDetailsSheet extends StatefulWidget {
  final Map<String, dynamic> bin;

  const BinDetailsSheet({super.key, required this.bin});

  @override
  State<BinDetailsSheet> createState() => _BinDetailsSheetState();
}

class _BinDetailsSheetState extends State<BinDetailsSheet> {
  bool _isMarkingCollected = false;

  Future<void> _markAsCollected(BuildContext context) async {
    if (_isMarkingCollected) return; // Prevent double-tap

    HapticFeedback.mediumImpact();
    setState(() => _isMarkingCollected = true);
    try {
      final routeProvider = Provider.of<RouteProvider>(context, listen: false);

      // Get bin ID - handle both _id (ObjectId) and binId (string) formats
      dynamic binIdValue = widget.bin['binId'] ?? widget.bin['_id'];
      String? binId;

      if (binIdValue is String) {
        binId = binIdValue;
      } else if (binIdValue is Map && binIdValue['\$oid'] != null) {
        binId = binIdValue['\$oid'].toString();
      } else if (binIdValue != null) {
        binId = binIdValue.toString();
      }

      if (binId == null || binId.isEmpty) {
        if (context.mounted) {
          setState(() => _isMarkingCollected = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('Invalid bin ID. Please try again.')),
                ],
              ),
              backgroundColor: Colors.red,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }

      // Get route ID from current route
      final currentRoute = routeProvider.currentRoute;
      if (currentRoute == null) {
        if (context.mounted) {
          setState(() => _isMarkingCollected = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('No route selected. Please select a route first.')),
                ],
              ),
              backgroundColor: Colors.red,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }

      // Get route ID - handle both _id (ObjectId) and id (string) formats
      dynamic routeIdValue = currentRoute['_id'] ?? currentRoute['id'];
      String? routeId;

      if (routeIdValue is String) {
        routeId = routeIdValue;
      } else if (routeIdValue is Map && routeIdValue['\$oid'] != null) {
        routeId = routeIdValue['\$oid'].toString();
      } else if (routeIdValue != null) {
        routeId = routeIdValue.toString();
      }

      if (routeId == null || routeId.isEmpty) {
        if (context.mounted) {
          setState(() => _isMarkingCollected = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('Invalid route. Please try again.')),
                ],
              ),
              backgroundColor: Colors.red,
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
        return;
      }

      print('📝 Marking bin as collected: routeId=$routeId, binId=$binId');

      final success = await routeProvider.markBinCollected(routeId, binId);

      if (context.mounted) {
        setState(() => _isMarkingCollected = false);

        if (success) {
          HapticFeedback.mediumImpact();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.check_circle, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('Bin marked as collected!')),
                ],
              ),
              backgroundColor: Colors.green,
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 2),
            ),
          );

          // Reload route to get updated state
          await routeProvider.loadRouteDetails(routeId);

          // Close the sheet
          Navigator.pop(context);
        } else {
          HapticFeedback.heavyImpact();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Row(
                children: [
                  Icon(Icons.error_outline, color: Colors.white),
                  SizedBox(width: 8),
                  Expanded(child: Text('Failed to mark bin as collected. Please try again.')),
                ],
              ),
              backgroundColor: Colors.red,
              behavior: SnackBarBehavior.floating,
              duration: Duration(seconds: 3),
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        setState(() => _isMarkingCollected = false);
        HapticFeedback.heavyImpact();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.error_outline, color: Colors.white),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Error: ${e.toString().replaceAll('Exception: ', '')}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    }
  }

  Future<void> _openNavigation(double lat, double lng) async {
    // Validate coordinates
    if (lat == 0.0 && lng == 0.0) {
      if (context.mounted) {
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
      if (context.mounted) {
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
        if (context.mounted) {
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
      if (context.mounted) {
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
    final binId = widget.bin['binId'] ?? widget.bin['_id'] ?? 'Unknown';
    final fillLevel = (widget.bin['currentLevel'] ?? 0).toDouble();
    final location = widget.bin['location'] ?? {};
    final lat = (location['latitude'] ?? 0).toDouble();
    final lng = (location['longitude'] ?? 0).toDouble();
    final address = location['address'] ?? 'No address';
    final isCollected = widget.bin['collected'] == true;
    final status = widget.bin['status'] ?? 'active';
    final hasValidLocation = lat != 0.0 && lng != 0.0 && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 30,
                          backgroundColor: isCollected
                              ? Colors.green
                              : (fillLevel > 80 ? Colors.red : Colors.orange),
                          child: Icon(
                            isCollected ? Icons.check_circle : Icons.delete,
                            color: Colors.white,
                            size: 30,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                binId,
                                style: const TextStyle(
                                  fontSize: 20,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                isCollected ? 'Collected' : 'Pending Collection',
                                style: TextStyle(
                                  color: isCollected ? Colors.green : Colors.orange,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Fill Level
                    _buildInfoRow(
                      'Fill Level',
                      '${fillLevel.toStringAsFixed(1)}%',
                      Icons.water_drop,
                      _getFillColor(fillLevel),
                    ),
                    const SizedBox(height: 16),

                    // Progress Bar
                    LinearProgressIndicator(
                      value: fillLevel / 100,
                      backgroundColor: Colors.grey[200],
                      valueColor: AlwaysStoppedAnimation<Color>(
                        _getFillColor(fillLevel),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Location
                    _buildInfoRow(
                      'Location',
                      address,
                      Icons.location_on,
                      Colors.blue,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Coordinates: ${lat.toStringAsFixed(6)}, ${lng.toStringAsFixed(6)}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 12),
                    ),
                    const SizedBox(height: 24),

                    // Status
                    _buildInfoRow(
                      'Status',
                      status.toUpperCase(),
                      Icons.info,
                      Colors.blue,
                    ),
                    const SizedBox(height: 24),

                    // Action Buttons
                    if (!isCollected) ...[
                      ElevatedButton.icon(
                        onPressed: _isMarkingCollected ? null : () => _markAsCollected(context),
                        icon: _isMarkingCollected
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                ),
                              )
                            : const Icon(Icons.check_circle),
                        label: Text(_isMarkingCollected ? 'Marking...' : 'Mark as Collected'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF22c55e), // emerald-500
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          disabledBackgroundColor: Colors.grey,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],

                    Tooltip(
                      message: hasValidLocation ? 'Open in Google Maps' : 'Location not available',
                      child: OutlinedButton.icon(
                        onPressed: hasValidLocation ? () => _openNavigation(lat, lng) : null,
                        icon: const Icon(Icons.navigation),
                        label: const Text('Navigate to Bin'),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[600],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Color _getFillColor(double fillLevel) {
    if (fillLevel >= 90) return Colors.red;
    if (fillLevel >= 70) return Colors.orange;
    if (fillLevel >= 50) return Colors.yellow[700]!;
    return Colors.green;
  }
}

