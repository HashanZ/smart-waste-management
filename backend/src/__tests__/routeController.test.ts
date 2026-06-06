import { RouteController } from '@/controllers/routeController';

jest.mock('@/models/Route', () => ({
  Route: {
    findById: jest.fn().mockResolvedValue({
      _id: 'r1',
      bins: ['b1'],
      save: jest.fn(),
      optimizationData: undefined,
      routeId: 'ROUTE00001',
    }),
  },
}));

jest.mock('@/models/Bin', () => ({
  Bin: {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([
      { _id: 'b1', binId: 'BIN-1', location: { latitude: 1, longitude: 2 }, binType: 'general', currentLevel: 80, capacity: 100, isOverflowing: false },
    ]) })
  }
}));

const optimizeRouteMock = jest.fn().mockResolvedValue({
  optimized_route: ['BIN-1'],
  total_distance_km: 1.23,
  estimated_duration_hours: 0.5,
  efficiency_score: 0.9,
  route_details: [{ order: 1, bin_id: 'BIN-1', bin_type: 'general', location: { latitude: 1, longitude: 2 }, waste_level: 80, estimated_arrival: '0.5 hours' }]
});

jest.mock('@/services/mlClient', () => ({
  MLClient: jest.fn().mockImplementation(() => ({ optimizeRoute: optimizeRouteMock }))
}));

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('RouteController.optimizeRoute', () => {
  it('forwards params and attaches optimization data', async () => {
    const req: any = {
      params: { id: 'r1' },
      body: { time_windows: { 'BIN-1': { start: 1, end: 3 } }, traffic_multiplier: 1.1 }
    };
    const res = mockRes();

    await RouteController.optimizeRoute(req, res);

    // ensure MLClient called with params
    expect(optimizeRouteMock).toHaveBeenCalledWith(expect.any(Array), expect.any(Object), expect.objectContaining({
      time_windows: { 'BIN-1': { start: 1, end: 3 } },
      traffic_multiplier: 1.1,
    }));

    // ensure response success
    expect(res.json).toHaveBeenCalled();
  });
});









