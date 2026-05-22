# 중랑구청 개인예산 관리 앱

발달장애인 당사자의 개인예산 사용 기록, 영수증 검토, 카드/증빙 서류 관리를 돕는 Next.js 앱입니다.

## 주요 기능

### 당사자 화면
- 예산 잔액과 월별 사용 현황 확인
- 영수증, 활동사진, 카드 앞뒷면 등록
- 가족관계증명서 등록
- 달력과 갤러리에서 활동사진 확인
- 글씨 크기, 고대비, 다크 모드, 쉬운 말 등 화면 설정

### 관리자 화면
- 당사자 등록 및 상세 관리
- 관리자 등록
- 영수증 검토 대기열 확인
- 회계/거래장부 조회 및 엑셀 내보내기
- 증빙/서류 보관함 관리
- 당사자가 제출한 가족관계증명서와 카드 등록 내역 확인

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase Auth, Database, Storage
- Tailwind CSS
- Vitest

## 실행

```bash
npm install
npm run dev
```

## 검증

```bash
npx tsc --noEmit
npm test
npm run build
```

## 환경 변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
SUPER_ADMIN_EMAIL=
```

## 운영 기간

운영 시작일과 종료일은 `src/constants/operation-period.ts`에서 관리합니다.
