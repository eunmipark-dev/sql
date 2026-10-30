---
title: SQL 트레이스와 실행 통계
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-2. SQL 분석 도구
summary: AutoTrace, SQL 트레이스·TKPROF, DISPLAY_CURSOR의 A-Rows·Buffers 해석과 대기 이벤트
---

# SQL 트레이스와 실행 통계

예상 실행계획만으로는 SQL이 실제로 몇 건을 처리했고, 몇 블록을 읽었으며, 어디서 시간을 썼는지 알 수 없다. 이 문서는 **실제 수행 통계**를 확인하는 AutoTrace, SQL 트레이스(TKPROF), DBMS_XPLAN.DISPLAY_CURSOR와 응답 시간 분석의 기본 개념을 정리한다.

::: flow
- **AutoTrace** 실행계획 + 세션 단위 실행 통계
- **SQL 트레이스 + TKPROF** Call 단위 통계 + 오퍼레이션별 실측치 + 대기 이벤트
- **DISPLAY_CURSOR** 캐시된 커서의 실제 계획 + 오퍼레이션별 실측치
:::

## AutoTrace

SQL*Plus에서 `SET AUTOTRACE`를 설정하면 SQL 수행 후 실행계획과 실행 통계를 함께 보여 준다.

```sql
SQL> SET AUTOTRACE TRACEONLY
SQL> SELECT * FROM EMP WHERE EMPNO = 7900;

Statistics
----------------------------------------------------------
          0  recursive calls
          0  db block gets
          2  consistent gets
          0  physical reads
          0  redo size
        825  bytes sent via SQL*Net to client
        523  bytes received via SQL*Net from client
          2  SQL*Net roundtrips to/from client
          0  sorts (memory)
          0  sorts (disk)
          1  rows processed
```

| 항목 | 의미 |
|---|---|
| recursive calls | SQL 수행 중 내부적으로 발생한 재귀 SQL 수 (하드 파싱 시 딕셔너리 조회, 함수 내 SQL 등) |
| **db block gets** | **Current 모드**로 읽은 블록 수 |
| **consistent gets** | **Consistent 모드**로 읽은 블록 수 |
| **physical reads** | 디스크에서 읽은 블록 수 |
| redo size | 생성된 리두 크기 (DML에서 발생) |
| SQL*Net roundtrips | 클라이언트와 주고받은 횟수 (Fetch Call 수와 관련) |
| sorts (memory / disk) | 메모리 정렬 / 디스크 정렬 횟수 |
| rows processed | 처리한 로우 수 |

- 논리적 I/O = **db block gets + consistent gets**, 물리적 I/O = **physical reads**다.
- 옵션별 동작(ON, TRACEONLY, EXPLAIN, STATISTICS)은 [실행계획 분석](/theory/execution-plan)의 AutoTrace 표를 참고한다.

::: info AutoTrace에 필요한 권한
- 실행계획 확인: **PLAN_TABLE** (10g 이후 기본 제공)
- 실행 통계 확인: `V$SESSTAT`, `V$STATNAME`, `V$MYSTAT` 뷰 조회 권한. DBA가 아니면 **PLUSTRACE** 롤을 부여받는다.
:::

> 시험 포인트: AutoTrace는 실행 통계를 SQL 전체 합계로만 보여 준다. 어느 오퍼레이션에서 블록을 많이 읽었는지는 SQL 트레이스나 DISPLAY_CURSOR로 확인한다.

## SQL 트레이스 수집

```sql
-- 현재 세션에 트레이스 설정
ALTER SESSION SET SQL_TRACE = TRUE;
SELECT * FROM EMP WHERE EMPNO = 7900;
ALTER SESSION SET SQL_TRACE = FALSE;

-- 트레이스 파일 위치 확인 (11g 이후)
SELECT VALUE FROM V$DIAG_INFO WHERE NAME = 'Default Trace File';

-- 대기 이벤트·바인드 값까지 수집 (10046 이벤트)
ALTER SESSION SET EVENTS '10046 trace name context forever, level 12';
```

| 10046 레벨 | 수집 내용 |
|---|---|
| 1 | 기본 SQL 트레이스 (SQL_TRACE = TRUE와 동일) |
| 4 | + 바인드 변수 값 |
| 8 | + 대기 이벤트 |
| 12 | + 바인드 변수 값 + 대기 이벤트 |

다른 세션은 `DBMS_MONITOR.SESSION_TRACE_ENABLE`, 서비스·모듈·액션 단위는 `DBMS_MONITOR.SERV_MOD_ACT_TRACE_ENABLE`로 설정할 수 있다.

트레이스 파일은 그대로 읽기 어려우므로 **TKPROF** 유틸리티로 포맷팅한다.

```bash
$ tkprof ora19c_ora_12345.trc report.prf sys=no
```

`sys=no`는 SYS 유저가 수행한 재귀 SQL을 리포트에서 제외한다.

## TKPROF 리포트 읽기

```text
SELECT * FROM EMP WHERE ENAME = :B1

call     count       cpu    elapsed       disk      query    current        rows
------- ------  -------- ---------- ---------- ---------- ----------  ----------
Parse        1      0.00       0.00          0          0          0           0
Execute      1      0.00       0.00          0          0          0           0
Fetch        2      0.01       0.35        180        214          0           1
------- ------  -------- ---------- ---------- ---------- ----------  ----------
total        4      0.01       0.35        180        214          0           1

Misses in library cache during parse: 1
Optimizer mode: ALL_ROWS
Parsing user id: 61

Rows     Row Source Operation
-------  ---------------------------------------------------
      1  TABLE ACCESS FULL EMP (cr=214 pr=180 pw=0 time=350121 us)
```

### Call 구분

::: cards 3
- **Parse** SQL을 파싱하고 실행계획을 생성하는 단계
- **Execute** SQL을 실행하는 단계. DML은 여기서 실제 변경이 일어난다
- **Fetch** SELECT 결과를 클라이언트로 전송하는 단계. SELECT의 블록 읽기는 대부분 여기서 발생한다
:::

### 통계 항목

| 항목 | 의미 | AutoTrace 대응 |
|---|---|---|
| **count** | Parse·Execute·Fetch Call 수행 횟수 | |
| **cpu** | CPU 사용 시간 (초) | |
| **elapsed** | 총 경과 시간 (초) = CPU + 대기 시간 | |
| **disk** | 디스크에서 읽은 블록 수 (물리적 I/O) | physical reads |
| **query** | Consistent 모드로 읽은 블록 수 | consistent gets |
| **current** | Current 모드로 읽은 블록 수 | db block gets |
| **rows** | 처리한 로우 수. SELECT는 Fetch, DML은 Execute에 표시 | rows processed |

::: example 위 리포트 해석
- 논리적 I/O = query + current = 214 + 0 = **214블록**, 물리적 I/O = disk = **180블록**
- BCHR = (1 − 180/214) × 100 ≈ **16%**
- elapsed(0.35) − cpu(0.01) = 약 0.34초를 **대기**에 사용했다 → 디스크 I/O 대기로 추정
- Fetch count 2: 결과 1건을 가져오는 데 Fetch를 2번 호출 (마지막 Fetch에서 데이터가 더 없음을 확인)
- `Misses in library cache during parse: 1` → **하드 파싱**이 발생했다 (0이면 소프트 파싱)
:::

### Row Source Operation 통계

| 표기 | 의미 |
|---|---|
| cr | Consistent 모드 블록 읽기 (Consistent Reads) |
| pr | 디스크 블록 읽기 (Physical Reads) |
| pw | 디스크 블록 쓰기 (Physical Writes) |
| time | 소요 시간 (마이크로초, us) |

::: warning 부모 값은 자식 값을 포함한다
Row Source Operation의 cr, pr, time은 **자식 오퍼레이션의 값을 누적한 값**이다. 아래에서 테이블 액세스 자체가 읽은 블록은 301,245 − 1,245 = **300,000블록**이다.
:::

```text
Rows     Row Source Operation
-------  ---------------------------------------------------
 300000  TABLE ACCESS BY INDEX ROWID 고객 (cr=301245 pr=280512 time=...)
 300000   INDEX RANGE SCAN 고객_X01 (cr=1245 pr=980 time=...)
```

> 시험 포인트: TKPROF의 query는 consistent gets, current는 db block gets, disk는 physical reads에 대응한다. 논리적 I/O는 query + current다. Row Source의 cr·pr·time은 자식 값을 포함한 누적치다.

### Fetch Call과 Array Size

```text
call     count       cpu    elapsed       disk      query    current        rows
------- ------  -------- ---------- ---------- ---------- ----------  ----------
Fetch     3334      0.25       0.31          0       3592          0       50000
```

5만 건을 Fetch Call 3,334번으로 가져왔으므로 한 번에 약 15건씩(SQL*Plus 기본 arraysize = 15) 전송했다. arraysize를 키우면 Fetch Call 수가 줄고, 같은 블록을 반복해서 읽는 횟수도 줄어 query 값이 감소한다. 자세한 내용은 [고급 SQL 활용](/theory/advanced-sql)과 [배치 프로그램 튜닝](/theory/batch-tuning)을 참고한다.

## DBMS_XPLAN.DISPLAY_CURSOR

라이브러리 캐시에 남아 있는 커서의 **실제 실행계획**과 **오퍼레이션별 수행 통계**를 보여 준다. 트레이스 파일을 만들 필요가 없어 편리하다.

```sql
-- 1. 수행 통계를 수집하며 실행
SELECT /*+ GATHER_PLAN_STATISTICS */ *
FROM   EMP E, DEPT D
WHERE  D.DEPTNO = E.DEPTNO
AND    E.SAL >= 2000;

-- 2. 직전에 수행한 SQL의 실제 계획과 통계 조회
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'ALLSTATS LAST'));

-- 특정 SQL 지정: SQL_ID, CHILD_NUMBER
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('9babjv8yq8ru3', 0, 'ALLSTATS LAST'));
```

::: info 수행 통계 수집 방법
오퍼레이션별 실측 통계를 보려면 다음 중 하나가 필요하다.
- SQL에 `/*+ GATHER_PLAN_STATISTICS */` 힌트 사용
- 세션 또는 시스템 수준에서 `STATISTICS_LEVEL = ALL` 설정
- `_ROWSOURCE_EXECUTION_STATISTICS = TRUE` 설정 (히든 파라미터)
- SQL 트레이스 활성화

조회하려면 `V$SESSION`, `V$SQL`, `V$SQL_PLAN`, `V$SQL_PLAN_STATISTICS_ALL` 뷰에 대한 조회 권한이 필요하다.
:::

### 출력 예와 항목

```text
-----------------------------------------------------------------------------------------
| Id  | Operation                    | Name    | Starts | E-Rows | A-Rows |   A-Time   | Buffers | Reads |
-----------------------------------------------------------------------------------------
|   0 | SELECT STATEMENT             |         |      1 |        |     12 |00:00:00.01 |      15 |     2 |
|   1 |  NESTED LOOPS                |         |      1 |        |     12 |00:00:00.01 |      15 |     2 |
|   2 |   NESTED LOOPS               |         |      1 |      9 |     12 |00:00:00.01 |       5 |     1 |
|*  3 |    TABLE ACCESS FULL         | EMP     |      1 |      9 |     12 |00:00:00.01 |       3 |     0 |
|*  4 |    INDEX UNIQUE SCAN         | DEPT_PK |     12 |      1 |     12 |00:00:00.01 |       2 |     1 |
|   5 |   TABLE ACCESS BY INDEX ROWID| DEPT    |     12 |      1 |     12 |00:00:00.01 |      10 |     1 |
-----------------------------------------------------------------------------------------
```

| 항목 | 의미 | 대응 (TKPROF) |
|---|---|---|
| **Starts** | 오퍼레이션 수행 횟수 | |
| **E-Rows** | 옵티마이저가 예상한 건수 (Starts **1회당**) | |
| **A-Rows** | 실제 처리 건수 (전체 Starts 합계) | Rows |
| **A-Time** | 실제 소요 시간 | time |
| **Buffers** | 논리적 블록 읽기 수 | cr (query + current) |
| **Reads** | 디스크 블록 읽기 수 | pr (disk) |
| Writes | 디스크 블록 쓰기 수 | pw |
| OMem / 1Mem / Used-Mem | 정렬·해시 작업의 메모리 사용량 (Optimal / One-pass / 실제) | |

::: warning 해석할 때 주의할 점
- **A-Rows, Buffers, Reads, A-Time은 자식 값을 포함한 누적치**다. Id 5의 실제 블록 읽기는 10, Id 2의 Buffers 5는 Id 3(3)과 Id 4(2)의 합이다.
- **E-Rows는 1회 수행 기준**이다. Id 4는 Starts 12 × E-Rows 1 = 12와 A-Rows 12를 비교해야 한다.
- 포맷 `ALLSTATS LAST`는 **마지막 실행** 통계, `ALLSTATS`만 쓰면 **누적 실행** 통계를 보여 준다. `IOSTATS`는 I/O 관련 항목, `MEMSTATS`는 메모리 관련 항목만 보여 준다.
:::

### E-Rows와 A-Rows 비교

E-Rows(×Starts)와 A-Rows가 크게 차이 나면 옵티마이저의 **카디널리티 추정이 잘못된 것**이다. 잘못된 추정은 잘못된 조인 순서, 조인 방식, 인덱스 선택으로 이어진다. 원인으로는 오래된 통계정보, 히스토그램 부재, 컬럼 간 상관관계, 바인드 변수 등이 있다. [옵티마이저](/theory/optimizer)에서 자세히 다룬다.

> 시험 포인트: DISPLAY_CURSOR로 오퍼레이션별 실측 통계를 보려면 gather_plan_statistics 힌트(또는 statistics_level = all)가 필요하다. E-Rows는 예상치, A-Rows는 실측치이며 Buffers는 논리적 I/O다.

## 도구 비교

| 구분 | 예상 실행계획 | AutoTrace | SQL 트레이스 (TKPROF) | DISPLAY_CURSOR |
|---|---|---|---|---|
| SQL 실제 실행 | X | O (TRACEONLY EXPLAIN 제외) | O | O |
| 실제 실행계획 | X | X (예상 계획 표시) | O | O |
| 전체 실행 통계 | X | O | O (Call 단위) | O |
| 오퍼레이션별 실측치 | X | X | O | O |
| 대기 이벤트 | X | X | O (10046 레벨 8, 12) | X |
| 파일 생성 | 불필요 | 불필요 | 필요 | 불필요 |

## 응답 시간 분석과 대기 이벤트

### 대기 이벤트란

프로세스가 일을 계속하지 못하고 **다른 무언가를 기다려야 할 때**, 그 원인과 시간을 기록한 것이 <strong>대기 이벤트(Wait Event)</strong>다. 디스크 I/O, 락, 래치, 네트워크 등 공유 자원을 기다리는 시간이 여기에 해당한다. Oracle은 대기 이벤트를 `V$SYSTEM_EVENT`, `V$SESSION_EVENT`, `V$SESSION_WAIT` 등의 뷰로 제공한다.

### 응답 시간 분석 (Response Time Analysis)

```text
Response Time = Service Time + Wait Time
              = CPU Time     + Queue Time
```

::: compare
- **비율 기반 분석 (Ratio-based)** 버퍼캐시 히트율, 라이브러리 캐시 히트율 같은 **효율성 지표**로 시스템 상태를 진단. 수치가 좋아도 실제 병목을 놓칠 수 있다.
- **응답 시간 분석 (Response Time Analysis)** 응답 시간을 CPU 시간과 대기 시간으로 나누고, **시간을 가장 많이 쓴 대기 이벤트**를 찾아 원인을 해소하는 방법론.
:::

TKPROF에서 elapsed가 cpu보다 훨씬 크면 대기 시간이 많은 것이다. 10046 트레이스 레벨 8 이상으로 수집하면 리포트에 대기 이벤트 내역이 나온다.

```text
Elapsed times include waiting on following events:
  Event waited on                             Times   Max. Wait  Total Waited
  ----------------------------------------   Waited  ----------  ------------
  SQL*Net message to client                       2        0.00          0.00
  db file scattered read                         24        0.03          0.33
  SQL*Net message from client                     2        0.01          0.01
```

위 예는 Full Scan의 Multiblock I/O 대기(`db file scattered read`)가 전체 시간의 대부분을 차지한다.

### 대표적인 대기 이벤트

| 대기 이벤트 | 의미 |
|---|---|
| `db file sequential read` | **Single Block I/O** 대기 (인덱스 스캔, ROWID 테이블 액세스) |
| `db file scattered read` | **Multiblock I/O** 대기 (Table Full Scan, Index Fast Full Scan) |
| `direct path read` / `direct path write` | 버퍼 캐시를 거치지 않는 I/O (병렬 쿼리 Full Scan, Temp 정렬 등) |
| `direct path read temp` / `write temp` | 정렬·해시 작업이 PGA를 넘어 Temp 테이블스페이스 사용 |
| `log file sync` | 커밋 시 LGWR가 리두를 기록할 때까지 대기. 커밋이 너무 잦으면 증가 |
| `enq: TX - row lock contention` | 다른 트랜잭션이 갱신 중인 로우의 Lock 대기 |
| `latch: cache buffers chains` | 같은 블록을 동시에 과도하게 읽어 캐시버퍼 체인 래치 경합 |
| `latch: shared pool`, `library cache lock` 등 | 하드 파싱 과다에 따른 공유 풀·라이브러리 캐시 경합 |
| `buffer busy waits` | 다른 세션이 읽거나 변경 중인 버퍼를 기다림 |
| `SQL*Net message from client` | 클라이언트의 다음 요청을 기다림. **유휴(Idle) 이벤트**로 보통 무시 |

::: tip 대기 이벤트로 원인 짐작하기
- `db file sequential read`가 많다 → 인덱스를 통한 **랜덤 액세스**가 과도 → 인덱스 구성, 클러스터링 팩터, 조인 방식 점검
- `log file sync`가 많다 → 루프 안에서 건건이 커밋 → 커밋 주기 조정, 일괄 처리
- `latch: shared pool`, `library cache` 관련 대기가 많다 → 리터럴 SQL로 인한 **하드 파싱** → 바인드 변수 사용 ([SQL 처리 과정](/theory/sql-processing))
- `enq: TX - row lock contention`이 많다 → Lock 경합 → [Lock](/theory/lock)과 트랜잭션 설계 점검
:::

### AWR와 Statspack

시스템 전체의 대기 이벤트와 성능 지표는 **AWR(Automatic Workload Repository)** 또는 **Statspack**으로 분석한다. 일정 주기로 동적 성능 뷰를 스냅샷으로 저장하고, 두 시점 사이의 차이(Delta)를 리포트로 만든다. 리포트의 **Top 5 Timed Events**(Top Timed Foreground Events)가 응답 시간 분석의 출발점이다.

> 시험 포인트: db file sequential read는 Single Block I/O, db file scattered read는 Multiblock I/O다. 응답 시간 = CPU 시간(Service Time) + 대기 시간(Queue Time)이며, 응답 시간 분석은 가장 많은 시간을 차지한 대기 이벤트부터 해결한다.

## 핵심 요약

- AutoTrace는 실행계획과 SQL 전체 실행 통계를 보여 준다. 논리적 I/O = db block gets + consistent gets, 물리적 I/O = physical reads.
- SQL 트레이스는 `ALTER SESSION SET SQL_TRACE = TRUE` 또는 10046 이벤트로 수집하고 TKPROF로 포맷팅한다.
- TKPROF는 Parse·Execute·Fetch Call별로 count, cpu, elapsed, disk, query, current, rows를 보여 준다.
- query = consistent gets, current = db block gets, disk = physical reads이며 논리적 I/O는 query + current다.
- Misses in library cache during parse가 1이면 하드 파싱이 발생한 것이다.
- Row Source의 cr·pr·time, DISPLAY_CURSOR의 A-Rows·Buffers·A-Time은 자식 값을 포함한 누적치다.
- DISPLAY_CURSOR로 실측치를 보려면 gather_plan_statistics 힌트 또는 statistics_level = all이 필요하고, 'ALLSTATS LAST'는 마지막 실행 통계다.
- E-Rows는 1회당 예상 건수이므로 Starts를 곱해 A-Rows와 비교한다. 차이가 크면 카디널리티 추정 오류다.
- 응답 시간 = CPU 시간 + 대기 시간이며, 대기 이벤트를 분석해 병목 원인을 찾는다.
