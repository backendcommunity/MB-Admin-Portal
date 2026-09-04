import { redirect } from 'next/navigation';

// The queue moved onto each bootcamp's detail page. Kept as a redirect so old
// links land somewhere correct.
export default function AssignmentsPage() {
  redirect('/bootcamps');
}
