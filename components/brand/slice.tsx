import { cn } from "cn";

export const SLICE_PATH =
  "M2.9 8.2C1.9 7.9 1.2 7.2 1.2 6.2 1.2 3.6 4.3 1.6 8 1.6s6.8 2 6.8 4.6c0 1-.7 1.7-1.7 2v5.2c0 .8-.6 1.4-1.4 1.4H4.3c-.8 0-1.4-.6-1.4-1.4z";

export function SliceGlyph({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
      style={style}
    >
      <path fill="currentColor" d={SLICE_PATH} />
    </svg>
  );
}
