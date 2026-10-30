---
title: 서브쿼리 조인
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-4. 조인 튜닝
summary: 필터 오퍼레이션·Unnesting·Pushing·뷰 Merging·스칼라 서브쿼리 캐싱
---

# 서브쿼리 조인

서브쿼리는 SQL 안에 쓰인 또 하나의 쿼리 블록이다. 옵티마이저는 쿼리 블록 단위로 최적화하므로, 서브쿼리를 <strong>어떻게 처리하느냐(필터로 둘지, 조인으로 풀지)</strong>가 성능을 크게 좌우한다. 이 문서는 서브쿼리와 뷰가 조인으로 바뀌는 원리와 이를 제어하는 힌트를 다룬다. 쿼리 변환 전반은 [쿼리 변환](/theory/query-transformation)에서 정리한다.

## 서브쿼리의 종류

::: cards 3
- **인라인 뷰** FROM 절에 쓴 서브쿼리
- **중첩된 서브쿼리** WHERE 절에 쓴 서브쿼리. 메인쿼리 컬럼을 참조하면 상관관계 서브쿼리
- **스칼라 서브쿼리** 한 레코드당 정확히 하나의 값을 반환하는 서브쿼리. 주로 SELECT 절에 쓴다
:::

문법 차원의 서브쿼리는 [서브쿼리](/theory/subquery)에서 다룬다.

## 필터 오퍼레이션과 캐싱

서브쿼리를 조인으로 풀지 않으면(Unnesting 하지 않으면) 메인쿼리 한 건마다 서브쿼리를 실행하는 **필터(FILTER) 오퍼레이션**으로 처리된다.

```sql
SELECT C.고객번호, C.고객명
FROM   고객 C
WHERE  C.가입일시 >= TRUNC(ADD_MONTHS(SYSDATE, -1), 'MM')
AND    EXISTS (SELECT /*+ NO_UNNEST */ 'X'
               FROM   거래 T
               WHERE  T.고객번호 = C.고객번호
               AND    T.거래일시 >= TRUNC(SYSDATE, 'MM'));
```

```
---------------------------------------------------------
| Id | Operation                     | Name             |
---------------------------------------------------------
|  0 | SELECT STATEMENT              |                  |
|  1 |  FILTER                       |                  |
|  2 |   TABLE ACCESS BY INDEX ROWID | 고객              |
|  3 |    INDEX RANGE SCAN           | 고객_X01          |
|  4 |   INDEX RANGE SCAN            | 거래_X01          |
---------------------------------------------------------
```

필터 오퍼레이션은 NL 조인과 처리 루틴이 거의 같지만 세 가지가 다르다.

::: cards 3
- **첫 건에서 멈춤** 메인쿼리 한 건에 대해 서브쿼리에서 조건을 만족하는 첫 건을 찾으면 더 탐색하지 않고 다음 행으로 넘어간다.
- **캐싱** 서브쿼리 입력 값(고객번호)과 결과(TRUE/FALSE)를 PGA 캐시에 저장한다. 같은 입력 값이 다시 오면 서브쿼리를 실행하지 않고 캐시 결과를 쓴다.
- **순서 고정** 항상 메인쿼리가 드라이빙 집합이다. 서브쿼리를 먼저 읽는 실행계획은 만들 수 없다.
:::

> 시험 포인트: 필터 오퍼레이션은 "조인 순서 고정 + 첫 건에서 멈춤 + 캐싱"이 NL 조인과의 차이점이다. 캐싱은 서브쿼리 입력 값의 종류가 적을수록 효과가 크다.

## 서브쿼리 Unnesting

Unnesting은 **중첩된 서브쿼리를 풀어 메인쿼리와 같은 레벨의 조인으로 바꾸는** 쿼리 변환이다. 풀고 나면 옵티마이저가 조인 순서와 방식(NL·해시·소트 머지)을 자유롭게 고를 수 있다.

| 힌트 | 의미 |
|---|---|
| `UNNEST` | 서브쿼리를 Unnesting 하여 조인 방식으로 최적화 유도 |
| `NO_UNNEST` | 서브쿼리를 그대로 둔 채 필터 방식으로 최적화 유도 |

::: compare
- **NO_UNNEST (필터)** 메인쿼리 결과가 적거나, 서브쿼리 입력 값 종류가 적어 캐싱 효과가 클 때 유리하다. 단, 메인쿼리가 크면 서브쿼리를 그만큼 반복한다.
- **UNNEST (조인)** 서브쿼리를 먼저 읽는 것이 유리하거나, 대량 데이터라 해시 조인이 필요할 때 유리하다.
:::

### IN 서브쿼리의 Unnesting

메인쿼리와 서브쿼리는 1:M 관계일 수 있으므로, 그냥 조인하면 결과 건수가 달라진다. 옵티마이저는 다음 두 방법 중 하나를 쓴다.

```sql
SELECT *
FROM   DEPT D
WHERE  D.DEPTNO IN (SELECT E.DEPTNO FROM EMP E WHERE E.SAL >= 3000);
```

```
-- (1) 서브쿼리 집합을 먼저 읽고 중복 제거 후 메인 조인
NESTED LOOPS
  VIEW                         VW_NSO_1
    HASH UNIQUE   (또는 SORT UNIQUE)
      TABLE ACCESS FULL        EMP
  TABLE ACCESS BY INDEX ROWID  DEPT
    INDEX UNIQUE SCAN          PK_DEPT

-- (2) 메인쿼리를 먼저 읽으며 세미 조인
HASH JOIN SEMI
  TABLE ACCESS FULL  DEPT
  TABLE ACCESS FULL  EMP
```

::: info PK·Unique 제약이 중요한 이유
서브쿼리 쪽 조인 컬럼에 PK나 Unique 제약이 있으면 1쪽 집합임이 보장되므로 옵티마이저가 중복 제거 없이 일반 조인으로 바꿀 수 있다. 제약이 없으면 위처럼 SORT/HASH UNIQUE를 거치거나 세미 조인을 사용한다.
:::

## 세미 조인과 안티 조인

Unnesting 된 EXISTS·IN 서브쿼리는 <strong>세미 조인(Semi Join)</strong>으로, NOT EXISTS·NOT IN 서브쿼리는 <strong>안티 조인(Anti Join)</strong>으로 처리된다. 세미 조인은 메인 한 건당 서브쿼리에서 첫 매칭을 찾으면 멈추고, 안티 조인은 매칭이 하나도 없을 때만 결과로 내보낸다.

| 유형 | 실행계획 | 서브쿼리 안 힌트 |
|---|---|---|
| 세미 조인 | NESTED LOOPS SEMI / HASH JOIN SEMI / MERGE JOIN SEMI | `NL_SJ` / `HASH_SJ` / `MERGE_SJ` |
| 안티 조인 | NESTED LOOPS ANTI / HASH JOIN ANTI / MERGE JOIN ANTI | `NL_AJ` / `HASH_AJ` / `MERGE_AJ` |

```sql
-- 사원이 없는 부서: 안티 조인
SELECT D.DEPTNO, D.DNAME
FROM   DEPT D
WHERE  NOT EXISTS (SELECT /*+ UNNEST HASH_AJ */ 'X'
                   FROM   EMP E
                   WHERE  E.DEPTNO = D.DEPTNO);
```

```
HASH JOIN ANTI
  TABLE ACCESS FULL  DEPT
  TABLE ACCESS FULL  EMP
```

::: warning 세미·안티 조인의 순서
세미·안티 조인은 기본적으로 <strong>메인쿼리 쪽이 먼저(Outer)</strong>다. 해시 세미·안티 조인에서는 서브쿼리 쪽을 Build Input으로 바꾼 **HASH JOIN RIGHT SEMI / RIGHT ANTI**가 나타날 수 있다(10g 이상, `SWAP_JOIN_INPUTS` 활용). 또 NOT IN은 NULL을 고려해야 하므로 조인 컬럼이 NULL 허용이면 **HASH JOIN ANTI NA**(Null-Aware, 11g 이상)가 나타난다.
:::

## 서브쿼리 Pushing

Unnesting 되지 않은 서브쿼리는 기본적으로 **실행계획 맨 마지막 단계에서 필터링**된다. 조인을 다 끝낸 뒤에야 걸러지므로, 서브쿼리 필터링 효과가 크다면 불필요한 조인을 많이 하게 된다.

**서브쿼리 Pushing**은 서브쿼리 필터링을 **가능한 한 앞 단계로 끌어올려** 먼저 처리하게 하는 기능이다.

```sql
SELECT /*+ LEADING(P) USE_NL(T) */
       COUNT(DISTINCT P.상품번호), SUM(T.주문금액)
FROM   상품 P, 주문 T
WHERE  P.상품번호 = T.상품번호
AND    T.주문일시 >= TRUNC(SYSDATE - 7)
AND    EXISTS (SELECT /*+ NO_UNNEST PUSH_SUBQ */ 'X'
               FROM   상품분류 C
               WHERE  C.상품분류코드 = P.상품분류코드
               AND    C.상위분류코드 = 'AK');
```

::: compare
- **NO_PUSH_SUBQ (기본)** 상품 → 주문 조인을 모두 끝낸 뒤 서브쿼리로 필터링. 걸러질 상품까지 주문과 조인한다.
- **PUSH_SUBQ** 상품을 읽자마자 서브쿼리로 필터링한 뒤 주문과 조인. 조인 횟수가 줄어든다.
:::

::: warning PUSH_SUBQ 사용 조건
Pushing은 **Unnesting 되지 않은 서브쿼리**에만 작동한다. Unnesting 되면 조인으로 바뀌어 필터 순서라는 개념이 없어지기 때문이다. 그래서 PUSH_SUBQ는 항상 **NO_UNNEST와 함께** 서브쿼리 안에 쓴다.
:::

## 뷰 Merging

인라인 뷰나 뷰도 하나의 쿼리 블록이다. **뷰 Merging**은 뷰를 풀어 메인쿼리와 하나의 쿼리 블록으로 합치는 변환으로, 합치고 나면 옵티마이저가 더 다양한 액세스 경로와 조인 순서를 고려할 수 있다.

```sql
-- 변환 전
SELECT *
FROM  (SELECT * FROM EMP WHERE JOB = 'SALESMAN') A,
      (SELECT * FROM DEPT WHERE LOC = 'CHICAGO') B
WHERE  A.DEPTNO = B.DEPTNO;

-- Merging 후
SELECT *
FROM   EMP A, DEPT B
WHERE  A.DEPTNO = B.DEPTNO
AND    A.JOB = 'SALESMAN'
AND    B.LOC = 'CHICAGO';
```

| 힌트 | 쓰는 위치 | 의미 |
|---|---|---|
| `MERGE` | 뷰 안, 또는 메인에서 `MERGE(뷰별칭)` | 뷰 Merging 유도 |
| `NO_MERGE` | 뷰 안, 또는 메인에서 `NO_MERGE(뷰별칭)` | 뷰를 독립적으로 최적화(실행계획에 VIEW 표시) |

::: cards 2
- **단순 뷰(Simple View)** 조건절과 조인만 있는 뷰. 특별한 제약이 없으면 항상 Merging 한다.
- **복합 뷰(Complex View)** GROUP BY, DISTINCT 등을 포함한 뷰. 복합 뷰 Merging 기능으로 가능하지만, 비용 기반으로 판단하며 무조건 유리하지는 않다.
:::

::: warning Merging 할 수 없는 뷰
집합 연산자(UNION, UNION ALL, INTERSECT, MINUS), CONNECT BY 절, ROWNUM 의사 컬럼, GROUP BY 없이 SELECT 절에 쓴 집계 함수, 분석 함수를 포함한 뷰는 Merging 할 수 없다. 이런 뷰는 조건절 Pushing 등 다른 변환에 기대야 한다.
:::

> 시험 포인트: 복합 뷰를 Merging 하면 GROUP BY를 조인 이후로 미루게 되어, 조인 결과가 많을 때 오히려 집계 대상이 늘어 느려질 수 있다. 뷰 안 조건이 매우 선택적이면 NO_MERGE로 뷰를 먼저 처리하는 편이 낫다.

## 조건절 Pushing

뷰를 Merging 하지 못할 때, **메인쿼리의 조건절을 뷰 안으로 밀어 넣어** 뷰 안에서 미리 데이터를 걸러내는 변환이다.

::: cards 3
- **조건절 Pushdown** 메인쿼리의 조건을 뷰 쿼리 블록 안으로 밀어 넣는다.
- **조건절 Pullup** 뷰 안의 조건을 메인쿼리로 끌어올린 뒤, 다른 뷰에 다시 Pushdown 한다.
- **조인 조건 Pushdown** 메인 테이블에서 읽은 값을 뷰 안 조인 조건으로 건네 뷰를 NL 조인 Inner처럼 반복 탐색한다.
:::

```sql
-- GROUP BY 뷰라 Merging 불가 → DEPTNO = 30 조건을 뷰 안으로 Pushdown
SELECT D.DNAME, E.AVG_SAL
FROM   DEPT D,
      (SELECT DEPTNO, AVG(SAL) AVG_SAL FROM EMP GROUP BY DEPTNO) E
WHERE  E.DEPTNO = D.DEPTNO
AND    D.DEPTNO = 30;
```

조건 전이(Transitive Predicate)로 `E.DEPTNO = 30`이 생기고, 그 조건이 뷰 안으로 들어가 30번 부서만 집계한다.

### 조인 조건 Pushdown

```sql
SELECT /*+ LEADING(D) USE_NL(E) */ D.DNAME, E.AVG_SAL
FROM   DEPT D,
      (SELECT /*+ NO_MERGE PUSH_PRED */ DEPTNO, AVG(SAL) AVG_SAL
       FROM   EMP GROUP BY DEPTNO) E
WHERE  E.DEPTNO = D.DEPTNO
AND    D.LOC = 'CHICAGO';
```

```
NESTED LOOPS
  TABLE ACCESS FULL            DEPT
  VIEW PUSHED PREDICATE        
    SORT GROUP BY
      TABLE ACCESS BY INDEX ROWID  EMP
        INDEX RANGE SCAN           EMP_DEPTNO_IDX
```

- DEPT에서 읽은 DEPTNO를 뷰 안으로 건네 **해당 부서만 집계**하므로, EMP 전체를 GROUP BY 할 필요가 없다.
- 실행계획에 **VIEW PUSHED PREDICATE**가 보이면 조인 조건 Pushdown이 작동한 것이다. `PUSH_PRED` / `NO_PUSH_PRED` 힌트로 제어한다(GROUP BY 뷰에 대한 적용은 11g 이상).

## 스칼라 서브쿼리와 캐싱

스칼라 서브쿼리는 메인쿼리 한 건마다 실행되는 함수처럼 동작하며, 결과가 없으면 NULL을 반환한다. 즉 **Outer 조인 + NL 조인**처럼 동작한다.

```sql
SELECT E.EMPNO, E.ENAME, E.SAL,
       (SELECT D.DNAME FROM DEPT D WHERE D.DEPTNO = E.DEPTNO) AS DNAME
FROM   EMP E
WHERE  E.SAL >= 2000;
```

```
TABLE ACCESS BY INDEX ROWID  DEPT        -- 스칼라 서브쿼리가 위에 표시
  INDEX UNIQUE SCAN          PK_DEPT
TABLE ACCESS FULL            EMP          -- 메인쿼리
```

::: info 스칼라 서브쿼리 캐싱
스칼라 서브쿼리는 **입력 값(E.DEPTNO)과 출력 값(DNAME)을 PGA 캐시에 저장**한다. 같은 입력 값이 다시 오면 서브쿼리를 실행하지 않고 캐시 값을 쓴다. 해시 함수로 저장 위치를 찾으며 캐시 크기는 제한되어 있다. 부서처럼 **입력 값 종류가 적을수록** 효과가 크다.
:::

::: example 함수 호출 부하 줄이기
사용자 정의 함수를 SELECT 절에서 그냥 호출하면 행마다 실행된다. `(SELECT FN_코드명(E.코드) FROM DUAL)`처럼 스칼라 서브쿼리로 감싸면 캐싱 덕분에 입력 값 종류만큼만 함수가 실행된다.
:::

## 스칼라 서브쿼리 주의점

::: warning 캐싱이 오히려 손해인 경우
- **입력 값 종류가 많을 때**: 캐시에서 찾지 못하는 경우가 대부분이라, 캐시 확인·저장 비용만 더해진다. 고객번호처럼 거의 유일한 값을 입력으로 받는 경우가 그렇다.
- **메인쿼리 집합이 매우 작을 때**: 캐시를 재사용할 기회가 거의 없다. 예를 들어 고객 한 명을 조회하는 쿼리에서 스칼라 서브쿼리 캐싱은 의미가 없다.
:::

- 스칼라 서브쿼리는 **한 행·한 컬럼**만 반환해야 한다. 두 건 이상이면 `ORA-01427` 오류가 발생한다.
- 여러 컬럼이 필요하다고 같은 스칼라 서브쿼리를 여러 번 쓰면 그만큼 반복 실행된다. 문자열로 결합해 한 번에 가져온 뒤 SUBSTR로 분리하거나, 조인으로 바꾸는 것을 검토한다.

## 스칼라 서브쿼리를 조인으로 변환

대량 데이터를 처리할 때 스칼라 서브쿼리는 NL 방식으로 고정되어 해시 조인을 쓸 수 없다. **12c부터는 스칼라 서브쿼리도 Unnesting** 할 수 있어, 옵티마이저가 Outer 조인으로 변환한 뒤 해시 조인 등을 선택할 수 있다.

```sql
-- 스칼라 서브쿼리 Unnesting 유도 (12c~)
SELECT C.고객번호, C.고객명,
       (SELECT /*+ UNNEST */ ROUND(AVG(T.거래금액), 2)
        FROM   거래 T
        WHERE  T.고객번호 = C.고객번호
        AND    T.거래일시 >= TRUNC(SYSDATE, 'MM')) AS 평균거래금액
FROM   고객 C
WHERE  C.가입일시 >= TRUNC(ADD_MONTHS(SYSDATE, -1), 'MM');
```

```
HASH JOIN OUTER
  TABLE ACCESS FULL   고객
  VIEW                VW_SSQ_1
    HASH GROUP BY
      TABLE ACCESS FULL  거래
```

- `UNNEST`: 스칼라 서브쿼리를 조인으로 풀도록 유도한다. `NO_UNNEST`: 스칼라 서브쿼리 그대로 실행(캐싱 활용)하도록 한다.
- 수동으로 바꿀 때는 결과가 없는 행도 남도록 **Outer 조인**으로 써야 결과가 같다.

> 시험 포인트: 스칼라 서브쿼리 → 조인 변환 문제에서 Inner 조인으로 바꾸면 매칭이 없는 메인 행이 사라져 결과가 달라진다. 반드시 Outer 조인으로 바꾼다.

## 핵심 요약

- Unnesting 되지 않은 서브쿼리는 FILTER 오퍼레이션으로 처리되며, NL 조인과 달리 첫 건에서 멈추고, 결과를 캐싱하고, 메인쿼리가 항상 드라이빙이다.
- `UNNEST`는 서브쿼리를 조인으로 풀고, `NO_UNNEST`는 필터 방식으로 유지한다. 서브쿼리 쪽이 1쪽임이 보장되지 않으면 SORT/HASH UNIQUE 또는 세미 조인이 쓰인다.
- EXISTS·IN은 세미 조인(`NL_SJ`·`HASH_SJ`·`MERGE_SJ`), NOT EXISTS·NOT IN은 안티 조인(`NL_AJ`·`HASH_AJ`·`MERGE_AJ`)으로 처리된다.
- `PUSH_SUBQ`는 Unnesting 되지 않은 서브쿼리 필터링을 앞 단계로 당기며, `NO_UNNEST`와 함께 쓴다.
- 뷰 Merging(`MERGE`/`NO_MERGE`)은 뷰를 메인쿼리와 합친다. 집합 연산자·CONNECT BY·ROWNUM·집계 함수(GROUP BY 없음)·분석 함수가 있으면 불가하다.
- 조건절 Pushdown·Pullup·조인 조건 Pushdown(`PUSH_PRED`, VIEW PUSHED PREDICATE)으로 뷰 안에서 미리 데이터를 걸러낸다.
- 스칼라 서브쿼리는 입력·출력 값을 캐싱하므로 입력 값 종류가 적을 때 유리하고, 많거나 메인 집합이 작으면 손해다.
- 12c부터 스칼라 서브쿼리도 Unnesting 가능하며, 수동 변환 시 반드시 Outer 조인을 쓴다.
