export type MockUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  plan?: string;
  joinedAt?: string;
};

let nextId = 4;
const users: MockUser[] = [
  {
    id: 1,
    name: "Alice Smith",
    email: "alice@example.com",
    role: "ADMIN",
    active: true,
    plan: "Pro",
    joinedAt: "2026-05-12",
  },
  {
    id: 2,
    name: "Bob Jones",
    email: "bob@example.com",
    role: "INSTRUCTOR",
    active: true,
    plan: "Starter",
    joinedAt: "2026-05-15",
  },
  {
    id: 3,
    name: "Carol Lee",
    email: "carol@example.com",
    role: "SUPER_ADMIN",
    active: true,
    plan: "Enterprise",
    joinedAt: "2026-05-20",
  },
];

export function listUsers() {
  return users;
}

export function getUserById(id: number) {
  return users.find((user) => user.id === id) || null;
}

export function createUser(input: Partial<MockUser>) {
  const user: MockUser = {
    id: nextId++,
    name: input.name || "New User",
    email: input.email || "new@example.com",
    role: input.role || "INSTRUCTOR",
    active: input.active ?? true,
    plan: input.plan || "Starter",
    joinedAt: input.joinedAt || new Date().toISOString().slice(0, 10),
  };
  users.push(user);
  return user;
}

export function updateUser(id: number, input: Partial<MockUser>) {
  const index = users.findIndex((user) => user.id === id);
  if (index === -1) return null;
  users[index] = { ...users[index], ...input };
  return users[index];
}

export function deleteUser(id: number) {
  const initialLength = users.length;
  const next = users.filter((user) => user.id !== id);
  users.length = 0;
  users.push(...next);
  return users.length !== initialLength;
}

export function listUsersWithQuery(params: {
  page: number;
  limit: number;
  q: string;
  sort?: string | null;
  order?: string | null;
  role?: string | null;
  active?: string | null;
}) {
  const { page, limit, q, sort, order = "asc", role, active } = params;
  let filtered = users.filter(
    (user) =>
      user.name.toLowerCase().includes(q.toLowerCase()) ||
      user.email.toLowerCase().includes(q.toLowerCase())
  );

  if (role) {
    filtered = filtered.filter((user) => user.role.toLowerCase() === role.toLowerCase());
  }

  if (active !== null && active !== undefined) {
    const activeBool = active === "true";
    filtered = filtered.filter((user) => user.active === activeBool);
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

      return 0;
    });
  }

  const start = (page - 1) * limit;
  return {
    data: filtered.slice(start, start + limit),
    total: filtered.length,
  };
}

export function suspendUser(id: number, active: boolean) {
  return updateUser(id, { active });
}

export function changeUserRole(id: number, role: string) {
  return updateUser(id, { role });
}

export function resetUserPassword(id: number) {
  return Boolean(getUserById(id));
}
