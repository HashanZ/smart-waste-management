import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Singleton instance
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  // For emulator/desktop: use localhost
  // For physical device: use your computer's IP address
  // IMPORTANT: Change this to your current Wi-Fi IP address when testing on real device
  // To find your IP: Run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux) and look for IPv4 address
  // For Android emulator: Use 'http://10.0.2.2:3000/api'
  // For iOS simulator: Use 'http://localhost:3000/api'
  static const String baseUrl = 'http://10.158.249.170:3000/api';
  // Example: 'http://192.168.1.100:3000/api' (replace with your actual IP)
  // Previous IPs used: 192.168.229.170, 192.168.204.170, 10.66.13.170, 192.168.54.170
  
  // Error recovery configuration
  static const int maxRetries = 3;
  static const Duration initialRetryDelay = Duration(seconds: 1);
  static const Duration requestTimeout = Duration(seconds: 15);
  
  String? _token;

  // Initialize token from SharedPreferences
  Future<void> initialize() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
  }

  void setToken(String? token) {
    _token = token;
    // Also save to SharedPreferences
    if (token != null) {
      SharedPreferences.getInstance().then((prefs) {
        prefs.setString('auth_token', token);
      });
    } else {
      SharedPreferences.getInstance().then((prefs) {
        prefs.remove('auth_token');
      });
    }
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  // Helper method for retry logic with exponential backoff
  Future<T> _retryRequest<T>(
    Future<T> Function() request, {
    int retries = maxRetries,
    Duration delay = initialRetryDelay,
  }) async {
    int attempt = 0;
    while (attempt < retries) {
      try {
        return await request();
      } catch (e) {
        attempt++;
        if (attempt >= retries) {
          // Last attempt failed, rethrow
          rethrow;
        }
        
        // Check if error is retryable (network errors, timeouts)
        if (e.toString().contains('SocketException') ||
            e.toString().contains('TimeoutException') ||
            e.toString().contains('Connection') ||
            e.toString().contains('Network')) {
          print('⚠️ Request failed (attempt $attempt/$retries), retrying in ${delay.inSeconds}s...');
          await Future.delayed(delay);
          // Exponential backoff: double the delay for next retry
          delay = Duration(seconds: delay.inSeconds * 2);
        } else {
          // Non-retryable error (e.g., authentication, validation)
          rethrow;
        }
      }
    }
    throw Exception('Request failed after $retries attempts');
  }

  // Helper method to handle HTTP errors with better messages
  void _handleHttpError(int statusCode, Map<String, dynamic>? responseBody) {
    switch (statusCode) {
      case 401:
        throw Exception(responseBody?['message'] ?? 'Access denied. Please login again.');
      case 403:
        throw Exception(responseBody?['message'] ?? 'Forbidden. You do not have permission.');
      case 404:
        throw Exception(responseBody?['message'] ?? 'Resource not found.');
      case 500:
        throw Exception(responseBody?['message'] ?? 'Server error. Please try again later.');
      case 503:
        throw Exception('Service unavailable. The server is temporarily down.');
      default:
        throw Exception(responseBody?['message'] ?? 'Request failed with status $statusCode');
    }
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    return await _retryRequest(() async {
      try {
        final response = await http
            .post(
              Uri.parse('$baseUrl/auth/login'),
              headers: _headers,
              body: jsonEncode({'email': email, 'password': password}),
            )
            .timeout(requestTimeout);

        final responseBody = jsonDecode(response.body) as Map<String, dynamic>;

        if (response.statusCode == 200) {
          return responseBody;
        } else {
          _handleHttpError(response.statusCode, responseBody);
          throw Exception(); // Should not reach here
        }
      } catch (e) {
        // Check if it's a network/connection error
        final errorString = e.toString().toLowerCase();
        if (errorString.contains('socketexception') ||
            errorString.contains('connection') ||
            errorString.contains('network') ||
            errorString.contains('failed host lookup')) {
          throw Exception('Connection error. Please check your network connection and ensure the backend is running.');
        }
        if (e is FormatException) {
          throw Exception('Invalid response from server: ${e.message}');
        }
        if (e is Exception) {
          rethrow;
        }
        throw Exception('Network error: $e');
      }
    });
  }

  Future<Map<String, dynamic>> getProfile() async {
    return await _retryRequest(() async {
      try {
        final response = await http
            .get(
              Uri.parse('$baseUrl/auth/me'),
              headers: _headers,
            )
            .timeout(requestTimeout);

        final responseBody = jsonDecode(response.body) as Map<String, dynamic>;

        if (response.statusCode == 200) {
          if (responseBody['success'] == true && responseBody['data'] != null) {
            return responseBody['data'] as Map<String, dynamic>;
          }
          return responseBody;
        } else {
          _handleHttpError(response.statusCode, responseBody);
          throw Exception(); // Should not reach here
        }
      } catch (e) {
        final errorString = e.toString().toLowerCase();
        if (errorString.contains('socketexception') ||
            errorString.contains('connection') ||
            errorString.contains('network') ||
            errorString.contains('failed host lookup')) {
          throw Exception('Connection error. Please check your network connection and ensure the backend is running.');
        }
        if (e is FormatException) {
          throw Exception('Invalid response from server: ${e.message}');
        }
        if (e is Exception) {
          rethrow;
        }
        throw Exception('Network error: $e');
      }
    });
  }

  Future<List<dynamic>> getAssignedRoutes() async {
    return await _retryRequest(() async {
      try {
        // First, get user profile to get user ID
        Map<String, dynamic>? userProfile;
        String? userId;

        try {
          userProfile = await getProfile();
          userId =
              userProfile['_id']?.toString() ?? userProfile['id']?.toString();
          print('✅ User ID from profile: $userId');
        } catch (e) {
          print('⚠️ Could not get user profile: $e');
          // Continue without filtering - backend might handle it
        }

        // Build URL with collectorId query parameter if we have user ID
        final uri = userId != null
            ? Uri.parse('$baseUrl/routes/')
                .replace(queryParameters: {'collectorId': userId})
            : Uri.parse('$baseUrl/routes/');

        print('📡 Fetching routes from: $uri');

        final response = await http
            .get(
              uri,
              headers: _headers,
            )
            .timeout(requestTimeout);

        final responseBody = jsonDecode(response.body) as Map<String, dynamic>;
        print('📥 Routes response: ${response.statusCode}');

        if (response.statusCode == 200) {
          // Backend returns paginated: { success: true, data: [...], pagination: {...} }
          if (responseBody['success'] == true) {
            if (responseBody['data'] != null) {
              final data = responseBody['data'];
              if (data is List) {
                print('✅ Found ${data.length} routes');
                return data;
              } else if (data is Map && data['routes'] != null) {
                return data['routes'] is List ? data['routes'] : [];
              }
            }
            // Handle paginated response (fallback)
            if (responseBody['routes'] != null) {
              return responseBody['routes'] is List ? responseBody['routes'] : [];
            }
          }
          print('⚠️ No routes found in response');
          return [];
        } else {
          _handleHttpError(response.statusCode, responseBody);
          throw Exception(); // Should not reach here
        }
      } catch (e) {
        final errorString = e.toString().toLowerCase();
        if (errorString.contains('socketexception') ||
            errorString.contains('connection') ||
            errorString.contains('network') ||
            errorString.contains('failed host lookup')) {
          throw Exception('Connection error. Please check your network connection and ensure the backend is running.');
        }
        if (e is FormatException) {
          throw Exception('Invalid response from server: ${e.message}');
        }
        if (e is Exception) {
          rethrow;
        }
        throw Exception('Network error: $e');
      }
    });
  }

  Future<Map<String, dynamic>> getRouteDetails(String routeId) async {
    return await _retryRequest(() async {
      try {
        final response = await http
            .get(
              Uri.parse('$baseUrl/routes/$routeId'),
              headers: _headers,
            )
            .timeout(requestTimeout);

        final responseBody = jsonDecode(response.body) as Map<String, dynamic>;

        if (response.statusCode == 200) {
          // Backend returns: { success: true, data: {...} }
          if (responseBody['success'] == true && responseBody['data'] != null) {
            return responseBody['data'] as Map<String, dynamic>;
          }
          return responseBody;
        } else {
          _handleHttpError(response.statusCode, responseBody);
          throw Exception(); // Should not reach here
        }
      } catch (e) {
        final errorString = e.toString().toLowerCase();
        if (errorString.contains('socketexception') ||
            errorString.contains('connection') ||
            errorString.contains('network') ||
            errorString.contains('failed host lookup')) {
          throw Exception('Connection error. Please check your network connection and ensure the backend is running.');
        }
        if (e is FormatException) {
          throw Exception('Invalid response from server: ${e.message}');
        }
        if (e is Exception) {
          rethrow;
        }
        throw Exception('Network error: $e');
      }
    });
  }

  Future<bool> markBinCollected(String routeId, String binId,
      {String? photoUrl, String? notes}) async {
    return await _retryRequest(() async {
      try {
        final body = <String, dynamic>{};
        if (photoUrl != null) body['photoUrl'] = photoUrl;
        if (notes != null) body['notes'] = notes;

        final response = await http
            .post(
              Uri.parse('$baseUrl/routes/$routeId/bins/$binId/visit'),
              headers: _headers,
              body: jsonEncode(body),
            )
            .timeout(requestTimeout);

        final responseBody = jsonDecode(response.body) as Map<String, dynamic>;

        if (response.statusCode == 200) {
          return responseBody['success'] == true;
        } else {
          _handleHttpError(response.statusCode, responseBody);
          throw Exception(); // Should not reach here
        }
      } catch (e) {
        final errorString = e.toString().toLowerCase();
        if (errorString.contains('socketexception') ||
            errorString.contains('connection') ||
            errorString.contains('network') ||
            errorString.contains('failed host lookup')) {
          throw Exception('Connection error. Please check your network connection and ensure the backend is running.');
        }
        if (e is FormatException) {
          throw Exception('Invalid response from server: ${e.message}');
        }
        if (e is Exception) {
          rethrow;
        }
        throw Exception('Network error: $e');
      }
    });
  }
}
