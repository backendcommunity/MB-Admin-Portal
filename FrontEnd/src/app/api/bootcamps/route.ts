import { NextResponse } from "next/server";

let bootcamps = [
  { id: 1, name: "Bootcamp A", location: "Online", active: true },
  { id: 2, name: "Bootcamp B", location: "NYC", active: false },
];
let nextId = 3;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "10");
  const q = url.searchParams.get("q") || "";
  const sort = url.searchParams.get("sort");
  const order = (url.searchParams.get("order") || "asc").toLowerCase();
  const status = (url.searchParams.get("status") || "all").toLowerCase();

  let filtered = bootcamps.filter((b) => b.name.toLowerCase().includes(q.toLowerCase()));

  if (status !== "all") {
    if (status === "active") {
      filtered = filtered.filter((b) => b.active);
    } else if (status === "inactive") {
      filtered = filtered.filter((b) => !b.active);
    }
  }

  if (sort) {
    filtered = filtered.slice().sort((a, b) => {
      const aVal: any = (a as any)[sort];
      const bVal: any = (b as any)[sort];

      if (typeof aVal === "string" && typeof bVal === "string") {
        return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return order === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        const aNum = aVal ? 1 : 0;
        const bNum = bVal ? 1 : 0;
        return order === "asc" ? aNum - bNum : bNum - aNum;
      }

      return 0;
    });
  }

  const start = (page - 1) * limit;
  const paged = filtered.slice(start, start + limit);

  return NextResponse.json({ data: paged, total: filtered.length });
}

export async function POST(request: Request) {
  const body = await request.json();
  const b = { id: nextId++, active: true, ...body };
  bootcamps.push(b);
  return NextResponse.json(b, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const { id, ...rest } = body;
  const idx = bootcamps.findIndex((b) => b.id === id);
  if (idx === -1) return NextResponse.json({ message: "Not found" }, { status: 404 });
  bootcamps[idx] = { ...bootcamps[idx], ...rest };
  return NextResponse.json(bootcamps[idx]);
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id"));
  bootcamps = bootcamps.filter((b) => b.id !== id);
  return NextResponse.json({ success: true });
}
