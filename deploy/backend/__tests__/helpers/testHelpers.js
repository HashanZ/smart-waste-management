"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockNext = exports.mockResponse = exports.mockRequest = exports.clearDatabase = exports.createTestCollection = exports.createTestRoute = exports.createTestBin = exports.createTestUser = exports.generateExpiredToken = exports.generateTestToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../../config/config");
const User_1 = require("../../models/User");
const Bin_1 = require("../../models/Bin");
const Route_1 = require("../../models/Route");
const Collection_1 = require("../../models/Collection");
const generateTestToken = (userId, role = "admin") => {
    return jsonwebtoken_1.default.sign({ id: userId, role, email: "test@example.com" }, config_1.config.jwt.secret, { expiresIn: "1h" });
};
exports.generateTestToken = generateTestToken;
const generateExpiredToken = (userId) => {
    return jsonwebtoken_1.default.sign({ id: userId, role: "admin", email: "test@example.com" }, config_1.config.jwt.secret, { expiresIn: "-1h" });
};
exports.generateExpiredToken = generateExpiredToken;
const createTestUser = async (overrides = {}) => {
    const defaultUser = {
        email: `test-${Date.now()}@example.com`,
        password: "Test123!@#",
        firstName: "Test",
        lastName: "User",
        role: "admin",
        phoneNumber: "+1234567890",
        isActive: true,
    };
    const user = await User_1.User.create({ ...defaultUser, ...overrides });
    return user;
};
exports.createTestUser = createTestUser;
const createTestBin = async (overrides = {}) => {
    const defaultBin = {
        binId: `BIN-TEST-${Date.now()}`,
        binType: "general",
        capacity: 100,
        currentLevel: 50,
        location: {
            latitude: 6.9271,
            longitude: 79.8612,
            address: "Test Location, Colombo",
        },
        status: "active",
        metadata: {
            installationDate: new Date(),
            batteryLevel: 80,
            signalStrength: 90,
        },
    };
    const bin = await Bin_1.Bin.create({ ...defaultBin, ...overrides });
    return bin;
};
exports.createTestBin = createTestBin;
const createTestRoute = async (overrides = {}) => {
    const defaultRoute = {
        routeId: `ROUTE-TEST-${Date.now()}`,
        name: "Test Route",
        collectorId: "test-collector-id",
        bins: [],
        status: "draft",
        priority: "medium",
        scheduledDate: new Date(),
    };
    const route = await Route_1.Route.create({ ...defaultRoute, ...overrides });
    return route;
};
exports.createTestRoute = createTestRoute;
const createTestCollection = async (overrides = {}) => {
    const defaultCollection = {
        collectionId: `COL-TEST-${Date.now()}`,
        binId: "test-bin-id",
        bin: {
            binId: "BIN-TEST-001",
            binType: "general",
            location: {
                latitude: 6.9271,
                longitude: 79.8612,
                address: "Test Location",
            },
        },
        collectorId: "test-collector-id",
        collector: {
            firstName: "Test",
            lastName: "Collector",
            email: "collector@example.com",
        },
        scheduledDate: new Date(),
        status: "scheduled",
        wasteType: "general",
    };
    const collection = await Collection_1.Collection.create({
        ...defaultCollection,
        ...overrides,
    });
    return collection;
};
exports.createTestCollection = createTestCollection;
const clearDatabase = async () => {
    const collections = mongoose_1.default.connection.collections;
    for (const key in collections) {
        await collections[key]?.deleteMany({});
    }
};
exports.clearDatabase = clearDatabase;
const mockRequest = (overrides = {}) => {
    return {
        body: {},
        params: {},
        query: {},
        headers: {},
        user: null,
        ...overrides,
    };
};
exports.mockRequest = mockRequest;
const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};
exports.mockResponse = mockResponse;
exports.mockNext = jest.fn();
//# sourceMappingURL=testHelpers.js.map