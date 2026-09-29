import { HalftoneMark } from "@/components/brand/halftone-mark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-80 flex-col items-center text-center">
        <div className="h-20 w-36">
          <HalftoneMark />
        </div>
        {children}
      </div>
    </main>
  );
}
