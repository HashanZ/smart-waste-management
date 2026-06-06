// Initialize Smart Waste Management Database
db = db.getSiblingDB('smartwaste');

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        password: {
          bsonType: 'string',
          minLength: 6
        },
        role: {
          bsonType: 'string',
          enum: ['admin', 'operator', 'driver', 'citizen']
        }
      }
    }
  }
});

db.createCollection('bins', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['binId', 'location', 'type', 'status'],
      properties: {
        binId: {
          bsonType: 'string'
        },
        location: {
          bsonType: 'object',
          required: ['coordinates', 'address'],
          properties: {
            coordinates: {
              bsonType: 'array',
              items: {
                bsonType: 'double'
              },
              minItems: 2,
              maxItems: 2
            },
            address: {
              bsonType: 'string'
            }
          }
        },
        type: {
          bsonType: 'string',
          enum: ['general', 'recyclable', 'organic', 'hazardous']
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'inactive', 'maintenance', 'full']
        }
      }
    }
  }
});

db.createCollection('collections', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['binId', 'driverId', 'collectionDate', 'status'],
      properties: {
        binId: {
          bsonType: 'string'
        },
        driverId: {
          bsonType: 'string'
        },
        collectionDate: {
          bsonType: 'date'
        },
        status: {
          bsonType: 'string',
          enum: ['scheduled', 'in_progress', 'completed', 'cancelled']
        }
      }
    }
  }
});

db.createCollection('routes', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['routeId', 'driverId', 'bins', 'status'],
      properties: {
        routeId: {
          bsonType: 'string'
        },
        driverId: {
          bsonType: 'string'
        },
        bins: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          }
        },
        status: {
          bsonType: 'string',
          enum: ['planned', 'active', 'completed', 'cancelled']
        }
      }
    }
  }
});

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

db.bins.createIndex({ binId: 1 }, { unique: true });
db.bins.createIndex({ 'location.coordinates': '2dsphere' });
db.bins.createIndex({ status: 1 });
db.bins.createIndex({ type: 1 });

db.collections.createIndex({ binId: 1 });
db.collections.createIndex({ driverId: 1 });
db.collections.createIndex({ collectionDate: 1 });
db.collections.createIndex({ status: 1 });

db.routes.createIndex({ routeId: 1 }, { unique: true });
db.routes.createIndex({ driverId: 1 });
db.routes.createIndex({ status: 1 });

// Insert initial admin user (password: admin123)
db.users.insertOne({
  email: 'admin@smartwaste.com',
  password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // admin123
  role: 'admin',
  firstName: 'System',
  lastName: 'Administrator',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

print('Smart Waste Management database initialized successfully!');





































