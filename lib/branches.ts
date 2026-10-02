// A message tree: edits and retries are siblings, and a conversation is one path.
interface Branched {
  id: string;
  parentId: string | null;
}

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

/** Replies by parent id, oldest first. */
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

/** Follows the latest reply down from `id`. */
export function latestLeaf(
  children: Map<string | null, Branched[]>,
  id: string,
): string {
  let leaf = id;
  let replies = children.get(leaf);
  while (replies) {
    leaf = replies[replies.length - 1].id;
    replies = children.get(leaf);
  }
  return leaf;
}
