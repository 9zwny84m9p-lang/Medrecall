import { notFound } from "next/navigation";

import { LearnSession } from "@/components/learn-session";
import { buildLectureBundle } from "@/lib/content/bundle";
import { listCourses, listLectures } from "@/lib/content/registry";

export function generateStaticParams() {
  return listCourses()
    .flatMap((course) => listLectures(course.id))
    .map((lecture) => ({ lectureId: lecture.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lectureId: string }>;
}) {
  const { lectureId } = await params;
  const bundle = buildLectureBundle(lectureId);
  return { title: bundle?.lecture.title ?? "Lecture" };
}

export default async function LearnPage({
  params,
}: {
  params: Promise<{ lectureId: string }>;
}) {
  const { lectureId } = await params;
  const bundle = buildLectureBundle(lectureId);
  if (!bundle) notFound();

  return <LearnSession bundle={bundle} />;
}
