import { Request, Response, NextFunction } from "express";
import morgan from "morgan";
import { logger } from "@/utils/logger";

// Extend Request to carry an id during the request lifecycle
type RequestWithId = Request & { id?: string };

// Custom morgan token for request ID
morgan.token("id", (req: Request) => {
  return (req as RequestWithId).id || "unknown";
});

// Custom morgan token for response time
morgan.token("response-time", (_req: Request, res: Response) => {
  return res.get("X-Response-Time") || "0";
});

// Custom morgan token for user agent
morgan.token("user-agent", (req: Request) => {
  return req.get("User-Agent") || "unknown";
});

// Custom format for morgan
const morganFormat =
  ':remote-addr - :id ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

// Create morgan middleware
const morganMiddleware = morgan(morganFormat, {
  stream: {
    write: (message: string) => {
      logger.info(message.trim());
    },
  },
});

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Generate request ID
  (req as RequestWithId).id = Math.random().toString(36).substr(2, 9);

  // Start time
  const start = Date.now();

  // Override res.end to calculate response time
  const originalEnd = res.end;
  res.end = function (
    chunk?: unknown,
    encoding?: string | ((err?: Error) => void),
    cb?: () => void,
  ) {
    const duration = Date.now() - start;
    res.set("X-Response-Time", duration.toString());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalEnd as any).call(
      this,
      chunk as unknown as never,
      encoding as unknown as never,
      cb as unknown as never,
    );
  };

  // Use morgan middleware
  morganMiddleware(req, res, next);
};
