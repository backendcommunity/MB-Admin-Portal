import { NextResponse, type NextRequest } from "next/server";

import {
  changeUserRole,
  deleteUser,
  getUserById,
  resetUserPassword,
  suspendUser,
  updateUser,
} from "@/lib/mock/usersStore";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = getUserById(Number(id));
  if (!user) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const numericId = Number(id);
  const body = await request.json();
  const updated = updateUser(numericId, body);

  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const numericId = Number(id);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");

  if (action === "suspend") {
    const active = Boolean(body.active);
    const updated = suspendUser(numericId, active);
    if (!updated) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  }

  if (action === "role") {
    const updated = changeUserRole(numericId, String(body.role || "INSTRUCTOR"));
    if (!updated) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  }

  if (action === "reset-password") {
    const ok = resetUserPassword(numericId);
    if (!ok) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Password reset email queued" });
  }

  return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const ok = deleteUser(Number(id));
  if (!ok) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
