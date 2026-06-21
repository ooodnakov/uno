"use server";

import { redirect } from "next/navigation";

import { loginUser, logoutUser, registerUser } from "@/lib/auth/users";

export async function registerAction(formData: FormData) {
  const result = await registerUser({
    username: formData.get("username"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
  });

  if (!result.ok) {
    redirect(`/register?error=${encodeURIComponent(result.message ?? "")}`);
  }

  redirect("/lobby");
}

export async function loginAction(formData: FormData) {
  const result = await loginUser({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.message ?? "")}`);
  }

  redirect("/lobby");
}

export async function logoutAction() {
  await logoutUser();
  redirect("/login");
}
