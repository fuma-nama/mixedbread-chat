import assert from "node:assert/strict";
import { test } from "node:test";
import { latestLeaf, pathTo, siblingsOf } from "./branches.ts";

// 1 ─ 2 ─ 3
//   └ 4 ─ 5   (message 2 edited as 4, then answered with 5)
const messages = [
  { id: "1", parentId: null },
  { id: "2", parentId: "1" },
  { id: "3", parentId: "2" },
  { id: "4", parentId: "1" },
  { id: "5", parentId: "4" },
];

test("walks from the root to a leaf", () => {
  assert.deepEqual(
    pathTo(messages, "3").map((message) => message.id),
    ["1", "2", "3"],
  );
  assert.deepEqual(pathTo(messages, null), []);
});

test("lists edits and retries as siblings, oldest first", () => {
  assert.deepEqual(
    siblingsOf(messages, "1").map((message) => message.id),
    ["2", "4"],
  );
});

test("follows the latest reply down to a leaf", () => {
  assert.equal(latestLeaf(messages, "1"), "5");
  assert.equal(latestLeaf(messages, "2"), "3");
});
