import mongoose, { Document, Schema } from 'mongoose';

export interface ICollection extends Document {
  _id: string;
  collectionId: string;
  binId: string;
  bin: {
    binId: string;
    binType: string;
    location: {
      latitude: number;
      longitude: number;
      address?: string;
    };
  };
  collectorId: string;
  collector: {
    firstName: string;
    lastName: string;
    email: string;
  };
  scheduledDate: Date;
  actualDate?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'missed';
  wasteType: 'general' | 'recyclable' | 'organic' | 'hazardous';
  weight?: number;
  volume?: number;
  notes?: string;
  images?: string[];
  routeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const collectionSchema = new Schema<ICollection>({
  collectionId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  binId: {
    type: String,
    required: true,
    ref: 'Bin',
  },
  bin: {
    binId: {
      type: String,
      required: true,
    },
    binType: {
      type: String,
      required: true,
    },
    location: {
      latitude: {
        type: Number,
        required: true,
      },
      longitude: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
      },
    },
  },
  collectorId: {
    type: String,
    required: true,
    ref: 'User',
  },
  collector: {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  actualDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'missed'],
    default: 'scheduled',
  },
  wasteType: {
    type: String,
    enum: ['general', 'recyclable', 'organic', 'hazardous'],
    required: true,
  },
  weight: {
    type: Number,
    min: 0,
  },
  volume: {
    type: Number,
    min: 0,
  },
  notes: {
    type: String,
    trim: true,
  },
  images: [{
    type: String,
  }],
  routeId: {
    type: String,
    ref: 'Route',
  },
}, {
  timestamps: true,
});

// Indexes for better query performance
// Note: collectionId already has unique index from schema definition
collectionSchema.index({ binId: 1 });
collectionSchema.index({ collectorId: 1 });
collectionSchema.index({ status: 1 });
collectionSchema.index({ scheduledDate: 1 });
collectionSchema.index({ wasteType: 1 });
collectionSchema.index({ routeId: 1 });

// Virtual for duration
collectionSchema.virtual('duration').get(function() {
  if (this.actualDate && this.scheduledDate) {
    return this.actualDate.getTime() - this.scheduledDate.getTime();
  }
  return null;
});

// Method to mark as completed
collectionSchema.methods['markCompleted'] = function(weight?: number, volume?: number, notes?: string) {
  this['status'] = 'completed';
  this['actualDate'] = new Date();
  if (weight) this['weight'] = weight;
  if (volume) this['volume'] = volume;
  if (notes) this['notes'] = notes;
};

// Method to mark as in progress
collectionSchema.methods['markInProgress'] = function() {
  this['status'] = 'in_progress';
};

// Method to cancel collection
collectionSchema.methods['cancel'] = function(reason?: string) {
  this['status'] = 'cancelled';
  if (reason) this['notes'] = reason;
};

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema);
