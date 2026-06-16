import CohortDetailClient from "@/components/bootcamps/CohortDetailClient";

type Props = {
  params: {
    id: string;
    cohortId: string;
  };
};

export default function CohortDetailPage({ params }: Props) {
  return (
    <CohortDetailClient
      bootcampId={params.id}
      cohortId={params.cohortId}
    />
  );
}
