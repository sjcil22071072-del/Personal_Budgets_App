"use client"

import { useState, useTransition } from "react"
import { createInvitation, deleteInvitation, type Invitation, type InvitationRole } from "@/app/actions/admin"

const ROLE_LABELS: Record<InvitationRole, string> = {
  admin: "관리자",
  participant: "당사자",
}

const ROLE_COLORS: Record<InvitationRole, string> = {
  admin: "bg-purple-100 text-purple-700",
  participant: "bg-sky-100 text-sky-700",
}

interface Props {
  invitations: Invitation[]
}

export default function InvitationsClient({ invitations }: Props) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<InvitationRole>("participant")
  const [note, setNote] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(false)

    if (!email.trim()) {
      setFormError("이메일을 입력해주세요.")
      return
    }

    startTransition(async () => {
      const result = await createInvitation({ email, role, note })
      if (result.error) {
        setFormError(result.error)
      } else {
        setFormSuccess(true)
        setEmail("")
        setNote("")
        setTimeout(() => setFormSuccess(false), 3000)
      }
    })
  }

  const handleDelete = (id: string) => {
    setDeletingId(id)
    startTransition(async () => {
      await deleteInvitation(id)
      setDeletingId(null)
    })
  }

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-5 text-base font-bold text-zinc-800">사용자 초대</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">이메일 *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@gmail.com"
                required
                className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">역할 *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as InvitationRole)}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="participant">당사자</option>
                <option value="admin">관리자</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-700">메모 (선택)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="당사자 이름 또는 참고사항"
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
          {formSuccess && <p className="text-sm font-medium text-green-600">초대가 등록되었습니다.</p>}

          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {isPending ? "등록 중..." : "초대 등록"}
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-base font-bold text-zinc-800">초대 목록</h2>
          <p className="mt-0.5 text-xs text-zinc-500">관리자와 당사자 계정만 초대할 수 있습니다.</p>
        </div>

        {invitations.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-zinc-400">
            등록된 초대가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-zinc-50">
                <div className="flex min-w-0 items-center gap-4">
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${ROLE_COLORS[inv.role as InvitationRole]}`}>
                    {ROLE_LABELS[inv.role as InvitationRole] || inv.role}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800">{inv.email}</p>
                    {inv.note && <p className="truncate text-xs text-zinc-400">{inv.note}</p>}
                  </div>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-3">
                  {inv.used_at ? (
                    <span className="text-xs font-medium text-green-600">로그인 완료</span>
                  ) : (
                    <>
                      <span className="text-xs text-zinc-400">미사용</span>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        disabled={isPending && deletingId === inv.id}
                        className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
