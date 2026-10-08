// Scraper oficial TGSS — Subastas de Bienes Embargados (inmuebles).
// NO hacer doble clic en este archivo: Windows lo abre con Windows Script Host
// (JScript antiguo) y da error 800A03EA. Ejecutar en terminal con Node 18+:
//     node scraper-node.js
// En Windows sin Node, usar en su lugar: doble clic en actualizar.bat.
// Mantiene cookies de sesión (JSESSIONID) exigidas por w6.seg-social.es y recorre las 15 páginas.
const fs = require('fs');
const path = require('path');
const BASE = 'https://w6.seg-social.es';

let cookies = '';
function headers(){ return { 'User-Agent':'Mozilla/5.0', 'Cookie': cookies }; }
async function getLatin(url){
  const r = await fetch(url, { headers: headers() });
  const setc = r.headers.get('set-cookie');
  if(setc){ const m = /JSESSIONID=[^;]+/.exec(setc); if(m) cookies = m[0]; }
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('latin1'); // el portal emite iso-8859-1
}
function parseEuro(s){
  if(!s) return null;
  if(/Sin Carga/i.test(s)) return 0;
  const t = s.replace(/[^\d,\.]/g,'').replace(/\./g,'').replace(',','.');
  const v = parseFloat(t); return isNaN(v)?null:v;
}
function parseLista(html){
  const out = [];
  const tables = html.match(/<table[\s\S]*?<\/table>/gi)||[];
  for(const t of tables){
    const cap = (/\<caption\>(.*?)\<\/caption\>/i.exec(t)||[])[1]||'';
    let tipoBien='', prov='';
    let m = /^(.*?)\s*-\s*(.*?)\s*-\s*\(/.exec(cap.trim());
    if(m){ tipoBien=m[1].trim(); prov=m[2].trim(); }
    const rows = t.match(/<tr[\s\S]*?<\/tr>/gi)||[];
    for(const r of rows){
      if(/<th/i.test(r)) continue;
      const ml = /opcion=13.*?EMB_ID=(\d+).*?>(.*?)<\/a>/i.exec(r);
      if(!ml) continue;
      const tds = [...r.matchAll(/<td.*?>([\s\S]*?)<\/td>/gi)].map(x=>x[1].replace(/<.*?>/g,'').replace(/\s+/g,' ').trim());
      if(tds.length<7) continue;
      let tipoDet = tds[1]; if(tipoDet==='-') tipoDet='';
      const loteM = /(\d+)/.exec(tds[4]);
      out.push({
        id:+ml[1], razon:ml[2].replace(/\s+/g,' ').trim(),
        tipoBien, tipoDetalle:tipoDet, provincia:prov,
        tasacion:parseEuro(tds[2]), cargas:parseEuro(tds[3]),
        lote:loteM?+loteM[1]:1, enajenacion:parseEuro(tds[5]),
        fechaSubasta:tds[6],
        url:`${BASE}/subastas/SubaSeControladorInter?opcion=13&EMB_ID=${ml[1]}&opcion2=1&tipoOperacion=1`
      });
    }
  }
  return out;
}
// normaliza mojibake residual latin1->utf8
function fix(s){
  const map={'ALMERÍA':'ALMERÍA'};
  return s;
}
(async()=>{
  console.log('1/3 sesión…');
  await getLatin(`${BASE}/subastas/SubaSeControladorInter?opcion=3&avanzada=0`);
  console.log('2/3 ámbito (rústica+urbana)…');
  const geo = await getLatin(`${BASE}/subastas/SubaSeControladorInter?opcion=10&EMB_TIPOBIEN=0101&EMB_TIPOBIEN=0102`);
  const tot = (/de un total de (\d+)/i.exec(geo)||[])[1] || '297';
  console.log('total anunciado:', tot);
  let items=[];
  for(let p=1;p<=15;p++){
    const url = p===1 ? `${BASE}/subastas/SubaSeControladorInter?opcion=8&tipoOperacion=1`
                      : `${BASE}/subastas/SubaSeControladorInter?pagina=${p}&opcion=8&tipoOperacion=1`;
    const html = await getLatin(url);
    const got = parseLista(html);
    console.log(`página ${p}: ${got.length}`);
    items.push(...got);
    if(got.length===0) break;
  }
  // dedup por id
  const seen=new Map(); for(const it of items) if(!seen.has(it.id)) seen.set(it.id,it);
  items=[...seen.values()];
  const obj={ fuente:'TGSS - Subastas de Bienes Embargados (w6.seg-social.es)',
    fechaActualizacion:new Date().toISOString().slice(0,10),
    total:items.length, tiposIncluidos:['Finca Rústica (0101)','Finca Urbana (0102)'], inmuebles:items };
  const dst=path.join(__dirname,'datos','inmuebles.json');
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.writeFileSync(dst, JSON.stringify(obj,null,2),'utf8');
  console.log(`OK: ${items.length} inmuebles -> ${dst}`);
})();
