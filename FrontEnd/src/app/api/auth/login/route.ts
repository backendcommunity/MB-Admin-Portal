import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.toLowerCase() : "";

  const role = email.includes("instructor")
    ? "INSTRUCTOR"
    : email.includes("admin")
      ? "ADMIN"
      : "SUPER_ADMIN";

  return NextResponse.json({
    token: `dev-token-${role.toLowerCase()}`,
    role,
  });
}
