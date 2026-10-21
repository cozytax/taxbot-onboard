/**
 * taxbot-onboard Worker
 *
 * 내부용. 직원이 고정 링크(index.html?k=STAFF_KEY)를 열어 사용.
 *
 * 라우트
 *   POST /ocr-config     직원키 확인 → OCR 엔진 키·모델·프롬프트 반환 (브라우저가 API 직접 호출)
 *   POST /ocr-normalize  브라우저가 받은 OCR 원문 JSON → 정규화·교차검증
 *   POST /ocr            서버에서 직접 OCR (Cloudflare 에선 지역 제한으로 실패, 다른 호스팅용)
 *   POST /submit  확인된 데이터 → 기존 taxbot Worker API 호출(등록 + 서식 6종) → Resend 결과 메일
 *   모든 라우트 body.key === STAFF_KEY 필요
 *
 * 환경변수(wrangler secret / vars)
 *   ANTHROPIC_API_KEY    OCR 엔진 (권장 — Cloudflare 에서 Gemini 는 지역 제한으로 실패)
 *   OCR_MODEL            기본 claude-sonnet-5-5
 *   GEMINI_API_KEY, GEMINI_MODEL  ANTHROPIC_API_KEY 없을 때만 사용
 *   TAXBOT_BASE          기존 Worker 주소 — secret 으로 등록 (공개 저장소에 올리지 말 것)
 *   STAFF_KEY            직원 접근 키 (링크의 ?k= 값)
 *   RESEND_API_KEY       resend.com API 키
 *   MAIL_FROM            Resend 에서 인증한 도메인의 발신 주소 (예: onboard@cozytax.co.kr)
 *   MAIL_TO              결과 수신 메일 (쉼표로 여러 명 가능)
 *   ALLOWED_ORIGIN       CORS 허용 오리진 (기본 *)
 *   CMS_PAYMM            /excel 의 paymm(납부횟수, 기본 12)
 *   DEPOSIT_DATE         이체일 (기본 20)
 */

const BANK_CODES = {
  "국민": "004", "KB": "004",
  "농협": "011", "NH": "011",
  "하나": "081", "신한": "088",
  "카카오": "090", "토스": "092", "케이": "089",
  "기업": "003", "IBK": "003",
  "산업": "002", "외환": "005", "수협": "007",
  "우리": "020", "SC제일": "023", "제일": "023", "씨티": "027",
  "대구": "031", "iM": "031", "부산": "032", "광주": "034",
  "제주": "035", "전북": "037", "경남": "039",
  "새마을": "045", "신협": "048", "우체국": "071",
};

const OCR_PROMPT = `
너는 한국 세무사무소의 문서 입력 담당자다. 세 장의 이미지에서 아래 항목을 추출해 JSON만 출력하라.
이미지 순서: [1] 사업자등록증 [2] 주민등록증 [3] 통장사본(계좌확인서)
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
      if (req.method === "POST" && url.pathname === "/ocr") return json(await ocr(await req.json(), env), cors);
      if (req.method === "POST" && url.pathname === "/ocr-config") return json(ocrConfig(await req.json(), env), cors);
      if (req.method === "POST" && url.pathname === "/ocr-normalize") return json(normalize((await (async (b) => (checkKey(b, env), b))(await req.json())).raw || {}), cors);
      if (req.method === "POST" && url.pathname === "/submit") return json(await submit(await req.json(), env), cors);
      return json({ ok: false, error: "not found" }, cors, 404);
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) }, cors, 500);
    }
  },
};

/* ---------- /ocr ---------- */
async function ocr(body, env) {
  checkKey(body, env);
  const imgs = ["biz", "id", "bank"].map((k) => body?.images?.[k]).filter(Boolean);
  if (imgs.length < 1) throw new Error("이미지가 없습니다");

  const images = [];
  for (const dataUrl of imgs) {
    const m = /^data:(image\/[a-z]+);base64,(.+)$/i.exec(dataUrl);
    if (!m) throw new Error("이미지 형식 오류 (dataURL 필요)");
    images.push({ mime: m[1], data: m[2] });
  }

  // OCR 엔진: ANTHROPIC_API_KEY 가 있으면 Claude, 없으면 Gemini
  const text = env.ANTHROPIC_API_KEY ? await ocrClaude(images, env) : await ocrGemini(images, env);
  const raw = safeJson(text);

  return normalize(raw);
}

/* 브라우저 직접 호출용: 직원키 확인 후 OCR 엔진 정보 반환 (Cloudflare 발신 IP 지역 제한 우회) */
function ocrConfig(body, env) {
  checkKey(body, env);
  if (env.ANTHROPIC_API_KEY) return { ok: true, provider: "anthropic", apiKey: env.ANTHROPIC_API_KEY, model: env.OCR_MODEL || "claude-sonnet-5-5", prompt: OCR_PROMPT };
  if (env.GEMINI_API_KEY) return { ok: true, provider: "gemini", apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || "gemini-2.5-flash", prompt: OCR_PROMPT };
  throw new Error("OCR API 키가 설정되지 않았습니다");
}

/* OCR 원문 JSON → 정규화 + 교차검증 */
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
      bizType,
      regType: biz.regType || null,
      bizNo: fmtBizNo(bizNoD),
      bizName: biz.bizName || null,
      repName: biz.repName || id.name || null,
      birthDate: biz.birthDate || null,
      openDate: biz.openDate || null,
      bizAddress: biz.address || null,
      category: biz.category || null,
      item: biz.item || null,
      corpRegNo: biz.corpRegNo || null,
      rrn,
      homeAddress: id.address || null,
      bankName: shortBank(bank.bankName),
      bankCode: bankCd,
      accountNumber: bank.accountNumber || null,
      accountHolder: bank.holder || null,
    },
    warnings,
  };
}

async function ocrClaude(images, env) {
  const model = env.OCR_MODEL || "claude-sonnet-5-5";
  const content = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } }));
  content.push({ type: "text", text: OCR_PROMPT + "\n\nJSON 외의 텍스트는 출력하지 마라." });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1500, temperature: 0, messages: [{ role: "user", content }] }),
  });
  if (!r.ok) throw new Error(`OCR API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return (data?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("") || "{}";
}

async function ocrGemini(images, env) {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const parts = [{ text: OCR_PROMPT }, ...images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }))];
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { response_mime_type: "application/json", temperature: 0 } }) }
  );
  if (!r.ok) throw new Error(`OCR API ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const data = await r.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}";
}

/* ---------- /submit ---------- */
async function submit(p, env) {
  checkKey(p, env);
  // 1) 사무실 입력값
  const amount = digits(p.amount), start = digits(p.start);
  if (!amount) throw new Error("월 기장료 누락");
  if (!/^\d{6}$/.test(start)) throw new Error("이체 시작월 형식 오류 (YYYYMM)");

  // 2) 필수값
  const need = { bizNo: "사업자등록번호", bizName: "상호", repName: "대표자명", rrn: "주민등록번호",
    phone: "휴대폰", email: "이메일", bankName: "은행", accountNumber: "계좌번호", accountHolder: "예금주" };
  for (const [k, label] of Object.entries(need)) if (!String(p[k] || "").trim()) throw new Error(`${label} 누락`);

  const bizNoD = digits(p.bizNo);
  if (bizNoD.length !== 10) throw new Error("사업자등록번호 형식 오류");
  const rrn = fmtRrn(p.rrn);
  if (!rrn) throw new Error("주민등록번호 형식 오류");
  const phoneD = digits(p.phone);
  if (!/^01\d{8,9}$/.test(phoneD)) throw new Error("휴대폰번호 형식 오류");
  const ph = [phoneD.slice(0, 3), phoneD.slice(3, -4), phoneD.slice(-4)];
  const bankCd = p.bankCode || bankCode(p.bankName);
  if (!bankCd) throw new Error("은행코드 확인 불가");

  const now = kstNow();
  const base = (env.TAXBOT_BASE || "").replace(/\/$/, "");
  const depositDate = env.DEPOSIT_DATE || "20";
  const bizType = p.bizType === "02" ? "02" : "01";

  // 3) 기존 API 호출
  const calls = {
    register: `${base}/register?` + qs({
      bizType, bizNo: bizNoD, bizName: p.bizName, repName: p.repName, rsdntRgnmb: rrn,
      phoneNo1: ph[0], phoneNo2: ph[1], phoneNo3: ph[2], email: p.email,
    }),
    agreeCms: `${base}/agree-cms?` + qs({
      amount, depositDate, repName: p.repName, phoneNum: ph.join("-"), rsdntRgnmb: rrn,
      bankName: shortBank(p.bankName), accountNumber: p.accountNumber, bankAcctName: p.accountHolder,
      signYear: now.y, signMonth: now.m, signDay: now.d,
    }),
    agreeTax: `${base}/agree-tax?` + qs({
      repName: p.repName, rsdntRgnmb: rrn, corpName: p.bizName, bizNum: fmtBizNo(bizNoD), phone: ph.join("-"),
    }),
    // 4대보험 위임장 3종 — 같은 /agree-tax 에 type 만 다름 (기존 메일 링크에서 확인)
    ...Object.fromEntries(["health", "goyong", "yungum"].map((t) => [t, `${base}/agree-tax?` + qs({
      rep_name: p.repName, biz_name: p.bizName,
      address: p.bizAddress || "주소 미입력",
      phone_num: ph.join("-"), reg_num: bizNoD,
      inc_num: bizType === "02" && digits(p.corpRegNo).length === 13 ? digits(p.corpRegNo) : digits(rrn),
      rep_dob: `${rrn.slice(0, 2)}.${rrn.slice(2, 4)}.${rrn.slice(4, 6)}`,
      year: now.y, month: now.m, day: now.d, type: t,
    })])),
    excel: `${base}/excel?` + qs({
      membername: p.repName,            // 더빌 회원명 = 대표자명 (기존 산출물 확인)
      hpno: phoneD, bankcd: bankCd, accountno: digits(p.accountNumber), accountname: p.accountHolder,
      idno: rrn.slice(0, 6), dealwon: amount, hopeichedt: depositDate,
      paymm: env.CMS_PAYMM || "12",     // 납부횟수
      servicesdt: start, etaxyn: "A",
      etaxchaoffno: fmtBizNo(bizNoD), etaxchaname: p.bizName, etaxchaowner: p.repName,
    }),
  };

  const results = {};
  const attachments = [];
  // register 먼저(택스봇/홈택스 등록), 파일 3종은 병렬
  results.register = await callText(calls.register);
  const fileJobs = [
    ["agreeCms", "CMS자동이체신청서.jpg", "image/jpeg"],
    ["agreeTax", "세무대리정보이용신청서.pdf", "application/pdf"],
    ["excel", "MEM_더빌업로드.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["health", "건강보험EDI위임장.pdf", "application/pdf"],
    ["goyong", "고용산재위임장.pdf", "application/pdf"],
    ["yungum", "국민연금위임장.pdf", "application/pdf"],
  ];
  const settled = await Promise.allSettled(fileJobs.map(([k]) => fetch(calls[k])));
  for (let i = 0; i < fileJobs.length; i++) {
    const [k, name, type] = fileJobs[i];
    const s = settled[i];
    if (s.status === "fulfilled" && s.value.ok) {
      const buf = await s.value.arrayBuffer();
      attachments.push({ filename: `${p.bizName}_${name}`, content: b64(buf) });
      results[k] = "ok";
    } else {
      results[k] = s.status === "fulfilled" ? `HTTP ${s.value.status}` : String(s.reason);
    }
  }

  // 4) 결과 메일 (이미지는 서버에 남지 않음 — /ocr 요청 메모리에서만 처리)
  const row = (k, v) => `<tr><td style="color:#666;padding:4px 12px 4px 0">${k}</td><td>${v ?? ""}</td></tr>`;
  const html = `
    <h2>신규 수임 등록 — ${esc(p.bizName)}</h2>
    <table>
      ${row("구분", bizType === "02" ? "법인" : "개인")}${row("과세유형", esc(p.regType))}
      ${row("사업자번호", fmtBizNo(bizNoD))}${row("상호", esc(p.bizName))}${row("대표자", esc(p.repName))}
      ${row("주민번호", rrn)}${row("개업일", esc(p.openDate))}${row("사업장", esc(p.bizAddress))}
      ${row("업태/종목", `${esc(p.category)} / ${esc(p.item)}`)}${row("자택주소", esc(p.homeAddress))}
      ${row("휴대폰", ph.join("-"))}${row("이메일", esc(p.email))}
      ${row("홈택스 ID", esc(p.hometaxId))}${row("홈택스 PW", esc(p.hometaxPw))}
      ${row("계좌", `${esc(p.bankName)}(${bankCd}) ${esc(p.accountNumber)} / ${esc(p.accountHolder)}`)}
      ${row("월 기장료", Number(amount).toLocaleString() + "원")}${row("이체 시작월", start)}${row("이체일", depositDate + "일")}
    </table>
    <h3>처리 결과</h3>
    <table>
      ${row("택스봇·홈택스 등록", esc(results.register).slice(0, 500))}
      ${row("CMS 신청서", results.agreeCms)}${row("세무대리 신청서", results.agreeTax)}${row("MEM 엑셀", results.excel)}
      ${row("건강보험 EDI 위임장", results.health)}${row("고용산재 위임장", results.goyong)}${row("국민연금 위임장", results.yungum)}
    </table>
    <p style="color:#999;font-size:12px">제출 ${now.y}-${now.m}-${now.d} ${now.hm} KST · 자동 생성 메일</p>`;

  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", "Authorization": `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: String(env.MAIL_TO).split(",").map((x) => x.trim()).filter(Boolean),
      subject: `[신규수임] ${p.bizName} (${fmtBizNo(bizNoD)})`,
      html, attachments,
    }),
  });
  results.mail = mail.ok ? "ok" : `HTTP ${mail.status} ${(await mail.text()).slice(0, 200)}`;

  return { ok: true, results };
}

/* ---------- helpers ---------- */
function checkKey(p, env) {
  if (!env.STAFF_KEY || p?.key !== env.STAFF_KEY) throw new Error("접근 키가 올바르지 않습니다");
}
function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}
function json(obj, headers, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}
const digits = (s) => String(s ?? "").replace(/\D/g, "");
const norm = (s) => String(s ?? "").replace(/\s/g, "");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function qs(o) { return Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(v ?? "")}`).join("&"); }
function fmtBizNo(d) { return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d; }
function fmtRrn(s) { const d = digits(s); return d.length === 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : null; }
function rrnChecksum(rrn) {
  const d = digits(rrn); if (d.length !== 13) return false;
  const w = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let s = 0; for (let i = 0; i < 12; i++) s += +d[i] * w[i];
  return (11 - (s % 11)) % 10 === +d[12];
}
function shortBank(name) { return String(name ?? "").replace(/\(주\)|주식회사|은행|뱅크|\s/g, "") || null; }
function bankCode(name) {
  const n = norm(name); if (!n) return "";
  for (const [k, v] of Object.entries(BANK_CODES)) if (n.includes(k)) return v;
  return "";
}
function safeJson(t) { try { return JSON.parse(t); } catch { const m = /\{[\s\S]*\}/.exec(t); return m ? JSON.parse(m[0]) : {}; } }
async function callText(u) { try { const r = await fetch(u); return `HTTP ${r.status} ${(await r.text()).replace(/<[^>]+>/g, " ").trim()}`; } catch (e) { return `ERR ${e.message}`; } }
function b64(buf) { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
async function hmac(msg, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function kstNow() {
  const t = new Date(Date.now() + 9 * 3600 * 1000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hm: `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}` };
}
