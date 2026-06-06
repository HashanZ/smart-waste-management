import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ResponseHandler } from '@/utils/response';

export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => {
      if ('msg' in error) {
        return error.msg;
      }
      return 'Validation error';
    });
    
    ResponseHandler.badRequest(res, errorMessages.join(', '));
    return;
  }
  
  next();
};