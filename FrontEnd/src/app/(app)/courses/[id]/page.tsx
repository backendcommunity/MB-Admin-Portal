import CourseDetailClient from "@/components/courses/CourseDetailClient";

type Props = {
  params: {
    id: string;
  };
};

export default function CourseDetailPage({ params }: Props) {
  const courseId = Number(params.id);
  return <CourseDetailClient courseId={courseId} />;
}
