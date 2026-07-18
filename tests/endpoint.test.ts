import { expect, expectTypeOf, test } from "vitest";
import z from "zod";
import { Endpoint } from "../src/index";

test("builder records method, headers, and accepts on the endpoint", () => {
  const endpoint = Endpoint.post()
    .header("authorization")
    .header("x-request-id")
    .multipart();

  expect(endpoint.allowedMethod).toBe("POST");
  expect(endpoint.requiredHeaders).toEqual(["authorization", "x-request-id"]);
  expect(endpoint.accepts).toBe("multipart-form");
});

test("accepts defaults to json when never set", () => {
  const endpoint = Endpoint.get();

  expect(endpoint.accepts).toBe("json");
  expect(endpoint.requiredHeaders).toEqual([]);
});

test("output collects a validator per declared status code", () => {
  const okSchema = z.object({ id: z.string() });
  const notFoundSchema = z.object({ message: z.string() });

  const endpoint = Endpoint.get()
    .output(200, okSchema)
    .output(404, notFoundSchema);

  expect(endpoint.outputValidators?.[200]).toBe(okSchema);
  expect(endpoint.outputValidators?.[404]).toBe(notFoundSchema);
});

test("switching method preserves the accepts setting at runtime", () => {
  const endpoint = Endpoint.multipart().post();

  expect(endpoint.allowedMethod).toBe("POST");
  expect(endpoint.accepts).toBe("multipart-form");
});

test("builder methods carry the accepts type parameter through", () => {
  // Regression: get()/post()/input()/output()/header() used to drop the
  // accepts type param, so a multipart endpoint would type as json after any
  // further chaining even though the runtime value was preserved.
  type AcceptsOf<E> =
    E extends Endpoint<
      infer _M,
      infer _I,
      infer _O,
      infer _Q,
      infer _H,
      infer A
    >
      ? A
      : never;

  const endpoint = Endpoint.multipart()
    .post()
    .input(z.object({ f: z.string() }));

  expectTypeOf<AcceptsOf<typeof endpoint>>().toEqualTypeOf<"multipart-form">();
});
