import type { Request, Response, NextFunction } from 'express';
import { users } from '../data/mockDb.js';

export type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    name: string;
    email: string;
    role: 'ELECTOR' | 'ADMIN' | 'AUDITOR';
    token: string;
  };
};

export function errorResponse(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  return res.status(statusCode).json({
    error: {
      code,
      message,
      details: details ?? null,
      requestId: null
    }
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(res, 401, 'AUTH_MISSING_TOKEN', 'Missing bearer token.');
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const user = users.find((item) => item.token === token);

  if (!user) {
    return errorResponse(res, 401, 'AUTH_INVALID_TOKEN', 'Invalid bearer token.');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: user.token
  };

  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return errorResponse(res, 401, 'AUTH_MISSING_TOKEN', 'Missing bearer token.');
  }

  if (req.user.role !== 'ADMIN') {
    return errorResponse(res, 403, 'AUTH_FORBIDDEN', 'Admin role required.');
  }

  next();
}
