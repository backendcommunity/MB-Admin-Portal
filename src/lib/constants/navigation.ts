import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Map,
  Receipt,
  Settings,
  Users,
  Users2,
  Wallet,
  Tag,
  ClipboardList,
  Briefcase,
} from 'lucide-react';

import type { UserRole } from '@/lib/constants/roles';

/**
 * Rail sections, in render order. Grouping is presentation only — a group
 * grants nothing and gates nothing; `roles` on each entry remains the single
 * statement of who may see it.
 */
export const NAV_GROUPS = ['Overview', 'Content', 'People', 'Money', 'System'] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  group: NavGroup;
  badgeKey?: 'approvals';
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Overview',
  },
  {
    label: 'Earnings',
    href: '/earnings',
    icon: Wallet,
    roles: ['INSTRUCTOR'],
    group: 'Money',
  },
  {
    label: 'Users',
    href: '/users',
    icon: Users,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'People',
  },
  {
    label: 'Courses',
    href: '/courses',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Content',
  },
  {
    label: 'Bootcamps',
    href: '/bootcamps',
    icon: GraduationCap,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Content',
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Content',
  },
  {
    // The product calls these Paths; the API is still /admin/roadmaps.
    label: 'Paths',
    href: '/paths',
    icon: Map,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Content',
  },
  {
    label: 'Plans',
    href: '/plans',
    icon: CreditCard,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'Money',
  },
  {
    label: 'Subscriptions',
    href: '/subscriptions',
    icon: Receipt,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'Money',
  },
  {
    label: 'Teams',
    href: '/teams',
    icon: Users2,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'People',
  },
  {
    // requireAdmin with ownership scoping and a pricing field-guard:
    // instructors get full CRUD on their own Ships.
    label: 'Ship',
    href: '/offers',
    icon: Tag,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Content',
  },
  {
    label: 'Mock Interviews',
    href: '/mock-interviews',
    icon: Briefcase,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
    group: 'Content',
  },
  {
    label: 'Certifications',
    href: '/certifications',
    icon: Award,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'Content',
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'Overview',
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'System',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'System',
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: CheckCircle2,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    group: 'People',
    badgeKey: 'approvals',
  },
];
