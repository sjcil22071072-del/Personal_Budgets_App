"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface FileLink {
  id: string;
  title: string;
  url: string;
  file_type?: string | null;
  created_at?: string | null;
}

export default function MoreMenuClient({
  fileLinks,
}: {
  fileLinks: FileLink[];
  initialOpenSection?: string;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-zinc-800">내 서류함</h2>
          <span className="text-[11px] font-bold text-zinc-400">
            {fileLinks.length}건
          </span>
        </div>

        <div className="bg-white rounded-[2rem] p-5 ring-1 ring-zinc-200 shadow-sm flex flex-col gap-3">
          {fileLinks.length === 0 ? (
            <div className="py-10 text-center text-zinc-400">
              <span className="text-4xl block mb-3">📁</span>
              <p className="text-sm font-bold">아직 등록된 서류가 없어요.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {fileLinks.map((file) => (
                <a
                  key={file.id}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-50 hover:bg-zinc-100 transition-colors group"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-2xl shrink-0">📄</span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-black text-zinc-800">
                        {file.title}
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase">
                        {file.file_type || "document"}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 text-zinc-300 group-hover:text-zinc-900 transition-colors">
                    →
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full p-5 rounded-[2rem] bg-red-50 text-red-600 font-black text-center ring-1 ring-red-100 hover:bg-red-100 transition-all active:scale-95"
        >
          로그아웃
        </button>
      </section>
    </div>
  );
}
