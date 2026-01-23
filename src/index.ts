import type { AnyEndpoint, AnyMulti, API } from "./Endpoint";

export type { PathParts } from "./api";
export {
  type ClientsForApi,
  createClientsFromApi,
  type FetchClientResult,
} from "./client/fetch";
export {
  type AnyEndpoint,
  type AnyMulti,
  type API,
  Endpoint,
  mapApi,
} from "./Endpoint";
export { createHonoServer, type HonoHandlersFor } from "./servers/hono";

export type AnyApi = API | AnyEndpoint | AnyMulti;
