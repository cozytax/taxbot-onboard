# taxbot-onboard — 신규 수임 등록 자동화

Tally 폼 대체. 고객이 사진 3장(사업자등록증·신분증·통장사본) 업로드 → OCR → 확인·수정 → 제출 → 기존 taxbot Worker API 4개 호출 → 결과 메일.

## 구성
| 파일 | 배포 위치 |
|---|---|
| `index.html` | GitHub Pages (이 저장소, `https://<owner>.github.io/taxbot-onboard/`) |
| `worker.js` | Cloudflare Workers (신규 Worker `taxbot-onboard`) |
| `wrangler.toml` | Worker 설정 (시크릿은 포함 안 함) |

기존 콩벤처스 Worker 코드는 건드리지 않음. `/register` `/agree-cms` `/agree-tax` `/excel` 을 그대로 호출.
기존 Worker 주소(`TAXBOT_BASE`)는 무인증 GET API라 **코드·저장소에 넣지 않고 secret 으로만** 등록.

## 배포
```bash
npm i -g wrangler
wrangler login
# 시크릿 등록
wrangler secret put TAXBOT_BASE      # https://taxbot.kongventures.workers.dev
wrangler secret put GEMINI_API_KEY
wrangler secret put STAFF_KEY        # 직원용 링크 생성 키 (아무 문자열)
wrangler secret put SIGN_SECRET      # 링크 서명 키 (긴 랜덤 문자열)
wrangler secret put POSTMARK_TOKEN
wrangler deploy
```
`wrangler.toml` 의 `[vars]` 에 MAIL_FROM, MAIL_TO, PAGE_URL, ALLOWED_ORIGIN 확인.
`index.html` 상단 `WORKER_BASE` 를 배포된 Worker 주소로 교체 후 커밋 → GitHub Pages 자동 반영.

GitHub Pages: 저장소 Settings → Pages → Source: `main` / `/ (root)`.

## 사용 흐름 (직원)
1. 브라우저에서 링크 생성
   `https://taxbot-onboard.xxx.workers.dev/link?amount=110000&start=202611&key=STAFF_KEY`
   → 응답의 `link` 를 고객에게 카톡/문자로 전달
2. 고객이 제출하면 MAIL_TO 로 결과 메일(첨부: CMS신청서 jpg·세무대리신청서 pdf·MEM 엑셀) 도착
3. 메일의 "택스봇·홈택스 등록" 응답 확인 → 실패 시 수동 처리

이체일은 20일 고정(`DEPOSIT_DATE`), 기장료·이체시작월은 링크에 서명되어 고객이 변조 불가.

## 개인정보 처리
- 이미지는 `/ocr` 요청 처리 중 메모리에서만 쓰고 저장하지 않음 (Tally 파일저장 없음)
- `/ocr` `/submit` 모두 서명된 링크(amount·start·sig)가 있어야 동작 → 링크 없이 Worker 를 직접 호출해 OCR 비용을 태우거나 등록을 넣을 수 없음
- 주민번호는 메일 본문에 전체 표시됨 → 사무실 메일함 보안 전제
- 홈택스 ID/PW 도 메일 본문에 포함 → **결정 필요**: 기존 Tally 흐름에서는 어디로 전달됐는지 명세에 없음. 다른 경로(택스봇 등록 시 입력 등)가 있으면 알려주면 거기로 보내게 수정

## 확인 필요 (명세에 없어 가정한 값)
| 항목 | 가정 | 위치 |
|---|---|---|
| `/excel` `membername` | 상호(bizName) | worker.js submit() |
| `/excel` `paymm` | 12 (예시값 그대로) — 의미 불명 | env `CMS_PAYMM` |
| `/register` 응답 형식 | HTML/텍스트로 가정, 메일에 앞 500자 표시 | callText() |
| Gemini 모델명 | `gemini-2.5-flash` — 사용 가능 모델로 교체 | env `GEMINI_MODEL` |
| 운전면허증 | 프롬프트는 주민등록증 기준. 면허증도 대체로 읽히지만 테스트 필요 | OCR_PROMPT |

## 검증 로직 (경고로 표시, 제출 차단은 안 함)
- 사업자번호 10자리 / 가운데 81~88 → 법인 자동 판정
- 주민번호 검증숫자 (2020.10 이후 발급분은 불일치가 정상일 수 있음)
- 사업자등록증 생년월일 ↔ 주민번호 앞 6자리
- 대표자명 ↔ 신분증 성명 ↔ 예금주
- 은행명 → 은행코드 매핑 실패
