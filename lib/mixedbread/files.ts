import type { Mixedbread } from "@mixedbread/sdk";
import { z } from "zod";

/** A cited page, as the file's visual parsing saw it. */
export interface Page {
  /** The page as an image; the link expires within the hour. */
  image: string;
  /** The whole file, opened at the page; it expires too. */
  original: string;
  /** Width over height, when the layout is known. */
  aspect?: number;
  /** Its blocks of text, placed in fractions of the page. */
  blocks: {
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }[];
}

const metadataSchema = z.object({
  layout: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    elements: z.array(
      z.object({
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        text: z.string().nullish(),
      }),
    ),
  }),
});

/**
 * The page behind a cited chunk, or nothing when the chunk isn't an image.
 * A chunk ID is `file_id:index`, and visual parsing makes a chunk of each page.
 */
export async function fetchPage(
  client: Mixedbread,
  storeId: string,
  chunkId: string,
): Promise<Page | undefined> {
  const split = chunkId.lastIndexOf(":");
  const index = Number(chunkId.slice(split + 1));
  const file = await client.stores.files.retrieve(chunkId.slice(0, split), {
    store_identifier: storeId,
    return_chunks: [index],
  });
  const chunk = file.chunks?.find((entry) => entry.chunk_index === index);
  if (chunk?.type !== "image_url" || !chunk.image_url) return;

  const page: Page = {
    image: chunk.image_url.url,
    original: `${file.content_url}#page=${index + 1}`,
    blocks: [],
  };
  const metadata = metadataSchema.safeParse(chunk.generated_metadata);
  if (metadata.success) {
    const { width, height, elements } = metadata.data.layout;
    page.aspect = width / height;
    for (const { bbox, text } of elements) {
      const [left, top, right, bottom] = bbox;
      page.blocks.push({
        x: left / width,
        y: top / height,
        width: (right - left) / width,
        height: (bottom - top) / height,
        text: text ?? "",
      });
    }
  }
  return page;
}
