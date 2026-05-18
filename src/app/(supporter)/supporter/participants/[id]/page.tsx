/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ParticipantDetailClient from "./ParticipantDetailClient";
import { isAdminRole, isStaffRole } from "@/utils/user-role";
import { getAuthenticatedUserProfileRole } from "@/utils/supabase/profile-gate";
import { getSupporters } from "@/app/actions/admin";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ParticipantDetailPage({ params }: PageProps) {
  const { id } = await params;
  console.log("ParticipantDetailPage called, id:", id); // 여기
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const authProfile = await getAuthenticatedUserProfileRole();
  console.log("authProfile:", JSON.stringify(authProfile)); // 여기
  if (!authProfile || !isStaffRole(authProfile.role)) {
    redirect("/");
  }

  const isAdmin = isAdminRole(authProfile.role);

  const [
    { data: participant, error: participantError },
    { data: recentTransactions },
    supportersResult,
  ] = await Promise.all([
    adminClient
      .from("participants")
      .select(
        `
        *,
        supporter:profiles!participants_assigned_supporter_id_fkey ( id, name ),
        funding_sources ( * )
      `,
      )
      .eq("id", id)
      .single(),
    adminClient
      .from("transactions")
      .select("*")
      .eq("participant_id", id)
      .order("date", { ascending: false })
      .limit(5),
    isAdmin
      ? getSupporters()
      : Promise.resolve({ supporters: [], error: null }),
  ]);

  console.log("participant:", JSON.stringify(participant));
  console.log("participantError:", JSON.stringify(participantError));
  console.log("id:", id);

  if (!participant) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
        <header className="flex h-16 items-center px-4 sm:px-6 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
          <Link
            href="/admin/participants"
            className="text-zinc-400 hover:text-zinc-600 transition-colors mr-3"
          >
            ←
          </Link>
          <h1 className="text-xl font-bold tracking-tight">당사자 정보</h1>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-zinc-400 font-medium">
            당사자를 찾을 수 없습니다.
          </p>
        </main>
      </div>
    );
  }

  const fundingSources = participant.funding_sources || [];
  const totalMonthlyBudget = fundingSources.reduce(
    (acc: number, fs: any) => acc + Number(fs.monthly_budget),
    0,
  );
  const totalMonthBalance = fundingSources.reduce(
    (acc: number, fs: any) => acc + Number(fs.current_month_balance),
    0,
  );
  const totalYearBalance = fundingSources.reduce(
    (acc: number, fs: any) => acc + Number(fs.current_year_balance),
    0,
  );
  const monthPercentage =
    totalMonthlyBudget > 0
      ? Math.round((totalMonthBalance / totalMonthlyBudget) * 100)
      : 0;

  const backUrl = isAdmin ? "/admin/participants" : "/supporter";

  return (
    <ParticipantDetailClient
      participant={participant}
      fundingSources={fundingSources}
      recentTransactions={recentTransactions || []}
      monthPercentage={monthPercentage}
      totalMonthBalance={totalMonthBalance}
      totalYearBalance={totalYearBalance}
      totalMonthlyBudget={totalMonthlyBudget}
      backUrl={backUrl}
      isAdmin={isAdmin}
      supporters={
        (supportersResult.supporters || []) as {
          id: string;
          name: string | null;
          role: string;
        }[]
      }
    />
  );
}
