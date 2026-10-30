---
title: ORDER BY 절
subject: 2과목 · SQL 기본과 활용
chapter: 2-1. SQL 기본
summary: 정렬 기준 지정법과 DBMS별 NULL 위치
---

# ORDER BY 절

ORDER BY 절은 조회 결과를 지정한 기준으로 정렬한다. 논리적 실행 순서에서 **가장 마지막**에 수행되며, **NULL 정렬 위치**와 **SELECT에 없는 컬럼으로 정렬할 수 있는지**가 자주 출제된다.

## 예제 테이블

| ENAME | DEPTNO | SAL | COMM |
|-------|--------|-----|------|
| SMITH | 20 | 800 | NULL |
| ALLEN | 30 | 1600 | 300 |
| WARD | 30 | 1250 | 500 |
| MARTIN | 30 | 1250 | 1400 |
| TURNER | 30 | 1500 | 0 |
| KING | 10 | 5000 | NULL |

## 기본 문법

```sql
SELECT 컬럼, ...
FROM   테이블
[WHERE ...] [GROUP BY ...] [HAVING ...]
ORDER BY 기준1 [ASC | DESC], 기준2 [ASC | DESC], ...;
```

::: cards 2
- **ASC가 기본값** ASC(오름차순)는 생략 가능하다. DESC는 내림차순이다.
- **기준마다 방향 지정** `ORDER BY A, B DESC`는 A 오름차순, B 내림차순이다. DESC가 앞 기준까지 적용되지 않는다.
- **동점일 때만 다음 기준** 첫 번째 기준 값이 같은 행끼리만 두 번째 기준으로 정렬한다.
- **오름차순의 앞쪽** 숫자는 작은 값, 날짜는 이른 날짜, 문자는 사전순(문자 코드순)이 먼저 나온다.
:::

ORDER BY가 없으면 결과 순서는 **보장되지 않는다**.

```sql
SELECT ENAME, DEPTNO, SAL
FROM   EMP
ORDER BY DEPTNO, SAL DESC, ENAME;
```

| ENAME | DEPTNO | SAL |
|-------|--------|-----|
| KING | 10 | 5000 |
| SMITH | 20 | 800 |
| ALLEN | 30 | 1600 |
| TURNER | 30 | 1500 |
| MARTIN | 30 | 1250 |
| WARD | 30 | 1250 |

::: steps
1. **DEPTNO 오름차순** 10 → 20 → 30 순으로 큰 묶음이 정해진다.
2. **SAL 내림차순** 30번 부서 안에서 1600 → 1500 → 1250 순이 된다.
3. **ENAME 오름차순** SAL이 1250으로 같은 MARTIN과 WARD는 이름 사전순으로 정렬된다.
:::

## 정렬 기준 지정 방식

::: cards 2
- **컬럼명** `ORDER BY SAL` 가장 일반적인 방식이다.
- **컬럼 별칭** `ORDER BY 연봉` SELECT 절에서 정의한 별칭을 쓴다.
- **위치 번호** `ORDER BY 2` SELECT 절의 n번째 항목을 가리킨다.
- **표현식** `ORDER BY SAL * 12` 함수·연산식도 가능하다.
:::

| 방식 | 예시 | 비고 |
|------|------|------|
| 컬럼명 | `ORDER BY SAL` | 가장 일반적 |
| 컬럼 별칭 | `ORDER BY 연봉` | SELECT 절에서 정의한 별칭 |
| 위치 번호 | `ORDER BY 2` | SELECT 절의 n번째 항목 |
| 표현식 | `ORDER BY SAL * 12` | 함수·연산식도 가능 |

```sql
SELECT ENAME, SAL * 12 AS 연봉, DEPTNO
FROM   EMP
ORDER BY DEPTNO, 2 DESC;        -- 컬럼명과 위치 번호 혼용 가능

SELECT ENAME, SAL * 12 AS 연봉, DEPTNO
FROM   EMP
ORDER BY 3, 연봉 DESC;          -- 위치 번호와 별칭 혼용 가능
```

- 컬럼명, 별칭, 위치 번호를 하나의 ORDER BY 안에서 **혼용할 수 있다**.
- 위치 번호는 SELECT 목록이 바뀌면 의미가 달라지므로 실무에서는 가독성이 떨어진다.

::: warning 위치 번호 범위 초과
위치 번호는 SELECT 절 항목 수를 넘을 수 없다. `SELECT ENAME, SAL ... ORDER BY 3`은 SELECT 항목이 2개뿐이므로 **오류**다.
:::

> 시험 포인트: ORDER BY는 SELECT 다음에 실행되므로 컬럼 별칭을 사용할 수 있는 유일한 절이다. 컬럼명·별칭·위치 번호를 섞어 써도 오류가 아니다.

## NULL 정렬 순서

DBMS마다 NULL을 정렬하는 위치가 다르다. NULL을 **가장 큰 값**으로 보느냐, **가장 작은 값**으로 보느냐의 차이다.

::: compare
- **Oracle** NULL을 **가장 큰 값**으로 취급한다. ASC 정렬 시 **맨 뒤**, DESC 정렬 시 **맨 앞**에 온다.
- **SQL Server** NULL을 **가장 작은 값**으로 취급한다. ASC 정렬 시 **맨 앞**, DESC 정렬 시 **맨 뒤**에 온다.
:::

| DBMS | NULL 취급 | ASC 정렬 시 | DESC 정렬 시 |
|------|-----------|-------------|--------------|
| Oracle | 가장 큰 값 | 맨 뒤 | 맨 앞 |
| SQL Server | 가장 작은 값 | 맨 앞 | 맨 뒤 |

```sql
SELECT ENAME, COMM FROM EMP ORDER BY COMM;
```

<figure class="md-figure">
<svg viewBox="0 0 640 170" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="ORDER BY COMM 오름차순에서 Oracle은 NULL이 맨 뒤, SQL Server는 NULL이 맨 앞">
<defs><marker id="ob-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--muted-foreground)"/></marker></defs>
<text x="130" y="24" font-size="12" fill="var(--muted-foreground)">ORDER BY COMM (ASC)</text>
<path d="M300 20 L620 20" stroke="var(--muted-foreground)" stroke-width="1.5" marker-end="url(#ob-arrow)"/>
<text x="460" y="36" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">출력 순서</text>
<text x="12" y="76" font-size="14" font-weight="700" fill="var(--foreground)">Oracle</text>
<text x="12" y="92" font-size="11" fill="var(--muted-foreground)">NULL = 최대</text>
<g font-size="13" text-anchor="middle">
<rect x="130" y="56" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="167" y="78" fill="var(--foreground)">0</text>
<rect x="212" y="56" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="249" y="78" fill="var(--foreground)">300</text>
<rect x="294" y="56" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="331" y="78" fill="var(--foreground)">500</text>
<rect x="376" y="56" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="413" y="78" fill="var(--foreground)">1400</text>
<rect x="458" y="56" width="74" height="34" rx="8" fill="oklch(0.63 0.21 25)" fill-opacity="0.15" stroke="oklch(0.63 0.21 25)"/><text x="495" y="78" font-weight="700" fill="var(--foreground)">NULL</text>
<rect x="540" y="56" width="74" height="34" rx="8" fill="oklch(0.63 0.21 25)" fill-opacity="0.15" stroke="oklch(0.63 0.21 25)"/><text x="577" y="78" font-weight="700" fill="var(--foreground)">NULL</text>
</g>
<text x="12" y="136" font-size="14" font-weight="700" fill="var(--foreground)">SQL Server</text>
<text x="12" y="152" font-size="11" fill="var(--muted-foreground)">NULL = 최소</text>
<g font-size="13" text-anchor="middle">
<rect x="130" y="116" width="74" height="34" rx="8" fill="oklch(0.62 0.17 255)" fill-opacity="0.15" stroke="oklch(0.62 0.17 255)"/><text x="167" y="138" font-weight="700" fill="var(--foreground)">NULL</text>
<rect x="212" y="116" width="74" height="34" rx="8" fill="oklch(0.62 0.17 255)" fill-opacity="0.15" stroke="oklch(0.62 0.17 255)"/><text x="249" y="138" font-weight="700" fill="var(--foreground)">NULL</text>
<rect x="294" y="116" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="331" y="138" fill="var(--foreground)">0</text>
<rect x="376" y="116" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="413" y="138" fill="var(--foreground)">300</text>
<rect x="458" y="116" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="495" y="138" fill="var(--foreground)">500</text>
<rect x="540" y="116" width="74" height="34" rx="8" fill="var(--card)" stroke="var(--border)"/><text x="577" y="138" fill="var(--foreground)">1400</text>
</g>
</svg>
<figcaption>같은 SQL이라도 NULL이 Oracle에서는 맨 뒤, SQL Server에서는 맨 앞에 출력된다. 0은 NULL이 아니라 가장 작은 숫자다.</figcaption>
</figure>

Oracle 결과

| ENAME | COMM |
|-------|------|
| TURNER | 0 |
| ALLEN | 300 |
| WARD | 500 |
| MARTIN | 1400 |
| SMITH | NULL |
| KING | NULL |

- SQL Server에서 같은 SQL을 실행하면 SMITH, KING(NULL)이 맨 앞에 오고 그 뒤에 0, 300, 500, 1400 순으로 나온다.
- NULL끼리의 순서는 보장되지 않는다.
- 0은 NULL이 아니라 값이므로 TURNER는 숫자 정렬 위치(가장 작은 값)에 놓인다.

### NULLS FIRST / NULLS LAST

Oracle은 NULL 위치를 직접 지정할 수 있다.

```sql
SELECT ENAME, COMM FROM EMP ORDER BY COMM NULLS FIRST;      -- NULL을 맨 앞으로
SELECT ENAME, COMM FROM EMP ORDER BY COMM DESC NULLS LAST;  -- 내림차순이면서 NULL은 맨 뒤로
```

::: info SQL Server에서는
SQL Server는 NULLS FIRST/LAST를 지원하지 않는다. `ORDER BY CASE WHEN COMM IS NULL THEN 1 ELSE 0 END, COMM`처럼 CASE 식으로 처리한다.
:::

> 시험 포인트: Oracle은 NULL을 최댓값으로 보아 ASC에서 마지막, DESC에서 처음에 출력한다. SQL Server는 반대다. 결과 테이블의 첫 행·마지막 행을 묻는 문제에서 DBMS를 꼭 확인하자.

## SELECT에 없는 컬럼으로 정렬

기본적으로는 가능하다. 단, 원래 행의 정보가 사라지는 상황에서는 제약이 생긴다.

::: cards 2
- **일반 SELECT문 → 가능** DBMS는 정렬에 필요한 컬럼을 내부적으로 함께 읽어 둔다.
- **DISTINCT → 불가** 중복 제거 뒤에는 원래 행의 다른 컬럼 값을 특정할 수 없으므로 **SELECT 목록에 없는 컬럼**으로 정렬할 수 없다.
- **GROUP BY → 제한** 그룹 단위 데이터만 남으므로 **GROUP BY 컬럼, 집계 함수, SELECT 항목**만 쓸 수 있다.
- **인라인 뷰 → 제한** 바깥 쿼리의 ORDER BY는 인라인 뷰가 SELECT한 컬럼만 참조할 수 있다.
:::

### 일반 SELECT문

```sql
SELECT ENAME FROM EMP ORDER BY SAL DESC;
-- KING, ALLEN, TURNER, WARD/MARTIN, SMITH
```

### DISTINCT를 사용한 경우

```sql
SELECT DISTINCT DEPTNO FROM EMP ORDER BY SAL;   -- 오류
SELECT DISTINCT DEPTNO FROM EMP ORDER BY DEPTNO; -- 정상
```

30번 부서 한 행에는 SAL이 1600, 1250, 1500 등 여러 값이 섞여 있다. 어느 값으로 정렬할지 정할 수 없어 오류가 난다.

### GROUP BY를 사용한 경우

SELECT에 없더라도 **집계 함수로 정렬하는 것은 가능**하다.

```sql
-- 오류: SAL은 그룹 컬럼도 집계 함수도 아님
SELECT DEPTNO, SUM(SAL) FROM EMP GROUP BY DEPTNO ORDER BY SAL;

-- 정상: SELECT에 없는 집계 함수로 정렬
SELECT DEPTNO, SUM(SAL) FROM EMP GROUP BY DEPTNO ORDER BY COUNT(*) DESC;
```

### 인라인 뷰를 사용한 경우

바깥 쿼리의 ORDER BY는 인라인 뷰가 SELECT한 컬럼만 참조할 수 있다. 인라인 뷰 안쪽 테이블의 다른 컬럼은 보이지 않는다.

> 시험 포인트: "ORDER BY에는 SELECT 절에 없는 컬럼을 사용할 수 없다"는 일반적으로 틀린 문장이다. 단, DISTINCT나 GROUP BY를 사용한 경우에는 제약이 생긴다.

## 실행 순서상 위치

::: flow
- **FROM** 테이블
- **WHERE** 행 필터
- **GROUP BY** 그룹
- **HAVING** 그룹 필터
- **SELECT** 별칭 정의
- **ORDER BY** 마지막 정렬
:::

- ORDER BY는 가장 마지막에 수행되므로 SELECT 절에서 계산한 표현식과 별칭을 그대로 쓸 수 있다.
- 정렬은 대량 데이터에서 비용이 큰 작업이므로, 필요한 경우에만 쓰는 것이 좋다.

::: warning ROWNUM과 ORDER BY
Oracle에서 ROWNUM과 ORDER BY를 같은 쿼리 블록에 쓰면 **ROWNUM이 먼저 매겨진 뒤 정렬**된다. 정렬 후 상위 N건을 구하려면 인라인 뷰를 사용해야 한다. 자세한 내용은 [TOP-N 쿼리](/theory/top-n) 참고.
:::

## 핵심 요약

- ORDER BY의 기본 정렬은 ASC이며 기준별로 ASC/DESC를 따로 지정한다.
- 컬럼명, 별칭, 위치 번호, 표현식을 정렬 기준으로 쓰고 서로 혼용할 수 있다.
- 위치 번호가 SELECT 항목 수를 넘으면 오류다.
- Oracle은 NULL을 최댓값(ASC 시 마지막), SQL Server는 최솟값(ASC 시 처음)으로 정렬한다.
- Oracle은 NULLS FIRST / NULLS LAST로 NULL 위치를 지정할 수 있다.
- SELECT에 없는 컬럼으로도 정렬 가능하나, DISTINCT·GROUP BY 사용 시에는 제약이 있다.
- ORDER BY는 논리적 실행 순서상 가장 마지막에 수행된다.
