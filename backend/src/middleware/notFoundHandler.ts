import { Request, Response } from 'express';
import { ResponseHandler } from '@/utils/response';

export const notFoundHandler = (req: Request, res: Response): void => {
  ResponseHandler.notFound(res, `Route ${req.originalUrl} not found`);
};









































