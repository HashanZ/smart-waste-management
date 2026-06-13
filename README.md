# Smart Waste Management System

An IoT-based waste management platform that helps monitor bin levels in real time, predict waste generation, and optimize collection routes. The system combines IoT devices, machine learning, and web technologies to improve collection efficiency and reduce operational costs.

---

## Overview

The system consists of four main components:

* **IoT devices (ESP32)** for collecting waste level data
* **Backend API** built with Node.js and Express
* **Machine learning service** for prediction and route optimization
* **Web dashboard and mobile application** for monitoring and management

---

## Features

* Real-time waste level monitoring
* Waste generation prediction using machine learning
* Collection route optimization
* Interactive web dashboard
* Mobile application for waste collectors
* Analytics and reporting
* Offline support for field operations
* REST API architecture
* Docker-based deployment support

---

## System Architecture

```
IoT Sensors (ESP32)
          │
         MQTT
          │
────────────────────────────────
        Backend Services
────────────────────────────────
 Node.js + Express + MongoDB
 Redis Cache + Socket.io
          │
          │
────────────────────────────────
        ML Microservice
────────────────────────────────
 FastAPI + Scikit-learn
 OR-Tools Route Optimization
          │
          │
────────────────────────────────
      Client Applications
────────────────────────────────
 React Web Dashboard
 Flutter Mobile App
```

---

## Tech Stack

### Backend

* Node.js
* Express.js
* MongoDB Atlas
* Redis
* Socket.io

### Frontend

* React.js
* TypeScript
* Tailwind CSS
* Leaflet.js

### Mobile

* Flutter
* Dart

### Machine Learning

* Python
* FastAPI
* Scikit-learn
* OR-Tools

### IoT

* ESP32
* Arduino
* MQTT

### Cloud and DevOps

* AWS IoT Core
* Docker
* GitHub Actions

---

## Project Structure

```text
smartWasteManagement
│
├── backend/             # REST API service
├── ml-service/          # Machine learning microservice
├── web-dashboard/       # React frontend
├── mobile-app/          # Flutter application
├── iot-device/          # ESP32 firmware
├── lambda/              # AWS Lambda functions
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── tests/               # End-to-end tests
├── infrastructure/      # Docker and Nginx configurations
└── docker-compose.yml
```

---

## Installation

### Clone the repository

```bash
git clone https://github.com/your-username/smartWasteManagement.git

cd smartWasteManagement
```

### Install dependencies

#### Backend

```bash
cd backend
npm install
```

#### Machine Learning Service

```bash
cd ../ml-service
pip install -r requirements.txt
```

#### Web Dashboard

```bash
cd ../web-dashboard
npm install
```

#### Mobile Application

```bash
cd ../mobile-app
flutter pub get
```

---

## Environment Configuration

Create `.env` files for each service and configure the required environment variables.

Example:

```env
MONGODB_URI=
JWT_SECRET=
REDIS_URL=
AWS_REGION=
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
```

---

## Running the Project

### Using Docker

```bash
docker-compose up -d
```

### Running services individually

Backend

```bash
npm run dev
```

ML Service

```bash
uvicorn main:app --reload
```

Frontend

```bash
npm run dev
```

---

## Applications

### Web Dashboard

Provides administrators with:

* Live waste bin status
* Collection analytics
* Route visualization
* Reports and insights

### Mobile Application

Designed for waste collection personnel:

* View assigned routes
* Update collection status
* Access data offline
* Synchronize automatically when connected

---

## Future Improvements

* Smart notification system
* Image-based waste classification
* Predictive maintenance for sensors
* Multi-city deployment support
* Role-based access control
* Real-time alerts

---

## License

This project was developed as an undergraduate software engineering project for research and educational purposes.

 

 
 
