/** biome-ignore-all lint/complexity/noBannedTypes: Some empty-record needs that aren't met by using Record<string, never> */
import { type Context, Hono } from "hono";
import type { BlankEnv } from "hono/types";
import type { RedirectStatusCode } from "hono/utils/http-status";
import type { PathPart, PathParts } from "../api";
import {
  type AnyEndpoint,
  type AnyMulti,
  type API,
  type ChildrenForMulti,
  Endpoint,
  type EndpointMappingForMulti,
  type InputForEndpoint,
  Multi,
  type OutputValidatorsForEndpoint,
  type ResponseCode,
  type ResponsesForEndpoint,
} from "../Endpoint";
import { typedEntries } from "../type-utils";

type FlattenedPath<P extends PathParts> = P extends readonly [infer PH, ...infer PT]
  ? PH extends string
    ? PT extends PathParts
      ? `/${PH}${FlattenedPath<PT>}`
      : `/${PH}`
    : ""
  : "";

type AppendToPath<Path extends PathParts, Part extends PathPart> = [...Path, Part];

type HandlerContext<Env extends BlankEnv, Path extends PathParts, E extends AnyEndpoint, Services> = {
  hono: Context<Env, FlattenedPath<Path>, HonoInput<E>>;
  services: Services;
};

type HonoInput<E extends AnyEndpoint> = { in: InputForEndpoint<E>; out: OutputValidatorsForEndpoint<E>; outputFormat: "json" };

type HonoHandlerForEndpoint<Path extends PathParts, E extends AnyEndpoint, Services> = E extends Endpoint<
  infer _M,
  infer I,
  infer _O,
  infer _Q,
  infer _H
>
  ? (ctx: HandlerContext<BlankEnv, Path, E, Services> & { body: I }) => Promise<ResponsesForEndpoint<E>>
  : never;

export type WithHandlerIfRequired<Path extends PathParts, E extends AnyEndpoint | API | undefined, Services> = E extends AnyEndpoint
  ? HonoHandlerForEndpoint<Path, E, Services>
  : E extends API
    ? HonoTraverseApi<Path, E, Services>
    : {};

export type HonoHandlersForEndpointMapping<Path extends PathParts, EM, Services> = {
  [K in keyof EM as K extends "children" ? never : K]: EM[K] extends AnyEndpoint ? HonoHandlerForEndpoint<Path, EM[K], Services> : never;
};
// Kind of dodgy re-use of the API handling for Multi Routes
export type HonoHandlerForMulti<Path extends PathParts, M extends AnyMulti, Services> = HonoHandlersForEndpointMapping<
  Path,
  EndpointMappingForMulti<M>,
  Services
> &
  WithHandlerIfRequired<Path, ChildrenForMulti<M>, Services>;

export type HonoHandlersForAPI<Path extends PathParts, A extends API, Services> = {
  [K in keyof A]: HonoHandlersFor<AppendToPath<Path, K & string>, A[K], Services>;
};

/**
 * For each of the parts of an API, defer to the correct type mapping to turn the type that describes the
 *   API to the tree of Hono handlers needed to serve that API.
 */
export type HonoTraverseApi<Path extends PathParts, A extends API, Services> = {
  [K in keyof A]: A[K] extends AnyEndpoint
    ? HonoHandlerForEndpoint<AppendToPath<Path, K extends string ? K : never>, A[K], Services>
    : A[K] extends AnyMulti
      ? HonoHandlerForMulti<AppendToPath<Path, K extends string ? K : never>, A[K], Services>
      : HonoTraverseApi<AppendToPath<Path, K & string>, A[K] extends API ? A[K] : never, Services>;
};

export type HonoHandlersFor<Path extends PathParts, A extends API | AnyEndpoint | AnyMulti, Services> = A extends AnyMulti
  ? HonoHandlerForMulti<Path, A, Services>
  : A extends AnyEndpoint
    ? HonoHandlerForEndpoint<Path, A, Services>
    : A extends API
      ? HonoHandlersForAPI<Path, A, Services>
      : never;

export type HonoConfiguration = {};

const flattenPath = <P extends PathParts>(path: P): FlattenedPath<P> => {
  return `/${path.join("/")}` as FlattenedPath<P>;
};

const appendPath = <Path extends PathParts, Part extends PathPart>(parent: Path, end: Part): AppendToPath<Path, Part> => {
  return [...parent, end];
};

const addGetHandler = <Path extends PathParts, Services>(
  app: Hono,
  endpoint: AnyEndpoint,
  path: string,
  handle: HonoHandlerForEndpoint<Path, AnyEndpoint, Services>,
  services: Services,
) => {
  app.get(path, async (honoCtx) => {
    const reqBody = endpoint.inputValidator !== undefined ? await honoCtx.req.json() : undefined;
    const ctx = { hono: honoCtx, services, body: reqBody };
    const [status, responseBody] = await handle(ctx);
    const statusAsNumber = Number(status);
    // This is dodgy, I should switch away from tuples
    if (statusAsNumber >= 300 && statusAsNumber <= 399) {
      return honoCtx.redirect(responseBody as string, statusAsNumber as RedirectStatusCode);
    }
    return honoCtx.json(responseBody as unknown as {}, Number(status) as ResponseCode);
  });
};

const addPostHandler = <Path extends PathParts, Services>(
  app: Hono,
  endpoint: AnyEndpoint,
  path: string,
  handle: HonoHandlerForEndpoint<Path, AnyEndpoint, Services>,
  services: Services,
) => {
  app.post(path, async (honoCtx) => {
    const reqBody = endpoint.inputValidator !== undefined ? await honoCtx.req.json() : undefined;
    const ctx = { hono: honoCtx, services, body: reqBody };
    const [status, responseBody] = await handle(ctx);
    return honoCtx.json(responseBody as unknown as {}, Number(status) as ResponseCode);
  });
};

const addDeleteHandler = <Path extends PathParts, Services>(
  app: Hono,
  endpoint: AnyEndpoint,
  path: string,
  handle: HonoHandlerForEndpoint<Path, AnyEndpoint, Services>,
  services: Services,
) => {
  app.delete(path, async (honoCtx) => {
    const reqBody = endpoint.inputValidator !== undefined ? await honoCtx.req.json() : undefined;
    const ctx = { hono: honoCtx, services, body: reqBody };
    const [status, responseBody] = await handle(ctx);
    return honoCtx.json(responseBody as unknown as {}, Number(status) as ResponseCode);
  });
};

const addHandler = <Path extends PathParts, Services>(
  app: Hono,
  endpoint: AnyEndpoint,
  path: string,
  handle: HonoHandlerForEndpoint<Path, AnyEndpoint, Services>,
  services: Services,
) => {
  if (endpoint.allowedMethod === "GET") {
    addGetHandler(app, endpoint, path, handle, services);
  } else if (endpoint.allowedMethod === "POST") {
    addPostHandler(app, endpoint, path, handle, services);
  } else if (endpoint.allowedMethod === "DELETE") {
    addDeleteHandler(app, endpoint, path, handle, services);
  } else {
    throw new Error(`Attempting to construct a Hono server with an invalid method; ${endpoint.allowedMethod} ${path}`);
  }
};

/** Visit all the parts of an API and add the appropriate routes to the Hono App */
const traverseApi = <Path extends PathParts, A extends API, Services>(
  api: A,
  handlers: HonoTraverseApi<Path, A, Services>,
  app: Hono,
  parentPath: Path,
  services: Services,
) => {
  const entries = typedEntries(api);

  // There's a lot of skirting around the type system in here, I don't know how to convince typescript that two structures align in some way
  //   and for it to correctly infer types based on the type of a value in part of that structure. Probably can't be two structures.
  entries.forEach(([pathPart, endpointOrApi]) => {
    const path = flattenPath(appendPath(parentPath, pathPart as PathPart));
    if (endpointOrApi instanceof Endpoint) {
      // Add endpoint to Hono using the appropriate handler
      const handler = handlers[pathPart] as HonoHandlerForEndpoint<Path, AnyEndpoint, Services>;

      addHandler(app, endpointOrApi, path, handler, services);
    } else if (endpointOrApi instanceof Multi) {
      const multiHandlers = handlers[pathPart] as HonoHandlerForMulti<Path, AnyMulti, Services>;

      const mapping = endpointOrApi.endpointMapping;

      if ("GET" in mapping && "GET" in multiHandlers) {
        addHandler(app, mapping.GET, path, multiHandlers.GET, services);
      }

      if ("POST" in mapping && "POST" in multiHandlers) {
        addHandler(app, mapping.POST, path, multiHandlers.POST, services);
      }

      if ("DELETE" in mapping && "DELETE" in multiHandlers) {
        addHandler(app, mapping.DELETE, path, multiHandlers.DELETE, services);
      }

      if ("children" in mapping) {
        traverseApi(
          mapping.children,
          multiHandlers as HonoTraverseApi<AppendToPath<Path, PathPart>, API, Services>,
          app,
          appendPath(parentPath, pathPart as PathPart),
          services,
        );
      }
    } else {
      // Recurse
      const subApi = handlers[pathPart] as HonoTraverseApi<AppendToPath<Path, PathPart>, API, Services>;
      traverseApi(endpointOrApi, subApi, app, appendPath(parentPath, pathPart as PathPart), services);
    }
  });
};

export const createHonoServer = <A extends API, Services>(api: A, handlers: HonoTraverseApi<[], A, Services>, services: Services): Hono => {
  const app = new Hono();
  traverseApi(api, handlers, app, ["api"], services);
  return app;
};
