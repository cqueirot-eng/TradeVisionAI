(function(){

 function toNumber(value){
  const number=Number(value);

  return Number.isFinite(number)
   ?number
   :0;
 }

 function distancePercentage(price,reference){
  if(price<=0||reference<=0){
   return null;
  }

  return ((price-reference)/reference)*100;
 }

 function getRsiStatus(rsi){
  if(rsi>=70){
   return {
    label:"Sobrecompra",
    tone:"negative",
    score:-5
   };
  }

  if(rsi>=60){
   return {
    label:"Impulso fuerte",
    tone:"positive",
    score:10
   };
  }

  if(rsi>=45){
   return {
    label:"Neutral",
    tone:"neutral",
    score:5
   };
  }

  if(rsi>=30){
   return {
    label:"Impulso débil",
    tone:"neutral",
    score:0
   };
  }

  return {
   label:"Sobreventa",
   tone:"positive",
   score:5
  };
 }

 function validate(data){
  const errors=[];

  if(!data||typeof data!=="object"){
   errors.push("No se recibieron datos técnicos.");

   return errors;
  }

  const requiredFields=[
   ["price","Precio"],
   ["sma20","SMA 20"],
   ["sma50","SMA 50"],
   ["sma100","SMA 100"],
   ["sma200","SMA 200"],
   ["rsi","RSI"]
  ];

  requiredFields.forEach(([field,label])=>{
   const value=toNumber(data[field]);

   if(value<=0){
    errors.push(`${label} debe ser mayor que cero.`);
   }
  });

  const rsi=toNumber(data.rsi);

  if(rsi>100){
   errors.push("El RSI no puede ser mayor que 100.");
  }

  return errors;
 }

 function classifyLongTerm(values){
  const {
   price,
   sma100,
   sma200
  }=values;

  if(
   price>sma200&&
   sma100>sma200
  ){
   return "Alcista";
  }

  if(
   price<sma200&&
   sma100<sma200
  ){
   return "Bajista";
  }

  return "Neutral";
 }

 function classifyMediumTerm(values){
  const {
   price,
   sma50,
   sma100
  }=values;

  if(
   price>sma50&&
   sma50>sma100
  ){
   return "Alcista";
  }

  if(
   price<sma50&&
   sma50<sma100
  ){
   return "Bajista";
  }

  return "Neutral";
 }

 function classifyShortTerm(values){
  const {
   price,
   sma20,
   sma50
  }=values;

  if(
   price>sma20&&
   sma20>sma50
  ){
   return "Alcista";
  }

  if(
   price<sma20||
   sma20<sma50
  ){
   return "Correctivo";
  }

  return "Neutral";
 }

 function calculateScore(values,rsiStatus){
  const {
   price,
   sma20,
   sma50,
   sma100,
   sma200
  }=values;

  let score=10;

  /*
   Largo plazo: hasta 30 puntos.
  */

  if(price>sma200){
   score+=15;
  }

  if(sma100>sma200){
   score+=10;
  }

  if(price>sma100){
   score+=5;
  }

  /*
   Mediano plazo: hasta 25 puntos.
  */

  if(price>sma50){
   score+=10;
  }

  if(sma50>sma100){
   score+=10;
  }

  if(sma100>sma200){
   score+=5;
  }

  /*
   Corto plazo: hasta 25 puntos.
  */

  if(price>sma20){
   score+=10;
  }

  if(sma20>sma50){
   score+=15;
  }

  /*
   RSI: entre -5 y +10 puntos.
  */

  score+=rsiStatus.score;

  return Math.max(
   0,
   Math.min(100,score)
  );
 }

 function classifyScore(score){
  if(score>=80){
   return "Muy sólido";
  }

  if(score>=65){
   return "Sólido";
  }

  if(score>=50){
   return "Neutral";
  }

  if(score>=35){
   return "Débil";
  }

  return "Muy débil";
 }

 function classifyExtension(distance){
  if(distance===null){
   return "No disponible";
  }

  if(distance<0){
   return "Debajo de SMA 200";
  }

  if(distance<=5){
   return "Cerca de SMA 200";
  }

  if(distance<=15){
   return "Extensión normal";
  }

  if(distance<=30){
   return "Extendido";
  }

  return "Muy extendido";
 }

 function buildInterpretation(result){
  const paragraphs=[];

  if(result.longTerm==="Alcista"){
   paragraphs.push(
    "La estructura de largo plazo permanece alcista: el precio está por encima de la SMA 200 y la SMA 100 continúa por encima de esa media."
   );
  }else if(result.longTerm==="Bajista"){
   paragraphs.push(
    "La estructura de largo plazo es bajista: el precio está por debajo de la SMA 200 y la SMA 100 también se encuentra por debajo de esa referencia."
   );
  }else{
   paragraphs.push(
    "La estructura de largo plazo es mixta. El precio y las medias principales todavía no muestran una alineación claramente alcista o bajista."
   );
  }

  if(result.mediumTerm==="Alcista"){
   paragraphs.push(
    "El mediano plazo conserva una configuración positiva, con el precio por encima de la SMA 50 y la SMA 50 por encima de la SMA 100."
   );
  }else if(result.mediumTerm==="Bajista"){
   paragraphs.push(
    "El mediano plazo muestra deterioro, con el precio por debajo de la SMA 50 y una estructura descendente entre las medias."
   );
  }else{
   paragraphs.push(
    "El mediano plazo se encuentra en transición y no presenta una dirección concluyente."
   );
  }

  if(result.shortTerm==="Alcista"){
   paragraphs.push(
    "En el corto plazo existe impulso alcista: el precio está por encima de la SMA 20 y la SMA 20 supera a la SMA 50."
   );
  }else if(result.shortTerm==="Correctivo"){
   paragraphs.push(
    "En el corto plazo el activo atraviesa una corrección o una pérdida de impulso. Esta señal, por sí sola, no confirma un cambio en la tendencia principal."
   );
  }else{
   paragraphs.push(
    "La configuración de corto plazo es neutral."
   );
  }

  paragraphs.push(
   `El RSI se encuentra en ${result.rsi.toFixed(2)} y se clasifica como ${result.rsiStatus.label.toLowerCase()}.`
  );

  if(result.distanceSma200!==null){
   const direction=
    result.distanceSma200>=0
     ?"por encima"
     :"por debajo";

   paragraphs.push(
    `El precio está un ${Math.abs(result.distanceSma200).toFixed(2)}% ${direction} de la SMA 200. Esta distancia se clasifica como ${result.extensionStatus.toLowerCase()}.`
   );
  }

  if(
   result.longTerm==="Alcista"&&
   result.shortTerm==="Correctivo"
  ){
   paragraphs.push(
    "La combinación actual corresponde a una corrección de corto plazo dentro de una estructura principal todavía alcista. Una recuperación de la SMA 20 reforzaría nuevamente el impulso inmediato."
   );
  }

  return paragraphs;
 }

 function analyze(data){
  const errors=validate(data);

  if(errors.length){
   return {
    valid:false,
    errors
   };
  }

  const values={
   ticker:String(data.ticker||"").trim().toUpperCase(),
   price:toNumber(data.price),
   sma20:toNumber(data.sma20),
   sma50:toNumber(data.sma50),
   sma100:toNumber(data.sma100),
   sma200:toNumber(data.sma200),
   rsi:toNumber(data.rsi)
  };

  const rsiStatus=getRsiStatus(values.rsi);

  const score=calculateScore(
   values,
   rsiStatus
  );

  const distanceSma200=distancePercentage(
   values.price,
   values.sma200
  );

  const result={
   valid:true,
   ...values,
   longTerm:classifyLongTerm(values),
   mediumTerm:classifyMediumTerm(values),
   shortTerm:classifyShortTerm(values),
   rsiStatus,
   score,
   scoreStatus:classifyScore(score),
   distanceSma200,
   extensionStatus:
    classifyExtension(distanceSma200)
  };

  result.interpretation=
   buildInterpretation(result);

  return result;
 }

 window.TechnicalEngine={
  analyze
 };

})();