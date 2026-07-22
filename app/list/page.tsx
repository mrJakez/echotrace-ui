import { RecordingsViewPage, type RecordingsViewSearchParams } from "@/app/recordings-view-page";

export default function ListPage({ searchParams }: { searchParams: RecordingsViewSearchParams }) {
  return <RecordingsViewPage searchParams={searchParams} view="list" />;
}
