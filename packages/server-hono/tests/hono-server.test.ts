import { Endpoint } from "cerato";
import { expect, test } from "vitest";
import z from "zod";
import { createHonoServer, type HonoHandlersFor } from "../src/index";

const api = {
  ping: Endpoint.get().output(200, z.object({ ok: z.boolean() })),
  create: Endpoint.post()
    .input(z.object({ name: z.string() }))
    .output(201, z.object({ created: z.string() })),
  replace: Endpoint.put()
    .input(z.object({ name: z.string() }))
    .output(200, z.object({ replaced: z.string() })),
  modify: Endpoint.patch()
    .input(z.object({ name: z.string() }))
    .output(200, z.object({ modified: z.string() })),
  remove: Endpoint.delete().output(200, z.object({ deleted: z.boolean() })),
  old: Endpoint.get().output(301, z.string()),
  submitAndRedirect: Endpoint.post()
    .input(z.object({ name: z.string() }))
    .output(302, z.string()),
};
type Api = typeof api;

const handlers: HonoHandlersFor<[], Api, unknown> = {
  ping: async () => [200, { ok: true }],
  create: async (ctx) => [201, { created: ctx.body.name }],
  replace: async (ctx) => [200, { replaced: ctx.body.name }],
  modify: async (ctx) => [200, { modified: ctx.body.name }],
  remove: async () => [200, { deleted: true }],
  old: async () => [301, "/api/ping"],
  submitAndRedirect: async () => [302, "/api/ping"],
};

const app = createHonoServer(api, handlers, {});

const jsonRequest = (path: string, method: string, body: unknown) =>
  app.request(path, {
    method,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

test("routes a GET request to its handler", async () => {
  const response = await app.request("/api/ping");

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});

test("routes a POST request and parses the body", async () => {
  const response = await jsonRequest("/api/create", "POST", { name: "widget" });

  expect(response.status).toBe(201);
  await expect(response.json()).resolves.toEqual({ created: "widget" });
});

test("routes a PUT request and parses the body", async () => {
  const response = await jsonRequest("/api/replace", "PUT", { name: "widget" });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ replaced: "widget" });
});

test("routes a PATCH request and parses the body", async () => {
  const response = await jsonRequest("/api/modify", "PATCH", {
    name: "widget",
  });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ modified: "widget" });
});

test("routes a DELETE request to its handler", async () => {
  const response = await app.request("/api/remove", { method: "DELETE" });

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ deleted: true });
});

test("a GET handler returning a 3xx code issues a redirect", async () => {
  const response = await app.request("/api/old");

  expect(response.status).toBe(301);
  expect(response.headers.get("location")).toBe("/api/ping");
});

test("a non-GET handler returning a 3xx code also issues a redirect", async () => {
  // Regression: redirect handling used to live only in the GET handler, so a
  // 3xx from POST/PUT/etc. fell through to JSON encoding and failed.
  const response = await jsonRequest("/api/submitAndRedirect", "POST", {
    name: "widget",
  });

  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe("/api/ping");
});
