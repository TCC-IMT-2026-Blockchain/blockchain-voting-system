import type { Response } from "express";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details: unknown = null
  ) {
    super(message);
  }
}

export function errorResponse(res: Response, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId: null
      }
    });
  }

  const message = error instanceof Error ? error.message : "Erro inesperado.";
  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message,
      details: null,
      requestId: null
    }
  });
}
