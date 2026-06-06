import mongoose, { Document, Schema } from 'mongoose';

export interface IPredictionAccuracy extends Document {
  _id: string;
  binId?: string; // Optional: null means aggregate across all bins
  date: Date;
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  sampleCount: number;
  source: 'ml-service' | 'fallback' | 'aggregate';
  createdAt: Date;
}

const predictionAccuracySchema = new Schema<IPredictionAccuracy>({
  binId: { type: String, index: true, default: null },
  date: { type: Date, required: true, index: true },
  mae: { type: Number, required: true },
  rmse: { type: Number, required: true },
  mape: { type: Number, required: true },
  sampleCount: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['ml-service', 'fallback', 'aggregate'], required: true, index: true },
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Index for efficient queries
predictionAccuracySchema.index({ date: -1, source: 1 });
predictionAccuracySchema.index({ binId: 1, date: -1 });

export const PredictionAccuracy = mongoose.model<IPredictionAccuracy>('PredictionAccuracy', predictionAccuracySchema);






