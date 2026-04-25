import { Suspense } from "react";
import LoginForm from "./LoginForm";

function LoginFallback() {
  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-800 bg-gray-900 p-6 shadow-xl">
      <div className="h-10 w-10 rounded-lg bg-gray-800" />
      <div className="mt-6 h-9 rounded-md bg-gray-800" />
      <div className="mt-4 h-9 rounded-md bg-gray-800" />
      <div className="mt-4 h-9 rounded-md bg-gray-800" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
