# 중랑구청 개인예산 관리 앱

개인예산제 당사자의 자기주도 개인예산 사용을 돕기 위한 웹 애플리케이션입니다. 당사자는 남은 예산과 사용 내역을 쉽게 확인하고, 영수증과 활동 사진을 제출할 수 있습니다. 지원자와 관리자는 제출된 거래를 검토하고, 예산과 증빙 자료를 한곳에서 관리합니다.

## 핵심 기능

### 당사자용 화면

- 이번 달 남은 예산, 사용 금액, 최근 거래 내역 확인
- 영수증 사진, 활동 사진, 카드 앞뒷면, 가족관계증명서 제출
- 달력과 갤러리에서 월별 활동 기록 확인
- 쉬운 말 도움말, 음성 안내, 글자 크기 조절, 고대비, 읽기 쉬운 화면 설정
- 예산 사용 흐름을 숫자, 그래프, 시각 위젯으로 확인

### 지원자/관리자용 화면

- 당사자 등록, 담당자 배정, 프로필 및 예산 정보 관리
- 재원별 월 예산, 잔액, 시작일/종료일 관리
- 거래 내역 직접 등록, 수정, 삭제
- 제출된 영수증과 활동 사진 검토 및 승인/보류/반려 처리
- 카드 등록 자료, 가족관계증명서, 기타 증빙 서류 확인
- 거래 목록 필터링, 정렬, 엑셀 내보내기

### 예산 관리

- 2026년 5월부터 10월까지의 운영 기간 기준 예산 흐름 관리
- 재원별 월 예산과 잔액 계산
- 월별 이월 처리 로직
- 지출/수입 거래 구분
- 반려 거래 및 검토 대기 거래 상태 관리

## 기술 스택

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Supabase Auth, Database, Storage
- Vitest
- Vercel Analytics / Speed Insights

## 프로젝트 구조

```text
src/
  app/                 Next.js App Router 페이지와 서버 액션
  components/          화면별 UI 컴포넌트
  constants/           운영 기간 등 공통 상수
  hooks/               인증, 접근성, 첫 방문 처리 훅
  types/               Supabase 및 UI 타입
  utils/               예산 계산, Supabase 클라이언트, 파일 저장 유틸
supabase/
  migrations/          데이터베이스 스키마 변경 이력
```

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
SUPER_ADMIN_EMAIL=
```

### 3. 개발 서버 실행

```bash
npm run dev
```

기본 주소는 `http://localhost:3000`입니다.

## 검증 명령어

```bash
npm run lint
npm test
npm run build
```

필요할 때 TypeScript 타입 검사는 아래 명령으로 별도 실행할 수 있습니다.

```bash
npx tsc --noEmit
```

## 운영 기간

현재 운영 기간은 `2026-05-01`부터 `2026-10-31`까지입니다. 기간 값은 [src/constants/operation-period.ts](src/constants/operation-period.ts)에서 관리합니다.

## Supabase 데이터베이스 설정 (Fork 시 셋업 가이드)

본 프로젝트를 포크(Fork)하여 자신만의 Supabase 대시보드에 데이터베이스를 구축하는 방법입니다.

### 방법 1: Supabase 대시보드 (SQL Editor) 사용 (추천 - 1분 소요)

1. [Supabase Dashboard](https://supabase.com/dashboard) 로그인 후 프로젝트를 생성합니다.
2. 왼쪽 메뉴의 **SQL Editor**로 이동합니다.
3. [supabase/schema.sql](supabase/schema.sql) 파일의 전체 내용을 복사하여 SQL Editor 창에 붙여넣습니다.
4. **Run** 버튼을 클릭하여 모든 테이블, RLS 보안 정책, 스토리지 버킷 및 자동화 트리거를 한 번에 생성합니다.

### 방법 2: Supabase CLI 사용

```bash
npx supabase db push
```

## 데이터와 권한

- 인증과 사용자 관리는 Supabase Auth를 사용합니다.
- 당사자, 지원자, 관리자 역할은 `profiles`와 관련 정책을 기준으로 분리됩니다.
- 영수증, 활동 사진, 카드 이미지, 제출 서류는 Supabase Storage에 저장됩니다.
- 주요 보안 정책과 데이터베이스 스키마는 [supabase/schema.sql](supabase/schema.sql) 및 [supabase/migrations/01_initial_schema.sql](supabase/migrations/01_initial_schema.sql)에 깔끔하게 정리되어 있습니다.

## 배포

Vercel 배포를 기준으로 구성되어 있습니다. 배포 환경에도 로컬과 동일한 Supabase 환경 변수를 등록해야 하며, Storage 버킷과 RLS 정책이 마이그레이션과 일치해야 합니다.
