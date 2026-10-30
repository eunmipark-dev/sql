---
title: GROUP BY · HAVING 절
subject: 2과목 · SQL 기본과 활용
chapter: 2-1. SQL 기본
summary: 행을 묶어 집계하고, 그룹에 조건을 거는 법
---

# GROUP BY · HAVING 절

GROUP BY 절은 행을 그룹으로 묶고, 집계 함수로 그룹별 통계를 구한다. HAVING 절은 만들어진 **그룹에 조건**을 거는 역할을 한다. 집계 함수가 **NULL을 다루는 방식**이 핵심 출제 포인트다.

## 예제 테이블

| EMPNO | ENAME | JOB | SAL | COMM | DEPTNO |
|-------|-------|-----|-----|------|--------|
| 7369 | SMITH | CLERK | 800 | NULL | 20 |
| 7499 | ALLEN | SALESMAN | 1600 | 300 | 30 |
| 7566 | JONES | MANAGER | 2975 | NULL | 20 |
| 7654 | MARTIN | SALESMAN | 1250 | 1400 | 30 |
| 7782 | CLARK | MANAGER | 2450 | NULL | 10 |
| 7839 | KING | PRESIDENT | 5000 | NULL | 10 |
| 7900 | JAMES | CLERK | 950 | NULL | 30 |
| 7902 | FORD | ANALYST | 3000 | NULL | 20 |

COMM 값이 있는 사원은 ALLEN(300), MARTIN(1400) 두 명뿐이다. 이 NULL들이 집계 결과를 어떻게 바꾸는지가 이 문서의 주제다.

## 집계 함수의 종류

| 함수 | 의미 | NULL 처리 |
|------|------|-----------|
| COUNT(*) | 행 수 | NULL 포함 모든 행을 셈 |
| COUNT(컬럼) | 해당 컬럼이 NULL이 아닌 행 수 | NULL 제외 |
| COUNT(DISTINCT 컬럼) | NULL을 제외한 고유 값 개수 | NULL 제외 |
| SUM(컬럼) | 합계 | NULL 제외 |
| AVG(컬럼) | 평균 | NULL 제외(분모에서도 제외) |
| MAX(컬럼) / MIN(컬럼) | 최댓값 / 최솟값 | NULL 제외. 문자·날짜에도 사용 가능 |
| STDDEV, VARIANCE | 표준편차, 분산 | NULL 제외 |

::: cards 3
- **COUNT(\*)만 예외** NULL이 있든 없든 **행 자체**를 센다. 모든 컬럼이 NULL인 행도 1건이다.
- **나머지는 NULL 제외** COUNT(컬럼), SUM, AVG, MAX, MIN 등은 NULL을 **없는 값처럼** 건너뛰고 계산한다.
- **DISTINCT 옵션** `DISTINCT`를 붙이면 중복을 제거한 뒤 집계한다. 기본값은 ALL이다.
:::

### 예제 테이블 전체 집계

```sql
SELECT COUNT(*), COUNT(COMM), COUNT(DISTINCT DEPTNO),
       SUM(COMM), AVG(COMM), AVG(NVL(COMM, 0))
FROM   EMP;
```

| COUNT(*) | COUNT(COMM) | COUNT(DISTINCT DEPTNO) | SUM(COMM) | AVG(COMM) | AVG(NVL(COMM,0)) |
|----------|-------------|------------------------|-----------|-----------|------------------|
| 8 | 2 | 3 | 1700 | 850 | 212.5 |

::: compare
- **AVG(COMM) = 850** NULL이 아닌 **2건**만으로 나눈다. 1700 / 2 = 850.
- **AVG(NVL(COMM, 0)) = 212.5** NULL을 0으로 바꿨으므로 **8건** 모두로 나눈다. 1700 / 8 = 212.5.
:::

> 시험 포인트: AVG(COMM)과 AVG(NVL(COMM, 0))의 결과는 다르다. "NULL이 있는 컬럼의 평균"을 묻는 문제에서 **분모가 몇 건인지** 반드시 확인하자.

### SUM(A + B)와 SUM(A) + SUM(B)의 차이

```sql
SELECT SUM(SAL + COMM), SUM(SAL) + SUM(COMM) FROM EMP;
```

| SUM(SAL+COMM) | SUM(SAL)+SUM(COMM) |
|---------------|--------------------|
| 4550 | 19725 |

::: warning 행 단위 연산이 먼저 NULL을 만든다
- `SAL + COMM`은 COMM이 NULL인 행에서 **NULL**이 되어 합계에서 빠진다. ALLEN(1900)과 MARTIN(2650)만 더해져 4550이다.
- `SUM(SAL) + SUM(COMM)`은 각각 NULL을 제외하고 합한 뒤 더하므로 18025 + 1700 = 19725다.
:::

## GROUP BY 절

GROUP BY는 지정한 컬럼 값이 같은 행끼리 **한 묶음**으로 만들고, 묶음마다 집계 결과를 **한 행씩** 돌려준다.

<figure class="md-figure">
<svg viewBox="0 0 640 270" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="EMP의 8개 행이 DEPTNO별 3개 그룹으로 묶이고 그룹마다 SUM(SAL) 한 행이 만들어지는 과정">
<defs><marker id="gb-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--primary)"/></marker></defs>
<text x="85" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">개별 행 (8행)</text>
<text x="320" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">GROUP BY DEPTNO</text>
<text x="550" y="22" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">SUM(SAL) (3행)</text>
<g stroke-width="1.2" fill="none" stroke-opacity="0.6">
<path d="M160 47 L240 148" stroke="oklch(0.65 0.14 160)"/><path d="M160 75 L240 226" stroke="oklch(0.75 0.16 75)"/><path d="M160 103 L240 148" stroke="oklch(0.65 0.14 160)"/><path d="M160 131 L240 226" stroke="oklch(0.75 0.16 75)"/><path d="M160 159 L240 70" stroke="oklch(0.62 0.17 255)"/><path d="M160 187 L240 70" stroke="oklch(0.62 0.17 255)"/><path d="M160 215 L240 226" stroke="oklch(0.75 0.16 75)"/><path d="M160 243 L240 148" stroke="oklch(0.65 0.14 160)"/>
</g>
<g font-size="12" fill="var(--foreground)">
<rect x="10" y="36" width="150" height="22" rx="5" fill="oklch(0.65 0.14 160)" fill-opacity="0.18" stroke="oklch(0.65 0.14 160)"/><text x="20" y="51">SMITH · 20 · 800</text>
<rect x="10" y="64" width="150" height="22" rx="5" fill="oklch(0.75 0.16 75)" fill-opacity="0.18" stroke="oklch(0.75 0.16 75)"/><text x="20" y="79">ALLEN · 30 · 1600</text>
<rect x="10" y="92" width="150" height="22" rx="5" fill="oklch(0.65 0.14 160)" fill-opacity="0.18" stroke="oklch(0.65 0.14 160)"/><text x="20" y="107">JONES · 20 · 2975</text>
<rect x="10" y="120" width="150" height="22" rx="5" fill="oklch(0.75 0.16 75)" fill-opacity="0.18" stroke="oklch(0.75 0.16 75)"/><text x="20" y="135">MARTIN · 30 · 1250</text>
<rect x="10" y="148" width="150" height="22" rx="5" fill="oklch(0.62 0.17 255)" fill-opacity="0.18" stroke="oklch(0.62 0.17 255)"/><text x="20" y="163">CLARK · 10 · 2450</text>
<rect x="10" y="176" width="150" height="22" rx="5" fill="oklch(0.62 0.17 255)" fill-opacity="0.18" stroke="oklch(0.62 0.17 255)"/><text x="20" y="191">KING · 10 · 5000</text>
<rect x="10" y="204" width="150" height="22" rx="5" fill="oklch(0.75 0.16 75)" fill-opacity="0.18" stroke="oklch(0.75 0.16 75)"/><text x="20" y="219">JAMES · 30 · 950</text>
<rect x="10" y="232" width="150" height="22" rx="5" fill="oklch(0.65 0.14 160)" fill-opacity="0.18" stroke="oklch(0.65 0.14 160)"/><text x="20" y="247">FORD · 20 · 3000</text>
</g>
<rect x="240" y="40" width="160" height="60" rx="10" fill="var(--card)" stroke="oklch(0.62 0.17 255)" stroke-width="2"/>
<text x="320" y="63" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">10번 그룹 (2행)</text>
<text x="320" y="85" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">2450 + 5000</text>
<rect x="240" y="118" width="160" height="60" rx="10" fill="var(--card)" stroke="oklch(0.65 0.14 160)" stroke-width="2"/>
<text x="320" y="141" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">20번 그룹 (3행)</text>
<text x="320" y="163" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">800 + 2975 + 3000</text>
<rect x="240" y="196" width="160" height="60" rx="10" fill="var(--card)" stroke="oklch(0.75 0.16 75)" stroke-width="2"/>
<text x="320" y="219" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">30번 그룹 (3행)</text>
<text x="320" y="241" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">1600 + 1250 + 950</text>
<path d="M404 70 L466 70" stroke="var(--primary)" stroke-width="2" marker-end="url(#gb-arrow)"/>
<path d="M404 148 L466 148" stroke="var(--primary)" stroke-width="2" marker-end="url(#gb-arrow)"/>
<path d="M404 226 L466 226" stroke="var(--primary)" stroke-width="2" marker-end="url(#gb-arrow)"/>
<rect x="472" y="53" width="158" height="34" rx="8" fill="var(--muted)" stroke="var(--border)"/><text x="551" y="75" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">10 │ 7450</text>
<rect x="472" y="131" width="158" height="34" rx="8" fill="var(--muted)" stroke="var(--border)"/><text x="551" y="153" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">20 │ 6775</text>
<rect x="472" y="209" width="158" height="34" rx="8" fill="var(--muted)" stroke="var(--border)"/><text x="551" y="231" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">30 │ 3800</text>
</svg>
<figcaption>같은 DEPTNO끼리 묶이고(그룹핑), 그룹마다 집계 결과 한 행이 남는다. 개별 행의 ENAME은 결과에 남지 않는다.</figcaption>
</figure>

```sql
SELECT   DEPTNO, COUNT(*) AS CNT, SUM(SAL) AS SUM_SAL,
         MAX(SAL) AS MAX_SAL, MIN(SAL) AS MIN_SAL, COUNT(COMM) AS CNT_COMM
FROM     EMP
GROUP BY DEPTNO
ORDER BY DEPTNO;
```

| DEPTNO | CNT | SUM_SAL | MAX_SAL | MIN_SAL | CNT_COMM |
|--------|-----|---------|---------|---------|----------|
| 10 | 2 | 7450 | 5000 | 2450 | 0 |
| 20 | 3 | 6775 | 3000 | 800 | 0 |
| 30 | 3 | 3800 | 1600 | 950 | 2 |

### GROUP BY 규칙

::: cards 2
- **SELECT 절 제약** SELECT 절에는 <strong>GROUP BY에 명시한 컬럼(표현식)</strong>과 **집계 함수**만 올 수 있다. 그 외 컬럼을 쓰면 오류다.
- **생략은 자유** 반대로 GROUP BY에 쓴 컬럼을 SELECT 절에 반드시 쓸 필요는 없다.
- **별칭 사용 불가** GROUP BY 절에는 컬럼 별칭을 쓸 수 없다. GROUP BY가 SELECT보다 먼저 실행되기 때문이다.
- **NULL 그룹** 그룹핑 컬럼 값이 NULL인 행들은 **하나의 NULL 그룹**으로 묶인다.
- **집계 조건은 HAVING** 집계 함수는 WHERE 절에 쓸 수 없다. 그룹 조건은 HAVING에 쓴다.
- **정렬 보장 없음** GROUP BY는 정렬을 보장하지 않는다. 순서가 필요하면 ORDER BY를 써야 한다.
:::

```sql
-- 오류: ENAME은 GROUP BY에도 없고 집계 함수도 아님
SELECT DEPTNO, ENAME, SUM(SAL) FROM EMP GROUP BY DEPTNO;

-- 정상: GROUP BY 컬럼을 SELECT에서 생략
SELECT SUM(SAL) FROM EMP GROUP BY DEPTNO;
```

첫 번째 SQL이 오류인 이유는 위 그림에서 보인다. 20번 그룹 한 행에 SMITH, JONES, FORD 중 **누구의 ENAME을 보여줄지** 정할 수 없다.

> 시험 포인트: GROUP BY를 사용한 SQL에서 SELECT 절에 GROUP BY에 없는 일반 컬럼이 있으면 오류다. 보기 중 실행 가능한 SQL을 고르는 문제에서 가장 먼저 확인하자.

## HAVING 절

HAVING 절은 GROUP BY로 만들어진 **그룹**에 조건을 적용한다.

```sql
SELECT   DEPTNO, SUM(SAL) AS SUM_SAL
FROM     EMP
GROUP BY DEPTNO
HAVING   SUM(SAL) > 5000;
```

| DEPTNO | SUM_SAL |
|--------|---------|
| 10 | 7450 |
| 20 | 6775 |

- HAVING 절에는 SELECT 절에 없는 집계 함수도 쓸 수 있다. 예: `HAVING COUNT(*) >= 3` → 20, 30번 부서.
- GROUP BY 없이 HAVING만 쓰면 테이블 전체를 **하나의 그룹**으로 보고 조건을 적용한다.
- 문법상 HAVING을 GROUP BY 앞에 써도 동작하는 DBMS가 있으나, GROUP BY 다음에 쓰는 것이 일반적이다.

### WHERE와 HAVING 비교

두 절의 차이는 **실행 시점** 하나로 정리된다. WHERE는 묶기 전, HAVING은 묶은 뒤에 거른다.

::: flow
- **FROM** 테이블 읽기
- **WHERE** 개별 행 거르기
- **GROUP BY** 그룹 만들기
- **HAVING** 그룹 거르기
- **SELECT** 컬럼 출력
:::

::: compare
- **WHERE** 대상은 **개별 행**. GROUP BY 이전에 실행되므로 집계 함수를 쓸 수 없다. 집계 전에 데이터를 줄이므로 성능상 유리하다.
- **HAVING** 대상은 **그룹**. GROUP BY 이후에 실행되므로 집계 함수를 쓸 수 있다. 집계 후에 거르므로 상대적으로 불리하다.
:::

| 구분 | WHERE | HAVING |
|------|-------|--------|
| 적용 대상 | 개별 행 | 그룹 |
| 실행 시점 | GROUP BY 이전 | GROUP BY 이후 |
| 집계 함수 사용 | 불가 | 가능 |
| 성능 | 집계 전 데이터를 줄여 유리 | 집계 후 거르므로 상대적으로 불리 |

```sql
SELECT   DEPTNO, COUNT(*) AS CNT, SUM(SAL) AS SUM_SAL
FROM     EMP
WHERE    SAL >= 1000          -- SMITH(800), JAMES(950) 먼저 제외
GROUP BY DEPTNO
HAVING   SUM(SAL) > 5000;
```

| DEPTNO | CNT | SUM_SAL |
|--------|-----|---------|
| 10 | 2 | 7450 |
| 20 | 2 | 5975 |

::: steps
1. **WHERE SAL >= 1000** SMITH(800), JAMES(950)이 먼저 빠져 6행이 남는다.
2. **GROUP BY DEPTNO** 부서별 합계는 10번 7450, 20번 5975, 30번 2850이 된다.
3. **HAVING SUM(SAL) > 5000** 2850인 30번 그룹이 제외된다.
:::

::: info 그룹핑 컬럼 조건은 WHERE로
그룹핑 컬럼에 대한 조건(`DEPTNO = 10`)은 HAVING에도 쓸 수 있지만, WHERE에 두면 집계 대상이 줄어 효율적이다.
:::

## 집계 함수 중첩

Oracle은 GROUP BY와 함께 집계 함수를 **한 번** 중첩할 수 있다.

```sql
SELECT MAX(SUM(SAL)) AS MAX_DEPT_SUM
FROM   EMP
GROUP BY DEPTNO;
-- 7450
```

- 그룹별 합계(7450, 6775, 3800) 중 최댓값 1건이 반환된다.
- 중첩 집계를 쓰면 결과가 1행이 되므로 SELECT 절에 DEPTNO 같은 그룹 컬럼을 함께 쓸 수 없다(오류).
- 중첩 집계는 GROUP BY가 반드시 있어야 하며, SQL Server는 집계 함수 중첩을 지원하지 않는다(인라인 뷰로 해결).

## 빈 결과에 대한 집계

조건에 맞는 행이 하나도 없을 때 결과는 **GROUP BY 유무**에 따라 다르다.

```sql
SELECT COUNT(*), COUNT(COMM), SUM(SAL), MAX(SAL)
FROM   EMP
WHERE  DEPTNO = 99;
```

| COUNT(*) | COUNT(COMM) | SUM(SAL) | MAX(SAL) |
|----------|-------------|----------|----------|
| 0 | 0 | NULL | NULL |

::: compare
- **GROUP BY 없음** 집계 함수는 **항상 1행**을 반환한다. COUNT는 0, 나머지 집계 함수는 NULL이다.
- **GROUP BY 있음** 같은 조건에 `GROUP BY DEPTNO`를 붙이면 만들어질 그룹이 없으므로 <strong>0행(공집합)</strong>이 반환된다.
:::

따라서 합계가 없을 때 0을 출력하려면 `NVL(SUM(SAL), 0)`처럼 집계 결과 **바깥에** NVL을 쓴다.

> 시험 포인트: 행이 없는 테이블에서 `SELECT COUNT(*)`는 0, `SELECT SUM(col)`은 NULL을 1행으로 반환한다. GROUP BY를 붙이면 아예 행이 나오지 않는다.

## 핵심 요약

- COUNT(*)만 NULL을 포함해 세고, 나머지 집계 함수는 NULL을 제외한다.
- AVG는 NULL을 분모에서도 빼므로 AVG(col)과 AVG(NVL(col, 0))은 다를 수 있다.
- SUM(A+B)는 A나 B가 NULL인 행이 빠지므로 SUM(A)+SUM(B)와 다를 수 있다.
- GROUP BY 사용 시 SELECT에는 그룹 컬럼과 집계 함수만 올 수 있다.
- WHERE는 그룹 전 행 필터, HAVING은 그룹 후 필터이며 집계 함수는 HAVING에서만 조건으로 쓴다.
- Oracle은 GROUP BY와 함께 집계 함수를 한 번 중첩할 수 있으며, 이때 그룹 컬럼은 함께 조회할 수 없다.
- 행이 없을 때 GROUP BY가 없으면 COUNT=0, SUM/MAX=NULL인 1행, GROUP BY가 있으면 0행이다.
