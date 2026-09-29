/**
 * Messages form a tree: editing a message or retrying an answer adds a
 * sibling under the same parent. A conversation is one path through it.
 */
interface Branched {
  id: string;
  parentId: string | null;
}

/** The messages from the root down to `leafId`. */
export function pathTo<T extends Branched>(
  messages: T[],
  leafId: string | null,
): T[] {
  const byId = new Map<string, T>();
  for (const message of messages) byId.set(message.id, message);

  const path: T[] = [];
  let node = leafId ? byId.get(leafId) : undefined;
  while (node) {
    path.push(node);
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }
  return path.reverse();
}

/** Each message's replies by its id, oldest first; the first messages are under `null`. */
export function childrenOf<T extends Branched>(
  messages: T[],
): Map<string | null, T[]> {
  const children = new Map<string | null, T[]>();
  for (const message of messages) {
    const siblings = children.get(message.parentId);
    if (siblings) siblings.push(message);
    else children.set(message.parentId, [message]);
  }
  return children;
}

/** The newest leaf below `id`, following the latest reply at each step. */
export function latestLeaf(
  children: Map<string | null, Branched[]>,
  id: string,
): string {
  let leaf = id;
  for (
    let replies = children.get(leaf);
    replies;
    replies = children.get(leaf)
  ) {
    leaf = replies[replies.length - 1].id;
  }
  return leaf;
}

/** `tree`, plus the messages on `path` it has not seen yet, each under the one before it. */
export function withPath<T extends Branched>(
  tree: T[],
  path: Omit<T, "parentId">[],
): T[] {
  const known = new Set<string>();
  for (const message of tree) known.add(message.id);

  let merged = tree;
  for (let i = 0; i < path.length; i++) {
    if (known.has(path[i].id)) continue;
    if (merged === tree) merged = [...tree];
    merged.push({ ...path[i], parentId: path[i - 1]?.id ?? null } as T);
  }
  return merged;
}
