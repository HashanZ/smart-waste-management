import 'package:flutter/material.dart';
import '../services/api_service.dart';

class RouteProvider with ChangeNotifier {
  final ApiService _apiService = ApiService(); // Uses singleton instance - shares token with AuthProvider
  List<dynamic> _routes = [];
  Map<String, dynamic>? _currentRoute;
  bool _isLoading = false;
  String? _error;

  List<dynamic> get routes => _routes;
  Map<String, dynamic>? get currentRoute => _currentRoute;
  bool get isLoading => _isLoading;
  String? get error => _error;

  // Expose _error setter for route_screen
  set error(String? value) => _error = value;

  Future<void> loadRoutes() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _routes = await _apiService.getAssignedRoutes().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          print('⚠️ Route loading timeout');
          throw Exception('Connection timeout. Please check your network.');
        },
      );
      print('✅ Loaded ${_routes.length} routes');
      if (_routes.isNotEmpty) {
        print('✅ First route: ${_routes[0]}');
      } else {
        print('⚠️ No routes found');
      }
      _error = null;
    } catch (e) {
      print('❌ Error loading routes: $e');
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadRouteDetails(String routeId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _currentRoute = await _apiService.getRouteDetails(routeId);
      _error = null;
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> markBinCollected(String routeId, String binId) async {
    try {
      print('📝 RouteProvider: Marking bin collected - routeId: $routeId, binId: $binId');
      final success = await _apiService.markBinCollected(routeId, binId);

      if (success) {
        print('✅ Bin marked as collected successfully');

        // Reload route details to get updated state from backend
        // This ensures we have the latest data including binsVisited
        try {
          await loadRouteDetails(routeId);
          print('✅ Route refreshed after marking bin as collected');
        } catch (e) {
          print('⚠️ Failed to refresh route after marking bin: $e');
          // Fallback: try to update local state manually
          if (_currentRoute != null) {
            final bins = _currentRoute!['bins'] as List?;
            if (bins != null) {
              bool updated = false;
              for (var bin in bins) {
                // Handle both _id (ObjectId) and binId (string) formats
                final binIdValue = bin['_id']?.toString() ?? bin['binId']?.toString();
                final binBinId = bin['binId']?.toString();

                // Match by either ObjectId or binId string
                if (binIdValue == binId || binBinId == binId) {
                  bin['collected'] = true;
                  bin['collectedAt'] = DateTime.now().toIso8601String();
                  updated = true;
                  print('✅ Updated local bin state: ${bin['binId'] ?? bin['_id']}');
                  break;
                }
              }
              if (updated) {
                notifyListeners();
              } else {
                print('⚠️ Bin not found in local state');
              }
            }
          }
        }
      } else {
        print('❌ Failed to mark bin as collected');
      }

      return success;
    } catch (e) {
      print('❌ Error marking bin collected: $e');
      return false;
    }
  }
}

