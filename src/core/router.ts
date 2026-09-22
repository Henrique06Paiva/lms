import type {
  HttpMethod,
  HttpRequest,
  HttpResponse,
  Middleware,
  NextFunction,
  RouteHandler,
} from "./types.js";

interface InternalRoute {
  method: HttpMethod;
  pattern: string;
  regex: RegExp;
  paramNames: string[];
  middlewares: Middleware[];
  handler: RouteHandler;
}

function pathToRegex(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];

  const regexString = pattern
    .replace(/\//g, "\\/")
    .replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });

  const regex = new RegExp(`^${regexString}(?:\\/)?$`);
  return { regex, paramNames };
}

export class Router {
  private routes: InternalRoute[] = [];
  private globalMiddlewares: Middleware[] = [];

  public use(...middlewares: Middleware[]): this {
    this.globalMiddlewares.push(...middlewares);
    return this;
  }

  private register(
    method: HttpMethod,
    pattern: string,
    handlers: (Middleware | RouteHandler)[]
  ): this {
    if (handlers.length === 0) {
      throw new Error(`Nenhum handler fornecido para a rota ${method} ${pattern}`);
    }

    const { regex, paramNames } = pathToRegex(pattern);
    const routeMiddlewares = handlers.slice(0, -1) as Middleware[];
    const handler = handlers[handlers.length - 1] as RouteHandler;

    this.routes.push({
      method,
      pattern,
      regex,
      paramNames,
      middlewares: routeMiddlewares,
      handler,
    });

    return this;
  }

  public get(pattern: string, handler: RouteHandler): this;
  public get(pattern: string, m1: Middleware, handler: RouteHandler): this;
  public get(pattern: string, m1: Middleware, m2: Middleware, handler: RouteHandler): this;
  public get(pattern: string, ...handlers: (Middleware | RouteHandler)[]): this {
    return this.register("GET", pattern, handlers);
  }

  public post(pattern: string, handler: RouteHandler): this;
  public post(pattern: string, m1: Middleware, handler: RouteHandler): this;
  public post(pattern: string, m1: Middleware, m2: Middleware, handler: RouteHandler): this;
  public post(pattern: string, ...handlers: (Middleware | RouteHandler)[]): this {
    return this.register("POST", pattern, handlers);
  }

  public put(pattern: string, handler: RouteHandler): this;
  public put(pattern: string, m1: Middleware, handler: RouteHandler): this;
  public put(pattern: string, m1: Middleware, m2: Middleware, handler: RouteHandler): this;
  public put(pattern: string, ...handlers: (Middleware | RouteHandler)[]): this {
    return this.register("PUT", pattern, handlers);
  }

  public patch(pattern: string, handler: RouteHandler): this;
  public patch(pattern: string, m1: Middleware, handler: RouteHandler): this;
  public patch(pattern: string, m1: Middleware, m2: Middleware, handler: RouteHandler): this;
  public patch(pattern: string, ...handlers: (Middleware | RouteHandler)[]): this {
    return this.register("PATCH", pattern, handlers);
  }

  public delete(pattern: string, handler: RouteHandler): this;
  public delete(pattern: string, m1: Middleware, handler: RouteHandler): this;
  public delete(pattern: string, m1: Middleware, m2: Middleware, handler: RouteHandler): this;
  public delete(pattern: string, ...handlers: (Middleware | RouteHandler)[]): this {
    return this.register("DELETE", pattern, handlers);
  }

  public async handle(req: HttpRequest, res: HttpResponse): Promise<boolean> {
    const method = req.method as HttpMethod;
    const pathname = (req.url ?? "/").split("?")[0] || "/";

    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = route.regex.exec(pathname);
      if (!match) continue;

      req.params = {};
      route.paramNames.forEach((name, index) => {
        const val = match[index + 1];
        if (val) {
          req.params[name] = decodeURIComponent(val);
        }
      });

      const pipeline: (Middleware | RouteHandler)[] = [
        ...this.globalMiddlewares,
        ...route.middlewares,
        route.handler,
      ];

      let currentIndex = 0;
      const next: NextFunction = async () => {
        if (currentIndex < pipeline.length) {
          const fn = pipeline[currentIndex++];
          if (fn) {
            await fn(req, res, next);
          }
        }
      };

      await next();
      return true;
    }

    return false;
  }
}
