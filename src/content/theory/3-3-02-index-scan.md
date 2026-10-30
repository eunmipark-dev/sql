---
title: 인덱스 스캔 방식
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-3. 인덱스 튜닝
summary: Range·Full·Unique·Skip·Fast Full Scan의 조건과 Range Scan이 불가능한 경우
---

# 인덱스 스캔 방식

옵티마이저는 조건절과 인덱스 구성에 따라 여러 인덱스 스캔 방식 중 하나를 고른다. 각 방식이 **언제 선택되는지**, 그리고 **언제 인덱스를 정상적으로(Range Scan으로) 쓸 수 없는지**가 시험의 핵심이다. 인덱스 구조는 [인덱스 구조와 탐색](/theory/index-structure)을 먼저 참고한다.

## 스캔 방식 한눈에 보기

| 방식 | 탐색 | 결과 정렬 | 주요 조건 |
|---|---|---|---|
| Index Range Scan | 수직 + 수평(일부) | 보장 | 선두 컬럼이 가공되지 않은 조건으로 사용 |
| Index Full Scan | 수직(맨 왼쪽) + 리프 전체 | 보장 | 선두 컬럼 조건 없음, 인덱스로 처리 가능 |
| Index Unique Scan | 수직만 | - | Unique 인덱스 전 컬럼을 `=` 조건 |
| Index Skip Scan | 수직 반복 + 일부 수평 | 보장 | 선두 컬럼 조건 없음, 선두 컬럼 Distinct 값이 적음 |
| Index Fast Full Scan | 세그먼트 전체 Multiblock I/O | **보장 안 됨** | 필요한 컬럼이 모두 인덱스에 있음 |
| Index Range Scan Descending | 뒤에서부터 수평 | 역순 보장 | 내림차순 정렬 요구, MAX 값 |

## Index Range Scan

B*Tree 인덱스의 **가장 일반적인** 액세스 방식이다. 루트에서 리프까지 수직적 탐색 후, 필요한 범위만 수평적 탐색한다.

```sql
CREATE INDEX EMP_DEPTNO_IDX ON EMP (DEPTNO);

SELECT * FROM EMP WHERE DEPTNO = 20;
```

```text
| Id | Operation                           | Name           |
|  0 | SELECT STATEMENT                    |                |
|  1 |  TABLE ACCESS BY INDEX ROWID BATCHED| EMP            |
|* 2 |   INDEX RANGE SCAN                  | EMP_DEPTNO_IDX |
```

::: info Range Scan의 성능
- 인덱스를 Range Scan 하려면 **선두 컬럼을 가공하지 않은 상태로** 조건절에 사용해야 한다.
- 그러나 "Range Scan이 나왔다 = 튜닝 끝"이 아니다. 성능은 **인덱스 스캔 범위**와 **테이블 액세스 횟수**를 얼마나 줄였느냐로 결정된다.
:::

## Index Full Scan

수직적 탐색 없이(정확히는 맨 왼쪽 리프까지만 내려가) **리프 블록 전체를 처음부터 끝까지** 수평 탐색한다.

```sql
CREATE INDEX EMP_IDX ON EMP (ENAME, SAL);

SELECT * FROM EMP WHERE SAL > 2000 ORDER BY ENAME;
```

```text
| Id | Operation                   | Name    |
|  0 | SELECT STATEMENT            |         |
|  1 |  TABLE ACCESS BY INDEX ROWID| EMP     |
|* 2 |   INDEX FULL SCAN           | EMP_IDX |
Predicate Information
   2 - filter("SAL">2000)
```

- 선두 컬럼(ENAME)이 조건절에 없어 Range Scan이 불가능할 때, 차선책으로 선택된다.
- 테이블보다 인덱스가 훨씬 작으므로, 인덱스 전체를 읽어 **필터링 후 소량만** 테이블을 액세스하면 Table Full Scan보다 유리할 수 있다.
- 결과 집합이 인덱스 순으로 **정렬**된다. 위 예처럼 `ORDER BY ENAME`의 소트 연산을 생략하기 위해, 또는 `first_rows` 모드에서 부분범위 처리를 위해 선택되기도 한다.

::: warning 대량 데이터 + Index Full Scan
`SAL > 1000`처럼 대부분의 행이 조건을 만족하면, Index Full Scan 후 거의 모든 행을 테이블 랜덤 액세스하게 되어 Table Full Scan보다 훨씬 느리다. 부분범위 처리로 앞쪽 일부만 보고 멈출 때만 유리하다.
:::

## Index Unique Scan

**수직적 탐색만으로** 데이터를 찾는다. Unique 인덱스를 `=` 조건으로 탐색할 때 동작한다.

```sql
CREATE UNIQUE INDEX PK_EMP ON EMP (EMPNO);

SELECT ENAME FROM EMP WHERE EMPNO = 7788;
```

```text
| Id | Operation                   | Name   |
|  1 |  TABLE ACCESS BY INDEX ROWID| EMP    |
|* 2 |   INDEX UNIQUE SCAN         | PK_EMP |
```

> 시험 포인트: Unique 결합 인덱스라도 **일부 컬럼만** `=` 조건으로 검색하거나, 범위 조건(BETWEEN, 부등호, LIKE)으로 검색하면 Index Unique Scan이 아니라 **Index Range Scan**으로 처리된다. 예: PK가 (주문일자, 주문번호)인데 주문일자만 조건으로 주면 Range Scan.

## Index Skip Scan

Oracle 9i부터 도입되었다. 인덱스 **선두 컬럼이 조건절에 없어도** 인덱스를 활용하는 방식이다. 루트·브랜치 블록 정보로 조건을 만족할 **가능성이 있는 리프 블록만 골라** 액세스하고 나머지는 건너뛴다.

```sql
CREATE INDEX 사원_IDX ON 사원 (성별, 연봉);

SELECT * FROM 사원 WHERE 연봉 BETWEEN 2000 AND 4000;
```

```text
| Id | Operation                   | Name    |
|  1 |  TABLE ACCESS BY INDEX ROWID| 사원     |
|* 2 |   INDEX SKIP SCAN           | 사원_IDX |
```

내부적으로 `성별='남' AND 연봉 BETWEEN ...`과 `성별='여' AND 연봉 BETWEEN ...` 두 범위를 각각 찾아가는 것과 비슷하게 동작한다.

::: cards 2
- **효과적인 경우** 선두 컬럼의 **Distinct Value 개수가 적고**, 후행 컬럼의 Distinct Value 개수가 많을 때
- **비효율적인 경우** 선두 컬럼의 Distinct Value가 많으면 건너뛸 블록이 적어 Full Scan과 다를 바 없다
:::

- 선두 컬럼에 **부등호·BETWEEN·LIKE 같은 범위 조건**이 있고 중간 컬럼 조건이 없을 때도 Skip Scan을 쓸 수 있다. 예: 인덱스 `(일자, 업종, 지역)`에 `일자 BETWEEN ... AND 지역 = ...`.
- 선두 컬럼의 값 목록이 적고 명확하다면, `성별 IN ('남', '여')`처럼 조건을 명시해 IN-List Iterator로 처리하는 방법도 있다. Skip Scan은 옵티마이저 판단에 의존하므로 이 방식이 더 확실하다.
- 힌트: `INDEX_SS(테이블 인덱스)`, `NO_INDEX_SS`

> 시험 포인트: Index Skip Scan은 "선두 컬럼이 조건절에 없을 때"도 사용 가능하며, **선두 컬럼의 카디널리티가 낮을수록** 효과적이다. "선두 컬럼 Distinct 값이 많을수록 유리하다"는 보기는 틀리다.

## Index Fast Full Scan

인덱스 트리 구조를 무시하고 **인덱스 세그먼트 전체를 Multiblock I/O로** 빠르게 읽는다. Table Full Scan과 같은 방식으로 인덱스를 읽는 것이다.

```sql
CREATE INDEX EMP_IDX ON EMP (ENAME, SAL);

SELECT /*+ INDEX_FFS(EMP EMP_IDX) */ COUNT(*)
FROM   EMP
WHERE  SAL > 2000;
```

```text
| Id | Operation             | Name    |
|  0 | SELECT STATEMENT      |         |
|  1 |  SORT AGGREGATE       |         |
|* 2 |   INDEX FAST FULL SCAN| EMP_IDX |
```

::: compare
- **Index Full Scan** 논리적 순서(리프 링크)대로 읽는다. **Single Block I/O**. 결과가 **인덱스 키 순으로 정렬**된다. 병렬 스캔 불가(파티션 인덱스 제외).
- **Index Fast Full Scan** 물리적으로 저장된 순서대로 읽는다. **Multiblock I/O**. 결과 **정렬이 보장되지 않는다**. **병렬 스캔 가능**. 쿼리에 필요한 컬럼이 **모두 인덱스에 있을 때만** 사용 가능.
:::

- 브랜치 블록도 함께 읽지만 필요 없으므로 버린다.
- 인덱스가 디스크에 많이 있을 때(캐시되지 않았을 때) 효과가 크다.
- 힌트: `INDEX_FFS(테이블 인덱스)`, `NO_INDEX_FFS`

> 시험 포인트: Index Fast Full Scan은 **정렬 순서를 보장하지 않으며**, 인덱스에 없는 컬럼을 하나라도 참조하면 사용할 수 없다. "Index Fast Full Scan 결과는 인덱스 키 순으로 정렬된다"는 틀린 문장이다.

## Index Range Scan Descending

Index Range Scan과 같은 방식이지만 **뒤에서 앞쪽으로** 스캔하여 내림차순 결과를 얻는다.

```sql
SELECT * FROM EMP WHERE EMPNO > 0 ORDER BY EMPNO DESC;
```

```text
| Id | Operation                    | Name   |
|  1 |  TABLE ACCESS BY INDEX ROWID | EMP    |
|* 2 |   INDEX RANGE SCAN DESCENDING| PK_EMP |
```

- 리프 블록이 양방향 연결 리스트라서 가능하다. 내림차순 정렬 요구에 대해 **별도 소트 없이** 결과를 낸다.
- MAX 값을 구할 때 인덱스를 거꾸로 읽어 첫 레코드만 읽고 멈춘다 (**FIRST ROW / MIN/MAX** 처리).

```sql
CREATE INDEX EMP_X02 ON EMP (DEPTNO, SAL);

SELECT DEPTNO, DNAME, LOC,
       (SELECT MAX(SAL) FROM EMP WHERE DEPTNO = D.DEPTNO)
FROM   DEPT D;
```

```text
|  1 |  SORT AGGREGATE              |         |
|  2 |   FIRST ROW                  |         |
|* 3 |    INDEX RANGE SCAN (MIN/MAX)| EMP_X02 |
```

- 힌트: `INDEX_DESC(테이블 인덱스)`

## Index Combine과 기타 방식

::: cards 2
- **Index Combine (Bitmap Conversion)** B*Tree 인덱스 여러 개를 각각 Range Scan한 뒤, ROWID 목록을 **비트맵으로 변환**하여 AND/OR 비트 연산으로 결합한다. 힌트 `INDEX_COMBINE`. 실행계획에 `BITMAP CONVERSION FROM ROWIDS`, `BITMAP AND` 등이 나타난다.
- **Index Join** 한 테이블의 인덱스 여러 개를 해시 조인으로 결합해 테이블 액세스 없이 결과를 만든다. 쿼리에 필요한 컬럼이 두 인덱스에 나뉘어 있을 때 사용. 힌트 `INDEX_JOIN`.
:::

```text
|  1 |  TABLE ACCESS BY INDEX ROWID      | EMP     |
|  2 |   BITMAP CONVERSION TO ROWIDS     |         |
|  3 |    BITMAP AND                     |         |
|  4 |     BITMAP CONVERSION FROM ROWIDS |         |
|* 5 |      INDEX RANGE SCAN             | EMP_X1  |
|  6 |     BITMAP CONVERSION FROM ROWIDS |         |
|* 7 |      INDEX RANGE SCAN             | EMP_X2  |
```

- **IN-List Iterator**: `WHERE DEPTNO IN (10, 20)`은 `=` 조건을 값 개수만큼 반복 수행하는 방식(INLIST ITERATOR)으로 처리된다. 결합 인덱스에서의 활용은 [인덱스 스캔 효율화와 설계](/theory/index-design)에서 다룬다.
- **OR-Expansion**: OR 조건을 UNION ALL 형태로 분기해 각각 인덱스를 사용하게 하는 변환이다(`USE_CONCAT` 힌트). 자세한 내용은 [쿼리 변환](/theory/query-transformation)을 참고한다.

## 인덱스를 Range Scan 할 수 없는 경우

인덱스는 정렬되어 있으므로 **시작점과 끝점을 찾을 수 있어야** Range Scan이 가능하다. 아래 경우는 시작점을 찾을 수 없어 인덱스를 아예 못 쓰거나, Index Full Scan처럼 비효율적으로만 쓸 수 있다.

### 1. 인덱스 선두 컬럼을 가공

```sql
-- 나쁨: 인덱스 컬럼에 함수 적용
WHERE SUBSTR(ENAME, 1, 2) = '김민'
WHERE TO_CHAR(HIREDATE, 'YYYYMMDD') = '20240101'
WHERE SAL * 12 > 50000
WHERE NVL(COMM, 0) < 100

-- 좋음: 컬럼은 그대로 두고 상수 쪽을 변형
WHERE ENAME LIKE '김민%'
WHERE HIREDATE >= TO_DATE('20240101','YYYYMMDD')
  AND HIREDATE <  TO_DATE('20240102','YYYYMMDD')
WHERE SAL > 50000 / 12
```

부득이하게 가공해야 하면 <strong>함수기반 인덱스(FBI)</strong>를 만든다: `CREATE INDEX EMP_X3 ON EMP (UPPER(ENAME));`

### 2. 묵시적 형변환

컬럼과 상수의 데이터 타입이 다르면 DBMS가 자동으로 형변환하는데, 그 대상이 **인덱스 컬럼 쪽**이 되면 컬럼을 가공한 것과 같다.

```sql
-- EMPNO_CHAR는 VARCHAR2 컬럼
WHERE EMPNO_CHAR = 7788
-- 실제 처리: TO_NUMBER(EMPNO_CHAR) = 7788  → 인덱스 Range Scan 불가
```

::: info Oracle 형변환 규칙
- 문자형과 숫자형을 비교하면 **문자형을 숫자형으로** 변환한다.
- 문자형과 날짜형을 비교하면 **문자형을 날짜형으로** 변환한다.
- 단, **LIKE**는 문자 비교 연산자이므로 숫자형 컬럼에 `LIKE`를 쓰면 **숫자형 컬럼이 문자형으로** 변환된다. `WHERE SAL LIKE '30%'`는 `TO_CHAR(SAL) LIKE '30%'`가 되어 Range Scan 불가.
:::

```text
Predicate Information
   1 - filter(TO_NUMBER("EMPNO_CHAR")=7788)
```

실행계획 Predicate Information에 컬럼을 감싼 `TO_NUMBER`, `TO_CHAR`, `INTERNAL_FUNCTION`이 보이면 형변환이 일어난 것이다. 실행계획 읽는 법은 [실행계획](/theory/execution-plan)을 참고한다.

### 3. 부정형 비교

```sql
WHERE DEPTNO <> 30
WHERE DEPTNO != 30
WHERE DEPTNO NOT IN (10, 20)
```

부정형 조건은 범위의 시작점과 끝점을 정할 수 없어 Range Scan이 불가능하다. 인덱스에 필요한 컬럼이 모두 있다면 Index Full Scan이나 Fast Full Scan은 가능하다.

### 4. LIKE 앞에 와일드카드

```sql
WHERE ENAME LIKE '%민'    -- Range Scan 불가 (시작점 없음)
WHERE ENAME LIKE '%민%'   -- Range Scan 불가
WHERE ENAME LIKE '김%'    -- Range Scan 가능
```

### 5. OR 조건

```sql
WHERE (DEPTNO = 10 OR JOB = 'CLERK')
```

서로 다른 컬럼에 대한 OR 조건은 하나의 인덱스로 시작점을 정할 수 없다. 옵티마이저가 **OR-Expansion**으로 UNION ALL 분기를 해야 각각 인덱스를 사용할 수 있다. 같은 컬럼의 OR(`DEPTNO = 10 OR DEPTNO = 20`)는 IN-List로 처리할 수 있다.

### 6. IS NULL 조건

```sql
WHERE COMM IS NULL
```

Oracle은 **모든 인덱스 컬럼이 NULL인 레코드를 인덱스에 저장하지 않으므로** 단일 컬럼 인덱스로 IS NULL 조건을 찾을 수 없다. 단, 다음 경우는 가능하다.

- 해당 컬럼에 **NOT NULL 제약**이 있으면 옵티마이저는 IS NULL 결과가 공집합임을 알고 처리한다.
- 결합 인덱스 `(COMM, EMPNO)`처럼 다른 NOT NULL 컬럼이 포함되어 있으면 NULL 레코드도 저장되어 Range Scan 가능하다.
- `IS NOT NULL` 조건은 단일 컬럼 인덱스에서 Index Full Scan으로 처리할 수 있다.

### 7. 선두 컬럼이 조건절에 없음

인덱스 `(DEPTNO, SAL)`에 `WHERE SAL > 2000`만 있으면 Range Scan이 불가능하다. Index Skip Scan, Index Full Scan, Index Fast Full Scan 중 하나로 처리되거나 Table Full Scan이 선택된다.

| 조건 | Range Scan | 대안 |
|---|---|---|
| 선두 컬럼 가공 | 불가 | 상수 쪽 변형, 함수기반 인덱스 |
| 묵시적 형변환(컬럼 쪽) | 불가 | 상수에 명시적 형변환 |
| `<>`, `NOT IN` | 불가 | 긍정형으로 바꾸기, Full Scan |
| `LIKE '%값'` | 불가 | 전문 검색, Full Scan |
| 다른 컬럼 간 OR | 불가 | OR-Expansion, UNION ALL |
| IS NULL (단일 컬럼 인덱스) | 불가 | NOT NULL 컬럼 추가한 결합 인덱스 |
| 선두 컬럼 조건 없음 | 불가 | Skip Scan, 인덱스 재설계 |

> 시험 포인트: "인덱스 컬럼을 가공하면 인덱스를 사용할 수 없다"는 정확히 말하면 "**정상적인 Range Scan을 할 수 없다**"이다. Index Full Scan이나 Fast Full Scan으로는 여전히 사용할 수 있다. 숫자형 컬럼과 문자 상수 비교(`WHERE SAL = '3000'`)는 상수 쪽이 변환되므로 인덱스 사용에 문제가 없다는 점도 함정으로 자주 나온다.

## 핵심 요약

- Index Range Scan은 선두 컬럼이 가공되지 않은 조건으로 사용될 때 가능하며, 성능은 스캔 범위와 테이블 액세스 횟수로 결정된다.
- Index Full Scan은 리프 전체를 순서대로 읽어 정렬된 결과를 주며, 소트 생략이나 부분범위 처리를 위해 선택된다.
- Index Unique Scan은 Unique 인덱스 전 컬럼을 `=` 조건으로 찾을 때만 동작한다.
- Index Skip Scan은 선두 컬럼 조건이 없을 때 쓰며, 선두 컬럼 Distinct 값이 적을수록 효과적이다.
- Index Fast Full Scan은 Multiblock I/O로 세그먼트 전체를 읽고, 병렬 처리가 가능하지만 정렬을 보장하지 않으며 필요한 컬럼이 모두 인덱스에 있어야 한다.
- Index Range Scan Descending은 내림차순 정렬과 MAX 값 처리에서 소트를 생략한다.
- 선두 컬럼 가공, 컬럼 쪽 묵시적 형변환, 부정형, LIKE 앞 %, 다른 컬럼 간 OR, IS NULL, 선두 컬럼 조건 부재 시 Range Scan이 불가능하다.
