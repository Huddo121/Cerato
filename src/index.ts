import type { AnyEndpoint, AnyMulti, API } from "./Endpoint";

export type { PathParts } from "./api";
export { createClientsFromApi, type ClientsForApi, type FetchClientResult } from "./client/fetch";
export { Endpoint, mapApi, type AnyEndpoint, type AnyMulti, type API } from "./Endpoint";
export { createHonoServer, type HonoHandlersFor } from "./servers/hono";

export type AnyApi = API | AnyEndpoint | AnyMulti;
