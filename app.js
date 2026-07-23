const KEY="tradevision_v2";
const MARKET_CACHE_MS=10*60*1000;

const demo={
 settings:{
  email:"",
  senderName:"TradeVision AI",
  defaultSource:"BYMADATA Open",
  staleHours:24,
  cclRate:0
 },

technical:{
  QQQ:null,
  BRKB:null,
  DE:null,
  ECL:null,
  FSLR:null,
  GLD:null,
  IBIT:null,
  LLY:null,
  MCD:null,
  META:null,
  NEE:null,
  NTES:null,
  O:null,
  TSLA:null,
  WMT:null
},

 portfolios:[
  {
   id:"P001",
   name:"Cartera Crecimiento",
   horizon:"MP",
   risk:"Moderada",
   strategy:"MA, RSI",
   shortTrade:false,
   assets:[
    {
     ticker:"AAPL",
     name:"Apple CEDEAR",
     qty:45,
     price:12500,
     cost:10900,
     currency:"ARS",
     source:"Demo",
     updatedAt:"2026-07-20T12:00:00"
    },
    {
     ticker:"SPY",
     name:"ETF S&P 500",
     qty:18,
     price:35200,
     cost:33000,
     currency:"ARS",
     source:"Demo",
     updatedAt:"2026-07-20T12:00:00"
    }
   ]
  },
  {
   id:"P002",
   name:"Cartera DCA",
   horizon:"DCA",
   risk:"Conservadora",
   strategy:"DCA",
   shortTrade:false,
   assets:[
    {
     ticker:"QQQ",
     name:"ETF Nasdaq 100",
     qty:10,
     price:28700,
     cost:27000,
     currency:"ARS",
     source:"Demo",
     updatedAt:"2026-07-20T12:00:00"
    }
   ]
  }
 ],
 movements:[
  {
   date:"2026-07-05",
   portfolio:"P002",
   type:"Depósito",
   ticker:"-",
   qty:0,
   amount:400000,
   currency:"ARS"
  }
 ],
 alerts:[
  {
   date:"2026-07-20",
   level:"Info",
   ticker:"AAPL",
   horizon:"MP",
   text:"Alerta demostrativa inicial."
  }
 ]
};

let state=loadLocal();
let modalAction=null;
let saveTimer=null;
let isReady=false;

function normalizeState(data){
 const next=data||structuredClone(demo);

 if(!next.settings){
  next.settings=structuredClone(demo.settings);
 }
if(
  typeof next.settings.cclRate!=="number" ||
  !Number.isFinite(next.settings.cclRate)
){
  next.settings.cclRate=0;
}
 
 if(
  !next.technical||
  typeof next.technical!=="object"||
  Array.isArray(next.technical)
 ){
  next.technical={};
 }

 const technicalTickers=[
  "QQQ",
  "BRKB",
  "DE",
  "ECL",
  "FSLR",
  "GLD",
  "IBIT",
  "LLY",
  "MCD",
  "META",
  "NEE",
  "NTES",
  "O",
  "TSLA",
  "WMT"
 ];

 technicalTickers.forEach(ticker=>{
  if(
   !Object.prototype.hasOwnProperty.call(
    next.technical,
    ticker
   )
  ){
   next.technical[ticker]=null;
  }
 });

if(!Array.isArray(next.portfolios)){
  next.portfolios=[];
 }

 if(!Array.isArray(next.movements)){
  next.movements=[];
 }

 if(!Array.isArray(next.alerts)){
  next.alerts=[];
 }

 if(!next.marketQuotes||typeof next.marketQuotes!=="object"){
  next.marketQuotes={};
 }

 return next;
}

function loadLocal(){
 try{
  return normalizeState(
   JSON.parse(localStorage.getItem(KEY))||structuredClone(demo)
  );
 }catch{
  return normalizeState(structuredClone(demo));
 }
}

function setStorageStatus(kind,text){
 const el=document.getElementById("storage-status");

 if(!el){
  return;
 }

 el.className=`storage-status ${kind}`;
 el.textContent=text;
}

async function loadCloudState(){
 setStorageStatus("loading","Conectando con la memoria…");

 try{
  const response=await fetch(
   "/.netlify/functions/load-state",
   {cache:"no-store"}
  );

  const data=await response.json();

  if(!response.ok){
   throw new Error(
    data.error||"No se pudo cargar la memoria."
   );
  }

  if(data.found&&data.state){
   state=normalizeState(data.state);
   localStorage.setItem(KEY,JSON.stringify(state));
   setStorageStatus("ok","Memoria sincronizada");
  }else{
   setStorageStatus(
    "loading",
    "Migrando datos locales…"
   );

   await saveCloudState();

   setStorageStatus(
    "ok",
    "Memoria creada y sincronizada"
   );
  }
 }catch(error){
  console.error(error);

  setStorageStatus(
   "error",
   "Sin conexión a la memoria · usando respaldo local"
  );
 }finally{
  isReady=true;
  render();
  setupMarketButton();
  autoRefreshMarket();
 }
}

async function saveCloudState(){
 const response=await fetch(
  "/.netlify/functions/save-state",
  {
   method:"POST",
   headers:{
    "Content-Type":"application/json"
   },
   body:JSON.stringify({state})
  }
 );

 const data=await response.json();

 if(!response.ok){
  throw new Error(
   data.error||"No se pudo guardar la memoria."
  );
 }

 return data;
}

function save(){
 localStorage.setItem(KEY,JSON.stringify(state));
 render();

 if(!isReady){
  return;
 }

 clearTimeout(saveTimer);

 setStorageStatus("loading","Guardando…");

 saveTimer=setTimeout(async()=>{
  try{
   await saveCloudState();
   setStorageStatus("ok","Guardado en la memoria");
  }catch(error){
   console.error(error);

   setStorageStatus(
    "error",
    "No se pudo guardar · quedó respaldo local"
   );
  }
 },450);
}

function money(number,currency="ARS"){
 return new Intl.NumberFormat(
  "es-AR",
  {
   style:"currency",
   currency:["MEP","CCL"].includes(currency)
    ?"USD"
    :currency,
   maximumFractionDigits:2
  }
 ).format(+number||0);
}

function getCedearInfo(ticker){
  const symbol=String(ticker||"").trim().toUpperCase();

  return window.CEDEAR_DATA?.[symbol]||null;
}

function theoreticalCedearPrice(ticker){
  const symbol=String(ticker||"").trim().toUpperCase();
  const quote=state.marketQuotes?.[symbol];
  const cedear=getCedearInfo(symbol);
  const ccl=Number(state.settings?.cclRate)||0;

  if(
    !quote ||
    !Number.isFinite(Number(quote.currentPrice)) ||
    !cedear ||
    !Number.isFinite(Number(cedear.ratioCedears)) ||
    Number(cedear.ratioCedears)<=0 ||
    !Number.isFinite(Number(cedear.ratioSubyacente)) ||
    Number(cedear.ratioSubyacente)<=0 ||
    ccl<=0
  ){
    return null;
  }

  return (
    Number(quote.currentPrice) *
    ccl *
    Number(cedear.ratioSubyacente)
  ) / Number(cedear.ratioCedears);
}

function pnl(asset){
 return asset.cost
  ?((asset.price-asset.cost)/asset.cost)*100
  :0;
}

function val(asset){
 return asset.qty*asset.price;
}

function assets(){
 return state.portfolios.flatMap(portfolio=>
  portfolio.assets.map((asset,index)=>({
   ...asset,
   pid:portfolio.id,
   pname:portfolio.name,
   horizon:portfolio.horizon,
   index
  }))
 );
}

function stale(asset){
 if(!asset.updatedAt){
  return true;
 }

 return (
  Date.now()-new Date(asset.updatedAt).getTime()
 )/36e5>+state.settings.staleHours;
}

function uniqueTickers(){
 return [
  ...new Set(
   assets()
    .map(asset=>
     String(asset.ticker||"")
      .trim()
      .toUpperCase()
    )
    .filter(Boolean)
  )
 ];
}

function marketQuote(ticker){
 return state.marketQuotes?.[ticker]||null;
}

function marketQuoteFresh(quote){
 if(!quote?.fetchedAt){
  return false;
 }

 return (
  Date.now()-new Date(quote.fetchedAt).getTime()
 )<MARKET_CACHE_MS;
}

function formatMarketDate(value){
 if(!value){
  return "-";
 }

 const date=new Date(value);

 return Number.isNaN(date.getTime())
  ?"-"
  :date.toLocaleString("es-AR");
}

function setupMarketButton(){
 const toolbar=document.querySelector("#prices .toolbar");

 if(!toolbar||document.getElementById("refresh-market")){
  return;
 }

 const button=document.createElement("button");

 button.id="refresh-market";
 button.type="button";
 button.textContent="Actualizar mercado USD";
 button.onclick=()=>refreshMarketQuotes(false);

 toolbar.prepend(button);
}

function setMarketButtonStatus(text,disabled=false){
 const button=document.getElementById("refresh-market");

 if(!button){
  return;
 }

 button.textContent=text;
 button.disabled=disabled;
}

async function fetchMarketQuote(symbol){
 const response=await fetch(
  `/.netlify/functions/market-quote?symbol=${encodeURIComponent(symbol)}`,
  {cache:"no-store"}
 );

 const data=await response.json().catch(()=>null);

 if(!response.ok||!data?.ok){
  throw new Error(
   data?.error||`No se pudo consultar ${symbol}.`
  );
 }

 return data.quote;
}

async function refreshMarketQuotes(onlyStale=false){
 const tickers=uniqueTickers();

 if(!tickers.length){
  alert("No hay activos para consultar.");
  return;
 }

 const pending=onlyStale
  ?tickers.filter(ticker=>
   !marketQuoteFresh(marketQuote(ticker))
  )
  :tickers;

 if(!pending.length){
  setMarketButtonStatus("Mercado USD vigente");
  return;
 }

 setMarketButtonStatus(
  `Actualizando 0/${pending.length}…`,
  true
 );

 let completed=0;
 let success=0;
 const errors=[];

 for(const ticker of pending){
  try{
   state.marketQuotes[ticker]=
    await fetchMarketQuote(ticker);

   success++;
  }catch(error){
   console.error(
    `Error consultando ${ticker}:`,
    error
   );

   errors.push(
    `${ticker}: ${error.message}`
   );
  }

  completed++;

  setMarketButtonStatus(
   `Actualizando ${completed}/${pending.length}…`,
   true
  );

  priceTable();
 }

 localStorage.setItem(KEY,JSON.stringify(state));

 try{
  await saveCloudState();

  setStorageStatus(
   "ok",
   "Mercado y memoria sincronizados"
  );
 }catch(error){
  console.error(error);

  setStorageStatus(
   "error",
   "Mercado actualizado · falló la memoria"
  );
 }

 render();

 setMarketButtonStatus(
  "Actualizar mercado USD",
  false
 );

 if(errors.length){
  alert(
   `Se actualizaron ${success} de ${pending.length} símbolos.

No se pudieron consultar:
${errors.join("\n")}`
  );
 }
}

function autoRefreshMarket(){
 setTimeout(
  ()=>refreshMarketQuotes(true),
  700
 );
}

const views={
 dashboard:[
  "Dashboard",
  "Resumen general"
 ],
technical:["Análisis técnico","Interpretación de tendencias y señales"],
 portfolios:[
  "Carteras",
  "Administración de carteras"
 ],
 prices:[
  "Cotizaciones",
  "Carga manual, CSV y referencia USD"
 ],
 movements:[
  "Movimientos",
  "Bitácora de operaciones"
 ],
 alerts:[
  "Alertas",
  "Evaluación y correo"
 ],
 settings:[
  "Configuración",
  "Preferencias generales"
 ]
};

document.querySelectorAll(".nav").forEach(button=>{
 button.onclick=()=>{
  document
   .querySelectorAll(".nav")
   .forEach(item=>
    item.classList.remove("active")
   );

  button.classList.add("active");

  document
   .querySelectorAll(".view")
   .forEach(view=>
    view.classList.remove("active")
   );

  document
   .getElementById(button.dataset.view)
   .classList.add("active");

  title.textContent=
   views[button.dataset.view][0];

  subtitle.textContent=
   views[button.dataset.view][1];
 };
});

function selectedTechnicalTicker(){
 const select=
  document.getElementById("technical-ticker");

 return select
  ?select.value
  :"QQQ";
}

function technicalTone(value){
 if(value==="Alcista"){
  return "positive";
 }

 if(value==="Bajista"){
  return "negative";
 }

 return "neutral";
}

function renderTechnicalAnalysis(){

 const ticker=
  selectedTechnicalTicker();

 const statusElement=
  document.getElementById("technical-status");

 const analysisElement=
  document.getElementById("technical-analysis");

 const formTitle=
  document.getElementById("technical-form-title");

 const diagnosticTitle=
  document.getElementById("technical-diagnostic-title");

 const saveButton=
  document.getElementById("save-technical");

 if(formTitle){
  formTitle.textContent=
   `Datos técnicos de ${ticker}`;
 }

 if(diagnosticTitle){
  diagnosticTitle.textContent=
   `Diagnóstico de ${ticker}`;
 }

 if(saveButton){
  saveButton.textContent=
   `Guardar y analizar ${ticker}`;
 }

 if(!statusElement||!analysisElement){
  return;
 }

 const data=
  state.technical&&state.technical[ticker]
   ?state.technical[ticker]
   :null;

 const priceInput=
  document.getElementById("technical-price");

 const sma20Input=
  document.getElementById("technical-sma20");

 const sma50Input=
  document.getElementById("technical-sma50");

 const sma100Input=
  document.getElementById("technical-sma100");

 const sma200Input=
  document.getElementById("technical-sma200");

 const rsiInput=
  document.getElementById("technical-rsi");

 if(!data){
  priceInput.value="";
  sma20Input.value="";
  sma50Input.value="";
  sma100Input.value="";
  sma200Input.value="";
  rsiInput.value="";
  statusElement.innerHTML=`
   <p>
    Cargá los valores técnicos de ${ticker} para generar el análisis.
   </p>
  `;

  analysisElement.innerHTML=`
   <p>
    Todavía no hay un análisis técnico guardado.
   </p>
  `;

  return;
 }

 priceInput.value=data.price||"";
 sma20Input.value=data.sma20||"";
 sma50Input.value=data.sma50||"";
 sma100Input.value=data.sma100||"";
 sma200Input.value=data.sma200||"";
 rsiInput.value=data.rsi||"";

 if(
  !window.TechnicalEngine||
  typeof window.TechnicalEngine.analyze!=="function"
 ){
  statusElement.innerHTML=`
   <p class="negative">
    No se pudo cargar technical-engine.js.
   </p>
  `;

  return;
 }

 const result=window.TechnicalEngine.analyze(data);

 if(!result.valid){
  statusElement.innerHTML=`
   <p class="negative">
    No se pudo completar el análisis.
   </p>

   <ul>
    ${result.errors
     .map(error=>`<li>${error}</li>`)
     .join("")}
   </ul>
  `;

  analysisElement.innerHTML=`
   <p>
    Revisá los valores ingresados.
   </p>
  `;

  return;
 }

 statusElement.innerHTML=`
  <div class="metrics">
   <div class="metric">
    <small>Score técnico</small>
    <strong>${result.score}/100</strong>
   </div>

   <div class="metric">
    <small>Evaluación</small>
    <strong>${result.scoreStatus}</strong>
   </div>

   <div class="metric">
    <small>Largo plazo</small>
    <strong class="${technicalTone(result.longTerm)}">
     ${result.longTerm}
    </strong>
   </div>

   <div class="metric">
    <small>Mediano plazo</small>
    <strong class="${technicalTone(result.mediumTerm)}">
     ${result.mediumTerm}
    </strong>
   </div>

   <div class="metric">
    <small>Corto plazo</small>
    <strong class="${
     result.shortTerm==="Alcista"
      ?"positive"
      :"neutral"
    }">
     ${result.shortTerm}
    </strong>
   </div>

   <div class="metric">
    <small>RSI 14</small>
    <strong class="${result.rsiStatus.tone}">
     ${result.rsi.toFixed(2)}
     ·
     ${result.rsiStatus.label}
    </strong>
   </div>

   <div class="metric">
    <small>Distancia SMA 200</small>
    <strong>
     ${
      result.distanceSma200>=0
       ?"+"
       :""
     }${result.distanceSma200.toFixed(2)}%
    </strong>
   </div>

   <div class="metric">
    <small>Extensión</small>
    <strong>
     ${result.extensionStatus}
    </strong>
   </div>
  </div>
 `;

 analysisElement.innerHTML=
  result.interpretation
   .map(paragraph=>`<p>${paragraph}</p>`)
   .join("");
}

const technicalTickerSelect=
 document.getElementById("technical-ticker");

if(technicalTickerSelect){
 technicalTickerSelect.addEventListener(
  "change",
  ()=>{
   renderTechnicalAnalysis();
  }
 );
}

function render(){
 const allAssets=assets();

 const invested=allAssets.reduce(
  (sum,asset)=>sum+val(asset),
  0
 );

 const cost=allAssets.reduce(
  (sum,asset)=>sum+asset.qty*asset.cost,
  0
 );

 const globalPerformance=cost
  ?(invested-cost)/cost*100
  :0;

 metrics.innerHTML=[
  ["Carteras",state.portfolios.length],
  ["Activos",allAssets.length],
  ["Valor",money(invested)],
  ["Resultado",globalPerformance.toFixed(2)+"%"]
 ].map((item,index)=>`
  <div class="metric">
   <small>${item[0]}</small>
   <strong class="${
    index===3
     ?globalPerformance>=0
      ?"positive"
      :"negative"
     :""
   }">
    ${item[1]}
   </strong>
  </div>
 `).join("");

 const total=state.portfolios.reduce(
  (sum,portfolio)=>
   sum+portfolio.assets.reduce(
    (subtotal,asset)=>subtotal+val(asset),
    0
   ),
  0
 )||1;

 bars.innerHTML=state.portfolios.map(portfolio=>{
  const value=portfolio.assets.reduce(
   (sum,asset)=>sum+val(asset),
   0
  );

  const percentage=value/total*100;

  return `
   <div class="barrow">
    <span>${portfolio.id}</span>
    <div class="bar">
     <span style="width:${percentage}%"></span>
    </div>
    <b>${percentage.toFixed(1)}%</b>
   </div>
  `;
 }).join("");

 recentAlerts();

 summary.innerHTML=`
  <thead>
   <tr>
    <th>Cartera</th>
    <th>Activo</th>
    <th>Cantidad</th>
    <th>Precio</th>
    <th>Valor</th>
    <th>G/P</th>
   </tr>
  </thead>
  <tbody>
   ${allAssets.map(asset=>`
    <tr>
     <td>${asset.pid}</td>
     <td>${asset.ticker}</td>
     <td>${asset.qty}</td>
     <td>${money(asset.price,asset.currency)}</td>
     <td>${money(val(asset),asset.currency)}</td>
     <td class="${
      pnl(asset)>=0
       ?"positive"
       :"negative"
     }">
      ${pnl(asset).toFixed(2)}%
     </td>
    </tr>
   `).join("")}
  </tbody>
 `;

 portfolioList();
 priceTable();
 movementTable();
 alertList();

 email.value=state.settings.email||"";

 document.getElementById("sender-name").value=
  state.settings.senderName||"TradeVision AI";

 document.getElementById("default-source").value=
  state.settings.defaultSource||"BYMADATA Open";

 document.getElementById("ccl-rate").value=
  state.settings.cclRate||"";

document.getElementById("stale-hours").value=
  state.settings.staleHours||24;

renderTechnicalAnalysis();

}

function recentAlerts(){
 document.getElementById("recent-alerts").innerHTML=
  state.alerts
   .slice(0,5)
   .map(alertItem=>`
    <p>
     <b>${alertItem.level}</b>
     · ${alertItem.ticker||"-"}
     <br>
     <small>${alertItem.date}</small>
     ${alertItem.text}
    </p>
   `)
   .join("")
  ||"<p>Sin alertas.</p>";
}

function portfolioList(){
 document.getElementById("portfolio-list").innerHTML=
  state.portfolios.map(portfolio=>`
   <article class="portfolio">
    <div class="portfolio-head">
     <div>
      <h3>${portfolio.name}</h3>
      <small>${portfolio.id}</small>

      <div class="tags">
       <span class="tag">${portfolio.horizon}</span>
       <span class="tag">${portfolio.risk}</span>
       <span class="tag">${portfolio.strategy}</span>

       ${
        portfolio.shortTrade
         ?'<span class="tag">TC</span>'
         :""
       }
      </div>
     </div>

     <div>
      <button
       class="small"
       onclick="addAsset('${portfolio.id}')"
      >
       + Activo
      </button>

      <button
       class="small secondary"
       onclick="delPortfolio('${portfolio.id}')"
      >
       Eliminar
      </button>
     </div>
    </div>

    <div class="table">
     <table>
      <thead>
       <tr>
        <th>Ticker</th>
        <th>Nombre</th>
        <th>Cantidad</th>
        <th>Precio</th>
        <th>Costo</th>
        <th>G/P</th>
        <th></th>
       </tr>
      </thead>

      <tbody>
       ${portfolio.assets.map((asset,index)=>`
        <tr>
         <td>${asset.ticker}</td>
         <td>${asset.name}</td>
         <td>${asset.qty}</td>
         <td>${money(asset.price,asset.currency)}</td>
         <td>${money(asset.cost,asset.currency)}</td>
         <td class="${
          pnl(asset)>=0
           ?"positive"
           :"negative"
         }">
          ${pnl(asset).toFixed(2)}%
         </td>
         <td>
          <button
           class="small secondary"
           onclick="delAsset('${portfolio.id}',${index})"
          >
           ×
          </button>
         </td>
        </tr>
       `).join("")}
      </tbody>
     </table>
    </div>
   </article>
  `).join("");
}

function priceTable(){
  const uniqueTickers=[
    ...new Set(
      assets().map(a=>
        String(a.ticker||"")
          .trim()
          .toUpperCase()
      )
    )
  ];

  document.getElementById("prices-table").innerHTML=`
    <thead>
      <tr>
        <th>Ticker</th>
        <th>Carteras</th>
        <th>Precio local</th>
        <th>Referencia USD</th>
        <th>Variación diaria</th>
        <th>Ratio CEDEAR</th>
        <th>Precio teórico ARS</th>
        <th>Diferencia</th>
        <th>Fuente local</th>
        <th>Actualización local</th>
        <th>Estado</th>
      </tr>
    </thead>

    <tbody>
      ${uniqueTickers.map(ticker=>{
        const rows=assets().filter(
          asset=>
            String(asset.ticker||"")
              .trim()
              .toUpperCase()===ticker
        );

        const asset=rows[0];
        const quote=state.marketQuotes?.[ticker];
        const cedear=getCedearInfo(ticker);
        const theoretical=theoreticalCedearPrice(ticker);

        const localPrice=Number(asset.price)||0;

        const difference=
          theoretical&&localPrice
            ?((localPrice-theoretical)/theoretical)*100
            :null;

        const ratio=cedear
  ?cedear.ratioTexto||
    `${cedear.ratioCedears}:${cedear.ratioSubyacente}`
  :"-";

        return `
          <tr>
            <td>
              <b>${ticker}</b>
            </td>

            <td>
              ${rows.map(row=>row.pid).join(", ")}
            </td>

            <td>
              ${money(localPrice,asset.currency)}
            </td>

            <td>
              ${quote
                ?money(quote.currentPrice,"USD")
                :"-"
              }
            </td>

            <td class="${
              quote
                ?quote.changePercent>=0
                  ?"positive"
                  :"negative"
                :"neutral"
            }">
              ${quote
                ?`${quote.changePercent>=0?"+":""}${quote.changePercent.toFixed(2)}%`
                :"-"
              }
            </td>

            <td>
              ${ratio}
            </td>

            <td>
              ${theoretical!==null
                ?money(theoretical,"ARS")
                :"-"
              }
            </td>

            <td class="${
              difference===null
                ?"neutral"
                :Math.abs(difference)<=1
                  ?"positive"
                  :difference>0
                    ?"negative"
                    :"neutral"
            }">
              ${difference===null
                ?"-"
                :`${difference>=0?"+":""}${difference.toFixed(2)}%`
              }
            </td>

            <td>
              ${asset.source||"-"}
            </td>

            <td>
              ${asset.updatedAt
                ?new Date(asset.updatedAt)
                  .toLocaleString("es-AR")
                :"-"
              }
            </td>

            <td class="${
              stale(asset)
                ?"neutral"
                :"positive"
            }">
              ${stale(asset)
                ?"Desactualizado"
                :"Vigente"
              }
            </td>
          </tr>
        `;
      }).join("")}
    </tbody>
  `;
}

function movementTable(){
 document.getElementById("movements-table").innerHTML=`
  <thead>
   <tr>
    <th>Fecha</th>
    <th>Cartera</th>
    <th>Tipo</th>
    <th>Ticker</th>
    <th>Cantidad</th>
    <th>Monto</th>
    <th>Moneda</th>
<th>Acción</th>
   </tr>
  </thead>

  <tbody>
   ${state.movements.map((movement,index)=>`
    <tr>
     <td>${movement.date}</td>
     <td>${movement.portfolio}</td>
     <td>${movement.type}</td>
     <td>${movement.ticker}</td>
     <td>${movement.qty}</td>
     <td>${money(movement.amount,movement.currency)}</td>
     <td>${movement.currency}</td>
<td>
 <button
  class="small secondary"
  onclick="deleteMovement(${index})"
 >
  Eliminar
 </button>
</td>
    </tr>
   `).join("")}
  </tbody>
 `;
}

window.deleteMovement=index=>{
 if(
  !Number.isInteger(index)||
  index<0||
  index>=state.movements.length
 ){
  return;
 }

 if(!confirm("¿Eliminar este movimiento?")){
  return;
 }

 state.movements.splice(index,1);

 save();
};

function alertList(){
 document.getElementById("alerts-list").innerHTML=
  state.alerts.map(alertItem=>`
   <article class="card">
    <h3>
     ${alertItem.level}
     · ${alertItem.ticker||"-"}
    </h3>

    <p>
     ${alertItem.date}
     · ${alertItem.horizon||"-"}
    </p>

    <p>${alertItem.text}</p>
   </article>
  `).join("");
}

function openModal(titleText,fields,callback){
 document.getElementById("modal-title").textContent=
  titleText;

 document.getElementById("modal-body").innerHTML=
  fields.map(field=>`
   <label class="field ${field.span?"span2":""}">
    ${field.label}

    ${
     field.type==="select"
      ?`
       <select id="f-${field.id}">
        ${field.options.map(option=>`
         <option value="${option}">
          ${option}
         </option>
        `).join("")}
       </select>
      `
      :`
       <input
        id="f-${field.id}"
        type="${field.type||"text"}"
        value="${field.value||""}"
        step="${field.step||"any"}"
       >
      `
    }
   </label>
  `).join("");

 modalAction=()=>{
  const data={};

  fields.forEach(field=>{
   data[field.id]=
    document.getElementById(
     "f-"+field.id
    ).value;
  });

  callback(data);
 };

 modal.showModal();
}

document
 .getElementById("modal-form")
 .addEventListener("submit",event=>{
  if(event.submitter?.id==="modal-save"){
   event.preventDefault();
   modalAction?.();
   modal.close();
  }
 });

document.getElementById("new-portfolio").onclick=()=>{
 openModal(
  "Nueva cartera",
  [
   {
    id:"name",
    label:"Nombre",
    span:true
   },
   {
    id:"horizon",
    label:"Horizonte",
    type:"select",
    options:["CP","MP","LP","DCA"]
   },
   {
    id:"risk",
    label:"Riesgo",
    type:"select",
    options:[
     "Conservadora",
     "Moderada",
     "Agresiva"
    ]
   },
   {
    id:"strategy",
    label:"Indicadores",
    value:"MA, RSI"
   },
   {
    id:"tc",
    label:"Trade corto",
    type:"select",
    options:["No","Sí"]
   }
  ],
  data=>{
   const id=
    "P"+
    String(state.portfolios.length+1)
     .padStart(3,"0");

   state.portfolios.push({
    id,
    name:data.name||id,
    horizon:data.horizon,
    risk:data.risk,
    strategy:data.strategy,
    shortTrade:data.tc==="Sí",
    assets:[]
   });

   save();
  }
 );
};

window.addAsset=portfolioId=>{
 openModal(
  "Agregar activo",
  [
   {
    id:"ticker",
    label:"Ticker"
   },
   {
    id:"name",
    label:"Nombre"
   },
   {
    id:"qty",
    label:"Cantidad",
    type:"number"
   },
   {
    id:"price",
    label:"Precio",
    type:"number"
   },
   {
    id:"cost",
    label:"Costo promedio",
    type:"number"
   },
   {
    id:"currency",
    label:"Moneda",
    type:"select",
    options:["ARS","USD","MEP","CCL"]
   },
   {
    id:"source",
    label:"Fuente",
    value:state.settings.defaultSource
   }
  ],
  data=>{
   state.portfolios
    .find(portfolio=>portfolio.id===portfolioId)
    .assets
    .push({
     ...data,
     ticker:data.ticker.toUpperCase(),
     qty:+data.qty,
     price:+data.price,
     cost:+data.cost,
     updatedAt:new Date().toISOString()
    });

   save();
  }
 );
};

window.delAsset=(portfolioId,index)=>{
 if(confirm("¿Eliminar activo?")){
  state.portfolios
   .find(portfolio=>portfolio.id===portfolioId)
   .assets
   .splice(index,1);

  save();
 }
};

window.delPortfolio=portfolioId=>{
 if(confirm("¿Eliminar cartera?")){
  state.portfolios=
   state.portfolios.filter(
    portfolio=>portfolio.id!==portfolioId
   );

  save();
 }
};

document.getElementById("quick-price").onclick=()=>{
 openModal(
  "Actualizar cotización",
  [
   {
    id:"ticker",
    label:"Ticker"
   },
   {
    id:"price",
    label:"Precio",
    type:"number"
   },
   {
    id:"currency",
    label:"Moneda",
    type:"select",
    options:["ARS","USD","MEP","CCL"]
   },
   {
    id:"date",
    label:"Fecha y hora",
    type:"datetime-local",
    value:new Date()
     .toISOString()
     .slice(0,16)
   },
   {
    id:"source",
    label:"Fuente",
    value:state.settings.defaultSource
   }
  ],
  updatePrice
 );
};

function updatePrice(data){
 let found=0;

 state.portfolios.forEach(portfolio=>
  portfolio.assets.forEach(asset=>{
   if(
    asset.ticker.toUpperCase()===
    data.ticker.toUpperCase()
   ){
    asset.price=+data.price;
    asset.currency=data.currency;
    asset.source=data.source;
    asset.updatedAt=
     new Date(data.date).toISOString();

    found++;
   }
  })
 );

 if(!found){
  alert("No se encontró ese ticker.");
  return;
 }

 save();
}

document.getElementById("csv-file").onchange=
 async event=>{
  const text=
   await event.target.files[0].text();

  const lines=text
   .split(/\r?\n/)
   .filter(Boolean);

  const start=
   lines[0].toLowerCase().includes("ticker")
    ?1
    :0;

  let count=0;

  for(let index=start;index<lines.length;index++){
   const [
    ticker,
    price,
    currency,
    date,
    source
   ]=lines[index]
    .split(",")
    .map(value=>value.trim());

   if(!ticker||!price){
    continue;
   }

   state.portfolios.forEach(portfolio=>
    portfolio.assets.forEach(asset=>{
     if(
      asset.ticker.toUpperCase()===
      ticker.toUpperCase()
     ){
      asset.price=+price;

      asset.currency=
       currency||asset.currency;

      asset.updatedAt=
       date
        ?new Date(date).toISOString()
        :new Date().toISOString();

      asset.source=
       source||state.settings.defaultSource;

      count++;
     }
    })
   );
  }

  save();

  alert(
   `Se actualizaron ${count} posiciones.`
  );

  event.target.value="";
 };

document.getElementById("download-template").onclick=
 ()=>{
  download(
   "plantilla_precios.csv",
   `ticker,precio,moneda,fecha,fuente
AAPL,18250,ARS,2026-07-20,BYMADATA Open
`,
   "text/csv"
  );
 };

document.getElementById("new-movement").onclick=()=>{
 openModal(
  "Registrar movimiento",
  [
   {
    id:"date",
    label:"Fecha",
    type:"date",
    value:new Date()
     .toISOString()
     .slice(0,10)
   },
   {
    id:"portfolio",
    label:"Cartera",
    type:"select",
    options:state.portfolios.map(
     portfolio=>portfolio.id
    )
   },
   {
    id:"type",
    label:"Tipo",
    type:"select",
    options:[
     "Compra",
     "Venta",
     "Depósito",
     "Extracción"
    ]
   },
   {
    id:"ticker",
    label:"Ticker",
    value:"-"
   },
   {
    id:"qty",
    label:"Cantidad",
    type:"number"
   },
   {
    id:"amount",
    label:"Monto",
    type:"number"
   },
   {
    id:"currency",
    label:"Moneda",
    type:"select",
    options:["ARS","USD","MEP","CCL"]
   }
  ],
  data=>{
   state.movements.unshift({
    ...data,
    qty:+data.qty,
    amount:+data.amount
   });

   save();
  }
 );
};

document.getElementById("evaluate").onclick=()=>{
 evaluate();
 save();
 alert("Señales evaluadas.");
};

function evaluate(){
 const today=
  new Date().toISOString().slice(0,10);

 const output=[];

 state.portfolios.forEach(portfolio=>
  portfolio.assets.forEach(asset=>{
   const performance=pnl(asset);

   let level="Info";

   let text=
    `${asset.ticker}: sin señal concluyente con la información manual disponible.`;

   if(performance<=-10){
    level="Stop loss";

    text=
     `${asset.ticker}: pérdida estimada ${performance.toFixed(2)}%. Revisar mínimo anual y estrategia.`;
   }else if(performance>=8){
    level="Compra / mantener";

    text=
     `${asset.ticker}: rendimiento ${performance.toFixed(2)}%. Validar cruce de medias ${portfolio.horizon}.`;
   }

   output.push({
    date:today,
    level,
    ticker:asset.ticker,
    horizon:portfolio.horizon,
    text:`${text} Cartera ${portfolio.id}.`
   });
  })
 );

 state.alerts=[
  ...output,
  ...state.alerts
 ].slice(0,50);

 return output;
}

async function sendEmail(test=false){
 const recipient=state.settings.email;

 if(!recipient){
  setStatus(
   false,
   "Configurá primero el email receptor."
  );

  return;
 }

 const list=test
  ?[
   {
    level:"Prueba",
    ticker:"TEST",
    horizon:"-",
    text:"El envío de TradeVision AI mediante Resend funciona correctamente."
   }
  ]
  :evaluate();

 save();

 setStatus(true,"Enviando…");

 try{
  const response=await fetch(
   "/.netlify/functions/send-alerts",
   {
    method:"POST",
    headers:{
     "Content-Type":"application/json"
    },
    body:JSON.stringify({
     to:recipient,
     senderName:state.settings.senderName,
     alerts:list,
     test
    })
   }
  );

  const data=await response.json();

  if(!response.ok){
   throw new Error(
    data.error||"No se pudo enviar"
   );
  }

  setStatus(
   true,
   `Correo enviado a ${recipient}. ID: ${data.id||"confirmado"}`
  );
 }catch(error){
  setStatus(false,error.message);
 }
}

document.getElementById("send-alerts").onclick=
 ()=>sendEmail(false);

document.getElementById("test-email").onclick=
 ()=>sendEmail(true);

function setStatus(ok,message){
 document.getElementById("email-status").innerHTML=`
  <div class="status ${ok?"ok":"err"}">
   ${message}
  </div>
 `;
}

document.getElementById("save-settings").onclick=
 ()=>{
  state.settings={
   email:
    document.getElementById("email")
     .value
     .trim(),

   senderName:
    document.getElementById("sender-name")
     .value
     .trim(),

   defaultSource:
    document.getElementById("default-source")
     .value
     .trim(),

   staleHours:
    +document.getElementById("stale-hours")
     .value,

   cclRate:
    +document.getElementById("ccl-rate")
     .value
  };

  save();
  alert("Configuración guardada.");
 };


document.getElementById("save-technical").onclick=
 ()=>{
  const data={
   ticker:selectedTechnicalTicker(),

   price:
    +document
     .getElementById("technical-price")
     .value,

   sma20:
    +document
     .getElementById("technical-sma20")
     .value,

   sma50:
    +document
     .getElementById("technical-sma50")
     .value,

   sma100:
    +document
     .getElementById("technical-sma100")
     .value,

   sma200:
    +document
     .getElementById("technical-sma200")
     .value,

   rsi:
    +document
     .getElementById("technical-rsi")
     .value,

   updatedAt:
    new Date().toISOString()
  };

  const result=
   window.TechnicalEngine.analyze(data);

  if(!result.valid){
   alert(
    "No se pudo guardar:\n\n"+
    result.errors.join("\n")
   );

   return;
  }

  if(!state.technical){
   state.technical={};
  }

  state.technical[data.ticker]=data;

  save();

  alert(
   `Análisis de ${data.ticker} guardado.\n\nScore técnico: ${result.score}/100`
  );
 };

document.getElementById("backup").onclick=()=>{
 download(
  "tradevision-v2-backup.json",
  JSON.stringify(state,null,2),
  "application/json"
 );
};

document.getElementById("export-csv").onclick=()=>{
 download(
  "movimientos.csv",
  [
   "fecha,cartera,tipo,ticker,cantidad,monto,moneda",
   ...state.movements.map(movement=>
    [
     movement.date,
     movement.portfolio,
     movement.type,
     movement.ticker,
     movement.qty,
     movement.amount,
     movement.currency
    ].join(",")
   )
  ].join("\n"),
  "text/csv"
 );
};

function download(name,text,type){
 const anchor=document.createElement("a");

 anchor.href=URL.createObjectURL(
  new Blob([text],{type})
 );

 anchor.download=name;
 anchor.click();

 URL.revokeObjectURL(anchor.href);
}

render();
setupMarketButton();
loadCloudState();