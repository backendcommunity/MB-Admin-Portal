import { NextResponse, type NextRequest } from "next/server";

import { enrollMember, listMembers, removeMember } from "@/lib/mock/cohortsStore";
import { getUserById, listUsers } from "@/lib/mock/usersStore";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json({ data: listMembers(Number(id)) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const email = String(body.email || "").toLowerCase();
  const user = listUsers().find((item) => item.email.toLowerCase() === email) || null;

  if (!user) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const member = enrollMember(Number(id), {
    name: user.name,
    email: user.email,
    role: user.role,
  });

  if (!member) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(member, { status: 201 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const memberId = Number(url.searchParams.get("memberId"));
  const ok = removeMember(Number(id), memberId);

  if (!ok) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
