import mongoose, { Document, Schema } from 'mongoose';

export interface IPrediction extends Document {
  _id: string;
  binId: string;
  horizonHours: number;
  predictedLevel: number; // 0-100
  timeToFullHours?: number | null;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedCollectionTime?: Date | null;
  confidence?: number;
  factors?: string[];
  source: 'ml-service' | 'fallback';
  createdAt: Date;
}

const predictionSchema = new Schema<IPrediction>({
  binId: { type: String, required: true, index: true },
  horizonHours: { type: Number, required: true, min: 1, max: 24 * 7 },
  predictedLevel: { type: Number, required: true, min: 0, max: 100 },
  timeToFullHours: { type: Number, min: 0 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  recommendedCollectionTime: { type: Date },
  confidence: { type: Number, min: 0, max: 1 },
  factors: [{ type: String }],
  source: { type: String, enum: ['ml-service', 'fallback'], default: 'ml-service', index: true },
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

predictionSchema.index({ binId: 1, createdAt: -1 });

export const Prediction = mongoose.model<IPrediction>('Prediction', predictionSchema);









