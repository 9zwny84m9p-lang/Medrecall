import { CourseList } from "@/components/course-list";
import { buildCourseBundles } from "@/lib/content/bundle";

export default function HomePage() {
  return <CourseList bundles={buildCourseBundles()} />;
}
