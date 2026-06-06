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
exports.Collection = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const collectionSchema = new mongoose_1.Schema({
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
collectionSchema.index({ binId: 1 });
collectionSchema.index({ collectorId: 1 });
collectionSchema.index({ status: 1 });
collectionSchema.index({ scheduledDate: 1 });
collectionSchema.index({ wasteType: 1 });
collectionSchema.index({ routeId: 1 });
collectionSchema.virtual('duration').get(function () {
    if (this.actualDate && this.scheduledDate) {
        return this.actualDate.getTime() - this.scheduledDate.getTime();
    }
    return null;
});
collectionSchema.methods['markCompleted'] = function (weight, volume, notes) {
    this['status'] = 'completed';
    this['actualDate'] = new Date();
    if (weight)
        this['weight'] = weight;
    if (volume)
        this['volume'] = volume;
    if (notes)
        this['notes'] = notes;
};
collectionSchema.methods['markInProgress'] = function () {
    this['status'] = 'in_progress';
};
collectionSchema.methods['cancel'] = function (reason) {
    this['status'] = 'cancelled';
    if (reason)
        this['notes'] = reason;
};
exports.Collection = mongoose_1.default.model('Collection', collectionSchema);
//# sourceMappingURL=Collection.js.map