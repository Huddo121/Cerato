# @cerato/server-hono

> [!CAUTION]
> Part of [Cerato](https://github.com/Huddo121/Cerato) — extremely unfinished, lightly tested, experimental code.

The [Hono](https://hono.dev/) server adapter for [Cerato](https://www.npmjs.com/package/cerato). Give it an API definition plus a matching set of handlers and it builds a Hono app that validates requests and responses against the schema. Handler return types are checked against the endpoint's declared outputs, so returning an undeclared status code or a mismatched body fails to typecheck.

`cerato`, `zod`, and `hono` are peer dependencies you provide.

## Install

```sh
pnpm add @cerato/server-hono cerato zod hono
```

## Usage

```ts
import { createHonoServer, type HonoHandlersFor } from "@cerato/server-hono";
import { Endpoint } from "cerato";
import z from "zod";

const api = {
  ping: Endpoint.get().output(200, z.object({ ok: z.boolean() })),
};
type Api = typeof api;

const handlers: HonoHandlersFor<[], Api, unknown> = {
  ping: async () => [200, { ok: true }],
};

// (api, handlers, services)
const app = createHonoServer(api, handlers, {});

// Routes are mounted under `/api`:
const response = await app.request("/api/ping");
```

See [`cerato`](https://www.npmjs.com/package/cerato) for how to define an API, and [`@cerato/client-fetch`](https://www.npmjs.com/package/@cerato/client-fetch) for a matching typed client.
