export type MockChapter = {
  id: number;
  title: string;
  type: "video" | "article";
  published: boolean;
  videoId?: string;
  content?: string;
};

export type MockCourse = {
  id: number;
  title: string;
  description: string;
  published: boolean;
  category: string;
  instructor: string;
  tags: string[];
  thumbnail?: string;
  enrolledCount: number;
  chapters: MockChapter[];
};

let nextCourseId = 3;
let nextChapterId = 5;

const courses: MockCourse[] = [
  {
    id: 1,
    title: "React Basics",
    description: "Intro to React with components and hooks.",
    published: true,
    category: "Frontend",
    instructor: "Jane Doe",
    tags: ["react", "frontend"],
    thumbnail: "",
    enrolledCount: 42,
    chapters: [
      { id: 1, title: "Getting Started", type: "video", published: true, videoId: "abc123" },
      { id: 2, title: "JSX Deep Dive", type: "article", published: true, content: "JSX overview" },
    ],
  },
  {
    id: 2,
    title: "Advanced TypeScript",
    description: "Type-level programming and advanced patterns.",
    published: false,
    category: "TypeScript",
    instructor: "John Smith",
    tags: ["typescript", "advanced"],
    thumbnail: "",
    enrolledCount: 17,
    chapters: [
      { id: 3, title: "Generics", type: "video", published: false, videoId: "ts001" },
      { id: 4, title: "Conditional Types", type: "article", published: false, content: "Conditionals" },
    ],
  },
];

export function listCourses() {
  return courses;
}

export function listCoursesWithQuery(params: {
  page: number;
  limit: number;
  q: string;
  sort?: string | null;
  order?: string | null;
  status?: string | null;
}) {
  const { page, limit, q, sort, order = "asc", status = "all" } = params;
  let filtered = courses.filter((course) => course.title.toLowerCase().includes(q.toLowerCase()));

  if (status !== "all") {
    if (status === "published") {
      filtered = filtered.filter((course) => course.published);
    } else if (status === "draft") {
      filtered = filtered.filter((course) => !course.published);
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
  return {
    data: filtered.slice(start, start + limit).map((course) => ({
      ...course,
      chaptersCount: course.chapters.length,
    })),
    total: filtered.length,
  };
}

export function getCourseById(id: number) {
  return courses.find((course) => course.id === id) || null;
}

export function createCourse(input: Partial<MockCourse>) {
  const course: MockCourse = {
    id: nextCourseId++,
    title: input.title || "New Course",
    description: input.description || "",
    published: input.published ?? false,
    category: input.category || "General",
    instructor: input.instructor || "Unassigned",
    tags: input.tags || [],
    thumbnail: input.thumbnail || "",
    enrolledCount: input.enrolledCount ?? 0,
    chapters: [],
  };

  courses.push(course);
  return course;
}

export function updateCourse(id: number, input: Partial<MockCourse>) {
  const index = courses.findIndex((course) => course.id === id);
  if (index === -1) return null;

  courses[index] = {
    ...courses[index],
    ...input,
    tags: input.tags ?? courses[index].tags,
  };

  return courses[index];
}

export function deleteCourse(id: number) {
  const initialLength = courses.length;
  const next = courses.filter((course) => course.id !== id);
  courses.length = 0;
  courses.push(...next);
  return courses.length !== initialLength;
}

export function listChapters(courseId: number) {
  return getCourseById(courseId)?.chapters || [];
}

export function createChapter(
  courseId: number,
  input: Partial<MockChapter> & { title: string; type: "video" | "article" }
) {
  const course = getCourseById(courseId);
  if (!course) return null;

  const chapter: MockChapter = {
    id: nextChapterId++,
    title: input.title,
    type: input.type,
    published: input.published ?? false,
    videoId: input.videoId,
    content: input.content,
  };

  course.chapters.push(chapter);
  return chapter;
}

export function updateChapter(
  courseId: number,
  chapterId: number,
  input: Partial<MockChapter>
) {
  const course = getCourseById(courseId);
  const chapter = course?.chapters.find((item) => item.id === chapterId);
  if (!course || !chapter) return null;

  Object.assign(chapter, input);
  return chapter;
}

export function deleteChapter(courseId: number, chapterId: number) {
  const course = getCourseById(courseId);
  if (!course) return false;

  const initialLength = course.chapters.length;
  course.chapters = course.chapters.filter((chapter) => chapter.id !== chapterId);
  return course.chapters.length !== initialLength;
}

export function reorderChapters(courseId: number, orderedIds: number[]) {
  const course = getCourseById(courseId);
  if (!course) return null;

  const ordered = orderedIds
    .map((chapterId) => course.chapters.find((chapter) => chapter.id === chapterId))
    .filter(Boolean) as MockChapter[];

  if (ordered.length !== course.chapters.length) return course.chapters;

  course.chapters = ordered;
  return course.chapters;
}
