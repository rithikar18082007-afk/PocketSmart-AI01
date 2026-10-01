import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const SECRET_KEY =
  process.env.SESSION_SECRET || 'pocketsmart-ai-production-grade-secret-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHash] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, 'hex');
  if (derived.length !== originalBuffer.length) return false;
  return crypto.timingSafeEqual(derived, originalBuffer);
}

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

export function signAuthToken(userId: string, email: string, expiresInSeconds = 60 * 60 * 24 * 7): string {
  const payload: TokenPayload = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64Payload, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(base64Payload)
      .digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const payload = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf-8')
    ) as TokenPayload;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  authUser?: {
    userId: string;
    email: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token required' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
  }
  req.authUser = { userId: payload.userId, email: payload.email };
  next();
}

// Simple in-memory rate limiter per IP + endpoint family
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.baseUrl || req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment before trying again.',
      });
    }
    bucket.count += 1;
    next();
  };
}
