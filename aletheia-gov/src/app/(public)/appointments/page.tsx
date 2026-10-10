import type { Metadata } from "next";
import { RegisterPage } from "@/components/editorial/RegisterPage";

export const metadata: Metadata = {
  title: "Appointments",
  description: "Verified appointments to positions in the founding government. Only appointments issued and published by an appointing authority appear here.",
};

export default function AppointmentsPage() {
  return (
    <RegisterPage
      kind="appointment"
      basePath="/appointments"
      notice
      mark={{ n: "R4", label: "Appointments" }}
      title="Appointments"
      lede="Who holds which position, appointed by whom, and for how long. Only verified appointments are listed: an accepted application is not an appointment."
      pattern="AGV-APT-····-····"
      margin={[
        { label: "Reference format", value: <span className="t-ref">AGV-APT-YYYY-NNNN</span> },
        { label: "Publication rule", value: "Issued by an appointing authority, approved by a second officer" },
        { label: "Each entry shows", value: "Position, institution, term dates and the appointment document" },
      ]}
      emptyTitle="No appointments have been published."
      emptyText="No one has yet been appointed to a position through this record. Appointments will appear here, with their appointing instrument, once issued."
    />
  );
}
