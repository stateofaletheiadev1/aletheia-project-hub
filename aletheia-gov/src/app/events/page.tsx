import type { Metadata } from "next";
import { RegisterPage } from "@/components/editorial/RegisterPage";

export const metadata: Metadata = {
  title: "Events",
  description: "Public sessions, briefings and meetings of the founding government.",
};

export default function EventsPage() {
  return (
    <RegisterPage
      kind="event"
      basePath="/events"
      mark={{ n: "R5", label: "Events" }}
      title="Events"
      lede="Public sessions, briefings and meetings. Each event lists its date with time zone, its format, and the record it produces."
      pattern="AGV-EVT-····-····"
      margin={[
        { label: "Reference format", value: <span className="t-ref">AGV-EVT-YYYY-NNNN</span> },
        { label: "Times", value: "Stated in UTC and local time" },
      ]}
      emptyTitle="No events are scheduled."
      emptyText="Public events will be announced here first, with enough notice to attend."
    />
  );
}
