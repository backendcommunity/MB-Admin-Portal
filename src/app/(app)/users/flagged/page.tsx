import { redirect } from 'next/navigation';

// The queue folded into the Users list as a filter. Kept as a redirect so
// bookmarks and older links still land somewhere correct.
export default function FlaggedUsersPage() {
  redirect('/users?filter=flagged');
}
