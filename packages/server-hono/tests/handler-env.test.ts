import { Endpoint } from "cerato";
import { Hono } from "hono";
import { expect, test } from "vitest";
import z from "zod";
import { createHonoServer, type HonoHandlersFor } from "../src/index";

// The server adapter lets a handler read typed context that server-owned Hono
// middleware placed on the request. The motivating scenario: authentication
// stays server-owned middleware, out of the contract, and sets an identity on
// the Hono context; a contract handler then reads that identity as a typed
// value through the `Env` type argument — rather than casting `ctx.hono`.
type Identity = { readonly principalId: string };
type AuthEnv = { Variables: { identity: Identity } };

const api = {
  me: Endpoint.get().output(200, z.object({ id: z.string() })),
};
type Api = typeof api;

const handlers: HonoHandlersFor<[], Api, unknown, AuthEnv> = {
  me: async (ctx) => {
    // Typed as Identity purely from AuthEnv; this line would need a cast before
    // the passthrough existed.
    const identity = ctx.hono.get("identity");
    return [200, { id: identity.principalId }];
  },
};

/** Mount a contract app beneath a parent that owns the identity middleware. */
const withIdentity = (contract: Hono, principalId: string) => {
  const app = new Hono<AuthEnv>();
  app.use("*", async (c, next) => {
    c.set("identity", { principalId });
    await next();
  });
  app.route("/", contract);
  return app;
};

test("a handler reads a typed variable set by server-owned middleware", async () => {
  const contract = createHonoServer<Api, unknown, AuthEnv>(api, handlers, {});

  const response = await withIdentity(contract, "user-123").request("/api/me");

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ id: "user-123" });
});

test("without an Env, middleware variables are not typed on the handler", () => {
  // Type-only guard: the default BlankEnv exposes no `identity` variable, so
  // reading one must fail to typecheck. This keeps the passthrough honest — the
  // typing comes from a declared Env, not from a loosened context.
  const defaultHandlers: HonoHandlersFor<[], Api, unknown> = {
    // @ts-expect-error - "identity" is not a known variable under BlankEnv
    me: async (ctx) => [200, { id: ctx.hono.get("identity").principalId }],
  };

  expect(defaultHandlers.me).toBeDefined();
});

// Env has to thread through the Multi-route and nested-`API` branches of the
// handler tree too, not just flat endpoints. This exercises both: a Multi `GET`
// and a nested child endpoint, each reading the middleware-set identity typed.
const nestedApi = {
  tasks: Endpoint.multi({
    GET: Endpoint.get().output(200, z.object({ owner: z.string() })),
    children: {
      count: Endpoint.get().output(200, z.object({ owner: z.string() })),
    },
  }),
};
type NestedApi = typeof nestedApi;

const nestedHandlers: HonoHandlersFor<[], NestedApi, unknown, AuthEnv> = {
  tasks: {
    GET: async (ctx) => [200, { owner: ctx.hono.get("identity").principalId }],
    count: async (ctx) => [
      200,
      { owner: ctx.hono.get("identity").principalId },
    ],
  },
};

test("Env threads through Multi routes and nested APIs", async () => {
  const contract = createHonoServer<NestedApi, unknown, AuthEnv>(
    nestedApi,
    nestedHandlers,
    {},
  );
  const app = withIdentity(contract, "user-456");

  const multi = await app.request("/api/tasks");
  expect(multi.status).toBe(200);
  await expect(multi.json()).resolves.toEqual({ owner: "user-456" });

  const nested = await app.request("/api/tasks/count");
  expect(nested.status).toBe(200);
  await expect(nested.json()).resolves.toEqual({ owner: "user-456" });
});
