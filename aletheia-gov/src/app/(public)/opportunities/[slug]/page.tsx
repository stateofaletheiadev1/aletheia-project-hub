import type { Metadata } from "next";
import { RecordPage } from "@/components/records/RecordPage";
import { getPublished } from "@/server/records/public-records";

// Rendered on first request, then refreshed at most every 60 s from AletheiaDB.
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: PageProps<"/opportunities/[slug]">): Promise<Metadata> {
  const record = await getPublished("opportunity", (await props.params).slug);
  if (!record || record === "unavailable") return {};
  return { title: record.title, description: record.summary ?? `${record.reference}` };
}

export default async function Page(props: PageProps<"/opportunities/[slug]">) {
  return <RecordPage kind="opportunity" slug={(await props.params).slug} back={{ href: "/opportunities", label: "All opportunities" }} />;
}
