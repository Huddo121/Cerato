# cerato

> [!CAUTION]
> Extracted from a toy project — extremely unfinished, lightly tested, limited, experimental code.

**Note for AI Agents**: there's a `docs` folder published with this package; read the docs for help using the library.

The core of [Cerato](https://github.com/Huddo121/Cerato), an experiment in making it easy to build end-to-end typesafe APIs in TypeScript. You describe an API once as a plain value, and interpret that description into different targets — a typesafe fetch client, a Hono server — via adapter packages.

This package holds the API definition primitives (`Endpoint`, `mapApi`) and the types that flow through every adapter. It has no runtime dependencies; [Zod](https://zod.dev/) is a peer dependency, used to validate anything coming "in" at runtime.

## Install

```sh
pnpm add cerato zod
```

Then add whichever adapters you need:

- [`@cerato/client-fetch`](https://www.npmjs.com/package/@cerato/client-fetch) — derive a fetch-based client from an API definition.
- [`@cerato/server-hono`](https://www.npmjs.com/package/@cerato/server-hono) — serve an API definition with [Hono](https://hono.dev/).

## Defining an API

```ts
import { Endpoint } from "cerato";
import z from "zod";

export const api = {
  ping: Endpoint.get().output(200, z.object({ ok: z.boolean() })),
  createTask: Endpoint.post()
    .input(z.object({ title: z.string() }))
    .output(201, z.object({ id: z.string() })),
};
```

`api` is just a value. On its own it does nothing — hand it to an adapter to get a client or a server. Both derive their types from this single definition, so the client and server stay in lockstep with the schema.

## Entry points

- `cerato` — the curated, public API surface (`Endpoint`, `mapApi`, and the types you need to describe and consume APIs).
- `cerato/internal` — the shared building blocks the official adapters are built on. Not covered by semver for external consumers; you shouldn't need to import from it unless you're writing your own adapter.

## Versioning note for adapters

Adapters take `cerato` as a peer dependency so a consumer resolves a single shared copy. This matters at runtime: the adapters use `instanceof` against core's `Endpoint`/`Multi` classes, and two copies of core in one dependency tree would silently fail to recognise each other's endpoints.
