import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ReceiptUploadForm from "@/components/transactions/ReceiptUploadForm";
import { EasyTerm } from "@/components/ui/EasyTerm";
import HelpButton from "@/components/help/HelpButton";
import HelpAutoTrigger from "@/components/help/HelpAutoTrigger";
import NavDropdown from "@/components/layout/NavDropdown";

export default async function ReceiptPage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // user.id 또는 email로 participants 조회
  const { data: participant } = await adminClient
    .from("participants")
    .select("*, funding_sources(*)")
    .or(`id.eq.${user.id},email.eq.${user.email}`)
    .maybeSingle();

  if (!participant) {
    return (
      <div className="flex flex-col min-h-dvh bg-background text-foreground p-4">
        <header className="flex h-14 items-center gap-3 mb-6">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">중랑구청</span>
          </Link>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
          <span className="text-6xl">📋</span>
          <p className="text-zinc-500 font-bold">
            아직 예산 정보가 없어요.
            <br />
            관리자에게 말씀해 주세요!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background text-foreground pb-10">
      <HelpAutoTrigger sectionKey="receipt" />
      <header className="flex h-14 items-center justify-between px-4 z-10 sticky top-0 bg-background/80 backdrop-blur-md border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <span className="text-xl">←</span>
            <span className="text-sm font-bold">중랑구청</span>
          </Link>
          <span className="text-zinc-300">·</span>
          <h1 className="text-sm font-black text-zinc-800">🧾 활동 기록하기</h1>
        </div>
        <div className="flex items-center gap-2">
          <HelpButton sectionKey="receipt" />
          <NavDropdown />
        </div>
      </header>

      <main className="flex-1 p-4 w-full">
        <div className="mb-6">
          <h2 className="text-base font-bold text-zinc-800">
            <EasyTerm formal="새로운 활동 기록" easy="오늘 한 일 적기" />
          </h2>
          <p className="text-sm text-zinc-500 font-medium mt-0.5">
            사용한 영수증 사진을 찍어서 보내주세요.
          </p>
        </div>

        {(() => {
          const now = new Date();
          const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const activeFundingSources = (participant.funding_sources || []).filter((fs: any) => {
            if (fs.start_date) {
              const start = new Date(fs.start_date);
              const startMonthStart = new Date(start.getFullYear(), start.getMonth(), 1);
              if (startMonthStart > currentMonthStart) return false;
            }
            if (fs.end_date) {
              const end = new Date(fs.end_date);
              const endMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
              if (endMonthStart < currentMonthStart) return false;
            }
            return true;
          });

          return (
            <ReceiptUploadForm
              participantId={participant.id}
              fundingSources={activeFundingSources}
            />
          );
        })()}
      </main>
    </div>
  );
}
