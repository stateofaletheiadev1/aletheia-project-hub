import { redirect } from "next/navigation";

// The Briefing needs a signed-in official. Until sessions exist (Phase 3), every visitor is
// sent to sign-in, which states that accounts are not open yet.
export default function Home() {
  redirect("/sign-in");
}
