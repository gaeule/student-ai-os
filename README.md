# Student AI OS

대학생을 위한 AI 과제 관리 비서 앱입니다.
마감일·난이도·예상 소요시간을 종합해 오늘 뭘 해야 할지 우선순위를 자동으로 계산해줍니다.

## 주요 기능

- **과제 관리** — 과제 등록·삭제, 상태 추적 (시작 전 → 진행 중 → 완료)
- **오늘 할 일 추천** — 가용 시간 입력 시 우선순위 스코어 기반 과제 추천
- **대시보드** — 이번 주 과제 현황, 마감 임박 알림, 완료율 통계
- **인증** — 이메일 회원가입/로그인, Google OAuth

## 기술 스택

| 영역 | 기술 |
|---|---|
| Framework | Next.js 15 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui + @base-ui/react |
| Backend | Supabase (Auth + PostgreSQL + RLS) |
| Form | react-hook-form + zod |
| Date | date-fns (한국어 로케일) |

## 시작하기

### 1. 패키지 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 Supabase 프로젝트 정보를 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Supabase DB 테이블 생성

Supabase 대시보드 → SQL Editor에서 아래 쿼리를 실행합니다.

```sql
create table public.assignments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null,
  subject          text not null,
  due_date         date not null,
  difficulty       text not null check (difficulty in ('easy', 'medium', 'hard')),
  estimated_hours  numeric(4, 1) not null check (estimated_hours > 0),
  status           text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  created_at       timestamptz not null default now()
);

alter table public.assignments enable row level security;

create policy "본인 과제 조회" on public.assignments for select using (auth.uid() = user_id);
create policy "본인 과제 등록" on public.assignments for insert with check (auth.uid() = user_id);
create policy "본인 과제 수정" on public.assignments for update using (auth.uid() = user_id);
create policy "본인 과제 삭제" on public.assignments for delete using (auth.uid() = user_id);
```

### 4. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인합니다.

## 프로젝트 구조

```
src/
├── app/
│   ├── (app)/              # 사이드바+헤더 레이아웃
│   │   ├── dashboard/      # 대시보드
│   │   ├── assignments/    # 과제 관리
│   │   └── today/          # 오늘 할 일 추천
│   └── (auth)/             # 풀스크린 레이아웃
│       ├── login/
│       └── signup/
├── lib/
│   ├── actions/            # Server Actions (CRUD)
│   ├── supabase/           # Supabase 클라이언트
│   └── priority.ts         # 우선순위 계산 알고리즘
└── types/                  # 공통 타입 정의
```

## 우선순위 알고리즘

OpenAI 없이 순수 공식으로 계산합니다.

```
score = 긴급도 × 0.60 + 난이도 × 0.25 + 소요시간 적합도 × 0.15
```

- **긴급도**: 마감까지 남은 일수가 적을수록 높음
- **난이도**: 상(hard) > 중(medium) > 하(easy)
- **소요시간 적합도**: 가용 시간 내에 완료 가능한 과제 우선
