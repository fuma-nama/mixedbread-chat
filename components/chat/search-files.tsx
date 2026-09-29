"use client";

import { cn } from "cn";
import { SliceGlyph } from "@/components/brand/slice";
import { type Source, sourceTitle } from "@/lib/mixedbread/citations";
import { More, useFirst } from "./activity";
import { badge, originOf, SourcePreview, useHighlight } from "./citation";

/** Listed until the rest are asked for. */
const FIRST_FILES = 6;
const FIRST_CHUNKS = 5;

/** A cited chunk, with the label each search that found it gave it. */
interface Chunk {
  source: Source;
  labels: Set<string>;
}

/** A cited file or page, with its chunks in the order they sit in it. */
interface SourceFile {
  key: string;
  chunks: Chunk[];
  labels: Set<string>;
}

/** Files one row each, and chunks found again under another label merged. */
export function filesOf(sources: Source[]): SourceFile[] {
  const files = new Map<string, SourceFile>();
  const chunks = new Map<string, Chunk>();
  for (const source of sources) {
    const url = source.type === "url";
    const key = url ? source.url : source.fileId;
    let file = files.get(key);
    if (!file) {
      file = { key, chunks: [], labels: new Set() };
      files.set(key, file);
    }
    file.labels.add(source.label);
    const at = url ? source.url : source.chunkId;
    const chunk = chunks.get(at);
    if (chunk) {
      chunk.labels.add(source.label);
      continue;
    }
    const entry = { source, labels: new Set([source.label]) };
    chunks.set(at, entry);
    file.chunks.push(entry);
  }
  const list = Array.from(files.values());
  for (const file of list) file.chunks.sort(byPlace);
  return list;
}

/** Where a chunk sits in its file, from 1: for a visually parsed PDF, its page. */
function place(source: Source): number {
  return source.type === "file" ? source.chunkIndex + 1 : 0;
}

function byPlace(a: Chunk, b: Chunk): number {
  return place(a.source) - place(b.source);
}

/** What the searches cited, a row per file: the first few, and the rest on request. */
export function SourceList({ files }: { files: SourceFile[] }) {
  const { shown, more, showAll } = useFirst(files, FIRST_FILES);

  return (
    <div className="flex flex-col gap-1">
      <ol aria-label="Sources found" className="flex flex-col">
        {shown.map((file, index) => (
          <FileRow key={file.key} file={file} index={index} />
        ))}
      </ol>
      {more > 0 && <More count={more} onClick={showAll} />}
    </div>
  );
}

const nameText =
  "truncate text-foreground/80 transition-colors group-hover/source:text-foreground group-data-[lit=true]/source:text-foreground";
const originText =
  "ml-auto max-w-[45%] shrink-0 truncate pl-3 font-mono text-[11px] text-muted-foreground/80";
const marker = "flex h-4.5 min-w-4.5 shrink-0 px-1 text-[10.5px]";

/**
 * A file and what was cited in it. With one chunk the row previews it; with
 * more, each gets a marker with its page or place, and pointing at the file
 * lights all of them, here and in the answer.
 */
function FileRow({ file, index }: { file: SourceFile; index: number }) {
  const highlight = useHighlight();
  const { shown, more, showAll } = useFirst(file.chunks, FIRST_CHUNKS);
  const [first] = file.chunks;
  const title = sourceTitle(first.source);
  const glyph = (
    <SliceGlyph
      className="size-3 text-berry motion-safe:animate-settle"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    />
  );

  if (file.chunks.length === 1) {
    return (
      <li>
        <SourcePreview
          source={first.source}
          labels={first.labels}
          align="start"
          className="group/source flex h-6.5 w-full min-w-0 items-center gap-2 rounded-md text-left text-[12.5px] outline-offset-0 outline-ring focus-visible:outline-2 aria-[haspopup=dialog]:cursor-pointer"
        >
          {glyph}
          <span className={nameText}>{title}</span>
          <span className={originText}>{originOf(first.source)}</span>
        </SourcePreview>
      </li>
    );
  }

  const kind =
    first.source.type === "file" && first.source.image ? "page" : "passage";
  return (
    <li
      onPointerEnter={() => highlight.set(file.labels)}
      onPointerLeave={() => highlight.set(undefined)}
      className="group/source flex min-w-0 items-start gap-2 text-[12.5px]"
    >
      <span className="flex h-6.5 items-center">{glyph}</span>
      {/* Past the room the name leaves, the markers wrap under it. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1">
        <span
          className={cn(
            nameText,
            "max-w-full pr-1 group-has-data-[lit=true]/source:text-foreground",
          )}
        >
          {title}
        </span>
        {shown.map(({ source, labels }) => (
          <SourcePreview
            key={source.label}
            source={source}
            labels={labels}
            rest={file.labels}
            align="start"
            aria-label={`${title}, ${kind} ${place(source)}`}
            className={cn(badge, marker)}
          >
            {place(source)}
          </SourcePreview>
        ))}
        {more > 0 && (
          <button
            type="button"
            aria-label={`${more} more`}
            onClick={showAll}
            className={cn(badge, marker, "hover:bg-soft hover:text-foreground")}
          >
            +{more}
          </button>
        )}
      </span>
      <span className={cn(originText, "leading-6.5")}>
        {originOf(first.source)}
      </span>
    </li>
  );
}
