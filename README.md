# Smart Waste Management System

A comprehensive IoT-based waste management solution with real-time monitoring, ML-powered predictions, and optimized collection routes.
## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   IoT Sensors   │    │   Mobile App    │    │  Web Dashboard  │
│   (ESP32)       │    │   (Flutter)     │    │   (React.js)    │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         │ MQTT                 │ REST API             │ REST API
         │                      │                      │
┌────────▼──────────────────────▼──────────────────────▼────────┐
│                    Backend Services                          │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐  │
│  │   Node.js   │  │   Redis     │  │   MongoDB Atlas       │  │
│  │   Express   │  │   Cache     │  │   Database            │  │
│  └─────────────┘  └─────────────┘  └───────────────────────┘  │
└───────────────────────┬───────────────────────────────────────┘
                        │
┌───────────────────────▼───────────────────────────────────────┐
│                ML Microservice                              │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────────┐  │
│  │  FastAPI    │  │  Scikit-    │  │    OR-Tools           │  │
│  │  Service    │  │  Learn      │  │  Route Optimization  │  │
│  └─────────────┘  └─────────────┘  └───────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- Flutter SDK
- MongoDB Atlas account
- AWS account (for IoT Core)
- Docker (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd smartWasteManagement
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# ML Service
cd ../ml-service
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

# Mobile App
cd ../mobile
flutter pub get
```

3. **Environment Setup**
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
cp frontend/.env.example frontend/.env
```

4. **Start services**
```bash
# Start all services with Docker Compose
docker-compose up -d

# Or start individually
npm run dev:backend
npm run dev:ml
npm run dev:frontend
```

## 📁 Project Structure

```
smartWasteManagement/
├── backend/            # Node.js backend API service
├── ml-service/         # Python ML microservice
├── web-dashboard/      # React.js web dashboard frontend
├── mobile-app/         # Flutter mobile application
├── iot-device/         # ESP32 firmware and hardware configurations
├── lambda/             # AWS Lambda function code
├── docs/               # System documentation
├── scripts/            # Management and helper scripts
├── tests/              # End-to-end testing (Playwright)
├── infrastructure/     # Nginx/Docker configurations
└── docker-compose.yml  # Local multi-service orchestration
```

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, MongoDB, Redis, Socket.io
- **ML Service**: Python, FastAPI, Scikit-learn, OR-Tools
- **Frontend**: React.js, TypeScript, TailwindCSS, Leaflet.js
- **Mobile**: Flutter, Dart
- **IoT**: ESP32, Arduino, MQTT
- **Cloud**: AWS IoT Core, MongoDB Atlas
- **DevOps**: Docker, GitHub Actions

## 📊 Features

- Real-time waste level monitoring
- ML-powered waste generation prediction
- Optimized collection route planning
- Municipal admin dashboard
- Mobile app for waste collectors
- Offline-first mobile architecture
- Comprehensive analytics and reporting

## 🧪 Testing

```bash
# Run all tests
npm run test:all

# Backend tests
cd backend && npm test

# ML service tests
cd ml-service && pytest

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## 🚀 Deployment

See [AWS Deployment Guide](docs/deployment.md) for detailed instructions.

## 📚 Documentation

Detailed setup instructions can be found in the [Documentation Index](docs/README.md):
- [Backend Setup Guide](docs/backend-setup.md)
- [Database Setup Guide](docs/database-setup.md)
- [Mobile App Guide](docs/mobile-guide.md)
- [IoT Setup Guide](docs/iot-setup.md)
- [ML Model Documentation](docs/ml-models.md)
- [API Testing Guide](docs/api-testing.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
