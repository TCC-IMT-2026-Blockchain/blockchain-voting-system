import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { loadOpenApiDocument } from './docs/loadOpenApi.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { electionsRouter } from './routes/elections.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { votesRouter } from './routes/votes.routes.js';
import { verificationRouter } from './routes/verification.routes.js';
import { auditRouter } from './routes/audit.routes.js';

const openApiDocument = loadOpenApiDocument();

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true
    })
  );
  app.use(express.json());

  app.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.use('/health', healthRouter);

  const api = express.Router();
  api.use('/health', healthRouter);
  api.use('/auth', authRouter);
  api.use('/elections', electionsRouter);
  api.use('/admin', adminRouter);
  api.use('/votes', votesRouter);
  api.use('/verification', verificationRouter);
  api.use('/audit', auditRouter);

  app.use('/api/v1', api);

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route ${req.method} ${req.originalUrl} was not found.`,
        details: null,
        requestId: null
      }
    });
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        details: null,
        requestId: null
      }
    });
  });

  return app;
}
