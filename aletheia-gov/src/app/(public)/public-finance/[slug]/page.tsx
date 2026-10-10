import type { Metadata } from "next";
import { RecordPage } from "@/components/records/RecordPage";
import { getPublished } from "@/server/records/public-records";

// Rendered on first request, then refreshed at most every 60 s from AletheiaDB.
export const revalidate = 60;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: PageProps<"/public-finance/[slug]">): Promise<Metadata> {
  const record = await getPublished("finance", (await props.params).slug);
  if (!record || record === "unavailable") return {};
  return { title: record.title, description: record.summary ?? `${record.reference}` };
}

export default async function Page(props: PageProps<"/public-finance/[slug]">) {
  return <RecordPage kind="finance" slug={(await props.params).slug} back={{ href: "/public-finance", label: "Public finance" }} />;
}
