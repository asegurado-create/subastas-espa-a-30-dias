/* Subastas TGSS — tabla por provincias + análisis de oportunidad. Vanilla JS, sin backend. */
const $ = (s, el=document) => el.querySelector(s);
const fmtE = n => n==null||isNaN(n) ? '—' : n.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let DATA = { fechaActualizacion:'—', inmuebles:[] };
let ANALIZADOS = [];
let FIRST_SEEN = {};
try { FIRST_SEEN = JSON.parse(localStorage.getItem('tgss_first_seen')||'{}'); } catch { FIRST_SEEN = {}; }
const HOY0 = new Date(); HOY0.setHours(0,0,0,0);
const isoLocal = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const HOY_ISO = isoLocal(HOY0);
const parseISO = s => { const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s||''); return m?new Date(+m[1],+m[2]-1,+m[3]):null; };
// Espectro temporal de 30 días: NUEVO = detectado por primera vez hace ≤30 días.
// Persiste por ID entre sesiones; en la primera carga no se marca nada (sin referencia).
function marcarNuevos(arr){
  const primera = Object.keys(FIRST_SEEN).length===0;
  const out = arr.map(it=>{
    if(!FIRST_SEEN[it.id]) FIRST_SEEN[it.id]=HOY_ISO;
    const fs = parseISO(FIRST_SEEN[it.id]);
    const diasVisto = fs?Math.round((HOY0-fs)/86400000):null;
    return {...it, ...analizar(it), diasVisto, nuevo: !primera && diasVisto!=null && diasVisto<=30};
  });
  try{ localStorage.setItem('tgss_first_seen', JSON.stringify(FIRST_SEEN)); }catch{}
  return out;
}
let FILTRO_PROV = '';

// Cobertura total: las 52 provincias. El scraper descarga todo el territorio
// nacional; el resumen muestra las 52 (con 0 donde la TGSS no publica nada).
const PROVS = [
 ['Andalucía','Almería'],['Andalucía','Cádiz'],['Andalucía','Córdoba'],['Andalucía','Granada'],
 ['Andalucía','Huelva'],['Andalucía','Jaén'],['Andalucía','Málaga'],['Andalucía','Sevilla'],
 ['Aragón','Huesca'],['Aragón','Teruel'],['Aragón','Zaragoza'],
 ['Asturias','Asturias'],
 ['Canarias','Las Palmas'],['Canarias','Santa Cruz de Tenerife'],
 ['Cantabria','Cantabria'],
 ['Castilla-La Mancha','Albacete'],['Castilla-La Mancha','Ciudad Real'],['Castilla-La Mancha','Cuenca'],
 ['Castilla-La Mancha','Guadalajara'],['Castilla-La Mancha','Toledo'],
 ['Castilla y León','Ávila'],['Castilla y León','Burgos'],['Castilla y León','León'],
 ['Castilla y León','Palencia'],['Castilla y León','Salamanca'],['Castilla y León','Segovia'],
 ['Castilla y León','Soria'],['Castilla y León','Valladolid'],['Castilla y León','Zamora'],
 ['Cataluña','Barcelona'],['Cataluña','Girona'],['Cataluña','Lleida'],['Cataluña','Tarragona'],
 ['Ceuta','Ceuta'],
 ['Comunidad de Madrid','Madrid'],
 ['Comunitat Valenciana','Alicante'],['Comunitat Valenciana','Castellón'],['Comunitat Valenciana','Valencia'],
 ['Extremadura','Badajoz'],['Extremadura','Cáceres'],
 ['Galicia','A Coruña'],['Galicia','Lugo'],['Galicia','Ourense'],['Galicia','Pontevedra'],
 ['Illes Balears','Illes Balears'],
 ['La Rioja','La Rioja'],
 ['Melilla','Melilla'],
 ['Navarra','Navarra'],
 ['País Vasco','Álava'],['País Vasco','Gipuzkoa'],['País Vasco','Bizkaia'],
 ['Región de Murcia','Murcia']
];
// Normaliza el texto tal cual lo publica la TGSS (p. ej. ALACANT/ALICANTE,
// S.C. DE TENERIFE, ARABA/ÁLAVA) a la provincia canónica.
const _norm = s => (s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const _MAP = {};
PROVS.forEach(([,p]) => { _MAP[_norm(p)] = p; });
[['ALACANT/ALICANTE','Alicante'],['S.C. DE TENERIFE','Santa Cruz de Tenerife'],
 ['ARABA/ALAVA','Álava'],['VALENCIA','Valencia']
].forEach(([a,p]) => { _MAP[_norm(a)] = p; });
function provKey(raw){
  const n = _norm(raw);
  if(_MAP[n]) return _MAP[n];
  const seg = n.split('/').pop().trim(); // p. ej. futuro "CASTELLO/CASTELLON"
  if(_MAP[seg]) return _MAP[seg];
  return (raw||'—').trim();
}
function provCA(prov){ const f = PROVS.find(([,p]) => p === prov); return f ? f[0] : '—'; }

function parseFechaSubasta(s){
  // "21/10/2026 09:30" -> Date
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(s||'');
  if(!m) return null;
  return new Date(+m[3], +m[2]-1, +m[1]);
}
function diasPara(s){
  const d = parseFechaSubasta(s); if(!d) return null;
  return Math.ceil((d - new Date())/86400000);
}
function analizar(it){
  const tas = +it.tasacion||0, car = +it.cargas||0, sal = +it.enajenacion||0;
  const dto = tas>0 ? Math.max(0,(tas-sal)/tas) : 0;
  const ratioC = tas>0 ? car/tas : 0;
  let score = 50 + Math.min(48, dto*60);
  const razones=[], riesgos=[];
  razones.push(`Descuento del ${(dto*100).toFixed(1)}% sobre tasación.`);
  if(car===0){ score+=12; razones.push('Sin cargas: no hay importes preferentes que subsistan.'); }
  else if(ratioC<0.10){ score+=6; razones.push(`Cargas bajas (${(ratioC*100).toFixed(1)}% de la tasación).`); }
  else if(ratioC<0.50){ razones.push(`Cargas moderadas (${(ratioC*100).toFixed(1)}%). Revisar registro.`); }
  else if(ratioC<0.80){ score-=15; riesgos.push(`Cargas altas (${(ratioC*100).toFixed(1)}%): subsisten y reducen el margen real.`); }
  else { score-=25; riesgos.push(`Cargas muy altas (${(ratioC*100).toFixed(1)}%): la salida barata esconde deuda preferente.`); }
  if(sal>0 && sal<30000){ score+=8; razones.push('Ticket de entrada bajo (<30.000€).'); }
  else if(sal<60000){ score+=5; razones.push('Precio de salida contenido (<60.000€).'); }
  else if(sal>300000){ score-=5; riesgos.push('Ticket alto (>300.000€): menor liquidez y depósito del 25-30% elevado.'); }
  if((it.tipoBien||'').includes('Urbana')){ score+=3; razones.push('Finca urbana: mercado secundario más amplio.'); }
  else { razones.push('Finca rústica: comprobar calificación, cultivo y acceso.'); }
  const d = diasPara(it.fechaSubasta);
  if(d!=null && d>30){ score+=3; razones.push(`Subasta en ${d} días: margen para expediente y financiación.`); }
  if(d!=null && d<7){ score-=5; riesgos.push(`Subasta en ${d} días: poco margen para depósito y due diligence.`); }
  if(it.tipoDetalle) razones.push(`Uso/cultivo: ${it.tipoDetalle}.`);
  score = Math.max(0, Math.min(100, Math.round(score)));
  const nivel = score>=75?'Alta':score>=55?'Media-Alta':score>=40?'Media':'Baja';
  return { dto, ratioC, score, nivel, razones, riesgos, dias:d };
}
function claseNivel(n){ return 'b-'+n.toLowerCase().replace('media-alta','media-alta'); }

async function cargarInicial(){
  try{
    const r = await fetch('datos/inmuebles.json', {cache:'no-store'});
    if(!r.ok) throw 0;
    DATA = await r.json();
  }catch{
    $('#meta-fecha').textContent = 'sin datos locales';
    return;
  }
  // marcar nuevos vs snapshot anterior
  ANALIZADOS = marcarNuevos(DATA.inmuebles);
  $('#meta-fecha').textContent = 'actualizado: '+DATA.fechaActualizacion;
  $('#meta-total').textContent = DATA.total+' inmuebles (rústica+urbana)';
  renderTodo();
}
function renderTodo(){ renderKpis(); renderTops(); renderProvincias(); renderFiltrosProv(); renderDetalle(); setTab(TAB); }
let TAB = 'resumen';
function setTab(t){
  TAB = t;
  $('#tab-resumen').classList.toggle('active', t==='resumen');
  $('#tab-listados').classList.toggle('active', t==='listados');
  $('#view-resumen').hidden = t!=='resumen';
  $('#view-listados').hidden = t!=='listados';
}
$('#tab-resumen').onclick = ()=>setTab('resumen');
$('#tab-listados').onclick = ()=>setTab('listados');

function topCard(x, i){
  return `<div class="card"><div class="top3-head"><span class="rank">Nº ${i}</span><span class="badge ${claseNivel(x.nivel)}">${x.score} · ${x.nivel}</span>${x.nuevo?'<span class="badge b-nuevo">NUEVO</span>':''}</div>
  <b>${esc(x.razon)}</b>
  <div class="muted">${esc(provKey(x.provincia))} · ${esc(x.tipoBien)}${x.tipoDetalle?' · '+esc(x.tipoDetalle):''}</div>
  <div class="top3-nums"><span>Salida <b>${fmtE(x.enajenacion)}</b></span><span>Dto. <b>${(x.dto*100).toFixed(1)}%</b></span><span>Cargas <b>${+x.cargas===0?'Sin carga':fmtE(x.cargas)}</b></span><span>Subasta <b>${esc(x.fechaSubasta)}</b></span></div>
  <ul class="top3-why">${x.razones.slice(0,2).map(r=>`<li>${esc(r)}</li>`).join('')}${x.riesgos.length?`<li class="risk">Riesgo: ${esc(x.riesgos[0])}</li>`:''}</ul>
  <div class="toolbar"><button class="btn sm primary" data-an="${x.id}">Ver análisis</button><a class="btn sm" href="${x.url}" target="_blank" rel="noopener">↗ Ficha oficial</a></div></div>`;
}
function renderTops(){
  const ord = [...ANALIZADOS].sort((a,b)=>b.score-a.score);
  $('#top-general').innerHTML = ord.slice(0,3).map((x,i)=>topCard(x,i+1)).join('') || '<p class="muted">Sin datos.</p>';
  const ali = ord.filter(x=>provKey(x.provincia)==='Alicante');
  $('#top-alicante').innerHTML = ali.slice(0,3).map((x,i)=>topCard(x,i+1)).join('') || '<p class="muted">Sin inmuebles de Alicante en este extracto.</p>';
  document.querySelectorAll('#view-resumen [data-an]').forEach(b=>b.onclick=()=>verAnalisis(+b.dataset.an));
}

function renderKpis(){
  const n = ANALIZADOS.length;
  const nuevos = ANALIZADOS.filter(x=>x.nuevo).length;
  const sinC = ANALIZADOS.filter(x=>+x.cargas===0).length;
  const med = n? ANALIZADOS.reduce((a,x)=>a+(+x.enajenacion||0),0)/n : 0;
  const altas = ANALIZADOS.filter(x=>x.score>=55).length;
  const cobertura = new Set(ANALIZADOS.map(x=>provKey(x.provincia))).size;
  $('#kpis').innerHTML = `
    <div class="kpi"><div class="l">Inmuebles en subasta</div><div class="v">${n}</div><div class="l">${esc(DATA.fechaActualizacion)} · fuente TGSS</div></div>
    <div class="kpi"><div class="l">Cobertura provincial</div><div class="v">${cobertura}/52</div><div class="l">provincias con subasta</div></div>
    <div class="kpi"><div class="l">Nuevos (30 días)</div><div class="v">${nuevos}</div><div class="l">detectados hace ≤30 días</div></div>
    <div class="kpi"><div class="l">Sin cargas</div><div class="v">${sinC}</div><div class="l">${n?Math.round(sinC/n*100):0}% del total</div></div>
    <div class="kpi"><div class="l">Salida media</div><div class="v">${Math.round(med).toLocaleString('es-ES')} €</div><div class="l">tipo de enajenación</div></div>
    <div class="kpi"><div class="l">Oportunidad ≥55</div><div class="v">${altas}</div><div class="l">media-alta y alta</div></div>`;
}
function resumenProv(){
  const m = new Map();
  for(const x of ANALIZADOS){
    const k = provKey(x.provincia);
    if(!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return PROVS.map(([ca, prov])=>{
    const arr = m.get(prov) || [];
    return {
      prov, ca, n:arr.length,
      urb:arr.filter(a=>a.tipoBien.includes('Urbana')).length,
      rus:arr.filter(a=>(a.tipoBien||'').includes('stica')).length,
      medSal:arr.length?arr.reduce((a,x)=>a+(+x.enajenacion||0),0)/arr.length:null,
      medTas:arr.length?arr.reduce((a,x)=>a+(+x.tasacion||0),0)/arr.length:null,
      medDto:arr.length?arr.reduce((a,x)=>a+x.dto,0)/arr.length:null,
      mejor:arr.length?Math.max(...arr.map(a=>a.score)):null,
      nuevos:arr.filter(a=>a.nuevo).length
    };
  }).sort((a,b)=>b.n-a.n);
}
function renderProvincias(){
  const rows = resumenProv();
  const badge = v => v==null ? '<span class="muted">—</span>'
    : `<span class="badge ${v>=75?'b-alta':v>=55?'b-media-alta':v>=40?'b-media':'b-baja'}">${v}</span>`;
  $('tbody', $('#tbl-prov')).innerHTML = rows.map(r=>`<tr>
    <td><b>${esc(r.prov)}</b>${r.nuevos?`<span class="badge b-nuevo">${r.nuevos} nuevo(s)</span>`:''}</td>
    <td class="muted">${esc(r.ca)}</td>
    <td class="num">${r.n}</td><td class="num">${r.urb} / ${r.rus}</td>
    <td class="num">${r.medSal==null?'—':fmtE(r.medSal)}</td><td class="num">${r.medTas==null?'—':fmtE(r.medTas)}</td>
    <td class="num">${r.medDto==null?'—':(r.medDto*100).toFixed(1)+'%'}</td><td>${badge(r.mejor)}</td>
    <td>${r.n?`<button class="btn sm" data-prov="${esc(r.prov)}">Ver</button>`:''}</td></tr>`).join('');
  $$('#tbl-prov [data-prov]').forEach(b=>b.onclick=()=>{ FILTRO_PROV=b.dataset.prov; $('#f-prov').value=FILTRO_PROV; renderDetalle(); window.scrollTo({top:$('#tbl-det').offsetTop-80,behavior:'smooth'}); });
  function $$(s,el=document){return [...el.querySelectorAll(s)];}
}
function renderFiltrosProv(){
  const counts = {};
  ANALIZADOS.forEach(x=>{ const k = provKey(x.provincia); counts[k]=(counts[k]||0)+1; });
  const sel = $('#f-prov'); const cur = FILTRO_PROV || sel.value;
  sel.innerHTML = '<option value="">Todas las provincias</option>'+PROVS.map(([,p])=>
    `<option value="${esc(p)}" ${p===cur?'selected':''}>${esc(p)} (${counts[p]||0})</option>`).join('');
}
function filtrados(){
  let l = [...ANALIZADOS];
  const q = ($('#f-q').value||'').toLowerCase();
  const fp = FILTRO_PROV || $('#f-prov').value;
  const ft = $('#f-tipo').value, fo = $('#f-oport').value;
  if(fp) l = l.filter(x=>provKey(x.provincia)===fp);
  if(ft) l = l.filter(x=>x.tipoBien===ft);
  if(q) l = l.filter(x=>(x.razon+' '+(x.tipoDetalle||'')).toLowerCase().includes(q));
  if($('#f-nuevos').checked) l = l.filter(x=>x.nuevo);
  if($('#f-sincarga').checked) l = l.filter(x=>+x.cargas===0);
  const ftemp = $('#f-temp').value;
  if(ftemp==='prox7'||ftemp==='prox30'||ftemp==='pasadas30'){
    l = l.filter(x=>{
      const d = parseFechaSubasta(x.fechaSubasta); if(!d) return false;
      const dd = Math.round((d-HOY0)/86400000);
      if(ftemp==='prox7') return dd>=0 && dd<=7;
      if(ftemp==='prox30') return dd>=0 && dd<=30;
      return dd<0 && dd>=-30;
    });
  }
  if(fo==='alta') l=l.filter(x=>x.score>=75);
  if(fo==='media-alta') l=l.filter(x=>x.score>=55&&x.score<75);
  if(fo==='media') l=l.filter(x=>x.score>=40&&x.score<55);
  if(fo==='baja') l=l.filter(x=>x.score<40);
  const o = $('#f-orden').value;
  if(o==='score') l.sort((a,b)=>b.score-a.score);
  if(o==='enajenacion') l.sort((a,b)=>a.enajenacion-b.enajenacion);
  if(o==='descuento') l.sort((a,b)=>b.dto-a.dto);
  if(o==='fecha') l.sort((a,b)=>(parseFechaSubasta(a.fechaSubasta)||9e15)-(parseFechaSubasta(b.fechaSubasta)||9e15));
  return l;
}
function renderDetalle(){
  const l = filtrados();
  $('#res-count').textContent = `${l.length} inmuebles · clic en «Análisis» para ver razones y riesgos · el enlace ↗ abre la ficha oficial (requiere sesión TGSS: si caduca, entra primero al buscador oficial).`;
  $('tbody', $('#tbl-det')).innerHTML = l.map(x=>`<tr>
    <td>${x.nuevo?'<span class="badge b-nuevo">NUEVO</span>':''}</td>
    <td>${esc(provKey(x.provincia))}</td><td>${esc(x.tipoBien)}<div class="det">${esc(x.tipoDetalle||'')}</div></td>
    <td><b>${esc(x.razon)}</b><div class="det">Lote ${x.lote} · ID ${x.id}</div><button class="btn sm" data-an="${x.id}">Análisis</button></td>
    <td class="num">${fmtE(x.tasacion)}</td><td class="num">${+x.cargas===0?'Sin carga':fmtE(x.cargas)}</td>
    <td class="num"><b>${fmtE(x.enajenacion)}</b></td><td class="num">${(x.dto*100).toFixed(1)}%</td>
    <td style="white-space:nowrap">${esc(x.fechaSubasta)}</td>
    <td><span class="badge ${claseNivel(x.nivel)}">${x.score} · ${x.nivel}</span></td>
    <td><a href="${x.url}" target="_blank" rel="noopener">↗ ficha</a></td></tr>`).join('') || '<tr><td colspan="11">Sin resultados con esos filtros.</td></tr>';
  $('tbody', $('#tbl-det')).querySelectorAll('[data-an]').forEach(b=>b.onclick=()=>verAnalisis(+b.dataset.an));
}
function verAnalisis(id){
  const x = ANALIZADOS.find(a=>a.id===id); if(!x) return;
  $('#modal-root').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)document.querySelector('#modal-root').innerHTML=''"><div class="modal">
    <h3>${esc(x.razon)} <span class="badge ${claseNivel(x.nivel)}">${x.score} · ${x.nivel}</span>${x.nuevo?'<span class="badge b-nuevo">NUEVO</span>':''}</h3>
    <p class="muted">${esc(provKey(x.provincia))} · ${esc(provCA(provKey(x.provincia)))} · ${esc(x.tipoBien)}${x.tipoDetalle?' · '+esc(x.tipoDetalle):''} · Subasta ${esc(x.fechaSubasta)} (${x.dias??'—'} días)</p>
    ${x.nuevo?`<p><b>Nuevo (30 días):</b> detectado en tu seguimiento ${x.diasVisto===0?'hoy':`hace ${x.diasVisto} días`}.</p>`:''}
    <p><b>Tasación:</b> ${fmtE(x.tasacion)} · <b>Cargas:</b> ${+x.cargas===0?'Sin carga':fmtE(x.cargas)} (${(x.ratioC*100).toFixed(1)}%) · <b>Salida:</b> ${fmtE(x.enajenacion)} · <b>Descuento:</b> ${(x.dto*100).toFixed(1)}%</p>
    <h4>✅ Por qué puede interesar</h4><ul>${x.razones.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>
    ${x.riesgos.length?`<h4>⚠️ Riesgos</h4><ul>${x.riesgos.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:'<p>Sin riesgos críticos detectados en los datos oficiales.</p>'}
    <p><a href="${x.url}" target="_blank" rel="noopener">↗ Abrir ficha oficial del inmueble (ID ${x.id})</a></p>
    <p class="muted">Aviso: el análisis es automático y orientativo. Verifica cargas registrales, descripción detallada, superficie, linderos, URE/expediente y estado físico antes de licitar. Depósito exigido: 25% (sobre cerrado) o 30% (postura verbal).</p>
    <button class="btn primary" onclick="document.querySelector('#modal-root').innerHTML=''">Cerrar</button></div></div>`;
}

// actualizar / importar / exportar
$('#btn-csv').onclick = ()=>{
  const l = filtrados();
  const rows = [['id','nuevo','provincia','ccaa','tipoBien','tipoDetalle','razon','tasacion','cargas','enajenacion','descuento_pct','fechaSubasta','score','nivel','url']];
  l.forEach(x=>rows.push([x.id,x.nuevo?'SI':'NO',provKey(x.provincia),provCA(provKey(x.provincia)),x.tipoBien,x.tipoDetalle,x.razon,x.tasacion,x.cargas,x.enajenacion,(x.dto*100).toFixed(1),x.fechaSubasta,x.score,x.nivel,x.url]));
  const csv = rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'})); a.download='subastas_tgss.csv'; a.click();
};
$('#btn-json').onclick = ()=>$('#file-json').click();
$('#file-json').addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{ try{
    const obj = JSON.parse(r.result); const arr = obj.inmuebles||obj;
    DATA = { fechaActualizacion: obj.fechaActualizacion||HOY_ISO, total: arr.length, inmuebles: arr };
    ANALIZADOS = marcarNuevos(arr);
    $('#meta-fecha').textContent='actualizado: '+DATA.fechaActualizacion+' (archivo cargado)';
    $('#meta-total').textContent=DATA.total+' inmuebles'; renderTodo();
  }catch{ alert('JSON inválido. Usa el formato de datos/inmuebles.json o el generado por el scraper.'); } };
  r.readAsText(f);
});
['f-q','f-prov','f-tipo','f-oport','f-orden','f-temp','f-nuevos','f-sincarga'].forEach(id=>{
  document.addEventListener('input', e=>{ if(e.target&&e.target.id===id){ if(id==='f-prov')FILTRO_PROV=''; renderDetalle(); } });
  document.addEventListener('change', e=>{ if(e.target&&e.target.id===id){ if(id==='f-prov')FILTRO_PROV=''; renderDetalle(); } });
});
$('#btn-actualizar').onclick = async ()=>{
  $('#modal-root').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)document.querySelector('#modal-root').innerHTML=''"><div class="modal">
   <h3>↻ Actualizar datos</h3>
   <p>El portal TGSS usa <b>sesión con cookies</b> y bloquea CORS desde el navegador, por lo que la web oficial no permite lectura directa con <code>fetch</code>.</p>
   <p><b>Opción recomendada (2 min):</b></p>
   <ol><li>Ejecuta <code>node scraper-node.js</code> (requiere Node 18+) o <code>actualizar.ps1</code> en Windows.</li>
   <li>Se regenera <code>datos/inmuebles.json</code> con las 15 páginas oficiales.</li><li>Recarga esta página o usa «Cargar JSON».</li></ol>
   <p><b>Intentar vía proxy CORS ahora</b> (puede fallar si la TGSS bloquea):</p>
   <p><button class="btn" id="btn-try-live">Intentar live-fetch</button> <span id="live-msg" class="muted"></span></p>
   <button class="btn primary" onclick="document.querySelector('#modal-root').innerHTML=''">Cerrar</button></div></div>`;
  $('#btn-try-live').onclick = async ()=>{
    $('#live-msg').textContent = 'intentando… (sesión + 15 páginas)';
    try{
      const r = await fetch('https://corsproxy.io/?url='+encodeURIComponent('https://w6.seg-social.es/subastas/SubaSeControladorInter?opcion=3&avanzada=0'));
      $('#live-msg').textContent = r.ok ? 'proxy responde, pero el flujo completo requiere cookies de sesión: usa el scraper para un resultado fiable.' : 'proxy sin acceso ('+r.status+'). Usa el scraper.';
    }catch(err){ $('#live-msg').textContent = 'bloqueado por CORS/red. Usa node scraper-node.js.'; }
  };
  // guardar snapshot actual como "previo" para detectar nuevos en la próxima carga
  try{ localStorage.setItem('tgss_prev_ids', JSON.stringify(DATA.inmuebles.map(x=>x.id))); }catch{}
};

cargarInicial();
