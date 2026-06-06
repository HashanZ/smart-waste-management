import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService = ApiService(); // Uses singleton instance
  bool _isAuthenticated = false;
  String? _userName;
  String? _userEmail;
  String? _userId;

  bool get isAuthenticated => _isAuthenticated;
  String? get userName => _userName;
  String? get userEmail => _userEmail;
  String? get userId => _userId;

  Future<bool> login(String email, String password) async {
    try {
      final response = await _apiService.login(email, password);

      // Backend returns: { success: true, message: "...", data: { user: {...}, token: "..." } }
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'];
        final token = data['token'];
        final user = data['user'];

        if (token != null && user != null) {
          _isAuthenticated = true;
          // User object has firstName and lastName, not name
          final firstName = user['firstName'] ?? '';
          final lastName = user['lastName'] ?? '';
          _userName = firstName.isNotEmpty && lastName.isNotEmpty
              ? '$firstName $lastName'
              : (user['email'] ?? email);
          _userEmail = user['email'] ?? email;
          _userId = user['_id']?.toString() ?? user['id']?.toString();

          // Save token
          final prefs = await SharedPreferences.getInstance();
          await prefs.setString('auth_token', token);
          await prefs.setString('user_email', _userEmail ?? email);
          await prefs.setString('user_name', _userName ?? email);
          if (_userId != null) {
            await prefs.setString('user_id', _userId!);
          }

          _apiService.setToken(token);
          notifyListeners();
          return true;
        }
      }
      return false;
    } catch (e) {
      print('Login error: $e');
      // Re-throw to show error message in UI
      rethrow;
    }
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_email');
    await prefs.remove('user_name');
    await prefs.remove('user_id');

    _isAuthenticated = false;
    _userName = null;
    _userEmail = null;
    _userId = null;
    _apiService.setToken(null);
    notifyListeners();

    print('✅ Logged out successfully');
  }

  Future<void> loadSavedAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('auth_token');

    if (token != null && token.isNotEmpty) {
      _isAuthenticated = true;
      _userEmail = prefs.getString('user_email');
      _userName = prefs.getString('user_name');
      _userId = prefs.getString('user_id');
      _apiService.setToken(token);
      notifyListeners();
    }
  }
}

