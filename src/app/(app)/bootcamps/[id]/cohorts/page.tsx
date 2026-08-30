import { redirect } from 'next/navigation';

/**
 * Cohorts are listed on the bootcamp page itself now, so this level of the URL
 * has nothing of its own to show. Kept as a redirect rather than deleted so an
 * existing bookmark still lands somewhere useful.
 */
export default async function CohortsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/bootcamps/${id}`);
}
