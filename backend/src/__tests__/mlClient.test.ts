import axios from 'axios';
import { MLClient } from '@/services/mlClient';

jest.mock('axios', () => {
  const m = {
    create: jest.fn().mockReturnThis(),
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { response: { use: jest.fn() } },
  } as any;
  return m;
});

describe('MLClient', () => {
  let client: MLClient;

  beforeEach(() => {
    client = new MLClient();
    (axios.post as jest.Mock).mockReset();
    (axios.get as jest.Mock).mockReset();
  });

  it('healthCheck returns true on 200', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ status: 200 });
    const ok = await client.healthCheck();
    expect(ok).toBe(true);
  });

  it('predictWaste posts expected payload', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { predicted_level: 90 } });
    const res = await client.predictWaste('BIN-1', 'general', 70, 100, { latitude: 1, longitude: 2 }, 24);
    expect(axios.post).toHaveBeenCalledWith('/predict/waste', expect.objectContaining({
      bin_id: 'BIN-1',
      bin_type: 'general',
      current_level: 70,
      capacity: 100,
      location: { latitude: 1, longitude: 2 },
      time_horizon_hours: 24,
    }));
    expect(res).toEqual({ predicted_level: 90 });
  });

  it('optimizeRoute forwards time_windows and traffic_multiplier', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { optimized_route: ['BIN-1'] } });
    const bins = [{ bin_id: 'BIN-1', latitude: 1, longitude: 2, bin_type: 'general', current_level: 80, capacity: 100, priority: 1 }];
    const collector = { latitude: 0, longitude: 0 };
    await client.optimizeRoute(bins as any, collector, {
      time_windows: { 'BIN-1': { start: 1.0, end: 3.0 } },
      traffic_multiplier: 1.2,
    });
    expect(axios.post).toHaveBeenCalledWith('/optimize/route', expect.objectContaining({
      bins,
      collector_location: collector,
      time_windows: {
        traffic_multiplier: 1.2,
        windows: { 'BIN-1': { start: 1.0, end: 3.0 } }
      }
    }));
  });
});









