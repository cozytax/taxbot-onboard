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

  // 도장: 고객은 이름 막도장(원형), 사무실은 직인(이미지 있으면 이미지, 없으면 사각 인장)
  const nameSeal = (name) => `<span class="seal-name">${[...String(name || "").slice(0, 4)].map((ch) => `<i>${esc(ch)}</i>`).join("")}</span>`;
  const officeSeal = (o) => o.sealUrl ? `<img class="seal-img" src="${o.sealUrl}">` : `<span class="seal-office"><span>${esc(o.name)}<br>${esc(o.rep)} 인</span></span>`;

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
  .seal-name { display:inline-flex; flex-direction:column; align-items:center; justify-content:center; width:46px; height:46px; border:2px solid #c8102e; border-radius:50%; color:#c8102e; vertical-align:middle; margin-left:-12px; opacity:.9; transform:rotate(-8deg); }
  .seal-name > i { font-style:normal; font-size:11px; font-weight:700; line-height:1.05; display:block; }
  .seal-office { display:inline-flex; align-items:center; justify-content:center; width:58px; height:58px; border:2.5px solid #c8102e; color:#c8102e; font-size:9px; font-weight:700; text-align:center; line-height:1.25; vertical-align:middle; margin-left:-16px; opacity:.9; }
  .seal-img { width:58px; height:58px; vertical-align:middle; margin-left:-16px; }
  .chk { display:inline-block; width:12px; height:12px; border:1px solid #222; vertical-align:-2px; margin:0 3px 0 1px; text-align:center; font-size:10px; line-height:10px; }
  .chk.on::after { content:"V"; font-weight:700; }
  .formno { font-size:10px; color:#333; }
  .date-line { text-align:center; margin:14px 0 6px; font-size:12px; }
  .date-line b { display:inline-block; min-width:36px; }
  `;

  /* ---------- 1. CMS 자동이체 이용 신청서 (JPG) ---------- */
  function cms(d) {
    const { o, c, t } = d;
    return `
<div class="page" style="font-size:10.5px;padding:34px 40px;">
  <div style="display:flex;align-items:center;justify-content:space-between;">
    <img src="${o.logoUrl}" style="height:34px;">
    <div style="flex:1;text-align:center;font-size:20px;font-weight:700;letter-spacing:3px;">자동이체 이용 신청서</div>
    <div style="width:140px;"></div>
  </div>
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
      <th style="width:14%">신청인</th><td style="width:36%;height:52px;"><span style="margin-left:60px;">${esc(c.repName)}</span> ${nameSeal(c.repName)} <span class="tiny">(인) 또는 서명</span></td>
      <th style="width:14%">예금(카드)주<br>동의란</th><td><span style="margin-left:60px;">${esc(c.accountHolder)}</span> ${nameSeal(c.accountHolder)} <span class="tiny">(인) 또는 서명</span></td>
    </tr>
  </table>
  <div class="tiny" style="margin-top:6px;color:#c8102e;font-weight:700;">*신청인과 예금주/카드주가 상이한 경우에는 예금주/카드주가 의 동의 필요하며, 날인 또는 서명은 출금통장의 거래날인, 서명 사용</div>
</div>`;
  }

  /* ---------- 2. 홈택스 세무대리정보 이용(해지)신청서 [별지 제6호 서식] (PDF) ---------- */
  function hometax(d) {
    const { o, c, t } = d;
    const corp = c.bizType === "02";
    return `
<div class="page" style="font-size:10.5px;padding:38px 46px;">
  <div class="formno">[별지 제6호 서식]</div>
  <h1 style="margin:2px 0 2px;">홈택스 세무대리정보 이용(해지)신청서</h1>
  <div class="r small" style="margin-bottom:4px;">접수번호 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
  <table>
    <tr><th rowspan="5" style="width:17%;text-align:left;">1.신청인 및<br>정보이용(해지)<br>사업장</th>
        <td style="width:41.5%"><span class="small">① 성명(대표자명)</span><br><span class="v">${esc(c.repName)}</span></td>
        <td><span class="small">② 주민등록번호(외국인등록번호 등)</span><br><span class="v">${esc(c.rrn)}</span></td></tr>
    <tr><td><span class="small">③-1 상호(법인명)</span><br><span class="v">${esc(c.bizName)}</span></td><td><span class="small">④-1 사업자등록번호</span><br><span class="v">${esc(c.bizNo)}</span></td></tr>
    <tr><td><span class="small">③-2</span></td><td><span class="small">④-2</span></td></tr>
    <tr><td><span class="small">③-3</span></td><td><span class="small">④-3</span></td></tr>
    <tr><td colspan="2"><span class="small">⑤ 연락처(전화번호 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ) &nbsp;&nbsp;(휴대전화번호 : </span><span class="v">${esc(c.phone)}</span><span class="small"> )</span></td></tr>
    <tr><th style="text-align:left;">2.신청 구분</th><td colspan="2">
        <span class="small">⑥ 정보이용 신청</span> <span class="chk on"></span><br>
        <span class="small">⑦ 기존 정보이용 해지 후 새로운 정보이용 신청</span> <span class="chk"></span><br>
        <span class="small">⑧ 정보이용 해지신청</span> <span class="chk"></span></td></tr>
    <tr><th style="text-align:left;">3.세무대리정보<br>이용 구분 등<br><span class="small">(정보이용 신청<br>시 작성)</span></th><td colspan="2" class="small">
        ⑨ 세무대리정보이용 구분 및 기간<br>
        &nbsp;▶ 기장대리 : 동의 처리일로부터 <b>해지일까지</b> <span class="chk on"></span><br>
        &nbsp;▶ 신고대리 : 동의 처리일로부터 <b>당해 세무신고의 신고기한까지</b> <span class="chk"></span><br>
        &nbsp;&nbsp;&nbsp;&nbsp;외부조정(법인) : 동의 처리일로부터 <b>당해 세무신고의 신고기한까지</b> <span class="chk"></span><br>
        &nbsp;※ 세무대리인의 정보 이용 범위: 「홈택스 이용에 관한 규정」 제54조의 정보<br>
        <b>※ 신청인의 개인정보보호를 위하여 세무대리인과 위임계약이 해지된 경우 반드시 신청인 또는 세무대리인이 홈택스에서 수임등록을 해지하시기 바랍니다.</b></td></tr>
    <tr><th rowspan="2" style="text-align:left;">4.정보이용(해지)<br>세무대리인</th>
        <td><span class="small">⑩ 성명(상호)</span><br><span class="v">${esc(o.name)}</span></td><td><span class="small">⑪ 사업자등록번호</span><br><span class="v">${esc(o.bizNo)}</span></td></tr>
    <tr><td><span class="small">⑫ 세무사관리번호</span><br><span class="v">${esc(o.taxAgentNo)}</span></td><td><span class="small">⑬ 연락처</span><br><span class="v">${esc(o.mobile)}</span></td></tr>
  </table>
  <div style="margin:10px 0 4px;">상기 세무대리인이 국세청 홈택스에서 제공되는 신청인의 세무관련 정보 이용(해지)에 대하여 동의합니다.</div>
  <div class="r" style="margin:6px 20px 2px 0;">${t.y} 년 &nbsp; ${t.m} 월 &nbsp; ${t.d} 일</div>
  <div class="r" style="margin-right:20px;">신 청 인 : &nbsp;<span style="display:inline-block;min-width:70px;text-align:center;">${esc(c.repName)}</span> ${nameSeal(c.repName)} <span class="small">(서명 또는 인)</span></div>
  <div style="font-size:16px;font-weight:700;letter-spacing:6px;margin:6px 0 4px;">세무서장 <span style="font-size:11px;letter-spacing:0;font-weight:400;">귀하</span></div>

  <div style="background:#e9e9e9;border:1px solid #222;border-bottom:0;padding:4px 8px;text-align:center;font-weight:700;font-size:13px;letter-spacing:8px;">위 &nbsp;임 &nbsp;장 <span style="font-size:10px;letter-spacing:0;font-weight:400;">(대리인에게 위임하는 경우 작성)</span></div>
  <div class="box">
    위 신청인 본인은 아래 위임받은 사람에게 홈택스 세무대리정보 이용(해지)신청에 관한 모든 권리와 의무를 위임합니다.
    <div class="r" style="margin:8px 20px 4px 0;">위임하는 사람(신청인) : &nbsp;<span style="display:inline-block;min-width:70px;text-align:center;">${esc(c.repName)}</span> ${nameSeal(c.repName)} <span class="small">(서명 또는 인)</span></div>
  </div>
  <table style="border-top:0;">
    <tr><th rowspan="2" style="width:17%">위임받은<br>사 람</th><th style="width:16%">성 명</th><td style="width:25%">${esc(o.rep)}</td><th style="width:17%">주민등록번호</th><td>${esc(o.repRrn || "")}</td></tr>
    <tr><th>위임하는 사람과의 관계</th><td>세무대리인</td><th>연락처(전화번호)</th><td>${esc(o.mobile)}</td></tr>
  </table>
  <div style="background:#e9e9e9;border:1px solid #222;border-top:0;padding:3px 8px;text-align:center;font-weight:700;font-size:12px;">개인정보 수집·이용에 대한 동의 <span style="font-size:9.5px;font-weight:400;">(개인정보보호법 제24조)</span></div>
  <div class="box small" style="border-top:0;">
    <b>※ 동의를 거부할 권리가 있으며, 거부할 경우 신청서 처리 불가능 등의 불이익이 따를 수 있습니다.</b><br>
    &nbsp;○ 수집·이용목적 (신청서 처리, 사후관리 등) &nbsp;&nbsp;&nbsp;&nbsp; ○ 보유·이용기간 ( 5년 )<br>
    &nbsp;○ 수집대상 고유식별정보 (주민등록번호, 외국인등록번호, 여권번호 등)<br>
    &nbsp;<span class="chk on"></span> 상기내용에 대해 동의합니다. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span class="chk"></span> 상기내용에 대해 동의하지 않습니다.<br>
    <div style="display:flex;justify-content:space-between;margin-top:6px;padding:0 10px;">
      <span>신청인 : <span style="display:inline-block;min-width:70px;text-align:center;">${esc(c.repName)}</span> ${nameSeal(c.repName)} (서명 또는 인)</span>
      <span>위임받은 사람 : <span style="display:inline-block;min-width:60px;text-align:center;">${esc(o.rep)}</span> ${officeSeal(o)} (서명 또는 인)</span>
    </div>
  </div>
  <div class="tiny" style="margin-top:8px;">
    <b>※ 정보이용(해지) 신청 시 준비하실 사항</b><br>
    1.신청인 또는 국세기본법 제82조의 납세관리인이 신청 시 신분증(주민등록증, 운전면허증, 여권 등)<br>
    2.세무대리인 등 위임받은 사람이 신청 시 위임하는 사람(법인의 경우 법인대표자 등)의 신분증*(사본) 및 위임받은 사람의 신분증<br>
    <span style="margin-left:8px;">* 위임하는 사람이 희망하는 경우에 3개월 이내에 발급된 인감증명서(사본), 법인인감증명서(사본),본인서명사실확인서, 전자본인서명사실확인서 가능</span><br>
    <b>※ 다른 사람의 인장 도용 등 허위로 위임장을 작성하여 신청할 경우에는 「형법」 제231조와 제232조에 따라 사문서 위ㆍ변조 죄로 5년 이하의 징역 또는 1천만원 이하의 벌금에 처하게 됩니다.</b>
  </div>
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
  <div class="r" style="padding-right:40px;font-size:12px;">신청인 &nbsp;<span style="display:inline-block;min-width:80px;text-align:center;">${esc(c.repName)}</span> ${nameSeal(c.repName)} <span class="small">(서명 또는 인)</span></div>
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
    <span style="margin-left:66px;">성명</span> &nbsp;&nbsp;<span style="display:inline-block;min-width:80px;text-align:center;margin-left:170px;">${esc(c.repName)}</span> ${nameSeal(c.repName)} <span class="small">(서명 또는 인)</span></div>
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
    <span style="margin-left:116px;">대표자</span> &nbsp;&nbsp;<span style="display:inline-block;min-width:80px;text-align:center;">${esc(o.rep)}</span> ${officeSeal(o)} <span class="small">(서명 또는 인)</span>
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
    신청인(업무대행기관 사용자) &nbsp;&nbsp;<span style="display:inline-block;min-width:70px;text-align:center;margin-left:40px;">${esc(o.rep)}</span> ${officeSeal(o)} <span class="small">(서명 또는 인)</span><br>
    신청인(업무대행 위탁사업장 사용자) &nbsp;&nbsp;<span style="display:inline-block;min-width:70px;text-align:center;">${esc(c.repName)}</span> ${nameSeal(c.repName)} <span class="small">(서명 또는 인)</span>
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

  return { CSS, cms, hometax, nhis, goyong, pension, excelRow };
})();
