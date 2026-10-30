---
title: 쿼리 변환
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-5. SQL 옵티마이저
summary: 서브쿼리 Unnesting, 뷰 Merging, 조건절 Pushing, OR-Expansion 등 옵티마이저의 SQL 재작성
---

# 쿼리 변환

쿼리 변환(Query Transformation)은 옵티마이저가 SQL을 분석해 **의미적으로 동일하면서 더 나은 성능이 기대되는 형태로 재작성**하는 것이다. [옵티마이저](/theory/optimizer)의 첫 단계인 Query Transformer가 담당한다. 개발자가 작성한 SQL 모양 그대로 실행되지 않는다는 점을 알아야 실행계획을 바르게 해석할 수 있다.

## 휴리스틱 vs 비용기반 쿼리 변환

::: compare
- **휴리스틱 (규칙기반) 변환** 결과만 같으면 **항상 더 낫다고 판단되는** 변환을 규칙에 따라 무조건 수행한다. 예: 단순 뷰 Merging, 조건절 이행, 불필요한 조인 제거, 공통 표현식 제거
- **비용기반 변환** 변환 전후의 **비용을 비교**해 더 낮을 때만 변환한다. 예: 복합 뷰 Merging, 서브쿼리 Unnesting, 조인 조건 Pushdown, OR-Expansion
:::

| 변환 | 대표 힌트 (적용 / 억제) |
|---|---|
| 서브쿼리 Unnesting | UNNEST / NO_UNNEST |
| 뷰 Merging | MERGE / NO_MERGE |
| 조인 조건 Pushdown | PUSH_PRED / NO_PUSH_PRED |
| OR-Expansion | USE_CONCAT / NO_EXPAND |
| 모든 쿼리 변환 | NO_QUERY_TRANSFORMATION (억제) |

## 서브쿼리 Unnesting

WHERE 절의 중첩 서브쿼리(Nested Subquery)를 **풀어서 메인 쿼리와 같은 레벨의 조인으로 바꾸는** 변환이다. 서브쿼리 조인의 상세 동작은 [서브쿼리 조인](/theory/subquery-join)에서 다룬다.

```sql
SELECT * FROM emp
WHERE  deptno IN (SELECT deptno FROM dept WHERE loc = 'SEOUL');
```

::: compare
- **Unnesting 안 함 (필터 방식)** 메인 쿼리 행마다 서브쿼리를 반복 실행한다. 실행계획에 **FILTER**가 나타나며, 입력값별 결과를 캐싱해 같은 값은 재사용한다. 항상 메인 쿼리가 먼저 드라이빙된다.
- **Unnesting (조인 방식)** 서브쿼리를 일반 조인처럼 바꾼다. 조인 순서와 방식(NL·해시·소트 머지)을 자유롭게 고를 수 있어 **더 다양한 실행계획**을 검토할 수 있다.
:::

```sql
-- Unnesting 후 (개념적으로)
SELECT e.* FROM (SELECT DISTINCT deptno FROM dept WHERE loc = 'SEOUL') d, emp e
WHERE  e.deptno = d.deptno;
```

서브쿼리를 단순 조인으로 바꾸면 메인 쿼리 결과가 늘어날 수 있다. 그래서 옵티마이저는 다음 중 하나를 택한다.

- 서브쿼리 쪽 조인 컬럼이 **PK·Unique**로 1쪽이 보장되면 일반 조인으로 바꾼다.
- 아니면 서브쿼리 결과를 **Sort Unique / Hash Unique**로 중복 제거한 뒤 먼저 드라이빙하거나,
- 메인 쿼리를 먼저 드라이빙하는 **세미 조인**(NL_SJ, HASH_SJ, MERGE_SJ)으로 처리한다. NOT EXISTS / NOT IN은 **안티 조인**(NL_AJ, HASH_AJ)이 된다.

```sql
SELECT * FROM emp e
WHERE  EXISTS (SELECT /*+ UNNEST HASH_SJ */ 1 FROM dept d
               WHERE  d.deptno = e.deptno AND d.loc = 'SEOUL');
```

> 시험 포인트: 실행계획에 FILTER가 보이면 Unnesting되지 않은 것이다. `NO_UNNEST`는 필터 방식으로 실행하게 하고, `UNNEST`와 함께 `NL_SJ`·`HASH_SJ`·`HASH_AJ` 등으로 세미·안티 조인 방식을 지정한다. 이 힌트들은 **서브쿼리 안에** 쓴다.

## 뷰 Merging

인라인 뷰나 일반 뷰의 쿼리 블록을 **메인 쿼리와 합쳐 하나의 쿼리 블록**으로 만드는 변환이다. 뷰를 독립적으로 최적화하면 메인 쿼리 조건을 활용하지 못해 비효율이 생기기 때문이다.

```sql
-- 변환 전
SELECT *
FROM  (SELECT * FROM emp WHERE job = 'SALESMAN') e,
      (SELECT * FROM dept WHERE loc = 'CHICAGO') d
WHERE  e.deptno = d.deptno;

-- 뷰 Merging 후
SELECT *
FROM   emp e, dept d
WHERE  e.deptno = d.deptno
AND    e.job = 'SALESMAN'
AND    d.loc = 'CHICAGO';
```

::: cards 2
- **단순 뷰 (Simple View) Merging** 조건절과 조인만 있는 뷰. 휴리스틱으로 항상 Merging한다.
- **복합 뷰 (Complex View) Merging** GROUP BY, DISTINCT를 포함한 뷰. 비용기반으로 판단한다(Merging하면 조인 후 집계, 안 하면 집계 후 조인).
:::

::: warning 뷰 Merging이 불가능한 경우
- 집합 연산자 (UNION, UNION ALL, INTERSECT, MINUS)
- CONNECT BY 절
- ROWNUM 의사 컬럼
- GROUP BY 없이 SELECT 절에 집계 함수(AVG, COUNT, MAX, MIN, SUM) 사용
- 분석 함수 (윈도우 함수)

이런 뷰는 조건절 Pushing 같은 다른 변환을 시도한다.
:::

실행계획에 **VIEW** 오퍼레이션이 보이면 Merging되지 않은 것이다. `NO_MERGE`로 뷰를 독립적으로 처리하게 하고, `MERGE`로 Merging을 유도한다.

## 조건절 Pushing

뷰를 Merging하지 못할 때, 조건절을 **뷰 쿼리 블록 안으로 밀어 넣어** 뷰 안에서 미리 데이터를 걸러내는 변환이다.

::: cards 3
- **조건절 Pushdown** 쿼리 블록 **밖**의 조건을 **안**으로 밀어 넣는다.
- **조건절 Pullup** 쿼리 블록 **안**의 조건을 **밖**으로 끌어내 다른 쿼리 블록에 Pushdown하는 데 쓴다.
- **조인 조건 Pushdown** NL 조인 Inner 쪽 뷰 안으로 **조인 조건**을 밀어 넣는다.
:::

```sql
-- GROUP BY 뷰라 Merging 불가 → deptno = 30 조건을 뷰 안으로 Pushdown
SELECT deptno, avg_sal
FROM  (SELECT deptno, AVG(sal) avg_sal FROM emp GROUP BY deptno) a
WHERE  deptno = 30;
```

조인 조건 Pushdown은 드라이빙 집합의 값을 하나씩 받아 뷰 안의 인덱스로 필요한 데이터만 집계한다. 뷰 전체를 집계한 뒤 조인하는 비효율을 없앤다.

```sql
SELECT /*+ LEADING(d) USE_NL(e) PUSH_PRED(e) */ d.dname, e.avg_sal
FROM   dept d,
      (SELECT deptno, AVG(sal) avg_sal FROM emp GROUP BY deptno) e
WHERE  e.deptno(+) = d.deptno
AND    d.loc = 'CHICAGO';
```

실행계획에 **VIEW PUSHED PREDICATE**가 나타나면 조인 조건 Pushdown이 적용된 것이다.

## 조건절 이행

`A = B`이고 `B = C`이면 `A = C`라는 추론으로 **새 조건절을 만들어 내는** 변환이다(Transitive Predicate Generation).

```sql
SELECT * FROM dept d, emp e
WHERE  e.deptno = d.deptno
AND    e.deptno = 10;
-- 옵티마이저가 d.deptno = 10 조건을 추가한다
```

dept 쪽에도 필터 조건이 생기므로 dept의 인덱스를 이용하거나 조인 순서·방식 선택 폭이 넓어진다. 개발자가 양쪽에 같은 상수 조건을 일일이 쓰지 않아도 된다.

## OR-Expansion

OR 조건을 **UNION ALL 형태로 분기**해 각 조건이 서로 다른 인덱스를 사용할 수 있게 하는 변환이다.

```sql
SELECT * FROM emp
WHERE  job = 'CLERK' OR deptno = 20;

-- OR-Expansion 후 (개념적으로)
SELECT * FROM emp WHERE job = 'CLERK'
UNION ALL
SELECT * FROM emp WHERE deptno = 20 AND LNNVL(job = 'CLERK');
```

- 두 번째 브랜치의 `LNNVL(job = 'CLERK')`는 조건이 FALSE 또는 UNKNOWN일 때 TRUE를 반환해 **중복 행을 제거**한다.
- 실행계획에 **CONCATENATION** 오퍼레이션이 나타난다. (12.2부터는 VW_ORE 뷰 아래 UNION-ALL 형태로 표시되기도 한다.)
- 힌트: `USE_CONCAT`(적용), `NO_EXPAND`(억제)

::: info OR 조건과 인덱스
OR-Expansion이 일어나지 않으면 OR 조건은 하나의 인덱스로 처리하기 어렵다. 같은 컬럼에 대한 OR(`deptno = 10 OR deptno = 20`)이나 IN 조건은 IN-List Iterator로 처리하는 것이 보통이다. 반면 **NVL·DECODE를 이용한 선택 조건**(`col = NVL(:v, col)`)도 옵티마이저가 OR-Expansion으로 분기할 수 있다.
:::

## 공통 표현식 제거

같은 조건식이 여러 곳에 반복되면 **한 번만 평가**하도록 바꾼다.

```sql
-- 변환 전
WHERE (deptno = 20 AND sal >= 2000) OR (deptno = 20 AND job = 'CLERK')
-- 변환 후
WHERE deptno = 20 AND (sal >= 2000 OR job = 'CLERK')
```

비교 연산 횟수가 줄고, 새로 드러난 `deptno = 20` 조건으로 인덱스를 사용할 수 있게 된다.

## 아우터 조인을 이너 조인으로 변환

Outer 쪽(+가 붙은 쪽) 테이블에 대한 일반 필터 조건이 WHERE 절에 있으면, NULL로 채워진 행은 어차피 걸러지므로 **아우터 조인을 이너 조인으로 바꾼다**. 이너 조인이 되면 조인 순서를 자유롭게 정할 수 있다.

```sql
SELECT * FROM dept d, emp e
WHERE  e.deptno(+) = d.deptno
AND    e.sal > 1000;          -- (+)가 없으므로 이너 조인과 결과가 같다
```

::: warning 의도한 결과와 다를 수 있다
"사원이 없는 부서도 보여 주되 급여 1000 초과 사원만 붙인다"가 의도였다면 `e.sal(+) > 1000`으로 써야 한다. ANSI 문법이라면 조건을 WHERE가 아닌 **ON 절**에 둔다. 이 차이는 [표준 조인](/theory/standard-join)에서도 자주 출제된다.
:::

## 불필요한 조인 제거

1:M 관계의 두 테이블을 조인했는데 **1쪽 테이블의 컬럼을 전혀 참조하지 않으면**, 그 조인을 생략한다(Join Elimination).

```sql
SELECT e.empno, e.ename, e.sal
FROM   dept d, emp e
WHERE  d.deptno = e.deptno;
-- dept 컬럼을 쓰지 않으므로 emp만 읽는다
```

- **PK·FK 제약**이 설정되어 있어야 한다. PK가 없으면 조인 결과 건수가 달라질 수 있고, FK가 없으면 dept에 없는 deptno를 가진 emp 행이 걸러져야 하기 때문이다.
- FK 컬럼이 NULL을 허용하면 옵티마이저가 `e.deptno IS NOT NULL` 조건을 추가한다.
- 아우터 조인(`d.deptno(+) = e.deptno`)은 1쪽의 PK만 있으면 FK 없이도 제거할 수 있다.

## 집합 연산을 조인으로 변환

INTERSECT나 MINUS는 양쪽을 각각 정렬해 비교한다. 옵티마이저는 이를 **세미 조인·안티 조인으로 변환**하고 DISTINCT로 중복을 없애는 방식으로 처리할 수 있다.

```sql
SELECT job, mgr FROM emp
MINUS
SELECT job, mgr FROM emp WHERE deptno = 10;
-- → HASH JOIN ANTI + HASH UNIQUE 형태로 처리 가능
```

Oracle 10g부터는 이 변환이 기본적으로 비활성화되어 있어 `SET_TO_JOIN` 힌트로 유도한다. 이때 집합 연산은 NULL끼리도 같은 값으로 취급하므로, 변환된 조인 조건에는 `SYS_OP_MAP_NONNULL` 같은 함수가 쓰여 NULL 비교를 보정한다.

## 기타 쿼리 변환

- **조인 컬럼에 IS NOT NULL 조건 추가**: 조인 컬럼이 NULL이면 조인에 실패하므로 미리 걸러 불필요한 테이블 액세스를 줄인다.
- **필터 조건 추가**: `sal BETWEEN :mn AND :mx`에서 `:mn > :mx`이면 결과가 없으므로 아예 실행하지 않도록 필터를 추가한다.
- **조건절 비교 순서 결정**: 여러 필터 조건은 비교 비용과 선택도를 고려해 평가 순서를 정한다.

## 핵심 요약

- 쿼리 변환은 결과가 같은 범위에서 SQL을 재작성하며, 휴리스틱 변환과 비용기반 변환이 있다.
- 서브쿼리 Unnesting은 서브쿼리를 조인으로 바꾸며, 안 되면 FILTER로 반복 실행된다 (UNNEST / NO_UNNEST).
- 뷰 Merging은 뷰를 메인 쿼리와 합친다. 집합 연산, CONNECT BY, ROWNUM, 집계 함수, 분석 함수가 있으면 불가 (MERGE / NO_MERGE).
- 조건절 Pushdown·Pullup·조인 조건 Pushdown은 Merging 못 한 뷰 안으로 조건을 밀어 넣는다 (PUSH_PRED).
- 조건절 이행은 A=B, B=C에서 A=C 조건을 추가한다.
- OR-Expansion은 OR를 UNION ALL로 분기하고 LNNVL로 중복을 제거한다 (USE_CONCAT / NO_EXPAND).
- Outer 쪽 테이블에 (+) 없는 필터가 있으면 이너 조인으로 바뀐다.
- PK·FK 제약이 있으면 참조하지 않는 1쪽 테이블과의 조인을 제거한다.
