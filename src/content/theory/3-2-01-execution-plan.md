---
title: 실행계획 분석
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-2. SQL 분석 도구
summary: EXPLAIN PLAN과 DBMS_XPLAN.DISPLAY, 실행계획 읽는 순서, 오퍼레이션과 Cost·Cardinality
---

# 실행계획 분석

<strong>실행계획(Execution Plan)</strong>은 옵티마이저가 선택한 SQL 처리 절차를 트리 구조로 표현한 것이다. 어떤 순서로 테이블에 접근하고, 어떤 인덱스를 쓰며, 어떤 방식으로 조인하는지 보여 준다. 튜닝은 실행계획을 정확히 읽는 데서 시작한다.

## 예상 실행계획과 실제 실행계획

::: compare
- **예상 실행계획** SQL을 **실행하지 않고** 옵티마이저가 만들 계획만 보여 준다. EXPLAIN PLAN, AutoTrace의 traceonly explain, DBMS_XPLAN.DISPLAY. 비용·카디널리티는 모두 추정치다.
- **실제 실행계획** SQL을 **실제로 실행한** 커서의 계획과 수행 통계를 보여 준다. SQL 트레이스(TKPROF), DBMS_XPLAN.DISPLAY_CURSOR. 실제 처리 건수, 읽은 블록 수, 소요 시간을 확인할 수 있다.
:::

예상 실행계획은 바인드 변수 타입, 바인드 Peeking, 실행 시점의 통계 차이 때문에 **실제 수행된 계획과 다를 수 있다**. 실제 수행 통계를 보는 방법은 [SQL 트레이스와 실행 통계](/theory/sql-trace)에서 다룬다.

## EXPLAIN PLAN과 DBMS_XPLAN.DISPLAY

### EXPLAIN PLAN 명령

```sql
-- 1. PLAN_TABLE 생성 (10g 이후 기본 제공, 구버전은 아래 스크립트)
@?/rdbms/admin/utlxplan.sql

-- 2. 실행계획을 PLAN_TABLE에 저장
EXPLAIN PLAN SET STATEMENT_ID = 'query1' FOR
SELECT *
FROM   EMP E, DEPT D
WHERE  D.DEPTNO = E.DEPTNO
AND    E.SAL >= 2000;

-- 3. 저장된 실행계획 조회
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY('PLAN_TABLE', 'query1', 'TYPICAL'));
```

- EXPLAIN PLAN은 SQL을 실행하지 않고, 실행계획을 **PLAN_TABLE**에 저장만 한다.
- Oracle 10g부터는 `SYS.PLAN_TABLE$` 테이블과 `PLAN_TABLE` 퍼블릭 시노님이 기본 제공되어 별도로 만들 필요가 없다.

### DBMS_XPLAN.DISPLAY 출력 예

```text
Plan hash value: 615168685

---------------------------------------------------------------------------------------
| Id  | Operation                    | Name    | Rows  | Bytes | Cost (%CPU)| Time     |
---------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |         |     9 |   540 |     4  (25)| 00:00:01 |
|*  1 |  HASH JOIN                   |         |     9 |   540 |     4  (25)| 00:00:01 |
|   2 |   TABLE ACCESS FULL          | DEPT    |     4 |    80 |     2   (0)| 00:00:01 |
|*  3 |   TABLE ACCESS FULL          | EMP     |     9 |   360 |     2   (0)| 00:00:01 |
---------------------------------------------------------------------------------------

Predicate Information (identified by operation id):
---------------------------------------------------
   1 - access("D"."DEPTNO"="E"."DEPTNO")
   3 - filter("E"."SAL">=2000)
```

| 항목 | 의미 |
|---|---|
| Id | 오퍼레이션 번호. 앞에 `*`가 붙으면 Predicate Information에 조건이 있다 |
| Operation | 수행하는 작업. 들여쓰기로 부모-자식 관계를 표현 |
| Name | 액세스하는 오브젝트(테이블, 인덱스) 이름 |
| **Rows** | 예상 처리 건수 = **Cardinality** |
| Bytes | 예상 데이터 크기 |
| **Cost** | 예상 비용. 괄호 안은 CPU 비용 비율 |
| Time | 예상 수행 시간 |

### 포맷 옵션

| 옵션 | 내용 |
|---|---|
| BASIC | Id, Operation, Name만 표시 |
| TYPICAL (기본값) | Rows, Bytes, Cost, Time, Predicate Information 등 |
| SERIAL | TYPICAL과 같되 병렬 처리 정보 제외 |
| ALL | TYPICAL + Query Block Name, Column Projection 정보 |
| OUTLINE | 실행계획을 고정하는 데 필요한 힌트 목록(Outline Data) 포함 |
| ADVANCED | ALL + OUTLINE 등 가능한 모든 정보 |

## Predicate Information

실행계획 아래의 Predicate Information은 각 오퍼레이션에서 조건이 **어떻게** 사용되었는지 보여 준다. 튜닝에서 가장 중요하게 봐야 하는 정보다.

::: compare
- **access** 인덱스 스캔 **범위를 결정**하는 데 사용된 조건. 인덱스 수직 탐색의 시작점과 끝점을 정한다. 조인에서는 조인 방식에 사용된 조건.
- **filter** 범위를 정하지 못하고 읽은 데이터를 **걸러내는** 데 사용된 조건. 인덱스 filter는 리프 블록을 읽으면서, 테이블 filter는 테이블을 읽은 뒤 걸러낸다.
:::

```text
-- 인덱스 EMP_X01 = (DEPTNO, JOB, SAL), 조건: DEPTNO = 20 AND SAL >= 2000
|*  2 |   INDEX RANGE SCAN          | EMP_X01 |    10 |       |     1   (0)|

Predicate Information (identified by operation id):
   2 - access("DEPTNO"=20 AND "SAL">=2000)
       filter("SAL">=2000)
```

중간 컬럼 JOB에 조건이 없으므로 스캔 범위는 `DEPTNO = 20`으로만 정해지고, SAL 조건은 리프 블록을 읽으면서 걸러내는 필터 역할을 한다. 이처럼 access와 filter에 같은 조건이 함께 나타나면 **사실상 필터로만 동작**한다고 해석한다.

> 시험 포인트: 인덱스에서 `access`로 쓰인 조건만 스캔 범위를 줄인다. `filter`로만 쓰인 조건은 이미 읽은 데이터를 버리는 것이므로 스캔량을 줄이지 못한다. 인덱스 액세스 조건과 필터 조건의 구분은 [인덱스 스캔 방식](/theory/index-scan)과 [인덱스 설계](/theory/index-design)에서 자세히 다룬다.

## 실행계획 읽는 순서

실행계획은 트리 구조이며 다음 규칙으로 읽는다.

::: info 읽기 규칙
- **위에서 아래로** 내려가면서 가장 **안쪽으로 들여쓰기된** 오퍼레이션부터 실행한다.
- **같은 들여쓰기 수준(형제)** 이면 **위에 있는 것이 먼저** 실행된다.
- 자식 오퍼레이션이 모두 끝나야(또는 결과를 넘겨줘야) 부모 오퍼레이션이 처리된다.
:::

```text
---------------------------------------------------------------
| Id  | Operation                        | Name               |
---------------------------------------------------------------
|   0 | SELECT STATEMENT                 |                    |
|   1 |  NESTED LOOPS                    |                    |
|   2 |   NESTED LOOPS                   |                    |
|   3 |    TABLE ACCESS BY INDEX ROWID   | DEPT               |
|   4 |     INDEX RANGE SCAN             | DEPT_LOC_IDX       |
|   5 |    INDEX RANGE SCAN              | EMP_DEPTNO_IDX     |
|   6 |   TABLE ACCESS BY INDEX ROWID    | EMP                |
---------------------------------------------------------------
```

::: steps
1. **Id 4** DEPT_LOC_IDX 인덱스를 범위 스캔해 ROWID를 얻는다
2. **Id 3** ROWID로 DEPT 테이블을 액세스한다 (Outer = Driving 테이블)
3. **Id 5** DEPT 한 건마다 EMP_DEPTNO_IDX 인덱스를 탐색한다
4. **Id 2** 위 두 결과를 NL 조인한다
5. **Id 6** 인덱스에서 얻은 ROWID로 EMP 테이블을 액세스한다
6. **Id 1 → 0** 결과를 결합해 사용자에게 반환한다
:::

조인에서는 <strong>같은 레벨 두 자식 중 위쪽이 먼저(Outer, Build), 아래쪽이 나중(Inner, Probe)</strong>이다. 위 예에서 DEPT가 드라이빙 테이블, EMP가 Inner 테이블이다. 조인 방식별 읽기는 [NL 조인](/theory/nl-join), [소트 머지 조인](/theory/sort-merge-join), [해시 조인](/theory/hash-join)에서 다룬다.

::: warning NL 조인은 한 번에 끝나지 않는다
"가장 안쪽부터 실행"은 순서를 이해하기 위한 규칙이다. NL 조인은 Outer 쪽 한 건을 읽을 때마다 Inner 쪽을 반복 탐색하므로, Id 3과 Id 5가 번갈아 수행된다. 반면 해시 조인은 Build Input(위쪽)을 모두 읽어 해시 맵을 만든 후 Probe Input(아래쪽)을 읽는다.
:::

> 시험 포인트: 실행계획 순서 문제는 "가장 안쪽 들여쓰기 → 같은 레벨은 위부터 → 부모"로 푼다. Id 번호 순서가 곧 실행 순서는 아니다.

## 주요 오퍼레이션

### 테이블·인덱스 액세스

| 오퍼레이션 | 의미 |
|---|---|
| TABLE ACCESS FULL | 테이블 전체 스캔 (Multiblock I/O) |
| TABLE ACCESS BY INDEX ROWID | 인덱스에서 얻은 ROWID로 테이블 액세스 |
| TABLE ACCESS BY USER ROWID | 사용자가 지정한 ROWID로 액세스 |
| INDEX UNIQUE SCAN | Unique 인덱스로 `=` 조건 한 건 탐색 |
| INDEX RANGE SCAN | 인덱스 범위 스캔 |
| INDEX RANGE SCAN DESCENDING | 인덱스를 역순으로 범위 스캔 |
| INDEX FULL SCAN | 인덱스 리프 블록 전체를 순서대로 스캔 (Single Block I/O) |
| INDEX FAST FULL SCAN | 인덱스 세그먼트 전체를 Multiblock I/O로 스캔 (순서 보장 없음) |
| INDEX SKIP SCAN | 선두 컬럼이 조건에 없을 때 선두 값별로 건너뛰며 스캔 |

### 조인

| 오퍼레이션 | 의미 |
|---|---|
| NESTED LOOPS | NL 조인 |
| NESTED LOOPS SEMI / ANTI | EXISTS / NOT EXISTS 서브쿼리를 세미·안티 조인으로 처리 |
| MERGE JOIN (+ SORT JOIN) | 소트 머지 조인 |
| HASH JOIN | 해시 조인 |
| HASH JOIN RIGHT SEMI / ANTI 등 | 세미·안티 해시 조인 (서브쿼리 집합 쪽을 Build Input으로 사용) |
| MERGE JOIN CARTESIAN | 조인 조건 없는 카테시안 곱 |

### 정렬·집계·기타

| 오퍼레이션 | 의미 |
|---|---|
| SORT AGGREGATE | 전체 집계 (실제 정렬은 하지 않음) |
| SORT ORDER BY | ORDER BY 정렬 |
| SORT GROUP BY / HASH GROUP BY | GROUP BY 처리 (정렬 방식 / 해시 방식) |
| SORT UNIQUE / HASH UNIQUE | DISTINCT, 서브쿼리 Unnesting 시 중복 제거 |
| SORT JOIN | 소트 머지 조인을 위한 정렬 |
| WINDOW SORT | 분석 함수 처리 |
| COUNT STOPKEY | ROWNUM 조건으로 Top N 처리 시 멈춤 |
| SORT ORDER BY STOPKEY | Top N 소트 |
| FILTER | 필터 조건 처리, 서브쿼리를 필터 방식으로 수행 |
| VIEW | 인라인 뷰·뷰를 병합하지 않고 처리 |
| UNION-ALL, CONCATENATION | 집합 연산, OR-Expansion |
| PARTITION RANGE ITERATOR / ALL / SINGLE | 파티션 Pruning 결과 |

정렬 오퍼레이션은 [소트 튜닝](/theory/sort-tuning), 서브쿼리 관련 오퍼레이션은 [서브쿼리 조인](/theory/subquery-join), 파티션 관련 오퍼레이션은 [파티셔닝](/theory/partitioning)에서 다룬다.

## Cost와 Cardinality

::: cards 3
- **Cardinality (Rows)** 오퍼레이션이 반환할 것으로 **예상한 건수**. 선택도 × 전체 레코드 수로 계산한다
- **Cost** 예상 I/O 횟수 또는 예상 소요시간을 표준화한 값. 옵티마이저가 실행계획을 비교하는 기준
- **Selectivity** 조건을 만족할 것으로 예상되는 비율. `=` 조건은 1 / NDV(Number of Distinct Values)
:::

```text
선택도(Selectivity)  = 1 / NDV           (= 조건, 히스토그램 없을 때)
카디널리티(Cardinality) = 총 로우 수 × 선택도
```

::: example 카디널리티 계산
EMP 테이블이 10,000건이고 JOB 컬럼의 값 종류(NDV)가 5개라면 `WHERE JOB = 'CLERK'`의 선택도는 1/5 = 0.2, 카디널리티는 10,000 × 0.2 = **2,000건**이다.
:::

::: warning Cost는 실측값이 아니다
- Cost와 Rows는 **통계정보 기반의 예상치**다. 실제 처리 건수, 실제 수행 시간과 다를 수 있다.
- 통계정보가 오래되었거나 컬럼 간 상관관계가 있으면 카디널리티 추정이 크게 틀어지고, 잘못된 조인 순서·방식이 선택된다.
- **서로 다른 SQL의 Cost를 비교해 성능을 판단하면 안 된다.** 정확한 성능 비교는 실제 수행 통계(블록 수, 소요 시간)로 한다.
:::

> 시험 포인트: 예상 실행계획의 Rows는 실제 건수가 아니라 Cardinality 추정치다. Cost가 낮다고 실제로 빠른 것은 아니며, 정확한 판단은 SQL 트레이스나 DISPLAY_CURSOR의 실측값으로 한다. 비용 계산 원리는 [옵티마이저](/theory/optimizer)를 참고한다.

## AutoTrace로 실행계획 보기

SQL*Plus에서 AutoTrace를 사용하면 실행계획과 실행 통계를 함께 볼 수 있다.

| 명령 | SQL 실행 | 결과 출력 | 실행계획 | 실행 통계 |
|---|---|---|---|---|
| `SET AUTOTRACE ON` | O | O | O | O |
| `SET AUTOTRACE ON EXPLAIN` | O | O | O | |
| `SET AUTOTRACE ON STATISTICS` | O | O | | O |
| `SET AUTOTRACE TRACEONLY` | O | | O | O |
| `SET AUTOTRACE TRACEONLY EXPLAIN` | **X** | | O | |
| `SET AUTOTRACE TRACEONLY STATISTICS` | O | | | O |

`TRACEONLY EXPLAIN`만 SQL을 실제로 실행하지 않는다. 실행 통계 항목의 의미는 [SQL 트레이스와 실행 통계](/theory/sql-trace)에서 다룬다.

## SQL Server 실행계획

SQL Server는 다음 방식으로 예상 실행계획을 확인한다.

```sql
SET SHOWPLAN_TEXT ON;   -- 예상 실행계획 (텍스트, SQL 실행 안 함)
GO
SELECT * FROM dbo.EMP WHERE EMPNO = 7900;
GO

SET SHOWPLAN_ALL ON;    -- 예상 실행계획 + 예상 비용·건수 등 상세 정보
SET STATISTICS PROFILE ON; -- 실제 실행 후 실행계획과 실제 처리 건수
SET STATISTICS IO ON;   -- 실행 후 논리적·물리적 읽기 수
SET STATISTICS TIME ON; -- 파싱·컴파일·실행 시간
```

```text
StmtText
-------------------------------------------------------------
  |--Nested Loops(Inner Join, OUTER REFERENCES:([e].[DEPTNO]))
       |--Clustered Index Scan(OBJECT:([EMP].[PK_EMP] AS [e]))
       |--Clustered Index Seek(OBJECT:([DEPT].[PK_DEPT] AS [d]),
                               SEEK:([d].[DEPTNO]=[e].[DEPTNO]))
```

| Oracle | SQL Server |
|---|---|
| TABLE ACCESS FULL | Table Scan (힙 테이블), Clustered Index Scan |
| INDEX RANGE SCAN / UNIQUE SCAN | Index Seek, Clustered Index Seek |
| INDEX FULL SCAN | Index Scan |
| TABLE ACCESS BY INDEX ROWID | RID Lookup (힙), Key Lookup (클러스터형) |

- 읽는 순서는 Oracle과 같이 **안쪽 들여쓰기부터, 같은 레벨은 위부터**다.
- Management Studio의 그래픽 실행계획은 **오른쪽에서 왼쪽으로**, 위에서 아래로 읽는다.

## 핵심 요약

- 예상 실행계획(EXPLAIN PLAN, DISPLAY, TRACEONLY EXPLAIN)은 SQL을 실행하지 않으며 실제 계획과 다를 수 있다.
- EXPLAIN PLAN은 PLAN_TABLE에 저장하고 DBMS_XPLAN.DISPLAY로 조회한다. 기본 포맷은 TYPICAL이다.
- Predicate Information의 access는 스캔 범위를 정하는 조건, filter는 읽은 뒤 걸러내는 조건이다.
- 실행 순서는 안쪽 들여쓰기부터, 같은 레벨이면 위부터, 그 다음 부모 순이다. Id 순서가 실행 순서는 아니다.
- 조인에서 같은 레벨 위쪽이 Outer(Build), 아래쪽이 Inner(Probe)다.
- Rows는 Cardinality 추정치이며 Cardinality = 총 로우 수 × 선택도, 선택도 = 1/NDV(= 조건)다.
- Cost는 예상치이므로 실제 성능 비교는 실측 통계(블록 수, 시간)로 한다.
- SQL Server는 SET SHOWPLAN_TEXT/ALL로 예상 계획, SET STATISTICS PROFILE/IO/TIME으로 실측 정보를 본다.
