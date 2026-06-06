#!/bin/bash
# AWS Deployment Quick Start Script
# This script helps automate some deployment steps

set -e

echo "🚀 Smart Waste Management - AWS Deployment Helper"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Get user inputs
read -p "Enter your S3 bucket name (e.g., smart-waste-dashboard): " S3_BUCKET
read -p "Enter your EC2 instance IP or domain: " EC2_IP
read -p "Enter your MongoDB Atlas URI: " MONGODB_URI
read -p "Enter your JWT secret: " JWT_SECRET

echo ""
echo "📦 Building production versions..."

# Build backend
echo "Building backend..."
cd ../backend
npm install
npm run build
cd ..

# Build frontend
echo "Building frontend..."
cd web-dashboard

# Create .env.production
cat > .env.production << EOF
REACT_APP_API_URL=http://${EC2_IP}/api
REACT_APP_ML_SERVICE_URL=http://${EC2_IP}:8001
EOF

npm install
npm run build
cd ..

echo -e "${GREEN}✅ Build complete${NC}"
echo ""

# Deploy to S3
echo "🌐 Deploying frontend to S3..."
aws s3 sync web-dashboard/build s3://${S3_BUCKET} --delete

echo -e "${GREEN}✅ Frontend deployed to S3${NC}"
echo ""

# Create backend deployment package
echo "📦 Creating backend deployment package..."
mkdir -p deploy/backend
cp -r backend/dist deploy/backend/
cp backend/package.json deploy/backend/
cp backend/package-lock.json deploy/backend/ 2>/dev/null || true

# Create .env file for backend
cat > deploy/backend/.env << EOF
API_PORT=3000
NODE_ENV=production
MONGODB_URI=${MONGODB_URI}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://${S3_BUCKET}.s3-website-us-east-1.amazonaws.com
ML_SERVICE_URL=http://${EC2_IP}:8001
LOG_LEVEL=info
EOF

echo -e "${GREEN}✅ Deployment package created${NC}"
echo ""

echo "📝 Next steps:"
echo "1. Upload deploy/backend to your EC2 instance:"
echo "   scp -i your-key.pem -r deploy/backend ec2-user@${EC2_IP}:~/smart-waste/"
echo ""
echo "2. On EC2, run:"
echo "   cd ~/smart-waste/backend"
echo "   npm install --production"
echo "   pm2 start dist/index.js --name backend"
echo ""
echo "3. Get your S3 website URL from AWS Console"
echo "4. Setup CloudFront distribution (optional)"
echo ""
echo -e "${GREEN}✅ Deployment helper complete!${NC}"








