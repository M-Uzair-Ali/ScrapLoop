import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthTokenPayload } from "../types";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthTokenPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(role: "household" | "collector") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.role !== role) {
      return res.status(403).json({ error: `This action requires role: ${role}` });
    }
    next();
  };
}
