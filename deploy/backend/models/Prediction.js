"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prediction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const predictionSchema = new mongoose_1.Schema({
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
exports.Prediction = mongoose_1.default.model('Prediction', predictionSchema);
//# sourceMappingURL=Prediction.js.map