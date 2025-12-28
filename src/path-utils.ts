/** biome-ignore-all lint/complexity/noBannedTypes: EmptyRecord doesn't work in these cases */
import type { PathParts } from "./api";

// Extract path parameters from a string key
export type ExtractPathParams<K extends string> = K extends `:${infer Param}` ? { [P in Param]: string } : {};

// Accumulate path parameters from all keys in a path
export type AccumulatePathParams<Keys extends readonly string[]> = Keys extends readonly [infer First, ...infer Rest]
  ? First extends string
    ? Rest extends readonly string[]
      ? ExtractPathParams<First> & AccumulatePathParams<Rest>
      : ExtractPathParams<First>
    : {}
  : {};

export const resolvePath = <P extends PathParts>(path: P, inputs: AccumulatePathParams<P>): string => {
  // Need to forget information here because TS is being difficult.
  const params: Record<string, string> = inputs;

  const resolvedParts = path.map((part) => {
    if (part.startsWith(":")) {
      return params[part.slice(1)];
    }
    return part;
  });

  return `/${resolvedParts.join("/")}`;
};
