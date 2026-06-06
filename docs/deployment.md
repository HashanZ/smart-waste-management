# AWS Free Tier Deployment Guide

This guide describes how to deploy the Smart Waste Management System to AWS using Free Tier services.

## Architecture Overview

```
┌─────────────────┐
│   IoT Device    │ (ESP32 DevKit V1)
└────────┬────────┘
         │ HTTP POST (Cellular / Wi-Fi)
         ▼
┌─────────────────┐
│  API Gateway    │ (AWS API Gateway + Lambda Function)
└────────┬────────┘
         │ Updates
         ▼
┌─────────────────┐
│  MongoDB Atlas  │ (Cloud MongoDB Instance)
└─────────────────┘

┌─────────────────┐
│  Web Dashboard  │ (React Hosted on AWS S3 + CloudFront)
└────────┬────────┘
         │ HTTP / REST
         ▼
┌─────────────────┐
│  Backend API    │ (Node.js Express Hosted on AWS EC2)
└────────┬────────┘
         │ Requests
         ▼
┌─────────────────┐
│  ML Service     │ (Python FastAPI Hosted on AWS EC2)
└─────────────────┘
```

---

## 1. Frontend Deployment (S3 + CloudFront)

### S3 Static Website Hosting
1. Create a globally unique S3 bucket named `smart-waste-dashboard`.
2. Disable **Block Public Access**.
3. Under **Properties**, enable **Static website hosting** and set both index and error documents to `index.html`.
4. Apply the following public read bucket policy (replace `smart-waste-dashboard` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::smart-waste-dashboard/*"
    }
  ]
}
```

### Build & Upload
1. Update `web-dashboard/.env.production` with your backend server URL.
2. Build the project:
   ```bash
   cd web-dashboard
   npm install
   npm run build
   ```
3. Upload the contents of the `web-dashboard/build` directory to your S3 bucket.

---

## 2. Server Deployment (EC2)

Deploy both the Node.js backend and the Python ML service on a single **t2.micro** Amazon Linux instance.

### Launch and Configure EC2
1. Launch a `t2.micro` instance using **Amazon Linux 2023**.
2. Select or create an SSH key pair (`smart-waste-key.pem`).
3. Configure Security Group inbound rules:
   - **SSH (22)**: Restricted to your IP
   - **HTTP (80)** & **HTTPS (443)**: Anywhere (`0.0.0.0/0`)
   - **Custom TCP (3000)**: Backend Express server
   - **Custom TCP (8001)**: ML service uvicorn server

### Environment Setup
Connect to the instance via SSH and run:
```bash
sudo yum update -y
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git python3 python3-pip
sudo npm install -g pm2
```

### Backend Deployment
1. Upload the `backend/` folder to the EC2 instance.
2. Navigate to the backend directory and install dependencies:
   ```bash
   cd backend
   npm install --production
   npm run build
   ```
3. Create a `.env` file in the folder containing production parameters (e.g. `MONGODB_URI`, `JWT_SECRET`, etc.).
4. Run the backend service with PM2:
   ```bash
   pm2 start dist/index.js --name backend
   pm2 save
   pm2 startup
   ```

### ML Service Deployment
1. Upload the `ml-service/` folder to the EC2 instance.
2. Set up virtual environment and install packages:
   ```bash
   cd ml-service
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. Create a `.env` file containing `MONGODB_URI` and configuration keys.
4. Run with PM2 using a custom interpreter path:
   ```bash
   pm2 start uvicorn --name ml-service -- main:app --host 0.0.0.0 --port 8001
   pm2 save
   ```

---

## 3. Lambda & API Gateway for IoT

1. Deploy the `lambda/index.js` file to an AWS Lambda function with the Node.js 18+ runtime.
2. Configure environment variables in the Lambda Console:
   - `MONGODB_URI`: Connection string to MongoDB Atlas
   - `DB_NAME`: Database name (e.g., `smartWaste`)
3. Create an API Gateway HTTP/REST endpoint proxying requests to this Lambda.
4. Set the invoke URL of the API Gateway stage in the ESP32 source code.
