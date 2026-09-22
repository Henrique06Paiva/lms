import type { IncomingMessage, ServerResponse } from "node:http";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
  maxAgeSeconds?: number;
  expires?: Date;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: "admin" | "student";
}

export interface HttpRequest extends IncomingMessage {
  params: Record<string, string>;
  query: Record<string, string>;
  cookies: Record<string, string>;
  body: any;
  user?: AuthenticatedUser;
}

export interface HttpResponse extends ServerResponse {
  status(code: number): this;
  json(data: unknown): void;
  send(body: string, contentType?: string): void;
  setCookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: CookieOptions): void;
}

export type NextFunction = () => Promise<void> | void;

export type Middleware = (
  req: HttpRequest,
  res: HttpResponse,
  next: NextFunction
) => Promise<void> | void;

export type RouteHandler = (
  req: HttpRequest,
  res: HttpResponse
) => Promise<void> | void;
