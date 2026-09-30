import { cn } from "cn";

export function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className={cn("size-4 motion-safe:animate-spin", className)}
      {...props}
    >
      <circle cx="8" cy="8" r="6.25" opacity="0.2" />
      <path d="M14.25 8A6.25 6.25 0 0 0 8 1.75" />
    </svg>
  );
}
