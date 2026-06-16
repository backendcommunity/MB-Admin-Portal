import { NextRequest, NextResponse } from "next/server";

const ACADEMY_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://demo.masteringbackend.com/api/v3";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function proxyToAcademy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  const pathname = path.join("/");
  const url = new URL(`${ACADEMY_BASE_URL}/${pathname}`);
  const queryString = request.nextUrl.searchParams.toString();
  if (queryString) {
    url.search = queryString;
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const token = request.cookies.get("mb_token")?.value;
  if (token) {
    headers.set("Cookie", `mb_token=${token}`);
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }

  const method = request.method;
  const needsBody = !["GET", "HEAD"].includes(method.toUpperCase());
  const body = needsBody ? await request.text() : undefined;

  const upstream = await fetch(url.toString(), {
    method,
    headers,
    body,
    cache: "no-store",
  });

  const text = await upstream.text();
  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get("content-type");

  if (upstreamType) {
    responseHeaders.set("Content-Type", upstreamType);
  } else {
    responseHeaders.set("Content-Type", "application/json");
  }

  const upstreamCacheControl = upstream.headers.get("cache-control");
  if (upstreamCacheControl) {
    responseHeaders.set("Cache-Control", upstreamCacheControl);
  } else {
    responseHeaders.set("Cache-Control", "no-store, max-age=0");
  }

  return new NextResponse(text, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyToAcademy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyToAcademy(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyToAcademy(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyToAcademy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyToAcademy(request, context);
}
