import type { NextFunction, Request, Response } from "express";
import { store } from "../data/store.js";
import type { User, UserRole } from "../domain/types.js";
import { HttpError } from "../lib/errors.js";

export type AuthenticatedRequest = Request & { user?: User };

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new HttpError(401, "AUTH_MISSING_TOKEN", "Token de autenticação não informado."));
    return;
  }

  const token = header.replace("Bearer ", "").trim();
  const user = store.all().users.find((item) => item.token === token);
  if (!user) {
    next(new HttpError(401, "AUTH_INVALID_TOKEN", "Token de autenticação inválido."));
    return;
  }

  req.user = user;
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, "AUTH_MISSING_TOKEN", "Token de autenticação não informado."));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "AUTH_FORBIDDEN", "Permissão insuficiente."));
      return;
    }

    next();
  };
}
