import type { Metadata } from "next";
import { PageHead } from "@/components/editorial/PageHead";
import { InterestSection } from "@/features/interest/InterestSection";

export const metadata: Metadata = {
  title: "Register your interest",
  description: "Register your interest in founding roles and other positions in the institutions of the Sovereign Covenant State of Aletheia.",
};

export default function RegisterInterestPage() {
  return (
    <>
      <PageHead
        mark={{ n: "P4", label: "Take part" }}
        title="Register your interest"
        lede="Tell the government which positions you are interested in: founding roles, and permanent, fixed-term, advisory or volunteer positions. One registration covers as many kinds of position and institutions as you choose."
        image="evening-sea"
      />
      <InterestSection mark="01" />
    </>
  );
}
