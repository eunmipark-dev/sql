---
title: DML 튜닝
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-6. 고급 SQL 튜닝
summary: DML 성능 요소와 Direct Path Insert·MERGE·Array Processing 활용
---

# DML 튜닝

조회 튜닝이 "얼마나 적게 읽는가"의 문제라면, DML 튜닝은 "변경 한 건마다 **따라붙는 부수 작업**을 얼마나 줄이는가"의 문제다. INSERT, UPDATE, DELETE는 테이블뿐 아니라 인덱스, 제약 조건, Redo, Undo, Lock까지 함께 처리해야 한다. DML 문법은 [DML](/theory/dml)을 참고한다.

## DML 성능에 영향을 미치는 요소

::: cards 2
- **인덱스** 테이블에 행을 하나 넣으면 인덱스마다 엔트리를 하나씩 넣는다. UPDATE는 인덱스에서 **삭제 후 삽입** 두 번의 작업이 일어난다.
- **무결성 제약** PK·FK는 인덱스 탐색이나 다른 테이블 확인이 필요해 CHECK·NOT NULL보다 부하가 크다.
- **조건절·서브쿼리** UPDATE·DELETE도 대상 행을 먼저 찾아야 하므로 조회와 똑같이 인덱스·조인 튜닝이 필요하다.
- **Redo 로깅** 모든 변경은 장애 복구를 위해 Redo 로그에 기록된다.
- **Undo 로깅** 롤백과 읽기 일관성을 위해 변경 전 값을 Undo에 기록한다.
- **Lock** 변경하는 행에 Lock을 걸고, 커밋할 때까지 다른 트랜잭션의 같은 행 변경을 막는다.
- **커밋** 커밋 시 LGWR가 Redo 로그 버퍼를 디스크에 기록할 때까지 기다린다 (log file sync).
- **트리거** 행마다 숨은 SQL이 실행되어 DML 부하가 배가된다.
:::

::: example 인덱스 개수와 INSERT 성능
인덱스가 3개인 테이블에 1건을 INSERT하면 테이블 블록 1곳과 인덱스 리프 블록 3곳을 변경한다. 인덱스는 정렬 상태를 유지해야 하므로 들어갈 위치를 수직 탐색으로 찾아야 하고, 블록이 꽉 차면 <strong>인덱스 분할(Split)</strong>까지 발생한다. 대량 적재 시 인덱스 수가 성능을 좌우한다.
:::

> 시험 포인트: UPDATE는 변경된 컬럼을 포함한 인덱스만 영향받지만, INSERT·DELETE는 **모든 인덱스**에 영향을 준다. 또 UPDATE는 인덱스 입장에서 Delete + Insert 두 번이다.

Lock과 트랜잭션은 [Lock](/theory/lock), [트랜잭션 격리 수준](/theory/transaction-isolation)에서 자세히 다룬다.

## 커밋과 커밋 빈도

커밋은 트랜잭션 완료를 확정하는 작업으로, Redo 로그 버퍼를 디스크에 기록(LGWR)하는 동안 서버 프로세스가 대기한다. 데이터 블록 자체는 DBWR이 나중에 기록한다(Fast Commit).

::: compare
- **너무 자주 커밋** 건마다 커밋하면 log file sync 대기가 건수만큼 발생해 성능이 크게 떨어진다. 중간에 실패하면 일부만 반영된 상태가 남는다.
- **너무 드물게 커밋** Undo 공간을 오래 점유하고, Lock을 오래 잡아 동시성이 떨어진다. 롤백 비용도 커진다.
:::

대량 배치는 **업무적으로 의미 있는 단위**로 커밋하되, 가능하면 [One SQL](/theory/batch-tuning)로 처리해 커밋 횟수 자체를 줄인다.

::: info 비동기 커밋 (10gR2+)
`COMMIT WRITE BATCH NOWAIT`처럼 LGWR 기록을 기다리지 않는 비동기 커밋 옵션이 있다. 빠르지만 장애 시 커밋된 데이터가 유실될 수 있어 일반적인 트랜잭션에는 쓰지 않는다.
:::

## Array Processing

Array Processing은 한 번의 DB Call로 **여러 건을 묶어** 처리하는 기능이다. 건마다 SQL을 실행하면 Call 횟수만큼 네트워크 왕복과 SQL·PL/SQL 엔진 간 컨텍스트 스위칭이 발생한다.

```sql
DECLARE
  TYPE t_ids IS TABLE OF 주문.주문번호%TYPE;
  l_ids t_ids;
  CURSOR c IS SELECT 주문번호 FROM 주문_임시;
BEGIN
  OPEN c;
  LOOP
    FETCH c BULK COLLECT INTO l_ids LIMIT 1000;   -- 1000건씩 읽기
    EXIT WHEN l_ids.COUNT = 0;
    FORALL i IN 1 .. l_ids.COUNT                  -- 1000건을 한 번에 처리
      UPDATE 주문 SET 처리상태 = 'Y'
      WHERE  주문번호 = l_ids(i);
    COMMIT;
  END LOOP;
  CLOSE c;
END;
/
```

Java에서는 JDBC의 `addBatch()` / `executeBatch()`로 같은 효과를 낸다. Call 횟수와 컨텍스트 스위칭이 줄어 대량 DML 성능이 크게 좋아진다. 단, 근본적으로는 루프 없이 하나의 SQL로 처리하는 것이 가장 빠르다.

## Direct Path Insert

일반 INSERT(Conventional Path)는 Freelist에서 빈 공간이 있는 블록을 찾고, 버퍼 캐시에서 블록을 읽어 한 건씩 기록하며, 모든 변경에 Undo와 Redo를 남긴다. Direct Path Insert는 이 과정을 생략한다.

::: compare
- **Conventional Insert** Freelist로 빈 블록을 찾아 재사용한다. 버퍼 캐시를 거치고 Undo·Redo를 모두 생성한다.
- **Direct Path Insert** HWM 위쪽 새 블록에 **순차적으로 직접** 기록한다. 버퍼 캐시를 거치지 않고, 테이블 데이터에 대한 Undo를 생성하지 않는다.
:::

Direct Path Insert로 동작하는 방법은 다음과 같다.

| 방법 | 예 |
|---|---|
| APPEND 힌트 | `INSERT /*+ APPEND */ INTO 주문_백업 SELECT * FROM 주문 WHERE ...` |
| APPEND_VALUES 힌트 (11gR2+) | VALUES 절 INSERT, 주로 FORALL 배열 INSERT에서 사용 |
| CTAS | `CREATE TABLE 주문_백업 AS SELECT ...` |
| 병렬 INSERT | 병렬 DML로 수행하는 INSERT ... SELECT |
| SQL*Loader | `direct=TRUE` 옵션 |

```sql
ALTER TABLE 주문_이력 NOLOGGING;

INSERT /*+ APPEND */ INTO 주문_이력
SELECT * FROM 주문 WHERE 주문일자 < '20240101';

COMMIT;     -- 커밋 전에는 같은 세션도 이 테이블을 조회·변경할 수 없다
```

```text
--------------------------------------------------
| Id | Operation                    | Name      |
--------------------------------------------------
|  0 | INSERT STATEMENT             |           |
|  1 |  LOAD AS SELECT              | 주문_이력  |
|  2 |   TABLE ACCESS FULL          | 주문       |
--------------------------------------------------
```

실행계획에 `LOAD AS SELECT`가 나오면 Direct Path, `LOAD TABLE CONVENTIONAL`이 나오면 일반 INSERT다.

::: warning Direct Path Insert 주의점
- 대상 테이블에 **배타적 TM Lock**(Exclusive)이 걸려 다른 트랜잭션은 그 테이블에 DML을 할 수 없다. 커밋할 때까지 유지된다.
- 커밋 전에 같은 세션이 해당 테이블을 조회·변경하면 ORA-12838 에러가 발생한다.
- HWM 위에만 쓰므로 DELETE로 생긴 빈 공간을 **재사용하지 않는다**. 반복하면 테이블이 계속 커진다.
- APPEND 힌트는 `INSERT ... SELECT`에서만 작동한다. `INSERT /*+ APPEND */ ... VALUES`는 일반 INSERT로 처리된다(VALUES는 APPEND_VALUES).
:::

> 시험 포인트: Direct Path Insert의 특징은 "Freelist 미사용, HWM 위 순차 기록, 버퍼 캐시 미경유, Undo 미생성, NOLOGGING 시 Redo 최소화, 테이블 Exclusive Lock"이다. "동시 DML이 가능하다", "빈 공간을 재사용한다"는 틀린 보기로 나온다.

## NOLOGGING

테이블을 NOLOGGING 모드로 바꾸면 **Direct Path 작업**에서 Redo 생성을 최소화한다.

```sql
ALTER TABLE 주문_이력 NOLOGGING;
```

::: warning NOLOGGING의 오해
- NOLOGGING은 **Direct Path Insert, CTAS, CREATE/ALTER INDEX ... REBUILD** 같은 작업에만 효과가 있다.
- 일반 INSERT, UPDATE, DELETE는 NOLOGGING 테이블이어도 **항상 Redo를 생성한다**. UPDATE·DELETE를 NOLOGGING으로 빠르게 할 방법은 없다.
- NOLOGGING으로 적재한 데이터는 미디어 복구가 불가능하므로 작업 후 백업이 필요하다. DB가 FORCE LOGGING 모드면 무시된다.
:::

## 수정 가능 조인 뷰

다른 테이블 값으로 UPDATE할 때 상관 서브쿼리를 쓰면 같은 테이블을 여러 번 읽게 된다.

```sql
-- 비효율: 거래 테이블을 SET 절과 WHERE 절에서 두 번 읽는다
UPDATE 고객 C
SET   (최종거래일시, 최근거래금액) =
      (SELECT MAX(거래일시), SUM(거래금액)
       FROM   거래
       WHERE  고객번호 = C.고객번호
       AND    거래일시 >= TRUNC(ADD_MONTHS(SYSDATE, -1)))
WHERE  EXISTS (SELECT 'x' FROM 거래
               WHERE  고객번호 = C.고객번호
               AND    거래일시 >= TRUNC(ADD_MONTHS(SYSDATE, -1)));
```

<strong>수정 가능 조인 뷰(Updatable Join View)</strong>를 쓰면 조인 결과를 한 번에 UPDATE할 수 있다.

```sql
UPDATE (SELECT E.SAL, E.COMM, D.LOC
        FROM   EMP E, DEPT D
        WHERE  E.DEPTNO = D.DEPTNO)
SET    COMM = SAL * 0.1
WHERE  LOC = 'CHICAGO';
```

### 키 보존 테이블

조인 뷰에서 수정할 수 있는 컬럼은 <strong>키 보존 테이블(Key-Preserved Table)</strong>의 컬럼뿐이다. 키 보존 테이블이란 조인된 결과에서도 원래 테이블의 키(유일성)가 그대로 유지되는 테이블이다.

::: steps
1. **DEPT.DEPTNO에 PK(Unique 인덱스)가 있다** EMP 한 행은 DEPT와 최대 한 건만 조인된다
2. **EMP 행은 조인 후에도 중복되지 않는다** 따라서 EMP가 키 보존 테이블이고 EMP 컬럼을 수정할 수 있다
3. **DEPT 행은 EMP 수만큼 반복된다** DEPT는 키 보존 테이블이 아니므로 `SET LOC = ...`는 ORA-01779 에러
:::

> 시험 포인트: 조인 뷰 UPDATE가 가능하려면 <strong>조인 상대 테이블의 조인 컬럼에 Unique 제약(PK·Unique 인덱스)</strong>이 있어야 한다. 데이터상 1:1이어도 제약이 없으면 옵티마이저는 키 보존을 인정하지 않아 ORA-01779가 발생한다.

## MERGE문 활용

MERGE는 대상 테이블에 조인 결과가 있으면 UPDATE, 없으면 INSERT를 한 번에 수행한다(9i). 10g부터 UPDATE·INSERT 중 하나만 쓰거나, 조건절과 DELETE 절을 추가할 수 있다.

```sql
MERGE INTO 고객 T
USING (SELECT 고객번호, MAX(거래일시) 최종거래일시, SUM(거래금액) 거래금액
       FROM   거래
       WHERE  거래일시 >= TRUNC(ADD_MONTHS(SYSDATE, -1))
       GROUP  BY 고객번호) S
ON    (T.고객번호 = S.고객번호)
WHEN MATCHED THEN
  UPDATE SET T.최종거래일시 = S.최종거래일시,
             T.최근거래금액 = S.거래금액
  WHERE  T.고객상태코드 <> 'X'                 -- 10g: 조건부 UPDATE
  DELETE WHERE T.탈퇴일시 IS NOT NULL          -- 10g: UPDATE된 행 중 조건 만족 시 삭제
WHEN NOT MATCHED THEN
  INSERT (고객번호, 최종거래일시, 최근거래금액)
  VALUES (S.고객번호, S.최종거래일시, S.거래금액);
```

::: info MERGE 규칙
- ON 절에 사용한 컬럼은 UPDATE SET에서 변경할 수 없다(ORA-38104).
- DELETE WHERE 절은 **MATCHED로 UPDATE된 행**에 대해서만 평가된다.
- USING 집합의 같은 키가 여러 건이면 대상 행을 여러 번 갱신하게 되어 에러(ORA-30926)가 난다.
- 조인 뷰 UPDATE에서 키 보존 조건 때문에 막힐 때 MERGE의 UPDATE 절만 사용하는 방식으로 대체할 수 있다.
:::

## 대량 UPDATE·DELETE와 인덱스

대량의 행을 변경할 때는 인덱스 유지 비용이 테이블 변경 비용보다 커지기 쉽다. 변경 비율이 크면 **인덱스를 Unusable로 만든 뒤 DML을 하고, 마지막에 재생성**하는 편이 빠르다.

```sql
ALTER INDEX 거래_X01 UNUSABLE;
ALTER INDEX 거래_X02 UNUSABLE;

ALTER SESSION SET SKIP_UNUSABLE_INDEXES = TRUE;   -- 10g 이후 기본값 TRUE

UPDATE 거래 SET 정산상태 = 'C' WHERE 거래일자 < '20240101';
COMMIT;

ALTER INDEX 거래_X01 REBUILD NOLOGGING;
ALTER INDEX 거래_X02 REBUILD NOLOGGING;
```

::: warning Unique 인덱스는 Unusable로 둘 수 없다
PK 등 제약을 강제하는 Unique 인덱스가 Unusable이면 DML이 에러를 낸다. 이때는 제약을 비활성화(DISABLE)하고 인덱스를 삭제한 뒤 작업 후 다시 활성화한다.
:::

DELETE는 대상이 대부분이라면 **남길 데이터만 새 테이블로 옮기는** 방식이 더 빠르다.

::: flow
- **CTAS** 남길 데이터만 `CREATE TABLE ... NOLOGGING AS SELECT`
- **교체** 원본 TRUNCATE 후 Direct Path로 다시 적재하거나 테이블 RENAME
- **인덱스** 인덱스·제약 재생성
:::

파티션 테이블이라면 [파티션 활용](/theory/partitioning)의 TRUNCATE·DROP·Exchange 방식을 우선 고려한다.

## 핵심 요약

- DML 성능은 인덱스 수, 무결성 제약, 트리거, Redo·Undo, Lock, 커밋 빈도의 영향을 받는다.
- INSERT·DELETE는 모든 인덱스를, UPDATE는 변경 컬럼을 포함한 인덱스를 Delete + Insert로 갱신한다.
- 건마다 커밋하면 log file sync 대기가 커지고, 너무 드물면 Undo·Lock 부담이 커진다.
- Array Processing(BULK COLLECT, FORALL, JDBC Batch)은 Call 횟수와 컨텍스트 스위칭을 줄인다.
- Direct Path Insert(APPEND, CTAS, 병렬 INSERT)는 HWM 위에 버퍼 캐시를 거치지 않고 기록하며 Undo를 만들지 않지만 테이블에 Exclusive Lock을 건다.
- NOLOGGING은 Direct Path 작업에만 효과가 있고, 일반 DML은 항상 Redo를 남긴다.
- 조인 뷰는 키 보존 테이블의 컬럼만 수정할 수 있으며, 상대 테이블 조인 컬럼에 Unique 제약이 필요하다.
- MERGE로 UPDATE·INSERT·DELETE를 한 번에 처리하고, ON 절 컬럼은 수정할 수 없다.
- 대량 변경 시 인덱스를 Unusable로 만든 뒤 작업하고 재생성하며, 대량 삭제는 남길 데이터를 옮기는 방식이 빠르다.
