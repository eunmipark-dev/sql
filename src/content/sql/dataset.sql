-- SQL 결과 맞히기 · SQL 실습장이 쓰는 연습용 데이터 (Oracle 예제 SCOTT 스키마 + 집합 연습용 T1/T2)
CREATE TABLE dept (
  deptno integer PRIMARY KEY,
  dname  varchar(14),
  loc    varchar(13)
);
INSERT INTO dept VALUES
  (10, 'ACCOUNTING', 'NEW YORK'),
  (20, 'RESEARCH', 'DALLAS'),
  (30, 'SALES', 'CHICAGO'),
  (40, 'OPERATIONS', 'BOSTON');

CREATE TABLE emp (
  empno  integer PRIMARY KEY,
  ename  varchar(10),
  job    varchar(9),
  mgr    integer,
  sal    integer,
  comm   integer,
  deptno integer REFERENCES dept
);
INSERT INTO emp VALUES
  (7839, 'KING',   'PRESIDENT', NULL, 5000, NULL, 10),
  (7566, 'JONES',  'MANAGER',   7839, 2975, NULL, 20),
  (7698, 'BLAKE',  'MANAGER',   7839, 2850, NULL, 30),
  (7782, 'CLARK',  'MANAGER',   7839, 2450, NULL, 10),
  (7788, 'SCOTT',  'ANALYST',   7566, 3000, NULL, 20),
  (7902, 'FORD',   'ANALYST',   7566, 3000, NULL, 20),
  (7499, 'ALLEN',  'SALESMAN',  7698, 1600, 300,  30),
  (7521, 'WARD',   'SALESMAN',  7698, 1250, 500,  30),
  (7654, 'MARTIN', 'SALESMAN',  7698, 1250, 1400, 30),
  (7844, 'TURNER', 'SALESMAN',  7698, 1500, 0,    30),
  (7369, 'SMITH',  'CLERK',     7902, 800,  NULL, 20),
  (7900, 'JAMES',  'CLERK',     7698, 950,  NULL, 30),
  (7934, 'MILLER', 'CLERK',     7782, 1300, NULL, 10),
  (7876, 'ADAMS',  'CLERK',     7788, 1100, NULL, 20);

CREATE TABLE t1 (c1 integer);
INSERT INTO t1 VALUES (1), (2), (2), (3), (NULL);
CREATE TABLE t2 (c1 integer);
INSERT INTO t2 VALUES (2), (3), (4), (NULL);

-- Oracle 에 익숙한 사람을 위해: DUAL, NVL, NVL2
CREATE TABLE dual (dummy varchar(1));
INSERT INTO dual VALUES ('X');
CREATE FUNCTION nvl(anycompatible, anycompatible) RETURNS anycompatible
  LANGUAGE sql IMMUTABLE AS 'SELECT coalesce($1, $2)';
CREATE FUNCTION nvl2(anyelement, anycompatible, anycompatible) RETURNS anycompatible
  LANGUAGE sql IMMUTABLE AS 'SELECT CASE WHEN $1 IS NOT NULL THEN $2 ELSE $3 END';
