import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'screens/login_screen.dart';
import 'screens/route_screen.dart';
import 'services/api_service.dart';
import 'providers/auth_provider.dart';
import 'providers/route_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    // Initialize ApiService and load saved token
    await ApiService().initialize();
    print('✅ ApiService initialized');
  } catch (e) {
    print('⚠️ ApiService initialization error: $e');
    // Continue anyway - app can still work
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => RouteProvider()),
      ],
      child: MaterialApp(
        title: 'Waste Collector',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          // Primary color scheme matching web dashboard (Emerald/Teal)
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF22c55e), // emerald-500 (primary-500)
            primary: const Color(0xFF22c55e), // emerald-500
            secondary: const Color(0xFF10b981), // teal-500
            tertiary: const Color(0xFF16a34a), // emerald-600
            surface: Colors.white,
            background: const Color(0xFFf0fdf4), // emerald-50
            error: const Color(0xFFef4444), // red-500
            onPrimary: Colors.white,
            onSecondary: Colors.white,
            onSurface: const Color(0xFF111827), // gray-900
            onBackground: const Color(0xFF111827), // gray-900
            onError: Colors.white,
            brightness: Brightness.light,
          ),
          // AppBar theme
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF22c55e), // emerald-500
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: false,
          ),
          // Card theme
          cardTheme: CardTheme(
            elevation: 2,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            color: Colors.white,
          ),
          // Elevated button theme
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF22c55e), // emerald-500
              foregroundColor: Colors.white,
              elevation: 2,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          // Input decoration theme
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: const Color(0xFFf9fafb), // gray-50
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFd1d5db)), // gray-300
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFd1d5db)), // gray-300
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF22c55e), width: 2), // emerald-500
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFef4444)), // red-500
            ),
          ),
          // Floating action button theme
          floatingActionButtonTheme: const FloatingActionButtonThemeData(
            backgroundColor: Color(0xFF22c55e), // emerald-500
            foregroundColor: Colors.white,
          ),
        ),
        initialRoute: '/',
        routes: {
          '/': (context) => const AuthWrapper(),
          '/route': (context) => const RouteScreen(),
        },
      ),
    );
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isLoading = true;
  bool _isAuthenticated = false;

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    try {
      // Add timeout to prevent infinite loading
      await Future.delayed(const Duration(milliseconds: 100)); // Small delay for UI
      final prefs = await SharedPreferences.getInstance();
      final token = prefs.getString('auth_token');
      if (mounted) {
        setState(() {
          _isAuthenticated = token != null && token.isNotEmpty;
          _isLoading = false;
        });
        print('✅ Auth check complete: ${_isAuthenticated ? "authenticated" : "not authenticated"}');
      }
    } catch (e) {
      print('❌ Auth check error: $e');
      if (mounted) {
        setState(() {
          _isAuthenticated = false;
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    return _isAuthenticated ? const RouteScreen() : const LoginScreen();
  }
}
