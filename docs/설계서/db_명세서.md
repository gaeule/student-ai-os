# Student AI OS — DB 명세서

> **작성일**: 2026-06-01  
> **버전**: v1.0  
> **DB**: Supabase PostgreSQL

---

## 1. 전체 테이블 목록

| 테이블명 | 설명 | 상태 |
|---|---|---|
| `auth.users` | Supabase Auth 관리 (자동) | ✅ 운영 중 |
| `subjects` | 과목 정보 | ✅ 운영 중 |
| `assignments` | 과제 정보 | ✅ 운영 중 |
| `exams` | 시험 일정 | ⚠️ 예정 스키마 (Supabase 콘솔 확인 필요, 코드 미연동) |
| `daily_plans` | AI 추천 일별 기록 | 🔲 예정 스키마 (Supabase 콘솔 확인 필요, 코드 미연동) |

---

## 2. 테이블 상세 명세

---

### 2.1 subjects (과목)

```sql
CREATE TABLE subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  professor   text,
  semester    text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, name)  -- 동일 사용자의 중복 과목명 방지
);
```

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | ✅ | PK, 자동 생성 |
| user_id | uuid | ✅ | FK → auth.users |
| name | text | ✅ | 과목명 (예: 운영체제) |
| professor | text | - | 교수명 |
| semester | text | - | 학기 (예: 2026-1) |
| created_at | timestamptz | ✅ | 생성 시각 |

**인덱스**

```sql
-- PostgreSQL은 FK 컬럼 인덱스를 자동 생성하지 않음 — 명시적 생성 필요
CREATE INDEX idx_subjects_user_id ON subjects(user_id);
```

**RLS 정책**

```sql
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 과목만 조회
CREATE POLICY "subjects_select" ON subjects
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: 본인만 등록
CREATE POLICY "subjects_insert" ON subjects
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: 본인 과목만 수정
CREATE POLICY "subjects_update" ON subjects
  FOR UPDATE USING (user_id = auth.uid());

-- DELETE: 본인 과목만 삭제
CREATE POLICY "subjects_delete" ON subjects
  FOR DELETE USING (user_id = auth.uid());
```

---

### 2.2 assignments (과제)

```sql
CREATE TABLE assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       uuid REFERENCES subjects(id) ON DELETE SET NULL,
  title            text NOT NULL,
  due_date         date NOT NULL,
  difficulty       text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  estimated_hours  numeric(5,1) NOT NULL DEFAULT 1.0,
  status           text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority_score   numeric,  -- 향후 AI 우선순위 점수
  created_at       timestamptz NOT NULL DEFAULT now()
);
```

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | ✅ | PK |
| user_id | uuid | ✅ | FK → auth.users |
| subject_id | uuid | - | FK → subjects (NULL = 과목 미지정 or 삭제됨) |
| title | text | ✅ | 과제명 |
| due_date | date | ✅ | 마감일 (YYYY-MM-DD) |
| difficulty | text | ✅ | 난이도: easy / medium / hard |
| estimated_hours | numeric(5,1) | ✅ | 예상 소요시간 (0.5 단위) |
| status | text | ✅ | 상태: todo / in_progress / done |
| priority_score | numeric | - | AI 우선순위 점수 (미사용, 향후 활용) |
| created_at | timestamptz | ✅ | 생성 시각 |

**JOIN 쿼리 (subjects 이름 포함)**

```sql
SELECT assignments.*, subjects.name AS subject_name
FROM assignments
LEFT JOIN subjects ON assignments.subject_id = subjects.id
WHERE assignments.user_id = auth.uid()
ORDER BY due_date ASC;
```

Supabase JS 쿼리:
```typescript
.from("assignments")
.select("*, subjects(name)")
.order("due_date", { ascending: true })
```

**RLS 정책**

```sql
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignments_select" ON assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "assignments_insert" ON assignments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "assignments_update" ON assignments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "assignments_delete" ON assignments
  FOR DELETE USING (user_id = auth.uid());
```

---

### 2.3 exams (시험 일정)

> ⚠️ **현재 상태**: `subject text` 컬럼 사용 중. `subject_id uuid` 마이그레이션 예정 (W4).

**현재 스키마 (임시)**

```sql
CREATE TABLE exams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     text,          -- ⚠️ 임시: 향후 subject_id로 교체
  exam_date   date NOT NULL,
  topics      text[],
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**목표 스키마 (W4 마이그레이션 후)**

```sql
CREATE TABLE exams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id  uuid REFERENCES subjects(id) ON DELETE SET NULL,  -- 변경
  exam_type   text CHECK (exam_type IN ('midterm', 'final', 'quiz', 'practical')),
  exam_date   date NOT NULL,
  scope       text,          -- 시험 범위
  prep_days   integer DEFAULT 3,  -- 준비 필요 기간
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

**W4 마이그레이션 SQL**

```sql
-- 기존 subject text 컬럼 제거 후 subject_id 추가
ALTER TABLE exams
  DROP COLUMN IF EXISTS subject,
  ADD COLUMN subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN exam_type text CHECK (exam_type IN ('midterm', 'final', 'quiz', 'practical')),
  ADD COLUMN scope text,
  ADD COLUMN prep_days integer DEFAULT 3;
```

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | ✅ | PK |
| user_id | uuid | ✅ | FK → auth.users |
| subject_id | uuid | - | FK → subjects |
| exam_type | text | ✅ | midterm / final / quiz / practical |
| exam_date | date | ✅ | 시험 날짜 |
| scope | text | - | 시험 범위 텍스트 |
| prep_days | integer | - | 준비 필요 기간 (일), 기본 3일 |
| created_at | timestamptz | ✅ | 생성 시각 |

---

### 2.4 daily_plans (일별 AI 추천 기록)

> 현재 테이블 존재, 아직 기능 미사용. W5에서 추천 이력 저장 시 활용 예정.

```sql
CREATE TABLE daily_plans (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             date NOT NULL,
  available_hours  numeric(4,1),
  recommendations  jsonb,  -- AI 추천 결과 전체
  ai_comment       text,   -- AI 코멘트 텍스트
  created_at       timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, date)  -- 하루 1개만 저장
);
```

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | ✅ | PK |
| user_id | uuid | ✅ | FK → auth.users |
| date | date | ✅ | 해당 날짜 |
| available_hours | numeric(4,1) | - | 사용자 입력 가용 시간 |
| recommendations | jsonb | - | AI 추천 결과 배열 |
| ai_comment | text | - | AI 코멘트 텍스트 |
| created_at | timestamptz | ✅ | 생성 시각 |

**recommendations JSONB 구조 예시**

```json
[
  {
    "assignmentId": "uuid",
    "title": "DB 설계 과제",
    "allocatedHours": 2.0,
    "reason": "마감 D-2, 난이도 상"
  },
  {
    "assignmentId": "uuid",
    "title": "영어 에세이",
    "allocatedHours": 1.0,
    "reason": "마감 D-5, 난이도 중"
  }
]
```

---

## 3. Supabase Storage

### assignment-image 버킷

| 항목 | 값 |
|---|---|
| 버킷명 | `assignment-image` |
| 접근 유형 | Private (Signed URL 방식) |
| 파일 경로 | `{user_id}/{uuid}.{ext}` |
| 허용 MIME | image/jpeg, image/png, image/webp |
| 최대 파일 크기 | 5MB |

**Storage RLS 정책**

```sql
-- 업로드: 본인 폴더에만
CREATE POLICY "storage_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-image'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- 조회: 본인 파일만
CREATE POLICY "storage_select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-image'
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);
```

---

## 4. 테이블 관계도 (ERD)

```
auth.users
  │
  ├─── subjects (user_id)
  │       │
  │       ├─── assignments (subject_id) ←── SET NULL on delete
  │       │
  │       └─── exams (subject_id) ←── SET NULL on delete
  │
  ├─── assignments (user_id)
  ├─── exams (user_id)
  └─── daily_plans (user_id)
```

---

## 5. 데이터 무결성 규칙

| 규칙 | 구현 방법 |
|---|---|
| 과목 삭제 시 과제는 유지 | `subject_id` FK: `ON DELETE SET NULL` |
| 사용자 탈퇴 시 전체 삭제 | `user_id` FK: `ON DELETE CASCADE` |
| 동일 사용자 중복 과목명 불가 | `UNIQUE(user_id, name)` on subjects |
| difficulty 값 제한 | `CHECK (difficulty IN ('easy', 'medium', 'hard'))` |
| status 값 제한 | `CHECK (status IN ('todo', 'in_progress', 'done'))` |

---

## 6. 인덱스 전략

```sql
-- 과제 목록 조회 성능 (user_id + due_date 정렬)
CREATE INDEX idx_assignments_user_due ON assignments(user_id, due_date);

-- 시험 일정 조회 성능
CREATE INDEX idx_exams_user_date ON exams(user_id, exam_date);

-- 일별 계획 조회 성능
CREATE INDEX idx_daily_plans_user_date ON daily_plans(user_id, date);
```

---

*이 명세서는 W4 exams 마이그레이션 완료 후 업데이트 예정입니다.*
