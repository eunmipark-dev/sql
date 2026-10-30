---
title: 정규 표현식
subject: 2과목 · SQL 기본과 활용
chapter: 2-2. SQL 활용
summary: 패턴 기호와 REGEXP 함수로 문자열 다루기
---

# 정규 표현식

<strong>정규 표현식(Regular Expression)</strong>은 문자열의 패턴을 기호로 표현하는 방법이다. Oracle은 POSIX 표준 기반 정규 표현식에 일부 Perl 확장 문법을 더해 **REGEXP 계열 함수**로 제공한다.

## LIKE와 정규 표현식 비교

::: compare
- **LIKE** 연산자. 와일드카드는 `%`(0개 이상 문자), `_`(1개 문자) 두 개뿐이다. "포함·시작·끝" 같은 단순 검사용.
- **정규 표현식** REGEXP_LIKE, REGEXP_REPLACE 등 함수. 문자 종류, 반복 횟수, 선택, 그룹까지 표현한다. 예: "010-숫자4개-숫자4개".
:::

| 구분 | LIKE | 정규 표현식 |
|---|---|---|
| 와일드카드 | `%`(0개 이상 문자), `_`(1개 문자) | 다양한 메타문자와 반복 지정 |
| 표현력 | 단순 포함·시작·끝 검사 | 문자 종류, 반복 횟수, 선택, 그룹 등 |
| 함수 | 연산자 | REGEXP_LIKE, REGEXP_REPLACE 등 |

LIKE의 기본 사용법은 [WHERE 절](/theory/where)을 참고한다.

## 기본 메타문자

| 메타문자 | 의미 | 예시 | 일치 예 |
|---|---|---|---|
| `.` | 임의의 문자 1개 (기본적으로 줄바꿈 제외) | `a.c` | abc, a1c |
| `^` | 문자열(또는 줄)의 시작 | `^ab` | abc |
| `$` | 문자열(또는 줄)의 끝 | `yz$` | xyz |
| `[ ]` | 대괄호 안 문자 중 하나 | `[abc]` | a, b, c |
| `[a-z]` | 범위 안의 문자 하나 | `[0-9]` | 0~9 |
| `[^ ]` | 대괄호 안 문자를 제외한 하나 | `[^0-9]` | 숫자가 아닌 문자 |
| `\|` | OR, 둘 중 하나 | `cat\|dog` | cat, dog |
| `( )` | 그룹(서브표현식) | `(ab)+` | ab, abab |
| `\` | 메타문자를 일반 문자로 | `\.` | 마침표 자체 |

::: warning ^ 의 두 얼굴
`^`는 대괄호 **바깥**에서는 시작 위치, 대괄호 **안 맨 앞**에서는 부정을 뜻한다. `^[0-9]`는 "숫자로 시작", `[^0-9]`는 "숫자가 아닌 문자 하나"다.
:::

## 반복 지정자

| 지정자 | 의미 | 예시 | 일치 예 |
|---|---|---|---|
| `*` | 0회 이상 | `ab*c` | ac, abc, abbc |
| `+` | 1회 이상 | `ab+c` | abc, abbc |
| `?` | 0회 또는 1회 | `ab?c` | ac, abc |
| `{m}` | 정확히 m회 | `a{3}` | aaa |
| `{m,}` | m회 이상 | `a{2,}` | aa, aaa |
| `{m,n}` | m회 이상 n회 이하 | `[0-9]{3,4}` | 123, 1234 |

## 문자 클래스

POSIX 문자 클래스는 반드시 대괄호 안에서 `[[:digit:]]`처럼 쓴다.

| POSIX 클래스 | 의미 | Perl 확장 | 의미 |
|---|---|---|---|
| `[:digit:]` | 숫자 | `\d` | 숫자 |
| `[:alpha:]` | 영문자 | `\D` | 숫자가 아닌 문자 |
| `[:alnum:]` | 영문자와 숫자 | `\w` | 영문자, 숫자, 밑줄(_) |
| `[:upper:]` | 대문자 | `\W` | `\w`가 아닌 문자 |
| `[:lower:]` | 소문자 | `\s` | 공백 문자(공백, 탭, 줄바꿈) |
| `[:space:]` | 공백 문자 | `\S` | 공백이 아닌 문자 |
| `[:punct:]` | 구두점 기호 | `\A`, `\Z` | 문자열의 시작, 끝 |

> 시험 포인트: `[:digit:]`를 대괄호 한 겹으로만 쓰면 문자 클래스가 아니라 `:`, `d`, `i`, `g`, `t` 문자들의 집합이 된다. 올바른 표기는 `[[:digit:]]`이다.

## 백레퍼런스

`\n`(n은 1~9)은 앞에서 **n번째 괄호 그룹에 일치한 문자열**을 다시 가리킨다. 패턴 안에서 같은 문자열의 반복을 찾거나, 치환 문자열에서 그룹 순서를 바꿀 때 쓴다.

```sql
SELECT REGEXP_SUBSTR('bookkeeper', '(.)\1') FROM DUAL;
-- 'oo' : 같은 문자가 연속된 첫 부분

SELECT REGEXP_REPLACE('2024-10-15',
                      '(\d{4})-(\d{2})-(\d{2})', '\3/\2/\1') FROM DUAL;
-- '15/10/2024' : 그룹 순서 재배치
```

::: flow
- **\1** `(\d{4})` → 2024
- **\2** `(\d{2})` → 10
- **\3** `(\d{2})` → 15
- **'\3/\2/\1'** 15/10/2024
:::

## 탐욕적 일치와 비탐욕적 일치

반복 지정자는 기본적으로 **가능한 한 길게** 일치(탐욕적, greedy)한다. 지정자 뒤에 `?`를 붙이면 **가능한 한 짧게** 일치(비탐욕적, non-greedy)한다.

<figure class="md-figure">
<svg viewBox="0 0 660 136" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="문자열 a b 태그에서 탐욕적 패턴은 전체를, 비탐욕적 패턴은 첫 태그만 일치하는 그림">
<text x="20" y="47" font-size="13" font-weight="700" fill="var(--foreground)">탐욕적 · &lt;.+&gt;</text>
<rect x="196" y="20" width="224" height="44" rx="8" fill="oklch(0.75 0.16 75)" fill-opacity="0.3"/>
<rect x="200" y="24" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="236" y="24" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="272" y="24" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="308" y="24" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="344" y="24" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="380" y="24" width="36" height="36" fill="var(--card)" stroke="var(--border)"/>
<text y="47" font-size="14" font-family="monospace" text-anchor="middle" fill="var(--foreground)"><tspan x="218">&lt;</tspan><tspan x="254">a</tspan><tspan x="290">&gt;</tspan><tspan x="326">&lt;</tspan><tspan x="362">b</tspan><tspan x="398">&gt;</tspan></text>
<text x="436" y="47" font-size="12" fill="var(--muted-foreground)">결과 &lt;a&gt;&lt;b&gt; · 끝까지 길게</text>
<text x="20" y="111" font-size="13" font-weight="700" fill="var(--foreground)">비탐욕적 · &lt;.+?&gt;</text>
<rect x="196" y="84" width="116" height="44" rx="8" fill="oklch(0.62 0.17 255)" fill-opacity="0.25"/>
<rect x="200" y="88" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="236" y="88" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="272" y="88" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="308" y="88" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="344" y="88" width="36" height="36" fill="var(--card)" stroke="var(--border)"/><rect x="380" y="88" width="36" height="36" fill="var(--card)" stroke="var(--border)"/>
<text y="111" font-size="14" font-family="monospace" text-anchor="middle" fill="var(--foreground)"><tspan x="218">&lt;</tspan><tspan x="254">a</tspan><tspan x="290">&gt;</tspan><tspan x="326">&lt;</tspan><tspan x="362">b</tspan><tspan x="398">&gt;</tspan></text>
<text x="436" y="111" font-size="12" fill="var(--muted-foreground)">결과 &lt;a&gt; · 첫 &gt;에서 멈춤</text>
</svg>
<figcaption>같은 문자열 &lt;a&gt;&lt;b&gt;에서 .+는 마지막 &gt;까지, .+?는 처음 만나는 &gt;까지 일치한다</figcaption>
</figure>

| 패턴 | 대상 | 결과 |
|---|---|---|
| `<.+>` | `<a><b>` | `<a><b>` |
| `<.+?>` | `<a><b>` | `<a>` |
| `\d+` | `12345` | `12345` |
| `\d+?` | `12345` | `1` |

비탐욕 지정자로는 `*?`, `+?`, `??`, `{m,n}?` 등이 있다.

## REGEXP 함수 문법

::: cards 2
- **REGEXP_LIKE** 패턴과 일치하는지 검사. 조건(TRUE/FALSE)을 돌려주며 **WHERE 절**에 쓴다.
- **REGEXP_REPLACE** 일치한 부분을 치환한 문자열. occurrence 기본 **0 = 전체 치환**.
- **REGEXP_SUBSTR** 일치한 문자열을 잘라낸다. 일치가 없으면 **NULL**.
- **REGEXP_INSTR** 일치한 위치(숫자). 일치가 없으면 **0**.
- **REGEXP_COUNT** 일치한 횟수. 겹치지 않게 센다 (11g부터).
:::

| 함수 | 문법 | 반환 |
|---|---|---|
| REGEXP_LIKE | `REGEXP_LIKE(source, pattern [, match_param])` | 조건(TRUE/FALSE) |
| REGEXP_REPLACE | `REGEXP_REPLACE(source, pattern [, replace [, position [, occurrence [, match_param]]]])` | 치환된 문자열 |
| REGEXP_SUBSTR | `REGEXP_SUBSTR(source, pattern [, position [, occurrence [, match_param [, subexpr]]]])` | 일치한 문자열 |
| REGEXP_INSTR | `REGEXP_INSTR(source, pattern [, position [, occurrence [, return_opt [, match_param [, subexpr]]]]])` | 일치 위치(숫자) |
| REGEXP_COUNT | `REGEXP_COUNT(source, pattern [, position [, match_param]])` | 일치 횟수 |

::: info 공통 인수
- **position**: 검색 시작 위치(기본 1)
- **occurrence**: 몇 번째 일치를 대상으로 할지(기본 1). REGEXP_REPLACE는 기본 0이며 0은 모든 일치를 치환한다.
- **return_opt**: 0이면 일치 시작 위치, 1이면 일치가 끝난 다음 위치(기본 0)
- **subexpr**: 몇 번째 괄호 그룹을 반환할지(기본 0, 전체 일치)
:::

### REGEXP_LIKE

WHERE 절 조건으로 사용하며 **SELECT 절에 값처럼 쓸 수 없다**.

::: example REGEXP_LIKE: 휴대폰 번호 형식 검사
```sql
SELECT ENAME, PHONE
FROM   EMP
WHERE  REGEXP_LIKE(PHONE, '^010-[0-9]{4}-[0-9]{4}$');

SELECT ENAME FROM EMP
WHERE  REGEXP_LIKE(ENAME, '^a', 'i');   -- a 또는 A로 시작
```

`'010-1234-5678'`은 통과하고, `^`와 `$`로 양 끝을 고정했으므로 `'010-1234-56789'`처럼 뒤에 문자가 더 붙은 값은 탈락한다.
:::

### REGEXP_REPLACE

::: example REGEXP_REPLACE: 입력과 결과
| 식 | 결과 |
|---|---|
| `REGEXP_REPLACE('010-1234-5678', '[0-9]', '*')` | `***-****-****` |
| `REGEXP_REPLACE('010-1234-5678', '[0-9]', '*', 1, 2)` | `0*0-1234-5678` |
| `REGEXP_REPLACE('a  b   c', ' +', ' ')` | `a b c` |
| `REGEXP_REPLACE('abc123', '[0-9]')` | `abc` |

치환 문자열을 생략하면 일치한 부분이 **삭제**된다. occurrence를 2로 주면 두 번째 숫자(1)만 바뀐다.
:::

### REGEXP_SUBSTR

::: example REGEXP_SUBSTR: 입력과 결과
| 식 | 결과 |
|---|---|
| `REGEXP_SUBSTR('abc123def456', '\d+')` | `123` |
| `REGEXP_SUBSTR('abc123def456', '\d+', 1, 2)` | `456` |
| `REGEXP_SUBSTR('A,B,,C', '[^,]+', 1, 3)` | `C` |
| `REGEXP_SUBSTR('user@example.com', '(\w+)@(\w+)', 1, 1, NULL, 2)` | `example` |
| `REGEXP_SUBSTR('abc', '\d')` | NULL |

세 번째 예에서 `[^,]+`는 1자 이상을 요구하므로 비어 있는 항목(콤마 두 개 사이)은 건너뛰고 A, B, C 순으로 일치한다. 일치하는 부분이 없으면 **NULL**을 반환한다.
:::

### REGEXP_INSTR

<figure class="md-figure">
<svg viewBox="0 0 640 112" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard Variable, Pretendard, sans-serif" role="img" aria-label="abc123def456에서 숫자 덩어리의 위치를 표시한 그림">
<rect x="200" y="36" width="120" height="36" fill="oklch(0.62 0.17 255)" fill-opacity="0.25"/>
<rect x="440" y="36" width="120" height="36" fill="oklch(0.65 0.14 160)" fill-opacity="0.25"/>
<path d="M80 36 H560 V72 H80 Z M120 36 V72 M160 36 V72 M200 36 V72 M240 36 V72 M280 36 V72 M320 36 V72 M360 36 V72 M400 36 V72 M440 36 V72 M480 36 V72 M520 36 V72" fill="none" stroke="var(--border)"/>
<text y="28" font-size="11" text-anchor="middle" fill="var(--muted-foreground)"><tspan x="100">1</tspan><tspan x="140">2</tspan><tspan x="180">3</tspan><tspan x="220">4</tspan><tspan x="260">5</tspan><tspan x="300">6</tspan><tspan x="340">7</tspan><tspan x="380">8</tspan><tspan x="420">9</tspan><tspan x="460">10</tspan><tspan x="500">11</tspan><tspan x="540">12</tspan></text>
<text y="59" font-size="14" font-family="monospace" text-anchor="middle" fill="var(--foreground)"><tspan x="100">a</tspan><tspan x="140">b</tspan><tspan x="180">c</tspan><tspan x="220">1</tspan><tspan x="260">2</tspan><tspan x="300">3</tspan><tspan x="340">d</tspan><tspan x="380">e</tspan><tspan x="420">f</tspan><tspan x="460">4</tspan><tspan x="500">5</tspan><tspan x="540">6</tspan></text>
<path d="M220 74 V86 M340 74 V86 M460 74 V86" stroke="var(--primary)" stroke-width="2"/>
<text y="102" font-size="11" text-anchor="middle" fill="var(--primary)" font-weight="700"><tspan x="220">4 (기본)</tspan><tspan x="340">7 (return_opt 1)</tspan><tspan x="460">10 (2번째 일치)</tspan></text>
</svg>
<figcaption>'abc123def456'에서 \d+의 일치 위치. 첫 일치 '123'은 4~6번째, 두 번째 일치 '456'은 10~12번째</figcaption>
</figure>

::: example REGEXP_INSTR: 입력과 결과
| 식 | 결과 |
|---|---|
| `REGEXP_INSTR('abc123def456', '\d+')` | 4 |
| `REGEXP_INSTR('abc123def456', '\d+', 1, 2)` | 10 |
| `REGEXP_INSTR('abc123def456', '\d+', 1, 1, 1)` | 7 |
| `REGEXP_INSTR('abcdef', '\d')` | 0 |

return_opt가 1이면 일치한 '123'(4~6번째)의 **다음 위치**인 7을 반환한다. 일치가 없으면 **0**이다.
:::

### REGEXP_COUNT

::: example REGEXP_COUNT: 입력과 결과
| 식 | 결과 |
|---|---|
| `REGEXP_COUNT('banana', 'a')` | 3 |
| `REGEXP_COUNT('banana', 'an')` | 2 |
| `REGEXP_COUNT('aaaa', 'aa')` | 2 |
| `REGEXP_COUNT('Apple apple', 'apple', 1, 'i')` | 2 |

일치 횟수는 **겹치지 않게** 센다. 'aaaa'에서 'aa'는 1~2, 3~4번째 두 번만 센다.
:::

> 시험 포인트: REGEXP_REPLACE의 occurrence 기본값은 0(전체 치환)이고 REGEXP_SUBSTR·REGEXP_INSTR의 기본값은 1(첫 번째 일치)이다. 일치가 없을 때 REGEXP_SUBSTR은 NULL, REGEXP_INSTR과 REGEXP_COUNT는 0을 반환한다.

## 매치 옵션

match_param에는 아래 문자를 하나 이상 조합해 넣는다.

| 옵션 | 의미 |
|---|---|
| `i` | 대소문자를 구분하지 않음 |
| `c` | 대소문자를 구분함 (일반적인 기본 동작) |
| `n` | `.`이 줄바꿈 문자와도 일치 |
| `m` | 다중 행 모드. `^`와 `$`가 각 줄의 시작과 끝에 일치 |
| `x` | 패턴 안의 공백 문자를 무시 |

```sql
SELECT REGEXP_COUNT('SQL sql Sql', 'sql')         FROM DUAL;  -- 1
SELECT REGEXP_COUNT('SQL sql Sql', 'sql', 1, 'i') FROM DUAL;  -- 3
SELECT REGEXP_SUBSTR('a b c', 'a b', 1, 1, 'x')   FROM DUAL;  -- NULL (패턴이 'ab'로 해석)
```

`i`와 `c`를 함께 주면 **마지막에 쓴 옵션**이 적용된다.

> 시험 포인트: 기본적으로 `.`은 줄바꿈 문자와 일치하지 않고, `^`와 `$`는 문자열 전체의 시작과 끝만 가리킨다. 각각 `n`, `m` 옵션으로 바꿀 수 있다.

## DBMS별 참고

::: info 버전과 지원 범위
- Oracle은 10g부터 REGEXP_LIKE, REGEXP_REPLACE, REGEXP_SUBSTR, REGEXP_INSTR를, 11g부터 REGEXP_COUNT와 subexpr 인수를 지원한다.
- SQL Server는 전통적으로 LIKE의 `[ ]`, `[^ ]` 와일드카드 정도만 지원했으며, 정규 표현식 함수는 최신 버전에서야 추가되었다. 시험은 Oracle 문법 기준으로 대비한다.
- 일반 문자열 함수(SUBSTR, INSTR, REPLACE)는 [함수](/theory/functions)를 참고한다.
:::

## 핵심 요약

- `.`은 임의의 한 문자, `^`·`$`는 시작·끝, `[ ]`는 문자 집합, `[^ ]`는 제외 집합이다.
- `*`(0회 이상), `+`(1회 이상), `?`(0~1회), `{m,n}`(m~n회)으로 반복을 지정한다.
- POSIX 클래스는 `[[:digit:]]`처럼 대괄호 두 겹으로 쓰고, `\d`·`\w`·`\s`는 Perl 확장이다.
- 백레퍼런스 `\1`~`\9`는 괄호 그룹에 일치한 문자열을 재사용한다.
- 반복 지정자는 기본이 탐욕적이며 뒤에 `?`를 붙이면 최소 일치가 된다.
- REGEXP_REPLACE는 기본 전체 치환, REGEXP_SUBSTR·INSTR는 기본 첫 번째 일치 대상이다.
- 일치가 없으면 SUBSTR은 NULL, INSTR·COUNT는 0을 반환한다.
- 매치 옵션 i(대소문자 무시), c(구분), n(. 줄바꿈 포함), m(다중 행), x(공백 무시)를 기억한다.
