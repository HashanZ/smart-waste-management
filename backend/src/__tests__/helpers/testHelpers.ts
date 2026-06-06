import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import type { Request, Response } from "express";
import { config } from "@/config/config";
import { User, IUser } from "@/models/User";
import { Bin, IBin } from "@/models/Bin";
import { Route, IRoute } from "@/models/Route";
import { Collection, ICollection } from "@/models/Collection";

/**
 * Generate a valid JWT token for testing
 */
export const generateTestToken = (
  userId: string,
  role: string = "admin",
): string => {
  return jwt.sign(
    { id: userId, role, email: "test@example.com" },
    config.jwt.secret,
    { expiresIn: "1h" },
  );
};

/**
 * Generate an expired JWT token for testing
 */
export const generateExpiredToken = (userId: string): string => {
  return jwt.sign(
    { id: userId, role: "admin", email: "test@example.com" },
    config.jwt.secret,
    { expiresIn: "-1h" }, // Expired 1 hour ago
  );
};

/**
 * Create a test user in the database
 */
export const createTestUser = async (
  overrides: Partial<IUser> = {},
): Promise<IUser> => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Test123!@#",
    firstName: "Test",
    lastName: "User",
    role: "admin" as const,
    phoneNumber: "+1234567890",
    isActive: true,
  };

  const user = await User.create({ ...defaultUser, ...overrides });
  return user;
};

/**
 * Create a test bin in the database
 */
export const createTestBin = async (
  overrides: Partial<IBin> = {},
): Promise<IBin> => {
  const defaultBin = {
    binId: `BIN-TEST-${Date.now()}`,
    binType: "general" as const,
    capacity: 100,
    currentLevel: 50,
    location: {
      latitude: 6.9271,
      longitude: 79.8612,
      address: "Test Location, Colombo",
    },
    status: "active" as const,
    metadata: {
      installationDate: new Date(),
      batteryLevel: 80,
      signalStrength: 90,
    },
  };

  const bin = await Bin.create({ ...defaultBin, ...overrides });
  return bin;
};

/**
 * Create a test route in the database
 */
export const createTestRoute = async (
  overrides: Partial<IRoute> = {},
): Promise<IRoute> => {
  const defaultRoute = {
    routeId: `ROUTE-TEST-${Date.now()}`,
    name: "Test Route",
    collectorId: "test-collector-id",
    bins: [],
    status: "draft" as const,
    priority: "medium" as const,
    scheduledDate: new Date(),
  };

  const route = await Route.create({ ...defaultRoute, ...overrides });
  return route;
};

/**
 * Create a test collection in the database
 */
export const createTestCollection = async (
  overrides: Partial<ICollection> = {},
): Promise<ICollection> => {
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
    status: "scheduled" as const,
    wasteType: "general" as const,
  };

  const collection = await Collection.create({
    ...defaultCollection,
    ...overrides,
  });
  return collection;
};

/**
 * Clear all test data from the database
 */
export const clearDatabase = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key]?.deleteMany({});
  }
};

/**
 * Mock Express Request object
 */
export type MockRequest<
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
> = Partial<Request<TParams, unknown, TBody, TQuery>> & { user?: unknown };

export const mockRequest = <
  TBody = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>,
>(
  overrides: Partial<Request<TParams, unknown, TBody, TQuery>> & {
    user?: unknown;
  } = {},
): MockRequest<TBody, TParams, TQuery> => {
  return {
    body: {} as TBody,
    params: {} as TParams,
    query: {} as TQuery,
    headers: {},
    user: null,
    ...overrides,
  };
};

/**
 * Mock Express Response object
 */
export type MockResponse<T = unknown> = Partial<Response<T>> & {
  status: jest.MockedFunction<(code: number) => MockResponse<T>>;
  json: jest.MockedFunction<(body?: unknown) => MockResponse<T>>;
  send: jest.MockedFunction<(body?: unknown) => MockResponse<T>>;
};

export const mockResponse = <T = unknown>(): MockResponse<T> => {
  const res = {} as MockResponse<T>;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Mock Express Next function
 */
export const mockNext = jest.fn();
