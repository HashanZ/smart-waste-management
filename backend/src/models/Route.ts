import mongoose, { Document, Schema } from 'mongoose';

export interface IRoute extends Document {
  _id: string;
  routeId: string;
  name: string;
  description?: string;
  collectorId: mongoose.Types.ObjectId | string;
  bins: (mongoose.Types.ObjectId | string)[]; // Array of bin IDs
  status: 'draft' | 'scheduled' | 'active' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduledDate: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  totalDistance?: number; // in kilometers
  estimatedDuration?: number; // in minutes
  actualDuration?: number; // in minutes
  binsVisited: Array<{
    binId: string;
    visitedAt: Date;
    skipped: boolean;
    skipReason?: string;
    photoUrl?: string;
    notes?: string;
  }>;
  optimizationData?: {
    efficiency: number;
    fuelEstimate?: number;
    route: string[];
    routeDetails?: Array<{
      order: number;
      bin_id: string;
      bin_type: string;
      location: { latitude: number; longitude: number };
      waste_level: number;
      estimated_arrival: string;
    }>;
    parameters?: {
      traffic_multiplier?: number;
      time_windows?: Record<string, { start?: number; end?: number }>;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  // Methods
  isOverdue(): boolean;
  visitBin(binId: string, data?: { photoUrl?: string; notes?: string }): void;
  skipBin(binId: string, reason: string): void;
}

const routeSchema = new Schema<IRoute>({
  routeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true,
  },
  collectorId: {
    type: Schema.Types.Mixed,   // Accepts ObjectId or plain string collector name
    ref: 'User',
    index: true,
  },
  bins: [{
    type: Schema.Types.ObjectId,
    ref: 'Bin',
    required: true,
  }],
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
    default: 'draft',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
    index: true,
  },
  scheduledDate: {
    type: Date,
    required: true,
    index: true,
  },
  actualStartTime: {
    type: Date,
  },
  actualEndTime: {
    type: Date,
  },
  totalDistance: {
    type: Number,
    min: 0,
  },
  estimatedDuration: {
    type: Number,
    min: 0,
  },
  actualDuration: {
    type: Number,
    min: 0,
  },
  binsVisited: [{
    binId: {
      type: String,
      required: true,
    },
    visitedAt: {
      type: Date,
      default: Date.now,
    },
    skipped: {
      type: Boolean,
      default: false,
    },
    skipReason: {
      type: String,
      maxlength: 200,
    },
    photoUrl: {
      type: String,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  }],
  optimizationData: {
    efficiency: {
      type: Number,
      min: 0,
      max: 1,
    },
    fuelEstimate: {
      type: Number,
      min: 0,
    },
    route: [{
      type: String,
    }],
    routeDetails: [{
      order: { type: Number },
      bin_id: { type: String },
      bin_type: { type: String },
      location: {
        latitude: { type: Number },
        longitude: { type: Number },
      },
      waste_level: { type: Number },
      estimated_arrival: { type: String },
    }],
    parameters: {
      traffic_multiplier: { type: Number },
      time_windows: { type: Schema.Types.Mixed },
    },
  },
}, {
  timestamps: true,
});

// Indexes for performance
// Note: routeId already has unique index from schema definition
routeSchema.index({ status: 1, scheduledDate: -1 });
routeSchema.index({ collectorId: 1, status: 1 });
routeSchema.index({ priority: 1, status: 1 });
routeSchema.index({ scheduledDate: 1, status: 1 });

// Virtual for duration calculation
routeSchema.virtual('duration').get(function() {
  if (this.actualDuration) {
    return this.actualDuration;
  }
  if (this.actualStartTime && this.actualEndTime) {
    return Math.round((this.actualEndTime.getTime() - this.actualStartTime.getTime()) / 60000);
  }
  return this.estimatedDuration || 0;
});

// Virtual for completion percentage
routeSchema.virtual('completionPercentage').get(function() {
  if (this.bins.length === 0) return 0;
  const visitedCount = this.binsVisited.filter(v => !v.skipped).length;
  return Math.round((visitedCount / this.bins.length) * 100);
});

// Method to check if route is overdue
routeSchema.methods['isOverdue'] = function(): boolean {
  return this['status'] === 'active' && new Date() > this['scheduledDate'];
};

// Method to mark bin as visited
routeSchema.methods['visitBin'] = function(binId: string, data?: { photoUrl?: string; notes?: string }): void {
  const existing = this['binsVisited'].find((v: any) => v.binId === binId);
  if (!existing) {
    this['binsVisited'].push({
      binId,
      visitedAt: new Date(),
      skipped: false,
      photoUrl: data?.photoUrl,
      notes: data?.notes,
    });
  }
};

// Method to mark bin as skipped
routeSchema.methods['skipBin'] = function(binId: string, reason: string): void {
  const existing = this['binsVisited'].find((v: any) => v.binId === binId);
  if (!existing) {
    this['binsVisited'].push({
      binId,
      visitedAt: new Date(),
      skipped: true,
      skipReason: reason,
    });
  }
};

// Ensure virtual fields are serialized
routeSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret: any) {
    delete ret.__v;
    return ret;
  }
});

export const Route = mongoose.model<IRoute>('Route', routeSchema);
