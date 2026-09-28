import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <>
      <h1 className="font-heading text-2xl font-semibold">Log in</h1>
      <AuthForm mode="login" />
      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/register" className="text-foreground underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
