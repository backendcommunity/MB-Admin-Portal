import { NextRequest, NextResponse } from "next/server";

import { mapAcademyRoleToPortalRole } from "@/lib/auth/roleMapping";

const ACADEMY_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://demo.masteringbackend.com/api/v3";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("mb_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const response = await fetch(`${ACADEMY_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Cookie: `mb_token=${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    data?: {
      role?: string;
      [key: string]: unknown;
    };
  };

  if (!response.ok || !payload.data) {
    const res = NextResponse.json(
      {
        authenticated: false,
        message: payload.message || "Unauthorized",
      },
      { status: 401 }
    );

    res.cookies.set({
      name: "mb_token",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return res;
  }

  return NextResponse.json({
    authenticated: true,
    role: mapAcademyRoleToPortalRole(payload.data.role),
    user: payload.data,
  });
}
