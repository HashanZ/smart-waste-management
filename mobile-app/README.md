# Waste Collector Mobile App

Simple mobile app for waste collectors to view collection routes and mark bins as collected.

## Features

- ✅ **Login/Authentication** - Secure login for waste collectors
- ✅ **Route View** - View assigned collection routes
- ✅ **Map with Path** - See bins on map with collection route path
- ✅ **Bin Details** - View bin information (fill level, location)
- ✅ **Mark Collected** - Mark bins as collected after emptying
- ✅ **Navigation** - Open Google Maps navigation to bins
- ✅ **Real-time Updates** - See collection progress

## Setup

### Prerequisites

- Flutter SDK (3.0.0+)
- Android Studio / VS Code with Flutter extensions
- Backend API running on `http://localhost:3000`

### Installation

1. **Install dependencies:**
   ```bash
   cd mobile-app
   flutter pub get
   ```

2. **Configure API URL:**
   - Edit `lib/services/api_service.dart`
   - Update `baseUrl` if backend is not on localhost:3000

3. **Run the app:**
   ```bash
   flutter run
   ```

## Usage

### Login
- Use waste collector credentials
- Default test account: `collector@example.com` / `password123`

### View Routes
- App automatically loads assigned routes
- Tap refresh button to reload

### View Map
- See all bins in route on map
- Route path shown as blue line
- Color-coded markers:
  - 🟢 Green: Collected
  - 🔴 Red: Fill level > 80%
  - 🟠 Orange: Fill level 50-80%
  - 🟡 Yellow: Fill level < 50%

### Mark Bin as Collected
1. Tap on bin marker or bin in list
2. Tap "Mark as Collected" button
3. Bin status updates immediately

### Navigate to Bin
1. Tap navigation icon on bin
2. Opens Google Maps with directions

## Project Structure

```
lib/
├── main.dart                 # App entry point
├── models/
│   └── route_model.dart      # Data models
├── providers/
│   ├── auth_provider.dart    # Authentication state
│   └── route_provider.dart   # Route data state
├── screens/
│   ├── login_screen.dart     # Login page
│   ├── route_screen.dart     # Main route view with map
│   └── bin_details_sheet.dart # Bin details bottom sheet
└── services/
    └── api_service.dart      # API communication
```

## API Endpoints Used

- `POST /api/auth/login` - Login
- `GET /api/routes/assigned` - Get assigned routes
- `GET /api/routes/:id` - Get route details
- `POST /api/collections` - Mark bin as collected

## Dependencies

- `google_maps_flutter` - Map display
- `geolocator` - Location services
- `http` - API calls
- `provider` - State management
- `shared_preferences` - Local storage
- `url_launcher` - Open navigation

## Notes

- App is designed for waste collectors only
- Simple, focused interface
- No unnecessary features
- Works offline for viewing cached routes
- Requires internet for marking bins as collected
