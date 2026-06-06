import mongoose, { Document, Schema } from 'mongoose';

export interface IBin extends Document {
  _id: string;
  binId: string;
  type?: 'general' | 'recyclable' | 'organic' | 'hazardous'; // For MongoDB validator compatibility
  binType: 'general' | 'recyclable' | 'organic' | 'hazardous';
  location: {
    coordinates?: [number, number]; // GeoJSON format [longitude, latitude] for MongoDB validator
    latitude: number;
    longitude: number;
    address?: string;
  };
  capacity: number;
  currentLevel: number;
  status: 'active' | 'inactive' | 'maintenance' | 'full';
  isOverflowing: boolean;
  lastEmptied?: Date;
  nextCollection?: Date;
  collectionFrequency: number; // in hours
  alerts: Array<{
    type: 'full' | 'overflow' | 'maintenance' | 'offline';
    message: string;
    timestamp: Date;
    resolved: boolean;
  }>;
  metadata: {
    installationDate: Date;
    lastMaintenance?: Date;
    batteryLevel?: number;
    signalStrength?: number;
    lastDataReceived?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const binSchema = new Schema<IBin>({
  binId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['general', 'recyclable', 'organic', 'hazardous'],
    required: false, // For MongoDB validator compatibility
  },
  binType: {
    type: String,
    enum: ['general', 'recyclable', 'organic', 'hazardous'],
    required: true,
  },
  location: {
    coordinates: {
      type: [Number],
      required: false, // For MongoDB validator compatibility - GeoJSON format [longitude, latitude]
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    address: {
      type: String,
      trim: true,
      required: false, // For MongoDB validator compatibility
    },
  },
  capacity: {
    type: Number,
    required: true,
    min: 1, // Capacity must be greater than 0
  },
  currentLevel: {
    type: Number,
    required: true,
    min: 0,
    max: 100, // percentage
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'full'],
    default: 'active',
  },
  isOverflowing: {
    type: Boolean,
    default: false,
  },
  lastEmptied: {
    type: Date,
  },
  nextCollection: {
    type: Date,
  },
  collectionFrequency: {
    type: Number,
    default: 24, // 24 hours
    min: 1,
  },
  alerts: [{
    type: {
      type: String,
      enum: ['full', 'overflow', 'maintenance', 'offline'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  }],
  metadata: {
    installationDate: {
      type: Date,
      default: Date.now,
    },
    lastMaintenance: {
      type: Date,
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
    },
    signalStrength: {
      type: Number,
      min: 0,
      max: 100,
    },
    lastDataReceived: {
      type: Date,
    },
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
// Note: binId already has unique index from schema definition
binSchema.index({ binType: 1 });
binSchema.index({ status: 1 });
binSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
binSchema.index({ isOverflowing: 1 });
binSchema.index({ nextCollection: 1 });

// Virtual for fill percentage
binSchema.virtual('fillPercentage').get(function() {
  return ((this as any).currentLevel / (this as any).capacity) * 100;
});

// Method to check if bin needs collection
binSchema.methods['needsCollection'] = function() {
  const now = new Date();
  const lastEmptied = this['lastEmptied'] || this['createdAt'];
  const hoursSinceLastEmpty = (now.getTime() - lastEmptied.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastEmpty >= this['collectionFrequency'] || this['currentLevel'] >= 90;
};

// Method to add alert
binSchema.methods['addAlert'] = function(type: string, message: string) {
  this['alerts'].push({
    type,
    message,
    timestamp: new Date(),
    resolved: false,
  });
};

export const Bin = mongoose.model<IBin>('Bin', binSchema);
