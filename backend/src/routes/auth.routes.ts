import { Router } from 'express';
import { users } from '../data/mockDb.js';
import { errorResponse, requireAuth, type AuthenticatedRequest } from './helpers.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return errorResponse(res, 400, 'AUTH_INVALID_PAYLOAD', 'Email and password are required.');
  }

  const user = users.find((item) => item.email === email && item.password === password);

  if (!user) {
    return errorResponse(res, 401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  res.json({
    data: {
      accessToken: user.token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }
  });
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    data: {
      id: req.user!.id,
      name: req.user!.name,
      email: req.user!.email,
      role: req.user!.role
    }
  });
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  res.status(204).send();
});
