# Mobile App Setup Guide

The Smart Waste collector mobile application is built using the **Flutter** framework. It enables collectors to view optimization routes and mark bins as emptied.

## Prerequisites

- **Flutter SDK** (3.x or later)
- **Dart SDK** (3.x or later)
- **Android Studio** (for building Android packages) or **Xcode** (for macOS builds)

## Setup & Running Locally

1. Navigate to the mobile app folder:
   ```bash
   cd mobile-app
   ```
2. Retrieve required dependencies:
   ```bash
   flutter pub get
   ```
3. Update the backend URL in `lib/services/api_service.dart`:
   ```dart
   static const String baseUrl = 'http://<YOUR_BACKEND_IP>:3000/api';
   ```
4. Connect a physical device or launch an emulator. Verify devices list using:
   ```bash
   flutter devices
   ```
5. Run the application:
   ```bash
   flutter run
   ```

## Production Release

To compile a production-ready Android package:
```bash
flutter build apk --release
```
The compiled package will be located at `build/app/outputs/flutter-apk/app-release.apk`.
