import { NextResponse } from "next/server";

import {
  createCourse,
  deleteCourse,
  listCoursesWithQuery,
  updateCourse,
} from "@/lib/mock/coursesStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "10");
  const q = url.searchParams.get("q") || "";
  const sort = url.searchParams.get("sort");
  const order = url.searchParams.get("order");
  const status = url.searchParams.get("status");

  return NextResponse.json(
    listCoursesWithQuery({ page, limit, q, sort, order, status })
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const course = createCourse(body);
  return NextResponse.json(course, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const id = Number(body.id);
  const updated = updateCourse(id, body);

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
  const ok = deleteCourse(id);

  if (!ok) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
