import { Request, Response } from "express";
import mongoose from "mongoose";
import { BinController } from "@/controllers/binController";
import { Bin } from "@/models/Bin";
import {
  createTestBin,
  mockRequest,
  mockResponse,
} from "../helpers/testHelpers";

describe("BinController", () => {
  beforeEach(async () => {
    // Setup can go here if needed
  });

  describe("getBins", () => {
    it("should return paginated list of bins", async () => {
      // Create test bins
      await createTestBin({ binId: "BIN-001" });
      await createTestBin({ binId: "BIN-002" });
      await createTestBin({ binId: "BIN-003" });

      const req = mockRequest({
        query: { page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBins(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(3);
      expect(response.pagination.total).toBe(3);
    });

    it("should filter bins by status", async () => {
      await createTestBin({ status: "active" });
      await createTestBin({ status: "maintenance" });
      await createTestBin({ status: "active" });

      const req = mockRequest({
        query: { status: "active", page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBins(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(2);
      expect(
        response.data.every(
          (bin: { status: string }) => bin.status === "active",
        ),
      ).toBe(true);
    });

    it("should filter bins by type", async () => {
      await createTestBin({ binType: "general" });
      await createTestBin({ binType: "recyclable" });
      await createTestBin({ binType: "general" });

      const req = mockRequest({
        query: { binType: "general", page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBins(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(2);
      expect(
        response.data.every(
          (bin: { binType: string }) => bin.binType === "general",
        ),
      ).toBe(true);
    });

    it("should filter overflowing bins", async () => {
      await createTestBin({ currentLevel: 95, isOverflowing: true });
      await createTestBin({ currentLevel: 50, isOverflowing: false });
      await createTestBin({ currentLevel: 92, isOverflowing: true });

      const req = mockRequest({
        query: { isOverflowing: "true", page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBins(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(2);
      expect(
        response.data.every(
          (bin: { isOverflowing: boolean }) => bin.isOverflowing === true,
        ),
      ).toBe(true);
    });
  });

  describe("getBinById", () => {
    it("should return bin by ID", async () => {
      const bin = await createTestBin({ binId: "BIN-TEST-001" });

      const req = mockRequest({
        params: { id: bin._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBinById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            binId: "BIN-TEST-001",
          }),
        }),
      );
    });

    it("should return 404 for non-existent bin", async () => {
      const req = mockRequest({
        params: { id: "507f1f77bcf86cd799439011" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBinById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Bin not found",
        }),
      );
    });

    it("should return 500 for invalid bin ID format", async () => {
      const req = mockRequest({
        params: { id: "invalid-id" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.getBinById(req, res);

      // Mongoose CastError returns 500 in current implementation
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("createBin", () => {
    it("should create a new bin successfully", async () => {
      const req = mockRequest({
        body: {
          binId: "BIN-NEW-001",
          binType: "recyclable",
          capacity: 150,
          currentLevel: 0,
          location: {
            latitude: 6.9271,
            longitude: 79.8612,
            address: "Test Address",
          },
          status: "active",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.createBin(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Bin created successfully",
          data: expect.objectContaining({
            binId: "BIN-NEW-001",
            binType: "recyclable",
          }),
        }),
      );

      // Verify bin was created in database
      const bin = await Bin.findOne({ binId: "BIN-NEW-001" });
      expect(bin).toBeTruthy();
      expect(bin?.binType).toBe("recyclable");
    });

    it("should reject duplicate binId", async () => {
      await createTestBin({ binId: "BIN-DUPLICATE" });

      const req = mockRequest({
        body: {
          binId: "BIN-DUPLICATE",
          binType: "general",
          capacity: 100,
          currentLevel: 0,
          location: {
            latitude: 6.9271,
            longitude: 79.8612,
          },
          status: "active",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.createBin(req, res);

      // Current implementation returns 409 for conflict
      expect(res.status).toHaveBeenCalledWith(409);
    });

    it("should reject invalid bin type", async () => {
      const req = mockRequest({
        body: {
          binId: "BIN-INVALID",
          binType: "invalid-type",
          capacity: 100,
          currentLevel: 0,
        },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.createBin(req, res);

      // Mongoose validation error returns 500
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it("should reject negative capacity", async () => {
      const req = mockRequest({
        body: {
          binId: "BIN-NEG",
          binType: "general",
          capacity: -100,
          currentLevel: 0,
        },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.createBin(req, res);

      // Mongoose validation error returns 500
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe("updateBin", () => {
    it("should update bin successfully", async () => {
      const bin = await createTestBin({ capacity: 100 });

      const req = mockRequest({
        params: { id: bin._id.toString() },
        body: {
          capacity: 200,
        },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Bin updated successfully",
        }),
      );

      // Verify updates in database
      const updatedBin = await Bin.findById(bin._id);
      expect(updatedBin?.capacity).toBe(200);
    });

    it("should return 404 for non-existent bin", async () => {
      const req = mockRequest({
        params: { id: "507f1f77bcf86cd799439011" },
        body: { capacity: 200 },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should allow updating binId to unique value", async () => {
      const bin = await createTestBin({ binId: "BIN-ORIGINAL" });

      const req = mockRequest({
        params: { id: bin._id.toString() },
        body: { binId: "BIN-CHANGED" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBin(req, res);

      // Current implementation allows updating binId
      expect(res.status).toHaveBeenCalledWith(200);
      const updatedBin = await Bin.findById(bin._id);
      expect(updatedBin?.binId).toBe("BIN-CHANGED");
    });
  });

  describe("deleteBin", () => {
    it("should delete bin successfully", async () => {
      const bin = await createTestBin();

      const req = mockRequest({
        params: { id: bin._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.deleteBin(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Bin deleted successfully",
        }),
      );

      // Verify bin was deleted from database
      const deletedBin = await Bin.findById(bin._id);
      expect(deletedBin).toBeNull();
    });

    it("should return 404 for non-existent bin", async () => {
      const req = mockRequest({
        params: { id: "507f1f77bcf86cd799439011" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.deleteBin(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("updateBinData", () => {
    it("should update bin data successfully", async () => {
      const bin = await createTestBin({ currentLevel: 50 });

      const req = mockRequest({
        params: { id: bin._id.toString() },
        body: { currentLevel: 75 },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBinData(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify level was updated
      const updatedBin = await Bin.findById(bin._id);
      expect(updatedBin?.currentLevel).toBe(75);
    });

    it("should mark bin as overflowing when level >= 90", async () => {
      const bin = await createTestBin({ currentLevel: 50 });

      const req = mockRequest({
        params: { id: bin._id.toString() },
        body: { currentLevel: 95 },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBinData(req, res);

      const updatedBin = await Bin.findById(bin._id);
      expect(updatedBin?.currentLevel).toBe(95);
      expect(updatedBin?.isOverflowing).toBe(true);
      expect(updatedBin?.alerts.length).toBeGreaterThan(0);
    });

    it("should reset overflow when level < 90", async () => {
      const bin = await createTestBin({
        currentLevel: 95,
        isOverflowing: true,
      });

      const req = mockRequest({
        params: { id: bin._id.toString() },
        body: { currentLevel: 50 },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBinData(req, res);

      const updatedBin = await Bin.findById(bin._id);
      expect(updatedBin?.currentLevel).toBe(50);
      expect(updatedBin?.isOverflowing).toBe(false);
    });

    it("should return 404 for non-existent bin", async () => {
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { currentLevel: 75 },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.updateBinData(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("scheduleMaintenance", () => {
    it("should schedule maintenance for a bin", async () => {
      const bin = await createTestBin();

      const req = mockRequest({
        params: { id: bin._id.toString() },
        body: { notes: "Needs repair" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.scheduleMaintenance(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify maintenance was scheduled
      const updatedBin = await Bin.findById(bin._id);
      expect(updatedBin?.status).toBe("maintenance");
      expect(updatedBin?.alerts.length).toBeGreaterThan(0);
      const alerts = updatedBin?.alerts || [];
      if (alerts.length > 0) {
        expect(alerts[alerts.length - 1]?.type).toBe("maintenance");
      }
    });

    it("should return 404 for non-existent bin", async () => {
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { notes: "Needs repair" },
      }) as Request;
      const res = mockResponse() as Response;

      await BinController.scheduleMaintenance(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
