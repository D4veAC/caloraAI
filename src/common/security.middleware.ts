import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const rateLimits = new Map<string, { count: number; resetAt: number }>();

function sameOrigin(req: Request) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function isRateLimited(req: Request) {
  const key = `${req.socket.remoteAddress || 'unknown'}:${req.originalUrl}`;
  const current = rateLimits.get(key);
  const timestamp = Date.now();
  if (!current || current.resetAt <= timestamp) {
    rateLimits.set(key, { count: 1, resetAt: timestamp + 60_000 });
    return false;
  }
  return ++current.count > 30;
}

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (req.path.startsWith('/api/') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      if (!sameOrigin(req)) {
        res.status(403).json({ error: 'Invalid request origin' });
        return;
      }
      if (isRateLimited(req)) {
        res.setHeader('Retry-After', '60');
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
    }
    next();
  }
}
