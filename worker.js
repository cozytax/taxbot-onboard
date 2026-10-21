/**
 * taxbot-onboard Worker — 내부용 신규 수임 서류 생성
 *
 * 서류 6종은 브라우저(index.html + forms.js)에서 그려서 파일로 만들고,
 * 이 Worker 는 (1) 직원키 확인 후 설정 전달 (2) OCR 결과 검증 (3) 결과 메일 발송만 담당.
 *
 * 라우트 (모두 POST, body.key === STAFF_KEY 필요)
 *   /config         사무실 정보 + OCR 엔진 정보 반환
 *   /ocr-normalize  브라우저가 받은 OCR 원문 JSON → 정규화·교차검증
 *   /send           첨부파일 + 요약 → Resend 메일
 *
 * 환경변수
 *   STAFF_KEY            직원 접근 키 (페이지 ?k= 값)
 *   ANTHROPIC_API_KEY    OCR 엔진 (있으면 Claude 우선), OCR_MODEL (기본 claude-sonnet-5-5)
 *   GEMINI_API_KEY       Anthropic 키 없을 때 사용, GEMINI_MODEL (기본 gemini-2.5-flash)
 *   RESEND_API_KEY, MAIL_FROM, MAIL_TO(쉼표 구분)
 *   OFFICE_JSON          사무실 정보 JSON (secret) — 아래 OFFICE_DEFAULT 와 병합. 대표자 주민번호(repRrn)는 여기에만.
 *   ALLOWED_ORIGIN       CORS (기본 *)
 */

const OFFICE_DEFAULT = {
  name: "편한세무회계",
  rep: "편성웅",
  repBirth: "1993-05-10",
  repRrn: "",                       // OFFICE_JSON secret 으로만 공급
  bizNo: "115-23-01799",
  address: "서울특별시 서초구 강남대로 535, 14층 (반포동, 프린스빌딩)",
  phone: "02-6268-2000",
  mobile: "010-5825-0510",
  taxAgentNo: "Z-2676-4",
  depositDate: "20",                // 이체일
  paymm: "12",                      // 더빌 납부횟수
};

const BANK_CODES = {
  "국민": "004", "KB": "004", "농협": "011", "NH": "011", "하나": "081", "신한": "088",
  "카카오": "090", "토스": "092", "케이": "089", "기업": "003", "IBK": "003",
  "산업": "002", "외환": "005", "수협": "007", "우리": "020", "SC제일": "023", "제일": "023", "씨티": "027",
  "대구": "031", "iM": "031", "부산": "032", "광주": "034", "제주": "035", "전북": "037", "경남": "039",
  "새마을": "045", "신협": "048", "우체국": "071",
};

const OCR_PROMPT = `
너는 한국 세무사무소의 문서 입력 담당자다. 세 장의 이미지에서 아래 항목을 추출해 JSON만 출력하라.
이미지 순서: [1] 사업자등록증 [2] 주민등록증(또는 운전면허증) [3] 통장사본(계좌확인서)
읽을 수 없거나 없는 항목은 null. 숫자는 보이는 그대로(하이픈 포함) 적되 추측하지 마라.

{
  "biz": {
    "regType": "사업자등록증 제목 괄호 안 문구 (예: 간이과세자 - 세금계산서 발급사업자 / 일반과세자 / 법인사업자)",
    "bizNo": "등록번호 (000-00-00000)",
    "bizName": "상호",
    "repName": "성명 또는 대표자",
    "birthDate": "생년월일 (YYYY-MM-DD)",
    "openDate": "개업연월일 (YYYY-MM-DD)",
    "address": "사업장소재지 전체",
    "category": "업태",
    "item": "종목",
    "corpRegNo": "법인등록번호 (법인인 경우만, 없으면 null)"
  },
  "id": {
    "name": "성명 (한글만, 한자 제외)",
    "rrn": "주민등록번호 13자리 (000000-0000000). 한 자리라도 불확실하면 null",
    "address": "주소 전체",
    "issueDate": "발급일 (YYYY-MM-DD)"
  },
  "bank": {
    "bankName": "은행명 (예: 카카오뱅크, 국민은행)",
    "accountNumber": "계좌번호 (하이픈 포함)",
    "holder": "예금주 (괄호·'님' 제외한 이름만)",
    "holderRaw": "예금주 원문 그대로"
  }
}
`.trim();

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = corsHeaders(env);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    try {
      if (req.method !== "POST") return json({ ok: false, error: "not found" }, cors, 404);
      const body = await req.json();
      checkKey(body, env);
      if (url.pathname === "/config") return json(config(env), cors);
      if (url.pathname === "/ocr-normalize") return json(normalize(body.raw || {}), cors);
      if (url.pathname === "/send") return json(await send(body, env), cors);
      return json({ ok: false, error: "not found" }, cors, 404);
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) }, cors, 500);
    }
  },
};

/* ---------- /config ---------- */
function config(env) {
  let extra = {};
  try { extra = env.OFFICE_JSON ? JSON.parse(env.OFFICE_JSON) : {}; } catch { throw new Error("OFFICE_JSON 형식 오류"); }
  const office = { ...OFFICE_DEFAULT, ...extra };
  let ocr;
  if (env.ANTHROPIC_API_KEY) ocr = { provider: "anthropic", apiKey: env.ANTHROPIC_API_KEY, model: env.OCR_MODEL || "claude-sonnet-5-5" };
  else if (env.GEMINI_API_KEY) ocr = { provider: "gemini", apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-2.5-flash" };
  else throw new Error("OCR API 키가 설정되지 않았습니다");
  return { ok: true, office, ocr: { ...ocr, prompt: OCR_PROMPT }, mailTo: env.MAIL_TO || "" };
}

/* ---------- /ocr-normalize ---------- */
function normalize(raw) {
  const biz = raw.biz || {}, id = raw.id || {}, bank = raw.bank || {};
  const bizNoD = digits(biz.bizNo);
  const mid = bizNoD.slice(3, 5);
  const bizType = bizNoD.length === 10 && +mid >= 81 && +mid <= 88 ? "02" : "01";
  const rrn = fmtRrn(id.rrn);
  const warnings = [];

  if (bizNoD.length !== 10) warnings.push("사업자등록번호 10자리 인식 실패 — 직접 확인");
  if (!rrn) warnings.push("주민등록번호 인식 불확실 — 직접 입력 필요");
  else if (!rrnChecksum(rrn)) warnings.push("주민등록번호 검증숫자 불일치 — 오인식 가능성 (2020.10 이후 발급은 정상일 수 있음)");
  if (rrn && biz.birthDate && digits(biz.birthDate).slice(2, 8) !== rrn.slice(0, 6))
    warnings.push("사업자등록증 생년월일과 주민번호 앞자리 불일치");
  if (biz.repName && id.name && norm(biz.repName) !== norm(id.name))
    warnings.push(`대표자명 불일치: 사업자등록증 '${biz.repName}' / 신분증 '${id.name}'`);
  if (bank.holder && biz.repName && !norm(bank.holderRaw || bank.holder).includes(norm(biz.repName)))
    warnings.push(`예금주 '${bank.holder}' 와 대표자명 불일치`);
  const bankCd = bankCode(bank.bankName);
  if (bank.bankName && !bankCd) warnings.push(`은행코드 매핑 실패: '${bank.bankName}'`);

  return {
    ok: true,
    fields: {
      bizType, regType: biz.regType || null, bizNo: fmtBizNo(bizNoD), bizName: biz.bizName || null,
      repName: biz.repName || id.name || null, birthDate: biz.birthDate || null, openDate: biz.openDate || null,
      bizAddress: biz.address || null, category: biz.category || null, item: biz.item || null, corpRegNo: biz.corpRegNo || null,
      rrn, homeAddress: id.address || null,
      bankName: shortBank(bank.bankName), bankCode: bankCd, accountNumber: bank.accountNumber || null, accountHolder: bank.holder || null,
    },
    warnings,
  };
}

/* ---------- /send ---------- */
async function send(p, env) {
  const c = p.client || {};
  if (!c.bizName) throw new Error("상호 누락");
  const files = Array.isArray(p.files) ? p.files : [];
  if (!files.length) throw new Error("첨부파일 없음");
  const attachments = files.map((f) => ({ filename: f.filename, content: f.content }));

  const row = (k, v) => `<tr><td style="color:#666;padding:4px 12px 4px 0;white-space:nowrap">${k}</td><td>${esc(v)}</td></tr>`;
  const html = `
    <h2>신규 수임 — ${esc(c.bizName)}</h2>
    <table>
      ${row("구분", c.bizType === "02" ? "법인" : "개인")}${row("과세유형", c.regType)}
      ${row("사업자번호", c.bizNo)}${row("상호", c.bizName)}${row("대표자", c.repName)}${row("주민번호", c.rrn)}
      ${row("개업일", c.openDate)}${row("사업장", c.bizAddress)}${row("업태/종목", `${c.category || ""} / ${c.item || ""}`)}${row("자택주소", c.homeAddress)}
      ${row("휴대폰", c.phone)}${row("이메일", c.email)}${row("홈택스 ID", c.hometaxId)}${row("홈택스 PW", c.hometaxPw)}
      ${row("계좌", `${c.bankName || ""}(${c.bankCode || ""}) ${c.accountNumber || ""} / ${c.accountHolder || ""}`)}
      ${row("월 기장료", Number(digits(c.amount)).toLocaleString() + "원")}${row("이체 시작월", c.start)}
    </table>
    <p>첨부: ${files.map((f) => esc(f.filename)).join(", ")}</p>
    <h3>선물 요청 카톡 (복붙용)</h3>
    <pre style="background:#f6f6f6;border:1px solid #e5e5e5;border-radius:6px;padding:12px 14px;font-family:inherit;font-size:14px;line-height:1.6;white-space:pre-wrap">안녕하세요. 저희가 업체를 새로 수임하게 돼서
선물 부탁드리려고 합니다

업체명 : ${esc(c.bizName)}
전화번호 : ${esc(c.phone)}
주소 : ${esc(c.bizAddress)}

입니다. 잘 부탁드리겠습니다. 늘 감사합니다^^</pre>
    <p style="color:#999;font-size:12px">${esc(p.stamp || "")} · 수임 등록 페이지에서 자동 생성</p>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", "Authorization": `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: String(env.MAIL_TO || "").split(",").map((x) => x.trim()).filter(Boolean),
      subject: `[신규수임] ${c.bizName} (${c.bizNo || ""})`,
      html, attachments,
    }),
  });
  if (!r.ok) throw new Error(`메일 발송 실패 ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { ok: true };
}

/* ---------- helpers ---------- */
function checkKey(p, env) {
  if (!env.STAFF_KEY || p?.key !== env.STAFF_KEY) throw new Error("접근 키가 올바르지 않습니다");
}
function corsHeaders(env) {
  return { "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "content-type" };
}
function json(obj, headers, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}
const digits = (s) => String(s ?? "").replace(/\D/g, "");
const norm = (s) => String(s ?? "").replace(/\s/g, "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function fmtBizNo(d) { return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d; }
function fmtRrn(s) { const d = digits(s); return d.length === 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : null; }
function rrnChecksum(rrn) {
  const d = digits(rrn); if (d.length !== 13) return false;
  const w = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * w[i];
  return (11 - (s % 11)) % 10 === +d[12];
}
function shortBank(name) { return String(name ?? "").replace(/\(주\)|주식회사|은행|뱅크|\s/g, "") || null; }
function bankCode(name) { const n = norm(name); if (!n) return ""; for (const [k, v] of Object.entries(BANK_CODES)) if (n.includes(k)) return v; return ""; }
