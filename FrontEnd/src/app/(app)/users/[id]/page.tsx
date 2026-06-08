import UserDetailClient from "@/components/users/UserDetailClient";

type Props = {
  params: {
    id: string;
  };
};

export default function UserDetailPage({ params }: Props) {
  const userId = Number(params.id);
  return <UserDetailClient userId={userId} />;
}
