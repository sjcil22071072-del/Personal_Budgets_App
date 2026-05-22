"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

// ────────────────────────────────────────────────────────────────
// Google OAuth 로그인 화면
// ────────────────────────────────────────────────────────────────

function GoogleLoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const userAgent = navigator.userAgent.toLowerCase();
    const isKakao = userAgent.includes("kakaotalk");
    const isNaver = userAgent.includes("naver");
    const isLine = userAgent.includes("line");
    const isFacebook = userAgent.includes("fb");
    const isInstagram = userAgent.includes("instagram");
    
    // 인앱 브라우저 여부
    const isInApp = isKakao || isNaver || isLine || isFacebook || isInstagram || userAgent.includes("inapp");

    if (isInApp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsInAppBrowser(true);
      const targetUrl = window.location.href;

      // 1. 안드로이드인 경우 기본 인터넷 브라우저 실행
      if (/android/i.test(userAgent)) {
        const schemeUrl = targetUrl.replace(/https?:\/\//i, "");
        window.location.href = `intent://${schemeUrl}#Intent;scheme=https;end`;
      } 
      // 2. iOS이면서 카카오톡인 경우 아웃링크 스킴 실행
      else if (/iphone|ipad|ipod/i.test(userAgent) && isKakao) {
        window.location.href = `kakaotalk://web/openExternalApp?url=${encodeURIComponent(targetUrl)}`;
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    window.location.href = "/auth/login";
  };

  return (
    <>
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-slate-50">
        <div className="flex w-full max-w-md flex-col gap-8 rounded-3xl bg-white p-8 md:p-10 shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-zinc-200/80">
          {/* 로고 */}
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-zinc-100/50 blur-xl"></div>
              <button
                className="relative w-20 h-20 rounded-[1.5rem] overflow-hidden flex items-center justify-center border border-zinc-200/60 shadow-md hover:scale-105 active:scale-95 transition-all focus:outline-none"
                aria-label="로고"
              >
                <img
                  src="https://pbs.twimg.com/profile_images/1588913576349401089/GkEk9byS_400x400.jpg"
                  alt="로고"
                  className="w-full h-full object-cover"
                />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] font-black text-zinc-500 bg-zinc-100 border border-zinc-200/40 px-2.5 py-0.5 rounded-full tracking-wider uppercase">
                중랑구청
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-800">
                개인예산제
              </h2>
              <p className="text-xs text-zinc-400 font-semibold leading-relaxed max-w-[280px] mt-0.5">
                관리자 선생님과 개인예산제 이용자 분들을 위한 앱
              </p>
            </div>
          </div>

          {/* 인앱 브라우저 안내 배너 */}
          {isInAppBrowser && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-4 text-xs text-amber-900 leading-relaxed shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                간편 로그인 이용 안내
              </div>
              <p className="text-zinc-600">
                카카오톡, 네이버 등 앱 내부 브라우저에서는 구글 로그인 정책상 직접 로그인이 불가능합니다.
              </p>
              <div className="mt-1 bg-white/60 rounded-xl p-2.5 border border-amber-200/30 flex flex-col gap-1.5 text-[11px] text-zinc-500">
                <p className="font-semibold text-zinc-700">💡 해결 방법:</p>
                <div className="pl-2 relative">
                  <span className="absolute left-0 text-amber-500 font-bold">•</span>
                  <span className="pl-2.5 block text-zinc-600">
                    <strong className="text-zinc-700">안드로이드:</strong> 잠시 후 기본 인터넷 브라우저가 자동으로 실행됩니다.
                  </span>
                </div>
                <div className="pl-2 relative">
                  <span className="absolute left-0 text-amber-500 font-bold">•</span>
                  <span className="pl-2.5 block text-zinc-600">
                    <strong className="text-zinc-700">아이폰 (iOS):</strong> 화면 우측 하단/상단의 <strong className="text-zinc-700">더보기(점 3개)</strong> 버튼을 누른 후, <strong className="text-amber-700 font-extrabold">"다른 브라우저로 열기"</strong> 또는 <strong className="text-amber-700 font-extrabold">"Safari로 열기"</strong>를 선택해 주세요.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 오류 메시지 */}
          {error && (
            <div className="rounded-2xl bg-red-50/60 border border-red-100 p-4 text-xs text-red-800 leading-relaxed shadow-sm">
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
            className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 active:scale-[0.99] transition-all font-bold text-zinc-800 text-base shadow-sm disabled:opacity-60 disabled:cursor-not-allowed min-h-[54px]"
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
          <div className="text-center text-xs text-zinc-400 font-bold leading-relaxed space-y-1">
            <p>
              로그인이 안된다면 카카오톡 플러스친구 신세계중랑 개인예산사업으로
              채팅주세요! 혹은 아래로 연락주셔도 됩니다.
            </p>
          </div>
          <div className="text-center text-xs text-black font-bold leading-relaxed space-y-1">
            <p>✉️기관 이메일: sjcil22071072@gmail.com</p>
            <p>📞전화번호: 02-2094-2486</p>
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
