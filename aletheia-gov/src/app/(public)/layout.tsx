import { PublicFrame } from "@/components/navigation/PublicFrame";

// Pages read the public record from AletheiaDB; regenerate them at most every 60 s.
export const revalidate = 60;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicFrame>{children}</PublicFrame>;
}
