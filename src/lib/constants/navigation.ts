import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CreditCard,
  FileText,
  FolderKanban,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Map,
  Receipt,
  Settings,
  UserCog,
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
    // Accounts an admin has to decide something about. Its own entry because a
    // suspension or a stalled signup is work, not a filter you remember to set.
    label: 'Needs attention',
    href: '/users/flagged',
    icon: UserCog,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Courses',
    href: '/courses',
    icon: BookOpen,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Bootcamps',
    href: '/bootcamps',
    icon: GraduationCap,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    // Submissions from every bootcamp, not just one — a reviewer works the
    // whole queue rather than hunting cohort by cohort.
    label: 'Assignments',
    href: '/bootcamps/assignments',
    icon: ClipboardCheck,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    label: 'Projects',
    href: '/projects',
    icon: FolderKanban,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
    // The product calls these Paths; the API is still /admin/roadmaps.
    label: 'Paths',
    href: '/paths',
    icon: Map,
    roles: ['SUPER_ADMIN', 'ADMIN'],
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
    label: 'Offers',
    href: '/offers',
    icon: Tag,
    roles: ['SUPER_ADMIN', 'ADMIN'],
  },
  {
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
    label: 'My Content',
    href: '/my-content',
    icon: FileText,
    roles: ['INSTRUCTOR'],
  },
  {
    label: 'Earnings',
    href: '/earnings',
    icon: Wallet,
    roles: ['INSTRUCTOR'],
  },
];
