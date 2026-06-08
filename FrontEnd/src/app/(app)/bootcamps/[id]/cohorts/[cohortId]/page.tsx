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
      bootcampId={Number(params.id)}
      cohortId={Number(params.cohortId)}
    />
  );
}
