---
title: 윈도우 함수
subject: 2과목 · SQL 기본과 활용
chapter: 2-2. SQL 활용
summary: 행을 줄이지 않고 순위·누적·비율을 계산
---

# 윈도우 함수

윈도우 함수(Window Function)는 행과 행 사이의 관계를 이용해 순위, 누적합, 이동평균, 비율 등을 계산한다. GROUP BY와 달리 **결과 행 수를 줄이지 않고**, 원래 행마다 계산 값을 덧붙인다.

## 기본 문법

```sql
SELECT 윈도우함수(인수) OVER ( [PARTITION BY 컬럼]
                              [ORDER BY 컬럼 [ASC|DESC]]
                              [ROWS | RANGE 윈도우절] )
FROM   테이블;
```

OVER 절 안의 세 요소는 "나누고 → 줄 세우고 → 범위를 정한다" 순서로 읽으면 쉽다.

::: flow
- **PARTITION BY** 전체 행을 그룹으로 나눈다. 생략하면 전체가 하나의 파티션
- **ORDER BY** 파티션 안에서 순서를 정한다. 순위 함수에서는 필수
- **윈도우 절** 계산 대상이 되는 행의 범위를 지정한다 (ROWS 또는 RANGE)
:::

::: warning 쓸 수 있는 위치
윈도우 함수는 **SELECT 절과 ORDER BY 절에서만** 쓸 수 있다. WHERE, GROUP BY, HAVING 절에서는 쓸 수 없다. 윈도우 함수 결과로 필터링하려면 **인라인 뷰로 감싼 뒤** 바깥 WHERE에서 조건을 건다.
:::

## 예제 데이터

EMP 테이블 (전체 급여 합계 15000)

| ENAME | DEPTNO | SAL |
|---|---|---|
| 김민 | 10 | 3000 |
| 이준 | 10 | 2000 |
| 박솔 | 10 | 2000 |
| 최윤 | 20 | 4000 |
| 정하 | 20 | 3000 |
| 한결 | 20 | 1000 |

## 순위 함수 RANK, DENSE_RANK, ROW_NUMBER

```sql
SELECT ENAME, SAL,
       RANK()       OVER (ORDER BY SAL DESC) AS RNK,
       DENSE_RANK() OVER (ORDER BY SAL DESC) AS D_RNK,
       ROW_NUMBER() OVER (ORDER BY SAL DESC) AS RN
FROM   EMP;
```

| ENAME | SAL | RNK | D_RNK | RN |
|---|---|---|---|---|
| 최윤 | 4000 | 1 | 1 | 1 |
| 김민 | 3000 | 2 | 2 | 2 |
| 정하 | 3000 | 2 | 2 | 3 |
| 이준 | 2000 | 4 | 3 | 4 |
| 박솔 | 2000 | 4 | 3 | 5 |
| 한결 | 1000 | 6 | 4 | 6 |

::: cards 3
- **RANK** 동점은 같은 순위, 다음 순위는 동점 수만큼 **건너뛴다**
  - 1, 2, 2, 4
- **DENSE_RANK** 동점은 같은 순위, 다음 순위는 **건너뛰지 않는다**
  - 1, 2, 2, 3
- **ROW_NUMBER** 동점이어도 **서로 다른 번호**, 항상 연속
  - 1, 2, 3, 4
:::

| 함수 | 동점 처리 | 다음 순위 |
|---|---|---|
| RANK | 같은 순위 부여 | 동점 수만큼 건너뜀 (1, 2, 2, 4) |
| DENSE_RANK | 같은 순위 부여 | 건너뛰지 않음 (1, 2, 2, 3) |
| ROW_NUMBER | 서로 다른 번호 부여 | 항상 연속 (1, 2, 3, 4) |

ROW_NUMBER에서 동점인 김민과 정하 중 누가 2번을 받을지는 보장되지 않는다. 일정한 결과가 필요하면 `ORDER BY SAL DESC, ENAME`처럼 정렬 기준을 추가한다.

### 파티션별 순위

```sql
SELECT ENAME, DEPTNO, SAL,
       RANK() OVER (PARTITION BY DEPTNO ORDER BY SAL DESC) AS DEPT_RNK
FROM   EMP;
```

| ENAME | DEPTNO | SAL | DEPT_RNK |
|---|---|---|---|
| 김민 | 10 | 3000 | 1 |
| 이준 | 10 | 2000 | 2 |
| 박솔 | 10 | 2000 | 2 |
| 최윤 | 20 | 4000 | 1 |
| 정하 | 20 | 3000 | 2 |
| 한결 | 20 | 1000 | 3 |

부서가 바뀌면 순위가 1부터 다시 시작한다.

> 시험 포인트: 동점이 있을 때 RANK는 순위를 건너뛰고, DENSE_RANK는 건너뛰지 않으며, ROW_NUMBER는 동점에도 고유 번호를 준다. 결과표에서 세 함수를 구분하는 문제가 자주 나온다.

## 집계 윈도우 함수

SUM, MAX, MIN, AVG, COUNT 뒤에 OVER 절을 붙이면 윈도우 함수로 동작한다.

```sql
SELECT ENAME, DEPTNO, SAL,
       SUM(SAL)   OVER (PARTITION BY DEPTNO) AS DEPT_SUM,
       MAX(SAL)   OVER (PARTITION BY DEPTNO) AS DEPT_MAX,
       COUNT(*)   OVER (PARTITION BY DEPTNO) AS DEPT_CNT
FROM   EMP;
```

| ENAME | DEPTNO | SAL | DEPT_SUM | DEPT_MAX | DEPT_CNT |
|---|---|---|---|---|---|
| 김민 | 10 | 3000 | 7000 | 3000 | 3 |
| 이준 | 10 | 2000 | 7000 | 3000 | 3 |
| 박솔 | 10 | 2000 | 7000 | 3000 | 3 |
| 최윤 | 20 | 4000 | 8000 | 4000 | 3 |
| 정하 | 20 | 3000 | 8000 | 4000 | 3 |
| 한결 | 20 | 1000 | 8000 | 4000 | 3 |

ORDER BY 없이 PARTITION BY만 쓰면 **파티션 전체가 계산 범위**가 된다. 부서 최고 급여자만 뽑으려면 인라인 뷰에서 `SAL = DEPT_MAX` 조건을 건다.

## 윈도우 절 ROWS와 RANGE

윈도우 절은 "현재 행을 계산할 때 **어느 행부터 어느 행까지** 볼 것인가"를 정한다. 아래 그림은 SAL 오름차순으로 정렬한 6행에서 현재 행이 김민(3000)일 때, `UNBOUNDED PRECEDING ~ CURRENT ROW` 범위를 ROWS와 RANGE로 각각 잡은 모습이다.

<figure class="md-figure">
<svg viewBox="0 0 640 280" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="ROWS와 RANGE 윈도우 프레임 비교">
<text x="320" y="26" text-anchor="middle" font-size="12" fill="var(--muted-foreground)">파티션 전체 6행 · ORDER BY SAL</text>
<rect x="170" y="40" width="300" height="34" rx="6" fill="var(--card)" stroke="var(--border)"/>
<rect x="170" y="78" width="300" height="34" rx="6" fill="var(--card)" stroke="var(--border)"/>
<rect x="170" y="116" width="300" height="34" rx="6" fill="var(--card)" stroke="var(--border)"/>
<rect x="170" y="154" width="300" height="34" rx="6" fill="oklch(0.75 0.16 75)" fill-opacity="0.25" stroke="oklch(0.75 0.16 75)" stroke-width="2"/>
<rect x="170" y="192" width="300" height="34" rx="6" fill="var(--card)" stroke="var(--border)" stroke-dasharray="4 3"/>
<rect x="170" y="230" width="300" height="34" rx="6" fill="var(--muted)" stroke="var(--border)"/>
<g font-size="13" fill="var(--foreground)"><text x="186" y="62">한결</text><text x="186" y="100">이준</text><text x="186" y="138">박솔</text><text x="186" y="176" font-weight="700">김민</text><text x="186" y="214">정하</text><text x="186" y="252" fill="var(--muted-foreground)">최윤</text></g>
<g font-size="13" fill="var(--foreground)" text-anchor="end"><text x="454" y="62">1000</text><text x="454" y="100">2000</text><text x="454" y="138">2000</text><text x="454" y="176" font-weight="700">3000</text><text x="454" y="214">3000</text><text x="454" y="252" fill="var(--muted-foreground)">4000</text></g>
<g font-size="11" text-anchor="middle"><text x="320" y="61" fill="var(--muted-foreground)">UNBOUNDED PRECEDING</text><text x="320" y="175" font-weight="700" fill="var(--foreground)">CURRENT ROW</text><text x="320" y="213" fill="var(--muted-foreground)">동점 · RANGE만 포함</text><text x="320" y="251" fill="var(--muted-foreground)">범위 밖</text></g>
<path d="M160 42 H150 V186 H160" fill="none" stroke="oklch(0.62 0.17 255)" stroke-width="2.5"/>
<text x="140" y="96" text-anchor="end" font-size="14" font-weight="700" fill="oklch(0.62 0.17 255)">ROWS</text>
<text x="140" y="116" text-anchor="end" font-size="11" fill="var(--muted-foreground)">첫 행 ~ 현재 행</text>
<text x="140" y="136" text-anchor="end" font-size="12" font-weight="700" fill="var(--foreground)">SUM = 8000</text>
<path d="M480 42 H490 V224 H480" fill="none" stroke="oklch(0.65 0.14 160)" stroke-width="2.5"/>
<text x="500" y="110" font-size="14" font-weight="700" fill="oklch(0.65 0.14 160)">RANGE</text>
<text x="500" y="130" font-size="11" fill="var(--muted-foreground)">현재 값(3000)과</text>
<text x="500" y="146" font-size="11" fill="var(--muted-foreground)">같은 값까지</text>
<text x="500" y="166" font-size="12" font-weight="700" fill="var(--foreground)">SUM = 11000</text>
</svg>
<figcaption>ROWS는 행 위치로 끊고, RANGE는 같은 값(동점)인 정하까지 함께 묶는다</figcaption>
</figure>

::: compare
- **ROWS** **물리적인 행 위치** 기준. 현재 행 기준 앞뒤 몇 행. 동점이어도 한 행씩 따로 센다.
- **RANGE** **ORDER BY 컬럼의 값** 기준. 같은 값(동점)은 같은 범위로 묶인다.
:::

| 키워드 | 의미 |
|---|---|
| UNBOUNDED PRECEDING | 파티션의 첫 행 |
| n PRECEDING | 현재 행 기준 n행 앞 (RANGE면 값이 n만큼 작은 지점) |
| CURRENT ROW | 현재 행 (RANGE면 현재 값과 같은 값의 행 전체) |
| n FOLLOWING | 현재 행 기준 n행 뒤 (RANGE면 값이 n만큼 큰 지점) |
| UNBOUNDED FOLLOWING | 파티션의 마지막 행 |

`ROWS UNBOUNDED PRECEDING`처럼 시작점만 쓰면 끝점은 CURRENT ROW로 간주한다.

### 기본 윈도우 범위

::: info 윈도우 절을 생략하면
- ORDER BY가 **없으면** 파티션 전체가 범위다.
- ORDER BY가 **있고** 윈도우 절이 없으면 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`가 기본값이다.
:::

### 누적합에서 ROWS와 RANGE 차이

```sql
SELECT ENAME, SAL,
       SUM(SAL) OVER (ORDER BY SAL) AS RANGE_SUM,   -- 기본: RANGE
       SUM(SAL) OVER (ORDER BY SAL
                      ROWS UNBOUNDED PRECEDING) AS ROWS_SUM
FROM   EMP;
```

| ENAME | SAL | RANGE_SUM | ROWS_SUM |
|---|---|---|---|
| 한결 | 1000 | 1000 | 1000 |
| 이준 | 2000 | 5000 | 3000 |
| 박솔 | 2000 | 5000 | 5000 |
| 김민 | 3000 | 11000 | 8000 |
| 정하 | 3000 | 11000 | 11000 |
| 최윤 | 4000 | 15000 | 15000 |

RANGE는 동점(2000, 3000) 행을 한꺼번에 범위에 넣으므로 같은 값을 가진 행의 누적합이 같다. ROWS는 한 행씩 누적한다.

> 시험 포인트: ORDER BY만 있는 `SUM() OVER (ORDER BY ...)`는 RANGE 기준이라 동점 행의 누적합이 같게 나온다. 결과표에서 같은 값이 반복되면 RANGE, 계속 증가하면 ROWS로 판단한다.

### 이동 범위 예제

```sql
SELECT ENAME, SAL,
       SUM(SAL) OVER (ORDER BY SAL
                      ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS ROWS_3,
       SUM(SAL) OVER (ORDER BY SAL
                      RANGE BETWEEN 1000 PRECEDING AND 1000 FOLLOWING) AS RANGE_1000
FROM   EMP;
```

| ENAME | SAL | ROWS_3 | RANGE_1000 |
|---|---|---|---|
| 한결 | 1000 | 3000 | 5000 |
| 이준 | 2000 | 5000 | 11000 |
| 박솔 | 2000 | 7000 | 11000 |
| 김민 | 3000 | 8000 | 14000 |
| 정하 | 3000 | 10000 | 14000 |
| 최윤 | 4000 | 7000 | 10000 |

- **ROWS_3**: 앞 1행 + 현재 행 + 뒤 1행. 첫 행과 마지막 행은 2행만 합산한다.
- **RANGE_1000**: 현재 SAL ± 1000 범위의 값을 모두 합산한다. 예를 들어 SAL 3000이면 2000~4000 범위인 5개 행의 합 14000이다.

## 행 순서 함수 FIRST_VALUE, LAST_VALUE, LAG, LEAD

::: cards 2
- **FIRST_VALUE** 윈도우 범위의 첫 번째 값
- **LAST_VALUE** 윈도우 범위의 마지막 값 (기본 범위에 주의)
- **LAG(컬럼, n, 기본값)** n행 **앞**의 값을 가져온다
- **LEAD(컬럼, n, 기본값)** n행 **뒤**의 값을 가져온다
:::

### FIRST_VALUE와 LAST_VALUE

```sql
SELECT ENAME, SAL,
       FIRST_VALUE(ENAME) OVER (ORDER BY SAL DESC) AS FIRST_NM,
       LAST_VALUE(ENAME)  OVER (ORDER BY SAL DESC) AS LAST_DEFAULT,
       LAST_VALUE(ENAME)  OVER (ORDER BY SAL DESC
                                ROWS BETWEEN UNBOUNDED PRECEDING
                                         AND UNBOUNDED FOLLOWING) AS LAST_ALL
FROM   EMP
WHERE  DEPTNO = 20;
```

| ENAME | SAL | FIRST_NM | LAST_DEFAULT | LAST_ALL |
|---|---|---|---|---|
| 최윤 | 4000 | 최윤 | 최윤 | 한결 |
| 정하 | 3000 | 최윤 | 정하 | 한결 |
| 한결 | 1000 | 최윤 | 한결 | 한결 |

::: warning LAST_VALUE 함정
기본 범위가 **현재 행까지**이므로 LAST_VALUE는 사실상 현재 행 값을 돌려준다. 파티션의 마지막 값을 얻으려면 끝점을 **UNBOUNDED FOLLOWING**으로 지정해야 한다.
:::

### LAG와 LEAD

`LAG(컬럼, n, 기본값)`은 n행 앞, `LEAD(컬럼, n, 기본값)`은 n행 뒤의 값을 가져온다. n의 기본값은 1이고, 가져올 행이 없으면 기본값(생략 시 NULL)을 돌려준다.

월별 매출 SALES: 1월 100, 2월 150, 3월 120, 4월 200

```sql
SELECT MON, AMT,
       LAG(AMT)        OVER (ORDER BY MON) AS PREV_AMT,
       LEAD(AMT)       OVER (ORDER BY MON) AS NEXT_AMT,
       LAG(AMT, 2, 0)  OVER (ORDER BY MON) AS PREV2,
       AMT - LAG(AMT)  OVER (ORDER BY MON) AS DIFF
FROM   SALES;
```

| MON | AMT | PREV_AMT | NEXT_AMT | PREV2 | DIFF |
|---|---|---|---|---|---|
| 1월 | 100 | NULL | 150 | 0 | NULL |
| 2월 | 150 | 100 | 120 | 0 | 50 |
| 3월 | 120 | 150 | 200 | 100 | -30 |
| 4월 | 200 | 120 | NULL | 150 | 80 |

## 비율 함수 RATIO_TO_REPORT, PERCENT_RANK, CUME_DIST, NTILE

```sql
SELECT ENAME, SAL,
       RATIO_TO_REPORT(SAL) OVER ()            AS RATIO,
       PERCENT_RANK() OVER (ORDER BY SAL DESC) AS P_RANK,
       CUME_DIST()    OVER (ORDER BY SAL DESC) AS C_DIST,
       NTILE(4)       OVER (ORDER BY SAL DESC) AS NT
FROM   EMP;
```

| ENAME | SAL | RATIO | P_RANK | C_DIST | NT |
|---|---|---|---|---|---|
| 최윤 | 4000 | 0.2667 | 0 | 0.1667 | 1 |
| 김민 | 3000 | 0.2 | 0.2 | 0.5 | 1 |
| 정하 | 3000 | 0.2 | 0.2 | 0.5 | 2 |
| 이준 | 2000 | 0.1333 | 0.6 | 0.8333 | 2 |
| 박솔 | 2000 | 0.1333 | 0.6 | 0.8333 | 3 |
| 한결 | 1000 | 0.0667 | 1 | 1 | 4 |

| 함수 | 계산식 | 설명 |
|---|---|---|
| RATIO_TO_REPORT | 현재 값 / 파티션 합계 | 전체 대비 비중. NULL 값 제외. Oracle 전용, OVER 안에 ORDER BY 불가 |
| PERCENT_RANK | (RANK − 1) / (전체 행 수 − 1) | 첫 행 0, 마지막 순위 1 |
| CUME_DIST | 현재 행 이하(동점 포함) 행 수 / 전체 행 수 | 누적 분포. 0보다 크고 1 이하 |
| NTILE(n) | 행을 n개 그룹으로 균등 분할 | 나머지는 앞 그룹부터 1개씩 더 배정 |

::: example NTILE(4)로 6행 나누기
6 ÷ 4 = 1 나머지 2이다. 앞의 두 그룹이 2행씩, 뒤의 두 그룹이 1행씩 가져 그룹 크기는 **2, 2, 1, 1**이 된다.
:::

> 시험 포인트: CUME_DIST는 동점 행을 모두 포함해 계산한다. SAL 3000인 두 행은 4000, 3000, 3000까지 3행이 포함되어 3/6 = 0.5다. NTILE은 나머지 행을 앞 그룹부터 배정한다는 점을 기억한다.

## DBMS별 참고

- SQL Server는 2012 버전부터 ROWS/RANGE 윈도우 절, FIRST_VALUE, LAST_VALUE, LAG, LEAD, PERCENT_RANK, CUME_DIST를 지원한다.
- RATIO_TO_REPORT는 Oracle 전용이며 SQL Server에서는 `SAL * 1.0 / SUM(SAL) OVER ()`처럼 계산한다.
- 순위 함수를 활용한 상위 N건 조회는 [Top N 쿼리](/theory/top-n)를 참고한다.

## 핵심 요약

- 윈도우 함수는 OVER 절을 사용하며 결과 행 수를 줄이지 않는다.
- RANK(1,2,2,4), DENSE_RANK(1,2,2,3), ROW_NUMBER(1,2,3,4)로 동점 처리가 다르다.
- ORDER BY가 있으면 기본 범위는 RANGE UNBOUNDED PRECEDING부터 CURRENT ROW까지다.
- ROWS는 행 위치, RANGE는 값 기준이며 RANGE는 동점을 같은 범위로 묶는다.
- LAST_VALUE로 파티션 마지막 값을 얻으려면 UNBOUNDED FOLLOWING까지 범위를 넓힌다.
- LAG는 이전 행, LEAD는 다음 행 값을 가져오며 세 번째 인수로 NULL 대체값을 준다.
- PERCENT_RANK는 (순위−1)/(행수−1), CUME_DIST는 동점 포함 누적 비율이다.
- 윈도우 함수는 WHERE 절에 쓸 수 없으므로 인라인 뷰로 감싸 필터링한다.
