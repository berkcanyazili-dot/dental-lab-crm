"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { FlaskConical, Loader2, MailCheck } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const [magicLinkMessage, setMagicLinkMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMagicLinkMessage("");
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.replace(result?.url || callbackUrl);
    router.refresh();
  }

  async function handleMagicLink() {
    setError("");
    setMagicLinkMessage("");

    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }

    setIsSendingMagicLink(true);
    const result = await signIn("email", {
      email,
      redirect: false,
      callbackUrl,
    });
    setIsSendingMagicLink(false);

    if (result?.error) {
      setError("We couldn’t send a magic link for that email.");
      return;
    }

    setMagicLinkMessage("Magic link sent. Check your email to sign in.");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-xl"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-600">
          <FlaskConical className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Dental Lab CRM</h1>
          <p className="text-sm text-gray-400">Sign in with password or request a magic link</p>
        </div>
      </div>

      <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
        className="mb-4 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
      />

      <label className="mb-2 block text-sm font-medium text-gray-200" htmlFor="password">
        Password
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        required
        className="mb-4 w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-500"
      />

      {error && (
        <p className="mb-4 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {magicLinkMessage && (
        <p className="mb-4 rounded-md border border-green-900/60 bg-green-950/40 px-3 py-2 text-sm text-green-200">
          {magicLinkMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign In
      </button>

      <div className="my-4 flex items-center gap-3 text-xs text-gray-500">
        <div className="h-px flex-1 bg-gray-800" />
        or
        <div className="h-px flex-1 bg-gray-800" />
      </div>

      <button
        type="button"
        onClick={handleMagicLink}
        disabled={isSendingMagicLink}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-700 bg-gray-950 px-4 py-2 text-sm font-semibold text-white transition hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSendingMagicLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
        Email Me a Magic Link
      </button>
    </form>
  );
}
