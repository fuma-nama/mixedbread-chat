/**
 * Messages form a tree: editing a message or retrying an answer adds a
 * sibling under the same parent. A conversation is one path through it.
 */
export interface Branched {
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

/** The messages that share `parentId`, oldest first. */
export function siblingsOf<T extends Branched>(
  messages: T[],
  parentId: string | null,
): T[] {
  return messages.filter((message) => message.parentId === parentId);
}

/** The newest leaf below `id`, following the latest reply at each step. */
export function latestLeaf(messages: Branched[], id: string): string {
  let leaf = id;
  for (;;) {
    const children = siblingsOf(messages, leaf);
    if (children.length === 0) return leaf;
    leaf = children[children.length - 1].id;
  }
}
