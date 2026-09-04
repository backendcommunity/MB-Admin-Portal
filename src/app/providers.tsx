'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';

import AuthSessionHydrator from '@/components/shared/AuthSessionHydrator';
import { createQueryClient } from '@/lib/api/query';

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthSessionHydrator />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
