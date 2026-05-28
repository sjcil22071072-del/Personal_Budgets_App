/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import TransactionTableClient from "@/components/transactions/TransactionTableClient";
import { isStaffRole, isSupporterRole } from "@/utils/user-role";
import { getAuthenticatedUserProfileRole } from "@/utils/supabase/profile-gate";
import { getSignedImageUrls } from "@/app/actions/storage";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    participant?: string;
    status?: string;
    categoryMajor?: string;
    category?: string;
    paymentMethod?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    keyword?: string;
  }>;
}) {
  const params = await searchParams;
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

  let participantsQuery = adminClient
    .from("participants")
    .select("id, name, funding_sources ( id, name )");

  if (isSupporterRole(authProfile.role)) {
    participantsQuery = participantsQuery.eq("assigned_supporter_id", user.id);
  }

  const { data: participants } = await participantsQuery;

  const participantFundingSources: Record<
    string,
    { id: string; name: string }[]
  > = {};
  for (const p of participants || []) {
    participantFundingSources[(p as any).id] = (
      (p as any).funding_sources || []
    ).map((fs: any) => ({
      id: fs.id,
      name: fs.name,
    }));
  }

  let txQuery = adminClient
    .from("transactions")
    .select(
      "*, participant:participants!transactions_participant_id_fkey ( name )",
    );

  if (params.participant)
    txQuery = txQuery.eq("participant_id", params.participant);
  if (params.status) txQuery = txQuery.eq("status", params.status);
  if (params.category) {
    txQuery = txQuery.eq("category", params.category);
  } else if (params.categoryMajor) {
    txQuery = txQuery.ilike("category", `${params.categoryMajor} - %`);
  }
  if (params.paymentMethod === "계좌이체") {
    txQuery = txQuery.eq("payment_method", "계좌이체");
  }
  if (params.dateFrom) txQuery = txQuery.gte("date", params.dateFrom);
  if (params.dateTo) txQuery = txQuery.lte("date", params.dateTo);
  if (params.keyword)
    txQuery = txQuery.or(
      `activity_name.ilike.%${params.keyword}%,memo.ilike.%${params.keyword}%`,
    );
  if (params.sort === "amount_asc")
    txQuery = txQuery.order("amount", { ascending: true });
  else if (params.sort === "amount_desc")
    txQuery = txQuery.order("amount", { ascending: false });
  else if (params.sort === "date_asc")
    txQuery = txQuery.order("date", { ascending: true });
  else if (params.sort === "name_asc")
    txQuery = txQuery.order("activity_name", { ascending: true });
  else if (params.sort === "name_desc")
    txQuery = txQuery.order("activity_name", { ascending: false });
  else if (params.sort === "category_asc")
    txQuery = txQuery.order("category", { ascending: true, nullsFirst: false });
  else if (params.sort === "category_desc")
    txQuery = txQuery.order("category", {
      ascending: false,
      nullsFirst: false,
    });
  else txQuery = txQuery.order("date", { ascending: false });

  txQuery = txQuery.limit(100);

  if (isSupporterRole(authProfile.role)) {
    const myParticipantIds = (participants || []).map((p: any) => p.id);
    if (myParticipantIds.length > 0) {
      txQuery = txQuery.in("participant_id", myParticipantIds);
    }
  }

  const { data: rawTransactions } = await txQuery;

  // signed URL 일괄 변환
  const signedUrls = await getSignedImageUrls(
    (rawTransactions || []).map((t: any) => {
      const receiptUrl = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
        ? t.receipt_image_urls[0]
        : (t.receipt_image_url ?? null);
      const activityUrl = (t.activity_image_urls && t.activity_image_urls.length > 0)
        ? t.activity_image_urls[0]
        : (t.activity_image_url ?? null);
      return {
        id: t.id,
        receiptUrl,
        activityUrl,
      };
    }),
  );

  const transactions = (rawTransactions || [])
    .map((t: any) => {
      const receipt = (t.receipt_image_urls && t.receipt_image_urls.length > 0)
        ? t.receipt_image_urls[0]
        : t.receipt_image_url;
      const activity = (t.activity_image_urls && t.activity_image_urls.length > 0)
        ? t.activity_image_urls[0]
        : t.activity_image_url;
      return {
        ...t,
        payment_method: t.payment_method === "계좌이체" ? "계좌이체" : "카드",
        receipt_image_url: signedUrls[t.id]?.receipt ?? receipt,
        activity_image_url: signedUrls[t.id]?.activity ?? activity,
      };
    })
    .filter((t: any) => !params.paymentMethod || t.payment_method === params.paymentMethod);

  const totalCount = transactions?.length || 0;
  const rejectedCount =
    transactions?.filter((t: any) => t.status === "rejected").length || 0;
  const pendingCount =
    transactions?.filter((t: any) => t.status === "pending").length || 0;
  const confirmedCount =
    transactions?.filter((t: any) => t.status === "confirmed").length || 0;

  const paymentMethods = ["카드", "계좌이체"];

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 text-foreground p-4 sm:p-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          거래 및 회계 관리 (장부)
        </h1>
        <div className="flex items-center gap-2 print:hidden">
          <Link
            href="/supporter/transactions/new"
            className="px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors"
          >
            + 내역 직접 등록
          </Link>
        </div>
      </header>

      <main className="w-full max-w-6xl flex flex-col gap-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">
              전체 건수
            </p>
            <p className="text-3xl font-black text-zinc-900 mt-1">
              {totalCount}
            </p>
          </div>
          <div
            className={`p-5 rounded-xl ring-1 text-center shadow-sm ${rejectedCount > 0 ? "bg-red-50 ring-red-200" : "bg-white ring-zinc-200"}`}
          >
            <p className="text-xs font-black text-red-400 uppercase tracking-widest">
              거절 처리
            </p>
            <p
              className={`text-3xl font-black mt-1 ${rejectedCount > 0 ? "text-red-600" : "text-zinc-900"}`}
            >
              {rejectedCount}
            </p>
          </div>
          <div
            className={`p-5 rounded-xl ring-1 text-center shadow-sm ${pendingCount > 0 ? "bg-orange-50 ring-orange-200" : "bg-white ring-zinc-200"}`}
          >
            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">
              임시 대기
            </p>
            <p
              className={`text-3xl font-black mt-1 ${pendingCount > 0 ? "text-orange-600" : "text-zinc-900"}`}
            >
              {pendingCount}
            </p>
          </div>
          <div className="p-5 rounded-xl bg-white ring-1 ring-zinc-200 text-center shadow-sm">
            <p className="text-xs font-black text-green-500 uppercase tracking-widest">
              확정 완료
            </p>
            <p className="text-3xl font-black text-green-600 mt-1">
              {confirmedCount}
            </p>
          </div>
        </div>

        <TransactionTableClient
          transactions={transactions || []}
          participants={(participants || []).map((p: any) => ({
            id: p.id,
            name: p.name || "이름없음",
          }))}
          participantFundingSources={participantFundingSources}
          paymentMethods={paymentMethods}
          currentFilters={params}
        />
      </main>
    </div>
  );
}
