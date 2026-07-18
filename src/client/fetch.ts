/** biome-ignore-all lint/complexity/noBannedTypes: I'm doing some sinning in here */
import type z from "zod";
import type { ZodAny } from "zod";
import {
  type AnyEndpoint,
  type AnyMulti,
  type API,
  type ChildrenForMulti,
  Endpoint,
  type EndpointMappingForMulti,
  type InputForEndpoint,
  METHODS,
  type MethodForEndpoint,
  type Methods,
  Multi,
  type OutputsForEndpoint,
  type OutputValidatorsForEndpoint,
  type QueryForEndpoint,
  type ValuesOutputFor,
} from "../Endpoint";
import {
  type AccumulatePathParams,
  type PathParts,
  resolvePath,
} from "../path-utils";
import { type EmptyRecord, type Prettify, typedEntries } from "../type-utils";

type AsResponse<T extends Record<string, unknown>> = {
  [K in keyof T]: { status: K; responseBody: T[K] };
}[keyof T];

// A disjunction of statuses and response bodies
export type FetchClientResult<E extends AnyEndpoint> = AsResponse<
  OutputsForEndpoint<E>
>;

type WithBodyIfRequired<E extends AnyEndpoint> =
  InputForEndpoint<E> extends undefined ? {} : { body: InputForEndpoint<E> };
type WithPathParamsIfRequired<PathParams extends Record<string, string>> =
  PathParams extends EmptyRecord ? {} : { pathParams: PathParams };
type WithHeaderParamIfRequired<E extends AnyEndpoint> =
  RequiredHeadersForEndpoint<E> extends undefined
    ? {}
    : { headers: RequiredHeadersForEndpoint<E> };
type QueryScalar = string | number | boolean;
type SerializableQueryValue<T> = T extends QueryScalar
  ? T
  : T extends readonly (infer U)[]
    ? SerializableQueryValue<Exclude<U, null | undefined>>[]
    : never;
type RequiredQueryKeys<T extends Record<string, unknown>> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];
type OptionalQueryKeys<T extends Record<string, unknown>> = Exclude<
  keyof T,
  RequiredQueryKeys<T>
>;
type SerializableQueryObject<T extends Record<string, unknown>> = Prettify<
  {
    [K in RequiredQueryKeys<T>]: SerializableQueryValue<Exclude<T[K], null>>;
  } & {
    [K in OptionalQueryKeys<T>]?: SerializableQueryValue<
      Exclude<T[K], undefined | null>
    >;
  }
>;
type WithQueryIfRequired<E extends AnyEndpoint> =
  // Endpoints without a query resolve QueryForEndpoint to `never`. The
  // `[never]` wrapper stops that distributing into the Record branch (which
  // `never` would otherwise satisfy), so no `query` key is required.
  [QueryForEndpoint<E>] extends [never]
    ? {}
    : QueryForEndpoint<E> extends Record<string, unknown>
      ? { query: SerializableQueryObject<QueryForEndpoint<E>> }
      : {};

export type FetchClientInputs<
  E extends AnyEndpoint,
  PathParams extends Record<string, string>,
> = Prettify<
  WithBodyIfRequired<E> &
    WithPathParamsIfRequired<PathParams> &
    WithHeaderParamIfRequired<E> &
    WithQueryIfRequired<E>
>;

export type ClientFunction<
  E extends AnyEndpoint,
  PathParams extends Record<string, string>,
> = FetchClientInputs<E, PathParams> extends EmptyRecord
  ? () => Promise<FetchClientResult<E>>
  : (input: FetchClientInputs<E, PathParams>) => Promise<FetchClientResult<E>>;

export type FetchClientForEndpoint<
  E extends AnyEndpoint,
  PathParams extends Record<string, string>,
> = {
  [m in MethodForEndpoint<E>]: ClientFunction<E, PathParams>;
};

export type ClientForEndpoint<
  E extends AnyEndpoint,
  PathParams extends Record<string, string>,
> = {
  [K in InputForEndpoint<E> extends undefined
    ? never
    : "inputValidator"]: z.ZodType<InputForEndpoint<E>>;
} & FetchClientForEndpoint<E, PathParams>;

export type RequiredHeadersForEndpoint<E extends AnyEndpoint> =
  E extends Endpoint<infer _M, infer _I, infer _O, infer _Q, infer H>
    ? H
    : never;

const addInputValidator = <
  E extends AnyEndpoint,
  P extends Record<string, string>,
>(
  endpoint: E,
  fetchClient: FetchClientForEndpoint<E, P>,
): ClientForEndpoint<E, P> => {
  if (endpoint.inputValidator !== undefined) {
    return { ...fetchClient, inputValidator: endpoint.inputValidator };
  }
  return fetchClient as ClientForEndpoint<E, P>;
};

const pathHasParams = <P extends PathParts>(path: P) => {
  const result = path.some((part) => part.startsWith(":"));
  return result;
};

const isQueryScalar = (value: unknown): value is QueryScalar => {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
};

type QueryParamValue = QueryScalar | QueryScalar[] | undefined;

const appendQueryToUrl = (
  url: URL,
  query: Record<string, QueryParamValue>,
): void => {
  url.search = "";

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    if (value === null) {
      throw new Error(`Query parameter '${key}' cannot be null`);
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === null) {
          throw new Error(`Query parameter '${key}' cannot contain null`);
        }
        if (!isQueryScalar(item)) {
          throw new Error(
            `Query parameter '${key}' must be an array of primitive values`,
          );
        }
        url.searchParams.append(key, String(item));
      });
      return;
    }

    if (!isQueryScalar(value)) {
      throw new Error(
        `Query parameter '${key}' must be a primitive value or array of primitives`,
      );
    }

    url.searchParams.append(key, String(value));
  });
};

const createRequestUrl = (
  apiPath: string,
  host?: string,
  query?: Record<string, QueryParamValue>,
): string => {
  const url = new URL(apiPath, host ?? "http://cerato.local");

  if (query !== undefined) {
    appendQueryToUrl(url, query);
  }

  return host === undefined ? `${url.pathname}${url.search}` : url.toString();
};

const contentTypeHeaderForEndpoint = <E extends AnyEndpoint>(
  endpoint: E,
): { "Content-Type": "application/json" } | undefined => {
  if (endpoint.accepts === "json") {
    return { "Content-Type": "application/json" };
  } else if (endpoint.accepts === "multipart-form") {
    return undefined; // Let the browser set the header, it'll calculate some params itself
  }
};

export const createClient = <E extends AnyEndpoint, P extends PathParts>(
  path: P,
  endpoint: E,
  host?: string,
): ClientForEndpoint<E, AccumulatePathParams<P>> => {
  type PathParams = AccumulatePathParams<P>;

  const baseFetch = async (
    method: Methods,
    apiPath: string,
    body: FormData | string | undefined,
    extraHeaders: Record<string, string> | undefined,
  ): Promise<FetchClientResult<E>> => {
    const contentTypeHeader = contentTypeHeaderForEndpoint(endpoint);

    const response = await fetch(apiPath, {
      method: endpoint.allowedMethod,
      body,
      headers: {
        ...contentTypeHeader,
        Accept: "application/json",
        ...extraHeaders,
      },
    });

    if (endpoint.outputValidators !== undefined) {
      const status = response.status;
      if (status in endpoint.outputValidators) {
        // We have received a response code that we expected
        const validator = endpoint.outputValidators[status] as ZodAny;
        const responseBody = await response.json();
        const parsedResponseBody = validator.safeParse(responseBody);
        if (parsedResponseBody.success) {
          return { status, responseBody: parsedResponseBody.data };
        } else {
          console.error("Error parsing response body", {
            rawBody: responseBody,
          });
          throw new Error("Error parsing response body", {
            cause: parsedResponseBody.error,
          });
        }
      } else {
        // Uh oh, a response code we weren't expecting!
        throw new Error("Unexpected response code from endpoint", {
          cause: {
            status: response.status,
            path: apiPath,
            method,
          },
        });
      }
    }

    return undefined as OutputValidatorsForEndpoint<E>;
  };

  const fetchWithInputs = async (
    input: FetchClientInputs<E, PathParams>,
  ): Promise<FetchClientResult<E>> => {
    const resolvedPath = resolvePath(
      path,
      ("pathParams" in input ? input.pathParams : {}) as PathParams,
    );
    const apiPath = createRequestUrl(
      resolvedPath,
      host,
      "query" in input
        ? (input.query as Record<string, QueryParamValue>)
        : undefined,
    );

    let body: undefined | FormData | string;
    if ("body" in input) {
      if (endpoint.accepts === "json") {
        body = JSON.stringify(input.body);
      } else if (endpoint.accepts === "multipart-form") {
        const form = new FormData();
        const formBody = input.body as Record<
          string,
          string | Blob | undefined
        >;
        Object.entries(formBody).forEach(([k, v]) => {
          if (v !== undefined) {
            form.set(k, v);
          }
        });
        body = form;
      } else {
        throw new Error("Unknown Accepts parameter encountered for endpoint");
      }
    }

    const headers =
      "headers" in input
        ? (input.headers as Record<string, string>)
        : undefined;
    return baseFetch(endpoint.allowedMethod, apiPath, body, headers);
  };

  const fetchWithoutInputs = async (): Promise<FetchClientResult<E>> => {
    const apiPath = createRequestUrl(`/${path.join("/")}`, host);

    return baseFetch(endpoint.allowedMethod, apiPath, undefined, undefined);
  };

  const hasInputs =
    endpoint.inputValidator !== undefined ||
    endpoint.queryShape !== undefined ||
    pathHasParams(path) ||
    endpoint.requiredHeaders.length > 0;

  const client = {
    [endpoint.allowedMethod]: hasInputs
      ? (fetchWithInputs as ClientFunction<E, PathParams>)
      : (fetchWithoutInputs as ClientFunction<E, PathParams>),
  } as FetchClientForEndpoint<E, PathParams>;

  const finalClient = addInputValidator(endpoint, client);

  return finalClient;
};

export type FetchClientsForEndpointMapping<EM, Path extends PathParts> = {
  [K in keyof EM as K extends "children" ? never : K]: EM[K] extends AnyEndpoint
    ? ClientFunction<EM[K], AccumulatePathParams<Path>>
    : never;
};

type WithChildApiIfRequired<
  A extends API | undefined,
  Path extends PathParts = [],
> = A extends API ? ClientsForApi<A, Path> : {};

type ClientsForMulti<
  M extends AnyMulti,
  Path extends PathParts = [],
> = FetchClientsForEndpointMapping<EndpointMappingForMulti<M>, Path> &
  WithChildApiIfRequired<ChildrenForMulti<M>, Path>;

export type ClientsForApi<A extends API, Path extends PathParts = []> = {
  [k in keyof A]: A[k] extends AnyEndpoint
    ? ClientForEndpoint<A[k], AccumulatePathParams<[...Path, k & string]>>
    : A[k] extends AnyMulti
      ? ClientsForMulti<A[k], [...Path, k & string]>
      : ClientsForApi<A[k] & API, [...Path, k & string]>;
};

const createClientsForMulti = <M extends AnyMulti>(
  multi: M,
  basePath: PathParts,
  host?: string,
): ClientsForMulti<M> => {
  const mapping = multi.endpointMapping;
  const byMethod = mapping as Partial<Record<Methods, AnyEndpoint>>;
  let clientObj = {};

  for (const method of METHODS) {
    const endpoint = byMethod[method];
    if (endpoint !== undefined) {
      clientObj = { ...clientObj, ...createClient(basePath, endpoint, host) };
    }
  }

  if ("children" in mapping) {
    const childClients = createClientsFromApi(mapping.children, basePath, host);
    clientObj = { ...clientObj, ...childClients };
  }

  return clientObj as ClientsForMulti<M>;
};

export const createClientsFromApi = <A extends API>(
  api: A,
  basePath: PathParts = [],
  host?: string,
): ClientsForApi<A> => {
  const entries = typedEntries(api);
  const clientTree = entries.map(([k, v]) => {
    const newPath = [...basePath, k] as PathParts;

    if (v instanceof Endpoint) {
      return [k, createClient(newPath, v, host)];
    } else if (v instanceof Multi) {
      return [k, createClientsForMulti(v, newPath, host)];
    } else {
      return [k, createClientsFromApi(v, newPath, host)];
    }
  });
  return Object.fromEntries(clientTree);
};

type ResponseHandlers<E extends AnyEndpoint, R> = {
  [K in keyof OutputValidatorsForEndpoint<E>]: (
    body: ValuesOutputFor<OutputValidatorsForEndpoint<E>[K]>,
  ) => R;
};

/** Utility for handling each possible expected response from the backend. */
export const handleResponse = <E extends AnyEndpoint, R>(
  response: FetchClientResult<E>,
  handlers: ResponseHandlers<E, R>,
): R => {
  const { status, responseBody } = response;
  const handler = handlers[status];

  return handler(responseBody);
};
