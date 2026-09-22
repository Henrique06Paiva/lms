import type { ServerResponse } from "node:http";
import type { CookieOptions, HttpResponse } from "./types.js";

function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];

  parts.push(`Path=${options.path ?? "/"}`);

  if (options.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join("; ");
}

export function enhanceResponse(rawRes: ServerResponse): HttpResponse {
  const res = rawRes as HttpResponse;

  res.status = function (code: number) {
    this.statusCode = code;
    return this;
  };

  res.json = function (data: unknown) {
    this.setHeader("Content-Type", "application/json; charset=utf-8");
    this.end(JSON.stringify(data));
  };

  res.send = function (body: string, contentType = "text/plain; charset=utf-8") {
    this.setHeader("Content-Type", contentType);
    this.end(body);
  };

  res.setCookie = function (name: string, value: string, options?: CookieOptions) {
    const serialized = serializeCookie(name, value, options);
    const existing = this.getHeader("Set-Cookie");

    if (!existing) {
      this.setHeader("Set-Cookie", serialized);
    } else if (Array.isArray(existing)) {
      this.setHeader("Set-Cookie", [...existing, serialized]);
    } else {
      this.setHeader("Set-Cookie", [String(existing), serialized]);
    }
  };

  res.clearCookie = function (name: string, options?: CookieOptions) {
    this.setCookie(name, "", {
      ...options,
      maxAgeSeconds: 0,
      expires: new Date(0),
    });
  };

  return res;
}
