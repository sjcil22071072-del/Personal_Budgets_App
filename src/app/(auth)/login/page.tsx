"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

// ────────────────────────────────────────────────────────────────
// Google OAuth 로그인 화면
// ────────────────────────────────────────────────────────────────

function GoogleLoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    window.location.href = "/auth/login";
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-50">
        <div className="absolute top-20 right-20 text-8xl opacity-10 rotate-12 pointer-events-none select-none hidden md:block">
          💰
        </div>
        <div className="absolute bottom-20 left-20 text-6xl opacity-10 -rotate-12 pointer-events-none select-none hidden md:block">
          📊
        </div>

        <div className="flex w-full max-w-md flex-col gap-8 rounded-3xl bg-white p-8 md:p-12 shadow-xl ring-1 ring-zinc-200">
          {/* 로고 */}
          <div className="flex flex-col items-center gap-4 text-center">
            <button
              className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center shadow-lg hover:scale-105 transition-transform focus:outline-none"
              aria-label="로고"
            >
              <img
                src="https://pbs.twimg.com/profile_images/1588913576349401089/GkEk9byS_400x400.jpg"
                alt="로고"
                className="w-full h-full object-cover"
              />
            </button>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              중랑구청 개인예산제
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed">
              관리자 선생님과 개인예산제 이용자 분들을 위한 앱
            </p>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-800 leading-relaxed">
              <p className="font-bold mb-1">
                이 앱에 들어올 수 없는 이메일이에요.
              </p>
              <p>담당 선생님께 문의해주세요.</p>
            </div>
          )}

          {/* Google 로그인 버튼 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl border-2 border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all font-bold text-zinc-800 text-base shadow-sm disabled:opacity-60 disabled:cursor-not-allowed min-h-[56px]"
          >
            {loading ? (
              <span className="text-sm text-zinc-500">로그인 중...</span>
            ) : (
              <>
                <svg
                  className="w-5 h-5 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                구글로 로그인하기
              </>
            )}
          </button>

          {/* 안내 문구 */}
          <div className="text-center text-sm text-zinc-500 leading-relaxed space-y-1">
            <p>
              로그인이 안된다면 카카오톡 오픈 채팅방이나 아래 연락처로 문의
              주세요!
            </p>
            <p>기관 이메일: sjcil22071072@gmail.com</p>
            <p>전화번호: 02-2094-2486</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-zinc-400">로딩 중...</div>
        </div>
      }
    >
      <GoogleLoginContent />
    </Suspense>
  );
}
