"use strict";
/* Separador "Sobre o SIMA": o que é o sistema, como os dados são recolhidos, cobertura, metodologia e produtos */
const ABOUT_TXT = {
  pt: {
    eyebrow: "Sobre o sistema",
    title: "SIMA - Sistema de Monitoria de Preços de Produtos Agrícolas",
    lead: "O SIMA recolhe, organiza e divulga os preços dos produtos agrícolas praticados nos mercados de Moçambique. O objectivo é dar a produtores, comerciantes, técnicos, decisores e parceiros informação actualizada e comparável sobre o comportamento dos preços em cada mercado, província e nível de comercialização.",
    covTitle: "Cobertura actual",
    cov: ["Registos de preço", "Mercados", "Províncias", "Produtos", "Primeiro registo", "Último registo"],
    s1: "Como os dados são recolhidos",
    s1p: [
      "Os inquiridores visitam os mercados e preenchem o formulário de monitoria de preços no ArcGIS Survey123. Cada visita regista a província, o distrito, o mercado, a localização (cidade, município/vila ou zona rural), o tipo de vendedor e a data de monitoria.",
      "Para cada produto, o inquiridor indica se o produto existe no mercado e a unidade de medida. Recolhe até três amostras de vendedores diferentes, com a quantidade disponível, o preço, o sexo do vendedor e a proveniência do produto. O peso de cada unidade (lata, saco, bacia, etc.) é convertido para kg, o que permite comparar preços entre mercados.",
      "Os preços são recolhidos em três níveis de comercialização: produtor, grossista e retalhista."
    ],
    s2: "O que encontra na plataforma",
    s2l: [
      ["Preços", "Cotações de todos os produtos, ao estilo de uma bolsa de valores: último preço, variação, gráfico de velas, preço por mercado, maiores subidas e descidas, índice SIMA e mapa do mercado. Os filtros permitem escolher província, mercado, tipo de vendedor, categoria, período e intervalo."],
      ["Boletim semanal", "Análise da semana escolhida, com texto gerado a partir dos dados: dinâmica de preços dos produtos principais, preços semanais por mercado, fluxos de proveniência, quadros por nível de mercado, quantidades no grossista e pecuária. O boletim pode ser exportado em PDF para um nível de mercado, para um mercado ou com todos os níveis no mesmo documento, separados por partes."],
      ["Português e inglês", "Toda a plataforma e o boletim em PDF estão disponíveis nas duas línguas (botão PT | EN)."]
    ],
    s3: "Metodologia",
    s3l: [
      ["Preço de um registo", "Média dos preços por kg das amostras recolhidas (preco_kg1, preco_kg2, preco_kg3). Se não houver preço por kg, usa-se o preço médio registado. Produtos sem conversão para kg aparecem em MZN por unidade."],
      ["Preço de um mercado na semana", "Média dos registos desse produto, nesse mercado e nesse nível, entre segunda-feira e domingo."],
      ["Preço médio nacional", "Média dos preços dos mercados que reportaram na semana. A tendência compara apenas os mercados com registos nas duas semanas, e uma variação inferior a {th}% é considerada estabilidade."],
      ["Velas", "Abertura e fecho são as médias do primeiro e do último dia com registos no intervalo; máximo e mínimo são as amostras extremas; o volume é o número de registos."],
      ["Índice SIMA", "Em cada intervalo, média de (preço do produto ÷ preço do produto no início do período) × 100, para todos os produtos com registos."],
      ["Datas", "Hora de Moçambique (UTC+2). Os dados são lidos em tempo real do serviço ArcGIS sempre que a página é aberta ou actualizada."]
    ],
    s4: "Produtos monitorados",
    s4p: "Código de cotação, nome e categoria dos produtos do formulário. A coluna da direita indica se há registos de preço no serviço.",
    withData: "com registos", noData: "sem registos",
    s5: "Contactos", web: "Página web"
  },
  en: {
    eyebrow: "About the system",
    title: "SIMA - Agricultural Commodity Price Monitoring System",
    lead: "SIMA collects, organises and publishes the prices of agricultural products in Mozambique's markets. Its purpose is to give producers, traders, technicians, decision-makers and partners up-to-date, comparable information on how prices behave in each market, province and trading level.",
    covTitle: "Current coverage",
    cov: ["Price records", "Markets", "Provinces", "Products", "First record", "Latest record"],
    s1: "How the data is collected",
    s1p: [
      "Enumerators visit markets and fill in the price monitoring form in ArcGIS Survey123. Each visit records the province, district, market, location (city, municipality/town or rural area), seller type and monitoring date.",
      "For each product, the enumerator records whether it is available and its unit of measure. Up to three samples are collected from different sellers, with the quantity available, the price, the seller's sex and the product's origin. The weight of each unit (tin, bag, basin, etc.) is converted to kg so prices can be compared across markets.",
      "Prices are collected at three trading levels: producer, wholesale and retail."
    ],
    s2: "What you will find",
    s2l: [
      ["Prices", "Quotes for every product in a stock-exchange style: last price, change, candlestick chart, price by market, top movers, SIMA index and market map. Filters cover province, market, seller type, category, period and interval."],
      ["Weekly bulletin", "Analysis of the selected week, with text generated from the data: price dynamics of the main products, weekly prices by market, trade flows, tables by market level, wholesale quantities and livestock. The bulletin can be exported to PDF for one market level, for one market, or with all levels in one document, split into parts."],
      ["Portuguese and English", "The whole platform and the PDF bulletin are available in both languages (PT | EN button)."]
    ],
    s3: "Methodology",
    s3l: [
      ["Price of a record", "Average per-kg price of the samples collected (preco_kg1, preco_kg2, preco_kg3). If no per-kg price exists, the recorded average price is used. Products that cannot be converted to kg are shown in MZN per unit."],
      ["Weekly market price", "Average of the records for that product, market and level from Monday to Sunday."],
      ["National average price", "Average of the prices of markets that reported in the week. The trend only compares markets with records in both weeks; changes below {th}% are treated as stable."],
      ["Candles", "Open and close are the first and last day averages in the interval; high and low are the extreme samples; volume is the number of records."],
      ["SIMA index", "For each interval, the average of (product price ÷ product price at the start of the period) × 100 across all products with records."],
      ["Dates", "Mozambique time (UTC+2). Data is read live from the ArcGIS service whenever the page is opened or refreshed."]
    ],
    s4: "Monitored products",
    s4p: "Ticker code, name and category of the products in the form. The right-hand column shows whether the service has price records for it.",
    withData: "with records", noData: "no records",
    s5: "Contacts", web: "Website"
  }
};
function renderAbout(){
  const root=$("viewAbout"); if(!root||root.hidden) return;
  const A=ABOUT_TXT[LANG]||ABOUT_TXT.pt, cfg=SIMA_CONFIG.about||{};
  const th=(SIMA_CONFIG.bulletin&&SIMA_CONFIG.bulletin.stableThreshold)||2;
  const obs=S.obs;
  const days=obs.map(o=>o.d), dMin=days.length?Math.min(...days):null, dMax=days.length?Math.max(...days):null;
  const cov=[fmtN(obs.length,0), fmtN(new Set(obs.map(o=>o.mkt)).size,0), fmtN(new Set(obs.map(o=>o.prov)).size,0), fmtN(new Set(obs.map(o=>o.prod)).size,0),
    dMin!=null?fmtDate(dMin):"—", dMax!=null?fmtDate(dMax):"—"];
  const withData=new Set(obs.map(o=>o.prod));
  const cats={}; PRODS.forEach(p=>{ (cats[p[3]]??=[]).push(p[0]); });
  [...withData].filter(p=>!PROD[p]).forEach(p=>{ (cats["—"]??=[]).push(p); });
  const prodRows=Object.keys(cats).sort((a,b)=>catName(a).localeCompare(catName(b))).map(c=>`<div class="ab-cat"><h4>${esc(catName(c))}</h4><table class="b-t"><tbody>${
    cats[c].sort((a,b)=>pName(a).localeCompare(pName(b))).map(p=>`<tr><td class="num"><b>${esc(pTk(p))}</b></td><td>${esc(pName(p))}</td><td class="r ${withData.has(p)?"up":"flat"}">${esc(withData.has(p)?A.withData:A.noData)}</td></tr>`).join("")}</tbody></table></div>`).join("");
  const contacts=(cfg.contacts||[]).filter(c=>c&&c.value);
  root.innerHTML=`
  <section class="panel ab-hero">
    <span class="b-eyebrow">${esc(A.eyebrow)}</span>
    <h2>${esc(A.title)}</h2>
    <p class="ab-lead">${esc(A.lead)}</p>
    <div class="ab-cov"><h3>${esc(A.covTitle)}</h3><div class="b-kpis ab-kpis">${A.cov.map((k,i)=>`<div><span>${esc(k)}</span><b class="num">${cov[i]}</b></div>`).join("")}</div></div>
  </section>
  <div class="ab-grid">
    <section class="panel ab-sec"><h3>${esc(A.s1)}</h3>${A.s1p.map(p=>`<p>${esc(p)}</p>`).join("")}</section>
    <section class="panel ab-sec"><h3>${esc(A.s2)}</h3><dl>${A.s2l.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>
  </div>
  <section class="panel ab-sec"><h3>${esc(A.s3)}</h3><dl class="ab-method">${A.s3l.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v.replace("{th}",th))}</dd></div>`).join("")}</dl></section>
  <section class="panel ab-sec"><h3>${esc(A.s4)}</h3><p>${esc(A.s4p)}</p><div class="ab-prods">${prodRows}</div></section>
  ${contacts.length||cfg.website?`<section class="panel ab-sec"><h3>${esc(A.s5)}</h3><dl>${contacts.map(c=>`<dt>${esc(c.label||"")}</dt><dd class="ab-sel">${esc(c.value)}</dd>`).join("")}${cfg.website?`<dt>${esc(A.web)}</dt><dd><a href="${esc(cfg.website)}" target="_blank" rel="noopener">${esc(cfg.website)}</a></dd>`:""}</dl></section>`:""}`;
}
// actualizar quando os dados chegam ou a língua muda
$("lang-pt").addEventListener("click",()=>renderAbout());
$("lang-en").addEventListener("click",()=>renderAbout());
