import { expect, test } from "vitest";
import { resolvePath } from "../src/path-utils";

test("resolvePath leaves a static path untouched", () => {
  expect(resolvePath(["api", "tasks"], {})).toBe("/api/tasks");
});

test("resolvePath substitutes a single param", () => {
  expect(resolvePath(["tasks", ":taskId"], { taskId: "42" })).toBe("/tasks/42");
});

test("resolvePath substitutes multiple params in order", () => {
  const path = ["users", ":userId", "posts", ":postId"] as const;

  expect(resolvePath(path, { userId: "u1", postId: "p9" })).toBe(
    "/users/u1/posts/p9",
  );
});
