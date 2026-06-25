import { NextResponse } from "next/server";

import {
  createUser,
  deleteUser,
  listUsersWithQuery,
  updateUser,
} from "@/lib/mock/usersStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "10");
  const q = url.searchParams.get("q") || "";
  const sort = url.searchParams.get("sort");
  const order = url.searchParams.get("order");
  const role = url.searchParams.get("role");
  const active = url.searchParams.get("active");

  return NextResponse.json(
    listUsersWithQuery({ page, limit, q, sort, order, role, active })
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const user = createUser(body);
  return NextResponse.json(user, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const id = Number(body.id);
  const updated = updateUser(id, body);

  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const idParam = url.searchParams.get("id");
  const body = await request.json().catch(() => ({}));
  const id = Number(idParam || body.id);
  const ok = deleteUser(id);

  if (!ok) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
