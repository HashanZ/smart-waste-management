# Backend Setup Guide

The Express.js backend handles dashboard requests, collector updates, and IoT sensor ingest.

## Local Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Copy the sample environment file:
   ```bash
   cp env.example .env
   ```
4. Edit the `.env` file with your connection strings (e.g. `MONGODB_URI` and port configs).

## Running Server

- **Development mode** (runs node-dev/nodemon compiler):
  ```bash
  npm run dev
  ```
- **Production mode** (builds TypeScript project to `dist/` and starts it):
  ```bash
  npm run build
  npm start
  ```
- **Run tests**:
  ```bash
  npm test
  ```
