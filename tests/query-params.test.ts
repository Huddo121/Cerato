import { afterEach, expect, test, vi } from "vitest";
import z from "zod";
import { createClientsFromApi, createHonoServer, Endpoint } from "../src/index";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("client serializes array query params using repeated keys", async () => {
  const api = {
    tasks: Endpoint.get()
      .query({
        tags: z.array(z.string()),
        completed: z.enum(["true", "false"]).optional(),
        limit: z.coerce.number().optional(),
      })
      .output(200, z.object({ ok: z.boolean() })),
  };

  const client = createClientsFromApi(api, [], "https://example.com");

  const fetchMock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      expect(init?.method).toBe("GET");
      expect(new URL(requestUrl).pathname).toBe("/tasks");

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  vi.stubGlobal("fetch", fetchMock as typeof fetch);

  await client.tasks.GET({
    query: {
      tags: ["home", "urgent"],
      completed: "false",
      limit: 10,
    },
  });

  const requestUrl = fetchMock.mock.calls[0]?.[0];
  const url = new URL(
    typeof requestUrl === "string"
      ? requestUrl
      : requestUrl instanceof URL
        ? requestUrl.toString()
        : requestUrl.url,
  );

  expect(url.searchParams.getAll("tags")).toEqual(["home", "urgent"]);
  expect(url.searchParams.get("completed")).toBe("false");
  expect(url.searchParams.get("limit")).toBe("10");
});

test("client throws when query contains null", async () => {
  const api = {
    tasks: Endpoint.get()
      .query({ completed: z.string().optional() })
      .output(200, z.object({ ok: z.boolean() })),
  };

  const client = createClientsFromApi(api, [], "https://example.com");

  await expect(
    // biome-ignore lint/suspicious/noExplicitAny: Intentionally bypassing type checks for runtime validation test
    client.tasks.GET({ query: { completed: null } as any }),
  ).rejects.toThrow(/cannot be null/);
});

test("client throws when query contains nested object", async () => {
  const api = {
    tasks: Endpoint.get()
      .query({ filters: z.string().optional() })
      .output(200, z.object({ ok: z.boolean() })),
  };

  const client = createClientsFromApi(api, [], "https://example.com");

  await expect(
    // biome-ignore lint/suspicious/noExplicitAny: Intentionally bypassing type checks for runtime validation test
    client.tasks.GET({ query: { filters: { status: "open" } } as any }),
  ).rejects.toThrow(/primitive value or array of primitives/);
});

test("server decodes repeated query keys to arrays based on schema", async () => {
  const api = {
    tasks: Endpoint.get()
      .query({
        tags: z.array(z.string()).optional(),
        completed: z.enum(["true", "false"]).optional(),
        limit: z.coerce.number().optional(),
      })
      .output(
        200,
        z.object({
          tags: z.array(z.string()).optional(),
          completed: z.enum(["true", "false"]).optional(),
          limit: z.number().optional(),
        }),
      ),
  };

  const handlers = {
    tasks: async (ctx: {
      query: { tags?: string[]; completed?: "true" | "false"; limit?: number };
    }) => {
      return [200, ctx.query] as const;
    },
  };

  const app = createHonoServer(api, handlers, {});

  const response = await app.request(
    "/api/tasks?tags=one&tags=two&completed=true&limit=3",
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    tags: ["one", "two"],
    completed: "true",
    limit: 3,
  });
});

test("server keeps array-typed field as array for single value", async () => {
  const api = {
    tasks: Endpoint.get()
      .query({
        tags: z.array(z.string()).optional(),
      })
      .output(200, z.object({ tags: z.array(z.string()).optional() })),
  };

  const handlers = {
    tasks: async (ctx: { query: { tags?: string[] } }) => {
      return [200, ctx.query] as const;
    },
  };

  const app = createHonoServer(api, handlers, {});

  const response = await app.request("/api/tasks?tags=only-one");

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    tags: ["only-one"],
  });
});
