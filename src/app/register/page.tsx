import Link from "next/link";

import { registerAction } from "@/app/actions/auth";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const { error } = await searchParams;

  return (
    <section className="narrow-page">
      <p className="eyebrow">Seat check</p>
      <h1>Claim a seat</h1>
      <form action={registerAction} className="form-panel">
        {error ? <p className="form-error">{error}</p> : null}
        <label>
          Username
          <input
            name="username"
            type="text"
            autoComplete="username"
            minLength={3}
            maxLength={24}
            required
          />
        </label>
        <label>
          Display name
          <input
            name="displayName"
            type="text"
            autoComplete="nickname"
            maxLength={32}
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
          />
        </label>
        <button type="submit">
          Create account
        </button>
      </form>
      <p className="muted">
        <Link href="/login">Already registered?</Link>
      </p>
    </section>
  );
}
