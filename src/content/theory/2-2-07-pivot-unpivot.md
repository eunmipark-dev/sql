---
title: PIVOT / UNPIVOT 절
subject: 2과목 · SQL 기본과 활용
chapter: 2-2. SQL 활용
summary: 행을 열로 펼치고, 열을 행으로 접기
---

# PIVOT / UNPIVOT 절

**PIVOT**은 행 값을 열(컬럼)로 펼치고, **UNPIVOT**은 여러 열을 행으로 접는다. 보고서 형태의 교차표를 만들거나, 반대로 교차표를 정규화된 형태로 되돌릴 때 사용한다.

<figure class="md-figure">
<svg viewBox="0 0 640 210" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="세로로 긴 테이블이 PIVOT으로 가로 테이블이 되고 UNPIVOT으로 다시 세로가 되는 그림">
<defs><marker id="pivot-unpivot-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--primary)"/></marker></defs>
<text x="110" y="26" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">세로로 긴 테이블</text>
<text x="525" y="26" text-anchor="middle" font-size="13" font-weight="700" fill="var(--foreground)">가로로 넓은 교차표</text>
<rect x="20" y="40" width="180" height="26" fill="var(--muted)" stroke="var(--border)"/>
<rect x="20" y="66" width="180" height="26" fill="oklch(0.75 0.16 75)" fill-opacity="0.25" stroke="var(--border)"/>
<rect x="20" y="92" width="180" height="26" fill="var(--card)" stroke="var(--border)"/>
<rect x="20" y="118" width="180" height="26" fill="oklch(0.75 0.16 75)" fill-opacity="0.25" stroke="var(--border)"/>
<rect x="20" y="144" width="180" height="26" fill="var(--card)" stroke="var(--border)"/>
<rect x="20" y="170" width="180" height="26" fill="var(--card)" stroke="var(--border)"/>
<path d="M80 40 L80 196 M140 40 L140 196" stroke="var(--border)"/>
<text x="50" y="57" text-anchor="middle" font-size="12" font-weight="700" fill="var(--foreground)">YR</text><text x="110" y="57" text-anchor="middle" font-size="12" font-weight="700" fill="var(--foreground)">QTR</text><text x="170" y="57" text-anchor="middle" font-size="12" font-weight="700" fill="var(--foreground)">AMT</text>
<text x="50" y="83" text-anchor="middle" font-size="12" fill="var(--foreground)">2023</text><text x="110" y="83" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.62 0.17 255)">Q1</text><text x="170" y="83" text-anchor="middle" font-size="12" fill="var(--foreground)">100</text>
<text x="50" y="109" text-anchor="middle" font-size="12" fill="var(--foreground)">2023</text><text x="110" y="109" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.65 0.14 160)">Q2</text><text x="170" y="109" text-anchor="middle" font-size="12" fill="var(--foreground)">200</text>
<text x="50" y="135" text-anchor="middle" font-size="12" fill="var(--foreground)">2023</text><text x="110" y="135" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.62 0.17 255)">Q1</text><text x="170" y="135" text-anchor="middle" font-size="12" fill="var(--foreground)">50</text>
<text x="50" y="161" text-anchor="middle" font-size="12" fill="var(--foreground)">2024</text><text x="110" y="161" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.62 0.17 255)">Q1</text><text x="170" y="161" text-anchor="middle" font-size="12" fill="var(--foreground)">300</text>
<text x="50" y="187" text-anchor="middle" font-size="12" fill="var(--foreground)">2024</text><text x="110" y="187" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.65 0.14 160)">Q2</text><text x="170" y="187" text-anchor="middle" font-size="12" fill="var(--foreground)">150</text>
<path d="M215 92 L405 92" stroke="var(--primary)" stroke-width="3" marker-end="url(#pivot-unpivot-arrow)"/>
<text x="310" y="82" text-anchor="middle" font-size="13" font-weight="700" fill="var(--primary)">PIVOT</text>
<text x="310" y="112" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">행 → 열 · SUM으로 집계</text>
<path d="M405 160 L215 160" stroke="var(--primary)" stroke-width="3" stroke-dasharray="6 4" marker-end="url(#pivot-unpivot-arrow)"/>
<text x="310" y="150" text-anchor="middle" font-size="13" font-weight="700" fill="var(--primary)">UNPIVOT</text>
<text x="310" y="180" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">열 → 행 · 집계값 그대로</text>
<rect x="420" y="40" width="210" height="26" fill="var(--muted)" stroke="var(--border)"/>
<rect x="420" y="66" width="210" height="26" fill="var(--card)" stroke="var(--border)"/>
<rect x="420" y="92" width="210" height="26" fill="var(--card)" stroke="var(--border)"/>
<rect x="490" y="66" width="70" height="26" fill="oklch(0.75 0.16 75)" fill-opacity="0.25" stroke="var(--border)"/>
<path d="M490 40 L490 118 M560 40 L560 118" stroke="var(--border)"/>
<text x="455" y="57" text-anchor="middle" font-size="12" font-weight="700" fill="var(--foreground)">YR</text><text x="525" y="57" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.62 0.17 255)">Q1</text><text x="595" y="57" text-anchor="middle" font-size="12" font-weight="700" fill="oklch(0.65 0.14 160)">Q2</text>
<text x="455" y="83" text-anchor="middle" font-size="12" fill="var(--foreground)">2023</text><text x="525" y="83" text-anchor="middle" font-size="12" font-weight="700" fill="var(--foreground)">150</text><text x="595" y="83" text-anchor="middle" font-size="12" fill="var(--foreground)">200</text>
<text x="455" y="109" text-anchor="middle" font-size="12" fill="var(--foreground)">2024</text><text x="525" y="109" text-anchor="middle" font-size="12" fill="var(--foreground)">300</text><text x="595" y="109" text-anchor="middle" font-size="12" fill="var(--foreground)">150</text>
<text x="525" y="142" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">2023 Q1 = 100 + 50</text>
<text x="525" y="160" text-anchor="middle" font-size="11" fill="var(--muted-foreground)">QTR 값이 열 이름이 된다</text>
</svg>
<figcaption>PIVOT은 QTR 값(Q1, Q2)을 열로 펼치며 집계한다. UNPIVOT으로 접으면 150은 한 행으로 돌아올 뿐 100과 50으로 나뉘지 않는다.</figcaption>
</figure>

## 예제 데이터

SALES 테이블

| REGION | YR | QTR | AMT |
|---|---|---|---|
| 서울 | 2023 | Q1 | 100 |
| 서울 | 2023 | Q2 | 200 |
| 부산 | 2023 | Q1 | 50 |
| 서울 | 2024 | Q1 | 300 |
| 부산 | 2024 | Q2 | 150 |

목표는 연도별로 분기 매출을 열로 펼친 교차표다.

| YR | Q1 | Q2 |
|---|---|---|
| 2023 | 150 | 200 |
| 2024 | 300 | 150 |

## Oracle PIVOT 문법

```sql
SELECT *
FROM   (SELECT 컬럼들 FROM 테이블)
PIVOT  (집계함수(값컬럼) [AS 별칭]
        FOR 피벗컬럼 IN (값1 [AS 별칭1], 값2 [AS 별칭2], ...));
```

::: cards 3
- **집계함수(값컬럼)** 새로 생길 각 열에 들어갈 값. SUM, COUNT, MAX 등. 예: `SUM(AMT)`
- **FOR 피벗컬럼** 값이 열 이름으로 바뀔 컬럼. 예: `FOR QTR`
- **IN (값 목록)** 열로 만들 값을 명시한다. **목록에 없는 값은 결과에서 빠진다**. 예: `IN ('Q1', 'Q2')`
:::

```sql
SELECT *
FROM   (SELECT YR, QTR, AMT FROM SALES)
PIVOT  (SUM(AMT) FOR QTR IN ('Q1' AS Q1, 'Q2' AS Q2))
ORDER  BY YR;
```

| YR | Q1 | Q2 |
|---|---|---|
| 2023 | 150 | 200 |
| 2024 | 300 | 150 |

- IN 절의 값은 **상수로 직접 나열**해야 한다. 서브쿼리로 동적 목록을 줄 수 없다(XML 형식 제외).
- 별칭을 생략하면 열 이름이 값 그대로(`'Q1'`처럼 따옴표 포함) 만들어지므로 별칭을 주는 편이 편리하다.
- 해당 조합의 데이터가 없으면 NULL이 들어간다.

## 암시적 GROUP BY 주의

PIVOT은 집계함수와 FOR 절에 쓰이지 않은 **나머지 컬럼을 모두 기준으로 자동 GROUP BY**를 수행한다. 인라인 뷰 없이 테이블을 그대로 쓰면 원하지 않는 컬럼까지 그룹 기준이 된다.

::: flow
- **FROM 결과 컬럼** REGION, YR, QTR, AMT
- **집계 대상 제외** AMT
- **FOR 컬럼 제외** QTR
- **남은 컬럼 = 행 기준** REGION, YR
:::

```sql
SELECT *
FROM   SALES
PIVOT  (SUM(AMT) FOR QTR IN ('Q1' AS Q1, 'Q2' AS Q2))
ORDER  BY REGION, YR;
```

| REGION | YR | Q1 | Q2 |
|---|---|---|---|
| 부산 | 2023 | 50 | NULL |
| 부산 | 2024 | NULL | 150 |
| 서울 | 2023 | 100 | 200 |
| 서울 | 2024 | 300 | NULL |

::: warning 행이 4개로 늘어난 이유
REGION이 그룹 기준에 포함되어 연도별 2행이 아니라 **지역·연도별 4행**이 된다. 인라인 뷰에서 필요한 컬럼(YR, QTR, AMT)만 선택해야 의도한 결과를 얻는다.
:::

> 시험 포인트: PIVOT 결과의 행 기준은 "FROM 절 결과 컬럼 중 집계 대상과 FOR 컬럼을 뺀 나머지 컬럼"이다. 결과 행 수를 묻는 문제는 이 나머지 컬럼의 고유 조합 수를 세면 된다.

### 여러 집계함수 사용

```sql
SELECT *
FROM   (SELECT YR, QTR, AMT FROM SALES)
PIVOT  (SUM(AMT) AS S, COUNT(*) AS C
        FOR QTR IN ('Q1' AS Q1, 'Q2' AS Q2));
```

| YR | Q1_S | Q1_C | Q2_S | Q2_C |
|---|---|---|---|---|
| 2023 | 150 | 2 | 200 | 1 |
| 2024 | 300 | 1 | 150 | 1 |

집계함수가 여러 개면 열 이름은 `IN 별칭_집계 별칭` 형태로 만들어진다.

## CASE와 집계함수로 같은 결과 만들기

PIVOT 절을 지원하지 않는 환경이나 구버전에서는 CASE 표현식과 GROUP BY로 같은 결과를 만든다.

```sql
SELECT YR,
       SUM(CASE WHEN QTR = 'Q1' THEN AMT END) AS Q1,
       SUM(CASE WHEN QTR = 'Q2' THEN AMT END) AS Q2
FROM   SALES
GROUP  BY YR
ORDER  BY YR;
```

| YR | Q1 | Q2 |
|---|---|---|
| 2023 | 150 | 200 |
| 2024 | 300 | 150 |

::: info CASE 방식의 특징
- GROUP BY 기준을 직접 지정하므로 **암시적 그룹 문제가 없다**.
- `ELSE 0`을 넣으면 데이터가 없는 칸이 NULL 대신 0이 된다.
- Oracle에서는 `SUM(DECODE(QTR, 'Q1', AMT))`처럼 DECODE로도 쓸 수 있다. CASE와 DECODE는 [함수](/theory/functions)를 참고한다.
:::

## SQL Server PIVOT

```sql
SELECT YR, [Q1], [Q2]
FROM   (SELECT YR, QTR, AMT FROM SALES) AS S
PIVOT  (SUM(AMT) FOR QTR IN ([Q1], [Q2])) AS P;
```

- IN 목록의 값은 **대괄호로 감싼 식별자**로 쓴다.
- 원본 집합과 PIVOT 결과에 **모두 별칭이 필요**하다.
- 암시적 GROUP BY 동작은 Oracle과 같다.

## UNPIVOT 문법

UNPIVOT은 여러 열을 **"열 이름 컬럼 + 값 컬럼"** 두 컬럼의 여러 행으로 바꾼다.

```sql
SELECT *
FROM   테이블
UNPIVOT [INCLUDE NULLS | EXCLUDE NULLS]
        (값컬럼명 FOR 이름컬럼명 IN (열1 [AS 값1], 열2 [AS 값2], ...));
```

예제 테이블 SALES_Y

| YR | Q1 | Q2 |
|---|---|---|
| 2023 | 150 | 200 |
| 2024 | 300 | NULL |

```sql
SELECT YR, QTR, AMT
FROM   SALES_Y
UNPIVOT (AMT FOR QTR IN (Q1 AS 'Q1', Q2 AS 'Q2'))
ORDER  BY YR, QTR;
```

| YR | QTR | AMT |
|---|---|---|
| 2023 | Q1 | 150 |
| 2023 | Q2 | 200 |
| 2024 | Q1 | 300 |

- AMT는 새로 만들어지는 **값 컬럼**, QTR은 원래 열 이름이 들어갈 **이름 컬럼**이다.
- 기본값은 **EXCLUDE NULLS**이므로 2024년 Q2(NULL)는 결과에서 빠진다.

### INCLUDE NULLS

```sql
SELECT YR, QTR, AMT
FROM   SALES_Y
UNPIVOT INCLUDE NULLS (AMT FOR QTR IN (Q1 AS 'Q1', Q2 AS 'Q2'))
ORDER  BY YR, QTR;
```

| YR | QTR | AMT |
|---|---|---|
| 2023 | Q1 | 150 |
| 2023 | Q2 | 200 |
| 2024 | Q1 | 300 |
| 2024 | Q2 | NULL |

> 시험 포인트: UNPIVOT의 기본 동작은 EXCLUDE NULLS다. NULL 값을 가진 열도 행으로 남기려면 INCLUDE NULLS를 명시한다.

### UNPIVOT 대체 방법

```sql
SELECT YR, 'Q1' AS QTR, Q1 AS AMT FROM SALES_Y WHERE Q1 IS NOT NULL
UNION ALL
SELECT YR, 'Q2', Q2 FROM SALES_Y WHERE Q2 IS NOT NULL;
```

열 개수만큼 UNION ALL을 반복하거나, 열 개수만큼 행을 가진 복제용 집합과 카티션 곱 후 CASE로 값을 고르는 방식도 쓸 수 있다.

## PIVOT과 UNPIVOT 비교

::: compare
- **PIVOT · 행 → 열** 집계함수 **필수**. FOR 다음에는 열로 펼칠 **기존 컬럼**. 결과 행 수는 대개 줄어들고, 데이터 없는 칸은 NULL.
- **UNPIVOT · 열 → 행** 집계함수를 쓰지 않음. FOR 다음에는 새로 만들 **이름 컬럼**. 결과 행 수는 대개 늘어나고, 기본 EXCLUDE NULLS.
:::

| 구분 | PIVOT | UNPIVOT |
|---|---|---|
| 방향 | 행 → 열 | 열 → 행 |
| 집계함수 | 필수 | 사용하지 않음 |
| FOR 다음 | 열로 펼칠 기존 컬럼 | 새로 만들 이름 컬럼 |
| 결과 행 수 | 대개 줄어듦 | 대개 늘어남 |
| NULL 처리 | 데이터 없는 칸이 NULL | 기본 EXCLUDE NULLS |

PIVOT은 집계 과정에서 원래 상세 행 정보가 사라지므로, PIVOT 결과를 UNPIVOT 해도 **원본 데이터가 그대로 복원되지는 않는다**.

> 시험 포인트: PIVOT 결과를 UNPIVOT 하면 원본이 아니라 집계된 값이 행으로 돌아온다. 예제에서 2023년 Q1은 원래 2행(100, 50)이었지만 150 한 행이 된다.

## 핵심 요약

- PIVOT은 행을 열로, UNPIVOT은 열을 행으로 바꾼다.
- PIVOT은 `집계함수 FOR 컬럼 IN (값 목록)` 형태이며 IN 목록은 상수로 나열한다.
- PIVOT은 나머지 컬럼 전체로 암시적 GROUP BY 하므로 인라인 뷰로 컬럼을 제한한다.
- CASE(또는 DECODE)와 집계함수, GROUP BY로 PIVOT과 같은 결과를 만들 수 있다.
- UNPIVOT은 `값컬럼 FOR 이름컬럼 IN (열 목록)` 형태이며 기본은 EXCLUDE NULLS다.
- SQL Server PIVOT은 대괄호 식별자와 별칭이 필요하다.
- PIVOT 후 UNPIVOT은 원본을 완전히 복원하지 못한다.
