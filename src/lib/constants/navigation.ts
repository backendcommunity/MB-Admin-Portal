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

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
  badgeKey?: 'approvals';
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    label: 'Users',
    href: '/users',
    icon: Users,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Courses',
    href: '/courses',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    label: 'Bootcamps',
    href: '/bootcamps',
    icon: GraduationCap,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    // The product calls these Paths; the API is still /admin/roadmaps.
    label: 'Paths',
    href: '/paths',
    icon: Map,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    label: 'Plans',
    href: '/plans',
    icon: CreditCard,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Subscriptions',
    href: '/subscriptions',
    icon: Receipt,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Teams',
    href: '/teams',
    icon: Users2,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    // requireAdmin with ownership scoping and a pricing field-guard:
    // instructors get full CRUD on their own Ships.
    label: 'Ship',
    href: '/offers',
    icon: Tag,
    roles: ['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR'],
  },
  {
    // requireStrictAdmin on all four routes (reverted from requireAdmin):
    // template fields have no field-level guard yet either.
    label: 'Mock Interviews',
    href: '/mock-interviews/templates',
    icon: Briefcase,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Certifications',
    href: '/certifications',
    icon: Award,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: CheckCircle2,
    roles: ['SUPER_ADMIN', 'ADMIN'],
    badgeKey: 'approvals',
  },
  {
    label: 'Earnings',
    href: '/earnings',
    icon: Wallet,
    roles: ['INSTRUCTOR'],
  },
];
