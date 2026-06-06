# ðŸš€ Quick Start Commands - Smart Waste Management System

## ðŸ“‹ Essential Commands

### ðŸ—ï¸ Setup (Run Once)
```bash
# Navigate to project
cd C:\Users\Hashan\Documents\cursor\smartWasteManegement

# Install all dependencies
cd backend && npm install
cd ../web-dashboard && npm install  
cd ../mobile-app && flutter pub get
cd ../ml-service && pip install -r requirements.txt
cd ../tests/e2e && npm install
```

### ðŸš€ Start All Services
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Web Dashboard  
cd web-dashboard
npm run dev

# Terminal 3 - ML Service
cd ml-service
python -m uvicorn main:app --reload --port 8001

# Terminal 4 - Mobile App (Optional)
cd mobile-app
flutter run
```

### âœ… Health Checks
```bash
# Backend Health
curl http://localhost:3000/health

# Web Dashboard
# Open: http://localhost:3001

# ML Service
# Open: http://localhost:8001/docs
```

### ðŸ§ª Run Tests
```bash
# Backend Tests
cd backend && npm test

# Web Dashboard Tests  
cd web-dashboard && npm test

# ML Service Tests
cd ml-service && python -m pytest

# E2E Tests
cd tests/e2e && npm test
```

### ðŸ”§ Development Tools
```bash
# Backend Linting
cd backend && npm run lint

# Web Dashboard Linting
cd web-dashboard && npm run lint

# Mobile App Analysis
cd mobile-app && flutter analyze

# Type Checking
cd backend && npm run type-check
cd web-dashboard && npm run type-check
```

### ðŸ› Troubleshooting
```bash
# Kill processes on ports
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Clear Node modules
rm -rf node_modules package-lock.json
npm install

# Flutter clean
cd mobile-app
flutter clean
flutter pub get
```

### ðŸ“± Mobile App Commands
```bash
cd mobile-app

# Get dependencies
flutter pub get

# Run on Android
flutter run -d android

# Run on iOS (Mac only)
flutter run -d ios

# Build APK
flutter build apk

# Build iOS (Mac only)
flutter build ios
```

### ðŸ³ Docker Commands (Optional)
```bash
# Build and run with Docker
docker-compose up -d

# Stop Docker services
docker-compose down

# View logs
docker-compose logs -f
```

## ðŸŽ¯ Quick Verification Checklist

- [ ] Backend running on http://localhost:3000
- [ ] Web Dashboard running on http://localhost:3001  
- [ ] ML Service running on http://localhost:8001
- [ ] Health endpoints responding
- [ ] No console errors
- [ ] All tests passing
- [ ] Mobile app building successfully

## ðŸ“ž Emergency Commands

```bash
# Stop all Node processes
taskkill /f /im node.exe

# Stop all Python processes  
taskkill /f /im python.exe

# Reset everything
git clean -fd
git reset --hard HEAD
```

---
**ðŸ’¡ Tip:** Keep this file handy for quick reference during development!







































