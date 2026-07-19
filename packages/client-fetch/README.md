# @cerato/client-fetch

> [!CAUTION]
> Part of [Cerato](https://github.com/Huddo121/Cerato) — extremely unfinished, lightly tested, experimental code.

The fetch-based client adapter for [Cerato](https://www.npmjs.com/package/cerato). Give it an API definition and it derives a fully typed client whose request and response types come straight from the schema.

This package has no runtime dependencies of its own — no `hono`, nothing else transitive. `cerato` and `zod` are peer dependencies you provide.

## Install

```sh
pnpm add @cerato/client-fetch cerato zod
```

## Usage

```ts
import { createClientsFromApi } from "@cerato/client-fetch";
import { Endpoint } from "cerato";
import z from "zod";

const api = {
  ping: Endpoint.get().output(200, z.object({ ok: z.boolean() })),
};

// (api, basePath, host)
const client = createClientsFromApi(api, ["api"], "https://example.com");

const result = await client.ping.GET();
if (result.status === 200) {
  console.log(result.responseBody.ok);
}
```

See [`cerato`](https://www.npmjs.com/package/cerato) for how to define an API, and [`@cerato/server-hono`](https://www.npmjs.com/package/@cerato/server-hono) to serve one.
