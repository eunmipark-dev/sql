---
title: 테이블 액세스 최소화
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-3. 인덱스 튜닝
summary: 랜덤 액세스 비용, 클러스터링 팩터, 손익분기점과 커버드 인덱스·IOT로 테이블 액세스 줄이기
---

# 테이블 액세스 최소화

인덱스를 Range Scan 했더라도 **테이블 랜덤 액세스**가 많으면 성능이 나쁘다. SQL 튜닝은 결국 랜덤 I/O와의 싸움이며, 인덱스 튜닝에서 가장 중요한 목표 중 하나가 테이블 액세스 횟수를 줄이는 것이다.

## Table Access By Index ROWID의 비용

```text
| Id | Operation                   | Name    | Starts | A-Rows | Buffers |
|  0 | SELECT STATEMENT            |         |      1 |     50 |     520 |
|  1 |  TABLE ACCESS BY INDEX ROWID| 고객     |      1 |     50 |     520 |
|* 2 |   INDEX RANGE SCAN          | 고객_X1  |      1 |   1000 |      12 |
```

위 실행계획에서 인덱스는 12블록만 읽었지만, 테이블 액세스에서 약 500블록을 읽고 1000건 중 50건만 남겼다. 비용 대부분이 **ROWID에 의한 테이블 액세스**에서 발생했다.

::: info ROWID 액세스가 비싼 이유
ROWID는 메모리 주소가 아니라 디스크 상의 **논리적 주소**다. ROWID로 테이블 블록을 읽으려면 다음 과정을 거친다.

1. ROWID에서 데이터 블록 주소(DBA)를 얻는다.
2. DBA를 해시 함수에 넣어 해시 체인을 찾는다 (래치 획득).
3. 체인을 따라가며 버퍼 헤더를 찾는다.
4. 버퍼 헤더가 있으면 버퍼 블록을 읽고(버퍼 Pin), 없으면 디스크에서 **Single Block I/O**로 읽어 캐시에 적재한다.
:::

인덱스 ROWID 하나당 테이블 블록을 **한 번씩 랜덤 액세스**하므로, 인덱스로 읽는 건수가 많아지면 성능이 급격히 나빠진다. 버퍼 캐시와 I/O 원리는 [I/O 메커니즘](/theory/io-mechanism)을 참고한다.

> 시험 포인트: 인덱스 ROWID에 의한 테이블 액세스는 **Single Block I/O 방식의 랜덤 액세스**이며, 버퍼 캐시에서 찾더라도 래치·해시 탐색 비용이 든다. "ROWID는 물리 주소이므로 테이블 액세스 비용이 없다"는 틀린 설명이다.

## 클러스터링 팩터

클러스터링 팩터(Clustering Factor, CF)는 **인덱스 키 순서와 테이블 데이터 저장 순서가 얼마나 일치하는지**를 나타내는 지표다.

::: compare
- **CF가 좋다** 인덱스 순으로 읽을 때 같은 테이블 블록이 연속해서 나온다. 직전에 읽은 블록을 다시 읽으므로 **버퍼 Pinning** 효과로 블록 I/O가 줄어든다.
- **CF가 나쁘다** 인덱스 순으로 읽을 때마다 다른 테이블 블록을 가리킨다. 레코드 하나 읽을 때마다 블록 I/O가 발생한다.
:::

- 통계정보 `CLUSTERING_FACTOR` 값이 **테이블 블록 수에 가까울수록 좋고**, **테이블 레코드 수에 가까울수록 나쁘다**.
- CF가 좋은 인덱스는 같은 건수를 읽어도 테이블 액세스 블록 수(Buffers)가 훨씬 적다.
- 옵티마이저는 인덱스 비용 계산에 CF를 사용한다. 대략 `비용 ≈ BLEVEL + 리프 블록 수 × 유효 인덱스 선택도 + CF × 유효 테이블 선택도`이다.

```sql
SELECT INDEX_NAME, CLUSTERING_FACTOR, NUM_ROWS, LEAF_BLOCKS
FROM   USER_INDEXES
WHERE  TABLE_NAME = 'EMP';
```

::: warning CF는 인덱스를 재생성해도 좋아지지 않는다
CF는 **테이블의 데이터 저장 순서**에 달려 있다. 인덱스를 Rebuild해도 변하지 않는다. CF를 높이려면 테이블 데이터를 해당 인덱스 키 순으로 재정렬해 다시 입력해야 하는데, 그러면 다른 인덱스의 CF가 나빠질 수 있어 신중해야 한다.
:::

## 인덱스 손익분기점

인덱스로 읽는 데이터가 일정 수준을 넘으면 Table Full Scan보다 오히려 느려진다. 이 지점을 **인덱스 손익분기점**이라 한다.

::: compare
- **Table Full Scan** 시퀀셜 액세스, **Multiblock I/O**. 읽는 데이터 양과 관계없이 비용이 일정하다.
- **인덱스 + 테이블 액세스** 랜덤 액세스, **Single Block I/O**. 읽는 건수에 비례해 비용이 증가한다.
:::

- 일반적으로 손익분기점은 테이블 전체 건수의 **5~20%** 수준이며, CF가 나쁘면 더 낮아지고(5% 이하) CF가 좋으면 더 높아진다(90%까지도 가능).
- 테이블이 매우 크면(수천만 건 이상) 버퍼 캐시 히트율이 떨어져 손익분기점이 더 낮아진다.

> 시험 포인트: 인덱스는 **소량 데이터 검색**용이다. 대량 데이터를 읽는 배치 프로그램이나 집계 쿼리에서는 Full Scan + 해시 조인이 유리한 경우가 많다. "인덱스를 사용하면 항상 빠르다"는 틀린 문장이다.

## 온라인 처리와 배치 처리

| 구분 | 특징 | 적합한 방식 |
|---|---|---|
| OLTP(온라인) | 소량 데이터를 빠르게 조회, 부분범위 처리 | 인덱스 + NL 조인 |
| 배치·DW | 대량 데이터 일괄 처리, 전체범위 처리 | Full Scan + 해시 조인, 파티션, 병렬 처리 |

대량 처리 프로그램의 튜닝은 [배치 프로그램 튜닝](/theory/batch-tuning), 파티션 활용은 [파티셔닝](/theory/partitioning)을 참고한다.

## 인덱스 컬럼 추가로 테이블 액세스 줄이기

인덱스 액세스 조건만으로 범위를 좁히지 못하고 **테이블에서 필터링되어 버려지는** 건수가 많다면, 그 필터 컬럼을 인덱스에 추가해 테이블 액세스 전에 걸러낸다.

```sql
-- 인덱스: EMP_X01 (DEPTNO, JOB)
SELECT * FROM EMP
WHERE  DEPTNO = 30
AND    SAL >= 2000;
```

```text
| Id | Operation                   | Name    | A-Rows | Buffers |
|* 1 |  TABLE ACCESS BY INDEX ROWID| EMP     |      2 |     267 |
|* 2 |   INDEX RANGE SCAN          | EMP_X01 |    266 |       3 |
Predicate Information
   1 - filter("SAL">=2000)
   2 - access("DEPTNO"=30)
```

인덱스로 266건을 찾아 테이블을 266번 액세스했지만 최종 결과는 2건이다. 인덱스를 `(DEPTNO, JOB, SAL)`로 변경하면 SAL 조건을 **인덱스 단계에서 필터링**하므로 테이블 액세스가 2번으로 줄어든다.

::: tip 컬럼 추가 시 주의
- 기존 인덱스를 **변경**하는 것은 그 인덱스를 쓰던 다른 SQL에 영향을 줄 수 있다. 새 인덱스를 추가하면 인덱스 수가 늘어 DML 부하가 커진다.
- 기존 인덱스 **맨 뒤에 컬럼을 추가**하는 방식이 영향이 가장 적다. 이때 추가된 컬럼은 인덱스 스캔 범위를 줄이지는 못하지만(필터 조건), 테이블 랜덤 액세스는 줄여 준다.
:::

## 커버드 인덱스

쿼리에 필요한 **모든 컬럼을 인덱스가 포함**하면 테이블 액세스가 아예 발생하지 않는다. 이런 인덱스를 커버드 인덱스(Covered Index), 이런 쿼리를 커버드 쿼리라고 한다.

```sql
CREATE INDEX EMP_X02 ON EMP (DEPTNO, SAL, ENAME);

SELECT ENAME, SAL FROM EMP WHERE DEPTNO = 30 AND SAL >= 2000;
```

```text
| Id | Operation        | Name    |
|  0 | SELECT STATEMENT |         |
|* 1 |  INDEX RANGE SCAN| EMP_X02 |
```

실행계획에 `TABLE ACCESS BY INDEX ROWID`가 없다. 인덱스만 읽고 처리를 끝낸다.

::: info SQL Server의 Include 인덱스
SQL Server는 `INCLUDE` 절로 **리프 레벨에만** 컬럼을 추가 저장할 수 있다. 정렬 키가 아니므로 수직적 탐색에는 쓰이지 않고, 테이블(Key Lookup) 액세스를 생략하는 용도다.

```sql
CREATE INDEX EMP_X03 ON EMP (DEPTNO) INCLUDE (SAL, ENAME);
```

Include 컬럼은 수직적 탐색과 소트 연산 생략에는 활용할 수 없다.
:::

## IOT와 클러스터 테이블

테이블 액세스 자체를 없애거나 줄이는 저장 구조도 있다.

::: cards 3
- **IOT (Index-Organized Table)** 테이블을 PK 인덱스 구조로 저장한다. 데이터가 PK 순으로 정렬되어 있어 범위 검색 시 **랜덤 액세스가 없다**. 주로 PK로 범위 조회하는 테이블에 적합하다. INSERT 성능은 떨어진다.
- **인덱스 클러스터 테이블** 클러스터 키 값이 같은 레코드를 **같은 블록**에 모아 저장한다. 클러스터 인덱스는 키 값마다 한 레코드만 갖고 해당 블록을 가리킨다. `=` 조건이나 조인에 유리하다.
- **해시 클러스터 테이블** 클러스터 인덱스 없이 **해시 함수**로 레코드 저장 위치를 결정한다. **`=` 조건 검색만** 가능하고 범위 검색은 불가하다.
:::

```sql
-- 인덱스 클러스터 생성 예
CREATE CLUSTER C_DEPT (DEPTNO NUMBER(2)) INDEX;
CREATE INDEX C_DEPT_IDX ON CLUSTER C_DEPT;
CREATE TABLE DEPT2 (DEPTNO NUMBER(2), DNAME VARCHAR2(14))
CLUSTER C_DEPT (DEPTNO);
```

> 시험 포인트: 일반 B*Tree 인덱스는 키 값마다 레코드가 하나씩(테이블 레코드와 1:1) 있지만, **클러스터 인덱스는 키 값마다 하나**의 레코드만 가진다(1:M). 해시 클러스터는 범위 검색이 불가능하다는 점이 자주 출제된다.

IOT와 클러스터형 인덱스의 기본 구조는 [인덱스 구조와 탐색](/theory/index-structure)을 참고한다.

## 배치 I/O

Oracle 12c부터는 인덱스로 읽은 ROWID를 바로 테이블에 액세스하지 않고 **일정량 모은 뒤 블록 단위로 묶어** 테이블을 액세스하는 배치 I/O 기능이 있다. 실행계획에는 `TABLE ACCESS BY INDEX ROWID BATCHED`로 표시된다.

```text
| Id | Operation                           | Name    |
|  1 |  TABLE ACCESS BY INDEX ROWID BATCHED| EMP     |
|* 2 |   INDEX RANGE SCAN                  | EMP_X01 |
```

- 같은 블록을 가리키는 ROWID를 모아 처리하므로 디스크 랜덤 I/O 횟수가 줄어든다.
- 힌트: `BATCH_TABLE_ACCESS_BY_ROWID`, `NO_BATCH_TABLE_ACCESS_BY_ROWID`

::: warning 배치 I/O와 정렬 순서
배치 I/O가 작동하면 테이블 블록 순으로 레코드를 읽으므로 **결과가 인덱스 순으로 정렬되지 않을 수 있다**. 그래서 인덱스 순서로 소트 연산을 생략하는 실행계획에서는 배치 I/O가 동작하지 않는다. 인덱스 정렬 순서에 기대어 `ORDER BY`를 생략하는 습관은 버려야 하며, 정렬이 필요하면 항상 ORDER BY를 명시한다.
:::

## 핵심 요약

- 인덱스 ROWID에 의한 테이블 액세스는 Single Block I/O 랜덤 액세스이며, 버퍼 캐시 탐색에도 래치·해시 체인 비용이 든다.
- 클러스터링 팩터는 인덱스 순서와 테이블 저장 순서의 일치도로, 테이블 블록 수에 가까울수록 좋다. 인덱스 Rebuild로는 개선되지 않는다.
- 인덱스 손익분기점은 보통 5~20%이며, CF가 나쁘거나 테이블이 클수록 낮아진다.
- 테이블에서 필터링되는 컬럼을 인덱스에 추가하면 랜덤 액세스를 줄일 수 있다.
- 쿼리에 필요한 컬럼이 모두 인덱스에 있으면(커버드 인덱스) 테이블 액세스가 생략된다. SQL Server는 INCLUDE 절을 쓴다.
- IOT는 PK 순 정렬 저장, 인덱스 클러스터는 같은 키를 같은 블록에, 해시 클러스터는 해시 함수로 위치를 정하며 `=` 검색만 가능하다.
- 12c 배치 I/O(BATCHED)는 랜덤 I/O를 줄이지만 결과 정렬 순서를 보장하지 않는다.
