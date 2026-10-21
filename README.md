# taxbot-onboard — 신규 수임 등록 (내부용)

Tally 폼 대체. 직원이 고정 링크를 열어 고객이 보낸 사진 3장(사업자등록증·신분증·통장사본)을 올리면 OCR로 채워지고, 기장료·시작월·연락처·홈택스 정보만 입력 후 제출 → 기존 taxbot Worker API 4개 호출 → 결과 메일(첨부 3종).

## 구성
| 파일 | 배포 위치 |
|---|---|
| `index.html` | GitHub Pages — `https://cozytax.github.io/taxbot-onboard/` |
| `worker.js` | Cloudflare Workers (신규 Worker `taxbot-onboard`) |
| `wrangler.toml` | Worker 설정 (시크릿 미포함) |

기존 콩벤처스 Worker 코드는 건드리지 않음. `/register` `/agree-cms` `/agree-tax` `/excel` 을 그대로 호출.
4대보험 위임장 3종은 명세에 없지만 `/agree-tax?...&type=health|goyong|yungum` 으로 생성됨(기존 메일 링크에서 확인).
기존 Worker 주소(`TAXBOT_BASE`)는 무인증 GET API라 **코드·저장소에 넣지 않고 secret 으로만** 등록.

## 배포
```bash
npm i -g wrangler
wrangler login
wrangler secret put TAXBOT_BASE      # https://taxbot.kongventures.workers.dev
wrangler secret put ANTHROPIC_API_KEY # console.anthropic.com → API Keys
wrangler secret put STAFF_KEY        # 직원 접근 키 (아무 문자열)
wrangler secret put RESEND_API_KEY   # resend.com → API Keys
wrangler deploy
```
`wrangler.toml` 의 `[vars]` 에 MAIL_FROM, MAIL_TO 확인.

메일 발송은 Resend 사용: resend.com 가입 → Domains 에 `cozytax.co.kr` 추가하고 안내되는 DNS 레코드(SPF/DKIM) 등록 → API Keys 발급.
도메인 인증 전에는 `MAIL_FROM = "onboarding@resend.dev"` 로 두면 가입한 본인 메일로만 테스트 발송 가능.
`index.html` 상단 `WORKER_BASE` 를 배포된 Worker 주소로 교체 후 커밋 → GitHub Pages 자동 반영.

## 사용 (직원)
1. `https://cozytax.github.io/taxbot-onboard/?k=STAFF_KEY` 접속 (한 번 열면 브라우저에 키 저장, 이후 `?k=` 없이도 됨)
2. 사진 3장 업로드 → 인식하기
3. 인식값 확인·수정, 기장료·이체시작월·고객 휴대폰·이메일·홈택스 ID/PW 입력 → 제출
4. MAIL_TO 로 결과 메일 도착 (첨부 6종: CMS신청서 jpg·세무대리신청서 pdf·MEM 엑셀·건강보험EDI/고용산재/국민연금 위임장 pdf + 택스봇 등록 응답)

이체일 20일 고정(`DEPOSIT_DATE`).

## OCR 엔진
Claude API(`ANTHROPIC_API_KEY`) 사용. Gemini는 Cloudflare Worker 발신 IP를 미지원 지역으로 판정해 400(FAILED_PRECONDITION)이 나서 제외. `GEMINI_API_KEY`만 있고 `ANTHROPIC_API_KEY`가 없으면 Gemini로 폴백.

## 개인정보 처리
- 이미지는 `/ocr` 요청 처리 중 메모리에서만 쓰고 저장하지 않음
- `/ocr` `/submit` 모두 `STAFF_KEY` 없이는 동작 안 함
- 주민번호·홈택스 ID/PW 가 결과 메일 본문에 포함됨 → 사무실 메일함 보안 전제

## 확인 필요 (명세에 없어 가정한 값)
| 항목 | 가정 | 위치 |
|---|---|---|
| 홈택스 ID/PW 전달 경로 | 기존 API 어디에도 없음 → 메일 본문에만 포함 | submit() |
| `/register` 응답 형식 | HTML/텍스트로 가정, 메일에 앞 500자 표시 | callText() |
| 운전면허증 | 프롬프트는 주민등록증 기준 | OCR_PROMPT |

## 검증 로직 (경고만, 제출 차단 안 함)
- 사업자번호 10자리 / 가운데 81~88 → 법인 자동 판정
- 주민번호 검증숫자 (2020.10 이후 발급분은 불일치가 정상일 수 있음)
- 사업자등록증 생년월일 ↔ 주민번호 앞 6자리
- 대표자명 ↔ 신분증 성명 ↔ 예금주
- 은행명 → 은행코드 매핑 실패
