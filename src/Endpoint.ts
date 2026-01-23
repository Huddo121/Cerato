/** biome-ignore-all lint/suspicious/noExplicitAny: Want to infer the actual type at call sites, need top type */
/** biome-ignore-all lint/complexity/noBannedTypes: I am doing some shenanigans */
import z, { type ZodUndefined } from "zod";
import type { PathPart, PathParts } from "./api";
import { type EmptyRecord, type ToTuples, typedEntries } from "./type-utils";

export type Methods = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type NonContentfulResponseCode = 204;
// TODO: When adding 204 Hono will be upset because that's not supposed to return content, need to protect from 204 in response
export type ResponseCode =
  | 200
  | 201
  | 202
  | 301
  | 302
  | 307
  | 308
  | 400
  | 401
  | 403
  | 404
  | 429
  | 500
  | NonContentfulResponseCode;

export type OutputMapping = { [c in ResponseCode]?: z.ZodType };

export type Accepts = "json" | "multipart-form";

export type EndpointParams<
  M extends Methods,
  I,
  O extends OutputMapping | undefined,
  H,
  A extends Accepts,
> = {
  method: M;
  inputValidator?: z.ZodType<I>;
  outputValidators?: O;
  requiredHeaders?: (keyof H)[];
  accepts?: A;
};

type AddOutput<
  O extends OutputMapping | undefined,
  C extends ResponseCode,
  Z extends z.ZodType,
> = O extends undefined ? { [c in C]: Z } : O & { [c in C]: Z };

/** Add a key-value pair to a possibly-undefined record */
type WithProperty<O, K extends string, V> = O extends undefined
  ? { [k in K]: V }
  : O & { [k in K]: V };

export interface API {
  [k: string]: API | AnyEndpoint | AnyMulti;
}

type MappedApi<A extends API, R> = {
  [K in keyof A as string]: A[K] extends AnyEndpoint | AnyMulti
    ? R
    : MappedApi<A[K] & API, R>;
};

const mapApiRecurse = <A extends API, R>(
  api: A,
  f: (path: PathParts, endpoint: AnyEndpoint | AnyMulti) => R,
  path: PathParts,
): MappedApi<A, R> => {
  const entries = typedEntries(api);
  const updatedEntries = entries.map(([part, value]) => {
    const currentPath = path.concat(part as PathPart);
    if (value instanceof Multi || value instanceof Endpoint) {
      return [part, f(currentPath, value)];
    } else {
      return [part, mapApiRecurse(value, f, currentPath)];
    }
  });

  return Object.fromEntries(updatedEntries);
};

export const mapApi = <A extends API, R>(
  api: A,
  f: (path: PathParts, endpoint: AnyEndpoint | AnyMulti) => R,
): MappedApi<A, R> => {
  return mapApiRecurse(api, f, []);
};

/**
 * Provide a way of combining key-value pairs, excluding the key if the right-hand type is undefined
 */
export type Possibly<
  K extends string,
  E extends AnyEndpoint | API | undefined,
> = E extends AnyEndpoint | API ? { [k in K]: E } : {};

export type EndpointMapping<
  GET extends AnyGetEndpoint | undefined,
  POST extends AnyPostEndpoint | undefined,
  PUT extends AnyPutEndpoint | undefined,
  PATCH extends AnyPatchEndpoint | undefined,
  DELETE extends AnyDeleteEndpoint | undefined,
  C extends API | undefined,
> = Possibly<"GET", GET> &
  Possibly<"POST", POST> &
  Possibly<"PUT", PUT> &
  Possibly<"PATCH", PATCH> &
  Possibly<"DELETE", DELETE> &
  Possibly<"children", C>;

export type AnyEndpointMapping = EndpointMapping<
  AnyGetEndpoint | undefined,
  AnyPostEndpoint | undefined,
  AnyPutEndpoint | undefined,
  AnyPatchEndpoint | undefined,
  AnyDeleteEndpoint | undefined,
  API | undefined
>;

export class Multi<M extends AnyEndpointMapping> {
  constructor(readonly endpointMapping: M) {}

  // TODO: Add a fold method to prevent future mismatches in method handling
  // TODO: methods for extending a Multi

  get children(): ChildrenForEndpointMapping<M> {
    // Use a type assertion to satisfy the type system.
    // If children does not exist, return undefined.
    return (this.endpointMapping as { children?: unknown })
      .children as ChildrenForEndpointMapping<M>;
  }
}

export type AnyMulti = Multi<AnyEndpointMapping>;

/** A single handler for requests that are routed to it */
export class Endpoint<
  M extends Methods = "GET",
  I = undefined,
  O extends OutputMapping | undefined = undefined,
  Q = undefined,
  H extends Record<string, string> | undefined = undefined,
  A extends Accepts = "json",
> {
  readonly inputValidator: z.ZodType<I> | undefined;
  readonly outputValidators: O | undefined;
  readonly allowedMethod: M;
  readonly requiredHeaders: (keyof H)[];
  readonly accepts: Accepts;

  constructor(params: EndpointParams<M, I, O, H, A>) {
    this.allowedMethod = params.method;
    this.inputValidator = params.inputValidator;
    this.outputValidators = params.outputValidators;
    this.requiredHeaders = params.requiredHeaders ?? [];
    this.accepts = params.accepts ?? "json";
  }

  method<M2 extends Methods>(method: M2): Endpoint<M2, I, O, Q, H> {
    return this.clone({ method });
  }

  static method<M extends Methods>(allowedMethods: M): Endpoint<M> {
    return new Endpoint({ method: allowedMethods });
  }

  get(): Endpoint<"GET", I, O, Q, H> {
    return this.clone({ method: "GET" });
  }

  static get(): Endpoint<"GET"> {
    return new Endpoint({ method: "GET" });
  }

  post(): Endpoint<"POST", I, O, Q, H> {
    return this.clone({ method: "POST" });
  }

  static post(): Endpoint<"POST"> {
    return new Endpoint({ method: "POST" });
  }

  put(): Endpoint<"PUT", I, O, Q, H> {
    return this.clone({ method: "PUT" });
  }

  static put(): Endpoint<"PUT"> {
    return new Endpoint({ method: "PUT" });
  }

  patch(): Endpoint<"PATCH", I, O, Q, H> {
    return this.clone({ method: "PATCH" });
  }

  static patch(): Endpoint<"PATCH"> {
    return new Endpoint({ method: "PATCH" });
  }

  delete(): Endpoint<"DELETE", I, O, Q, H> {
    return this.clone({ method: "DELETE" });
  }

  static delete(): Endpoint<"DELETE"> {
    return new Endpoint({ method: "DELETE" });
  }

  input<I2>(validator: z.ZodType<I2>): Endpoint<M, I2, O, Q, H> {
    return this.clone({ inputValidator: validator });
  }

  static input<ZI>(
    validator: z.ZodType<ZI>,
  ): Endpoint<"POST", ZI, EmptyRecord, undefined, undefined> {
    return new Endpoint({ method: "POST", inputValidator: validator });
  }

  output<C extends ResponseCode, Z extends z.ZodType = ZodUndefined>(
    code: C,
    validator?: Z,
  ): Endpoint<M, I, AddOutput<O, C, Z>, Q, H> {
    const updatedValidators = Object.assign({}, this.outputValidators ?? {}, {
      [code]: validator ?? z.undefined(),
    }) as AddOutput<O, C, Z>;
    return this.clone({ outputValidators: updatedValidators });
  }

  static output<C extends ResponseCode, Z extends z.ZodType>(
    code: C,
    validator: Z,
  ): Endpoint<
    "GET",
    undefined,
    AddOutput<undefined, C, Z>,
    undefined,
    undefined
  > {
    return new Endpoint({
      method: "GET",
      outputValidators: { [code]: validator },
    });
  }

  header<K extends string>(
    headerName: K,
  ): Endpoint<M, I, O, Q, WithProperty<H, K, string>> {
    return this.clone({
      requiredHeaders: [
        ...(this.requiredHeaders as (keyof H)[]),
        headerName,
      ] as (keyof WithProperty<H, K, string>)[],
    });
  }

  json(): Endpoint<M, I, O, Q, H, "json"> {
    return this.clone({ accepts: "json" });
  }

  static json(): Endpoint<
    "GET",
    undefined,
    undefined,
    undefined,
    undefined,
    "json"
  > {
    return new Endpoint({ method: "GET", accepts: "json" });
  }

  multipart(): Endpoint<M, I, O, Q, H, "multipart-form"> {
    return this.clone({ accepts: "multipart-form" });
  }

  static multipart(): Endpoint<
    "GET",
    undefined,
    undefined,
    undefined,
    undefined,
    "multipart-form"
  > {
    return new Endpoint({ method: "GET", accepts: "multipart-form" });
  }

  private clone<
    M2 extends Methods = M,
    I2 = I,
    O2 extends OutputMapping | undefined = O,
    Q2 = Q,
    H2 extends Record<string, string> | undefined = H,
    A2 extends Accepts = A,
  >(
    overrides: Partial<EndpointParams<M2, I2, O2, H2, A2>>,
  ): Endpoint<M2, I2, O2, Q2, H2, A2> {
    return new Endpoint<M2, I2, O2, Q2, H2, A2>({
      method: (overrides.method ?? this.allowedMethod) as M2,
      inputValidator: (overrides.inputValidator ??
        this.inputValidator) as z.ZodType<I2>,
      outputValidators: (overrides.outputValidators ??
        this.outputValidators) as O2,
      requiredHeaders: (overrides.requiredHeaders ??
        this.requiredHeaders) as (keyof H2)[],
      accepts: (overrides.accepts ?? this.accepts) as A2,
    });
  }

  static multi<M extends AnyEndpointMapping>(endpointMapping: M): Multi<M> {
    return new Multi(endpointMapping);
  }
}
/** Utility type to extract the Output type of a zod parser */
type ValuesOutputFor<T extends z.ZodType> =
  T extends z.ZodType<infer Out> ? Out : never;

export type AnyEndpoint = Endpoint<Methods, any, any, any, any>;
export type AnyGetEndpoint = Endpoint<"GET", any, any, any, any>;
export type AnyPostEndpoint = Endpoint<"POST", any, any, any, any>;
export type AnyPutEndpoint = Endpoint<"PUT", any, any, any, any>;
export type AnyPatchEndpoint = Endpoint<"PATCH", any, any, any, any>;
export type AnyDeleteEndpoint = Endpoint<"DELETE", any, any, any, any>;

export type MethodForEndpoint<E extends AnyEndpoint> =
  E extends Endpoint<infer M, any, any, any, any> ? M : never;
export type InputForEndpoint<E extends AnyEndpoint> =
  E extends Endpoint<any, infer I, any, any, any> ? I : never;
/** A mapping between the response status code and the validator of the expected response body */
export type OutputValidatorsForEndpoint<E extends AnyEndpoint> =
  E extends Endpoint<any, any, infer O, any, any> ? O : never;
/** A mapping between the response status code and the shape of the expected response body */
export type OutputsForEndpoint<E extends AnyEndpoint> = {
  [K in keyof OutputValidatorsForEndpoint<E>]: ValuesOutputFor<
    OutputValidatorsForEndpoint<E>[K]
  >;
};
export type OutputValidatorForResponseCode<
  C extends ResponseCode,
  O extends OutputMapping,
> = O[C];

/** Given an endpoint, what are the possible [ResponseCode, output value] pairs that the API expects */
export type ResponsesForEndpoint<E extends AnyEndpoint> = ToTuples<{
  [K in keyof OutputValidatorsForEndpoint<E>]: ValuesOutputFor<
    OutputValidatorsForEndpoint<E>[K]
  >;
}>;

export type EndpointMappingForMulti<M extends AnyMulti> =
  M extends Multi<infer EP> ? EP : never;
export type ChildrenForEndpointMapping<MP extends AnyEndpointMapping> =
  MP extends EndpointMapping<
    infer _G,
    infer _P,
    infer _PUT,
    infer _PATCH,
    infer _D,
    infer C
  >
    ? C
    : never;
export type ChildrenForMulti<M extends AnyMulti> = ChildrenForEndpointMapping<
  EndpointMappingForMulti<M>
>;

/** For an {@link EndpointMapping}, get the mapping for the methods to the {@link API} or {@link Endpoint} that should exist on this current path */
type RoutesForEndpointMapping<MP extends AnyEndpointMapping> = {
  [K in keyof MP as K extends "children" ? never : K]: Exclude<
    MP[K],
    undefined
  >;
};
export type RoutesForMulti<M extends AnyMulti> = RoutesForEndpointMapping<
  EndpointMappingForMulti<M>
>;
