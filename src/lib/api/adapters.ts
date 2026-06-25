type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toIdString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function pickString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function unwrapEnvelope(payload: unknown): unknown {
  const record = asRecord(payload);
  if (!record) return payload;

  if (("success" in record || "message" in record) && "data" in record) {
    return record.data;
  }

  return payload;
}

function mapCourseItem(item: unknown) {
  const row = asRecord(item) ?? {};
  const category = asRecord(row.category);

  return {
    id: toIdString(row.id),
    title: pickString(row.title),
    description: pickString(row.description || row.summary),
    status: pickString(row.status).toUpperCase(),
    published: toBoolean(row.published, toBoolean(row.isPublic, true)),
    category: pickString(row.category, pickString(category?.name)),
    instructor: pickString(row.instructor || row.author),
    tags: asArray(row.tags).map((tag) => String(tag)),
    thumbnail: pickString(row.thumbnail || row.banner),
    enrolledCount: toNumber(row.enrolledCount, toNumber(row.totalStudents, 0)),
    chaptersCount: toNumber(row.chaptersCount, toNumber(row.totalContent, asArray(row.chapters).length)),
  };
}

function mapBootcampItem(item: unknown) {
  const row = asRecord(item) ?? {};
  const status = pickString(row.status).toLowerCase();

  return {
    id: toIdString(row.id),
    name: pickString(row.name || row.title),
    location: pickString(row.location || row.level),
    active: row.active === undefined ? status !== "inactive" && status !== "closed" : toBoolean(row.active, true),
  };
}

function mapCohortItem(item: unknown) {
  const row = asRecord(item) ?? {};
  const status = pickString(row.status).toLowerCase();
  const weeks = asArray(row.weeks);

  return {
    id: toIdString(row.id),
    bootcampId: toIdString(row.bootcampId),
    name: pickString(row.name),
    startDate: pickString(row.startDate || row.startsAt),
    endDate: pickString(row.endDate || row.endsAt),
    active: toBoolean(row.active, status !== "closed"),
    memberCount: toNumber(row.memberCount, toNumber(row.studentsCount, 0)),
    weekCount: toNumber(row.weekCount, weeks.length),
  };
}

export function normalizeQueryResponse(url: string, payload: unknown): unknown {
  const raw = unwrapEnvelope(payload);
  const data = asRecord(raw);

  if (!data) return raw;

  if ((url.startsWith("/courses") || url.startsWith("/admin/courses")) && Array.isArray(data.courses)) {
    const rows = data.courses.map(mapCourseItem);
    const meta = asRecord(data.meta);
    return {
      data: rows,
      total: toNumber(meta?.netTotal, toNumber(meta?.total, rows.length)),
    };
  }

  if (/^\/admin\/courses\/[^/]+$/.test(url) && data.course) {
    return mapCourseItem(data.course);
  }

  if ((url.startsWith("/bootcamps") || url.startsWith("/admin/bootcamps")) && Array.isArray(data.bootcamps)) {
    const rows = data.bootcamps.map(mapBootcampItem);
    const meta = asRecord(data.meta);
    return {
      data: rows,
      total: toNumber(meta?.netTotal, toNumber(meta?.total, rows.length)),
    };
  }

  if ((/^\/bootcamps\/[^/]+$/.test(url) || /^\/admin\/bootcamps\/[^/]+\/cohorts$/.test(url)) && Array.isArray(data.cohorts)) {
    const rows = data.cohorts.map(mapCohortItem);
    return {
      data: rows,
      total: rows.length,
    };
  }

  return raw;
}

export function normalizeMutationResponse(payload: unknown): unknown {
  return unwrapEnvelope(payload);
}
