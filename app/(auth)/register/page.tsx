import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Sign up</h1>
        <p className="text-muted-foreground">
          Keep your chats on every device. Chats from this browser come with
          you.
        </p>
      </div>
      <AuthForm mode="register" />
      <p className="text-sm text-muted-foreground">
        Have an account?{" "}
        <Link href="/login" className="text-foreground underline">
          Log in
        </Link>
      </p>
    </>
  );
}
