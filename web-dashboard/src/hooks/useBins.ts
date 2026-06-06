import { useQuery } from 'react-query';
import { fetchBins, Paginated, Bin } from '../api/bins';

export type UseBinsParams = {
  page?: number;
  limit?: number;
  binType?: string;
  status?: string;
  isOverflowing?: boolean;
};

export function useBins(params: UseBinsParams = {}) {
  const { page = 1, limit = 12, binType, status, isOverflowing } = params;

  return useQuery<Paginated<Bin>, Error>(
    ['bins', { page, limit, binType, status, isOverflowing }],
    () =>
      fetchBins({
        page,
        limit,
        ...(binType ? { binType } : {}),
        ...(status ? { status } : {}),
        ...(typeof isOverflowing === 'boolean' ? { isOverflowing } : {}),
      }),
  );
}















