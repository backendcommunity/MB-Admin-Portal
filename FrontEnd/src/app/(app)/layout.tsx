import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/shared/AppShell";

export default function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const token = cookies().get("mb_token")?.value;
  if (!token) {
    redirect("/login");
  }

  return <AppShell>{children}</AppShell>;
}
