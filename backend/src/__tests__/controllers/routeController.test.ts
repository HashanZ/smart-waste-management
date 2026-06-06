import { Request, Response } from "express";
import { RouteController } from "@/controllers/routeController";
import { Route } from "@/models/Route";
import type { IUser } from "@/models/User";
import type { IBin } from "@/models/Bin";
import {
  createTestRoute,
  createTestBin,
  createTestUser,
  mockRequest,
  mockResponse,
} from "../helpers/testHelpers";

describe("RouteController", () => {
  let collector: IUser;
  let bin1: IBin;
  let bin2: IBin;

  beforeEach(async () => {
    collector = await createTestUser({ role: "collector" });
    bin1 = await createTestBin({ binId: "BIN-001", currentLevel: 85 });
    bin2 = await createTestBin({ binId: "BIN-002", currentLevel: 75 });
  });

  describe("getRoutes", () => {
    it("should return paginated list of routes", async () => {
      await createTestRoute({ name: "Route 1" });
      await createTestRoute({ name: "Route 2" });
      await createTestRoute({ name: "Route 3" });

      const req = mockRequest({
        query: { page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.getRoutes(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(3);
      expect(response.pagination.total).toBe(3);
    });

    it("should filter routes by status", async () => {
      await createTestRoute({ status: "active" });
      await createTestRoute({ status: "draft" });
      await createTestRoute({ status: "active" });

      const req = mockRequest({
        query: { status: "active", page: "1", limit: "10" },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.getRoutes(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(2);
      expect(
        response.data.every((r: { status: string }) => r.status === "active"),
      ).toBe(true);
    });

    it("should filter routes by collector", async () => {
      await createTestRoute({ collectorId: collector._id.toString() });
      await createTestRoute({ collectorId: "other-collector" });

      const req = mockRequest({
        query: {
          collectorId: collector._id.toString(),
          page: "1",
          limit: "10",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.getRoutes(req, res);

      const response = (res.json as jest.Mock).mock.calls[0][0];
      expect(response.data).toHaveLength(1);
      expect(response.data[0].collectorId).toBe(collector._id.toString());
    });
  });

  describe("getRouteById", () => {
    it("should return route by ID", async () => {
      const route = await createTestRoute({ name: "Test Route" });

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.getRouteById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            name: "Test Route",
          }),
        }),
      );
    });

    it("should return 404 for non-existent route", async () => {
      const req = mockRequest({
        params: { id: "507f1f77bcf86cd799439011" },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.getRouteById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("createRoute", () => {
    it("should create a new route successfully", async () => {
      const req = mockRequest({
        body: {
          name: "New Route",
          description: "Test route description",
          collectorId: collector._id.toString(),
          bins: [bin1._id.toString(), bin2._id.toString()],
          status: "draft",
          priority: "high",
          scheduledDate: new Date().toISOString(),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.createRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Route created successfully",
          data: expect.objectContaining({
            name: "New Route",
            bins: expect.arrayContaining([
              bin1._id.toString(),
              bin2._id.toString(),
            ]),
          }),
        }),
      );

      // Verify route was created in database
      const route = await Route.findOne({ name: "New Route" });
      expect(route).toBeTruthy();
      expect(route?.bins).toHaveLength(2);
    });

    it("should reject route with invalid bin IDs", async () => {
      const req = mockRequest({
        body: {
          name: "Invalid Route",
          collectorId: collector._id.toString(),
          bins: ["507f1f77bcf86cd799439011"], // Non-existent bin
          status: "draft",
          priority: "medium",
          scheduledDate: new Date().toISOString(),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.createRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should allow route with empty bins array", async () => {
      const req = mockRequest({
        body: {
          name: "Empty Route",
          collectorId: collector._id.toString(),
          bins: [],
          status: "draft",
          priority: "medium",
          scheduledDate: new Date().toISOString(),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.createRoute(req, res);

      // Current implementation allows empty bins array
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe("updateRoute", () => {
    it("should update route successfully", async () => {
      const route = await createTestRoute({
        name: "Old Name",
        priority: "low",
      });

      const req = mockRequest({
        params: { id: route._id.toString() },
        body: {
          name: "Updated Name",
          priority: "high",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.updateRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify updates
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute?.name).toBe("Updated Name");
      expect(updatedRoute?.priority).toBe("high");
    });

    it("should return 404 for non-existent route", async () => {
      const req = mockRequest({
        params: { id: "507f1f77bcf86cd799439011" },
        body: { name: "Updated" },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.updateRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe("deleteRoute", () => {
    it("should delete route successfully", async () => {
      const route = await createTestRoute();

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.deleteRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify deletion
      const deletedRoute = await Route.findById(route._id);
      expect(deletedRoute).toBeNull();
    });

    it("should allow deleting active route", async () => {
      const route = await createTestRoute({ status: "active" });

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.deleteRoute(req, res);

      // Current implementation doesn't prevent deleting active routes
      expect(res.status).toHaveBeenCalledWith(200);

      // Verify deletion
      const deletedRoute = await Route.findById(route._id);
      expect(deletedRoute).toBeNull();
    });
  });

  describe("startRoute", () => {
    it("should start a route successfully", async () => {
      const route = await createTestRoute({ status: "draft" });

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.startRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify status change and start time
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute?.status).toBe("active");
      expect(updatedRoute?.actualStartTime).toBeTruthy();
    });

    it("should not start already active route", async () => {
      const route = await createTestRoute({ status: "active" });

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.startRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("completeRoute", () => {
    it("should complete a route successfully", async () => {
      const route = await createTestRoute({
        status: "active",
        actualStartTime: new Date(Date.now() - 3600000), // 1 hour ago
      });

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.completeRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify completion
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute?.status).toBe("completed");
      expect(updatedRoute?.actualEndTime).toBeTruthy();
      expect(updatedRoute?.actualDuration).toBeGreaterThan(0);
    });

    it("should not complete non-active route", async () => {
      const route = await createTestRoute({ status: "draft" });

      const req = mockRequest({
        params: { id: route._id.toString() },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.completeRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("markBinVisited", () => {
    it("should mark bin as visited successfully", async () => {
      const route = await createTestRoute({
        status: "active",
        bins: [bin1._id.toString()],
      });

      const req = mockRequest({
        params: {
          id: route._id.toString(),
          binId: bin1._id.toString(),
        },
        body: {
          photoUrl: "https://example.com/photo.jpg",
          notes: "Bin collected successfully",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.markBinVisited(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify bin was marked as visited
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute?.binsVisited).toHaveLength(1);
      expect(updatedRoute?.binsVisited[0]?.binId).toBe(bin1._id.toString());
      expect(updatedRoute?.binsVisited[0]?.skipped).toBe(false);
      expect(updatedRoute?.binsVisited[0]?.notes).toBe(
        "Bin collected successfully",
      );
    });

    it("should not mark same bin as visited twice", async () => {
      const route = await createTestRoute({
        status: "active",
        bins: [bin1._id.toString()],
      });

      // Mark first time
      await route.visitBin(bin1._id.toString());
      await route.save();

      const req = mockRequest({
        params: {
          id: route._id.toString(),
          binId: bin1._id.toString(),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.markBinVisited(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("markBinSkipped", () => {
    it("should mark bin as skipped successfully", async () => {
      const route = await createTestRoute({
        status: "active",
        bins: [bin1._id.toString()],
      });

      const req = mockRequest({
        params: {
          id: route._id.toString(),
          binId: bin1._id.toString(),
        },
        body: {
          reason: "Access blocked by vehicle",
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.markBinSkipped(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      // Verify bin was marked as skipped
      const updatedRoute = await Route.findById(route._id);
      expect(updatedRoute?.binsVisited).toHaveLength(1);
      expect(updatedRoute?.binsVisited[0]?.binId).toBe(bin1._id.toString());
      expect(updatedRoute?.binsVisited[0]?.skipped).toBe(true);
      expect(updatedRoute?.binsVisited[0]?.skipReason).toBe(
        "Access blocked by vehicle",
      );
    });

    it("should require skip reason", async () => {
      const route = await createTestRoute({
        status: "active",
        bins: [bin1._id.toString()],
      });

      const req = mockRequest({
        params: {
          id: route._id.toString(),
          binId: bin1._id.toString(),
        },
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.markBinSkipped(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("optimizeRoute", () => {
    it("should optimize route with ML service", async () => {
      const route = await createTestRoute({
        bins: [bin1._id.toString(), bin2._id.toString()],
      });

      const req = mockRequest({
        params: { id: route._id.toString() },
        body: {
          startLocation: {
            latitude: 6.9271,
            longitude: 79.8612,
          },
          vehicle: {
            capacity: 1000,
            speed: 40,
          },
        },
      }) as Request;
      const res = mockResponse() as Response;

      // Note: This will use fallback algorithm if ML service is not available
      await RouteController.optimizeRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            route: expect.any(Object),
          }),
        }),
      );
    });

    it("should return 404 for non-existent route", async () => {
      const req = mockRequest({
        params: { id: "507f1f77bcf86cd799439011" },
        body: {
          startLocation: { latitude: 6.9271, longitude: 79.8612 },
        },
      }) as Request;
      const res = mockResponse() as Response;

      await RouteController.optimizeRoute(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
