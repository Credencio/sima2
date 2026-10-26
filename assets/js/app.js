"use strict";
const DEFAULT_URL = SIMA_CONFIG.serviceUrl;
let LANG = "pt";
const t = k => (I18N[LANG][k] ?? I18N.pt[k] ?? k);
const pName = code => { const p=PROD[code]; return p ? p[LANG] : String(code).replace(/_/g," "); };
const pTk = code => PROD[code]?.tk || String(code).replace(/[^A-Za-z]/g,"").slice(0,4).toUpperCase();
const PROD_UNIT = {};
const unitLbl = code => PROD_UNIT[code]==="un" ? (LANG==="pt"?"MZN/un.":"MZN/unit") : t("per");
const catName = c => CATS[c] ? CATS[c][LANG==="pt"?0:1] : (c||"—");
const sellerName = s => SELLERS[s] ? SELLERS[s][LANG==="pt"?0:1] : (s||"—");

/* ============ helpers ============ */
const $ = id => document.getElementById(id);
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const TZ = 2*3600e3; // Africa/Maputo, no DST
const DAY = 864e5;
const dayKey = ms => Math.floor((ms+TZ)/DAY); // local day number
const fmtN = (v,d=2) => v==null||!isFinite(v) ? "—" : new Intl.NumberFormat(LANG==="pt"?"pt-PT":"en-GB",{minimumFractionDigits:d,maximumFractionDigits:d}).format(v);
const fmtPct = v => v==null||!isFinite(v) ? "—" : (v>0?"+":"")+fmtN(v,2)+"%";
const cls = v => v==null||!isFinite(v)||Math.abs(v)<0.005 ? "flat" : v>0 ? "up" : "down";
const arrow = v => v==null||!isFinite(v)||Math.abs(v)<0.005 ? "■" : v>0 ? "▲" : "▼";
const fmtDate = (dk, style) => { const d=new Date(dk*DAY); const loc=LANG==="pt"?"pt-PT":"en-GB";
  if(style==="M") return d.toLocaleDateString(loc,{month:"short",year:"numeric",timeZone:"UTC"});
  if(style==="short") return d.toLocaleDateString(loc,{day:"2-digit",month:"short",timeZone:"UTC"});
  return d.toLocaleDateString(loc,{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}); };
// popup (tooltip) dos gráficos: html já escapado pelo chamador quando raw=true
function tipHtml(title, rows, raw){ return `<div class="th">${esc(title)}</div>`+rows.map(([k,v])=>`<div class="tr"><span>${esc(k)}</span><b>${raw?v:esc(v)}</b></div>`).join(""); }
function placeTip(e){ const tp=$("tip"); if(tp.hidden) return; const pad=14, w=tp.offsetWidth, h=tp.offsetHeight;
  let x=e.clientX+pad, y=e.clientY+pad; if(x+w>innerWidth-8) x=e.clientX-w-pad; if(y+h>innerHeight-8) y=e.clientY-h-pad; tp.style.left=Math.max(8,x)+"px"; tp.style.top=Math.max(8,y)+"px"; }
function showTip(e, html){ const tp=$("tip"); tp.innerHTML=html; tp.hidden=false; window._tipAt=Date.now(); placeTip(e); }
function hideTip(){ const tp=$("tip"); if(tp) tp.hidden=true; }
function toast(msg,ms=2600){const el=$("toast");el.textContent=msg;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,ms);}
const store = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}} };

/* ============ state ============ */
const S = { diag:null, obs:[], mode:"load", err:"", url: DEFAULT_URL, loadedAt:null,
  prov:"", mkt:"", sel:"", cat:"", period:0, agg:"W", type:"candle", ma:true, prod:null, q:"", sort:{k:"sym",dir:1} };

/* ============ ArcGIS loader ============ */
async function getJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status); const j = await r.json(); if(j.error) throw new Error(j.error.message||"ArcGIS error"); return j; }
async function fetchLayer(base){
  const meta = await getJSON(base+"?f=json");
  const oid = meta.objectIdField || (meta.fields||[]).find(f=>f.type==="esriFieldTypeOID")?.name || "objectid";
  const page = Math.min(meta.maxRecordCount||1000, 2000);
  const domains = {};
  (meta.fields||[]).forEach(f=>{ if(f.domain?.codedValues){ const m={}; f.domain.codedValues.forEach(c=>m[c.code]=c.name); domains[f.name.toLowerCase()]=m; }});
  let out=[], off=0;
  for(let i=0;i<200;i++){
    const q = `${base}/query?where=1%3D1&outFields=*&returnGeometry=false&orderByFields=${encodeURIComponent(oid)}&resultOffset=${off}&resultRecordCount=${page}&f=json`;
    const j = await getJSON(q);
    const feats = (j.features||[]).map(f=>{ const a={}; for(const k in f.attributes) a[k.toLowerCase()]=f.attributes[k]; return a; });
    out = out.concat(feats); off += feats.length;
    if(!feats.length || (!j.exceededTransferLimit && feats.length<page)) break;
  }
  const fields=(meta.fields||[]).map(f=>f.name+" ("+String(f.type).replace("esriFieldType","")+")");
  const dateFields=(meta.fields||[]).filter(f=>f.type==="esriFieldTypeDate").map(f=>f.name.toLowerCase());
  let count=null; try{ count=(await getJSON(`${base}/query?where=1%3D1&returnCountOnly=true&f=json`)).count; }catch(e){ count="erro: "+e.message; }
  // Se a leitura paginada vier vazia mas a contagem disser que há dados, tenta uma consulta simples
  if(!out.length && count>0){ try{ const j=await getJSON(`${base}/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`);
    out=(j.features||[]).map(f=>{ const a={}; for(const k in f.attributes) a[k.toLowerCase()]=f.attributes[k]; return a; }); }catch(e){} }
  const info={ count, capabilities:meta.capabilities, definitionExpression:meta.definitionExpression||meta.viewDefinitionQuery||"",
    ownershipAccess:meta.ownershipBasedAccessControlForFeatures||null, supportsPagination:meta.advancedQueryCapabilities?.supportsPagination };
  const gidField=(meta.globalIdField || (meta.fields||[]).find(f=>f.type==="esriFieldTypeGlobalID")?.name || "globalid");
  return {rows:out, domains, fields, dateFields, info, gidField};
}
// Normaliza GUIDs: ignora chavetas, hífenes, espaços e maiúsculas/minúsculas
const gid = v => String(v??"").replace(/[^0-9a-f]/gi,"").toUpperCase();
const numv = v => { const n = typeof v==="number" ? v : parseFloat(String(v??"").replace(",", ".")); return isFinite(n) ? n : null; };
// Preço de um registo de produto, só a partir das colunas de preço do inquérito:
//   1) média dos preco_kg1, preco_kg2, preco_kg3 preenchidos (> 0)  -> MZN/kg
//   2) se não houver nenhum: preco_medio                             -> MZN/kg
//   3) se também não houver: média de Preço-1, Preço-2, Preço-3       -> MZN/unidade
// (O preco_medio do formulário divide sempre por 2 ou 3, mesmo com amostras em falta, por isso é usado só como recurso.)
function rowPrice(c){
  const kgs=[1,2,3].map(i=>numv(c["preco_kg"+i])).filter(v=>v!=null&&v>0&&isFinite(v));
  if(kgs.length) return {v:kgs.reduce((a,b)=>a+b,0)/kgs.length, unit:"kg", n:kgs.length};
  const pm=numv(c.preco_medio);
  if(pm!=null && pm>0) return {v:pm, unit:"kg", n:0};
  const pu=[1,2,3].map(i=>numv(c["preco"+i])).filter(v=>v!=null&&v>0);
  if(pu.length) return {v:pu.reduce((a,b)=>a+b,0)/pu.length, unit:"un", n:pu.length};
  return null;
}
function resolveProduct(v, dom){
  if(v==null||v==="") return null;
  const s=String(v); if(PROD[s]) return s;
  const n=PROD_BY_NORM[norm(s)]; if(n) return n;
  if(dom && dom[s]){ const m=PROD_BY_NORM[norm(dom[s])]; if(m) return m; }
  return s;
}
// Campos adicionais do registo de produto: proveniência, quantidades (kg), sexo dos vendedores, transporte
function extraFields(c, dom){
  const dv=(f,v)=>(dom&&dom[f]&&dom[f][v]!=null)?dom[f][v]:v;
  const orig=[];
  for(const i of [1,2,3]){ let o=dv("origem"+i, c["origem"+i]); if(o!=null && /^outr/i.test(String(o))) o=c["outra_origem"+i]; o=o==null?"":String(o).trim(); if(o && !orig.includes(o)) orig.push(o); }
  let qty=0;
  for(const i of [1,2,3]){ const q=numv(c["quant"+i]); if(!q||q<=0) continue;
    let w=numv(c["peso_manual"+i]); if(!w||w<=0) w=numv(c["peso"+i]); if(!w||w<=0){ const u=numv(c.unidade); w=u&&u>0?u:1; }
    qty+=q*w; }
  let f=0,m=0; for(const i of [1,2,3]){ const s=String(c["sexo"+i]??"").toLowerCase(); if(s.startsWith("f")) f++; else if(s.startsWith("m")) m++; }
  const tr = c.transp_de||c.transp_para||c.transp_custo_saco ? { de:c.transp_de==="Outro"?c.transp_de_outro:c.transp_de, para:c.transp_para==="Outro"?c.transp_para_outro:c.transp_para,
    custo:numv(c.transp_custo_saco), saco:c.transp_tipo_saco||"", meio:c.transp_meio==="Outro"?c.transp_meio_outro:c.transp_meio } : null;
  return { orig, qty, sf:f, sm:m, tr };
}
// Lê um campo procurando vários nomes possíveis (sem distinguir maiúsculas)
function pick(row, names){
  for(const n of names){ if(row[n]!=null && row[n]!=="") return row[n]; }
  return null;
}
function toMs(v){
  if(v==null||v==="") return null;
  if(typeof v==="number") return v>1e11 ? v : (v>1e9 ? v*1000 : null);
  const s=String(v).trim(); if(/^\d+$/.test(s)) return toMs(+s);
  const m=s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/); if(m) return Date.UTC(+m[3],+m[2]-1,+m[1]);
  const d=Date.parse(s); return isFinite(d)?d:null;
}
async function loadLive(){
  const base = S.url.replace(/\/+$/,"").replace(/\?.*$/,"");
  const recBase = (SIMA_CONFIG.recordsServiceUrl||"").replace(/\/+$/,"") || base;
  let [P,C] = await Promise.all([fetchLayer(recBase+"/"+SIMA_CONFIG.recordsLayer), fetchLayer(base+"/"+SIMA_CONFIG.productsTable)]);
  // Se a camada de registos vier vazia (ex.: filtro ou permissões só na camada 0 da vista), tenta as alternativas do config.js
  const tried=[{url:recBase, rows:P.rows.length}];
  if(!P.rows.length && C.rows.length){
    for(const alt of (SIMA_CONFIG.recordsFallbackUrls||[])){ const u=String(alt).replace(/\/+$/,""); if(!u||u===recBase) continue;
      try{ const P2=await fetchLayer(u+"/"+SIMA_CONFIG.recordsLayer); tried.push({url:u, rows:P2.rows.length}); if(P2.rows.length){ P=P2; break; } }
      catch(e){ tried.push({url:u, rows:"erro: "+e.message}); } }
  }
  const D = S.diag = { url:base, at:new Date().toISOString(),
    records:{ layer:SIMA_CONFIG.recordsLayer, rows:P.rows.length, fields:P.fields, info:P.info, tried },
    products:{ layer:SIMA_CONFIG.productsTable, rows:C.rows.length, fields:C.fields, info:C.info },
    kept:0, skipped:{ notAvailable:0, noPrice:0, noProduct:0, noDate:0 }, joined:0, notJoined:0, byProd:{}, droppedUnit:0,
    sampleRecord:P.rows[0]||null, sampleProduct:C.rows[0]||null };
  const parents = new Map();
  // a chave do registo-pai: campo do tipo GlobalID (normalmente "globalid")
  const gidField = (P.gidField||"globalid").toLowerCase();
  P.rows.forEach(r=>{ const g=gid(r[gidField] ?? pick(r,["globalid","global_id"])); if(g) parents.set(g, r); });
  D.join = { parentKey:gidField, parentsWithKey:parents.size, parentSample:P.rows.slice(0,3).map(r=>r[gidField]),
    childKey:"parentglobalid", childSample:C.rows.slice(0,3).map(r=>r.parentglobalid), unmatchedSample:[] };
  const dateFields = P.dateFields;
  const dv = (dom, f, v) => (dom[f] && dom[f][v]!=null) ? dom[f][v] : v;
  const obs=[];
  for(const c of C.rows){
    const disp = String(pick(c,["disponibilidade"])??"").toLowerCase();
    if(disp.startsWith("n")){ D.skipped.notAvailable++; const pr0=resolveProduct(pick(c,["produto"]), C.domains.produto); if(pr0){ (D.byProd[pr0] ??= {rows:0, kept:0, na:0, noPrice:0, noDate:0, perUnit:0}).na++; D.byProd[pr0].rows++; } continue; }
    const prod = resolveProduct(pick(c,["produto","produtos","product"]), C.domains.produto); if(!prod){ D.skipped.noProduct++; continue; }
    const PD = (D.byProd[prod] ??= {rows:0, kept:0, na:0, noPrice:0, noDate:0, perUnit:0}); PD.rows++;
    const pr = rowPrice(c); if(!pr || !(pr.v>0) || pr.v>1e7){ D.skipped.noPrice++; PD.noPrice++; continue; }
    const price = pr.v;
    const pg = gid(pick(c,["parentglobalid","parent_globalid","parentrowid"]));
    const p = parents.get(pg); if(p) D.joined++; else { D.notJoined++; if(D.join.unmatchedSample.length<5) D.join.unmatchedSample.push(pick(c,["parentglobalid","parent_globalid","parentrowid"])); }
    const pp = p || {};
    let ms = toMs(pick(pp,["data_monitoria"])) || toMs(pick(pp,["creationdate","created_date"])) || toMs(pick(c,["creationdate","created_date"])) || toMs(pick(pp,["editdate"]));
    if(!ms) for(const f of dateFields){ ms=toMs(pp[f]); if(ms) break; }
    if(!ms){ D.skipped.noDate++; PD.noDate++; continue; }
    D.kept++; PD.kept++; if(pr.unit==="un") PD.perUnit++;
    obs.push({ d: dayKey(ms), prod, cat: PROD[prod]?.cat || dv(C.domains,"categoria",c.categoria) || "",
      prov: dv(P.domains,"provincia",pp.provincia)||"—", dist: dv(P.domains,"distrito",pp.distrito)||"",
      mkt: dv(P.domains,"mercado",pp.mercado)||"—", sel: dv(P.domains,"tipo_vendedor",pp.tipo_vendedor)||"—", price, unit: pr.unit,
      ...extraFields(c, C.domains) });
  }
  // Não misturar unidades no mesmo produto: se o produto tem preços por kg, os preços por unidade são postos de parte;
  // se só tem preços por unidade, o produto é mostrado em MZN/unidade.
  const kgProds=new Set(obs.filter(o=>o.unit==="kg").map(o=>o.prod));
  const out=obs.filter(o=>{ if(o.unit==="un" && kgProds.has(o.prod)){ D.droppedUnit++; D.byProd[o.prod].kept--; return false; } return true; });
  for(const k in PROD_UNIT) delete PROD_UNIT[k];
  out.forEach(o=>{ if(o.unit==="un") PROD_UNIT[o.prod]="un"; });
  D.productsShown=new Set(out.map(o=>o.prod)).size; D.productsInService=Object.keys(D.byProd).length;
  console.info("SIMA diagnóstico", D);
  return out;
}

/* ============ demo data (fictitious) ============ */
function demoData(){
  let seed=20261026; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const gauss=()=>{let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);};
  const base={Milho_Branco:21,Milho_Amarelo:19,Arroz_sem_casca:62,Mapira:24,Feijao_Nhemba:68,Feijao_Manteiga:112,Feijao_Boer:58,
    Amendoim_Pequeno:88,Amendoim_Grande:96,Gergelim_Branco:78,Soja:34,Mandioca_Seca:16,Batata_Reno:44,Batata_Doce:22,Cebola:56,Tomate:46,
    Repolho:18,Alho_Fino:240,Castanha_de_Caju:75,Banana:28,Laranja:32,Frango_Congelado:215,Carne_de_Vaca_1a:420,Farinha_de_Milho_Branca:42,Oleo:135,Açúcar_Castanho:78};
  base["Gergelim_(Branco)"]=base.Gergelim_Branco; delete base.Gergelim_Branco;
  const mkts=[["Mercado Central","Cidade de Maputo",1.12],["Mercado do Zimpeto","Cidade de Maputo",1.05],["Mercado Municipal de Chokwé","Gaza",.94],
    ["Mercado Municipal de Maxixe","Inhambane",1.0],["Mercado Maquinino","Sofala",1.02],["Mercado 38 Milimetros","Manica",.9],
    ["Mercado Kuachene","Tete",.97],["Mercado Municipal de Manhiça","Maputo",1.0],["Mercado Municipal de Gondola","Manica",.88],["Mercado Municipal de Nhamatanda","Sofala",.93]];
  const sellers=[["Produtor",.84],["Grossista",.95],["Retalhista",1.1]];
  const today=dayKey(Date.now()), start=today-420, obs=[];
  for(const code in base){
    let lvl=1, drift=(rnd()-.45)*0.0009, vol=PROD[code]?.cat==="Horticolas"?0.022:0.011, phase=rnd()*6.28;
    const series={};
    for(let d=start; d<=today; d++){ lvl*=Math.exp(drift+vol*gauss()*0.45); lvl=Math.min(Math.max(lvl,.55),1.9); series[d]=lvl; }
    for(const [m,prov,mf] of mkts){
      if(rnd()<.18) continue;
      for(let d=start+Math.floor(rnd()*7); d<=today; d+=7){
        if(rnd()<.12) continue;
        const season=1+0.08*Math.sin((d/365)*6.283+phase);
        for(const [s,sf] of sellers){ if(rnd()<.35) continue;
          const price=base[code]*series[d]*season*mf*sf*(1+gauss()*0.045);
          const ORIG=["Chimoio","Angónia","Lichinga","Gurué","Nampula","Manica","Chókwè","Nhamatanda","Mocuba","Sussundenga","Malema","Moamba"];
          const nO=1+Math.floor(rnd()*2), orig=[]; for(let k=0;k<nO;k++){ const o=ORIG[Math.floor(rnd()*ORIG.length)]; if(!orig.includes(o)) orig.push(o); }
          const nF=Math.floor(rnd()*3.2), nM=Math.max(0,Math.min(3-nF,1+Math.floor(rnd()*2)));
          obs.push({d, prod:code, cat:PROD[code].cat, prov, dist:"", mkt:m, sel:s, price:Math.round(price*100)/100,
            orig, qty: s==="Grossista" ? Math.round((200+rnd()*4800)/50)*50 : 0, sf:nF, sm:nM, tr:null}); }
      }
    }
  }
  return obs;
}

/* ============ aggregation ============ */
const bucketOf = (d, agg) => { if(agg==="D") return d; if(agg==="W") return d - ((d+3)%7); // Monday
  const dt=new Date(d*DAY); return Math.floor(Date.UTC(dt.getUTCFullYear(),dt.getUTCMonth(),1)/DAY); };
function filtered(ignoreCat){
  const maxD = S.obs.reduce((m,o)=>Math.max(m,o.d),0);
  const from = S.period ? maxD - S.period + 1 : -Infinity;
  return S.obs.filter(o => o.d>=from && (!S.prov||o.prov===S.prov) && (!S.mkt||o.mkt===S.mkt) && (!S.sel||o.sel===S.sel) && (ignoreCat||!S.cat||o.cat===S.cat));
}
function candles(list, agg){
  const days=new Map();
  for(const o of list){ let a=days.get(o.d); if(!a){a={s:0,n:0,h:-Infinity,l:Infinity};days.set(o.d,a);} a.s+=o.price;a.n++;a.h=Math.max(a.h,o.price);a.l=Math.min(a.l,o.price); }
  const dk=[...days.keys()].sort((a,b)=>a-b); const bk=new Map();
  for(const d of dk){ const a=days.get(d), b=bucketOf(d,agg), m=a.s/a.n; let c=bk.get(b);
    if(!c){c={t:b,o:m,h:a.h,l:a.l,c:m,v:0,sum:0};bk.set(b,c);} c.h=Math.max(c.h,a.h); c.l=Math.min(c.l,a.l); c.c=m; c.v+=a.n; c.sum+=a.s; }
  return [...bk.values()].sort((a,b)=>a.t-b.t).map(c=>({...c, avg:c.sum/c.v}));
}
function summarize(list){
  const by=new Map(); for(const o of list){ if(!by.has(o.prod)) by.set(o.prod,[]); by.get(o.prod).push(o); }
  const out=[];
  for(const [prod,arr] of by){
    const cs=candles(arr,S.agg); if(!cs.length) continue;
    const last=cs[cs.length-1], prev=cs.length>1?cs[cs.length-2]:null;
    const prices=arr.map(o=>o.price);
    out.push({prod, tk:pTk(prod), name:pName(prod), cat:PROD[prod]?.cat||arr[0].cat, cs, last:last.c, prev:prev?prev.c:null,
      pct: prev? (last.c/prev.c-1)*100 : null, abs: prev? last.c-prev.c : null,
      open:cs[0].o, hi:Math.max(...prices), lo:Math.min(...prices), avg:prices.reduce((a,b)=>a+b,0)/prices.length,
      n:arr.length, mkts:new Set(arr.map(o=>o.mkt)).size, lastD:Math.max(...arr.map(o=>o.d)), firstD:Math.min(...arr.map(o=>o.d)), arr });
  }
  return out;
}
function indexSeries(sums){
  // chained-free index: mean of close/firstClose per bucket across products present
  const buckets=new Map();
  for(const s of sums){ const b0=s.cs[0].c; for(const c of s.cs){ let x=buckets.get(c.t); if(!x){x={s:0,n:0};buckets.set(c.t,x);} x.s+=c.c/b0*100; x.n++; } }
  return [...buckets.entries()].sort((a,b)=>a[0]-b[0]).map(([t,x])=>({t,c:x.s/x.n,o:x.s/x.n,h:x.s/x.n,l:x.s/x.n,v:x.n}));
}

/* ============ canvas chart ============ */
function cssVar(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function niceTicks(min,max,count){ const span=max-min||1; const step0=span/count; const mag=Math.pow(10,Math.floor(Math.log10(step0)));
  const step=[1,2,2.5,5,10].map(m=>m*mag).find(s=>span/s<=count)||10*mag; const out=[]; for(let v=Math.ceil(min/step)*step; v<=max+1e-9; v+=step) out.push(+v.toFixed(10)); return out; }
function drawChart(cv, data, o){
  const W=o.w, H=o.h, ctx=cv.getContext("2d"), dpr=o.dpr||1;
  cv.width=Math.round(W*dpr); cv.height=Math.round(H*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
  const C=o.colors; ctx.fillStyle=C.bg; ctx.fillRect(0,0,W,H);
  ctx.font=`11px ${o.numFont||"monospace"}`;
  if(!data.length){ ctx.fillStyle=C.muted; ctx.textAlign="center"; ctx.font=`13px ${o.uiFont||"sans-serif"}`; ctx.fillText(o.emptyText||"—",W/2,H/2); return null; }
  const padL=8, padR=62, padT=12, padB=24, volH=o.volume?Math.round((H-padT-padB)*0.18):0;
  const pw=W-padL-padR, ph=H-padT-padB-volH-(volH?6:0);
  let lo=Infinity, hi=-Infinity; for(const d of data){ const l=o.type==="candle"?d.l:d.c, h=o.type==="candle"?d.h:d.c; lo=Math.min(lo,l); hi=Math.max(hi,h); }
  if(o.maVals) for(const v of o.maVals) if(v!=null){lo=Math.min(lo,v);hi=Math.max(hi,v);}
  if(o.refLine!=null){lo=Math.min(lo,o.refLine);hi=Math.max(hi,o.refLine);}
  const padY=(hi-lo)*0.08||hi*0.05||1; lo-=padY; hi+=padY;
  const n=data.length, step=pw/n, X=i=>padL+step*(i+0.5), Y=v=>padT+ph*(1-(v-lo)/(hi-lo));
  // grid + y axis
  const ticks=niceTicks(lo,hi,5); ctx.strokeStyle=C.grid; ctx.lineWidth=1; ctx.fillStyle=C.muted; ctx.textAlign="left"; ctx.textBaseline="middle";
  for(const v of ticks){ const y=Math.round(Y(v))+.5; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+pw,y); ctx.stroke(); ctx.fillText(o.fmtY(v), padL+pw+8, y); }
  // x labels
  ctx.textAlign="center"; ctx.textBaseline="top"; const every=Math.max(1,Math.ceil(n/Math.max(2,Math.floor(pw/80))));
  for(let i=0;i<n;i+=every){ ctx.fillText(o.fmtX(data[i].t), Math.min(Math.max(X(i),padL+24),padL+pw-24), H-padB+7); }
  if(o.refLine!=null){ ctx.setLineDash([3,4]); ctx.strokeStyle=C.muted; const y=Math.round(Y(o.refLine))+.5; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(padL+pw,y); ctx.stroke(); ctx.setLineDash([]); }
  // volume
  if(volH){ const vmax=Math.max(...data.map(d=>d.v))||1, vy0=padT+ph+6+volH;
    data.forEach((d,i)=>{ const h=Math.max(1,(d.v/vmax)*(volH-2)); ctx.fillStyle=(d.c>=d.o?C.up:C.down)+"55"; const bw=Math.max(1,step*0.62); ctx.fillRect(X(i)-bw/2, vy0-h, bw, h); }); }
  // series
  if(o.type==="candle"){
    const bw=Math.max(1.5,Math.min(18,step*0.62));
    data.forEach((d,i)=>{ const up=d.c>=d.o, col=up?C.up:C.down, x=Math.round(X(i))+.5; ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(x,Y(d.h)); ctx.lineTo(x,Y(d.l)); ctx.stroke();
      const y1=Y(Math.max(d.o,d.c)), y2=Y(Math.min(d.o,d.c)); ctx.fillRect(x-bw/2, y1, bw, Math.max(1,y2-y1)); });
  } else {
    const path=()=>{ ctx.beginPath(); data.forEach((d,i)=>{ i?ctx.lineTo(X(i),Y(d.c)):ctx.moveTo(X(i),Y(d.c)); }); };
    if(o.type==="area"){ path(); ctx.lineTo(X(n-1),padT+ph); ctx.lineTo(X(0),padT+ph); ctx.closePath();
      const g=ctx.createLinearGradient(0,padT,0,padT+ph); g.addColorStop(0,o.lineColor+"40"); g.addColorStop(1,o.lineColor+"00"); ctx.fillStyle=g; ctx.fill(); }
    path(); ctx.strokeStyle=o.lineColor; ctx.lineWidth=1.8; ctx.lineJoin="round"; ctx.stroke();
    if(n===1){ ctx.fillStyle=o.lineColor; ctx.beginPath(); ctx.arc(X(0),Y(data[0].c),3,0,7); ctx.fill(); }
  }
  if(o.maVals){ ctx.beginPath(); let st=false; o.maVals.forEach((v,i)=>{ if(v==null) return; st?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)); st=true; });
    ctx.strokeStyle=C.accent; ctx.lineWidth=1.4; ctx.setLineDash([5,3]); ctx.stroke(); ctx.setLineDash([]); }
  // last price tag
  const last=data[n-1].c, ly=Y(last), up=n<2||last>=data[n-2].c, tagCol=o.type==="candle"?(data[n-1].c>=data[n-1].o?C.up:C.down):(o.tagColor||(up?C.up:C.down));
  ctx.setLineDash([2,3]); ctx.strokeStyle=tagCol; ctx.beginPath(); ctx.moveTo(padL,Math.round(ly)+.5); ctx.lineTo(padL+pw,Math.round(ly)+.5); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle=tagCol; ctx.fillRect(padL+pw+2, ly-9, padR-4, 18); ctx.fillStyle="#fff"; ctx.textAlign="left"; ctx.textBaseline="middle"; ctx.font=`600 11px ${o.numFont||"monospace"}`; ctx.fillText(o.fmtY(last), padL+pw+7, ly);
  // crosshair
  if(o.hover!=null && data[o.hover]){ const i=o.hover, x=Math.round(X(i))+.5; ctx.strokeStyle=C.muted; ctx.setLineDash([3,3]); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,padT+ph+(volH?volH+6:0)); ctx.stroke(); ctx.setLineDash([]);
    const lab=o.fmtX(data[i].t); ctx.font=`11px ${o.numFont||"monospace"}`; const tw=ctx.measureText(lab).width+12;
    ctx.fillStyle=C.ink; ctx.fillRect(Math.min(Math.max(x-tw/2,padL),padL+pw-tw), H-padB+2, tw, 18); ctx.fillStyle=C.bg; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(lab, Math.min(Math.max(x,padL+tw/2),padL+pw-tw/2), H-padB+11); }
  return {X, step, padL, n};
}
function themeColors(){ return {bg:cssVar("--panel"),ink:cssVar("--ink"),muted:cssVar("--muted"),grid:cssVar("--line"),up:cssVar("--up"),down:cssVar("--down"),accent:cssVar("--accent")}; }
function maOf(cs,k=4){ return cs.map((c,i)=> i<k-1?null : cs.slice(i-k+1,i+1).reduce((a,b)=>a+b.c,0)/k); }
const fmtXFor = agg => t => fmtDate(t, agg==="M"?"M":"short");

/* ============ rendering ============ */
let SUMS=[], CUR=null, GEO=null, HOVER=null;
function fillSelect(el, values, allLabel, cur, labelFn=v=>v){
  el.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map(v=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(labelFn(v))}</option>`).join("");
}
function renderFilters(){
  const uniq = (arr) => [...new Set(arr)].filter(v=>v&&v!=="—").sort((a,b)=>String(a).localeCompare(String(b),"pt"));
  fillSelect($("fProv"), uniq(S.obs.map(o=>o.prov)), t("allF"), S.prov);
  fillSelect($("fMkt"), uniq(S.obs.filter(o=>!S.prov||o.prov===S.prov).map(o=>o.mkt)), t("all"), S.mkt);
  fillSelect($("fSel"), uniq(S.obs.map(o=>o.sel)), t("all"), S.sel, sellerName);
  fillSelect($("fCat"), uniq(S.obs.map(o=>o.cat)), t("allF"), S.cat, catName);
  document.querySelectorAll("#segPeriod button").forEach(b=>b.setAttribute("aria-pressed", String(+b.dataset.v===S.period)));
  document.querySelectorAll("#segAgg button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.v===S.agg)));
  document.querySelectorAll("#segType button").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.v===S.type)));
  $("btnMA").setAttribute("aria-pressed", String(S.ma));
  document.querySelector('#segPeriod button[data-v="0"]').textContent = LANG==="pt"?"TUDO":"ALL";
  document.querySelector('#segPeriod button[data-v="365"]').textContent = LANG==="pt"?"1A":"1Y";
}
function spark(cs, w=58, h=22){
  if(cs.length<2) return `<svg class="spark" width="${w}" height="${h}"></svg>`;
  const v=cs.map(c=>c.c), mn=Math.min(...v), mx=Math.max(...v), r=mx-mn||1;
  const pts=v.map((y,i)=>`${(i/(v.length-1)*(w-4)+2).toFixed(1)},${(h-3-(y-mn)/r*(h-6)).toFixed(1)}`).join(" ");
  const col = v[v.length-1]>=v[0] ? "var(--up)" : "var(--down)"; const lp=pts.split(" ").pop().split(",");
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${lp[0]}" cy="${lp[1]}" r="2" fill="${col}"/></svg>`;
}
function renderAll(){
  const list = filtered(false);
  SUMS = summarize(list);
  if(!SUMS.find(s=>s.prod===S.prod)) S.prod = (SUMS.slice().sort((a,b)=>b.n-a.n)[0]||{}).prod || null;
  CUR = SUMS.find(s=>s.prod===S.prod) || null;
  renderTape(); renderWatch(); renderQuote(); drawMain(); renderDepth(); renderMovers(); renderIndex(); renderHeat(); renderTrades(list);
  if(typeof renderBulletin==="function") renderBulletin();
  if(typeof renderAbout==="function") renderAbout();
}
function renderTape(){
  const items = SUMS.slice().sort((a,b)=>a.tk.localeCompare(b.tk)).map(s=>`<button class="tk" data-p="${esc(s.prod)}"><b>${esc(s.tk)}</b><span class="num">${fmtN(s.last)}</span><span class="num ${cls(s.pct)}">${arrow(s.pct)} ${fmtPct(s.pct)}</span></button>`).join("");
  $("tape").innerHTML = items ? items+items : `<span class="tk">${esc(t("noData"))}</span>`;
}
function renderWatch(){
  const q=norm(S.q); let rows=SUMS.filter(s=>!q||norm(s.name).includes(q)||norm(s.tk).includes(q));
  const k=S.sort.k, d=S.sort.dir;
  rows.sort((a,b)=> k==="sym" ? a.tk.localeCompare(b.tk)*d : ((a[k]??-1e9)-(b[k]??-1e9))*d);
  $("wlCount").textContent = `${rows.length} ${t("products")}`;
  $("wl").innerHTML = rows.map(s=>`<tr data-p="${esc(s.prod)}" class="${s.prod===S.prod?"sel":""}" tabindex="0">
    <td><div class="sym">${esc(s.tk)}<small>${esc(s.name)}</small></div></td>
    <td class="num">${fmtN(s.last)}</td>
    <td><span class="chg num ${cls(s.pct)}">${fmtPct(s.pct)}</span></td>
    <td data-tip="${esc(tipHtml(s.tk+" · "+s.name,[[t("tipFirst"),fmtN(s.cs[0].c)],[t("thLast"),fmtN(s.last)+" "+unitLbl(s.prod)],[t("low"),fmtN(s.lo)],[t("high"),fmtN(s.hi)],[t("tipCat"),catName(s.cat)]]))}">${spark(s.cs)}</td></tr>`).join("") || `<tr><td colspan="4" class="empty">${esc(t("noData"))}</td></tr>`;
}
function renderQuote(){
  if(!CUR){ $("quote").innerHTML=`<div class="empty" style="width:100%">${esc(t("noData"))}</div>`; $("stats").innerHTML=""; $("ohlc").innerHTML=""; return; }
  const s=CUR;
  $("quote").innerHTML = `<div class="q-id"><div class="tick">${esc(s.tk)}<span class="chip">${esc(catName(s.cat))}</span></div><div class="nm">${esc(s.name)}</div></div>
    <div><div class="q-px num">${fmtN(s.last)}<small>${esc(unitLbl(s.prod))}</small></div></div>
    <div class="q-ch num ${cls(s.pct)}">${arrow(s.pct)} ${s.abs==null?"—":(s.abs>0?"+":"")+fmtN(s.abs)} (${fmtPct(s.pct)})</div>
    <div style="color:var(--muted);font-size:12px">${esc(t("lastObs"))}: <span class="num">${fmtDate(s.lastD)}</span></div>`;
  const st=[[t("open"),fmtN(s.open)],[t("high"),fmtN(s.hi)],[t("low"),fmtN(s.lo)],[t("avg"),fmtN(s.avg)],[t("obs"),fmtN(s.n,0)],[t("mkts"),fmtN(s.mkts,0)]];
  $("stats").innerHTML = st.map(([k,v])=>`<div class="stat"><span>${esc(k)}</span><b>${v}</b></div>`).join("");
  setOHLC(s.cs.length-1);
}
function setOHLC(i){
  if(!CUR||!CUR.cs[i]){ $("ohlc").innerHTML=""; return; } const c=CUR.cs[i];
  const L = LANG==="pt" ? ["A","Máx","Mín","F","Reg."] : ["O","H","L","C","Rec."];
  $("ohlc").innerHTML = `<span>${fmtDate(c.t, S.agg==="M"?"M":"long")}</span><span>${L[0]} <b>${fmtN(c.o)}</b></span><span>${L[1]} <b>${fmtN(c.h)}</b></span><span>${L[2]} <b>${fmtN(c.l)}</b></span><span>${L[3]} <b class="${c.c>=c.o?"up":"down"}">${fmtN(c.c)}</b></span><span>${L[4]} <b>${c.v}</b></span>`;
}
function canvasSize(cv){ const r=cv.getBoundingClientRect(); return {w:Math.max(200,r.width), h:Math.max(120,r.height)}; }
function drawMain(){
  const cv=$("chart"), {w,h}=canvasSize(cv), cs=CUR?CUR.cs:[];
  GEO = drawChart(cv, cs, {w,h,dpr:window.devicePixelRatio||1,colors:themeColors(),type:S.type,volume:true,maVals:S.ma&&cs.length>=4?maOf(cs):null,
    fmtY:v=>fmtN(v), fmtX:fmtXFor(S.agg), hover:HOVER, lineColor:cssVar("--accent")||"#B86E00", emptyText:t("noData"),
    numFont:"'IBM Plex Mono', monospace", uiFont:"'IBM Plex Sans Condensed', sans-serif"});
}
function renderDepth(){
  if(!CUR){ $("depth").innerHTML=`<div class="empty">${esc(t("noData"))}</div>`; return; }
  const by=new Map(); for(const o of CUR.arr){ const k=o.mkt; let a=by.get(k); if(!a){a={s:0,n:0,prov:o.prov};by.set(k,a);} a.s+=o.price; a.n++; }
  const rows=[...by.entries()].map(([m,a])=>({m,prov:a.prov,avg:a.s/a.n,n:a.n})).sort((a,b)=>b.avg-a.avg).slice(0,12);
  const mx=Math.max(...rows.map(r=>r.avg));
  $("depth").innerHTML = rows.map(r=>`<div class="drow" data-tip="${esc(tipHtml(r.m,[[t("prov"),r.prov],[t("tipAvg"),fmtN(r.avg)+" "+unitLbl(CUR.prod)],[t("tipSamples"),r.n],[t("tipShare"),fmtN(r.avg/mx*100,0)+"%"]]))}"><span class="nm">${esc(r.m)} <small>· ${esc(r.prov)} · ${r.n}</small></span><b class="num">${fmtN(r.avg)}</b><div class="bar"><i style="width:${(r.avg/mx*100).toFixed(1)}%"></i></div></div>`).join("");
}
function renderMovers(){
  const ch=SUMS.filter(s=>s.pct!=null);
  const g=ch.slice().sort((a,b)=>b.pct-a.pct).filter(s=>s.pct>0).slice(0,5), l=ch.slice().sort((a,b)=>a.pct-b.pct).filter(s=>s.pct<0).slice(0,5);
  const row=s=>`<button class="mv" data-p="${esc(s.prod)}"><b>${esc(s.tk)}</b><span class="num ${cls(s.pct)}">${fmtPct(s.pct)}</span></button>`;
  $("gain").innerHTML = g.map(row).join("") || `<span class="flat">—</span>`;
  $("lose").innerHTML = l.map(row).join("") || `<span class="flat">—</span>`;
}
let IDX=[], IGEO=null, IHOVER=null;
function renderIndex(){
  IDX = indexSeries(SUMS); const cv=$("idxChart"), {w,h}=canvasSize(cv);
  IGEO = drawChart(cv, IDX, {w,h,dpr:window.devicePixelRatio||1,colors:themeColors(),type:"area",volume:false,refLine:100,fmtY:v=>fmtN(v,1),fmtX:fmtXFor(S.agg),hover:IHOVER,
    lineColor:cssVar("--accent")||"#B86E00", tagColor:cssVar("--accent"), emptyText:t("noData"), numFont:"'IBM Plex Mono', monospace"});
  if(IDX.length){ const v=IDX[IDX.length-1].c, p=IDX.length>1?IDX[IDX.length-2].c:null; $("idxV").textContent=fmtN(v,2);
    const pc=p?(v/p-1)*100:null; $("idxC").className="num "+cls(pc); $("idxC").textContent = `${arrow(pc)} ${fmtPct(pc)} · ${fmtPct(v-100)} ${LANG==="pt"?"no período":"over period"}`; }
  else { $("idxV").textContent="—"; $("idxC").textContent=""; }
}
function heatColor(p){
  if(p==null) return "var(--panel2)";
  const a=Math.min(1,Math.abs(p)/10)*0.75+0.12; const base=p>=0?cssVar("--up"):cssVar("--down");
  const hex=base.replace("#",""); const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16);
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}
function renderHeat(){
  const by=new Map(); for(const s of SUMS){ if(!by.has(s.cat)) by.set(s.cat,[]); by.get(s.cat).push(s); }
  const cats=[...by.keys()].sort((a,b)=>catName(a).localeCompare(catName(b)));
  $("heat").innerHTML = cats.map(c=>`<div class="hcat"><h4>${esc(catName(c))}</h4><div class="htiles">${by.get(c).sort((a,b)=>a.tk.localeCompare(b.tk)).map(s=>
    `<button class="ht" data-p="${esc(s.prod)}" style="background:${heatColor(s.pct)}" data-tip="${esc(tipHtml(s.tk+" · "+s.name,[[t("thLast"),fmtN(s.last)+" "+unitLbl(s.prod)],[t("thChg"),`<span class="${cls(s.pct)}">${fmtPct(s.pct)}</span>`],[t("low"),fmtN(s.lo)],[t("high"),fmtN(s.hi)],[t("obs"),s.n]],true))}"><b>${esc(s.tk)}</b><span class="num">${fmtPct(s.pct)}</span></button>`).join("")}</div></div>`).join("") || `<div class="empty">${esc(t("noData"))}</div>`;
}
function renderTrades(list){
  const avg=new Map(SUMS.map(s=>[s.prod,s.avg]));
  const rows=list.slice().sort((a,b)=>b.d-a.d||a.prod.localeCompare(b.prod)).slice(0,60);
  $("trCount").textContent = `${fmtN(list.length,0)} ${t("records")}`;
  $("trades").innerHTML = rows.map(o=>{ const dv=avg.get(o.prod)?(o.price/avg.get(o.prod)-1)*100:null;
    return `<tr><td class="num">${fmtDate(o.d)}</td><td><b>${esc(pTk(o.prod))}</b> <span style="color:var(--muted)">${esc(pName(o.prod))}</span></td><td>${esc(o.mkt)}</td><td>${esc(o.prov)}</td><td>${esc(sellerName(o.sel))}</td><td class="r num">${fmtN(o.price)}</td><td class="r num ${cls(dv)}">${fmtPct(dv)}</td></tr>`; }).join("")
    || `<tr><td colspan="7" class="empty">${esc(t("noData"))}</td></tr>`;
}
function renderStatus(){
  const pill=$("modePill"); pill.className="pill "+(S.mode==="live"?"live":(S.mode==="demo"||S.mode==="error")?"demo":"load");
  $("modeTxt").textContent = S.mode==="live"?t("live"):S.mode==="demo"?t("demo"):S.mode==="error"?t("errorPill"):t("loading");
  const maxD=S.obs.reduce((m,o)=>Math.max(m,o.d),0);
  $("lastUpd").textContent = S.loadedAt ? `${t("lastObs")}: ${maxD?fmtDate(maxD):"—"} · ${fmtN(S.obs.length,0)} ${t("records")}` : t("loadingMsg");
  const b=$("banner");
  const em={net:LANG==="pt"?"ligação bloqueada ou sem rede":"connection blocked or offline",chosen:LANG==="pt"?"modo de demonstração escolhido":"demo mode chosen",timeout:LANG==="pt"?"tempo esgotado":"timed out"};
  if(S.mode==="demo"){ b.innerHTML=t("bannerDemo").replace("{e}",esc(em[S.err]||S.err||em.net)); b.hidden=false; }
  else if(S.mode==="error"){ b.innerHTML=t("bannerError").replace("{e}",esc(em[S.err]||S.err)); b.hidden=false; }
  else if(S.mode==="live" && !S.obs.length){ b.innerHTML=t("bannerEmpty"); b.hidden=false; }
  else b.hidden=true;
}
function applyLang(){
  document.documentElement.lang = LANG==="pt"?"pt":"en";
  document.querySelectorAll("[data-i]").forEach(el=>{ el.textContent=t(el.dataset.i); });
  document.querySelectorAll("[data-ip]").forEach(el=>{ el.placeholder=t(el.dataset.ip); });
  $("lang-pt").setAttribute("aria-pressed",String(LANG==="pt")); $("lang-en").setAttribute("aria-pressed",String(LANG==="en"));
  document.title = t("brand")+" - "+t("brandSub");
  renderStatus(); renderFilters(); if(S.obs.length) renderAll(); else { renderAll(); }
}

/* ============ PDF report ============ */
function chartImage(data, opts, w=1000, h=380){
  const cv=document.createElement("canvas");
  const colors={bg:"#FFFFFF",ink:"#13202B",muted:"#6B7884",grid:"#E1E6EA",up:"#0B8A4E",down:"#C42F3A",accent:"#B86E00"};
  drawChart(cv, data, Object.assign({w,h,dpr:2,colors,fmtY:v=>fmtN(v),fmtX:fmtXFor(S.agg),lineColor:"#B86E00",numFont:"monospace",uiFont:"sans-serif",emptyText:t("noData")}, opts));
  return cv.toDataURL("image/png");
}
async function exportPDF(){
  if(!window.jspdf){ toast(t("pdfFail")+" (jsPDF)"); return; }
  const btn=$("btnPdf"); btn.disabled=true; toast(t("pdfWorking"),8000);
  await new Promise(r=>setTimeout(r,30));
  try{
    const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:"mm",format:"a4"});
    const PW=210, PH=297, M=14; const INK=[19,32,43], MUT=[107,120,132], ACC=[184,110,0], UP=[11,138,78], DN=[196,47,58], LINE=[214,220,226];
    const colOf=v=>v==null||Math.abs(v)<0.005?MUT:v>0?UP:DN;
    const pdfPct=v=>v==null||!isFinite(v)?"-":(v>0?"+":"")+fmtN(v)+"%";
    const list=filtered(false), sums=SUMS.slice().sort((a,b)=>a.cat.localeCompare(b.cat)||a.tk.localeCompare(b.tk));
    const maxD=list.reduce((m,o)=>Math.max(m,o.d),0), minD=list.reduce((m,o)=>Math.min(m,o.d),Infinity);
    const filt=[[t("prov"),S.prov||t("allF")],[t("mkt"),S.mkt||t("all")],[t("seller"),S.sel?sellerName(S.sel):t("all")],[t("cat"),S.cat?catName(S.cat):t("allF")],
      [t("rptPeriodLbl"), list.length?`${fmtDate(minD)} ${t("to")} ${fmtDate(maxD)}`:"-"],[t("agg"), t("agg"+S.agg)]];
    let y=0;
    const header=()=>{ doc.setFillColor(...INK); doc.rect(0,0,PW,16,"F"); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(10);
      doc.text(t("brand").toUpperCase(),M,10); doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.text(t("rptTitle"),PW-M,10,{align:"right"}); y=24; };
    const newPage=()=>{ doc.addPage(); header(); };
    const need=h=>{ if(y+h>PH-16) newPage(); };
    const h2=txt=>{ need(12); doc.setTextColor(...ACC); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text(txt.toUpperCase(),M,y); doc.setDrawColor(...LINE); doc.line(M,y+2,PW-M,y+2); y+=8; };
    // cover
    header(); y=30;
    doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.text(doc.splitTextToSize(t("rptTitle"),PW-2*M),M,y); y+=10;
    doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...MUT); doc.text(t("rptSub"),M,y); y+=6;
    const now=new Date(); doc.text(`${t("rptGen")}: ${now.toLocaleString(LANG==="pt"?"pt-PT":"en-GB",{timeZone:"Africa/Maputo",dateStyle:"long",timeStyle:"short"})} (Maputo)`,M,y); y+=8;
    if(S.mode==="demo"){ doc.setFillColor(246,231,207); doc.rect(M,y-4,PW-2*M,8,"F"); doc.setTextColor(...ACC); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text(t("rptDemoNote"),M+3,y+1.5); y+=10; }
    // filters
    h2(t("rptFilters")); doc.setFontSize(9);
    filt.forEach((f,i)=>{ const cx=M+(i%3)*((PW-2*M)/3), cy=y+Math.floor(i/3)*10; doc.setTextColor(...MUT); doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.text(f[0].toUpperCase(),cx,cy);
      doc.setTextColor(...INK); doc.setFontSize(9.5); doc.setFont("helvetica","bold"); doc.text(doc.splitTextToSize(String(f[1]),(PW-2*M)/3-4)[0],cx,cy+4.5); });
    y+=22;
    // KPIs
    h2(t("rptKpi"));
    const idxLast=IDX.length?IDX[IDX.length-1].c:null;
    const kpis=[[t("obs"),fmtN(list.length,0)],[t("rptProducts"),fmtN(sums.length,0)],[t("rptMarkets"),fmtN(new Set(list.map(o=>o.mkt)).size,0)],[t("index"),idxLast?fmtN(idxLast,1):"-"]];
    const kw=(PW-2*M)/4;
    kpis.forEach((k,i)=>{ const cx=M+i*kw; doc.setDrawColor(...LINE); doc.rect(cx+0.5,y-4,kw-3,16); doc.setTextColor(...MUT); doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.text(k[0].toUpperCase(),cx+3,y);
      doc.setTextColor(...INK); doc.setFont("courier","bold"); doc.setFontSize(14); doc.text(k[1],cx+3,y+8); });
    y+=20;
    // index chart
    h2(t("index"));
    doc.addImage(chartImage(IDX,{type:"area",volume:false,refLine:100,fmtY:v=>fmtN(v,1),tagColor:"#B86E00"},1000,330),"PNG",M,y,PW-2*M,(PW-2*M)*0.33); y+=(PW-2*M)*0.33+3;
    doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.setFont("helvetica","italic"); doc.text(t("rptIndexNote"),M,y); y+=8;
    // movers
    const ch=sums.filter(s=>s.pct!=null); const g=ch.slice().sort((a,b)=>b.pct-a.pct).filter(s=>s.pct>0).slice(0,5), l=ch.slice().sort((a,b)=>a.pct-b.pct).filter(s=>s.pct<0).slice(0,5);
    h2(t("movers"));
    [[t("gainers"),g,UP],[t("losers"),l,DN]].forEach(([ttl,arr,col],k)=>{ const cx=M+k*((PW-2*M)/2); let yy=y; doc.setTextColor(...col); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text(ttl,cx,yy); yy+=5;
      doc.setFontSize(8.5); arr.forEach(s=>{ doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.text(s.tk,cx,yy); doc.setFont("helvetica","normal"); doc.text(doc.splitTextToSize(s.name,48)[0],cx+14,yy);
        doc.setFont("courier","bold"); doc.text(fmtN(s.last),cx+76,yy,{align:"right"}); doc.setTextColor(...col); doc.text(pdfPct(s.pct),cx+(PW-2*M)/2-4,yy,{align:"right"}); yy+=4.6; });
      if(!arr.length){ doc.setTextColor(...MUT); doc.text("-",cx,yy); } });
    y+=5+5*4.6+4;
    // summary table
    newPage(); h2(t("rptSummary"));
    const cols=[{k:t("thSym"),w:14},{k:"",w:44},{k:t("cat"),w:30},{k:t("thLast"),w:18,r:1},{k:t("change"),w:17,r:1},{k:t("low"),w:16,r:1},{k:t("high"),w:16,r:1},{k:t("avg"),w:16,r:1},{k:t("obs"),w:11,r:1}];
    const tableHead=()=>{ doc.setFillColor(238,241,244); doc.rect(M,y-4,PW-2*M,6.5,"F"); doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...MUT); let cx=M+1.5;
      cols.forEach(c=>{ doc.text(c.k.toUpperCase(), c.r?cx+c.w-1.5:cx, y, c.r?{align:"right"}:undefined); cx+=c.w; }); y+=6; };
    tableHead();
    sums.forEach((s,i)=>{ if(y>PH-20){ newPage(); tableHead(); }
      if(i%2){ doc.setFillColor(248,249,250); doc.rect(M,y-3.8,PW-2*M,5.6,"F"); }
      const vals=[s.tk, doc.splitTextToSize(s.name,42)[0], doc.splitTextToSize(catName(s.cat),28)[0], fmtN(s.last), pdfPct(s.pct), fmtN(s.lo), fmtN(s.hi), fmtN(s.avg), fmtN(s.n,0)];
      let cx=M+1.5; vals.forEach((v,j)=>{ const c=cols[j]; doc.setFont(j===0?"helvetica":(c.r?"courier":"helvetica"), j===0||j===3?"bold":"normal"); doc.setFontSize(j>=3?8:8.2);
        doc.setTextColor(...(j===4?colOf(s.pct):INK)); doc.text(String(v), c.r?cx+c.w-1.5:cx, y, c.r?{align:"right"}:undefined); cx+=c.w; });
      y+=5.6; });
    doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(...MUT); y+=3; doc.text(`${t("per")} · ${t("change")}: ${t("prev")} ${t("agg"+S.agg).toLowerCase()}`,M,y); y+=6;
    // product detail
    newPage(); h2(t("rptDetail"));
    const imgH=(PW-2*M)*0.36;
    for(const s of sums){
      need(imgH+40);
      doc.setTextColor(...INK); doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.text(s.tk,M,y); const tkW=doc.getTextWidth(s.tk);
      doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(...MUT); doc.text(`${s.name} · ${catName(s.cat)}`,M+tkW+3,y);
      doc.setFont("courier","bold"); doc.setFontSize(13); doc.setTextColor(...INK); doc.text(`${fmtN(s.last)} ${t("per")}`,PW-M-30,y,{align:"right"});
      doc.setTextColor(...colOf(s.pct)); doc.setFontSize(10); doc.text(pdfPct(s.pct),PW-M,y,{align:"right"}); y+=4;
      doc.addImage(chartImage(s.cs,{type:S.type,volume:true,maVals:s.cs.length>=4?maOf(s.cs):null},1000,360),"PNG",M,y,PW-2*M,imgH); y+=imgH+4;
      const st=[[t("open"),fmtN(s.open)],[t("high"),fmtN(s.hi)],[t("low"),fmtN(s.lo)],[t("avg"),fmtN(s.avg)],[t("obs"),fmtN(s.n,0)],[t("mkts"),fmtN(s.mkts,0)]];
      const sw=(PW-2*M)/6; st.forEach((a,i)=>{ doc.setFont("helvetica","normal"); doc.setFontSize(6.8); doc.setTextColor(...MUT); doc.text(a[0].toUpperCase(),M+i*sw,y); doc.setFont("courier","bold"); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(a[1],M+i*sw,y+4.2); });
      y+=8;
      const by=new Map(); for(const o of s.arr){ let a=by.get(o.mkt); if(!a){a={s:0,n:0,prov:o.prov};by.set(o.mkt,a);} a.s+=o.price;a.n++; }
      const top=[...by.entries()].map(([m,a])=>({m,prov:a.prov,avg:a.s/a.n,n:a.n})).sort((a,b)=>b.n-a.n).slice(0,4);
      doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(...MUT); doc.text(t("rptTopMkts").toUpperCase(),M,y); y+=4;
      doc.setFontSize(8); top.forEach((r,i)=>{ const cx=M+(i%2)*((PW-2*M)/2), cy=y+Math.floor(i/2)*4.4; doc.setFont("helvetica","normal"); doc.setTextColor(...INK);
        doc.text(doc.splitTextToSize(`${r.m} (${r.prov})`,60)[0],cx,cy); doc.setFont("courier","normal"); doc.text(`${fmtN(r.avg)} · ${r.n}`,cx+(PW-2*M)/2-4,cy,{align:"right"}); });
      y+=Math.ceil(top.length/2)*4.4+3; doc.setDrawColor(...LINE); doc.line(M,y,PW-M,y); y+=8;
    }
    // footers
    const np=doc.getNumberOfPages();
    for(let i=1;i<=np;i++){ doc.setPage(i); doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(...MUT);
      doc.text(`${t("rptSource")}: ${S.mode==="demo"?t("demo"):"ArcGIS Feature Service · Survey123 SIMA"}`,M,PH-8);
      doc.text(`${t("rptPage")} ${i} ${t("rptOf")} ${np}`,PW-M,PH-8,{align:"right"}); }
    const fname=`SIMA_${LANG==="pt"?"relatorio_precos":"price_report"}_${new Date().toISOString().slice(0,10)}.pdf`;
    const blob=doc.output("blob");
    let dl=null; try{ if(window.claude?.use) dl=await window.claude.use("downloads"); }catch(e){}
    if(dl){ try{ await dl.save({filename:fname,data:blob}); toast(t("pdfDone")); } catch(e){ toast(e?.code==="declined"?t("pdfDeclined"):t("pdfFail")+(e?.code?` (${e.code})`:"")); } }
    else { doc.save(fname); toast(t("pdfDone")); }
  }catch(e){ console.error(e); toast(t("pdfFail")); }
  finally{ btn.disabled=false; }
}

/* ============ events ============ */
function selectProd(p){ S.prod=p; HOVER=null; CUR=SUMS.find(s=>s.prod===p)||null; renderWatch(); renderQuote(); drawMain(); renderDepth();
  if(window.matchMedia("(max-width:860px)").matches) $("quote").scrollIntoView({behavior:"smooth",block:"start"}); }
document.addEventListener("click",e=>{ const el=e.target.closest("[data-p]"); if(el) selectProd(el.dataset.p); });
$("wl").addEventListener("keydown",e=>{ if(e.key==="Enter"){ const tr=e.target.closest("tr[data-p]"); if(tr) selectProd(tr.dataset.p);} });
document.querySelectorAll(".wl th[data-s]").forEach(th=>th.addEventListener("click",()=>{ const k=th.dataset.s; S.sort = S.sort.k===k?{k,dir:-S.sort.dir}:{k,dir:k==="sym"?1:-1}; renderWatch(); }));
$("q").addEventListener("input",e=>{ S.q=e.target.value; renderWatch(); });
$("fProv").addEventListener("change",e=>{ S.prov=e.target.value; S.mkt=""; renderFilters(); renderAll(); });
$("fMkt").addEventListener("change",e=>{ S.mkt=e.target.value; renderAll(); });
$("fSel").addEventListener("change",e=>{ S.sel=e.target.value; renderAll(); });
$("fCat").addEventListener("change",e=>{ S.cat=e.target.value; renderAll(); });
$("segPeriod").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; S.period=+b.dataset.v; renderFilters(); renderAll(); });
$("segAgg").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; S.agg=b.dataset.v; renderFilters(); renderAll(); });
$("segType").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; S.type=b.dataset.v; renderFilters(); drawMain(); });
$("btnMA").addEventListener("click",()=>{ S.ma=!S.ma; renderFilters(); drawMain(); });
$("lang-pt").addEventListener("click",()=>{ LANG="pt"; store.set("sima.lang","pt"); applyLang(); });
$("lang-en").addEventListener("click",()=>{ LANG="en"; store.set("sima.lang","en"); applyLang(); });
$("btnPdf").addEventListener("click",()=> typeof bulletinPDF==="function" ? bulletinPDF() : exportPDF());
$("btnRefresh").addEventListener("click",()=>load());
const cvMain=$("chart");
cvMain.addEventListener("pointermove",e=>{ if(!GEO||!CUR) return; const r=cvMain.getBoundingClientRect(); const i=Math.floor((e.clientX-r.left-GEO.padL)/GEO.step);
  const ii=Math.max(0,Math.min(GEO.n-1,i)); if(ii!==HOVER){ HOVER=ii; setOHLC(ii); drawMain(); } });
cvMain.addEventListener("pointerleave",e=>{ if(e.pointerType!=="mouse") return; HOVER=null; if(CUR) setOHLC(CUR.cs.length-1); drawMain(); hideTip(); });
cvMain.addEventListener("pointermove",e=>{ if(!GEO||!CUR||HOVER==null) return hideTip(); const c=CUR.cs[HOVER]; if(!c) return hideTip();
  const ma=S.ma&&CUR.cs.length>=4?maOf(CUR.cs)[HOVER]:null, prev=HOVER>0?CUR.cs[HOVER-1].c:null, ch=prev?(c.c/prev-1)*100:null;
  showTip(e, tipHtml(`${CUR.tk} · ${fmtDate(c.t, S.agg==="M"?"M":"long")}`,[[t("open"),fmtN(c.o)],[t("high"),fmtN(c.h)],[t("low"),fmtN(c.l)],
    [LANG==="pt"?"Fecho":"Close",fmtN(c.c)+" "+unitLbl(CUR.prod)],[t("change"),`<span class="${cls(ch)}">${fmtPct(ch)}</span>`],[t("tipRecords"),c.v]].concat(ma!=null?[[t("tipMA"),fmtN(ma)]]:[]),true)); });
const cvIdx=$("idxChart");
cvIdx.addEventListener("pointermove",e=>{ if(!IGEO||!IDX.length) return; const r=cvIdx.getBoundingClientRect(); const i=Math.max(0,Math.min(IGEO.n-1,Math.floor((e.clientX-r.left-IGEO.padL)/IGEO.step)));
  if(i!==IHOVER){ IHOVER=i; renderIndex(); } const c=IDX[i], p=i>0?IDX[i-1].c:null;
  showTip(e, tipHtml(`${t("index")} · ${fmtDate(c.t, S.agg==="M"?"M":"long")}`,[[t("tipIndex"),fmtN(c.c,2)],[t("tipPrev"),`<span class="${cls(p?(c.c/p-1)*100:null)}">${fmtPct(p?(c.c/p-1)*100:null)}</span>`],[LANG==="pt"?"Desde o início":"Since start",`<span class="${cls(c.c-100)}">${fmtPct(c.c-100)}</span>`],[t("rptProducts"),c.v]],true)); });
cvIdx.addEventListener("pointerleave",e=>{ if(e.pointerType!=="mouse") return; IHOVER=null; renderIndex(); hideTip(); });
// toque: um toque no gráfico mostra o popup desse ponto (pointerdown dispara o mesmo cálculo que o movimento)
for(const cv of [cvMain,cvIdx]){ cv.style.touchAction="pan-y";
  cv.addEventListener("pointerdown",e=>{ if(e.pointerType!=="mouse"){ cv.dispatchEvent(new PointerEvent("pointermove",e)); cv.dispatchEvent(new PointerEvent("pointermove",e)); clearTimeout(cv._tt); cv._tt=setTimeout(()=>{ hideTip(); },3500); } }); }
// toque em elementos com popup (mini-gráficos, mapa, preço por mercado)
document.addEventListener("touchstart",e=>{ window._touchAt=Date.now(); if(e.target===cvMain||e.target===cvIdx) return; const el=e.target.closest&&e.target.closest("[data-tip]"); if(!el){ hideTip(); return; }
  const tch=e.touches[0]; showTip({clientX:tch.clientX,clientY:tch.clientY}, el.dataset.tip); clearTimeout(document._tt); document._tt=setTimeout(hideTip,3500); },{passive:true});
window.addEventListener("scroll",()=>{ if(Date.now()-(window._tipAt||0)>700) hideTip(); },{passive:true});
// popups genéricos: qualquer elemento com data-tip
document.addEventListener("mouseover",e=>{ const el=e.target.closest&&e.target.closest("[data-tip]"); if(el) showTip(e, el.dataset.tip); });
document.addEventListener("mousemove",e=>{ const el=e.target.closest&&e.target.closest("[data-tip]"); if(el) placeTip(e); });
document.addEventListener("mouseout",e=>{ if(Date.now()-(window._touchAt||0)<1500) return; const el=e.target.closest&&e.target.closest("[data-tip]"); if(el && !el.contains(e.relatedTarget)) hideTip(); });
$("btnReset").addEventListener("click",()=>{ Object.assign(S,{prov:"",mkt:"",sel:"",cat:"",period:0,agg:"W",q:""}); $("q").value=""; renderFilters(); renderAll(); toast(t("filtersCleared"),1600); });
let rT; window.addEventListener("resize",()=>{ clearTimeout(rT); rT=setTimeout(()=>{ drawMain(); renderIndex(); },120); });
window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{ drawMain(); renderIndex(); renderHeat(); });
new MutationObserver(()=>{ drawMain(); renderIndex(); renderHeat(); }).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
function tick(){ $("clock").textContent = new Date().toLocaleString(LANG==="pt"?"pt-PT":"en-GB",{timeZone:"Africa/Maputo",weekday:"short",hour:"2-digit",minute:"2-digit",second:"2-digit"})+" CAT"; }
setInterval(tick,1000);

const FORCE_DEMO = /[?&]demo=1\b/.test(location.search);
async function load(){
  if(FORCE_DEMO){ S.obs=demoData(); S.mode="demo"; S.err="chosen"; S.loadedAt=Date.now(); renderStatus(); renderFilters(); renderAll(); return; }
  S.mode="load"; S.loadedAt=null; renderStatus(); $("btnRefresh").disabled=true;
  try{
    const obs = await Promise.race([loadLive(), new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),SIMA_CONFIG.timeoutMs))]);
    S.obs=obs; S.mode="live"; S.err="";
  }catch(e){
    console.warn("Live load failed:",e); S.obs=SIMA_CONFIG.demoFallback?demoData():[]; S.mode=SIMA_CONFIG.demoFallback?"demo":"error"; S.err = (e && e.message) ? e.message : String(e);
    if(/Failed to fetch|NetworkError|Load failed|TypeError/i.test(S.err)) S.err="net";
  }
  S.loadedAt=Date.now(); $("btnRefresh").disabled=false;
  renderStatus(); renderFilters(); renderAll();
}
LANG = (store.get("sima.lang")||SIMA_CONFIG.defaultLang)==="en" ? "en" : "pt";
tick(); applyLang(); load();
