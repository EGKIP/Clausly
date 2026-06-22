import { ArrowRightLeft } from "lucide-react";
import { ComparePicker } from "@/components/dashboard/compare/compare-picker";
import { CompareView } from "@/components/dashboard/compare/compare-view";
import { PageBody, PageHeader } from "@/components/dashboard/page-header";
import { listDocuments } from "@/lib/db/documents";

export default async function ComparePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const a = firstParam(params?.a);
  const b = firstParam(params?.b);
  const documents = (await listDocuments()).map((doc) => ({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    party: doc.party,
  }));

  return (
    <PageBody>
      <PageHeader
        eyebrow={
          <>
            <ArrowRightLeft className="mr-1 inline size-3 -mt-0.5" />
            Compare
          </>
        }
        title="Side-by-side contract compare"
        description="Choose two contracts and Clausly will align their extracted clauses, then highlight word-level differences. Informational only, not legal advice."
      />

      {a && b ? (
        <CompareView aId={a} bId={b} />
      ) : (
        <ComparePicker documents={documents} />
      )}
    </PageBody>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
