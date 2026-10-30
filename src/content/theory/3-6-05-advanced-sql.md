---
title: 고급 SQL 활용
subject: 3과목 · SQL 고급활용 및 튜닝
chapter: 3-6. 고급 SQL 튜닝
summary: CASE·데이터 복제·윈도우 함수·WITH로 반복 액세스를 줄이고 페이징을 튜닝
---

# 고급 SQL 활용

같은 결과를 내는 SQL이라도 테이블을 몇 번 읽는지, 몇 건을 정렬하는지에 따라 성능은 수십 배 차이가 난다. 이 장은 **같은 데이터를 반복해서 읽지 않는** SQL 작성 기법과, 웹 화면에서 흔한 **페이징 처리**의 튜닝 방법을 다룬다.

## CASE·DECODE로 반복 액세스 줄이기

조건만 다른 집계를 여러 번 구하려고 같은 테이블을 UNION ALL이나 서브쿼리로 반복 조회하는 경우가 많다. CASE(DECODE)를 쓰면 **한 번만 읽고** 조건별로 나눠 집계할 수 있다.

```sql
-- 변경 전: 같은 테이블을 3번 읽는다
SELECT 'A' 구분, SUM(사용량) FROM 월별요금 WHERE 사용월 = '202410' AND 요금구분 = 'A'
UNION ALL
SELECT 'B' 구분, SUM(사용량) FROM 월별요금 WHERE 사용월 = '202410' AND 요금구분 = 'B'
UNION ALL
SELECT 'C' 구분, SUM(사용량) FROM 월별요금 WHERE 사용월 = '202410' AND 요금구분 = 'C';

-- 변경 후: 한 번 읽어 열로 펼친다
SELECT SUM(CASE WHEN 요금구분 = 'A' THEN 사용량 END) AS A_사용량,
       SUM(CASE WHEN 요금구분 = 'B' THEN 사용량 END) AS B_사용량,
       SUM(DECODE(요금구분, 'C', 사용량))             AS C_사용량
FROM   월별요금
WHERE  사용월 = '202410';
```

같은 원리로 지역별·월별 실적을 하나의 SELECT에서 CASE로 펼치면 [PIVOT](/theory/pivot-unpivot)과 같은 결과를 한 번의 스캔으로 얻는다. UPDATE에서도 `SET 등급 = CASE WHEN ... END`로 조건마다 따로 UPDATE하던 문장을 하나로 합칠 수 있다.

> 시험 포인트: "같은 테이블을 여러 번 읽는 UNION ALL 또는 스칼라 서브쿼리 → CASE/DECODE를 이용한 한 번의 집계"로 바꾸는 유형이 자주 나온다. 결과 건수와 NULL 처리(SUM은 NULL 무시)가 같은지 확인한다.

## 데이터 복제 기법

같은 데이터를 두 벌 이상 만들어 써야 할 때(소계 행 추가, 행을 여러 개로 늘리기 등)는 **카티션 곱**을 이용해 데이터를 복제한다.

### 복제용 테이블과 카티션 곱

```sql
-- 1~N 숫자를 가진 복제용 테이블
CREATE TABLE COPY_T (NO NUMBER, NO2 VARCHAR2(2));
INSERT INTO COPY_T SELECT ROWNUM, LPAD(ROWNUM, 2, '0')
                   FROM   DBA_OBJECTS WHERE ROWNUM <= 31;

-- EMP 각 행을 2벌로 복제
SELECT *
FROM   EMP A, COPY_T B
WHERE  B.NO <= 2;
```

### CONNECT BY LEVEL

9i 이후에는 DUAL과 CONNECT BY로 복제용 집합을 즉석에서 만들 수 있다.

```sql
SELECT LEVEL AS NO FROM DUAL CONNECT BY LEVEL <= 2;   -- 1, 2

SELECT *
FROM   EMP A, (SELECT ROWNUM NO FROM DUAL CONNECT BY LEVEL <= 2) B;
```

### 활용: 소계 행 만들기

부서별 사원 목록 아래에 부서 합계 행을 붙이는 예다. 데이터를 2벌로 복제해 1번은 상세 행, 2번은 부서 소계 행으로 쓴다.

```sql
SELECT DEPTNO,
       DECODE(NO, 1, TO_CHAR(EMPNO), '부서계') AS 사원번호,
       SUM(SAL) AS 급여합
FROM   EMP A, (SELECT ROWNUM NO FROM DUAL CONNECT BY LEVEL <= 2) B
GROUP  BY DEPTNO, NO, DECODE(NO, 1, TO_CHAR(EMPNO), '부서계')
ORDER  BY DEPTNO, NO;
```

같은 결과는 `GROUP BY ROLLUP`으로도 구할 수 있다. 소계·합계는 [그룹 함수](/theory/group-functions)를, CONNECT BY 문법은 [계층형 질의](/theory/hierarchical-query)를 참고한다.

## UNION ALL 활용

[집합 연산자](/theory/set-operators) 중 UNION은 중복 제거 소트를 하지만 UNION ALL은 하지 않는다. 또 UNION ALL은 **FULL OUTER JOIN을 대체**하는 데 유용하다.

```sql
-- 계획과 실적을 FULL OUTER JOIN 하는 대신
SELECT 부서번호, 연월, SUM(계획) 계획, SUM(실적) 실적
FROM  (SELECT 부서번호, 연월, 계획금액 AS 계획, TO_NUMBER(NULL) AS 실적
       FROM   부서별판매계획 WHERE 연월 BETWEEN '202401' AND '202412'
       UNION ALL
       SELECT 부서번호, 연월, TO_NUMBER(NULL), 판매금액
       FROM   채널별판매실적 WHERE 연월 BETWEEN '202401' AND '202412')
GROUP  BY 부서번호, 연월;
```

양쪽 집합을 각각 한 번만 읽고 GROUP BY로 합치므로, 한쪽에만 있는 키도 누락 없이 나온다. Native Hash Full Outer Join(11g)이 도입되기 전에는 FULL OUTER JOIN이 Left Outer Join과 Anti Join을 UNION ALL 하는 방식으로 처리되어 테이블을 반복 액세스하는 비효율이 있었다.

## 페이징 처리 튜닝

웹 게시판처럼 대량 결과 중 한 페이지만 보여주는 화면은 **필요한 만큼만 읽고 멈추는 것**이 핵심이다.

### 부분범위 처리

**부분범위 처리**란 결과 집합 전체를 만들지 않고, 클라이언트가 Fetch를 요청한 만큼(Array Size 단위)만 먼저 전송하는 처리 방식이다. 소트나 집계가 없고 인덱스로 정렬 순서대로 읽을 수 있으면, 첫 페이지는 전체 건수와 상관없이 빠르게 나온다. 정렬을 위한 SORT ORDER BY, 해시 조인의 Build 등은 부분범위 처리를 불가능하게 만든다.

### ROWNUM과 Top-N Stopkey

```sql
SELECT *
FROM  (SELECT ROWNUM NO, A.*
       FROM  (SELECT 게시글ID, 제목, 작성자, 등록일시
              FROM   게시판
              WHERE  게시판구분 = 'NEWS'
              ORDER  BY 등록일시 DESC) A
       WHERE  ROWNUM <= (:page * 10))
WHERE  NO >= (:page - 1) * 10 + 1;
```

```text
--------------------------------------------------------
| Id | Operation                         | Name       |
--------------------------------------------------------
|  0 | SELECT STATEMENT                  |            |
|  1 |  VIEW                             |            |
|  2 |   COUNT STOPKEY                   |            |
|  3 |    VIEW                           |            |
|  4 |     TABLE ACCESS BY INDEX ROWID   | 게시판      |
|  5 |      INDEX RANGE SCAN DESCENDING  | 게시판_X01  |
--------------------------------------------------------
```

인덱스 `게시판_X01 (게시판구분, 등록일시)`로 정렬된 순서로 읽고, `COUNT STOPKEY`가 :page × 10건에서 멈춘다. SORT ORDER BY가 없다는 점이 중요하다.

::: warning 페이징 SQL 함정
- **ROWNUM 조건 위치**: `ROWNUM <= :end`를 빼고 바깥에서 `NO BETWEEN :start AND :end`만 쓰면 COUNT STOPKEY가 없어 끝까지 읽는다.
- **정렬 생략 불가**: ORDER BY 컬럼이 인덱스와 맞지 않으면 전체를 읽고 정렬(Top N 소트)한 뒤 잘라낸다. 소트 부하는 줄지만 읽는 양은 그대로다.
- **불필요한 COUNT(\*)**: 화면에 전체 건수를 표시하려고 매번 `COUNT(*)`를 하면 전체 범위를 다시 읽는다. "다음 페이지 존재 여부"만 필요하면 한 건 더(`:page * 10 + 1`) 읽어 판단한다.
:::

### 웹 페이징 패턴

::: compare
- **ROWNUM 페이징 (Offset 방식)** 앞 페이지 데이터를 모두 읽고 버린다. 뒤 페이지로 갈수록 느려지지만 대부분의 사용자는 앞 몇 페이지만 보므로 실용적이다.
- **키 기반 페이징 (다음 버튼 방식)** 이전 페이지 마지막 행의 정렬 키를 조건으로 넘겨 그 다음부터 읽는다. 앞 페이지를 읽지 않으므로 어느 페이지든 일정한 속도를 낸다.
:::

```sql
-- 다음 페이지: 이전 페이지 마지막 등록일시·게시글ID 이후부터 10건
SELECT *
FROM  (SELECT 게시글ID, 제목, 등록일시
       FROM   게시판
       WHERE  게시판구분 = 'NEWS'
       AND   (등록일시 < :last_dt
              OR (등록일시 = :last_dt AND 게시글ID < :last_id))
       ORDER  BY 등록일시 DESC, 게시글ID DESC)
WHERE  ROWNUM <= 10;
```

정렬 키가 유일하지 않으면 경계에서 행이 중복·누락되므로 **유일 컬럼을 정렬 키에 추가**한다. 이전 페이지 버튼은 정렬 방향을 반대로 읽은 뒤 다시 뒤집는다. 인덱스도 (게시판구분, 등록일시, 게시글ID)처럼 정렬 키를 모두 포함해야 Stopkey가 제대로 작동한다.

### OFFSET FETCH (12c+)

```sql
SELECT 게시글ID, 제목, 등록일시
FROM   게시판
WHERE  게시판구분 = 'NEWS'
ORDER  BY 등록일시 DESC
OFFSET (:page - 1) * 10 ROWS FETCH NEXT 10 ROWS ONLY;
```

Oracle은 OFFSET FETCH를 내부적으로 ROW_NUMBER 기반 쿼리로 변환한다. 문법은 간단하지만 **OFFSET 만큼의 행은 여전히 읽고 버리므로** 뒤 페이지 성능 특성은 ROWNUM 방식과 같다. 문법 비교는 [Top N 쿼리](/theory/top-n)를 참고한다.

> 시험 포인트: 페이징 튜닝의 핵심은 "인덱스로 소트 생략 + COUNT STOPKEY로 조기 종료"다. 끝 번호 ROWNUM 조건이 정렬된 인라인 뷰 바로 바깥에 있어야 하며, 뒤 페이지 성능 문제는 키 기반 페이징으로 해결한다.

## 윈도우 함수로 셀프 조인 대체

이전 행 값 비교, 누적합, 그룹 내 최댓값 같은 요구를 셀프 조인이나 상관 서브쿼리로 풀면 같은 테이블을 반복해서 읽는다. [윈도우 함수](/theory/window-functions)를 쓰면 **한 번 읽고 정렬해서** 해결한다.

```sql
-- 변경 전: 부서 최고 급여자 (EMP를 두 번 읽음)
SELECT E.DEPTNO, E.ENAME, E.SAL
FROM   EMP E
WHERE  E.SAL = (SELECT MAX(SAL) FROM EMP WHERE DEPTNO = E.DEPTNO);

-- 변경 후: 한 번 읽어 WINDOW SORT
SELECT DEPTNO, ENAME, SAL
FROM  (SELECT DEPTNO, ENAME, SAL,
              MAX(SAL) OVER (PARTITION BY DEPTNO) AS MAX_SAL
       FROM   EMP)
WHERE  SAL = MAX_SAL;
```

```sql
-- 이전 상태값 비교: 셀프 조인 대신 LAG
SELECT 장비번호, 변경일시, 상태코드,
       LAG(상태코드) OVER (PARTITION BY 장비번호 ORDER BY 변경일시) AS 이전상태
FROM   장비상태이력;

-- 누적 매출: 비등가 셀프 조인(B.월 <= A.월) 대신 SUM OVER
SELECT 지점, 판매월, 매출,
       SUM(매출) OVER (PARTITION BY 지점 ORDER BY 판매월
                      ROWS UNBOUNDED PRECEDING) AS 누적매출
FROM   월별지점매출;
```

비등가 셀프 조인으로 누적합을 구하면 N건마다 최대 N건이 조인되어 처리량이 N²에 비례한다. 윈도우 함수는 한 번 정렬로 끝난다.

## WITH 절 활용

WITH 절로 정의한 서브쿼리는 옵티마이저가 두 가지 방식 중 하나로 처리한다.

::: compare
- **Materialize 방식** 결과를 내부 <strong>임시 테이블(Global Temporary Table)</strong>에 저장하고 반복 참조한다. `MATERIALIZE` 힌트로 유도한다.
- **Inline 방식** 참조된 위치에 인라인 뷰처럼 SQL을 풀어 넣는다. `INLINE` 힌트로 유도한다.
:::

```sql
WITH 위험고객 AS (
  SELECT /*+ MATERIALIZE */ 고객번호, SUM(연체금액) 연체금액
  FROM   연체이력
  WHERE  기준월 = '202410'
  GROUP  BY 고객번호
  HAVING SUM(연체금액) > 1000000 )
SELECT 'SMS', 고객번호 FROM 위험고객 WHERE 연체금액 < 5000000
UNION ALL
SELECT '방문', 고객번호 FROM 위험고객 WHERE 연체금액 >= 5000000;
```

```text
------------------------------------------------------------------
| Id | Operation                   | Name                       |
------------------------------------------------------------------
|  0 | SELECT STATEMENT            |                            |
|  1 |  TEMP TABLE TRANSFORMATION  |                            |
|  2 |   LOAD AS SELECT            | SYS_TEMP_0FD9D6600_1A2B3C  |
|  3 |    HASH GROUP BY            |                            |
|  4 |     TABLE ACCESS FULL       | 연체이력                     |
|  5 |   UNION-ALL                 |                            |
|  6 |    VIEW                     |                            |
|  7 |     TABLE ACCESS FULL       | SYS_TEMP_0FD9D6600_1A2B3C  |
|  8 |    VIEW                     |                            |
|  9 |     TABLE ACCESS FULL       | SYS_TEMP_0FD9D6600_1A2B3C  |
------------------------------------------------------------------
```

::: info Materialize의 장단점
- 대용량을 읽고 집계한 **작은 결과를 여러 번 재사용**할 때 원본 반복 액세스를 없앤다. 힌트가 없어도 두 번 이상 참조되면 Materialize될 수 있다.
- 임시 테이블 쓰기·읽기 I/O가 추가되고, 임시 테이블에는 인덱스가 없다. 결과가 크거나 한 번만 참조된다면 Inline이 낫다.
- Materialize되면 메인 쿼리의 조건이 WITH 안으로 들어가지 못해(조건절 Pushing 불가) 오히려 많이 읽을 수 있다.
:::

인라인 뷰 병합, 조건절 Pushing 같은 변환은 [쿼리 변환](/theory/query-transformation)에서 다룬다.

## 사용자 정의 함수·프로시저의 성능 특성

PL/SQL로 만든 사용자 정의 함수는 편리하지만, SQL 안에서 호출하면 성능 문제가 크다.

::: cards 2
- **가상머신 실행** PL/SQL은 별도의 PL/SQL 엔진(가상머신)에서 바이트코드로 실행되어 네이티브 SQL 연산보다 느리다.
- **컨텍스트 스위칭** SQL 실행 중 함수를 호출할 때마다 SQL 엔진과 PL/SQL 엔진 사이 전환이 일어난다. 호출 횟수가 곧 부하다.
- **Recursive Call** 함수 안에 SQL이 있으면 호출할 때마다 그 SQL이 재귀적으로 실행된다. 100만 건이면 100만 번 실행된다.
- **읽기 일관성 문제** 함수 안 SQL은 호출 시점마다 별도 스냅샷을 보므로, 메인 쿼리 시작 시점과 다른 데이터를 읽을 수 있다.
:::

```sql
-- 비효율: 주문 건마다 함수 안의 SELECT가 실행된다
SELECT 주문번호, GET_고객명(고객ID) AS 고객명
FROM   주문
WHERE  주문일자 = '20241020';

-- 개선 1: 조인으로 변경
SELECT O.주문번호, C.고객명
FROM   주문 O, 고객 C
WHERE  O.주문일자 = '20241020'
AND    C.고객ID = O.고객ID;

-- 개선 2: 스칼라 서브쿼리로 감싸 캐싱 효과 이용
SELECT 주문번호, (SELECT GET_고객명(고객ID) FROM DUAL) AS 고객명
FROM   주문
WHERE  주문일자 = '20241020';
```

::: info 함수 호출 부하 줄이기
- **조인·스칼라 서브쿼리로 대체**: 가장 근본적인 해결책이다.
- **스칼라 서브쿼리 캐싱**: 함수를 `(SELECT fn(x) FROM DUAL)`로 감싸면 같은 입력값에 대해 캐시된 결과를 재사용한다. 입력값 종류가 적을수록 효과가 크다.
- **DETERMINISTIC 함수 (10gR2+)**: 같은 입력에 항상 같은 결과를 선언하면 Fetch Call 안에서 결과를 캐싱한다. 단, 실제로 결정적이지 않은 함수에 선언하면 잘못된 결과가 나온다.
- **RESULT_CACHE (11g+)**: 함수 결과를 SGA에 캐싱해 세션 간에 공유한다.
:::

::: warning 함수 호출 횟수의 함정
- SELECT 절의 함수는 **Fetch된 결과 건수**만큼 호출된다.
- WHERE 절의 함수는 **조건을 평가하는 행 수**만큼 호출되며, 실행계획에서 어느 단계의 필터로 적용되는지에 따라 횟수가 달라진다.
- 인덱스 컬럼에 함수를 적용하면 인덱스 Range Scan을 할 수 없다. 함수 결과가 상수라면 `컬럼 = (SELECT fn() FROM DUAL)`처럼 한 번만 실행되게 한다.
:::

> 시험 포인트: 사용자 정의 함수는 "Recursive Call, 컨텍스트 스위칭, 읽기 일관성 미보장"이 문제다. 개선책은 조인 또는 스칼라 서브쿼리 변환, 스칼라 서브쿼리 캐싱, DETERMINISTIC, RESULT_CACHE다.

## 핵심 요약

- 조건만 다른 반복 조회는 CASE/DECODE로 한 번 읽어 조건별로 집계한다.
- 소계 행 생성처럼 데이터가 여러 벌 필요하면 복제용 테이블이나 `CONNECT BY LEVEL`과의 카티션 곱을 쓴다.
- UNION ALL과 GROUP BY로 FULL OUTER JOIN을 대체하면 각 테이블을 한 번만 읽는다.
- 페이징은 인덱스로 소트를 생략하고 COUNT STOPKEY로 조기 종료하며, 끝 번호 ROWNUM 조건은 정렬된 인라인 뷰 바로 바깥에 둔다.
- 뒤 페이지 성능 문제는 마지막 키를 넘기는 키 기반 페이징으로 해결하고, 정렬 키에 유일 컬럼을 포함한다.
- OFFSET FETCH는 간편하지만 OFFSET 행을 읽고 버리는 점은 ROWNUM 방식과 같다.
- 셀프 조인·상관 서브쿼리로 구하던 이전 값·누적합·그룹 최댓값은 윈도우 함수로 한 번에 구한다.
- WITH 절은 MATERIALIZE(임시 테이블)와 INLINE(인라인 뷰) 방식이 있으며, 작은 결과를 여러 번 재사용할 때 Materialize가 유리하다.
- 사용자 정의 함수는 컨텍스트 스위칭과 Recursive Call 부하가 크고 읽기 일관성을 보장하지 않으므로 조인·스칼라 서브쿼리 캐싱 등으로 대체한다.
