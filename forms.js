/* =====================================================================
 *  서류 6종 템플릿 — HTML 로 그린 뒤 이미지/PDF 로 변환
 *  d = { o: 사무실 정보, c: 고객 정보, t: {y,m,d} 오늘 }
 *  문구·배치를 바꾸려면 이 파일만 고치면 됨
 * ===================================================================== */
window.FORMS = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const digits = (s) => String(s ?? "").replace(/\D/g, "");
  const yymmdd = (iso) => { const x = digits(iso); return x.length === 8 ? `${x.slice(2, 4)}.${x.slice(4, 6)}.${x.slice(6, 8)}` : ""; }; // 1992-02-25 → 92.02.25
  const rrnFront = (rrn) => digits(rrn).slice(0, 6);
  const maskRrn = (rrn) => { const x = digits(rrn); return x.length === 13 ? `${x.slice(0, 6)}-${x[6]}******` : ""; };
  const won = (n) => Number(digits(n) || 0).toLocaleString();
  const mgmtNo = (bizNo) => `${bizNo}-0`; // 사업장관리번호 = 사업자번호 + 0 (신규 사업장 관행)

  // 도장: 고객 = assets/seal_client.png (샘플, 추후 교체), 사무실 = assets/seal_office.png — 둘 다 "(서명 또는 인)" 위에 겹침
  const signC = (label = "(서명 또는 인)") => `<span class="sign"><span class="small">${label}</span><img class="seal-abs" src="assets/seal_client.png"></span>`;
  const signO = (label = "(서명 또는 인)") => `<span class="sign"><span class="small">${label}</span><img class="seal-abs" src="assets/seal_office.png"></span>`;

  const CSS = `
  .page { width:794px; height:1123px; background:#fff; color:#111; font-family:"Noto Sans KR",sans-serif; font-size:11.5px; line-height:1.45; padding:46px 48px; box-sizing:border-box; position:relative; overflow:hidden; }
  .page * { box-sizing:border-box; }
  .page h1 { text-align:center; font-size:22px; letter-spacing:4px; margin:6px 0 14px; font-weight:700; }
  .page table { width:100%; border-collapse:collapse; table-layout:fixed; }
  .page td, .page th { border:1px solid #222; padding:5px 7px; vertical-align:middle; }
  .page th { background:#f1f1f1; font-weight:500; text-align:center; }
  .page .v { font-weight:500; }
  .page .c { text-align:center; } .page .r { text-align:right; }
  .page .side { writing-mode:vertical-rl; text-orientation:upright; letter-spacing:2px; width:28px; background:#f1f1f1; text-align:center; padding:4px 2px; }
  .page .small { font-size:10px; line-height:1.4; }
  .page .tiny { font-size:9px; line-height:1.35; }
  .page .sec { font-weight:700; margin:12px 0 4px; }
  .page .box { border:1px solid #222; padding:7px 9px; }
  .page .stamp-row { display:flex; align-items:center; gap:10px; }
  .sign { position:relative; display:inline-block; }
  .seal-abs { position:absolute; width:50px; height:50px; left:50%; top:50%; transform:translate(-50%,-52%); opacity:.9; pointer-events:none; }
  .ov { position:absolute; white-space:nowrap; line-height:1; font-family:"Noto Sans KR",sans-serif; color:#111; }
  .ov.c { text-align:center; }
  .ov img { position:absolute; left:0; top:0; width:100%; height:100%; opacity:.92; }
  .chk { display:inline-block; width:12px; height:12px; border:1px solid #222; vertical-align:-2px; margin:0 3px 0 1px; text-align:center; font-size:10px; line-height:10px; }
  .chk.on::after { content:"V"; font-weight:700; }
  .formno { font-size:10px; color:#333; }
  .date-line { text-align:center; margin:14px 0 6px; font-size:12px; }
  .date-line b { display:inline-block; min-width:36px; }
  `;

  /* ---------- 1. CMS 자동이체 이용 신청서 (JPG) ---------- */
  function cms(d, opt = {}) {
    const { o, c, t } = d;
    const sign = (label) => opt.blankSign ? `<span class="tiny">${label}</span>` : signC(label);
    return `
<div class="page" style="font-size:10.5px;padding:34px 40px;">
  <div style="text-align:center;font-size:20px;font-weight:700;letter-spacing:3px;padding-top:6px;">자동이체 이용 신청서</div>
  <div class="c" style="margin:6px 0 4px;"><span style="background:#fff27a;padding:1px 6px;font-weight:700;">(신청 구분(택1): <u>신규</u>/ 변경/ 해지)</span></div>
  <div class="c" style="font-weight:700;margin-bottom:3px;">◈ 수납기관 및 요금정보[수납기관 기재란]</div>
  <table>
    <tr><th style="width:18%">수납 기관명</th><td style="width:32%">${esc(o.name)}</td><th style="width:18%">대표자명</th><td>${esc(o.rep)}</td></tr>
    <tr><th>사업장 주소</th><td colspan="3">${esc(o.address)}</td></tr>
    <tr><th>사업자등록번호</th><td>${esc(o.bizNo)}</td><th>자동이체 사유</th><td>세무 기장료 및 조정료 수납목적</td></tr>
    <tr><th>출금통장 기재내역</th><td>${esc(o.name)}</td><th>수납 요금</th><td class="r">${won(c.amount)} 원</td></tr>
    <tr><th>납부자 번호(고객번호)</th><td class="c">생략 가능</td><th>이체 시작 월</th><td class="c">${c.start.slice(0, 4)} 년 ${c.start.slice(4, 6)} 월 &nbsp;&nbsp; 지정 출금일 : 매월 ${esc(o.depositDate)} 일</td></tr>
  </table>
  <div class="c" style="font-weight:700;margin:8px 0 3px;">◈ 자동이체 신청정보[신청인 기재란]</div>
  <table>
    <tr><th style="width:18%">신청인명</th><td style="width:32%">${esc(c.repName)}</td><th style="width:18%">예금(카드)주와의 관계</th><td>본인</td></tr>
    <tr><th>신청인 연락처</th><td>${esc(c.phone)}</td><th>신청인 휴대번호</th><td>${esc(c.phone)}</td></tr>
    <tr><th colspan="4" style="background:#dbe9f6;">자동이체 정보</th></tr>
    <tr><th>출금이체 결제수단</th><td>계좌</td><th></th><td></td></tr>
    <tr><th>예금주명<br><span class="tiny">(신용카드 발급자명)</span></th><td>${esc(c.accountHolder)}</td><th>예금(카드)주 생년월일<br><span class="tiny">(주민번호 앞 6자리)</span></th><td>${rrnFront(c.rrn)} - *******</td></tr>
    <tr><th>은행(카드사)명</th><td>${esc(c.bankName)}은행</td><th>사업자등록번호</th><td>${esc(c.bizNo)}</td></tr>
    <tr><th>계좌(카드)번호</th><td>${esc(c.accountNumber)}</td><th>카드 유효기간</th><td>&nbsp;&nbsp;&nbsp;&nbsp;(월/년)</td></tr>
    <tr><th>예금주(카드) 연락처</th><td>${esc(c.phone)}</td><th>예금주(카드) 휴대번호</th><td>${esc(c.phone)}</td></tr>
  </table>
  <div class="tiny" style="margin:4px 0 6px;">※ 평생계좌(휴대폰번호)번호, 법인공용카드, 선불카드, 해외발행카드 등 일부 계좌 및 카드는 자동이체 서비스 신청이 불가합니다.</div>

  <div class="box tiny">
    <div class="c" style="font-weight:700;font-size:10px;margin-bottom:3px;">자동이체 서비스 약관</div>
    <div style="column-count:2;column-gap:14px;">
      1. 신청자는 본 신청서에 서명하거나 공인인증 및 그에 준하는 전자 인증절차를 통함으로써 본 서비스를 이용할 수 있습니다.<br>
      2. 회사는 서비스 제공을 위하여 이용자가 제출한 지급결제수단 정보를 해당 금융기관(통신사 포함)에 제공할 수 있습니다.<br>
      3. 자동이체 개시일을 이용자가 지정하지 않은 경우 재화 등을 공급하는 자로부터 사전 통지 받은 납기일을 최초 개시일로 하며, 출금은 이용업체와 협의한 날짜에 계좌출금이 이루어 집니다.<br>
      4. 자동이체 금액은 해당 지정 출금일 영업 시간 내에 입금된 예금(지정출금일에 입금된 타점권은 제외)에 한하여 출금 처리 되며, 출금이체 금액의 이의가 있는 경우에는 이용업체에 협의하여 조정키로 합니다.<br>
      5. 납기일에 동일한 수종의 자동이체 청구가 있는 경우 이체 우선 순위는 이용자의 거래 금융기관이 정하는 바에 따릅니다.<br>
      6. 자동이체 납부일이 영업일이 아닌 경우에는 다음 영업일을 납부일로 합니다.<br>
      7. 이용자가 자동이체 신청(신규, 해지, 변경)을 원하는 경우 해당 납기일30일 전까지 회사에 통지해야 합니다.<br>
      8. 이용자가 제출한 지급결제수단의 잔액(예금한도, 신용한도 등)이 예정 결제금액보다 부족하거나 지급제한, 연체 등 납부자의 과실에 의해 발생하는 손해의 책임은 이용자에게 있습니다.<br>
      9. 이용자가 금융기관 및 회사가 정하는 기간 동안 자동이체 이용 실적이 없는 경우 사전 통지 후 자동이체를 해지할 수 있습니다.<br>
      10. 회사는 이용자와의 자동이체서비스 이용과 관련된 구체적인 권리, 의무를 정하기 위하여 본 약관과는 별도로 자동이체서비스이용약관을 제정할 수 있습니다.
    </div>
  </div>

  <div class="box tiny" style="border-top:0;">
    <div style="font-weight:700;font-size:10px;">[개인정보 수집 및 이용 동의]</div>
    ◆ 수집 및 이용목적: 자동이체를 통한 요금 수납, 민원처리 및 동의여부 통지,<br>
    ◆ 수집 항목: 신청인(성명, 연락처, 휴대번호), 예금(카드)주명, 은행(카드)명, 계좌(카드)번호, 생년월일(사업자등록번호), 카드유효기간<br>
    ◆ 보유 및 이용기간: 수집 이용 동의일부터 자동이체서비스 종료일(해지일)까지며, 보유는 해지일로부터5년간 보존 후 파기(관계 법령에 의거)<br>
    <div class="r" style="margin-top:2px;"><b>신청자는 개인정보 수집 및 이용을 거부할 수 있습니다. 단, 거부하는 경우 자동이체 신청이 정상적으로 처리되지 않습니다.</b>&nbsp; <span class="chk on"></span>동의함 &nbsp;<span class="chk"></span>동의 안함</div>
  </div>
  <div class="box tiny" style="border-top:0;">
    <div style="font-weight:700;font-size:10px;">[개인정보 제3자 제공 동의]</div>
    ◆ 개인정보를 제공받는 자: 나이스페이먼츠 주식회사, 은행(신한/SC제일/씨티/하나/농협/기업/국민/저축/수협/신협/우체국/새마을금고/대구/부산/경남/광주/전북/조흥/제주), 카드사(국민/비씨/롯데/삼성/NH농협/현대/신한/하나/우리)<br>
    ◆ 개인정보를 제공받는 자의 개인정보 이용 목적: 자동이체 서비스 제공 및 출금동의 확인, 신규 등록 및 해지 사실 확인 및 통지, 민원 처리<br>
    ◆ 제공하는 개인정보의 항목: 신청(성명, 연락처, 휴대번호), 예금(카드)주명, 은행(카드)명, 계좌(카드)번호, 생년월일(사업자등록번호), 카드유효기간<br>
    ◆ 개인정보를 제공받는 자의 개인정보 보유 및 이용기간: 자동이체 신청부터 해지까지. 단, 관련 법령에 의거 일정기간 보유.<br>
    <div class="r" style="margin-top:2px;"><b>신청자는 개인정보 제3자 제공을 거부할 수 있습니다. 단, 거부하는 경우 자동이체 신청이 정상적으로 처리되지 않습니다.</b>&nbsp; <span class="chk on"></span>동의함 &nbsp;<span class="chk"></span>동의 안함</div>
  </div>
  <div class="box tiny" style="border-top:0;">
    <div style="font-weight:700;font-size:10px;">[금융거래정보의 제공동의서]</div>
    본 신청과 관련하여 본인은 위 기재한 금융거래정보(신청인(성명,연락처), 예금주명, 예금주휴대폰번호, 출금은행명, 계좌번호, 예금주 생년월일(사업자등록번호))를 자동이체 신규 신청하는 때로부터 서면으로 해지 신청할 때까지 나이스페이먼츠 주식회사, 금융기관, 공공금융기관에 제공하는 것에 대하여 [금융실거래 및 비밀보장에 관한 법률]의 규정에 따라 동의합니다.
  </div>

  <div style="margin-top:10px;font-size:10.5px;">위와 같이 금융거래정보의 제공 및 개인정보 수집 및 이용, 개인정보 제3자 제공에 동의하며, 자동이체 서비스 약관을 확인하고 자동이체 이용을 신청합니다.</div>
  <div class="date-line">${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</div>
  <table style="margin-top:4px;">
    <tr>
      <th style="width:14%">신청인</th><td style="width:36%;height:52px;"><span style="margin-left:60px;">${esc(c.repName)}</span> ${sign("(인) 또는 서명")}</td>
      <th style="width:14%">예금(카드)주<br>동의란</th><td><span style="margin-left:60px;">${esc(c.accountHolder)}</span> ${sign("(인) 또는 서명")}</td>
    </tr>
  </table>
  <div class="tiny" style="margin-top:6px;color:#c8102e;font-weight:700;">*신청인과 예금주/카드주가 상이한 경우에는 예금주/카드주가 의 동의 필요하며, 날인 또는 서명은 출금통장의 거래날인, 서명 사용</div>
</div>`;
  }

  /* ---------- 2. 홈택스 세무대리정보 이용(해지)신청서 [별지 제6호 서식] (PDF) ----------
   * 국세청 제출용이라 원본 서식(PDF → assets/hometax_bg.png)을 배경으로 깔고 값만 좌표에 얹음.
   * 좌표 단위는 PDF pt(원본 595×842). K 로 CSS px 환산. */
  function hometax(d) {
    const { o, c, t } = d;
    const K = 794 / 595;
    const T = (x, y, text, fs = 10.5, w = 0, cls = "") =>
      `<div class="ov ${cls}" style="left:${(x * K).toFixed(1)}px;top:${(y * K).toFixed(1)}px;font-size:${(fs * K).toFixed(1)}px;${w ? `width:${(w * K).toFixed(1)}px;` : ""}">${esc(text)}</div>`;
    const IMG = (x, y, w, h, src) => `<div class="ov" style="left:${(x * K).toFixed(1)}px;top:${(y * K).toFixed(1)}px;width:${(w * K).toFixed(1)}px;height:${(h * K).toFixed(1)}px;"><img src="${src}"></div>`;
    const SIGN = "(서명 또는 인)";
    const dd = (n) => String(n).padStart(2, "0");
    return `
<div class="page" style="padding:0;background:#fff url(assets/hometax_bg.png) no-repeat 0 0/100% 100%;">
  ${T(195, 151.5, c.repName, 10)}
  ${T(400, 151.5, c.rrn, 10)}
  ${T(195, 176, c.bizName, 10)}
  ${T(400, 176, c.bizNo, 10)}
  ${T(380, 219.5, c.phone, 10)}

  ${T(366, 483.5, String(t.y), 10.5, 30, "c")}
  ${T(428, 483.5, dd(t.m), 10.5, 14, "c")}
  ${T(470, 483.5, dd(t.d), 10.5, 14, "c")}
  ${T(486.7, 483.2, "일", 11)}

  ${T(372, 498.8, c.repName, 10.5, 100, "c")}
  ${T(481.3, 500.2, SIGN, 8.5)}
  ${IMG(478, 476, 44.5, 44.5, "assets/seal_client.png")}

  ${T(370, 587.7, c.repName, 10.5, 100, "c")}
  ${T(475, 589.2, SIGN, 8.5)}
  ${IMG(478, 565, 44.5, 44.5, "assets/seal_client.png")}

  ${T(435.8, 620.8, ": " + (o.repRrn || ""), 10)}

  ${T(135, 728.2, c.repName, 10.5, 100, "c")}
  ${IMG(216, 706, 40, 40, "assets/seal_client.png")}
  ${T(478.4, 729.7, SIGN, 8.5)}
  ${IMG(481, 696.5, 43, 40, "assets/seal_office.png")}
</div>`;
  }

  /* ---------- 3. 건강보험 EDI 업무대행 위임장 [별지 제6호 서식] (PDF) ---------- */
  function nhis(d) {
    const { o, c, t } = d;
    return `
<div class="page">
  <div class="formno">[별지 제6호 서식]</div>
  <h1 style="margin:36px 0 26px;">건강보험 EDI 업무대행 위임장</h1>
  <table style="font-size:11px;">
    <tr><td rowspan="3" class="side">업무대행기관</td><th style="width:20%">사업장관리번호</th><td style="width:27%">${esc(mgmtNo(o.bizNo))}</td><th style="width:16%">기 관 명</th><td>${esc(o.name)}</td></tr>
    <tr><th>소 재 지</th><td colspan="3">${esc(o.address)} &nbsp;(전화번호 : ${esc(o.phone)})</td></tr>
    <tr><th>대표자 성명</th><td>${esc(o.rep)}</td><th>대 표 자<br>생년월일</th><td>${yymmdd(o.repBirth)}</td></tr>
    <tr><td rowspan="4" class="side">위임사업장</td><th>사업장관리번호<br><span class="tiny">(단위사업장기호)</span></th><td>${esc(mgmtNo(c.bizNo))}</td><th>사업장명</th><td>${esc(c.bizName)}</td></tr>
    <tr><th>소 재 지</th><td colspan="3">${esc(c.bizAddress || "주소 미입력")}</td></tr>
    <tr><th>대표자 성명</th><td>${esc(c.repName)}</td><th>대 표 자<br>생년월일</th><td>${yymmdd(c.birthDate) || rrnFront(c.rrn).replace(/(\d\d)(\d\d)(\d\d)/, "$1.$2.$3")}</td></tr>
    <tr><th>사업자등록번호</th><td colspan="3">${esc(c.bizNo)}</td></tr>
    <tr><th colspan="2">위임 업무범위</th><td colspan="3">공단 웹EDI 서비스 업무</td></tr>
  </table>
  <div style="margin:34px 20px 0;font-size:12px;line-height:1.9;">민법 제114조(대리행위의 효력)의 규정에 의하여 위와 같이 건강보험 EDI 업무대행 대리인 위임을 신청합니다.</div>
  <div class="date-line" style="margin:50px 0 16px;text-align:right;padding-right:40px;">${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</div>
  <div class="r" style="padding-right:40px;font-size:12px;">신청인 &nbsp;<span style="display:inline-block;min-width:80px;text-align:center;">${esc(c.repName)}</span> ${signC()}</div>
  <div class="c" style="margin-top:30px;font-size:16px;font-weight:700;letter-spacing:2px;">국민건강보험공단 &nbsp;○○○○지사장 <span style="font-size:11px;font-weight:400;">귀하</span></div>
  <hr style="border:0;border-top:1px solid #222;margin:40px 0 18px;">
  <div style="font-size:11.5px;line-height:1.8;padding:0 10px;">이 위임장은 웹EDI를 통하여 '건강보험 EDI 업무대행 위임 신청' 전송 시 첨부하는 서류입니다.</div>
</div>`;
  }

  /* ---------- 4. 보험사무대행기관 사무위탁서 — 고용·산재 (PDF) ---------- */
  function goyong(d) {
    const { o, c, t } = d;
    return `
<div class="page" style="font-size:11px;">
  <h1 style="margin:30px 0 20px;">보험사무대행기관 사무위탁서</h1>
  <table>
    <tr><th style="width:15%">사업장관리번호</th><td style="width:22%">${esc(mgmtNo(c.bizNo))}</td><th style="width:11%">사업장명</th><td style="width:22%">${esc(c.bizName)}</td><th style="width:11%;font-size:9.5px;">상시사용<br>근로자수</th><td class="c">1</td></tr>
    <tr><th>소재지</th><td colspan="3">${esc(c.bizAddress || "주소 미입력")}</td><th style="font-size:9.5px;">전화번호</th><td>${esc(c.phone)}</td></tr>
    <tr><th>대표자</th><td>${esc(c.repName)}</td><th>전화번호</th><td>${esc(c.phone)}</td><th style="font-size:9.5px;">사업의 종류</th><td>${esc(c.item || "")}</td></tr>
    <tr><th colspan="6">위탁사항</th></tr>
    <tr><td colspan="6" style="padding:8px 12px;line-height:1.7;">
      <span class="chk"></span> 고용보험 및 산업재해보상보험(임금채권 및 석면피해구제 포함)관련 사무<br>
      &nbsp;&nbsp;1. 보수총액 및 근로자 고용정보 신고에 관한 사무<br>
      &nbsp;&nbsp;2. 보험료 신고에 관한 사무<br>
      &nbsp;&nbsp;3. 보험관계 성립, 변경, 소멸 등의 신고에 관한 사무<br>
      &nbsp;&nbsp;4. 기타 관계 법령 및 규정 등에 의하여 사업주가 근로복지공단이나 지방고용노동관서에 신고 또는 보고하여야 할 보험사무<br>
      &nbsp;&nbsp;5. 피보험자격의 취득․상실 및 근로내역확인 신고 등 피보험자관리에 관한 사무(고용보험에 한함)<br>
      <span style="color:#1a4fd6;font-size:10px;">※ 보험사무대행기관이 상기 위탁사항의 처리에 필요한 정보를 근로복지공단에서 제공받는 것에 동의 함</span>
    </td></tr>
    <tr><th colspan="2">사무처리 시작 연월일</th><td colspan="4">(예정) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</td></tr>
  </table>
  <div style="margin:14px 6px 0;line-height:1.8;">위와 같이 귀 보험사무대행기관에 <span class="chk on"></span>고용보험 <span class="chk on"></span>산업재해보상보험(임금채권 및 석면피해구제 포함) 사무의 처리를 위탁합니다.</div>
  <div class="r" style="margin:14px 40px 0 0;">${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</div>
  <div style="margin:10px 0 0 170px;line-height:2;">위탁사업주 &nbsp;주소 &nbsp;&nbsp;${esc(c.bizAddress || "")}<br>
    <span style="margin-left:66px;">성명</span> &nbsp;&nbsp;<span style="display:inline-block;min-width:80px;text-align:center;margin-left:170px;">${esc(c.repName)}</span> ${signC()}</div>
  <div style="margin:16px 0 0 80px;"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;보험사무대행기관 대표&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> 귀하</div>

  <div style="margin:40px 0 10px;border-top:2px dotted #222;"></div>
  <div style="line-height:1.9;padding:0 6px;">[<span class="chk on"></span>고용보험 <span class="chk on"></span>산업재해보상보험(임금채권 및 석면피해구제 포함) ]관련 사무 수탁을 <span class="chk on"></span>승낙 <span class="chk"></span>불승낙 합니다.</div>
  <table style="margin-top:8px;">
    <tr><th style="width:22%">불승낙 사유</th><td></td></tr>
    <tr><th>보험가입자 사업장관리번호</th><td></td></tr>
  </table>
  <div class="r" style="margin:22px 40px 0 0;">${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</div>
  <div style="margin:10px 0 0 230px;line-height:2.1;">
    보험사무대행기관 명 &nbsp;칭 &nbsp;&nbsp;${esc(o.name)}<br>
    <span style="margin-left:116px;">소재지</span> &nbsp;&nbsp;${esc(o.address)}<br>
    <span style="margin-left:116px;">대표자</span> &nbsp;&nbsp;<span style="display:inline-block;min-width:80px;text-align:center;">${esc(o.rep)}</span> ${signO()}
  </div>
  <div style="margin:20px 0 0 40px;"><u>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</u> 귀하</div>
  <div class="tiny r" style="position:absolute;right:48px;bottom:30px;">210mm×297mm[일반용지 60g/㎡(재활용품)]</div>
</div>`;
  }

  /* ---------- 5. 국민연금 웹 EDI 업무대행 신청서 [별지 제4호서식] (PDF) ---------- */
  function pension(d) {
    const { o, c, t } = d;
    const corp = c.bizType === "02";
    return `
<div class="page" style="font-size:11px;">
  <div class="formno">[별지 제4호서식]</div>
  <h1 style="margin:30px 0 20px;">국민연금 웹 EDI 업무대행 신청서</h1>
  <table style="margin-bottom:10px;">
    <tr><th style="width:25%">접수번호</th><td style="width:25%"></td><th style="width:12%">접수일</th><td style="width:13%"></td><th style="width:12%">처리기간</th><td>즉시</td></tr>
  </table>
  <table>
    <tr><td rowspan="3" class="side">업무대행기관</td><th style="width:20%">사업장관리번호</th><td style="width:27%">${esc(mgmtNo(o.bizNo))}</td><th style="width:16%">사업장 명칭</th><td>${esc(o.name)}</td></tr>
    <tr><th>소 재 지</th><td colspan="3">${esc(o.address)}</td></tr>
    <tr><th>사업자등록번호</th><td>${esc(o.bizNo)}</td><th>법인등록번호</th><td></td></tr>
    <tr><td rowspan="2" class="side"></td><th>사용자</th><td colspan="3" style="padding:0;"><table style="border:0;"><tr><th style="border:0;border-right:1px solid #222;border-bottom:1px solid #222;width:60%">성 명</th><th style="border:0;border-bottom:1px solid #222;">생년월일</th></tr><tr><td class="c" style="border:0;border-right:1px solid #222;">${esc(o.rep)}</td><td class="c" style="border:0;">${esc(o.repBirth)}</td></tr></table></td></tr>
    <tr><td colspan="4" style="padding:2px;"></td></tr>
    <tr><td rowspan="4" class="side">위탁사업장</td><th>사업장관리번호</th><td>${esc(mgmtNo(c.bizNo))}</td><th>사업장 명칭</th><td>${esc(c.bizName)}</td></tr>
    <tr><th>소 재 지</th><td colspan="3">${esc(c.bizAddress || "주소 미입력")}</td></tr>
    <tr><th>사업자등록번호</th><td>${esc(c.bizNo)}</td><th>법인등록번호</th><td>${corp ? esc(c.corpRegNo || "") : ""}</td></tr>
    <tr><th>사용자</th><td colspan="3" style="padding:0;"><table style="border:0;"><tr><th style="border:0;border-right:1px solid #222;border-bottom:1px solid #222;width:60%">성 명</th><th style="border:0;border-bottom:1px solid #222;">생년월일</th></tr><tr><td class="c" style="border:0;border-right:1px solid #222;">${esc(c.repName)}</td><td class="c" style="border:0;">${yymmdd(c.birthDate) || rrnFront(c.rrn).replace(/(\d\d)(\d\d)(\d\d)/, "$1.$2.$3")}</td></tr></table></td></tr>
    <tr><th colspan="2">업무위탁<br>범위</th><td colspan="3" style="line-height:1.9;">
      ▪ 자격의 취득 및 상실 신고 &nbsp;&nbsp;&nbsp;&nbsp; ▪ 내용변경 신고<br>
      ▪ 기준소득월액 변경 등 신고 &nbsp;&nbsp;&nbsp;&nbsp; ▪ 신고서 처리결과 및 보험료결정내역 확인<br>
      ※ 증명서 발급에 관한 사항은 업무대행 범위에 포함되지 않음</td></tr>
  </table>
  <div style="margin:22px 10px 0;line-height:1.9;">위탁사업장은 민법 제114조 규정에 따라 국민연금 웹 EDI 업무대행을 위탁하고, 업무대행기관은 대행기관으로서 제반 업무처리에 따른 법적 책임을 부담하며, 각 신청인은 개인정보의 부적정 사용을 방지하기 위한 조치를 취하고 불법 유출 등으로 발생하는 손해배상 등에 대하여 연대하여 책임질 것을 서약하며 업무대행을 신청합니다.</div>
  <div class="r" style="margin:34px 60px 0 0;font-size:12px;">${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</div>
  <div style="margin:14px 0 0 120px;line-height:2.4;font-size:12px;">
    신청인(업무대행기관 사용자) &nbsp;&nbsp;<span style="display:inline-block;min-width:70px;text-align:center;margin-left:40px;">${esc(o.rep)}</span> ${signO()}<br>
    신청인(업무대행 위탁사업장 사용자) &nbsp;&nbsp;<span style="display:inline-block;min-width:70px;text-align:center;">${esc(c.repName)}</span> ${signC()}
  </div>
  <div style="margin:30px 0 0 110px;font-size:18px;font-weight:700;letter-spacing:4px;">국민연금공단 &nbsp;&nbsp;&nbsp;&nbsp;지사장 <span style="font-size:12px;font-weight:400;letter-spacing:0;">귀하</span></div>
  <div class="tiny r" style="position:absolute;right:48px;bottom:48px;">수수료 없음</div>
  <div class="tiny r" style="position:absolute;right:48px;bottom:30px;">210mm×297mm[일반용지 60g/㎡(재활용품)]</div>
</div>`;
  }

  /* ---------- 6. 더빌 업로드용 MEM 엑셀 — 템플릿(assets/dbill_template.xls)의 2행 키 순서대로 값 매핑 ---------- */
  function excelRow(d) {
    const { o, c } = d;
    return {
      membername: c.repName, hpno: digits(c.phone), email: c.email || "",
      bankcd: c.bankCode, accountno: digits(c.accountNumber), accountname: c.accountHolder,
      idno: rrnFront(c.rrn), dealwon: digits(c.amount), hopeichedt: o.depositDate, paymm: o.paymm, servicesdt: c.start,
      etaxchaoffno: c.bizNo, etaxchaname: c.bizName, etaxchabiztype: c.category || "", etaxchabizitem: c.item || "",
      etaxchaowner: c.repName, etaxchaaddr1: c.bizAddress || "", etaxyn: "A",
    };
  }


  /* ---------- 7. 기장대리 계약서 (PDF, 4쪽) — 채울 수 있는 칸만 기입, 甲 서명란은 공란, 乙은 직인 ---------- */
  function contract(d) {
    const { o, c, t } = d;
    const corp = c.bizType === "02";
    const box = (on) => `<span class="chk${on ? " on" : ""}"></span>`;
    const feeRows = [["3억 미만","100,000","150,000"],["3억 ~ 5억 미만","120,000","180,000"],["5억 ~ 10억 미만","150,000","200,000"],["10억 ~ 15억 미만","200,000","250,000"],["15억 ~ 20억 미만","250,000","300,000"],["20억 ~30억 미만","330,000","400,000"],["30억 ~ 50억 미만","450,000","500,000"],["50억 ~ 100억 미만","650,000","750,000"]];
    const adjRows = [["1억 미만","300,000원","500,000원"],["1억 ~ 3억 미만","300,000원 + 1억원 초과금액 × 0.20%","500,000원 + 1억원 초과금액 × 0.25%"],["3억 ~ 5억 미만","700,000원 + 3억원 초과금액 × 0.15%","1,000,000원 + 3억원 초과금액 × 0.25%"],["5억 ~ 10억 미만","1,000,000원 + 5억원 초과금액 × 0.12%","1,500,000원 + 5억원 초과금액 × 0.20%"],["10억 ~ 20억 미만","1,600,000원 + 10억원 초과금액 × 0.10%","2,500,000원 + 10억원 초과금액 × 0.15%"],["20억 ~30억 미만","2,600,000원 + 20억원 초과금액 × 0.08%","4,000,000원 + 20억원 초과금액 × 0.13%"],["30억 ~ 50억 미만","3,400,000원 + 30억원 초과금액 × 0.06%","5,300,000원 + 30억원 초과금액 × 0.08%"],["50억 이상","별도 합의","별도 합의"]];
    const H = `.page.ct { font-size:12px; line-height:1.7; padding:60px 64px; } .page.ct h3 { font-size:14px; margin:18px 0 6px; } .page.ct th { background:#0c477e; color:#fff; font-weight:500; } .page.ct td.l { background:#f1f1f1; text-align:center; }`;
    const p1 = `
<div class="page ct" style="position:relative;background:#0c477e;color:#fff;padding:64px 72px;">
  <style>${H}</style>
  <img src="assets/logo-horizontal-white.png" style="position:absolute;left:72px;top:64px;width:170px;">
  <div style="position:absolute;left:72px;right:72px;top:360px;">
    <div style="font-size:11px;letter-spacing:4px;color:#bcd0e6;margin-bottom:14px;">ENGAGEMENT AGREEMENT</div>
    <div style="font-size:40px;font-weight:700;letter-spacing:2px;line-height:1.2;">기장대리 계약서</div>
    <div style="width:56px;height:2px;background:#fff;margin:26px 0 30px;"></div>
    <table style="width:auto;border:0;font-size:13px;line-height:1.5;">
      <tr><td style="border:0;padding:4px 28px 4px 0;color:#bcd0e6;">위임인</td><td style="border:0;padding:4px 0;font-weight:500;">${esc(c.bizName)}</td></tr>
      <tr><td style="border:0;padding:4px 28px 4px 0;color:#bcd0e6;">수임인</td><td style="border:0;padding:4px 0;font-weight:500;">편한세무회계</td></tr>
      <tr><td style="border:0;padding:4px 28px 4px 0;color:#bcd0e6;">계약일</td><td style="border:0;padding:4px 0;font-weight:500;">${t.y}. ${String(t.m).padStart(2, "0")}. ${String(t.d).padStart(2, "0")}.</td></tr>
    </table>
  </div>
  <div style="position:absolute;left:72px;right:72px;bottom:64px;border-top:1px solid rgba(255,255,255,.35);padding-top:16px;font-size:11px;line-height:1.9;color:#bcd0e6;">
    편한세무회계 &nbsp;|&nbsp; 세무사 편성웅<br>
    ${esc(o.address)}<br>
    T 02-6268-2000 &nbsp;&nbsp; F 02-591-0720 &nbsp;&nbsp; E cozytax@naver.com &nbsp;&nbsp; 카카오톡 편한세무회계
  </div>
</div>`;
    const p2 = `
<div class="page ct">
  <style>${H}</style>
  <h3 style="font-size:18px;margin-top:0;">계약 체결</h3>
  <div>의뢰인 “ <b>${esc(c.bizName)}</b> ”을 “甲”이라 하고 “편한세무회계”를 “乙”이라 하여 다음과 같이 계약한다.</div>
  <h3 style="font-size:16px;">기본정보 항목</h3>
  <table style="font-size:11.5px;">
    <tr><th style="width:17%">구분</th><th colspan="2" style="width:48%">내용</th><th>비고</th></tr>
    <tr><td class="l">상 &nbsp;&nbsp; 호</td><td colspan="2">${esc(c.bizName)}</td><td></td></tr>
    <tr><td class="l">사업자등록번호</td><td colspan="2">${esc(c.bizNo)}</td><td>법인등록번호 : ${corp ? esc(c.corpRegNo || "") : ""}</td></tr>
    <tr><td class="l">주 &nbsp;&nbsp; 소</td><td colspan="2">${esc(c.bizAddress || "")}</td><td>임차료( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ) + Vat.( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</td></tr>
    <tr><td class="l">대 표 자</td><td colspan="2">${esc(c.repName)}</td><td></td></tr>
    <tr><td class="l">연 락 처</td><td colspan="2">${esc(c.phone)}</td><td>실무자 : ${esc([c.staffName, c.staffPhone].filter(Boolean).join(" "))}</td></tr>
    <tr><td class="l">이 메 일</td><td colspan="2">${esc(c.email || "")}</td><td></td></tr>
    <tr><td class="l">前 세무사</td><td colspan="2" class="c">${box(false)} 여 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${box(false)} 부</td><td>연락처 :</td></tr>
    <tr><td class="l">사업용/개인용 카드</td><td colspan="2">( &nbsp;&nbsp;&nbsp;&nbsp; )장/ ( &nbsp;&nbsp;&nbsp;&nbsp; )장</td><td></td></tr>
    <tr><td class="l" rowspan="3">인력현황</td><td class="l" style="width:16%">4대 보험</td><td>( &nbsp;&nbsp;&nbsp;&nbsp; )명</td><td></td></tr>
    <tr><td class="l">프리랜서</td><td>( &nbsp;&nbsp;&nbsp;&nbsp; )명</td><td></td></tr>
    <tr><td class="l">일용직</td><td>( &nbsp;&nbsp;&nbsp;&nbsp; )명</td><td></td></tr>
    <tr><td class="l">사업용 차량 소유</td><td colspan="2" class="c">${box(false)} 여 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${box(false)} 부</td><td></td></tr>
    <tr><td class="l">홈택스</td><td colspan="2">ID : ${esc(c.hometaxId || "")}</td><td>PW : ${esc(c.hometaxPw || "")}</td></tr>
    <tr><td class="l" rowspan="3">CMS</td><td class="l">예금주명</td><td>${esc(c.accountHolder || "")}</td><td></td></tr>
    <tr><td class="l">은행명</td><td>${esc(c.bankName || "")}${c.bankName ? "은행" : ""}</td><td></td></tr>
    <tr><td class="l">계좌번호</td><td>${esc(c.accountNumber || "")}</td><td></td></tr>
    <tr><td class="l">법인설립지원</td><td colspan="2" class="c">${box(false)} 여 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${box(false)} 부</td><td class="tiny">법인설립 지원은 12개월 기장 유지의무가 있으며 중도해지시 설립지원 수수료가 환수 됩니다.</td></tr>
  </table>
  <h3>제1조 【권한위임】</h3>
  <div>① “甲”은 “乙”을 대리인으로 하여 “甲”의 아래 표시 사업장의 기장대리 대행에 대한 권한을 위임한다.</div>
  <h3>제2조 【업무】</h3>
  <div>① “乙”은 “甲”의 위 사업장에 대한 재무제표 및 세무조정계산서를 작성하며 이를 근거로 “甲”의 연간 소득에 대한 종합소득세(법인의 경우 법인세) 신고 업무를 수행하기로 한다.<br>② “乙”은 “甲”의 위 사업장에 대한 부가가치세 확정신고 대행 업무를 수행하기로 한다.</div>
</div>`;
    const p3 = `
<div class="page ct">
  <style>${H}</style>
  <h3 style="margin-top:0;">제3조 【보수】</h3>
  <div>① 본 계약에 의한 기장대리 보수는 <b>${c.start.slice(0, 4)}</b>년 <b>${c.start.slice(4, 6)}</b>월부터 매월 <b>${esc(o.depositDate)}</b>일에 월정액 금 <b>${Number(digits(c.amount)).toLocaleString()}원</b> 정 (VAT포함)으로 한다.<br>② 본 계약에 의한 신고 시 결산서 및 세무조정계산서 작성 수수료(조정료)는 전항의 보수와는 별도로 한다.</div>
  <table style="font-size:11.5px;margin-top:12px;">
    <tr><th style="width:30%">과세기간 매출</th><th>개인 기장료</th><th>법인 기장료</th></tr>
    ${feeRows.map((r) => `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td class="c">${r[2]}</td></tr>`).join("")}
    <tr><td class="l">100억 이상</td><td colspan="2" class="c">별도 안내</td></tr>
  </table>
  <div style="margin:16px 0 6px;">[연 1회 : 일반 및 법인 사업자 조정 보수표]</div>
  <table style="font-size:11px;">
    <tr><th style="width:22%">과세기간 매출</th><th>개인 조정료</th><th>법인 조정료</th></tr>
    ${adjRows.map((r) => `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td class="c">${r[2]}</td></tr>`).join("")}
  </table>
  <div class="small" style="margin-top:8px;">* 전문직사업자, 외부회계감사대상법인의 경우 30% 범위 내에서 가산<br>* 업무량 및 난이도, 세액공제와 감면에 따라 30% 범위 내에서 가산</div>
</div>`;
    const p4 = `
<div class="page ct" style="position:relative;">
  <style>${H}</style>
  <h3 style="margin-top:0;">제4조 【기간】</h3>
  <div>① 본 계약의 유효기간은 계약일로부터 1년간으로 하고, 해약할 경우는 그 3개월 전에 상대방에게 통지하여야 한다. 다만 상호 통지가 없는 경우 본 계약은 계속 유효한 것으로 한다.<br>② “甲”이 해당 보수를 연체할 시에 “乙”은 “甲”에게 해당 사항을 통지하고 계약을 해지할 수 있다.</div>
  <h3>제5조 【의무】</h3>
  <div>“甲”은 본 계약의무 수행에 필요한 증빙자료 및 제반 서류를 신속 정확하게 “乙”에게 제공하여야 하며, “乙”은 “甲”이 제공한 자료에 의해 합리적이고 타당한 회계기준에 따라 성실하게 업무를 수행하여야 한다.</div>
  <h3>제6조 【기밀의 보장】</h3>
  <div>“乙”은 계약업무 수행 과정에서 “甲”의 기밀을 엄수하여야 한다.</div>
  <h3>제7조 【해약의 책임】</h3>
  <div>① “甲”의 사정에 의해 본 계약이 해지될 경우 해약 이후에 야기되는 세무처리에 대하여 “乙”은 그 책임을 지지 아니한다.<br>② “乙”의 사정에 의해 본 계약업무를 수행하지 못할 경우, “乙”은 그 시점까지 모든 업무를 정리하고 “甲”과 “乙”은 상호 협의하여 본 계약업무를 종결시키기로 한다.</div>
  <h3>제8조 【기타】</h3>
  <div>① “甲”이 제공한 자료의 불비 및 사실과 다른 자료의 제시 등의 사유로 본 계약업무 수행이 불가능할 경우에 발생하는 문제에 대하여, “乙”은 그 책임을 지지 아니한다. 이러한 경우에도 “甲”은 기장대리 보수월정액을 “乙”에게 지불하여야 한다.<br>② 천재지변 기타 이에 준하는 사유로 본 계약을 이행할 수 없을 때는 본 계약 불이행의 책임은 “甲”, “乙” 쌍방에게 없는 것으로 한다.<br>③ 본 계약에 명시하지 아니한 사항은 일반 관례에 따라 “甲”과 “乙”이 상호 합의하여 결정한다.</div>
  <h3>제9조 【소지 의무】</h3>
  <div>위 사실을 증명하기 위해 본 계약서를 2통 작성하여 “甲”과 “乙”이 각각 1통씩 소지한다</div>
  <div class="c" style="margin:36px 0 26px;font-size:13px;">${t.y}. &nbsp;&nbsp;&nbsp; ${t.m}. &nbsp;&nbsp;&nbsp; ${t.d}.</div>
  <div style="display:flex;justify-content:space-around;font-size:13px;line-height:2.4;">
    <div style="text-align:center;">위임인(甲)<br>“ ${esc(c.bizName)} ”<br>대표 &nbsp;&nbsp;<span style="display:inline-block;min-width:90px;">${esc(c.repName)}</span> &nbsp;(인)</div>
    <div style="text-align:center;">수임인(乙)<br>“편한세무회계”<br>대표 &nbsp;&nbsp;<span style="display:inline-block;min-width:90px;">편 성 웅</span> &nbsp;${signO("(인)")}</div>
  </div>
</div>`;
    return [p1, p2, p3, p4, cms(d, { blankSign: true })];
  }

  return { CSS, cms, hometax, nhis, goyong, pension, contract, excelRow };
})();
