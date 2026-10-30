---
title: SELECT 문
subject: 2과목 · SQL 기본과 활용
chapter: 2-1. SQL 기본
summary: 조회의 기본 문법, 별칭 규칙, 실행 순서
---

# SELECT 문

SELECT 문은 테이블에서 원하는 데이터를 조회하는 명령어다. 문법 자체보다 **별칭 규칙**과 **논리적 실행 순서**가 시험에 자주 출제된다.

## SELECT 기본 문법

```sql
SELECT [ALL | DISTINCT] 컬럼1, 컬럼2, ... | *
FROM   테이블명
[WHERE 조건]
[GROUP BY 컬럼]
[HAVING 그룹조건]
[ORDER BY 컬럼 [ASC | DESC]];
```

- SELECT 절과 FROM 절은 필수다(Oracle 기준). SQL Server는 `SELECT 1+1;`처럼 FROM 없이도 실행 가능하다.
- `*`(애스터리스크)는 테이블의 모든 컬럼을 정의된 순서대로 조회한다.

::: info 대소문자 구분
SQL 키워드와 객체명은 대소문자를 구분하지 않는다(`select`와 `SELECT`는 같다). 하지만 **문자열 데이터**('SMITH')는 대소문자를 구분하므로 `'smith'`와 다르다.
:::

```sql
SELECT EMPNO, ENAME, SAL
FROM   EMP;
```

## DISTINCT와 ALL

::: compare
- **ALL** 중복 행을 모두 출력한다. **기본값**이라 생략 가능하다.
- **DISTINCT** 중복 행을 하나로 줄여 출력한다. SELECT 바로 뒤에 한 번만 쓴다.
:::

```sql
SELECT DISTINCT DEPTNO FROM EMP;          -- 10, 20, 30
SELECT DISTINCT DEPTNO, JOB FROM EMP;     -- (DEPTNO, JOB) 조합 기준 중복 제거
```

- DISTINCT는 뒤에 나열한 **모든 컬럼의 조합**을 기준으로 중복을 제거한다.
- `SELECT DEPTNO, DISTINCT JOB`처럼 중간에 쓰면 문법 오류다.
- NULL도 하나의 값처럼 취급되어 DISTINCT 결과에 한 행으로 남는다.

::: example 컬럼 조합에 따라 달라지는 행 수
원본 4행이 아래와 같을 때를 생각해 보자.

| DEPTNO | JOB |
|--------|-----|
| 10 | CLERK |
| 10 | CLERK |
| 10 | MANAGER |
| 20 | CLERK |

`SELECT DISTINCT DEPTNO`는 10, 20으로 **2행**이다. `SELECT DISTINCT DEPTNO, JOB`은 (10, CLERK), (10, MANAGER), (20, CLERK)로 **3행**이다.
:::

> 시험 포인트: `SELECT DISTINCT A, B`는 A만이 아니라 (A, B) 쌍 단위로 중복을 제거한다. 결과 행 수를 묻는 문제에서 자주 함정으로 나온다.

## ALIAS(별칭)

컬럼이나 테이블에 다른 이름을 붙여 결과 헤더를 바꾸거나 SQL을 간결하게 만든다.

```sql
SELECT ENAME AS 사원명,
       SAL   급여,
       SAL * 12 AS "연 봉"
FROM   EMP E;
```

::: cards 2
- **컬럼 별칭** 컬럼명 뒤에 `AS`를 쓰거나 공백 후 바로 쓴다. **AS는 생략 가능**하다.
- **큰따옴표(" ")** 공백, 특수문자를 포함하거나 대소문자를 구분하려면 큰따옴표로 감싼다. 작은따옴표는 문자열 리터럴이라 별칭으로 쓸 수 없다(Oracle).
- **테이블 별칭** Oracle에서는 **AS를 쓸 수 없다**(`FROM EMP AS E`는 오류). SQL Server는 테이블 별칭에도 AS 사용 가능하다.
- **별칭 지정 후** 테이블 별칭을 지정하면 해당 SQL 안에서는 원래 테이블명 대신 별칭으로만 컬럼을 수식해야 한다.
:::

## 산술 연산자

| 연산자 | 의미 | 우선순위 |
|--------|------|----------|
| ( ) | 괄호 | 1 |
| *, / | 곱하기, 나누기 | 2 |
| +, - | 더하기, 빼기 | 3 |

- SQL Server는 나머지 연산자 `%`를 제공한다. Oracle은 `MOD()` 함수를 사용한다.
- 예: `10 + 2 * 3`은 곱셈이 먼저라 16, `(10 + 2) * 3`은 36이다.

::: warning NULL이 섞인 산술 연산
**NULL이 포함된 산술 연산 결과는 항상 NULL**이다. 아래 KING처럼 COMM이 NULL이면 SAL이 아무리 커도 TOTAL은 NULL이 된다.
:::

```sql
SELECT ENAME, SAL, COMM, SAL + COMM AS TOTAL
FROM   EMP
WHERE  ENAME IN ('ALLEN', 'KING');
```

| ENAME | SAL | COMM | TOTAL |
|-------|-----|------|-------|
| ALLEN | 1600 | 300 | 1900 |
| KING | 5000 | NULL | NULL |

NULL을 0으로 바꿔 계산하려면 `SAL + NVL(COMM, 0)`처럼 처리한다. 자세한 내용은 [NULL 속성](/theory/null-attribute) 참고.

## 합성(연결) 연산자

| DBMS | 연산자 / 함수 | 예시 | 결과 |
|------|---------------|------|------|
| Oracle | `\|\|` | `'A' \|\| 'B'` | AB |
| SQL Server | `+` | `'A' + 'B'` | AB |
| 공통 | CONCAT(s1, s2) | `CONCAT('A', 'B')` | AB |

```sql
SELECT ENAME || '의 직무는 ' || JOB || '입니다' AS 설명
FROM   EMP
WHERE  EMPNO = 7369;
-- SMITH의 직무는 CLERK입니다
```

::: compare
- **Oracle `||`** `'A' || NULL`의 결과는 <strong>'A'</strong>다. NULL을 빈 문자열처럼 처리하므로 산술 연산과 다르다. CONCAT은 인수를 **2개만** 받으므로 3개 이상 연결은 중첩하거나 `||`를 사용한다.
- **SQL Server `+`** `'A' + NULL`은 기본 설정에서 **NULL**이다. 문자열끼리는 `+`로 연결한다.
:::

> 시험 포인트: Oracle은 `||`, SQL Server는 `+`로 문자열을 연결한다. Oracle에서 `'1' + '2'`는 문자열 연결이 아니라 암시적 숫자 변환 후 덧셈이 되어 3이 나온다.

## 작성 순서와 논리적 실행 순서

SQL은 쓰는 순서와 DBMS가 논리적으로 처리하는 순서가 다르다. 실행 순서는 다음과 같다.

::: flow
- **FROM** 대상 테이블 확인
- **WHERE** 행 단위 필터링
- **GROUP BY** 그룹 생성
- **HAVING** 그룹 필터링
- **SELECT** 출력 컬럼 계산
- **ORDER BY** 정렬
:::

::: compare
- **작성 순서** SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY. 사람이 읽기 좋은 순서로, "무엇을 보여줄지"부터 쓴다.
- **실행 순서** FROM → WHERE → GROUP BY → HAVING → **SELECT** → ORDER BY. 데이터를 먼저 가져와 거르고 묶은 뒤, **거의 마지막에** SELECT를 계산한다.
:::

| 순서 | 작성 순서 | 실행 순서 | 역할 |
|------|-----------|-----------|------|
| 1 | SELECT | FROM | 대상 테이블 확인 |
| 2 | FROM | WHERE | 행 단위 조건으로 필터링 |
| 3 | WHERE | GROUP BY | 그룹 생성 |
| 4 | GROUP BY | HAVING | 그룹 조건으로 필터링 |
| 5 | HAVING | SELECT | 출력 컬럼·표현식 계산 |
| 6 | ORDER BY | ORDER BY | 정렬 |

실행 순서 암기: **FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY**

```sql
SELECT   DEPTNO, SUM(SAL) AS TOTAL_SAL   -- 5
FROM     EMP                             -- 1
WHERE    JOB <> 'PRESIDENT'              -- 2
GROUP BY DEPTNO                          -- 3
HAVING   SUM(SAL) > 9000                 -- 4
ORDER BY TOTAL_SAL DESC;                 -- 6
```

## 별칭을 사용할 수 있는 위치

컬럼 별칭은 SELECT 절에서 정의되므로, **SELECT보다 나중에 실행되는 ORDER BY 절에서만** 사용할 수 있다.

```mermaid
flowchart LR
  F["FROM"] --> W["WHERE"] --> G["GROUP BY"] --> H["HAVING"] --> S["SELECT<br/>별칭 정의"] --> O["ORDER BY<br/>별칭 사용 가능"]
  classDef hl fill:#fef3c7,stroke:#f59e0b,color:#451a03
  class S,O hl
```

::: cards 2
- **WHERE · 불가** SELECT보다 먼저 실행되어 별칭이 아직 없다.
- **GROUP BY · 불가** 마찬가지로 SELECT 이전 단계다.
- **HAVING · 불가** 그룹 조건도 SELECT 이전에 평가된다.
- **ORDER BY · 가능** SELECT 다음에 실행되므로 별칭을 알고 있다.
:::

```sql
-- 오류: WHERE 절은 SELECT보다 먼저 실행되어 ANNUAL을 알 수 없음
SELECT ENAME, SAL * 12 AS ANNUAL FROM EMP WHERE ANNUAL > 30000;

-- 정상
SELECT ENAME, SAL * 12 AS ANNUAL FROM EMP WHERE SAL * 12 > 30000;
SELECT ENAME, SAL * 12 AS ANNUAL FROM EMP ORDER BY ANNUAL;
```

- 테이블 별칭은 FROM 절에서 정의되므로 SQL 전체에서 사용 가능하다.
- 인라인 뷰로 한 번 감싸면 바깥 쿼리에서는 별칭을 일반 컬럼처럼 WHERE에 쓸 수 있다([서브쿼리](/theory/subquery) 참고).

> 시험 포인트: "WHERE 절에서 SELECT 절의 별칭을 사용할 수 있다"는 틀린 문장이다. 실행 순서상 SELECT보다 뒤에 오는 ORDER BY만 별칭을 참조할 수 있다.

## Oracle DUAL 테이블

::: cards 3
- **1행 1열** Oracle이 기본 제공하는 테이블로, DUMMY 컬럼 하나에 값 'X'가 들어 있다.
- **용도** Oracle은 FROM 절이 필수이므로 테이블과 무관한 계산·함수 결과를 확인할 때 쓴다.
- **소유자** SYS 소유이지만 모든 사용자가 접근할 수 있다.
:::

```sql
-- Oracle
SELECT 10 * 3, SYSDATE FROM DUAL;

-- SQL Server (FROM 생략 가능)
SELECT 10 * 3, GETDATE();
```

## 핵심 요약

- SELECT의 기본 옵션은 ALL이며, DISTINCT는 나열한 모든 컬럼 조합 기준으로 중복을 제거한다.
- 컬럼 별칭은 AS 생략 가능, 공백·특수문자·대소문자 구분 시 큰따옴표를 사용한다.
- Oracle은 테이블 별칭에 AS를 쓸 수 없다.
- NULL이 포함된 산술 연산 결과는 NULL이며, Oracle의 `||` 연결은 NULL을 무시한다.
- 문자열 연결은 Oracle `||`, SQL Server `+`, 공통 CONCAT(2개 인수)이다.
- 실행 순서는 FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY다.
- 컬럼 별칭은 ORDER BY 절에서만 사용할 수 있다.
- DUAL은 Oracle의 1행 1열 더미 테이블이다.
