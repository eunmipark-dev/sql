---
title: 표준 조인
subject: 2과목 · SQL 기본과 활용
chapter: 2-1. SQL 기본
summary: ANSI 조인 문법과 ON·WHERE 위치의 차이
---

# 표준 조인

ANSI/ISO 표준 조인은 **FROM 절에 조인 종류와 조인 조건을 명시**하는 방식이다. 조인 조건(ON)과 일반 필터 조건(WHERE)을 분리해 의도가 명확해지며, Oracle과 SQL Server에서 모두 쓸 수 있다. WHERE 절 방식 조인은 [조인](/theory/join)을 참고하자.

## 예제 테이블

EMP

| EMPNO | ENAME | DEPTNO |
|-------|-------|--------|
| 7369 | SMITH | 20 |
| 7499 | ALLEN | 30 |
| 7839 | KING | 10 |
| 7902 | FORD | 20 |

DEPT

| DEPTNO | DNAME |
|--------|-------|
| 10 | ACCOUNTING |
| 20 | RESEARCH |
| 40 | OPERATIONS |

ALLEN의 **30번 부서는 DEPT에 없고**, **40번 부서에는 사원이 없다**. 매칭되는 쌍은 SMITH·KING·FORD 3건이다.

## 표준 조인 종류

::: cards 3
- **INNER JOIN** `A [INNER] JOIN B ON 조건` 조건을 만족하는 행만 남긴다.
- **NATURAL JOIN** `A NATURAL JOIN B` 같은 이름의 **모든** 컬럼으로 EQUI JOIN한다.
- **USING** `A JOIN B USING (컬럼)` 지정한 같은 이름 컬럼으로 EQUI JOIN한다.
- **CROSS JOIN** `A CROSS JOIN B` 모든 조합(카티션 곱)을 만든다.
- **LEFT / RIGHT OUTER** `A LEFT [OUTER] JOIN B ON 조건` A의 모든 행 + 매칭되는 B. RIGHT는 B의 모든 행 + 매칭되는 A.
- **FULL OUTER JOIN** `A FULL [OUTER] JOIN B ON 조건` 양쪽 모든 행을 보존한다.
:::

| 구분 | 문법 | 설명 |
|------|------|------|
| INNER JOIN | `A [INNER] JOIN B ON 조건` | 조건을 만족하는 행만 |
| NATURAL JOIN | `A NATURAL JOIN B` | 같은 이름의 모든 컬럼으로 EQUI JOIN |
| USING | `A JOIN B USING (컬럼)` | 지정한 같은 이름 컬럼으로 EQUI JOIN |
| CROSS JOIN | `A CROSS JOIN B` | 모든 조합(카티션 곱) |
| LEFT OUTER JOIN | `A LEFT [OUTER] JOIN B ON 조건` | A의 모든 행 + 매칭되는 B |
| RIGHT OUTER JOIN | `A RIGHT [OUTER] JOIN B ON 조건` | B의 모든 행 + 매칭되는 A |
| FULL OUTER JOIN | `A FULL [OUTER] JOIN B ON 조건` | 양쪽 모든 행 |

## INNER JOIN과 ON 절

```sql
SELECT E.ENAME, D.DEPTNO, D.DNAME
FROM   EMP E INNER JOIN DEPT D
       ON E.DEPTNO = D.DEPTNO;
```

| ENAME | DEPTNO | DNAME |
|-------|--------|-------|
| SMITH | 20 | RESEARCH |
| KING | 10 | ACCOUNTING |
| FORD | 20 | RESEARCH |

- INNER는 생략 가능하며, `JOIN`만 쓰면 INNER JOIN이다. **INNER JOIN이 표준 조인의 기본값**이다.
- ON 절에는 `=` 외에 BETWEEN, 부등호 등 임의의 조건을 쓸 수 있어 Non-EQUI JOIN도 가능하다.
- 컬럼명이 달라도 조인할 수 있다. 예: `ON E.MGR = M.EMPNO`.
- 같은 이름의 컬럼은 **접두사(별칭)를 붙여야** 하며, 붙이지 않으면 모호성 오류가 발생한다.
- ON 절은 WHERE 절과 함께 쓸 수 있다. **조인 조건은 ON에, 필터 조건은 WHERE에** 두는 것이 원칙이다.

```sql
-- 3개 테이블 조인: JOIN ... ON을 이어서 씀
SELECT E.ENAME, D.DNAME, S.GRADE
FROM   EMP E
       JOIN DEPT D     ON E.DEPTNO = D.DEPTNO
       JOIN SALGRADE S ON E.SAL BETWEEN S.LOSAL AND S.HISAL;
```

## NATURAL JOIN

두 테이블에서 **이름이 같은 모든 컬럼**을 대상으로 자동으로 EQUI JOIN을 수행한다.

```sql
SELECT DEPTNO, ENAME, DNAME
FROM   EMP NATURAL JOIN DEPT;
```

| DEPTNO | ENAME | DNAME |
|--------|-------|-------|
| 20 | SMITH | RESEARCH |
| 10 | KING | ACCOUNTING |
| 20 | FORD | RESEARCH |

- 조인 컬럼(DEPTNO)에는 **테이블명이나 별칭 접두사를 붙일 수 없다**. `E.DEPTNO`처럼 쓰면 오류다.
- ON 절이나 USING 절을 함께 쓸 수 없다.
- 이름이 같은 컬럼은 데이터 타입도 호환되어야 한다.
- SQL Server는 NATURAL JOIN을 지원하지 않는다.

::: warning 이름만 같은 컬럼의 함정
같은 이름의 컬럼이 여러 개면 **모두** 조인 조건이 된다. 이름만 같고 의미가 다른 컬럼(예: 두 테이블 모두에 있는 등록일자 컬럼)이 있으면 DEPTNO **그리고** 등록일자까지 같아야 연결되어 의도하지 않은 결과가 나온다.
:::

## USING 조건절

NATURAL JOIN과 달리 같은 이름의 컬럼 중 **조인에 사용할 컬럼만 선택**해서 EQUI JOIN한다.

```sql
SELECT DEPTNO, E.ENAME, D.DNAME
FROM   EMP E JOIN DEPT D USING (DEPTNO);
```

- 결과는 NATURAL JOIN 예제와 같다.
- USING에 쓴 컬럼에는 **접두사를 붙일 수 없다**(SELECT, WHERE 등 어디서든). 나머지 컬럼에는 접두사를 쓸 수 있다.
- 컬럼 목록은 괄호로 감싸야 하며, 여러 컬럼이면 `USING (C1, C2)`로 쓴다.
- SQL Server는 USING을 지원하지 않는다.

::: compare
- **NATURAL JOIN** 같은 이름 컬럼을 **자동으로 전부** 조인 조건으로 쓴다. ON·USING과 함께 쓸 수 없다. 조인 컬럼에 접두사 불가.
- **USING** 같은 이름 컬럼 중 **골라서** 조인 조건으로 쓴다. 괄호 필수. 조인 컬럼에 접두사 불가, 나머지 컬럼은 접두사 가능.
:::

### SELECT * 결과의 컬럼 구성

| 방식 | 결과 컬럼 | 컬럼 수 |
|------|-----------|---------|
| ON E.DEPTNO = D.DEPTNO | EMPNO, ENAME, DEPTNO, DEPTNO, DNAME | 5 |
| USING (DEPTNO) | DEPTNO, EMPNO, ENAME, DNAME | 4 |
| NATURAL JOIN | DEPTNO, EMPNO, ENAME, DNAME | 4 |

NATURAL JOIN과 USING은 조인 컬럼을 **한 번만, 맨 앞에** 출력한다. ON은 양쪽 컬럼을 모두 출력한다.

> 시험 포인트: NATURAL JOIN과 USING의 조인 컬럼에는 `E.DEPTNO`처럼 접두사를 붙이면 오류다. 반대로 ON 절에서는 같은 이름 컬럼에 접두사를 반드시 붙여야 한다.

## CROSS JOIN

```sql
SELECT E.ENAME, D.DNAME
FROM   EMP E CROSS JOIN DEPT D;   -- 4 × 3 = 12행
```

- 조인 조건 없이 모든 조합을 만든다. WHERE 방식에서 조인 조건을 빠뜨린 것과 결과가 같다.
- CROSS JOIN에는 **ON 절을 쓸 수 없다**. 필터가 필요하면 WHERE 절을 쓴다.

## OUTER JOIN

조인 종류별 보존 범위는 [조인](/theory/join)의 벤 다이어그램을 함께 보면 쉽다.

### LEFT OUTER JOIN

```sql
SELECT E.ENAME, E.DEPTNO, D.DNAME
FROM   EMP E LEFT OUTER JOIN DEPT D
       ON E.DEPTNO = D.DEPTNO;
```

| ENAME | DEPTNO | DNAME |
|-------|--------|-------|
| SMITH | 20 | RESEARCH |
| ALLEN | 30 | NULL |
| KING | 10 | ACCOUNTING |
| FORD | 20 | RESEARCH |

왼쪽 테이블(EMP)의 모든 행이 나오며, 짝이 없는 ALLEN은 DEPT 쪽 컬럼이 NULL로 채워진다.

### RIGHT OUTER JOIN

```sql
SELECT E.ENAME, D.DEPTNO, D.DNAME
FROM   EMP E RIGHT OUTER JOIN DEPT D
       ON E.DEPTNO = D.DEPTNO;
```

| ENAME | DEPTNO | DNAME |
|-------|--------|-------|
| KING | 10 | ACCOUNTING |
| SMITH | 20 | RESEARCH |
| FORD | 20 | RESEARCH |
| NULL | 40 | OPERATIONS |

- 오른쪽 테이블(DEPT)의 모든 행이 나오며, 사원이 없는 40번 부서는 EMP 쪽 컬럼이 NULL이다.
- `A RIGHT JOIN B`는 `B LEFT JOIN A`와 결과 집합이 같다.

### FULL OUTER JOIN

```sql
SELECT E.ENAME, E.DEPTNO AS E_DEPTNO, D.DEPTNO AS D_DEPTNO, D.DNAME
FROM   EMP E FULL OUTER JOIN DEPT D
       ON E.DEPTNO = D.DEPTNO;
```

| ENAME | E_DEPTNO | D_DEPTNO | DNAME |
|-------|----------|----------|-------|
| SMITH | 20 | 20 | RESEARCH |
| ALLEN | 30 | NULL | NULL |
| KING | 10 | 10 | ACCOUNTING |
| FORD | 20 | 20 | RESEARCH |
| NULL | NULL | 40 | OPERATIONS |

::: flow
- **매칭** SMITH, KING, FORD · 3행
- **왼쪽에만** ALLEN · 1행
- **오른쪽에만** 40번 부서 · 1행
- **합계** 5행
:::

- LEFT OUTER 결과와 RIGHT OUTER 결과를 UNION(중복 제거)한 것과 같다. UNION ALL로 합치면 매칭 행이 중복된다([집합 연산자](/theory/set-operators) 참고).
- 행 순서는 ORDER BY 없이는 보장되지 않는다.

> 시험 포인트: FULL OUTER JOIN 결과 행 수 = INNER JOIN 행 수 + 왼쪽에만 있는 행 수 + 오른쪽에만 있는 행 수. 예제에서는 3 + 1 + 1 = 5행이다.

## ON 절과 WHERE 절 조건 위치에 따른 차이

INNER JOIN에서는 조건을 ON에 두든 WHERE에 두든 결과가 같다. 그러나 **OUTER JOIN에서는 결과가 달라진다**.

::: compare
- **ON 절 조건** **조인할 짝을 찾는** 조건이다. 기준 테이블(보존되는 쪽)의 행은 조건과 무관하게 모두 남는다. 짝이 없으면 NULL로 채워질 뿐이다.
- **WHERE 절 조건** **조인이 끝난 결과를 거르는** 조건이다. NULL로 채워진 행도 조건에 맞지 않으면 제거된다.
:::

```mermaid
flowchart LR
  A["DEPT 3행<br/>(기준 테이블)"] --> B["ON 조건으로<br/>EMP 짝 찾기"]
  B --> C["조인 결과<br/>짝 없으면 NULL · 3행 유지"]
  C --> D["WHERE 조건으로<br/>결과 행 거르기"]
  D --> E["최종 결과"]
  classDef hl fill:#fef3c7,stroke:#f59e0b,color:#451a03
  class D hl
```

### 예제 1: 반대편 테이블 조건

`E.ENAME = 'SMITH'`라는 같은 조건을 ON에 두느냐, WHERE에 두느냐만 다르다.

```sql
-- (1) ON 절에 조건
SELECT D.DEPTNO, D.DNAME, E.ENAME
FROM   DEPT D LEFT OUTER JOIN EMP E
       ON D.DEPTNO = E.DEPTNO AND E.ENAME = 'SMITH';
```

| DEPTNO | DNAME | ENAME |
|--------|-------|-------|
| 10 | ACCOUNTING | NULL |
| 20 | RESEARCH | SMITH |
| 40 | OPERATIONS | NULL |

```sql
-- (2) WHERE 절에 조건
SELECT D.DEPTNO, D.DNAME, E.ENAME
FROM   DEPT D LEFT OUTER JOIN EMP E
       ON D.DEPTNO = E.DEPTNO
WHERE  E.ENAME = 'SMITH';
```

| DEPTNO | DNAME | ENAME |
|--------|-------|-------|
| 20 | RESEARCH | SMITH |

::: warning OUTER JOIN이 INNER JOIN으로 변하는 순간
- (1)은 DEPT 3행이 모두 유지되고 SMITH만 짝으로 붙는다.
- (2)는 조인 후 ENAME이 NULL인 행(10번, 40번)이 WHERE에서 제거되어 **사실상 INNER JOIN과 같아진다**. `NULL = 'SMITH'`는 참이 아니기 때문이다.
:::

### 예제 2: 기준 테이블 조건

```sql
SELECT D.DEPTNO, D.DNAME, E.ENAME
FROM   DEPT D LEFT OUTER JOIN EMP E
       ON D.DEPTNO = E.DEPTNO AND D.DEPTNO = 10;
```

| DEPTNO | DNAME | ENAME |
|--------|-------|-------|
| 10 | ACCOUNTING | KING |
| 20 | RESEARCH | NULL |
| 40 | OPERATIONS | NULL |

::: warning 기준 테이블 조건은 ON에서 걸러지지 않는다
- 기준 테이블(DEPT)에 대한 조건을 ON에 두면 DEPT 행을 걸러내지 못한다. 20번 부서도 남되 짝을 찾지 못해 ENAME이 NULL이 된다.
- 10번 부서만 보고 싶다면 `WHERE D.DEPTNO = 10`으로 WHERE 절에 써야 한다.
:::

> 시험 포인트: OUTER JOIN에서 NULL이 채워지는 쪽 테이블의 조건을 WHERE 절에 쓰면 OUTER JOIN 효과가 사라진다. 반대로 기준 테이블 조건을 ON 절에 쓰면 기준 테이블 행이 걸러지지 않는다.

## Oracle (+) 표기와의 대응

| ANSI 표준 | Oracle 전통 방식 |
|-----------|------------------|
| `A JOIN B ON A.K = B.K` | `WHERE A.K = B.K` |
| `A LEFT JOIN B ON A.K = B.K` | `WHERE A.K = B.K(+)` |
| `A RIGHT JOIN B ON A.K = B.K` | `WHERE A.K(+) = B.K` |
| `A FULL JOIN B ON A.K = B.K` | (+) 양쪽 사용 불가 → LEFT 결과 UNION RIGHT 결과 |
| `A LEFT JOIN B ON A.K = B.K AND B.C = 'X'` | `WHERE A.K = B.K(+) AND B.C(+) = 'X'` |
| `A CROSS JOIN B` | `FROM A, B` (조건 없음) |

::: info ON 조건 ↔ (+) 조건
- ON 절의 반대편 테이블 조건은 Oracle 방식에서 해당 컬럼에 (+)를 붙인 조건과 대응된다.
- Oracle 방식에서 반대편 조건에 (+)를 빠뜨리면 ANSI의 WHERE 절 조건과 같아진다.
:::

## 핵심 요약

- 표준 조인은 FROM 절에 조인 유형과 조건을 명시하며, JOIN만 쓰면 INNER JOIN이다.
- NATURAL JOIN은 같은 이름의 모든 컬럼으로, USING은 지정한 컬럼으로 EQUI JOIN한다.
- NATURAL JOIN과 USING의 조인 컬럼에는 접두사를 붙일 수 없고, SELECT * 시 조인 컬럼이 한 번만 맨 앞에 나온다.
- ON 절은 임의의 조건을 쓸 수 있고 같은 이름 컬럼에는 접두사가 필요하다.
- LEFT/RIGHT는 지정한 쪽 테이블의 모든 행을, FULL은 양쪽 모든 행을 보존한다.
- OUTER JOIN에서 ON 조건은 짝 찾기, WHERE 조건은 결과 필터이므로 위치에 따라 결과가 달라진다.
- Oracle (+)는 LEFT/RIGHT와 대응되며, FULL OUTER JOIN은 (+)로 직접 표현할 수 없다.
