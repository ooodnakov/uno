import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";

import "./globals.css";

const displayFont = Unbounded({
  subsets: ["cyrillic", "latin"],
  variable: "--display-font",
  weight: ["700", "900"],
});

const bodyFont = Manrope({
  subsets: ["cyrillic", "latin"],
  variable: "--body-font",
});

const monoFont = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  variable: "--mono-font",
});

export const metadata: Metadata = {
  title: "ONE / Odin",
  description: "A real-time multiplayer color and number card game.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <header className="topbar">
          <Link className="brand" href="/">
            ONE / Один
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/lobby">Lobby</Link>
            {user ? (
              <form action={logoutAction}>
                <button className="link-button" type="submit">
                  Logout {user.displayName}
                </button>
              </form>
            ) : (
              <>
                <Link href="/login">Login</Link>
                <Link href="/register">Register</Link>
              </>
            )}
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
