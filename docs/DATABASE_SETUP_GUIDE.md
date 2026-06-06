# ðŸ—„ï¸ Database Setup Guide - Complete Beginner's Guide

This guide will walk you through setting up a database for your Smart Waste Management system from scratch, even if you've never worked with databases before.

## ðŸ“š What is a Database?

A database is like a digital filing cabinet that stores all your application's data in an organized way. For your Smart Waste Management system, it will store:
- User accounts (municipal workers, collectors)
- Waste bin information and locations
- Collection schedules and routes
- Sensor data from IoT devices
- Analytics and reports

## ðŸŽ¯ Database Options for Your System

### Option 1: MongoDB Atlas (Cloud - Recommended for Beginners)
- âœ… Free tier available
- âœ… No installation required
- âœ… Managed by MongoDB
- âœ… Easy to set up

### Option 2: Local MongoDB (On Your Computer)
- âœ… Free
- âŒ Requires installation
- âŒ More complex setup

**We'll use MongoDB Atlas (Option 1) as it's easier for beginners.**

## ðŸš€ Step 1: Create MongoDB Atlas Account

### 1.1 Sign Up for MongoDB Atlas
1. Go to [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. Click "Try Free"
3. Fill in your details:
   - Email: your-email@example.com
   - Password: create a strong password
   - First Name: Your first name
   - Last Name: Your last name
4. Click "Create Account"

### 1.2 Verify Your Email
1. Check your email inbox
2. Click the verification link
3. Complete the verification process

## ðŸ—ï¸ Step 2: Create Your First Database

### 2.1 Create a New Project
1. After logging in, click "New Project"
2. Project Name: "Smart Waste Management"
3. Click "Next"
4. Click "Create Project"

### 2.2 Create a Database Cluster
1. Click "Build a Database"
2. Choose "FREE" tier (M0 Sandbox)
3. Cloud Provider: Choose AWS (recommended)
4. Region: Choose closest to your location
5. Cluster Name: "smart-waste-cluster"
6. Click "Create"

### 2.3 Set Up Database Access
1. **Database User:**
   - Username: `smartwaste-user`
   - Password: Create a strong password (save this!)
   - Click "Create Database User"

2. **Network Access:**
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Click "Add Entry"

## ðŸ”— Step 3: Get Your Database Connection String

### 3.1 Connect to Your Database
1. Click "Connect" on your cluster
2. Choose "Connect your application"
3. Driver: "Node.js"
4. Version: "4.1 or later"
5. Copy the connection string (it looks like this):
```
mongodb+srv://smartwaste-user:<password>@smart-waste-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

### 3.2 Replace Password in Connection String
Replace `<password>` with the password you created for your database user.

**Example:**
```
mongodb+srv://smartwaste-user:MySecurePassword123@smart-waste-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

## âš™ï¸ Step 4: Configure Your Application

### 4.1 Create Environment File
Navigate to your project and create the environment file:

```bash
cd C:\Users\Hashan\Documents\cursor\smartWasteManegement\backend
```

Create a file called `.env` in the backend folder:

```bash
# Create .env file
notepad .env
```

### 4.2 Add Database Configuration
Copy and paste this into your `.env` file:

```env
# Database Configuration
MONGODB_URI=mongodb+srv://smartwaste-user:YOUR_PASSWORD_HERE@smart-waste-cluster.xxxxx.mongodb.net/smartwaste?retryWrites=true&w=majority

# Server Configuration
API_PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:3001

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# MQTT Configuration (Optional)
MQTT_BROKER_URL=mqtt://localhost:1883
MQTT_CLIENT_ID=smart-waste-backend

# ML Service Configuration
ML_SERVICE_URL=http://localhost:8001
```

**âš ï¸ Important:** Replace `YOUR_PASSWORD_HERE` with your actual database password!

## ðŸ§ª Step 5: Test Database Connection

### 5.1 Install Dependencies
```bash
cd backend
npm install
```

### 5.2 Test Connection
Create a simple test file to verify your database connection:

```bash
# Create test file
notepad test-db-connection.js
```

Copy this code into the file:

```javascript
const mongoose = require('mongoose');

// Your connection string (replace with your actual string)
const MONGODB_URI = 'mongodb+srv://smartwaste-user:YOUR_PASSWORD_HERE@smart-waste-cluster.xxxxx.mongodb.net/smartwaste?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('ðŸ”„ Connecting to database...');
    
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('âœ… Database connected successfully!');
    console.log('ðŸ“Š Database name:', mongoose.connection.name);
    console.log('ðŸŒ Host:', mongoose.connection.host);
    console.log('ðŸ”Œ Port:', mongoose.connection.port);
    
    // Test creating a simple document
    const testSchema = new mongoose.Schema({
      name: String,
      timestamp: { type: Date, default: Date.now }
    });
    
    const TestModel = mongoose.model('Test', testSchema);
    
    const testDoc = new TestModel({
      name: 'Database Connection Test'
    });
    
    await testDoc.save();
    console.log('âœ… Test document saved successfully!');
    
    // Clean up test document
    await TestModel.deleteOne({ name: 'Database Connection Test' });
    console.log('ðŸ§¹ Test document cleaned up');
    
    await mongoose.disconnect();
    console.log('ðŸ”Œ Database disconnected');
    
  } catch (error) {
    console.error('âŒ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
```

### 5.3 Run the Test
```bash
node test-db-connection.js
```

**Expected Output:**
```
ðŸ”„ Connecting to database...
âœ… Database connected successfully!
ðŸ“Š Database name: smartwaste
ðŸŒ Host: smart-waste-cluster-shard-00-00.xxxxx.mongodb.net
ðŸ”Œ Port: 27017
âœ… Test document saved successfully!
ðŸ§¹ Test document cleaned up
ðŸ”Œ Database disconnected
```

## ðŸš€ Step 6: Start Your Application with Database

### 6.1 Start the Backend
```bash
cd backend
npm run dev
```

**Expected Output:**
```
ðŸš€ Server running on port 3000
ðŸ“Š Environment: development
ðŸ”— Health check: http://localhost:3000/health
âœ… Connected to MongoDB successfully
```

### 6.2 Test Database Integration
```bash
# Test health endpoint
curl http://localhost:3000/health

# Test API endpoints that use database
curl http://localhost:3000/api/bins
curl http://localhost:3000/api/analytics/metrics
```

## ðŸ“Š Step 7: View Your Data in MongoDB Atlas

### 7.1 Access MongoDB Atlas Dashboard
1. Go back to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click on your cluster
3. Click "Browse Collections"

### 7.2 View Your Data
You should see:
- `smartwaste` database
- Collections like `users`, `bins`, `collections`, etc.
- Sample data from your application

## ðŸ”§ Step 8: Database Schema Overview

Your Smart Waste Management system will create these collections:

### 8.1 Users Collection
```javascript
{
  _id: ObjectId,
  email: "admin@municipality.com",
  password: "hashed_password",
  role: "admin",
  firstName: "John",
  lastName: "Doe",
  createdAt: Date,
  updatedAt: Date
}
```

### 8.2 Bins Collection
```javascript
{
  _id: ObjectId,
  binId: "BIN001",
  location: {
    latitude: 40.7128,
    longitude: -74.0060,
    address: "123 Main St"
  },
  capacity: 100,
  currentLevel: 45,
  status: "active",
  lastUpdated: Date
}
```

### 8.3 Collections Collection
```javascript
{
  _id: ObjectId,
  binId: "BIN001",
  collectorId: "COLLECTOR001",
  scheduledDate: Date,
  actualDate: Date,
  status: "completed",
  weight: 25.5,
  notes: "Regular collection"
}
```

## ðŸ› ï¸ Step 9: Troubleshooting Common Issues

### 9.1 Connection String Issues
**Problem:** "Authentication failed"
**Solution:** 
- Check your username and password
- Make sure you replaced `<password>` in the connection string
- Verify the database user exists in MongoDB Atlas

### 9.2 Network Access Issues
**Problem:** "Connection timeout"
**Solution:**
- Go to MongoDB Atlas â†’ Network Access
- Add your current IP address
- Or use "Allow Access from Anywhere" (0.0.0.0/0) for development

### 9.3 Database Name Issues
**Problem:** "Database not found"
**Solution:**
- Make sure your connection string includes the database name
- Example: `...mongodb.net/smartwaste?...`

### 9.4 Environment File Issues
**Problem:** "MONGODB_URI is not defined"
**Solution:**
- Make sure your `.env` file is in the `backend` folder
- Check that the file is named exactly `.env` (not `.env.txt`)
- Restart your application after creating the `.env` file

## ðŸ“± Step 10: Mobile App Database Connection

### 10.1 Configure Mobile App
The mobile app connects to your backend API, which then connects to the database. No direct database connection needed for the mobile app.

### 10.2 API Endpoints
Your mobile app will use these endpoints:
- `POST /api/auth/login` - User login
- `GET /api/bins` - Get bin data
- `POST /api/collections` - Submit collection data
- `GET /api/routes` - Get collection routes

## ðŸ”’ Step 11: Security Best Practices

### 11.1 Environment Variables
- Never commit `.env` files to version control
- Use strong passwords for database users
- Rotate passwords regularly

### 11.2 Database Security
- Use MongoDB Atlas built-in security features
- Enable database encryption
- Set up proper user roles and permissions

## ðŸ“ˆ Step 12: Monitoring Your Database

### 12.1 MongoDB Atlas Monitoring
1. Go to your cluster in MongoDB Atlas
2. Click "Metrics" tab
3. Monitor:
   - Connection count
   - Query performance
   - Storage usage
   - Index usage

### 12.2 Application Monitoring
```bash
# Check database connection in your app
curl http://localhost:3000/health

# Monitor logs
# Check your terminal where you ran `npm run dev`
```

## ðŸŽ‰ Success Checklist

Your database is properly connected when:

- [ ] MongoDB Atlas account created
- [ ] Database cluster created
- [ ] Database user created
- [ ] Network access configured
- [ ] Connection string obtained
- [ ] `.env` file created with correct settings
- [ ] Test connection successful
- [ ] Application starts without database errors
- [ ] Health endpoint returns database status
- [ ] Data appears in MongoDB Atlas dashboard

## ðŸ†˜ Need Help?

### Common Resources:
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [Node.js MongoDB Tutorial](https://www.mongodb.com/developer/languages/javascript/node-crud-tutorial/)

### Support Channels:
- MongoDB Community Forums
- Stack Overflow (tag: mongodb, node.js)
- Your project's GitHub issues

---

**ðŸŽŠ Congratulations!** You now have a fully functional database connected to your Smart Waste Management system. Your application can now store and retrieve data from the cloud database.







































