import { NextResponse } from "next/server";

import { createCohort, listCohortsWithQuery } from "@/lib/mock/cohortsStore";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "10");
  const q = url.searchParams.get("q") || "";
  const sort = url.searchParams.get("sort");
  const order = url.searchParams.get("order");
  const status = url.searchParams.get("status");
  const bootcampIdParam = url.searchParams.get("bootcampId");
  const bootcampId = bootcampIdParam ? Number(bootcampIdParam) : null;

  return NextResponse.json(
    listCohortsWithQuery({ page, limit, q, sort, order, status, bootcampId })
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  const cohort = createCohort(body);
  return NextResponse.json(cohort, { status: 201 });
}
