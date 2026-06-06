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
exports.Route = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const routeSchema = new mongoose_1.Schema({
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    bins: [{
            type: mongoose_1.Schema.Types.ObjectId,
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
            time_windows: { type: mongoose_1.Schema.Types.Mixed },
        },
    },
}, {
    timestamps: true,
});
routeSchema.index({ status: 1, scheduledDate: -1 });
routeSchema.index({ collectorId: 1, status: 1 });
routeSchema.index({ priority: 1, status: 1 });
routeSchema.index({ scheduledDate: 1, status: 1 });
routeSchema.virtual('duration').get(function () {
    if (this.actualDuration) {
        return this.actualDuration;
    }
    if (this.actualStartTime && this.actualEndTime) {
        return Math.round((this.actualEndTime.getTime() - this.actualStartTime.getTime()) / 60000);
    }
    return this.estimatedDuration || 0;
});
routeSchema.virtual('completionPercentage').get(function () {
    if (this.bins.length === 0)
        return 0;
    const visitedCount = this.binsVisited.filter(v => !v.skipped).length;
    return Math.round((visitedCount / this.bins.length) * 100);
});
routeSchema.methods['isOverdue'] = function () {
    return this['status'] === 'active' && new Date() > this['scheduledDate'];
};
routeSchema.methods['visitBin'] = function (binId, data) {
    const existing = this['binsVisited'].find((v) => v.binId === binId);
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
routeSchema.methods['skipBin'] = function (binId, reason) {
    const existing = this['binsVisited'].find((v) => v.binId === binId);
    if (!existing) {
        this['binsVisited'].push({
            binId,
            visitedAt: new Date(),
            skipped: true,
            skipReason: reason,
        });
    }
};
routeSchema.set('toJSON', {
    virtuals: true,
    transform: function (_doc, ret) {
        delete ret.__v;
        return ret;
    }
});
exports.Route = mongoose_1.default.model('Route', routeSchema);
//# sourceMappingURL=Route.js.map