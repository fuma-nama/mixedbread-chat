import assert from "node:assert/strict";
import { test } from "node:test";
import { childrenOf, latestLeaf, pathTo, withPath } from "./branches.ts";

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
    childrenOf(messages)
      .get("1")
      ?.map((message) => message.id),
    ["2", "4"],
  );
});

test("follows the latest reply down to a leaf", () => {
  const children = childrenOf(messages);
  assert.equal(latestLeaf(children, "1"), "5");
  assert.equal(latestLeaf(children, "2"), "3");
});

test("adds the messages of a path the tree has not seen", () => {
  const merged = withPath(messages, [{ id: "1" }, { id: "6" }, { id: "7" }]);
  assert.deepEqual(merged.slice(5), [
    { id: "6", parentId: "1" },
    { id: "7", parentId: "6" },
  ]);
  assert.equal(withPath(messages, [{ id: "1" }, { id: "2" }]), messages);
});
