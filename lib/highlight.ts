/** Indexes of the blocks that share enough words with the claim. */
export function highlight(claim: string, blocks: { text: string }[]): number[] {
  const words = wordsOf(claim);
  const marked: number[] = [];
  let best = -1;
  let most = 0;
  for (let i = 0; i < blocks.length; i++) {
    const found = wordsOf(blocks[i].text);
    let shared = 0;
    for (const word of words) if (found.has(word)) shared++;
    if (shared > 1 && shared >= words.size / 2) marked.push(i);
    if (shared > most) {
      best = i;
      most = shared;
    }
  }
  if (marked.length === 0 && most > 1 && most >= words.size / 4) {
    marked.push(best);
  }
  return marked;
}

function wordsOf(text: string): Set<string> {
  const words = new Set<string>();
  for (const [word] of text.toLowerCase().matchAll(/[\p{L}\p{N}]{4,}/gu)) {
    words.add(word);
  }
  return words;
}
