import { Request, Response } from "express";
import mongoose from "mongoose";
import { CollectionController } from "@/controllers/collectionController";
import { Collection } from "@/models/Collection";
import {
  createTestCollection,
  createTestBin,
  createTestUser,
  mockRequest,
  mockResponse,
} from "../helpers/testHelpers";

describe("CollectionController", () => {
  describe("getCollections", () => {
    it("should return paginated list of collections", async () => {
      await createTestCollection({ status: "completed" });
      await createTestCollection({ status: "scheduled" });
      await createTestCollection({ status: "in_progress" });

      const req = mockRequest({
        query: { page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollections(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(3);
      expect(response.pagination.total).toBe(3);
    });

    it("should filter collections by status", async () => {
      await createTestCollection({ status: "completed" });
      await createTestCollection({ status: "scheduled" });
      await createTestCollection({ status: "completed" });

      const req = mockRequest({
        query: { status: "completed", page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollections(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(2);
      expect(
        response.data.every(
          (c: { status: string }) => c.status === "completed",
        ),
      ).toBe(true);
    });

    it("should filter collections by collector", async () => {
      const collector = await createTestUser({ role: "collector" });

      await createTestCollection({ collectorId: collector._id.toString() });
      await createTestCollection({ collectorId: "other-collector" });

      const req = mockRequest({
        query: {
          collectorId: collector._id.toString(),
          page: "1",
          limit: "10",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollections(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(1);
      expect(response.data[0].collectorId).toBe(collector._id.toString());
    });
  });

  describe("getCollectionById", () => {
    it("should return collection by ID", async () => {
      const collection = await createTestCollection();

      const req = mockRequest({
        params: { id: collection._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollectionById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.collectionId).toBe(collection.collectionId);
    });

    it("should return 404 for non-existent collection", async () => {
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollectionById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("createCollection", () => {
    it("should create a new collection successfully", async () => {
      const bin = await createTestBin();
      const collector = await createTestUser({ role: "collector" });

      const req = mockRequest({
        body: {
          binId: bin._id.toString(),
          collectorId: collector._id.toString(),
          scheduledDate: new Date().toISOString(),
          status: "scheduled",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.createCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Collection created successfully",
        }),
      );
    });

    it("should reject collection with non-existent bin", async () => {
      const collector = await createTestUser({ role: "collector" });

      const req = mockRequest({
        body: {
          binId: new mongoose.Types.ObjectId().toString(),
          collectorId: collector._id.toString(),
          scheduledDate: new Date().toISOString(),
          status: "scheduled",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.createCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("updateCollection", () => {
    it("should update collection successfully", async () => {
      const collection = await createTestCollection({ status: "scheduled" });

      const req = mockRequest({
        params: { id: collection._id.toString() },
        body: {
          status: "in_progress",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.updateCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify update in database
      const updatedCollection = await Collection.findById(collection._id);
      expect(updatedCollection?.status).toBe("in_progress");
    });

    it("should return 404 for non-existent collection", async () => {
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { status: "completed" },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.updateCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteCollection", () => {
    it("should delete collection successfully", async () => {
      const collection = await createTestCollection();

      const req = mockRequest({
        params: { id: collection._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.deleteCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify deletion
      const deletedCollection = await Collection.findById(collection._id);
      expect(deletedCollection).toBeNull();
    });

    it("should return 404 for non-existent collection", async () => {
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.deleteCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("completeCollection", () => {
    it("should complete collection successfully", async () => {
      const bin = await createTestBin({ currentLevel: 80 });
      const collection = await createTestCollection({
        binId: bin._id.toString(),
        status: "in_progress",
      });

      const req = mockRequest({
        params: { id: collection._id.toString() },
        body: {
          weight: 50,
          notes: "Collection completed",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.completeCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify collection status and bin reset
      const updatedCollection = await Collection.findById(collection._id);
      expect(updatedCollection?.status).toBe("completed");
      expect(updatedCollection?.actualDate).toBeTruthy();
    });

    it("should return 404 for non-existent collection", async () => {
      const req = mockRequest({
        params: { id: new mongoose.Types.ObjectId().toString() },
        body: { weight: 50 },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.completeCollection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("getCollectionHistory", () => {
    it("should return collection history for a bin", async () => {
      const bin = await createTestBin();

      await createTestCollection({
        binId: bin._id.toString(),
        status: "completed",
      });
      await createTestCollection({
        binId: bin._id.toString(),
        status: "completed",
      });

      const req = mockRequest({
        params: { binId: bin._id.toString() },
        query: { page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollectionHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(2);
    });

    it("should return empty array for bin with no history", async () => {
      const bin = await createTestBin();

      const req = mockRequest({
        params: { binId: bin._id.toString() },
        query: { page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await CollectionController.getCollectionHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(0);
    });
  });
});
