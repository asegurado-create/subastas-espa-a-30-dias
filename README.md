# Subastas TGSS · Inmuebles por provincias + análisis de oportunidad

App 100% operativa, sin backend. Lee la fuente oficial
`https://w6.seg-social.es/subastas/SubaSeControladorInter` (TGSS — Subastas de Bienes Embargados),
genera **tabla resumen por provincias**, **detalle con enlace a cada ficha oficial** y
**análisis de oportunidad** calculado solo con los datos oficiales del inmueble.

## Publicar en GitHub Pages (repo independiente)
Esta carpeta ya es un repo listo: workflow de Pages en `.github/workflows/pages.yml` y `.gitignore`.
```bash
cd subastas-seg-social
git init
git add .
git commit -m "Subastas TGSS: tabla provincial + analisis de oportunidad"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/subastas-seg-social.git
git push -u origin main
```
En GitHub: crea el repo `subastas-seg-social` (vacío, sin README), y en **Settings → Pages → Source** elige **GitHub Actions**.
URL resultante: `https://TU-USUARIO.github.io/subastas-seg-social/`
Cada `git push` a `main` redespliega con los datos de `datos/inmuebles.json` incluidos en el commit.

## Probar en local
Doble clic en `index.html`, o:
```bash
cd subastas-seg-social
python -m http.server 8000
# abrir http://localhost:8000
```
> Nota: abrir por `file://` también funciona, pero algunos navegadores bloquean `fetch` local.
> En ese caso usa el servidor local o el botón «Cargar JSON».

## Actualizar datos (la TGSS actualiza cada semana)
La web oficial exige sesión con cookies (`JSESSIONID`) y no permite `fetch` directo desde el navegador (CORS).
Por eso la app incluye snapshot en `datos/inmuebles.json` (08/10/2026, 297 inmuebles) + scripts de actualización.

**En Windows: haz doble clic en `actualizar.bat`.**
 No hagas doble clic en `scraper-node.js` (Windows lo abre con Windows Script Host y da error `800A03EA`)
 ni directamente en `actualizar.ps1` (puede bloquearse por política de ejecución).

Alternativas manuales:
```bash
node scraper-node.js        # requiere Node 18+, regenera datos/inmuebles.json
# o:
powershell -NoProfile -ExecutionPolicy Bypass -File actualizar.ps1
```
Después recarga la página o usa «Cargar JSON».

Flujo del scraper: `opcion=3` (sesión) → `opcion=10&EMB_TIPOBIEN=0101&0102`
(rústica+urbana) → `opcion=8&tipoOperacion=1` + `pagina=2..15` (20 resultados/página).

## Qué incluye
- Pestaña **Resumen**: KPIs + **Top 3 oportunidades del listado general** y **Top 3 de Alicante**, con acceso directo a la ficha oficial y al análisis de cada inmueble.
- Resumen por las 52 provincias (con 0 y CCAA donde la TGSS no publica nada): nº, urbanas/rústicas, medias, descuento medio, mejor score. Clic «Ver» filtra.
- Detalle filtrable (provincia, tipo, texto, oportunidad, ventana temporal por fecha de subasta, nuevos, sin cargas) y ordenable.
- Espectro temporal de 30 días: filtro por fecha de subasta (próximos 30/7 días, celebradas últimos 30 días) y marca NUEVO persistente por inmueble (detectado hace ≤30 días, guardado en el navegador).
- Enlace ↗ a la ficha oficial de cada inmueble (`opcion=13&EMB_ID=…`).
  Si la TGSS muestra «Se ha perdido la sesión», entra primero al [buscador oficial](https://w6.seg-social.es/subastas/SubaSeControladorInter) y reintenta.
- Análisis por inmueble: score 0-100, nivel (Alta/Media-Alta/Media/Baja), razones y riesgos,
  con fórmula documentada en la propia app. Exportación a CSV.
- Detección de «NUEVO»: cada inmueble guarda su fecha de primera detección en tu navegador; se marca NUEVO si fue detectado hace ≤30 días. Al cargar un JSON nuevo, los IDs no vistos se sellan con la fecha actual.

## Metodología del score (transparente, solo datos oficiales)
`50 + min(48, dto×60)` ± cargas (±12/±6/0/−15/−25) ± ticket (±8/+5/−5) + urbana +3 ± fecha (+3/−5),
capado 0-100. Las cargas subsisten y las asume el adjudicatario: una salida barata con 85% de cargas
no es la misma oportunidad que la misma salida sin cargas.

Aviso: análisis orientativo. Verificar siempre ficha detallada (descripción, superficie,
linderos, registro, URE/expediente), cargas registrales y estado físico en la Dirección Provincial.
Depósito: 25% (sobre cerrado) / 30% (verbal).
