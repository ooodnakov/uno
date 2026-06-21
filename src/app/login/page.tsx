import Link from "next/link";

import { loginAction } from "@/app/actions/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <section className="narrow-page">
      <h1>Login</h1>
      <form action={loginAction} className="form-panel">
        {error ? <p className="form-error">{error}</p> : null}
        <label>
          Username
          <input name="username" type="text" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button type="submit">
          Login
        </button>
      </form>
      <p className="muted">
        <Link href="/register">Create an account</Link>
      </p>
    </section>
  );
}
