import type { Metadata } from "next";
import Link from "next/link";
import { Folio, MarginMeta } from "@/components/editorial/Folio";
import { PageHead } from "@/components/editorial/PageHead";
import { StatusSeal } from "@/components/records/StatusSeal";
import { institutions } from "@/content/institutions";
import { listPublished } from "@/server/records/public-records";

export const metadata: Metadata = {
  title: "Directory",
  description: "Directory of the institutions of Aletheia and their published officeholders.",
};

export default async function DirectoryPage() {
  const appointments = await listPublished("appointment");
  return (
    <>
      <PageHead
        mark={{ n: "R7", label: "Directory" }}
        title="Directory"
        lede="Every institution, and who holds office in it. Officeholders appear only once their appointment is published."
        contour="a"
      />
      <div className="ledger py-[clamp(4rem,8vw,8rem)]">
        <Folio
          margin={
            <MarginMeta
              items={[
                { label: "Institutions", value: <span className="t-ref text-[0.9375rem]">{institutions.length}</span> },
                { label: "Published officeholders", value: <span className="t-ref text-[0.9375rem]">{appointments.items.length}</span> },
                { label: "Source", value: <Link className="link-ledger" href="/appointments">The register of appointments</Link> },
              ]}
            />
          }
        >
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Institutions and published officeholders</caption>
            <thead>
              <tr className="border-b-2 border-navy-800">
                <th scope="col" className="t-meta pb-4 pr-6 text-[0.6875rem] text-ink-500">Institution</th>
                <th scope="col" className="t-meta hidden pb-4 pr-6 text-[0.6875rem] text-ink-500 md:table-cell">Status</th>
                <th scope="col" className="t-meta pb-4 text-[0.6875rem] text-ink-500">Officeholders</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map((i) => (
                <tr key={i.slug} className="border-b rule align-baseline">
                  <th scope="row" className="py-5 pr-6 font-normal">
                    <Link href={`/institutions/${i.slug}`} className="draw-link text-[1.0625rem]">
                      {i.name}
                    </Link>
                    <span className="mt-2 block md:hidden">
                      <StatusSeal status={i.status} />
                    </span>
                  </th>
                  <td className="hidden py-5 pr-6 md:table-cell">
                    <StatusSeal status={i.status} />
                  </td>
                  <td className="py-5 text-[0.9375rem] text-ink-500">None published</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Folio>
      </div>
    </>
  );
}
