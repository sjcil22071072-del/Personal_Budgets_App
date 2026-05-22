interface FileLink {
  id: string;
  title: string;
  url: string;
  file_type?: string | null;
}

export default function MoreMenuClient({ fileLinks }: { fileLinks: FileLink[] }) {
  if (fileLinks.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center text-zinc-400 ring-1 ring-zinc-200 shadow-sm">
        <span className="mb-3 block text-4xl">📁</span>
        <p className="text-sm font-bold">아직 등록된 서류가 없어요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-zinc-200 shadow-sm">
      <div className="flex flex-col gap-2">
        {fileLinks.map((file) => (
          <a
            key={file.id}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4 transition-colors hover:bg-zinc-100"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 text-2xl">📄</span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-black text-zinc-800">
                  {file.title}
                </span>
                <span className="text-[10px] font-bold uppercase text-zinc-400">
                  {file.file_type || "document"}
                </span>
              </div>
            </div>
            <span className="shrink-0 text-zinc-300">→</span>
          </a>
        ))}
      </div>
    </div>
  );
}
