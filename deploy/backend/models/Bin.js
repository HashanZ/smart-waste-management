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
exports.Bin = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const binSchema = new mongoose_1.Schema({
    binId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['general', 'recyclable', 'organic', 'hazardous'],
        required: false,
    },
    binType: {
        type: String,
        enum: ['general', 'recyclable', 'organic', 'hazardous'],
        required: true,
    },
    location: {
        coordinates: {
            type: [Number],
            required: false,
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
            required: false,
        },
    },
    capacity: {
        type: Number,
        required: true,
        min: 1,
    },
    currentLevel: {
        type: Number,
        required: true,
        min: 0,
        max: 100,
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
        default: 24,
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
binSchema.index({ binType: 1 });
binSchema.index({ status: 1 });
binSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
binSchema.index({ isOverflowing: 1 });
binSchema.index({ nextCollection: 1 });
binSchema.virtual('fillPercentage').get(function () {
    return (this.currentLevel / this.capacity) * 100;
});
binSchema.methods['needsCollection'] = function () {
    const now = new Date();
    const lastEmptied = this['lastEmptied'] || this['createdAt'];
    const hoursSinceLastEmpty = (now.getTime() - lastEmptied.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastEmpty >= this['collectionFrequency'] || this['currentLevel'] >= 90;
};
binSchema.methods['addAlert'] = function (type, message) {
    this['alerts'].push({
        type,
        message,
        timestamp: new Date(),
        resolved: false,
    });
};
exports.Bin = mongoose_1.default.model('Bin', binSchema);
//# sourceMappingURL=Bin.js.map