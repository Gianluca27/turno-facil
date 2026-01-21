import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../../config/database.js';

const router = Router();

// GET /health - Basic health check
router.get('/', async (_req: Request, res: Response) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  res.json(health);
});

// GET /health/ready - Readiness check (includes dependencies)
router.get('/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // Check MongoDB
  try {
    const start = Date.now();
    await mongoose.connection.db?.admin().ping();
    checks.mongodb = { status: 'healthy', latency: Date.now() - start };
  } catch {
    checks.mongodb = { status: 'unhealthy' };
  }

  // Check Redis
  try {
    const start = Date.now();
    const redis = getRedisClient();
    await redis.ping();
    checks.redis = { status: 'healthy', latency: Date.now() - start };
  } catch {
    checks.redis = { status: 'unhealthy' };
  }

  const isHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  });
});

// GET /health/live - Liveness check
router.get('/live', (_req: Request, res: Response) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;
