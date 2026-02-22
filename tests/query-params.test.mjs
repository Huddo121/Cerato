import test from 'node:test';
import assert from 'node:assert/strict';
import z from 'zod';
import { Endpoint, createClientsFromApi, createHonoServer } from '../dist/index.mjs';

test('client serializes array query params using repeated keys', async () => {
  const api = {
    tasks: Endpoint.get()
      .query(
        z.object({
          tags: z.array(z.string()),
          completed: z.enum(['true', 'false']).optional(),
          limit: z.coerce.number().optional(),
        }),
      )
      .output(
        200,
        z.object({
          ok: z.boolean(),
        }),
      ),
  };

  const client = createClientsFromApi(api, [], 'https://example.com');

  let requestedUrl = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requestedUrl = typeof input === 'string' ? input : input.url;
    assert.equal(init?.method, 'GET');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    await client.tasks.GET({
      query: {
        tags: ['home', 'urgent'],
        completed: 'false',
        limit: 10,
      },
    });

    const url = new URL(requestedUrl);
    assert.equal(url.pathname, '/tasks');
    assert.deepEqual(url.searchParams.getAll('tags'), ['home', 'urgent']);
    assert.equal(url.searchParams.get('completed'), 'false');
    assert.equal(url.searchParams.get('limit'), '10');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('client throws when query contains null', async () => {
  const api = {
    tasks: Endpoint.get()
      .query(z.object({ completed: z.string().optional() }))
      .output(200, z.object({ ok: z.boolean() })),
  };

  const client = createClientsFromApi(api, [], 'https://example.com');

  await assert.rejects(
    // biome-ignore lint/suspicious/noExplicitAny: Intentionally bypassing type checks for runtime validation test
    () => client.tasks.GET({ query: { completed: null } }),
    /cannot be null/,
  );
});

test('client throws when query contains nested object', async () => {
  const api = {
    tasks: Endpoint.get()
      .query(z.object({ filters: z.string().optional() }))
      .output(200, z.object({ ok: z.boolean() })),
  };

  const client = createClientsFromApi(api, [], 'https://example.com');

  await assert.rejects(
    // biome-ignore lint/suspicious/noExplicitAny: Intentionally bypassing type checks for runtime validation test
    () => client.tasks.GET({ query: { filters: { status: 'open' } } }),
    /primitive value or array of primitives/,
  );
});

test('server decodes repeated query keys to arrays based on schema', async () => {
  const api = {
    tasks: Endpoint.get()
      .query(
        z.object({
          tags: z.array(z.string()).optional(),
          completed: z.enum(['true', 'false']).optional(),
          limit: z.coerce.number().optional(),
        }),
      )
      .output(
        200,
        z.object({
          tags: z.array(z.string()).optional(),
          completed: z.enum(['true', 'false']).optional(),
          limit: z.number().optional(),
        }),
      ),
  };

  const handlers = {
    tasks: async (ctx) => {
      return [200, ctx.query];
    },
  };

  const app = createHonoServer(api, handlers, {});

  const response = await app.request('/api/tasks?tags=one&tags=two&completed=true&limit=3');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tags: ['one', 'two'],
    completed: 'true',
    limit: 3,
  });
});

test('server keeps array-typed field as array for single value', async () => {
  const api = {
    tasks: Endpoint.get()
      .query(
        z.object({
          tags: z.array(z.string()).optional(),
        }),
      )
      .output(200, z.object({ tags: z.array(z.string()).optional() })),
  };

  const handlers = {
    tasks: async (ctx) => {
      return [200, ctx.query];
    },
  };

  const app = createHonoServer(api, handlers, {});

  const response = await app.request('/api/tasks?tags=only-one');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    tags: ['only-one'],
  });
});
