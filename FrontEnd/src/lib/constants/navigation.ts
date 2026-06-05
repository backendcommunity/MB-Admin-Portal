import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Map,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

import type { UserRole } from "@/lib/constants/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  badgeKey?: "approvals";
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["SUPER_ADMIN", "ADMIN", "INSTRUCTOR"],
  },
  {
    label: "Users",
    href: "/users",
    icon: Users,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Courses",
    href: "/courses",
    icon: BookOpen,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Bootcamps",
    href: "/bootcamps",
    icon: GraduationCap,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Roadmaps",
    href: "/roadmaps",
    icon: Map,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Plans",
    href: "/plans",
    icon: CreditCard,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Subscriptions",
    href: "/subscriptions",
    icon: Receipt,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Approvals",
    href: "/approvals",
    icon: CheckCircle2,
    roles: ["SUPER_ADMIN", "ADMIN"],
    badgeKey: "approvals",
  },
  {
    label: "My Content",
    href: "/my-content",
    icon: FileText,
    roles: ["INSTRUCTOR"],
  },
  {
    label: "Earnings",
    href: "/earnings",
    icon: Wallet,
    roles: ["INSTRUCTOR"],
  },
];
