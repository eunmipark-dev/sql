---
title: 힌트 활용
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-5. SQL 옵티마이저
summary: 힌트 문법과 무시되는 경우, 액세스·조인·쿼리 변환·병렬 힌트 분류와 사용법
---

# 힌트 활용

힌트(Hint)는 옵티마이저에게 **실행 방식을 직접 지시**하는 수단이다. [옵티마이저](/theory/optimizer)가 통계 부족이나 한계 때문에 비효율적인 계획을 고를 때, 개발자가 액세스 경로·조인 순서·조인 방식 등을 지정한다. Oracle 힌트는 단순 "참고 의견"이 아니라 <strong>지시(Directive)</strong>다. 문법이 맞고 실행 가능하면 옵티마이저는 반드시 따른다.

## 힌트 문법

```sql
SELECT /*+ LEADING(e) USE_NL(d) INDEX(e emp_deptno_idx) */
       e.ename, d.dname
FROM   emp e, dept d
WHERE  e.deptno = d.deptno
AND    e.deptno = 10;

SELECT --+ FULL(e)
       * FROM emp e;    -- 한 줄 주석 형태도 가능
```

::: info 작성 규칙
- `/*+`는 공백 없이 붙여 쓴다. `/* +`처럼 띄우면 일반 주석이 된다.
- 힌트는 **SELECT·INSERT·UPDATE·DELETE·MERGE 키워드 바로 뒤**에 쓴다.
- 여러 힌트는 공백으로 구분한다. 힌트 인자 사이의 콤마는 써도 되지만, 힌트와 힌트 사이에 콤마를 쓰면 그 뒤 힌트가 무시될 수 있다.
- FROM 절에 **Alias를 지정했다면 반드시 Alias**를 써야 한다. 테이블명을 쓰면 무시된다.
- 스키마명을 붙인 `FULL(scott.emp)`는 잘못된 표기다.
:::

## 힌트가 무시되는 경우

옵티마이저가 힌트를 따르지 않는 이유는 대부분 사용자의 실수다.

::: cards 2
- **문법 오류** 철자 오류, 괄호 누락, `/*+` 띄어쓰기 등. 오류 메시지 없이 **조용히 무시**된다.
- **잘못된 참조** Alias 대신 테이블명 사용, 존재하지 않는 인덱스명, 다른 쿼리 블록의 테이블을 그냥 지정한 경우
- **의미적으로 맞지 않음** 서브쿼리가 아닌 곳의 UNNEST, 이미 Unnesting된 서브쿼리에 필터용 힌트 등
- **논리적으로 불가능** 등치(=) 조인 조건이 없는데 USE_HASH, NULL 허용 컬럼 인덱스만으로 COUNT(*)를 구하도록 INDEX_FFS 지정 등
- **상충되는 힌트** 서로 모순되는 지시를 함께 쓴 경우 (아래 참고)
- **쿼리 변환으로 인한 무효화** 뷰 Merging 등으로 쿼리 블록 구조가 바뀌어 힌트 대상이 사라진 경우
:::

::: warning 힌트가 무시되어도 오류는 없다
Oracle은 힌트를 따를 수 없으면 **에러 없이 무시**하고 자체 판단대로 실행한다. 반드시 실행계획으로 적용 여부를 확인해야 한다. 반대로 SQL Server는 테이블 힌트에 없는 인덱스를 지정하면 **오류가 발생**한다.
:::

> 시험 포인트: "힌트를 잘못 쓰면 에러가 난다"는 Oracle 기준으로 틀린 보기다. Alias를 정의했는데 테이블명으로 힌트를 쓴 경우도 무시된다.

## 최적화 목표와 액세스 경로 힌트

| 분류 | 힌트 | 설명 |
|---|---|---|
| 최적화 목표 | ALL_ROWS | 전체 처리 속도 최적화 |
| | FIRST_ROWS(n) | 처음 n건 응답 속도 최적화 |
| 액세스 경로 | FULL(t) | Table Full Scan |
| | INDEX(t idx) | 인덱스 스캔 (Range, Unique 등 옵티마이저 판단) |
| | INDEX_ASC(t idx) / INDEX_DESC(t idx) | 인덱스를 오름차순 / **내림차순**으로 스캔 |
| | INDEX_FFS(t idx) | Index Fast Full Scan (멀티블록 I/O, 정렬 순서 보장 안 됨) |
| | INDEX_SS(t idx) | Index Skip Scan (선두 컬럼 조건이 없을 때) |
| | NO_INDEX(t idx) | 해당 인덱스 사용 금지 |
| | INDEX_COMBINE(t) | 비트맵 방식으로 여러 인덱스 결합 |

```sql
-- 최근 주문 1건: 인덱스를 거꾸로 읽어 첫 건에서 멈춘다
SELECT /*+ INDEX_DESC(o ord_custid_orddt_idx) */ *
FROM   orders o
WHERE  cust_id = :cust
AND    ROWNUM <= 1;
```

INDEX 힌트의 인덱스명 대신 `INDEX(e (deptno, sal))`처럼 **컬럼 목록**으로 지정할 수도 있다. 인덱스 스캔 방식별 동작은 [인덱스 스캔](/theory/index-scan)을 참고한다.

## 조인 순서와 조인 방식 힌트

| 분류 | 힌트 | 설명 |
|---|---|---|
| 조인 순서 | ORDERED | **FROM 절에 나열된 순서**대로 조인 |
| | LEADING(t1 t2 ...) | 괄호 안 순서대로 조인. FROM 절 순서와 무관 |
| | SWAP_JOIN_INPUTS(t) | 해시 조인에서 t를 Build Input으로 |
| 조인 방식 | USE_NL(t) | t를 Inner로 하는 [NL 조인](/theory/nl-join) |
| | USE_HASH(t) | t를 Probe(Inner) 쪽으로 하는 [해시 조인](/theory/hash-join) |
| | USE_MERGE(t) | [소트 머지 조인](/theory/sort-merge-join) |
| | NL_SJ / HASH_SJ / MERGE_SJ | 세미 조인 방식 (서브쿼리 안에 기술) |
| | NL_AJ / HASH_AJ / MERGE_AJ | 안티 조인 방식 (서브쿼리 안에 기술) |

::: example 조인 힌트 읽기
```sql
SELECT /*+ LEADING(d e b) USE_NL(e) USE_HASH(b) */ ...
FROM   emp e, dept d, bonus b
WHERE  ...
```
조인 순서는 d → e → b다. d와 e는 **e를 Inner로 하는 NL 조인**, 그 결과와 b는 해시 조인한다. `USE_NL(e)`는 "e를 NL 조인의 **안쪽**(Inner) 테이블로 쓰라"는 뜻이지 e부터 읽으라는 뜻이 아니다.
:::

::: warning ORDERED + USE_NL(A B)
`/*+ ORDERED USE_NL(B) */`는 FROM 절 첫 테이블에서 시작해 B를 Inner로 NL 조인한다. `USE_NL(A B)`는 A와 B 각각을 Inner로 할 때 NL 조인을 쓰라는 뜻이며, **조인 순서를 정하지 않는다**. 조인 순서까지 고정하려면 ORDERED나 LEADING을 함께 써야 한다.
:::

> 시험 포인트: 조인 방식 힌트만으로는 조인 순서가 정해지지 않는다. "LEADING(A) USE_NL(B)"는 A가 드라이빙, B가 Inner인 NL 조인이다. ORDERED는 FROM 절 순서, LEADING은 괄호 안 순서를 따른다.

## 쿼리 변환 힌트

| 힌트 | 설명 |
|---|---|
| UNNEST / NO_UNNEST | 서브쿼리 Unnesting 적용 / 억제 (서브쿼리 안에 기술) |
| MERGE / NO_MERGE | 뷰 Merging 적용 / 억제 |
| PUSH_PRED / NO_PUSH_PRED | 조인 조건 Pushdown 적용 / 억제 |
| PUSH_SUBQ / NO_PUSH_SUBQ | Unnesting 안 된 서브쿼리를 가능한 **먼저** / 나중에 필터링 |
| USE_CONCAT / NO_EXPAND | OR-Expansion 적용 / 억제 |
| REWRITE / NO_REWRITE | Materialized View 쿼리 재작성 |
| MATERIALIZE / INLINE | WITH 절을 임시 테이블로 / 인라인 뷰로 처리 |
| NO_QUERY_TRANSFORMATION | 모든 쿼리 변환 억제 |

각 변환의 동작은 [쿼리 변환](/theory/query-transformation)을 참고한다.

```sql
SELECT * FROM emp e
WHERE  EXISTS (SELECT /*+ NO_UNNEST PUSH_SUBQ */ 1
               FROM   dept d
               WHERE  d.deptno = e.deptno AND d.loc = 'SEOUL');
```

## 병렬 처리와 기타 힌트

| 분류 | 힌트 | 설명 |
|---|---|---|
| 병렬 | PARALLEL(t n) | t를 병렬도 n으로 처리 |
| | NO_PARALLEL(t) | 병렬 처리 금지 |
| | PQ_DISTRIBUTE(t outer inner) | 병렬 조인 시 데이터 분배 방식 지정 |
| | PARALLEL_INDEX(t idx n) | 인덱스 스캔 병렬화 (파티션 인덱스) |
| 기타 | APPEND | INSERT ... SELECT를 **Direct Path Insert**로 |
| | APPEND_VALUES | INSERT ... VALUES를 Direct Path로 (11gR2) |
| | CARDINALITY(t n) | t의 카디널리티를 n으로 가정 |
| | DYNAMIC_SAMPLING(t n) | 동적 샘플링 레벨 지정 |
| | RESULT_CACHE | 결과 집합을 Result Cache에 저장 |
| | QB_NAME(name) | 쿼리 블록에 이름 부여 |
| | DRIVING_SITE(t) | 원격 조인을 t가 있는 사이트에서 수행 |

```sql
INSERT /*+ APPEND */ INTO sales_hist
SELECT /*+ FULL(s) PARALLEL(s 4) */ * FROM sales s WHERE sale_dt < :dt;
```

::: warning APPEND와 병렬 DML
Direct Path Insert는 테이블에 Exclusive 모드 TM Lock을 걸어 다른 트랜잭션의 DML을 막는다. 또 병렬 DML은 `ALTER SESSION ENABLE PARALLEL DML`을 먼저 실행해야 INSERT·UPDATE·DELETE 자체가 병렬로 수행된다. 자세한 내용은 [DML 튜닝](/theory/dml-tuning)과 [배치 프로그램 튜닝](/theory/batch-tuning)을 참고한다.
:::

## 상충되는 힌트

한 테이블에 서로 모순되는 지시를 하면 일부 또는 전부가 무시된다.

```sql
/*+ ORDERED LEADING(d) */          -- ORDERED가 우선, LEADING 무시
/*+ FULL(e) INDEX(e emp_x01) */    -- 같은 테이블에 상반된 액세스 경로
/*+ USE_NL(e) USE_HASH(e) */       -- 같은 테이블에 상반된 조인 방식
/*+ LEADING(e d) LEADING(d e) */   -- 순서 지정이 서로 충돌
```

반면 **상충하지 않는** 경우는 옵티마이저가 그중에서 고른다. 예를 들어 `INDEX(e emp_x01 emp_x02)`처럼 여러 인덱스를 나열하면 그중 비용이 낮은 것을 쓴다.

::: tip 힌트는 빠짐없이
힌트를 일부만 주면 나머지는 옵티마이저가 정하므로 의도와 다른 계획이 나올 수 있다. 조인 SQL이라면 **조인 순서 + 각 테이블 액세스 경로 + 조인 방식**을 함께 지정하는 것이 안전하다.
:::

## 쿼리 블록 이름 (QB_NAME)

서브쿼리나 인라인 뷰 안의 테이블을 바깥 쿼리 블록에서 힌트로 지정하려면 **쿼리 블록 이름**을 쓴다.

```sql
SELECT /*+ QB_NAME(main) LEADING(d@sub e@main) USE_NL(e@main) */ e.*
FROM   emp e
WHERE  e.deptno IN (SELECT /*+ QB_NAME(sub) UNNEST */ d.deptno
                    FROM   dept d WHERE d.loc = 'SEOUL');
-- Unnesting된 서브쿼리의 dept를 먼저 읽고, emp를 Inner로 NL 조인
```

- `QB_NAME(이름)`으로 쿼리 블록에 이름을 붙이고, `테이블Alias@블록이름`으로 참조한다.
- 이름을 주지 않으면 `SEL$1`, `SEL$2`처럼 시스템이 붙인 이름이 쓰이며, `DBMS_XPLAN.DISPLAY_CURSOR(format => 'ADVANCED')`의 Query Block Name 항목에서 확인할 수 있다.
- 인라인 뷰 안 테이블은 `INDEX(v.e emp_x01)`처럼 **뷰Alias.테이블Alias** 형태(글로벌 힌트)로도 지정할 수 있다.

## SQL Server 힌트 비교

| 구분 | Oracle | SQL Server |
|---|---|---|
| 위치 | SELECT 뒤 주석 `/*+ */` | 테이블 힌트 `WITH (...)`, 조인 힌트, 쿼리 힌트 `OPTION (...)` |
| 인덱스 지정 | `INDEX(t idx)` | `FROM t WITH (INDEX(idx))` |
| 조인 방식 | `USE_NL` / `USE_HASH` / `USE_MERGE` | `INNER LOOP JOIN` / `HASH JOIN` / `MERGE JOIN` 또는 `OPTION (LOOP JOIN)` |
| 조인 순서 고정 | `ORDERED`, `LEADING` | `OPTION (FORCE ORDER)` |
| 병렬도 | `PARALLEL(t n)` | `OPTION (MAXDOP n)` |
| 잠금 관련 | (해당 없음, 읽기에 Lock 안 씀) | `WITH (NOLOCK)`, `WITH (UPDLOCK)` 등 |
| 따를 수 없을 때 | 조용히 무시 | 오류 발생 가능 |

```sql
-- SQL Server
SELECT e.ename, d.dname
FROM   emp e WITH (INDEX(emp_deptno_idx))
       INNER LOOP JOIN dept d ON d.deptno = e.deptno
OPTION (FORCE ORDER, MAXDOP 1);
```

## 핵심 요약

- 힌트는 `/*+ */` 형태로 SELECT 등 키워드 바로 뒤에 쓰며, Oracle 힌트는 따를 수 있으면 반드시 따르는 지시다.
- 문법 오류, Alias 대신 테이블명 사용, 논리적으로 불가능한 지시, 상충되는 힌트는 에러 없이 무시된다.
- 액세스 경로는 FULL, INDEX, INDEX_DESC, INDEX_FFS, INDEX_SS 등으로 지정한다.
- ORDERED는 FROM 절 순서, LEADING은 괄호 안 순서로 조인하며 ORDERED가 LEADING보다 우선한다.
- USE_NL(t)·USE_HASH(t)의 t는 Inner(Probe) 쪽이며, 조인 방식 힌트만으로는 순서가 정해지지 않는다.
- UNNEST, MERGE, PUSH_PRED, USE_CONCAT 등은 쿼리 변환을, NO_QUERY_TRANSFORMATION은 모든 변환을 제어한다.
- APPEND는 Direct Path Insert, PARALLEL은 병렬 처리 힌트다.
- QB_NAME으로 쿼리 블록에 이름을 붙이고 `Alias@블록명`으로 다른 블록의 테이블에 힌트를 준다.
- SQL Server는 WITH (INDEX), LOOP/HASH/MERGE JOIN, OPTION (FORCE ORDER) 등을 쓰며 따를 수 없으면 오류가 날 수 있다.
