import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/shared/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

  if (!isAuthDisabled) {
    const cookieStore = await cookies();
    const token = cookieStore.get("mb_token")?.value;

    if (!token) {
      redirect("/login");
    }
  }

  return <AppShell>{children}</AppShell>;
}
