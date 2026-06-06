/**
 * AWS Lambda Function: Process Smart Waste Bin Data
 *
 * Receives HTTP POST from API Gateway, validates data, and updates MongoDB
 *
 * Environment Variables Required:
 * - MONGODB_URI: MongoDB connection string
 * - DB_NAME: Database name (default: 'smartwaste')
 */

const { MongoClient } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'smartwaste';
const COLLECTION_NAME = 'bins';

// Connection pool (reuse connection across invocations)
let cachedClient = null;

/**
 * Connect to MongoDB (reuse connection if available)
 */
async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  try {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    cachedClient = client;
    console.log('Connected to MongoDB');
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

/**
 * Lambda handler function
 */
exports.handler = async (event) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body (API Gateway passes it as string when using proxy integration)
    let data;
    if (typeof event.body === 'string') {
      data = JSON.parse(event.body);
    } else {
      data = event.body || event;
    }

    // Validate required fields
    if (!data.binId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'binId is required'
        })
      };
    }

    if (typeof data.fillLevel !== 'number') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'fillLevel is required and must be a number'
        })
      };
    }

    // Validate fill level range
    if (data.fillLevel < 0 || data.fillLevel > 100) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'fillLevel must be between 0 and 100'
        })
      };
    }

    // Validate location coordinates if provided
    if (data.latitude !== undefined && (data.latitude < -90 || data.latitude > 90)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'latitude must be between -90 and 90'
        })
      };
    }

    if (data.longitude !== undefined && (data.longitude < -180 || data.longitude > 180)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: 'longitude must be between -180 and 180'
        })
      };
    }

    // Connect to MongoDB
    const client = await connectToDatabase();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Build update object
    const updateFields = {
      currentLevel: data.fillLevel,
      'metadata.batteryLevel': data.batteryLevel || null,
      'metadata.signalStrength': data.signalStrength || null,
      'metadata.lastDataReceived': new Date(),
      updatedAt: new Date()
    };

    // Add location update if coordinates are provided
    if (data.latitude !== undefined && data.longitude !== undefined) {
      console.log(`📍 Location coordinates received: lat=${data.latitude}, lng=${data.longitude}`);
      updateFields['location.latitude'] = data.latitude;
      updateFields['location.longitude'] = data.longitude;
      // Also update GeoJSON coordinates array [longitude, latitude]
      updateFields['location.coordinates'] = [data.longitude, data.latitude];
      console.log('✅ Location will be updated in database');
    } else {
      console.log('⚠️ No location coordinates in payload (latitude or longitude missing)');
    }

    // Update bin in database
    const updateResult = await collection.findOneAndUpdate(
      { binId: data.binId },
      {
        $set: updateFields
      },
      {
        upsert: false, // Don't create if doesn't exist
        returnDocument: 'after'
      }
    );

    // Debug: Log the update result structure
    console.log('Update result:', JSON.stringify(updateResult, null, 2));

    // Check if updateResult is null or if value is null
    // MongoDB driver v6 returns { value: document, ok: 1 } or null
    if (!updateResult) {
      console.warn(`Bin ${data.binId} not found in database - updateResult is null`);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: `Bin ${data.binId} not found in database. Please create the bin first.`
        })
      };
    }

    // Handle different MongoDB driver response structures
    const bin = updateResult.value || updateResult;

    if (!bin) {
      console.warn(`Bin ${data.binId} not found in database - bin is null`);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: false,
          error: `Bin ${data.binId} not found in database. Please create the bin first.`
        })
      };
    }

    // Check for overflow/full conditions
    let alertCreated = false;
    if (data.fillLevel >= 100) {
      console.warn(`Bin ${data.binId} is overflowing!`);
      alertCreated = true;
    } else if (data.fillLevel >= 90) {
      console.warn(`Bin ${data.binId} is full!`);
      alertCreated = true;
    }

    // Return success response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        binId: data.binId,
        currentLevel: data.fillLevel,
        alertCreated: alertCreated,
        message: 'Bin data updated successfully'
      })
    };

  } catch (error) {
    console.error('Error processing bin data:', error);

    // Return error response
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
    };
  }
};


