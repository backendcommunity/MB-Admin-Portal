import { NextResponse, type NextRequest } from "next/server";

import {
  createLesson,
  createWeek,
  deleteLesson,
  deleteWeek,
  listWeeks,
  reorderLessons,
  reorderWeeks,
  updateLesson,
  updateWeek,
} from "@/lib/mock/cohortsStore";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json({ data: listWeeks(Number(id)) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  if (body.action === "week") {
    const week = createWeek(Number(id), String(body.title || "New Week"));
    if (!week) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(week, { status: 201 });
  }

  if (body.action === "lesson") {
    const lesson = createLesson(Number(id), Number(body.weekId), {
      title: String(body.title || "New Lesson"),
      type: body.type || "video",
    });
    if (!lesson) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(lesson, { status: 201 });
  }

  return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  if (body.action === "week") {
    const week = updateWeek(Number(id), Number(body.weekId), String(body.title || ""));
    if (!week) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(week);
  }

  if (body.action === "lesson") {
    const lesson = updateLesson(Number(id), Number(body.weekId), Number(body.lessonId), body);
    if (!lesson) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json(lesson);
  }

  return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  if (body.action === "reorder-weeks") {
    const weeks = reorderWeeks(Number(id), body.orderedIds || []);
    if (!weeks) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ data: weeks });
  }

  if (body.action === "reorder-lessons") {
    const lessons = reorderLessons(Number(id), Number(body.weekId), body.orderedIds || []);
    if (!lessons) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ data: lessons });
  }

  return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "week") {
    const weekId = Number(url.searchParams.get("weekId"));
    const ok = deleteWeek(Number(id), weekId);
    if (!ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  if (action === "lesson") {
    const weekId = Number(url.searchParams.get("weekId"));
    const lessonId = Number(url.searchParams.get("lessonId"));
    const ok = deleteLesson(Number(id), weekId, lessonId);
    if (!ok) return NextResponse.json({ message: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
}
