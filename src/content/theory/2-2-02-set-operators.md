---
title: 집합 연산자
subject: 2과목 · SQL 기본과 활용
chapter: 2-2. SQL 활용
summary: 여러 SELECT 결과를 위아래로 합치고 빼는 연산
---

# 집합 연산자

집합 연산자는 두 개 이상의 SELECT 결과를 하나의 결과 집합으로 결합한다. 조인이 컬럼을 **옆으로** 붙인다면, 집합 연산자는 행을 **위아래로** 결합한다.

## 집합 연산자 종류

<figure class="md-figure">
<svg viewBox="0 0 640 200" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="UNION, UNION ALL, INTERSECT, MINUS 벤 다이어그램">
<rect x="6" y="10" width="148" height="180" rx="10" fill="var(--muted)" fill-opacity="0.5"/>
<rect x="166" y="10" width="148" height="180" rx="10" fill="var(--muted)" fill-opacity="0.5"/>
<rect x="326" y="10" width="148" height="180" rx="10" fill="var(--muted)" fill-opacity="0.5"/>
<rect x="486" y="10" width="148" height="180" rx="10" fill="var(--muted)" fill-opacity="0.5"/>
<g opacity="0.4"><circle cx="58" cy="85" r="42" fill="oklch(0.62 0.17 255)"/><circle cx="102" cy="85" r="42" fill="oklch(0.62 0.17 255)"/></g>
<circle cx="218" cy="85" r="42" fill="oklch(0.65 0.14 160)" fill-opacity="0.35"/><circle cx="262" cy="85" r="42" fill="oklch(0.65 0.14 160)" fill-opacity="0.35"/>
<path d="M400 49.22 A42 42 0 0 1 400 120.78 A42 42 0 0 1 400 49.22 Z" fill="oklch(0.75 0.16 75)" fill-opacity="0.55"/>
<path d="M560 49.22 A42 42 0 1 0 560 120.78 A42 42 0 0 1 560 49.22 Z" fill="oklch(0.63 0.21 25)" fill-opacity="0.45"/>
<g fill="none" stroke="var(--muted-foreground)" stroke-width="1.5"><circle cx="58" cy="85" r="42"/><circle cx="102" cy="85" r="42"/><circle cx="218" cy="85" r="42"/><circle cx="262" cy="85" r="42"/><circle cx="378" cy="85" r="42"/><circle cx="422" cy="85" r="42"/><circle cx="538" cy="85" r="42"/><circle cx="582" cy="85" r="42"/></g>
<g font-size="13" font-weight="700" fill="var(--foreground)" text-anchor="middle"><text x="38" y="90">A</text><text x="122" y="90">B</text><text x="198" y="90">A</text><text x="282" y="90">B</text><text x="358" y="90">A</text><text x="442" y="90">B</text><text x="518" y="90">A</text><text x="602" y="90">B</text></g>
<text x="240" y="90" font-size="11" text-anchor="middle" fill="var(--foreground)">×2</text>
<g font-size="14" font-weight="700" fill="var(--foreground)" text-anchor="middle"><text x="80" y="156">UNION</text><text x="240" y="156">UNION ALL</text><text x="400" y="156">INTERSECT</text><text x="560" y="156">MINUS</text></g>
<g font-size="11" fill="var(--muted-foreground)" text-anchor="middle"><text x="80" y="176">합집합 · 중복 제거</text><text x="240" y="176">합집합 · 중복 유지</text><text x="400" y="176">교집합 · 중복 제거</text><text x="560" y="176">차집합 A − B</text></g>
</svg>
<figcaption>UNION ALL은 겹치는 부분이 두 번 나온다. MINUS는 A에서 B와 겹치는 부분을 뺀다</figcaption>
</figure>

| 연산자 | 의미 | 중복 제거 |
|---|---|---|
| UNION | 합집합 | 제거 |
| UNION ALL | 합집합 | 제거하지 않음 |
| INTERSECT | 교집합 | 제거 |
| MINUS (Oracle) / EXCEPT (SQL Server, 표준) | 차집합 (앞 결과에서 뒤 결과를 뺀다) | 제거 |

::: info 성능 관점
중복을 제거하는 연산자는 내부적으로 **정렬이나 해시 작업**이 필요해 UNION ALL보다 부담이 크다. 중복이 없다는 것이 보장되거나 중복을 그대로 보고 싶다면 **UNION ALL**을 쓰는 것이 효율적이다.
:::

## 사용 조건

::: cards 2
- **컬럼 수 일치** 각 SELECT 절의 컬럼 수가 같아야 한다.
- **타입 호환** 같은 위치의 컬럼끼리 데이터 타입이 호환되어야 한다.
- **컬럼명은 첫 SELECT** 결과 컬럼명(헤더)은 첫 번째 SELECT 절의 컬럼명 또는 별칭을 따른다.
- **ORDER BY는 맨 끝 한 번** 개별 SELECT에 붙이면 오류다. 첫 번째 SELECT의 컬럼명·별칭 또는 위치 번호를 사용한다.
:::

```sql
SELECT ENAME AS 이름, SAL FROM EMP WHERE DEPTNO = 10
UNION ALL
SELECT ENAME, SAL FROM EMP WHERE DEPTNO = 20
ORDER BY 이름;          -- 또는 ORDER BY 1
```

> 시험 포인트: 두 번째 SELECT에 붙인 별칭은 결과 헤더에 반영되지 않는다. 마지막 ORDER BY에서 두 번째 SELECT의 별칭만 사용하면 오류가 날 수 있다.

## 예제 데이터

두 매장의 판매 상품 목록이다. **배, 포도**가 양쪽에 겹친다.

STORE_A

| ITEM |
|---|
| 사과 |
| 배 |
| 포도 |

STORE_B

| ITEM |
|---|
| 배 |
| 포도 |
| 귤 |

## UNION과 UNION ALL

::: compare
- **UNION ALL** 두 결과를 그대로 이어 붙인다. 겹치는 배, 포도도 두 번씩 나와 **6행**.
- **UNION** 중복을 하나씩만 남긴다. 배, 포도가 한 번씩만 나와 **4행**.
:::

```sql
SELECT ITEM FROM STORE_A
UNION ALL
SELECT ITEM FROM STORE_B;
```

| ITEM |
|---|
| 사과 |
| 배 |
| 포도 |
| 배 |
| 포도 |
| 귤 |

UNION ALL은 두 결과를 그대로 이어 붙이므로 6행이 된다.

```sql
SELECT ITEM FROM STORE_A
UNION
SELECT ITEM FROM STORE_B
ORDER BY ITEM;
```

| ITEM |
|---|
| 귤 |
| 배 |
| 사과 |
| 포도 |

UNION은 중복된 배, 포도를 하나씩만 남겨 4행이 된다.

::: warning 정렬은 보장되지 않는다
중복 제거 과정에서 정렬된 것처럼 보일 수 있지만 **순서가 보장되지는 않는다**. 원하는 순서가 있으면 ORDER BY를 명시한다.
:::

> 시험 포인트: 한 테이블 안에 중복 행이 있어도 UNION은 그것까지 제거한다. 즉 UNION 결과는 항상 중복 없는 집합이다.

## INTERSECT

```sql
SELECT ITEM FROM STORE_A
INTERSECT
SELECT ITEM FROM STORE_B;
```

| ITEM |
|---|
| 배 |
| 포도 |

양쪽에 모두 있는 행만 남긴다. 같은 결과를 EXISTS나 IN으로도 만들 수 있다.

```sql
SELECT DISTINCT A.ITEM
FROM   STORE_A A
WHERE  EXISTS (SELECT 1 FROM STORE_B B WHERE B.ITEM = A.ITEM);
```

## MINUS / EXCEPT

```sql
-- Oracle
SELECT ITEM FROM STORE_A
MINUS
SELECT ITEM FROM STORE_B;

-- SQL Server
SELECT ITEM FROM STORE_A
EXCEPT
SELECT ITEM FROM STORE_B;
```

| ITEM |
|---|
| 사과 |

순서를 바꾸면 결과도 바뀐다. `STORE_B MINUS STORE_A`의 결과는 **귤**이다.

같은 결과를 NOT EXISTS로 표현할 수 있다.

```sql
SELECT DISTINCT A.ITEM
FROM   STORE_A A
WHERE  NOT EXISTS (SELECT 1 FROM STORE_B B WHERE B.ITEM = A.ITEM);
```

## 연산 결과 비교 정리

| 연산 | 결과 | 행 수 |
|---|---|---|
| A UNION ALL B | 사과, 배, 포도, 배, 포도, 귤 | 6 |
| A UNION B | 귤, 배, 사과, 포도 | 4 |
| A INTERSECT B | 배, 포도 | 2 |
| A MINUS B | 사과 | 1 |
| B MINUS A | 귤 | 1 |

UNION, INTERSECT, MINUS는 교환법칙 관점에서 다르다. UNION과 INTERSECT는 순서를 바꿔도 결과 집합이 같지만 **MINUS는 달라진다**.

## 집합 연산자와 NULL

::: info NULL끼리는 같은 값
집합 연산자는 중복을 판단할 때 **NULL끼리 같은 값으로 취급**한다. WHERE 절의 `=` 비교에서 NULL끼리 같지 않은 것과 다르다.

| 쿼리 | 결과 |
|---|---|
| `SELECT NULL FROM DUAL UNION SELECT NULL FROM DUAL` | NULL 1행 |
| `SELECT NULL FROM DUAL UNION ALL SELECT NULL FROM DUAL` | NULL 2행 |
| `SELECT NULL FROM DUAL INTERSECT SELECT NULL FROM DUAL` | NULL 1행 |
:::

NULL의 일반적인 비교 규칙은 [NULL과 속성](/theory/null-attribute)을 참고한다.

## 여러 집합 연산자를 함께 쓸 때

```sql
SELECT ITEM FROM STORE_A
UNION
SELECT ITEM FROM STORE_B
MINUS
SELECT ITEM FROM STORE_C;
```

Oracle에서는 위에서 아래로 차례대로 수행된다.

::: flow
- **STORE_A** 첫 번째 결과
- **UNION STORE_B** 합집합을 먼저 만든다
- **MINUS STORE_C** 그 결과에서 C를 뺀다
:::

- Oracle은 집합 연산자의 **우선순위가 모두 같아** 위에서 아래로 차례대로 수행한다.
- SQL 표준과 SQL Server는 **INTERSECT가 UNION, EXCEPT보다 우선순위가 높다**.
- 의도를 분명히 하려면 괄호로 묶어 수행 순서를 명시한다.

> 시험 포인트: 집합 연산 결과에 GROUP BY나 WHERE를 적용하고 싶으면 전체를 인라인 뷰로 감싼다. 개별 SELECT 안의 WHERE·GROUP BY는 각 SELECT에만 적용된다.

## 핵심 요약

- UNION과 INTERSECT, MINUS(EXCEPT)는 중복을 제거하고 UNION ALL은 제거하지 않는다.
- 각 SELECT의 컬럼 수가 같고 대응하는 컬럼의 타입이 호환되어야 한다.
- 결과 컬럼명은 첫 번째 SELECT 기준이다.
- ORDER BY는 맨 마지막에 한 번만 쓰며, 정렬 순서는 ORDER BY로만 보장된다.
- MINUS는 순서에 따라 결과가 달라지고 SQL Server·표준에서는 EXCEPT라고 쓴다.
- 집합 연산자는 NULL끼리 같은 값으로 보고 중복을 제거한다.
- 성능상 중복 제거가 필요 없으면 UNION ALL을 사용한다.
