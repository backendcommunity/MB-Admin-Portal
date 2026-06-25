import { NextResponse, type NextRequest } from "next/server";

import {
  createChapter,
  deleteChapter,
  listChapters,
  reorderChapters,
  updateChapter,
} from "@/lib/mock/coursesStore";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return NextResponse.json({ data: listChapters(Number(id)) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const chapter = createChapter(Number(id), body);
  if (!chapter) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(chapter, { status: 201 });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  const chapter = updateChapter(Number(id), Number(body.chapterId), body);
  if (!chapter) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(chapter);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();

  if (body.action === "reorder") {
    const chapters = reorderChapters(Number(id), body.orderedIds || []);
    if (!chapters) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: chapters });
  }

  return NextResponse.json({ message: "Unsupported action" }, { status: 400 });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const chapterId = Number(url.searchParams.get("chapterId"));
  const ok = deleteChapter(Number(id), chapterId);
  if (!ok) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
