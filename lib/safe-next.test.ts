import assert from "node:assert/strict";
import { test } from "node:test";
import { safeNext } from "./safe-next.ts";

test("keeps paths on this site and drops every spelling of another origin", () => {
  assert.equal(safeNext("/c/abc?x=1#S2"), "/c/abc?x=1#S2");
  for (const next of [
    "//evil.com",
    "/\\evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r/evil.com",
    "https://evil.com",
    "evil.com",
    undefined,
    ["/c/abc"],
  ]) {
    assert.equal(safeNext(next), "/");
  }
});
