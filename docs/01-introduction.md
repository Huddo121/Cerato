# Cerato

Cerato is a library for defining HTTP APIs that aims to make achieving end-to-end typesafety a breeze.

The core of the library is the `Endpoint` DSL, which can progressively build up the definition for an endpoint.

```typescript
const createTaskEndpoint = Endpoint.post().input(createTaskRequestSchema).output(200, taskSchema).(401, unauthorizedSchema)
```

The Schemas used to define the inputs and outputs are [Zod](https://zod.dev) schemas, and these are used to validate ingoing and outgoing data at the edge of each system.

An endpoint definition is simply a class holding some values and type information, which can then be interpreted in to a number of targets.
For example, you can interpret the `createTaskEndpoint` above in to a 'Hono target', which handles some amount of exposing the endpoint as part of a Hono server, or you can interpret the Endpoint in to a 'fetch client' target, making it easy to call the endpoint using `fetch`.

A single Endpoint can handle different HTTP Methods, while also having child routes. This is achieved using the `Endpoint.multi` helper.

```typescript
const tasksApi = {
  tasks: Endpoint.multi({
    GET: Endpoint.get().output(200, z.array(taskSchema)),
    POST: Endpoint.post()
      .input(createTaskRequestSchema)
      .output(200, taskSchema),
    children: {
      ":id": Endpoint.get().output(200, z.array(taskSchema)).output(404, notFoundSchema),
    },
  })
}
```

The above definition would correspond to an API with a `GET /tasks` endpoint that returns a `Task[]` with a `200` status code, a `POST /tasks` endpoint that accepts a `CreateTaskRequest` and returns the newly created `Task` with a `200` status code, and a `GET /tasks/:id` endpoint that either returns the `Task` with a `200` status code, or if the task can't be found then some 'not found' response with a `404` status code.
