# taxbot-onboard — 신규 수임 서류 자동 생성 (내부용)

직원이 고정 링크를 열어 고객이 보낸 사진 3장(사업자등록증·신분증·통장사본)을 올리면 OCR로 채워지고, 기장료·시작월·연락처만 입력하면 서류 6종이 만들어져 사무실 메일로 발송됨. 콩벤처스 API 의존 없음 (택스봇·홈택스 수임요청은 하지 않음 — 수임동의는 직원이 홈택스에서 직접).

## 만드는 서류 6종
| 파일 | 형식 | 템플릿 |
|---|---|---|
| 자동이체 이용 신청서 (CMS) | JPG | `forms.js` → `cms()` |
| 홈택스 세무대리정보 이용(해지)신청서 [별지 제6호] | PDF | `hometax()` — 국세청 제출용이라 원본 서식 PDF를 배경(`assets/hometax_bg.png`)으로 깔고 값만 좌표에 얹음 |
| 건강보험 EDI 업무대행 위임장 [별지 제6호] | PDF | `nhis()` |
| 보험사무대행기관 사무위탁서 (고용·산재) | PDF | `goyong()` |
| 국민연금 웹 EDI 업무대행 신청서 [별지 제4호] | PDF | `pension()` |
| 더빌 MEM 엑셀 | XLS | `assets/dbill_template.xls` 에 4행 추가 (`excelRow()`) |

문구·배치는 전부 `forms.js` 한 파일. 원본 HWP 문구를 그대로 옮김.
도장은 모든 "(서명 또는 인)" 위에 이미지로 찍힘: 고객 = `assets/seal_client.png`(현재 샘플, 교체 예정), 사무실 = `assets/seal_office.png`(代表之印). 교체하려면 같은 파일명으로 덮어쓰기(흰 배경은 자동 투명 처리 안 되니 투명 PNG 권장).

## 구성
| 파일 | 역할 | 배포 |
|---|---|---|
| `index.html` `forms.js` `assets/` `vendor/` | 화면·OCR 호출·서류 렌더링(html2canvas → JPG/PDF, SheetJS → XLS) | GitHub Pages `https://cozytax.github.io/taxbot-onboard/` |
| `worker.js` | 직원키 확인·사무실 설정 전달·OCR 결과 검증·Resend 메일 발송 | Cloudflare Workers (GitHub 연동 자동 배포) |

## Cloudflare 변수 (Settings → Variables and Secrets)
| Name | Type | 값 |
|---|---|---|
| `STAFF_KEY` | Secret | 직원 접근 키 (페이지 `?k=` 값) |
| `ANTHROPIC_API_KEY` | Secret | OCR 엔진 (없으면 `GEMINI_API_KEY` 사용) |
| `RESEND_API_KEY` | Secret | resend.com API 키 |
| `MAIL_FROM` | Secret | 도메인 인증 전 `onboarding@resend.dev`, 인증 후 `onboard@cozytax.co.kr` |
| `MAIL_TO` | Secret | 결과 수신 (쉼표로 여러 명) |
| `OFFICE_JSON` | Secret | 사무실 정보 보정값. **대표자 주민번호는 여기에만**: `{"repRrn":"930510-1******"}` 형태. 다른 항목(name, rep, repBirth, bizNo, address, phone, mobile, taxAgentNo, depositDate, paymm)도 덮어쓰기 가능 |
| `OCR_MODEL` | Variable | `claude-sonnet-5-5` (wrangler.toml) |
| `ALLOWED_ORIGIN` | Variable | `https://cozytax.github.io` |

## 사용
1. `https://cozytax.github.io/taxbot-onboard/?k=STAFF_KEY` (한 번 열면 브라우저에 키 저장)
2. 사진 3장 → 인식하기 → 값 확인·수정 → 기장료·이체시작월·휴대폰(·이메일·홈택스ID/PW) 입력 → **서류 6종 생성**
3. 미리보기에서 각 파일 다운로드 가능 → **메일 보내기** → MAIL_TO 로 6종 첨부 발송
4. 홈택스 수임동의 요청은 직원이 홈택스에서 직접

## 동작 메모
- OCR 호출은 **직원 브라우저에서 직접** (Cloudflare Worker 발신 IP가 Google·Anthropic 미지원 지역으로 잡혀 서버 호출 불가). Worker는 키 전달·결과 검증만.
- 이미지는 서버 저장 없음. 주민번호·홈택스 ID/PW는 결과 메일 본문에 포함 → 메일함 보안 전제.
- `assets/dbill_template.xls` 는 더빌에서 받은 원본. 셀 서식(노란색)은 SheetJS 저장 시 사라지고 값·헤더만 유지됨 — 더빌 업로드엔 영향 없음(확인 필요하면 첫 업로드 때 체크).
- 사업장관리번호는 사업자번호+`-0` (기존 관행).

## 검증 로직 (경고만)
사업자번호 10자리·법인 판정(가운데 81~88) / 주민번호 검증숫자 / 생년월일↔주민번호 / 대표자명↔신분증↔예금주 / 은행코드 매핑
