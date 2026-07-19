---
"@cerato/server-hono": patch
---

Thread a typed Hono `Env` through `createHonoServer` and the handler tree. A
handler can now read context variables that server-owned middleware set on the
request (e.g. an authenticated identity) as a typed value instead of casting
`ctx.hono`. `Env` is the new final type argument on `createHonoServer` and
`HonoHandlersFor`, defaulting to `BlankEnv`, so existing call sites are
unchanged.
