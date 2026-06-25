import CohortsTable from '@/components/bootcamps/CohortsTable';

type Props = { params: { id: string } };

export default function CohortsPage({ params }: Props) {
  const id = params.id;
  return <CohortsTable bootcampId={id} />;
}
