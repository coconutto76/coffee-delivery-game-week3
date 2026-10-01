# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 저장소 성격

프롬프트 구조화 수업(Week 3) 실습 저장소다. 게임 자체보다 "요청을 어떻게 쓰면 원하는 결과가 나오는가"를 비교하는 것이 목적이다.

- `index.html` — 수업 원본 게임. **수정하지 않는다** (before/after의 공통 출발점).
- `before/` — 막연한 요청(A)으로 수정한 결과.
- `after/` — 구조화한 요청(B)으로 수정한 결과.
- `WORKSHEET.md` (루트) — 실제로 작성된 실습 기록지. A/B 프롬프트 원문, 확인 결과, 회고가 들어 있다. `before/`·`after/` 안의 `WORKSHEET.md`는 빈 양식이다.

## 명령어

설치·빌드·서버 없음. 게임은 `index.html`을 브라우저로 직접 열어 실행한다.

```sh
node --test tests/game.test.cjs          # 원본
node --test before/tests/game.test.cjs   # A 버전
node --test after/tests/game.test.cjs    # B 버전
```

각 `tests/`는 같은 폴더의 `../index.html`을 읽으므로 폴더별로 따로 실행한다. `node --test tests/`처럼 디렉터리를 넘기면 실패한다. 특정 테스트만: `node --test --test-name-pattern="<이름 일부>" <파일>`.

## 아키텍처 (index.html 한 파일)

- 외부 라이브러리 없는 자체 소프트웨어 3D 렌더러. 작은 구(행성) 표면 위 마을이며, 위치는 단위 벡터(`s.n`)로 표현한다(`at(lon,lat)`, `angle`, `frame` 등 벡터 유틸).
- `<script>`는 UMD 팩토리 `Daldongne`로 감싸져 있다. 브라우저에선 `root.Daldongne`, Node에선 `module.exports`.
- **순수 게임 로직** (`newGame`, `start`, `pause`, `interact`, `step`, `CAFE`/`ORDERS`/`SITES`)과 **렌더링·입력** (`makeScene`, `camera`, `draw`, `mount`)이 분리되어 있다.
- 마지막 줄 `const game=Daldongne.mount(...)` 이후가 DOM 버튼 연결 코드다.
- **테스트 의존 규약:** 테스트는 첫 `<script>` 내용을 정규식으로 꺼내 `const game=Daldongne.mount` **앞부분만** `vm`으로 실행해 exports를 쓴다. 따라서 `<script>`를 여러 개로 나누거나, 그 문자열을 바꾸거나, 로직을 그 뒤로 옮기면 테스트가 깨진다. 새 상태·규칙은 팩토리 안에 두고 export한다.
- 상태 `status`: `ready` → `playing` ⇄ `paused` → (완료). `ready`/`paused`에서는 `step`이 시간·이동을 진행하지 않는다.

## 수정 요청 처리용 시스템 프롬프트 (고정 부분)

`after/`에 쓴 구조화 프롬프트를 고정 부분과 변경 부분으로 나눈 것이다. 이 저장소의 게임 수정 요청에는 아래 고정 조건이 항상 적용된다.

```text
[현재 상황]
index.html은 카페에서 커피 네 잔을 받아 네 이웃에게 배달하는 게임이다.
HTML 파일 하나로 브라우저에서 실행된다.

[유지할 것]
게임 속 마을, 캐릭터, 이동 속도, 배달 규칙, 버튼 기능은 유지한다.
외부 라이브러리나 API를 추가하지 않는다.
파일을 나누지 않고 index.html 하나로 실행되게 한다.

[공통 완료 기준]
- 시작, 이동, 커피 받기, 배달, 일시정지, 초기화가 계속 작동한다.

[결과물]
파일을 직접 편집할 수 있으면 index.html을 수정한다.
직접 편집할 수 없다면 생략 없이 전체 HTML 코드를 제공한다.
끝에 변경한 점과 직접 확인하지 못한 점을 짧게 알린다.
```

요청마다 사용자가 채우는 **변경 부분** (`{{변수}}`만 바꿔서 재사용한다):

```text
[목표]
기존의 게임을 {{THEME}}을(를) 나타내는 긴장감 넘치는 조작 게임으로 수정한다.

[구체적인 변경]
1. 지금의 게임 엔딩 조건을 한 라운드의 엔딩 조건으로 바꾸고, 총 {{ROUND_COUNT}}라운드 동안 게임이 진행되도록 한다.
2. 각 라운드는 {{ROUND_ORDER}}을(를) 의미하고, 각 라운드는 {{ROUND_TIME}}초의 시간 제한이 있다.
   - 시간 제한은 {{TIMER_SHAPE}} 타이머로 화면 {{TIMER_POSITION}}에 창으로 띄우고, 남은 시간을 숫자로도 표시한다.
3. 라운드별 재난 영역에 들어가면 속도가 {{SLOW_FACTOR}}배가 되고 화면 색이 바뀐다.
   - {{SEASON_1}}: {{HAZARD_1}} / {{TINT_1}}
   - {{SEASON_2}}: {{HAZARD_2}} / {{TINT_2}}
   - {{SEASON_3}}: {{HAZARD_3}} / {{TINT_3}}
   - {{SEASON_4}}: {{HAZARD_4}} / {{TINT_4}}
   - 모든 효과는 영역을 벗어난 뒤 {{EFFECT_DURATION}}초 동안 지속된다.
4. 영역은 계속 {{ZONE_DIRECTION}} 방향으로 움직인다. 라운드마다 {{ZONE_COUNT}}개, 크기는 캐릭터의 {{ZONE_SCALE}}배다.
5. 각 라운드가 끝나면 배달 성공 횟수, 다음 라운드, 유의할 점을 알려준다.
6. 모든 라운드가 끝나면 총 성공 횟수와 등급을 표시한다.
   - {{GRADE_HIGH}}: {{GRADE_HIGH_MIN}}회 이상 / {{GRADE_MID}}: {{GRADE_MID_MIN}}회 이상 / 그 외 {{GRADE_LOW}}

[기능별 완료 기준] (공통 완료 기준에 추가)
- 라운드별로 각 재난 영역이 존재한다.
- 타이머, 화면 이펙트, 라운드 종료·최종 결과 창이 정상적으로 보인다.
```

| 변수 | after 값 | 비고 |
|---|---|---|
| `THEME` | 지구 이상 기후를 블랙 코미디식으로 | |
| `ROUND_COUNT` | 4 | |
| `ROUND_ORDER` | 계절(봄→여름→가을→겨울) | |
| `ROUND_TIME` | 40 | 코드 `ROUND_TIME` |
| `TIMER_SHAPE` / `TIMER_POSITION` | 원형 / 우측 상단 | |
| `SLOW_FACTOR` | 0.5 | 프롬프트에 없었음 → AI가 정함 (`SEASONS[].slow`) |
| `SEASON_n` / `HAZARD_n` / `TINT_n` | 봄 황사 노랑 · 여름 폭염 빨강 · 가을 황사 노랑 · 겨울 한파 파랑 | 코드 `SEASONS[].tint` |
| `EFFECT_DURATION` | 0.5 | |
| `ZONE_DIRECTION` | 반시계 | 기준 시점 미지정 (`ZONE_SPIN`) |
| `ZONE_COUNT` | 8 | 처음 5 → 후속 요청으로 8 |
| `ZONE_SCALE` | 10 | 코드 `ZONE_R` |
| `GRADE_HIGH/MID/LOW` | PERFECT / GREAT / GOOD | |
| `GRADE_HIGH_MIN` / `GRADE_MID_MIN` | 16 / 10 | 프롬프트에 없었음 → AI가 정함 (`grade()`) |

변수 값이 비어 있으면(예: `SLOW_FACTOR`, 등급 기준) 임의로 정하지 말고 가정을 명시하거나 묻는다 — A/B 비교에서 A가 실패한 주된 원인이었다(`WORKSHEET.md` 회고 참고).
