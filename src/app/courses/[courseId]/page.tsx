import { notFound } from "next/navigation";

import { LectureList } from "@/components/lecture-list";
import { buildCourseBundle } from "@/lib/content/bundle";
import { listCourses } from "@/lib/content/registry";

export function generateStaticParams() {
  return listCourses().map((course) => ({ courseId: course.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const bundle = buildCourseBundle(courseId);
  return { title: bundle?.course.title ?? "Course" };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const bundle = buildCourseBundle(courseId);
  if (!bundle) notFound();

  return <LectureList bundle={bundle} />;
}
