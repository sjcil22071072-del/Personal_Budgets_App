/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/utils/budget-visuals";
import { isStaffRole, isSupporterRole } from "@/utils/user-role";
import { getAuthenticatedUserProfileRole } from "@/utils/supabase/profile-gate";

export default async function ParticipantsOverviewPage() {
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

  let query = adminClient
    .from("participants")
    .select(
      "id, name, funding_sources ( id, name, monthly_budget, current_month_balance )",
    );

  if (isSupporterRole(authProfile.role)) {
    query = query.eq("assigned_supporter_id", user.id);
  }

  const { data: participants } = await query.order("created_at", {
    ascending: false,
  });

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 p-4 sm:p-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">당사자 통합 현황</h1>
        <p className="text-zinc-500 mt-1 text-sm">
          예산 현황을 한눈에 확인합니다.
        </p>
      </header>

      <main className="w-full max-w-5xl">
        {!participants || participants.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white ring-1 ring-zinc-200 text-center">
            <span className="text-5xl mb-4 block">👥</span>
            <p className="text-zinc-500 font-medium">
              배정된 당사자가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(participants || []).map((p: any) => {
              const fsList = p.funding_sources || [];
              const totalBudget = fsList.reduce(
                (a: number, fs: any) => a + Number(fs.monthly_budget || 0),
                0,
              );
              const totalBalance = fsList.reduce(
                (a: number, fs: any) =>
                  a + Number(fs.current_month_balance || 0),
                0,
              );
              const spent = totalBudget - totalBalance;
              const pct =
                totalBudget > 0
                  ? Math.min(100, Math.round((spent / totalBudget) * 100))
                  : 0;

              return (
                <Link
                  key={p.id}
                  href={`/supporter/participants/${p.id}`}
                  className="p-5 rounded-2xl bg-white ring-1 ring-zinc-200 hover:ring-zinc-400 transition-all shadow-sm group flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-600 shrink-0">
                      {(p.name || "?")[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-zinc-900 truncate">
                        {p.name || "이름 없음"}
                      </p>
                      <p className="text-xs text-zinc-400">
                        재원 {fsList.length}개
                      </p>
                    </div>
                    <span className="text-zinc-300 group-hover:text-zinc-600 transition-colors">
                      →
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>이번 달 지출</span>
                      <span className="font-bold text-zinc-800">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-500" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                      <span>{formatCurrency(spent)}원 사용</span>
                      <span>/ {formatCurrency(totalBudget)}원</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
