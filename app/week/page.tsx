import { RecordingsViewPage, type RecordingsViewSearchParams } from "@/app/recordings-view-page";

export default function WeekPage({ searchParams }: { searchParams: RecordingsViewSearchParams }) {
  return <RecordingsViewPage searchParams={searchParams} view="week" />;
}
