"use strict";
/* =====================================================================
   Boletim semanal SIMA: cálculos, texto automático, vista no ecrã e PDF
   Depende de: config.js, catalog.js, i18n.js, app.js
   ===================================================================== */
const BC = Object.assign({ title:"Boletim Semanal de Preços", titleEn:"Weekly Price Bulletin", institution:[], logos:[],
  mainProducts:[], level:"Retalhista", stableThreshold:2, numberOffset:0, fichaTecnica:[] }, SIMA_CONFIG.bulletin||{});
const LEVELS = ["Retalhista","Grossista","Produtor"];
const ZONES = { Sul:["Cidade de Maputo","Maputo","Gaza","Inhambane"], Centro:["Sofala","Manica","Tete","Zambézia","Zambezia"], Norte:["Nampula","Cabo Delgado","Niassa"] };
const B = { week:null, prov:"", market:"", level:BC.level };   // level: "Retalhista" | "Grossista" | "Produtor" | "ALL"

/* ---------- utilitários ---------- */
const weekStart = d => d - ((d+3)%7);                 // segunda-feira
const isoWeek = d => { const dt=new Date(d*DAY); const th=new Date(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth(),dt.getUTCDate()+3-((dt.getUTCDay()+6)%7)));
  const y0=new Date(Date.UTC(th.getUTCFullYear(),0,4)); return { w:1+Math.round(((th-y0)/DAY-3+((y0.getUTCDay()+6)%7))/7), y:th.getUTCFullYear() }; };
const lvName = l => t("lv"+l) !== "lv"+l ? t("lv"+l) : sellerName(l);
const tf = (k, o) => t(k).replace(/\{(\w+)\}/g,(m,x)=>o[x]??m);
const shortMkt = m => { const s=String(m||"").replace(/^Mercado\s+/i,"").replace(/^Municipal\s+/i,"").replace(/^(de|do|da|dos|das)\s+/i,"").trim(); return s && s.length>2 ? s : String(m||""); };
const zoneOf = prov => { for(const z in ZONES) if(ZONES[z].some(p=>norm(p)===norm(prov))) return z; return "Outra"; };
const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const pct = (c,p) => (c!=null && p) ? (c/p-1)*100 : null;
const lowerName = code => pName(code).toLowerCase();
const listJoin = arr => { arr=arr.filter(Boolean); if(arr.length<2) return arr.join(""); return arr.slice(0,-1).join(", ")+(LANG==="pt"?" e ":" and ")+arr[arr.length-1]; };
const fmtMt = (v,prod) => fmtN(v)+(PROD_UNIT[prod]==="un" ? (LANG==="pt"?" Mt/unidade":" MZN/unit") : (LANG==="pt"?" Mt/kg":" MZN/kg"));
const fmtD = (d,o) => new Date(d*DAY).toLocaleDateString(LANG==="pt"?"pt-PT":"en-GB",Object.assign({timeZone:"UTC"},o||{day:"numeric",month:"long",year:"numeric"}));

// "26 de outubro a 1 de novembro de 2026" / "19 a 25 de outubro de 2026"
function fmtRange(w){ const a=new Date(w*DAY), b=new Date((w+6)*DAY), same=a.getUTCMonth()===b.getUTCMonth(), sy=a.getUTCFullYear()===b.getUTCFullYear();
  if(LANG==="pt") return same ? `${a.getUTCDate()} a ${fmtD(w+6)}` : `${fmtD(w,sy?{day:"numeric",month:"long"}:undefined)} a ${fmtD(w+6)}`;
  return same ? `${a.getUTCDate()} to ${fmtD(w+6)}` : `${fmtD(w,sy?{day:"numeric",month:"long"}:undefined)} to ${fmtD(w+6)}`; }
function weekLabel(w){ return (LANG==="pt"?"Semana de ":"Week of ")+fmtRange(w); }
function bWeeks(){ const s=new Set(S.obs.map(o=>weekStart(o.d))); return [...s].sort((a,b)=>b-a); }

/* ---------- cálculo do boletim ---------- */
function bCompute(level){
  const L0 = (level && level!=="ALL") ? level : (B.level!=="ALL" ? B.level : BC.level);
  const weeks=bWeeks(); if(!weeks.length) return null;
  // por defeito: a última semana completa (se a semana em curso ainda não terminou, usa a anterior)
  const today=dayKey(Date.now());
  const def = (weeks[0]+6>=today && weeks[1]!=null) ? weeks[1] : weeks[0];
  const w0 = (B.week!=null && weeks.includes(B.week)) ? B.week : def; B.week=w0;
  const w1 = w0-7, inW=(d,w)=>d>=w&&d<w+7;
  const base = S.obs.filter(o=>(!B.prov||o.prov===B.prov) && (!B.market||o.mkt===B.market));
  const cur = base.filter(o=>inW(o.d,w0)), prev = base.filter(o=>inW(o.d,w1));
  // nível -> produto -> mercado -> {c:[preços], p:[preços], prov}
  const T = {};
  const add=(list,key)=>{ for(const o of list){ const L=o.sel; T[L]??={}; T[L][o.prod]??={}; const m=(T[L][o.prod][o.mkt]??={c:[],p:[],prov:o.prov}); m[key].push(o.price); } };
  add(cur,"c"); add(prev,"p");
  const rowsFor=(L,prod)=>{ const P=(T[L]||{})[prod]||{}; return Object.entries(P).map(([mkt,v])=>({mkt,prov:v.prov,cur:mean(v.c),prev:mean(v.p),n:v.c.length}))
    .map(r=>({...r,pct:pct(r.cur,r.prev)})); };
  const statsFor=(L,prod)=>{
    const rows=rowsFor(L,prod), withCur=rows.filter(r=>r.cur!=null), withPrev=rows.filter(r=>r.prev!=null);
    if(!withCur.length) return null;
    const avg=mean(withCur.map(r=>r.cur)), avgP=withPrev.length?mean(withPrev.map(r=>r.prev)):null;
    const vals=[...new Set(withCur.map(r=>Math.round(r.cur*100)/100))].sort((a,b)=>b-a);
    const at=v=>withCur.filter(r=>Math.round(r.cur*100)/100===v).map(r=>shortMkt(r.mkt));
    const both=rows.filter(r=>r.cur!=null&&r.prev!=null), th=BC.stableThreshold;
    // tendência: média das variações nos mercados com registo nas duas semanas (comparação justa); senão, variação da média
    const trend = both.length ? mean(both.map(r=>r.pct)) : pct(avg,avgP);
    return { prod, rows, avg, avgP, chg:pct(avg,avgP), trend, max:vals[0], maxM:at(vals[0]), max2:vals[1], max2M:vals.length>1?at(vals[1]):[],
      min:vals[vals.length-1], minM:at(vals[vals.length-1]), min2:vals.length>2?vals[vals.length-2]:null, min2M:vals.length>2?at(vals[vals.length-2]):[],
      up:both.filter(r=>r.pct>th).length, down:both.filter(r=>r.pct<-th).length, same:both.filter(r=>Math.abs(r.pct)<=th).length, nMk:withCur.length };
  };
  // produtos principais
  const lvProds = Object.keys(T[L0]||{});
  const countCur = p => cur.filter(o=>o.sel===L0&&o.prod===p).length;
  let main = (BC.mainProducts||[]).filter(p=>countCur(p)>0);
  const extra = lvProds.filter(p=>!main.includes(p)&&countCur(p)>0).sort((a,b)=>countCur(b)-countCur(a));
  while(main.length<Math.min(6,(BC.mainProducts||[]).length||6) && extra.length) main.push(extra.shift());
  main = main.slice(0,6);
  const mainStats = main.map(p=>statsFor(L0,p)).filter(Boolean);
  // tabelas por nível (todos os produtos com dados nas duas semanas ou na recente)
  const levelTables = {};
  for(const L of LEVELS){ const prods=Object.keys(T[L]||{}).filter(p=>rowsFor(L,p).some(r=>r.cur!=null||r.prev!=null))
      .sort((a,b)=>(PROD[a]?.cat||"").localeCompare(PROD[b]?.cat||"")||pName(a).localeCompare(pName(b)));
    if(!prods.length) continue;
    const mkts=[...new Set(prods.flatMap(p=>rowsFor(L,p).map(r=>r.mkt)))];
    const provOf={}; prods.forEach(p=>rowsFor(L,p).forEach(r=>provOf[r.mkt]=r.prov));
    mkts.sort((a,b)=>(zoneRank(provOf[a])-zoneRank(provOf[b]))||String(provOf[a]).localeCompare(String(provOf[b]))||a.localeCompare(b));
    const cell={}; prods.forEach(p=>rowsFor(L,p).forEach(r=>{ cell[p+"|"+r.mkt]=r; }));
    levelTables[L]={prods,mkts,cell,provOf}; }
  // fluxos (proveniência) na semana
  const flows={};
  for(const o of cur){ if(o.sel!==L0 || !o.orig||!o.orig.length) continue; const z=zoneOf(o.prov); flows[z]??={}; flows[z][o.prod]??={};
    const k=o.mkt; const f=(flows[z][o.prod][k]??={mkt:o.mkt,prov:o.prov,orig:new Set(),pr:[],lv:new Set()}); o.orig.forEach(x=>f.orig.add(x)); f.pr.push(o.price); f.lv.add(o.sel); }
  // quantidades no grossista
  const qty={};
  const addQ=(list,key)=>{ for(const o of list){ if(o.sel!=="Grossista"||!o.qty) continue; const k=o.mkt+"|"+o.prod; const q=(qty[k]??={mkt:o.mkt,prov:o.prov,prod:o.prod,c:0,p:0}); q[key]+=o.qty; } };
  addQ(cur,"c"); addQ(prev,"p");
  const qtyRows=Object.values(qty).filter(q=>q.c||q.p).sort((a,b)=>(zoneRank(a.prov)-zoneRank(b.prov))||a.mkt.localeCompare(b.mkt)||pName(a.prod).localeCompare(pName(b.prod)));
  // pecuária: médias mensais por província (mês da semana vs mês anterior)
  const wEnd=new Date((w0+6)*DAY), mY=wEnd.getUTCFullYear(), mM=wEnd.getUTCMonth();
  const mStart=Math.floor(Date.UTC(mY,mM,1)/DAY), mNext=Math.floor(Date.UTC(mY,mM+1,1)/DAY), pStart=Math.floor(Date.UTC(mY,mM-1,1)/DAY);
  const live={}; const liveProds=new Set();
  for(const o of base){ if((PROD[o.prod]?.cat||o.cat)!=="Pecuaria") continue; const k=o.d>=mStart&&o.d<mNext?"c":(o.d>=pStart&&o.d<mStart?"p":null); if(!k) continue;
    liveProds.add(o.prod); const r=((live[o.prov]??={})[o.prod]??={c:[],p:[]}); r[k].push(o.price); }
  const liveP=[...liveProds].sort((a,b)=>pName(a).localeCompare(pName(b)));
  const liveProv=Object.keys(live).sort((a,b)=>zoneRank(a)-zoneRank(b)||a.localeCompare(b));
  // indicadores
  const sf=cur.reduce((s,o)=>s+(o.sf||0),0), sm=cur.reduce((s,o)=>s+(o.sm||0),0);
  const kpi={ records:cur.length, markets:new Set(cur.map(o=>o.mkt)).size, provs:new Set(cur.map(o=>o.prov)).size, products:new Set(cur.map(o=>o.prod)).size, sf, sm };
  const wk=isoWeek(w0);
  return { level:L0, w0, w1, cur, prev, main, mainStats, levelTables, flows, qtyRows, live, liveP, liveProv, monthCur:mStart, monthPrev:pStart, kpi,
    number: wk.w + (+BC.numberOffset||0), year: wk.y, statsFor };
}
function zoneRank(prov){ return {Sul:0,Centro:1,Norte:2,Outra:3}[zoneOf(prov)]; }

/* ---------- texto automático ---------- */
function trendWord(chg){ const th=BC.stableThreshold; if(chg==null) return null; return chg>th?"up":chg<-th?"down":"flat"; }
function bHeadline(R){
  const ups=R.mainStats.filter(s=>trendWord(s.trend)==="up"), downs=R.mainStats.filter(s=>trendWord(s.trend)==="down");
  const names=a=>listJoin(a.slice(0,3).map(s=>lowerName(s.prod)));
  if(LANG==="pt"){
    if(ups.length && ups.length>=downs.length) return `O preço de ${names(ups)} nos mercados monitorados pelo SIMA na presente semana subiu.`;
    if(downs.length) return `O preço de ${names(downs)} nos mercados monitorados pelo SIMA na presente semana desceu.`;
    return "Os preços dos principais produtos monitorados pelo SIMA mantiveram-se estáveis na presente semana.";
  }
  if(ups.length && ups.length>=downs.length) return `Prices of ${names(ups)} rose this week in the markets monitored by SIMA.`;
  if(downs.length) return `Prices of ${names(downs)} fell this week in the markets monitored by SIMA.`;
  return "Prices of the main products monitored by SIMA were stable this week.";
}
function bIntro(R){
  const rng=fmtRange(R.w0);
  const ups=R.mainStats.filter(s=>trendWord(s.trend)==="up"), downs=R.mainStats.filter(s=>trendWord(s.trend)==="down");
  const k=R.kpi, tot=k.sf+k.sm, wPct=tot?Math.round(k.sf/tot*100):null;
  if(LANG==="pt"){
    let g = "O Sistema de Monitoria de Preços de Produtos Agrícolas (SIMA), na sua visita aos mercados do País"+(B.market?` (${B.market})`:B.prov?` (província de ${B.prov})`:"")+`, na semana de ${rng}, constatou que o preço dos principais produtos monitorados, no geral, `;
    const flat=R.mainStats.length-ups.length-downs.length;
    if(flat>=ups.length && flat>=downs.length){ g+="continua estável"; const ex=[...ups,...downs]; if(ex.length) g+=`, com excepção de ${listJoin(ex.map(s=>lowerName(s.prod)))}, cuja tendência é ${ups.length>=downs.length?"subir":"descer"}`; }
    else if(ups.length>downs.length) g+=`tem tendência a subir, sobretudo ${listJoin(ups.slice(0,3).map(s=>lowerName(s.prod)))}`;
    else g+=`tem tendência a descer, sobretudo ${listJoin(downs.slice(0,3).map(s=>lowerName(s.prod)))}`;
    g+=`. Foram recolhidos ${fmtN(k.records,0)} registos de preço em ${k.markets} ${k.markets===1?"mercado":"mercados"} de ${k.provs} ${k.provs===1?"província":"províncias"}`;
    if(wPct!=null) g+=`; ${wPct}% dos vendedores inquiridos eram mulheres`;
    return g+".";
  }
  let g = "During its visits to the country's markets"+(B.market?` (${B.market})`:B.prov?` (${B.prov} province)`:"")+`, the Agricultural Commodity Price Monitoring System (SIMA) found that, in the week of ${rng}, prices of the main monitored products `;
  const flat=R.mainStats.length-ups.length-downs.length;
  if(flat>=ups.length && flat>=downs.length){ g+="were generally stable"; const ex=[...ups,...downs]; if(ex.length) g+=`, except for ${listJoin(ex.map(s=>lowerName(s.prod)))}, which tended to ${ups.length>=downs.length?"rise":"fall"}`; }
  else if(ups.length>downs.length) g+=`tended to rise, especially ${listJoin(ups.slice(0,3).map(s=>lowerName(s.prod)))}`;
  else g+=`tended to fall, especially ${listJoin(downs.slice(0,3).map(s=>lowerName(s.prod)))}`;
  g+=`. ${fmtN(k.records,0)} price records were collected in ${k.markets} markets across ${k.provs} ${k.provs===1?"province":"provinces"}`;
  if(wPct!=null) g+=`; ${wPct}% of the sellers interviewed were women`;
  return g+".";
}
function bProdTitle(s,L){ return LANG==="pt" ? `Variação do preço de ${lowerName(s.prod)} no mercado ${lvName(L).toLowerCase()}` : `${pName(s.prod)} price change at ${lvName(L).toLowerCase()} level`; }
function bProdLead(s){
  const n=lowerName(s.prod), both=s.up+s.down+s.same;
  if(LANG==="pt"){
    if(!both) return `O preço de ${n} foi registado em ${s.nMk} ${s.nMk===1?"mercado":"mercados"} na presente semana, sem registos na semana anterior para comparação.`;
    if(s.up>s.down && s.up>=s.same) return `O preço de ${n} na presente semana variou com tendência a subir, tendo aumentado em ${s.up} de ${both} mercados com registos nas duas semanas.`;
    if(s.down>s.up && s.down>=s.same) return `O preço de ${n} na presente semana variou com tendência a descer, tendo baixado em ${s.down} de ${both} mercados com registos nas duas semanas.`;
    return `O preço de ${n} na presente semana continua estável na maioria dos mercados monitorados (${s.same} de ${both}); no entanto, o quadro a seguir apresenta as ocorrências de variação.`;
  }
  if(!both) return `${pName(s.prod)} prices were recorded in ${s.nMk} market${s.nMk===1?"":"s"} this week, with no records in the previous week for comparison.`;
  if(s.up>s.down && s.up>=s.same) return `${pName(s.prod)} prices tended to rise this week, increasing in ${s.up} of ${both} markets with records in both weeks.`;
  if(s.down>s.up && s.down>=s.same) return `${pName(s.prod)} prices tended to fall this week, decreasing in ${s.down} of ${both} markets with records in both weeks.`;
  return `${pName(s.prod)} prices remained stable in most monitored markets (${s.same} of ${both}); the table below shows where they changed.`;
}
function bProdText(s, qn){
  const n=lowerName(s.prod);
  const cmp = s.avgP!=null ? (LANG==="pt" ? `, contra ${fmtMt(s.avgP,s.prod)} da semana anterior (${fmtPct(s.chg)})` : `, against ${fmtMt(s.avgP,s.prod)} the previous week (${fmtPct(s.chg)})`) : (LANG==="pt"?` (${t("noPrev")})`:` (${t("noPrev")})`);
  const followed=(v,ms)=> v!=null&&ms.length ? (LANG==="pt"?`, seguido de ${listJoin(ms.slice(0,4))} a ${fmtMt(v,s.prod)}`:`, followed by ${listJoin(ms.slice(0,4))} at ${fmtMt(v,s.prod)}`) : "";
  if(s.nMk===1) return LANG==="pt" ? `O preço médio de ${n} na presente semana é de ${fmtMt(s.avg,s.prod)}${cmp}, registado apenas em ${s.maxM[0]} (Quadro ${qn}).` : `The average ${n} price this week is ${fmtMt(s.avg,s.prod)}${cmp}, recorded only in ${s.maxM[0]} (Table ${qn}).`;
  if(LANG==="pt") return `O preço médio de ${n} na presente semana é de ${fmtMt(s.avg,s.prod)}${cmp}. O máximo é de ${fmtMt(s.max,s.prod)}, praticado em ${listJoin(s.maxM.slice(0,4))}${followed(s.max2,s.max2M)}; o mínimo é de ${fmtMt(s.min,s.prod)}, praticado em ${listJoin(s.minM.slice(0,4))}${followed(s.min2,s.min2M)} (Quadro ${qn}).`;
  return `The average ${n} price this week is ${fmtMt(s.avg,s.prod)}${cmp}. The highest is ${fmtMt(s.max,s.prod)} in ${listJoin(s.maxM.slice(0,4))}${followed(s.max2,s.max2M)}; the lowest is ${fmtMt(s.min,s.prod)} in ${listJoin(s.minM.slice(0,4))}${followed(s.min2,s.min2M)} (Table ${qn}).`;
}
function bChangeRows(s){
  const both=s.rows.filter(r=>r.cur!=null&&r.prev!=null);
  let rows=both.filter(r=>Math.abs(r.pct)>=0.005).sort((a,b)=>a.pct-b.pct);
  if(!rows.length) rows=both;
  return rows.slice(0,8);
}
function bFlowParas(R){
  const out=[];
  for(const z of ["Sul","Centro","Norte","Outra"]){ const Z=R.flows[z]; if(!Z) continue;
    const prods=Object.keys(Z).sort((a,b)=>(R.main.indexOf(a)<0?99:R.main.indexOf(a))-(R.main.indexOf(b)<0?99:R.main.indexOf(b))||pName(a).localeCompare(pName(b)));
    for(const p of prods){ const ents=Object.values(Z[p]).sort((a,b)=>a.mkt.localeCompare(b.mkt));
      const parts=ents.map(e=>{ const orig=listJoin([...e.orig].slice(0,3)), pr=fmtMt(mean(e.pr),p), lv=[...e.lv].map(l=>lvName(l).toLowerCase()).join("/");
        return LANG==="pt" ? `o mercado ${shortMkt(e.mkt)} (${lv}) recebeu ${lowerName(p)} proveniente de ${orig}, ao preço médio de ${pr}` : `${shortMkt(e.mkt)} market (${lv}) received ${pName(p).toLowerCase()} from ${orig}, at an average price of ${pr}`; });
      let txt=parts.join("; "); txt=txt.charAt(0).toUpperCase()+txt.slice(1)+".";
      out.push({ title: LANG==="pt" ? `Fluxo de ${lowerName(p)} na ${t("z"+z)}` : `${pName(p)} flows, ${t("z"+z)}`, text:txt, zone:z, prod:p, n:ents.length });
    } }
  return out;
}

/* ---------- vista no ecrã ---------- */
const ROMAN=["I","II","III","IV","V"];
function bLevelsToShow(){ if(B.level!=="ALL") return [B.level];
  return LEVELS.filter(L=>S.obs.some(o=>o.sel===L)); }
function bScopeLabel(){ const parts=[]; if(B.market) parts.push(`${t("mercado")}: ${B.market}`); else if(B.prov) parts.push(`${t("bProv")}: ${B.prov}`);
  parts.push(B.level==="ALL" ? t("bAllLevels") : `${t("bLevel")}: ${lvName(B.level)}`); return parts.join(" · "); }
// HTML de uma parte (um nível de mercado)
function partHtml(R, qn, idx, multi){
  const L=R.level;
  if(!R.mainStats.length) return multi?`<h2 class="b-part">${esc(tf("bPart",{n:ROMAN[idx]||idx+1,lv:lvName(L).toLowerCase()}))}</h2><div class="panel empty">${esc(t("noLevelData"))}</div>`:"";
  const q6=qn.peek()+R.mainStats.length+1;
  const cards=R.mainStats.map(s=>{ const n=qn(); const rows=bChangeRows(s);
    return `<article class="panel b-card"><header><div><b class="b-tk">${esc(pTk(s.prod))}</b> ${esc(pName(s.prod))}</div><div class="num b-avg">${fmtN(s.avg)} <small>${esc(unitLbl(s.prod))}</small> <span class="chg ${cls(s.chg)}">${fmtPct(s.chg)}</span></div></header>
      <h4>${esc(bProdTitle(s,L))}</h4><p>${esc(bProdLead(s))} ${esc(bProdText(s,q6))}</p>
      ${rows.length?`<div class="b-tw"><table class="b-t"><caption>${esc(tf("qPriceVar",{n,p:lowerName(s.prod)}))}</caption><thead><tr><th>${esc(t("mercado"))}</th><th class="r">${esc(t("semAnt"))}</th><th class="r">${esc(t("semRec"))}</th><th class="r">${esc(t("mud"))}</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td>${esc(shortMkt(r.mkt))}</td><td class="r num">${fmtN(r.prev)}</td><td class="r num">${fmtN(r.cur)}</td><td class="r num ${cls(r.pct)}">${fmtPct(r.pct)}</td></tr>`).join("")}</tbody></table></div>`:""}
    </article>`; }).join("");
  const n6=qn();
  const cols=R.mainStats.map(s=>({s, rows:s.rows.filter(r=>r.cur!=null).sort((a,b)=>a.cur-b.cur)}));
  const maxLen=Math.max(0,...cols.map(c=>c.rows.length));
  let t6=`<section class="panel"><div class="ph"><h2>${esc(tf("q6a",{n:n6,lv:lvName(L).toLowerCase(),r:fmtRange(R.w0)}))}</h2></div><div class="b-tw"><table class="b-t b-6a"><thead><tr>${cols.map(c=>`<th colspan="2" class="b-grp">${esc(pName(c.s.prod))}</th>`).join("")}</tr><tr>${cols.map(()=>`<th>${esc(t("mercado"))}</th><th class="r">${esc(t("semRec"))}</th>`).join("")}</tr></thead><tbody>`;
  for(let i=0;i<maxLen;i++){ t6+="<tr>"+cols.map(c=>{ const r=c.rows[i]; if(!r) return `<td></td><td></td>`; const lo=i===0&&c.rows.length>1, hi=i===c.rows.length-1&&c.rows.length>1;
    return `<td class="${lo?"down":hi?"up":""}">${esc(shortMkt(r.mkt))}</td><td class="r num ${lo?"down":hi?"up":""}">${fmtN(r.cur)}</td>`; }).join("")+"</tr>"; }
  t6+=`</tbody></table></div><p class="b-note">${esc(t("q6aNote"))}</p></section>`;
  const fl=bFlowParas(R), flMain=fl.filter(f=>R.main.includes(f.prod)), flShow=flMain.length?flMain:fl.slice(0,12), nF=qn();
  const flowsHtml=`<section class="panel"><div class="ph"><h2>${esc(t("bFlows"))} · ${esc(lvName(L))}</h2></div><div class="b-body">${flShow.length? flShow.map(f=>`<p><b>${esc(f.title)}:</b> ${esc(f.text)}</p>`).join("") : `<p class="flat">${esc(t("noFlows"))}</p>`}</div>
    ${fl.length?`<div class="b-tw"><table class="b-t"><caption>${esc(tf("qFlows",{n:nF}))}</caption><thead><tr><th>${esc(t("zona"))}</th><th>${esc(t("produto"))}</th><th>${esc(t("mercado"))}</th><th>${esc(t("origem"))}</th><th class="r">${esc(t("precoMedio"))}</th></tr></thead><tbody>
    ${["Sul","Centro","Norte","Outra"].flatMap(z=>Object.entries(R.flows[z]||{}).flatMap(([p,M])=>Object.values(M).map(e=>`<tr><td>${esc(t("z"+z))}</td><td>${esc(pName(p))}</td><td>${esc(shortMkt(e.mkt))}</td><td>${esc([...e.orig].join(", "))}</td><td class="r num">${fmtN(mean(e.pr))}</td></tr>`))).join("")}</tbody></table></div>`:""}</section>`;
  const T=R.levelTables[L]; let lvHtml="";
  if(T){ const n=qn();
    lvHtml=`<section class="panel"><div class="ph"><h2>${esc(tf("qLevel",{n,lv:lvName(L).toLowerCase()}))}</h2></div><div class="b-tw"><table class="b-t b-wide"><thead>
      <tr><th rowspan="2">${esc(t("mercado"))}</th>${T.prods.map(p=>`<th colspan="3" class="b-grp">${esc(pName(p))}</th>`).join("")}</tr>
      <tr>${T.prods.map(()=>`<th class="r">${esc(t("semAnt"))}</th><th class="r">${esc(t("semRec"))}</th><th class="r">${esc(t("mud"))}</th>`).join("")}</tr></thead><tbody>
      ${T.mkts.map(m=>`<tr><td title="${esc(T.provOf[m])}">${esc(shortMkt(m))}</td>${T.prods.map(p=>{ const r=T.cell[p+"|"+m]; return r?`<td class="r num">${fmtN(r.prev)}</td><td class="r num">${fmtN(r.cur)}</td><td class="r num ${cls(r.pct)}">${r.pct==null?".":fmtN(r.pct,0)}</td>`:`<td class="r">.</td><td class="r">.</td><td class="r">.</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div><p class="b-note">${esc(t("qLevelNote"))}</p></section>`; }
  return (multi?`<h2 class="b-part">${esc(tf("bPart",{n:ROMAN[idx]||idx+1,lv:lvName(L).toLowerCase()}))}</h2>`:"")+
    `<h3 class="b-sec">${esc(t("bDyn"))}${multi?"":" · "+esc(lvName(L))}</h3><div class="b-grid">${cards}</div>`+t6+flowsHtml+lvHtml;
}
function renderBulletin(){
  const root=$("viewBulletin"); if(!root) return;
  if(root.hidden) return;
  const levels=bLevelsToShow(), multi=B.level==="ALL";
  const Rs=levels.map(L=>bCompute(L)).filter(Boolean);
  const R0=Rs.find(r=>r.level===BC.level&&r.mainStats.length)||Rs.find(r=>r.mainStats.length)||Rs[0]||null;
  const weeks=bWeeks(), provs=[...new Set(S.obs.map(o=>o.prov))].filter(p=>p&&p!=="—").sort((a,b)=>a.localeCompare(b,"pt"));
  const mkts=[...new Set(S.obs.filter(o=>!B.prov||o.prov===B.prov).map(o=>o.mkt))].filter(m=>m&&m!=="—").sort((a,b)=>a.localeCompare(b,"pt"));
  const ctrl=`<section class="filters b-ctrl">
    <div class="fld"><label for="bWeek">${esc(t("bWeek"))}</label><select id="bWeek">${weeks.map(w=>`<option value="${w}"${R0&&w===R0.w0?" selected":""}>${esc(fmtD(w,{day:"2-digit",month:"2-digit"}))}–${esc(fmtD(w+6,{day:"2-digit",month:"2-digit",year:"2-digit"}))}</option>`).join("")}</select></div>
    <div class="fld"><label for="bProv">${esc(t("bProv"))}</label><select id="bProv"><option value="">${esc(t("allF"))}</option>${provs.map(p=>`<option${p===B.prov?" selected":""}>${esc(p)}</option>`).join("")}</select></div>
    <div class="fld"><label for="bMkt">${esc(t("mercado"))}</label><select id="bMkt"><option value="">${esc(t("all"))}</option>${mkts.map(m=>`<option value="${esc(m)}"${m===B.market?" selected":""}>${esc(m)}</option>`).join("")}</select></div>
    <div class="fld"><label for="bLevel">${esc(t("bLevel"))}</label><select id="bLevel"><option value="ALL"${B.level==="ALL"?" selected":""}>${esc(t("bAllLevels"))}</option>${LEVELS.map(l=>`<option value="${l}"${l===B.level?" selected":""}>${esc(lvName(l))}</option>`).join("")}</select></div>
    <div class="fld" style="justify-content:flex-end"><button class="btn" id="bReset" type="button">${esc(t("resetFilters"))}</button></div>
    <div class="fld" style="justify-content:flex-end"><button class="btn primary" id="bPdf" type="button">${esc(t("bExport"))}</button></div>
  </section>`;
  if(!R0 || !Rs.some(r=>r.cur.some(o=>o.sel===r.level))){ root.innerHTML=ctrl+`<div class="panel empty">${esc(t("noWeekData"))}</div>`; bindBulletin(); return; }
  let q=0; const qn=()=>++q; qn.peek=()=>q;
  const k=R0.kpi, tot=k.sf+k.sm;
  const kp=[[t("kRecords"),fmtN(k.records,0)],[t("kMarkets"),fmtN(k.markets,0)],[t("kProvs"),fmtN(k.provs,0)],[t("kProducts"),fmtN(k.products,0)],[t("kWomen"),tot?Math.round(k.sf/tot*100)+"%":"—"]];
  const head=`<section class="panel b-head">
    <div class="b-mast"><img class="b-emblem" src="assets/logos/emblema.png" width="56" height="61" alt=""><div class="b-mast-t"><span class="b-eyebrow">${esc(t("bSubtitle"))}</span><h2>${esc(LANG==="pt"?BC.title:BC.titleEn)}</h2><p>${esc(t("bPublisher"))}</p><p class="b-scope">${esc(bScopeLabel())}</p></div>
      <div class="b-no"><b>${esc(t("bNo"))} ${R0.number}</b><span>${esc(weekLabel(R0.w0))}</span></div></div>
    <h3 class="b-headline">${esc(bHeadline(R0))}</h3>
    <p class="b-intro">${esc(bIntro(R0))}</p>
    <div class="b-kpis">${kp.map(([a,b])=>`<div><span>${esc(a)}</span><b class="num">${b}</b></div>`).join("")}</div>
    ${multi?`<nav class="b-toc">${Rs.map((r,i)=>`<a href="#b-part-${i}">${esc(tf("bPart",{n:ROMAN[i]||i+1,lv:lvName(r.level).toLowerCase()}))}</a>`).join("")}<a href="#b-common">${esc(t("bCommon"))}</a></nav>`:""}
  </section>`;
  const parts=Rs.map((R,i)=>`<div id="b-part-${i}" class="b-partwrap">${partHtml(R,qn,i,multi)}</div>`).join("");
  // secções comuns
  const R=R0, nQ=qn();
  const qtyHtml=`<section class="panel"><div class="ph"><h2>${esc(tf("qQty",{n:nQ}))}</h2></div>${R.qtyRows.length?`<div class="b-tw"><table class="b-t"><thead><tr><th>${esc(t("mercado"))}</th><th>${esc(t("produto"))}</th><th class="r">${esc(t("semAntL"))}</th><th class="r">${esc(t("semRecL"))}</th><th class="r">${esc(t("mud"))}</th></tr></thead><tbody>
    ${R.qtyRows.map(r=>`<tr><td>${esc(shortMkt(r.mkt))}</td><td>${esc(pName(r.prod))}</td><td class="r num">${r.p?fmtN(r.p,0):"."}</td><td class="r num">${r.c?fmtN(r.c,0):"."}</td><td class="r num ${cls(pct(r.c,r.p))}">${r.c&&r.p?fmtN(pct(r.c,r.p),0):"."}</td></tr>`).join("")}</tbody></table></div>`:`<div class="b-body flat">${esc(t("noQty"))}</div>`}</section>`;
  const nL=qn(), mc=fmtD(R.monthCur,{month:"long"}), mp=fmtD(R.monthPrev,{month:"long"});
  const liveHtml=`<section class="panel"><div class="ph"><h2>${esc(tf("qLive",{n:nL}))}</h2></div>${R.liveP.length?`<div class="b-tw"><table class="b-t b-wide"><thead><tr><th rowspan="2">${esc(t("provincia"))}</th>${R.liveP.map(p=>`<th colspan="3" class="b-grp">${esc(pName(p))}</th>`).join("")}</tr>
    <tr>${R.liveP.map(()=>`<th class="r">${esc(mp)}</th><th class="r">${esc(mc)}</th><th class="r">${esc(t("mud"))}</th>`).join("")}</tr></thead><tbody>
    ${R.liveProv.map(pv=>`<tr><td>${esc(pv)}</td>${R.liveP.map(p=>{ const r=R.live[pv][p]; const c=r?mean(r.c):null, pp=r?mean(r.p):null, ch=pct(c,pp);
      return `<td class="r num">${pp!=null?fmtN(pp):"."}</td><td class="r num">${c!=null?fmtN(c):"."}</td><td class="r num ${cls(ch)}">${ch!=null?fmtN(ch):"."}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`:`<div class="b-body flat">${esc(t("noLive"))}</div>`}</section>`;
  root.innerHTML = ctrl + head + parts + `<div id="b-common">${multi?`<h2 class="b-part">${esc(t("bCommon"))}</h2>`:`<h3 class="b-sec">${esc(t("bTables"))}</h3>`}</div>` + qtyHtml + liveHtml + `<p class="foot">${esc(t("intlNote"))}</p>`;
  bindBulletin();
}
function bindBulletin(){
  $("bWeek")?.addEventListener("change",e=>{ B.week=+e.target.value; renderBulletin(); });
  $("bProv")?.addEventListener("change",e=>{ B.prov=e.target.value; B.market=""; renderBulletin(); });
  $("bMkt")?.addEventListener("change",e=>{ B.market=e.target.value; renderBulletin(); });
  $("bLevel")?.addEventListener("change",e=>{ B.level=e.target.value; renderBulletin(); });
  $("bPdf")?.addEventListener("click",bulletinPDF);
  $("bReset")?.addEventListener("click",()=>{ Object.assign(B,{week:null,prov:"",market:"",level:BC.level}); renderBulletin(); toast(t("filtersCleared"),1600); });
}
function setView(v){
  S.view=v; $("viewMarket").hidden = v!=="market"; $("viewBulletin").hidden = v!=="bulletin"; $("viewAbout").hidden = v!=="about";
  document.querySelectorAll("#tabs button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===v)));
  store.set("sima.view",v);
  if(v==="bulletin") renderBulletin(); else if(v==="about"){ if(typeof renderAbout==="function") renderAbout(); } else { drawMain(); renderIndex(); }
}
$("tabs").addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) setView(b.dataset.v); });
$("lang-pt").addEventListener("click",()=>renderBulletin());
$("lang-en").addEventListener("click",()=>renderBulletin());
// separador inicial: o último usado, ou "Sobre o SIMA"
{ const v0=store.get("sima.view"); setTimeout(()=>setView(["about","market","bulletin"].includes(v0)?v0:"about"),0); }

/* =====================================================================
   PDF do boletim
   ===================================================================== */
async function imgData(src){ try{ const r=await fetch(src); if(!r.ok) return null; const b=await r.blob();
  return await new Promise(res=>{ const fr=new FileReader(); fr.onload=()=>{ const im=new Image(); im.onload=()=>res({d:fr.result,w:im.width,h:im.height,f:/png/i.test(b.type)?"PNG":"JPEG"}); im.onerror=()=>res(null); im.src=fr.result; }; fr.readAsDataURL(b); }); }catch(e){ return null; } }

async function bulletinPDF(){
  if(!window.jspdf){ toast(t("pdfFail")+" (jsPDF)"); return; }
  const levels=bLevelsToShow(), multi=B.level==="ALL";
  const Rs=levels.map(L=>bCompute(L)).filter(r=>r && r.mainStats.length);
  const R=Rs.find(r=>r.level===BC.level)||Rs[0];
  if(!R){ toast(t("noWeekData")); return; }
  const btns=[$("btnPdf"),$("bPdf")].filter(Boolean); btns.forEach(b=>b.disabled=true); toast(t("pdfWorking"),10000);
  await new Promise(r=>setTimeout(r,30));
  try{
    const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"});
    const PW=210, PH=297, M=15, G=8, CW=(PW-2*M-G)/2, FW=PW-2*M, BOT=PH-16;
    const INK=[20,20,20], MUT=[100,100,100], RED=[200,30,30], GRN=[10,120,60], LINE=[150,150,150], HEAD=[30,45,60], SHADE=[236,234,226];
    let col=0, y=0, colTop=0, full=false;
    const pageNo=()=>doc.getNumberOfPages();
    const smallHeader=()=>{ doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUT);
      doc.text(`${t("brand")} - ${LANG==="pt"?BC.title:BC.titleEn} ${t("bNo")} ${R.number}`,M,10); doc.text(weekLabel(R.w0),PW-M,10,{align:"right"});
      doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M,12,PW-M,12); y=colTop=19; col=0; };
    const newPage=()=>{ doc.addPage(); smallHeader(); };
    const X=()=> full ? M : M+col*(CW+G);
    const W=()=> full ? FW : CW;
    let col0End=0;
    const ensure=h=>{ if(y+h<=BOT) return; if(!full && col===0){ col0End=y; col=1; y=colTop; } else { newPage(); col0End=0; } };
    // passa a largura total: continua na mesma página por baixo das duas colunas se houver espaço
    const goFull=(need=60)=>{ if(full) return; const start = col===1 ? Math.max(col0End,y) : y; full=true; col=0;
      if(start+need>BOT) newPage(); else y=start+4; };
    const goCols=()=>{ full=false; col=0; colTop=y; col0End=0; };
    const para=(txt,o={})=>{ const size=o.size||10, lh=o.lh||size*0.43; doc.setFont(o.font||"times",o.style||"normal"); doc.setFontSize(size); doc.setTextColor(...(o.color||INK));
      const setF=()=>{ doc.setFont(o.font||"times",o.style||"normal"); doc.setFontSize(size); doc.setTextColor(...(o.color||INK)); };
      const lines=doc.splitTextToSize(txt,W()); lines.forEach((ln,i)=>{ ensure(lh); setF(); const last=i===lines.length-1; doc.text(ln,X(),y,(o.align==="justify"&&!last)?{align:"justify",maxWidth:W()}:(o.align==="center"?{align:"center"}:{})); y+=lh; });
      y+=o.after??2; };
    const centerText=(txt,o)=>{ doc.setFont(o.font||"times",o.style||"normal"); doc.setFontSize(o.size||10); doc.setTextColor(...(o.color||INK));
      doc.splitTextToSize(txt,FW).forEach(ln=>{ doc.text(ln,PW/2,y,{align:"center"}); y+=(o.size||10)*0.43; }); };
    // tabela genérica: cols=[{h, w(mm), r(align right), fmt}] ; rows=array de arrays; opts: caption, note, colorFn(ri,ci)->[r,g,b]|null, groups=[{h,span}]
    const table=(cols,rows,o={})=>{
      const fs=o.fs||7.6, rh=o.rh||4.4, tw=cols.reduce((s,c)=>s+c.w,0);
      const drawHead=()=>{
        if(o.groups){ ensure(rh*2); let cx=X(); doc.setFont("helvetica","bold"); doc.setFontSize(fs); doc.setTextColor(...INK);
          o.groups.forEach(g=>{ const gw=cols.slice(g.from,g.from+g.span).reduce((s,c)=>s+c.w,0); doc.setDrawColor(...LINE); doc.rect(cx,y-rh+1.2,gw,rh);
            if(g.h) doc.text(doc.splitTextToSize(g.h,gw-1.5)[0],cx+gw/2,y,{align:"center"}); cx+=gw; }); y+=rh; }
        let cx=X(); doc.setFillColor(...SHADE); doc.rect(X(),y-rh+1.2,tw,rh,"F"); doc.setFont("helvetica","bold"); doc.setFontSize(fs); doc.setTextColor(...INK);
        cols.forEach(c=>{ doc.setDrawColor(...LINE); doc.rect(cx,y-rh+1.2,c.w,rh); doc.text(doc.splitTextToSize(c.h,c.w-1.5)[0], c.r?cx+c.w-1:cx+1, y, c.r?{align:"right"}:{}); cx+=c.w; }); y+=rh; };
      if(o.caption){ doc.setFont("times","bold"); doc.setFontSize(9.5); const cl=doc.splitTextToSize(o.caption,Math.max(W(),tw)); ensure(cl.length*4+rh*3);
        doc.setFont("times","bold"); doc.setFontSize(9.5); doc.setTextColor(...INK); cl.forEach(ln=>{ doc.text(ln,X(),y); y+=4; }); y+=1.5; } else ensure(rh*3);
      drawHead();
      rows.forEach((row,ri)=>{ if(y+rh>BOT){ ensure(rh+20); drawHead(); }
        let cx=X(); if(o.shade && o.shade(ri)){ doc.setFillColor(...SHADE); doc.rect(X(),y-rh+1.2,tw,rh,"F"); }
        row.forEach((v,ci)=>{ const c=cols[ci]; doc.setDrawColor(...LINE); doc.rect(cx,y-rh+1.2,c.w,rh); const col_=o.colorFn?o.colorFn(ri,ci,v):null;
          doc.setTextColor(...(col_||INK)); doc.setFont("helvetica",(o.boldCol===ci)?"bold":"normal"); doc.setFontSize(fs);
          const s=v==null?"":String(v); doc.text(doc.splitTextToSize(s,c.w-1.5)[0]||"", c.r?cx+c.w-1:cx+1, y, c.r?{align:"right"}:{}); cx+=c.w; });
        y+=rh; });
      if(o.note){ doc.setFont("helvetica","italic"); doc.setFontSize(7); doc.setTextColor(...MUT); doc.splitTextToSize(o.note,Math.max(W(),tw)).forEach(ln=>{ ensure(3.4); doc.text(ln,X(),y+1); y+=3.4; }); }
      y+=4; };
    const secBanner=(txt)=>{ ensure(12); doc.setFillColor(...HEAD); doc.rect(X(),y-5,W(),8,"F"); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(11);
      doc.text(txt.toUpperCase(),X()+3,y+0.5); y+=8; };
    const runIn=(title)=>{ const setF=()=>{ doc.setFont("times","bold"); doc.setFontSize(10.5); doc.setTextColor(...INK); }; setF(); const ls=doc.splitTextToSize(title+":",W()); ensure(ls.length*4.6+10); setF(); ls.forEach(l=>{ doc.text(l,X(),y); y+=4.6; }); };
    const nf=(v,d=2)=>v==null||!isFinite(v)?".":fmtN(v,d);
    let qn=0; const Q=()=>++qn;

    /* ---- 1.ª página: cabeçalho ---- */
    y=12;
    const logos=[]; for(const src of (BC.logos||[])){ const im=await imgData(src); if(im) logos.push(im); }
    if(logos.length){ const h=18, gap=(FW-logos.reduce((s,im)=>s+h*im.w/im.h,0))/Math.max(1,logos.length-1);
      let lx=M; logos.forEach((im,i)=>{ const w=h*im.w/im.h; const x= logos.length===1? (PW-w)/2 : lx; doc.addImage(im.d,im.f,x,y,w,h); lx+=w+gap; }); y+=h+4; }
    doc.setDrawColor(...INK); doc.setLineWidth(0.4); doc.line(M,y,PW-M,y); y+=5;
    doc.setFont("times","bold"); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(fmtD(R.w0+6),M,y); doc.text(`${t("bNo")} ${R.number}`,PW-M,y,{align:"right"}); y+=9;
    centerText(LANG==="pt"?BC.title:BC.titleEn,{font:"times",style:"bolditalic",size:22}); y+=2;
    centerText(t("bSubtitle"),{font:"times",style:"bolditalic",size:13}); y+=0.5;
    centerText(t("bPublisher"),{font:"times",style:"bold",size:10.5});
    (BC.institution||[]).forEach(l=>centerText(l,{font:"times",size:9}));
    centerText(bScopeLabel(),{font:"times",style:"italic",size:9.5});
    y+=2; doc.setLineWidth(0.3); doc.line(M,y,PW-M,y); y+=6;
    centerText(bHeadline(R),{font:"times",style:"bold",size:11.5}); y+=0.5; doc.line(M,y,PW-M,y); y+=7;
    full=false; goCols();

    para(bIntro(R),{align:"justify",size:10.5,after:4});
    // separador de parte (só quando o boletim tem todos os níveis)
    const partSep=(i,L)=>{ newPage(); full=true; y=40;
      doc.setFillColor(...HEAD); doc.rect(M,y,FW,34,"F"); doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text((LANG==="pt"?"PARTE ":"PART ")+(ROMAN[i]||i+1),PW/2,y+12,{align:"center"});
      doc.setFont("times","bolditalic"); doc.setFontSize(20); doc.text(LANG==="pt"?`Mercado ${lvName(L).toLowerCase()}`:`${lvName(L)} market`,PW/2,y+24,{align:"center"});
      y+=48; full=false; goCols(); };
    // índice das partes na 1.ª página
    if(multi && Rs.length>1){ doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(...MUT); ensure(6+Rs.length*5);
      doc.text(t("bContents").toUpperCase(),X(),y); y+=5; doc.setFont("times","normal"); doc.setFontSize(10); doc.setTextColor(...INK);
      Rs.forEach((r,i)=>{ doc.text(tf("bPart",{n:ROMAN[i]||i+1,lv:lvName(r.level).toLowerCase()}),X()+2,y); y+=4.8; });
      doc.text(t("bCommon"),X()+2,y); y+=7; }

    for(let pi=0; pi<Rs.length; pi++){ const RL=Rs[pi], L=RL.level;
      if(multi) partSep(pi,L);
      /* ---- Dinâmica de preços ---- */
      secBanner(t("bDyn")+(multi?"":" - "+lvName(L)));
      const q6=qn+RL.mainStats.length+1; // número do quadro de preços semanais desta parte
      RL.mainStats.forEach(s=>{
        runIn(bProdTitle(s,L));
        para(bProdLead(s),{align:"justify",size:10.5});
        const rows=bChangeRows(s);
        if(rows.length){ const n=Q(); const w=[CW*0.4,CW*0.2,CW*0.2,CW*0.2];
          table([{h:t("mercado"),w:w[0]},{h:t("semAnt"),w:w[1],r:1},{h:t("semRec"),w:w[2],r:1},{h:t("mud"),w:w[3],r:1}],
            rows.map(r=>[shortMkt(r.mkt),nf(r.prev),nf(r.cur),r.pct==null?".":fmtN(r.pct)]),
            {caption:tf("qPriceVar",{n,p:lowerName(s.prod)}), colorFn:(ri,ci)=>ci===3?(rows[ri].pct<0?RED:rows[ri].pct>0?GRN:null):null, fs:8, rh:4.6});
        } else Q();
        para(bProdText(s,q6),{align:"justify",size:10.5,after:5});
      });
      /* ---- Quadro de preços semanais ---- */
      goFull();
      { const n=Q(); const cs=RL.mainStats.map(s=>({s,rows:s.rows.filter(r=>r.cur!=null).sort((a,b)=>a.cur-b.cur)}));
        const k=cs.length||1, bw=FW/k, cols=[], groups=[];
        cs.forEach((c,i)=>{ cols.push({h:t("mercado"),w:bw*0.66},{h:t("semRec"),w:bw*0.34,r:1}); groups.push({from:i*2,span:2,h:pName(c.s.prod)}); });
        const Lm=Math.max(0,...cs.map(c=>c.rows.length)), rows=[];
        for(let i=0;i<Lm;i++){ const row=[]; cs.forEach(c=>{ const r=c.rows[i]; row.push(r?shortMkt(r.mkt):"", r?nf(r.cur):""); }); rows.push(row); }
        doc.setFont("helvetica","bold"); doc.setFontSize(9.5); const tl=doc.splitTextToSize(tf("q6a",{n,lv:lvName(L).toLowerCase(),r:fmtRange(RL.w0)}),FW-6);
        if(y+tl.length*4.4+30>BOT) newPage();
        doc.setFillColor(...HEAD); doc.rect(M,y-5,FW,tl.length*4.4+3.6,"F"); doc.setTextColor(255,255,255);
        tl.forEach((ln,i)=>doc.text(ln,PW/2,y+0.3+i*4.4,{align:"center"})); y+=tl.length*4.4+3;
        table(cols,rows,{groups,fs:k>4?6.6:7.6,rh:4.5,note:t("q6aNote"),
          colorFn:(ri,ci)=>{ const c=cs[Math.floor(ci/2)]; if(!c||c.rows.length<2) return null; if(ri===0) return RED; if(ri===c.rows.length-1) return GRN; return null; }});
      }
      /* ---- Fluxos ---- */
      const fl=bFlowParas(RL);
      if(y+50>BOT) newPage(); else y+=2; full=false; goCols();
      secBanner(t("bFlows")+(multi?"":" - "+lvName(L)));
      const flMain=fl.filter(f=>RL.main.includes(f.prod)), flShow=flMain.length?flMain:fl.slice(0,12);
      if(!flShow.length) para(t("noFlows"),{size:10.5});
      flShow.forEach(f=>{ runIn(f.title); para(f.text,{align:"justify",size:10.5,after:4}); });
      /* ---- Quadro de preço e mudança percentual deste nível ---- */
      goFull(40);
      { const T=RL.levelTables[L];
        if(T){ const prods=T.prods, per=4;
          for(let g=0; g<prods.length; g+=per){ const ps=prods.slice(g,g+per), n=Q();
            const mw=FW-ps.length*3*12.6, cols=[{h:"",w:Math.max(30,mw)}], groups=[{from:0,span:1,h:""}];
            ps.forEach((p,i)=>{ cols.push({h:t("semAnt"),w:12.6,r:1},{h:t("semRec"),w:12.6,r:1},{h:t("mud"),w:12.6,r:1}); groups.push({from:1+i*3,span:3,h:pName(p)}); });
            const mk=T.mkts.filter(m=>ps.some(p=>T.cell[p+"|"+m]));
            const rows=mk.map(m=>[shortMkt(m), ...ps.flatMap(p=>{ const r=T.cell[p+"|"+m]; return r?[nf(r.prev),nf(r.cur),r.pct==null?".":fmtN(r.pct,0)]:[".",".","."]; })]);
            if(y+30>BOT) newPage();
            table(cols,rows,{groups,caption:tf("qLevel",{n,lv:lvName(L).toLowerCase()})+(prods.length>per?(LANG==="pt"?` - parte ${g/per+1}`:` - part ${g/per+1}`):""),
              note:t("qLevelNote"),fs:7,rh:4.1,boldCol:0, colorFn:(ri,ci,v)=>{ if(ci>0 && ci%3===0 && v!=="."){ const x=parseFloat(String(v).replace(",",".")); return x<0?RED:x>0?GRN:null; } return null; }}); } } }
    }

    /* ---- Secções comuns ---- */
    if(multi){ newPage(); full=true; secBanner(t("bCommon")); } else { if(y+40>BOT) newPage(); }
    /* ---- Quantidades no grossista ---- */
    { const n=Q(); if(y+30>BOT) newPage();
      const mainAll=new Set(Rs.flatMap(r=>r.main)); const qRows=R.qtyRows.filter(r=>mainAll.has(r.prod));
      if(qRows.length) table([{h:t("mercado"),w:50},{h:t("produto"),w:58},{h:t("semAntL"),w:24,r:1},{h:t("semRecL"),w:24,r:1},{h:t("mud"),w:24,r:1}],
        qRows.map(r=>[shortMkt(r.mkt),pName(r.prod),r.p?fmtN(r.p,0):".",r.c?fmtN(r.c,0):".",r.c&&r.p?fmtN(pct(r.c,r.p),0):"."]),
        {caption:tf("qQty",{n}),fs:7.4,rh:4.2,colorFn:(ri,ci,v)=>{ if(ci===4&&v!=="."){ const x=parseFloat(String(v).replace(",",".")); return x<0?RED:x>0?GRN:null;} return null; }});
      else { para(tf("qQty",{n}),{font:"times",style:"bold",size:9.5}); para(t("noQty"),{size:9.5,after:5}); } }

    /* ---- Pecuária (médias mensais) ---- */
    { const n=Q(); const mc=fmtD(R.monthCur,{month:"short"}), mp=fmtD(R.monthPrev,{month:"short"});
      if(R.liveP.length){ const per=4;
        for(let g=0; g<R.liveP.length; g+=per){ const ps=R.liveP.slice(g,g+per); if(y+30>BOT) newPage();
          const cols=[{h:t("provincia"),w:FW-ps.length*3*12.6}], groups=[{from:0,span:1,h:""}];
          ps.forEach((p,i)=>{ cols.push({h:mp,w:12.6,r:1},{h:mc,w:12.6,r:1},{h:t("mud"),w:12.6,r:1}); groups.push({from:1+i*3,span:3,h:pName(p)}); });
          const rows=R.liveProv.filter(pv=>ps.some(p=>R.live[pv][p])).map(pv=>[pv,...ps.flatMap(p=>{ const r=R.live[pv][p]; const c=r?mean(r.c):null, pp=r?mean(r.p):null; const ch=pct(c,pp); return [nf(pp),nf(c),ch==null?".":fmtN(ch)]; })]);
          table(cols,rows,{groups,caption:tf("qLive",{n})+(R.liveP.length>per?(LANG==="pt"?` - parte ${g/per+1}`:` - part ${g/per+1}`):""),fs:7,rh:4.2,boldCol:0,
            colorFn:(ri,ci,v)=>{ if(ci>0&&ci%3===0&&v!=="."){ const x=parseFloat(String(v).replace(",",".")); return x<0?RED:x>0?GRN:null;} return null; }}); }
      } else { if(y+20>BOT) newPage(); para(tf("qLive",{n}),{font:"times",style:"bold",size:9.5}); para(t("noLive"),{size:9.5,after:5}); } }

    /* ---- Vendedores por sexo ---- */
    { const k=R.kpi, tot=k.sf+k.sm; if(tot){ if(y+25>BOT) newPage();
      table([{h:"",w:60},{h:t("female"),w:30,r:1},{h:t("male"),w:30,r:1},{h:t("total"),w:30,r:1}],
        [[t("qSex"),fmtN(k.sf,0)+` (${Math.round(k.sf/tot*100)}%)`,fmtN(k.sm,0)+` (${Math.round(k.sm/tot*100)}%)`,fmtN(tot,0)]],{fs:8,rh:4.8,boldCol:0}); } }

    /* ---- Anexo: gráficos de evolução ---- */
    newPage(); full=true;
    secBanner(t("bAnnex"));
    para(t("annexNote"),{font:"helvetica",style:"italic",size:8,color:MUT,after:3});
    const from=R.w0-7*25, imgW=FW, imgH=FW*0.30;
    for(const RL of Rs) for(const s of RL.mainStats){
      const list=S.obs.filter(o=>o.prod===s.prod && o.sel===RL.level && o.d>=from && o.d<R.w0+7 && (!B.prov||o.prov===B.prov) && (!B.market||o.mkt===B.market));
      const cs=candles(list,"W"); if(!cs.length) continue;
      if(y+imgH+14>BOT) newPage();
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(...INK); doc.text(`${pTk(s.prod)}  ${pName(s.prod)}`,M,y);
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(...MUT); doc.text(`${lvName(RL.level)} · ${unitLbl(s.prod)}`,PW-M,y,{align:"right"}); y+=2;
      const prevAgg=S.agg; S.agg="W";
      doc.addImage(chartImage(cs,{type:"candle",volume:true,maVals:cs.length>=4?maOf(cs):null},1000,300),"PNG",M,y,imgW,imgH);
      S.agg=prevAgg; y+=imgH+7;
    }
    para(t("intlNote"),{font:"helvetica",style:"italic",size:8,color:MUT,after:4});

    /* ---- Ficha técnica ---- */
    const ft=(BC.fichaTecnica||[]).filter(r=>r.names&&r.names.length);
    if(ft.length){ const bh=14+ft.reduce((s,r)=>s+5+r.names.length*4.6,0); if(y+bh>BOT) newPage();
      const bx=PW/2-45; doc.setDrawColor(...RED); doc.setLineWidth(0.5); doc.rect(bx,y,90,bh); let yy=y+8;
      doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(...INK); doc.text(t("fichaTecnica").toUpperCase(),PW/2,yy,{align:"center"}); yy+=6;
      ft.forEach(r=>{ doc.setFont("times","bold"); doc.setFontSize(9.5); doc.text(r.role+":",PW/2,yy,{align:"center"}); yy+=4.6;
        doc.setFont("times","normal"); r.names.forEach(nm=>{ doc.text(doc.splitTextToSize(nm,86)[0],PW/2,yy,{align:"center"}); yy+=4.6; }); yy+=0.4; });
      y+=bh+4; }

    /* ---- Desenvolvedor ---- */
    { const dev=SIMA_CONFIG.developer||{}; const im=dev.logo?await imgData(dev.logo):null;
      if(im||dev.name){ const h=12, w=im?h*im.w/im.h:0; if(y+h+10>BOT) newPage(); y+=4;
        doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text(t("devBy"),PW/2,y,{align:"center"}); y+=2;
        if(im){ doc.addImage(im.d,im.f,PW/2-w/2,y,w,h); y+=h+2; } else { doc.setFont("helvetica","bold"); doc.text(dev.name,PW/2,y+3,{align:"center"}); y+=6; } } }

    /* ---- rodapés ---- */
    const np=pageNo();
    for(let i=1;i<=np;i++){ doc.setPage(i); doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(M,PH-11,PW-M,PH-11);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...MUT);
      doc.text(S.mode==="demo"?t("rptDemoNote"):`${t("brand")} - ${t("brandSub")}`,M,PH-7); doc.text(String(i),PW-M,PH-7,{align:"right"}); }

    const slug=s=>norm(s).slice(0,30);
    const fname=`SIMA_${LANG==="pt"?"boletim":"bulletin"}_${R.year}_${String(R.number).padStart(2,"0")}_${B.level==="ALL"?(LANG==="pt"?"todos-niveis":"all-levels"):slug(B.level)}${B.market?"_"+slug(B.market):B.prov?"_"+slug(B.prov):""}.pdf`;
    const blob=doc.output("blob");
    let dl=null; try{ if(window.claude?.use) dl=await window.claude.use("downloads"); }catch(e){}
    if(dl){ try{ await dl.save({filename:fname,data:blob}); toast(t("pdfDone")); }catch(e){ toast(e?.code==="declined"?t("pdfDeclined"):t("pdfFail")); } }
    else { doc.save(fname); toast(t("pdfDone")); }
  }catch(e){ console.error(e); toast(t("pdfFail")+": "+(e&&e.message||e)); }
  finally{ btns.forEach(b=>b.disabled=false); }
}
