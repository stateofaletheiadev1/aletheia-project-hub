import type { Metadata } from "next";
import { PageHead } from "@/components/editorial/PageHead";
import { InterestSection } from "@/features/interest/InterestSection";

export const metadata: Metadata = {
  title: "Register your interest",
  description: "Register your interest in helping to found any of the institutions of the Sovereign Covenant State of Aletheia.",
};

export default function RegisterInterestPage() {
  return (
    <>
      <PageHead
        mark={{ n: "P4", label: "Take part" }}
        title="Register your interest"
        lede="Tell the founding government which institutions you would like to help found. One registration covers as many institutions as you choose."
        image="evening-sea"
      />
      <InterestSection mark="01" />
    </>
  );
}
