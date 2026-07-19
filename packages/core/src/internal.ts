// The shared surface that Cerato's own adapters (client-fetch, server-hono)
// build against — the `Endpoint`/`Multi` classes, path/type helpers, and
// response-code guards. It is intentionally separate from the public `.`
// entry so end users get a small, curated API while adapters can reach the
// building blocks they need. Not covered by semver for external consumers.
export * from "./Endpoint";
export * from "./path-utils";
export * from "./status-utils";
export * from "./type-utils";
