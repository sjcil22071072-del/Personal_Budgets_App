import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import TransactionDetailClient from "./TransactionDetailClient";
import { extractStoragePath } from "@/utils/supabase/storage";
import { isStaffRole } from "@/utils/user-role";
import { getAuthenticatedUserProfileRole } from "@/utils/supabase/profile-gate";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TransactionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const authProfile = await getAuthenticatedUserProfileRole();
  if (!authProfile || !isStaffRole(authProfile.role)) {
    redirect("/");
  }

  const { data: tx } = await adminClient
    .from("transactions")
    .select(
      `
      *,
      participant:participants!transactions_participant_id_fkey ( name ),
      funding_source:funding_sources!transactions_funding_source_id_fkey ( name )
    `,
    )
    .eq("id", id)
    .single();

  const getSignedUrlLocal = async (url: string | null, bucket: string) => {
    if (!url) return null;
    const path = extractStoragePath(url, bucket);
    if (!path) return null;
    const isPdf = path.toLowerCase().endsWith('.pdf');
    const options = isPdf 
      ? undefined 
      : {
          transform: {
            width: 1000,
            quality: 80,
          }
        };
    const { data } = await adminClient.storage
      .from(bucket)
      .createSignedUrl(path, 3600, options);
    return data?.signedUrl ?? null;
  };

  const [signedReceiptUrls, signedActivityUrls, signedEvidenceUrls] = await Promise.all([
    Promise.all(
      (tx?.receipt_image_urls || []).map((url: string) =>
        getSignedUrlLocal(url, "receipts")
      )
    ),
    Promise.all(
      (tx?.activity_image_urls || []).map((url: string) =>
        getSignedUrlLocal(url, "activity-photos")
      )
    ),
    Promise.all(
      (tx?.evidence_image_urls || []).map((url: string) =>
        getSignedUrlLocal(url, "evidence-documents")
      )
    ),
  ]);

  if (tx) {
    tx.receipt_image_urls = (tx.receipt_image_urls || []).map(
      (url: string, idx: number) => signedReceiptUrls[idx] ?? url
    );
    tx.activity_image_urls = (tx.activity_image_urls || []).map(
      (url: string, idx: number) => signedActivityUrls[idx] ?? url
    );
    tx.evidence_image_urls = (tx.evidence_image_urls || []).map(
      (url: string, idx: number) => signedEvidenceUrls[idx] ?? url
    );
  }

  if (!tx) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link
            href="/supporter/transactions"
            className="text-zinc-400 hover:text-zinc-600 mr-3"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight">내역 상세</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">내역을 찾을 수 없습니다.</p>
        </main>
      </div>
    );
  }

  return <TransactionDetailClient tx={tx} />;
}
