// Type-level assertions, verified by `pnpm typecheck` (not the vitest runner).
//
// These encode the guarantee that a Hono handler's returned [status, body]
// tuple is checked against the endpoint's declared outputs. The README once
// carried an "URGENT: return types of handlers don't seem to be getting
// checked?" note; this file pins that the guarantee actually holds, so a
// regression fails the typecheck rather than silently shipping.
import z from "zod";
import { Endpoint } from "../src/Endpoint";
import type { HonoHandlersFor } from "../src/servers/hono";

const taskSchema = z.object({ id: z.string(), title: z.string() });

const api = {
  tasks: Endpoint.get()
    .output(200, taskSchema)
    .output(404, z.object({ message: z.string() })),
};
type Api = typeof api;

// A handler returning a declared code with the correct body typechecks.
export const good: HonoHandlersFor<[], Api, unknown> = {
  tasks: async () => [200, { id: "1", title: "t" }],
};

export const wrongBody: HonoHandlersFor<[], Api, unknown> = {
  // @ts-expect-error body is missing `title`
  tasks: async () => [200, { id: "1" }],
};

export const undeclaredCode: HonoHandlersFor<[], Api, unknown> = {
  // @ts-expect-error 500 is not a declared output for this endpoint
  tasks: async () => [500, { id: "1", title: "t" }],
};

export const wrongBodyType: HonoHandlersFor<[], Api, unknown> = {
  // @ts-expect-error a string is not a task
  tasks: async () => [200, "not a task"],
};
