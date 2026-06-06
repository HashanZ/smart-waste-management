# ðŸš€ Smart Waste Management System - Step-by-Step Running Guide

This guide will walk you through running and checking your Smart Waste Management system step by step.

## ðŸ“‹ Prerequisites Check

Before starting, ensure you have the following installed:

### Required Software
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Python 3.9+** - [Download here](https://python.org/)
- **Flutter SDK** - [Download here](https://flutter.dev/)
- **MongoDB** (local or Atlas) - [Download here](https://mongodb.com/)
- **Redis** (optional for caching) - [Download here](https://redis.io/)

### Verify Installation
```bash
# Check Node.js
node --version  # Should be 18+

# Check Python
python --version  # Should be 3.9+

# Check Flutter
flutter --version  # Should be 3.0+

# Check MongoDB
mongod --version  # If using local MongoDB
```

## ðŸ—ï¸ Step 1: Environment Setup

### 1.1 Navigate to Project Root
```bash
cd C:\Users\Hashan\Documents\cursor\smartWasteManegement
```

### 1.2 Create Environment Files
```bash
# Backend environment
cp backend/env.example backend/.env

# ML Service environment (if needed)
# cp ml-service/.env.example ml-service/.env
```

### 1.3 Configure Environment Variables
Edit `backend/.env` with your settings:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/smartwaste
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Server
API_PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# MQTT (optional)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart-waste-backend

# ML Service
ML_SERVICE_URL=http://localhost:8001
```

## ðŸ”§ Step 2: Install Dependencies

### 2.1 Backend Dependencies
```bash
cd backend
npm install
```

### 2.2 Web Dashboard Dependencies
```bash
cd ../web-dashboard
npm install
```

### 2.3 Mobile App Dependencies
```bash
cd ../mobile-app
flutter pub get
```

### 2.4 ML Service Dependencies
```bash
cd ../ml-service
pip install -r requirements.txt
```

### 2.5 E2E Test Dependencies
```bash
cd ../tests/e2e
npm install
```

## ðŸš€ Step 3: Start Services (Development Mode)

### 3.1 Start Backend Service
```bash
cd backend
npm run dev
```
**Expected Output:**
```
ðŸš€ Server running on port 3000
ðŸ“Š Environment: development
ðŸ”— Health check: http://localhost:3000/health
```

**Health Check:** Visit `http://localhost:3000/health`

### 3.2 Start Web Dashboard
```bash
cd web-dashboard
npm run dev
```
**Expected Output:**
```
webpack compiled with 0 errors
Local:            http://localhost:3001
On Your Network:  http://192.168.x.x:3001
```

**Access:** Visit `http://localhost:3001`

### 3.3 Start ML Service
```bash
cd ml-service
python -m uvicorn main:app --reload --port 8001 --host 0.0.0.0
```
**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Started reloader process
INFO:     Started server process
```

**Health Check:** Visit `http://localhost:8001/docs`

### 3.4 Start Mobile App (Optional)
```bash
cd mobile-app
flutter run
```
**Note:** Requires Android Studio/VS Code with Flutter extension

### 3.5 Start with Docker Compose (All Services)
```bash
docker-compose up -d --build
```
Services: MongoDB, Redis, ML Service, Backend, Web Dashboard, Nginx, Prometheus, Grafana. Healthchecks coordinate startup.

## âœ… Step 4: System Verification

### 4.1 Backend Health Check
```bash
curl http://localhost:3000/health
```
**Expected Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

### 4.2 Web Dashboard Check
1. Open `http://localhost:3001`
2. Verify the dashboard loads
3. Check for any console errors in browser dev tools

### 4.3 ML Service Check
1. Open `http://localhost:8001/docs`
2. Verify FastAPI documentation loads
3. Test a simple endpoint

### 4.4 API Endpoints Test
```bash
# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test bins endpoint
curl http://localhost:3000/api/bins

# Test analytics
curl http://localhost:3000/api/analytics/metrics
```

## ðŸ§ª Step 5: Run Tests

### 5.1 Backend Tests
```bash
cd backend
npm test
```

### 5.2 Web Dashboard Tests
```bash
cd web-dashboard
npm test
```

### 5.3 ML Service Tests
```bash
cd ml-service
python -m pytest
```

### 5.4 E2E Tests
```bash
cd tests/e2e
npm test
```

## ðŸ” Step 6: System Monitoring

### 6.1 Check Service Status
```bash
# Check if all services are running
netstat -an | findstr :3000  # Backend
netstat -an | findstr :3001  # Web Dashboard
netstat -an | findstr :8001  # ML Service
```

### 6.2 Monitor Logs
```bash
# Backend logs (in backend terminal)
# Web Dashboard logs (in web-dashboard terminal)
# ML Service logs (in ml-service terminal)
```

### 6.3 Database Connection
```bash
# If using local MongoDB
mongosh
use smartwaste
show collections
```

## ðŸ› Step 7: Troubleshooting

### Common Issues and Solutions

#### 7.1 Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3000
# Kill process
taskkill /PID <PID> /F
```

#### 7.2 MongoDB Connection Issues
```bash
# Start MongoDB service
net start MongoDB
# Or if using MongoDB Atlas, check connection string
```

#### 7.3 Node Modules Issues
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### 7.4 Flutter Issues
```bash
# Clean and rebuild
flutter clean
flutter pub get
flutter pub upgrade
```

## ðŸ“Š Step 8: Performance Check

### 8.1 Load Testing (Optional)
```bash
# Install artillery for load testing
npm install -g artillery

# Run load test
artillery quick --count 10 --num 5 http://localhost:3000/health
```

### 8.2 Memory Usage
```bash
# Check Node.js memory usage
node --inspect backend/dist/index.js
# Open Chrome DevTools at chrome://inspect
```

## ðŸš€ Step 9: Production Deployment

### 9.1 Build for Production
```bash
# Backend
cd backend
npm run build

# Web Dashboard
cd web-dashboard
npm run build

# Mobile App
cd mobile-app
flutter build apk  # For Android
flutter build ios   # For iOS
```

### 9.2 Docker Deployment (Optional)
```bash
# Build and run with Docker
docker-compose up -d
```

## ðŸ“± Step 10: Mobile App Testing

### 10.1 Android Testing
```bash
cd mobile-app
flutter run -d android
```

### 10.2 iOS Testing (Mac only)
```bash
cd mobile-app
flutter run -d ios
```

## ðŸ”§ Step 11: Development Workflow

### 11.1 Hot Reload Development
- Backend: `npm run dev` (auto-restart on changes)
- Web Dashboard: `npm run dev` (hot reload)
- ML Service: `uvicorn main:app --reload` (auto-restart)
- Mobile App: `flutter run` (hot reload)

### 11.2 Code Quality Checks
```bash
# Backend linting
cd backend && npm run lint

# Web Dashboard linting
cd web-dashboard && npm run lint

# Mobile App analysis
cd mobile-app && flutter analyze
```

## ðŸ“ˆ Step 12: System Health Dashboard

### 12.1 Create Health Check Script
```bash
# Create health-check.sh
#!/bin/bash
echo "Checking Smart Waste Management System..."

# Backend
curl -f http://localhost:3000/health || echo "âŒ Backend down"

# Web Dashboard
curl -f http://localhost:3001 || echo "âŒ Web Dashboard down"

# ML Service
curl -f http://localhost:8001/docs || echo "âŒ ML Service down"

echo "âœ… Health check complete"
```

## ðŸŽ¯ Success Criteria

Your system is running correctly when:

1. âœ… All services start without errors
2. âœ… Health endpoints respond with 200 status
3. âœ… Web dashboard loads without console errors
4. âœ… API endpoints return expected responses
5. âœ… All tests pass
6. âœ… Mobile app builds and runs (if testing mobile)
7. âœ… Database connections are established
8. âœ… No critical errors in logs

## ðŸ“ž Support

If you encounter issues:

1. Check the logs in each service terminal
2. Verify all dependencies are installed
3. Ensure all required ports are available
4. Check environment variable configuration
5. Review the troubleshooting section above

---

**ðŸŽ‰ Congratulations!** Your Smart Waste Management system should now be running successfully. You can start developing, testing, and deploying your IoT-based waste management solution.







































