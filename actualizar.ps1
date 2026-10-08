# Actualizador TGSS (Windows PowerShell 5.1+) — genera datos\inmuebles.json
# Uso: doble clic en actualizar.bat (mantiene la ventana abierta y guarda actualizar.log).
try {
  $ErrorActionPreference = 'Stop'
  # TLS 1.2: en PS 5.1 el valor por defecto puede ser TLS 1.0 y w6.seg-social.es lo rechaza.
  try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}
  $base = 'https://w6.seg-social.es'
  $dst = Join-Path $PSScriptRoot 'datos\inmuebles.json'
  Write-Output '1/4 sesion...'
  $s1 = Invoke-WebRequest -Uri "$base/subastas/SubaSeControladorInter?opcion=3&avanzada=0" -SessionVariable sess -UseBasicParsing -TimeoutSec 30
  if($s1.Content -match 'P.GINA DE ERROR|perdido la sesi.n') { throw 'La TGSS devolvio pagina de error en el paso de sesion (opcion=3). Reintenta en 1 minuto.' }
  Write-Output '2/4 ambito (rustica+urbana)...'
  $s2 = Invoke-WebRequest -Uri "$base/subastas/SubaSeControladorInter?opcion=10&EMB_TIPOBIEN=0101&EMB_TIPOBIEN=0102" -WebSession $sess -UseBasicParsing -TimeoutSec 30
  if($s2.Content -match 'P.GINA DE ERROR|perdido la sesi.n') { throw 'Sesion TGSS perdida en opcion=10. Reintenta en 1 minuto.' }
  function Parse-Euro($s){ if($s -match 'Sin Carga'){return 0}; $t=($s -replace '[^\d,\.]','' -replace '\.','' -replace ',','.'); if($t -eq ''){return $null}; return [double]$t }
  function Num($v){ if($null -eq $v){ return 'null' }; return ([string]$v -replace ',','.') }
  $items=@()
  for($p=1;$p -le 15;$p++){
    if($p -eq 1){$url="$base/subastas/SubaSeControladorInter?opcion=8&tipoOperacion=1"}else{$url="$base/subastas/SubaSeControladorInter?pagina=$p&opcion=8&tipoOperacion=1"}
    Write-Output "3/4 pagina $p de 15 ..."
    $r = Invoke-WebRequest -Uri $url -WebSession $sess -UseBasicParsing -TimeoutSec 30
    if($r.Content -match 'P.GINA DE ERROR|perdido la sesi.n') { throw "Sesion TGSS caducada en pagina $p. Reintenta en 1 minuto." }
    $html = $r.Content
    $tables=[regex]::Matches($html,'(?s)<table.*?</table>')
    foreach($tm in $tables){
      $t=$tm.Value; $cap=[regex]::Match($t,'<caption>(.*?)</caption>').Groups[1].Value.Trim()
      $tipoBien='';$prov=''; if($cap -match '^(.*?)\s*-\s*(.*?)\s*-\s*\('){$tipoBien=$Matches[1].Trim();$prov=$Matches[2].Trim()}
      foreach($rm in [regex]::Matches($t,'(?s)<tr.*?</tr>')){
        $row=$rm.Value; if($row -match '<th'){continue}
        $ml=[regex]::Match($row,'opcion=13.*?EMB_ID=(\d+).*?>(.*?)</a>'); if(-not $ml.Success){continue}
        $tds=[regex]::Matches($row,'(?s)<td.*?>(.*?)</td>')
        if($tds.Count -lt 7){continue}
        $tipoDet=(($tds[1].Groups[1].Value -replace '<.*?>','').Trim() -replace '\s+',' ')
        if($tipoDet -eq '-'){ $tipoDet='' }
        $tas=(($tds[2].Groups[1].Value -replace '<.*?>','').Trim()); $car=(($tds[3].Groups[1].Value -replace '<.*?>','').Trim())
        $lote=(($tds[4].Groups[1].Value -replace '<.*?>','').Trim()); $ena=(($tds[5].Groups[1].Value -replace '<.*?>','').Trim()); $fec=(($tds[6].Groups[1].Value -replace '<.*?>','').Trim())
        $ln=([regex]::Match($lote,'(\d+)')).Groups[1].Value
        $loteNum = 1; if($ln){ $loteNum = [int]$ln }
        $items+=[pscustomobject]@{id=[int]$ml.Groups[1].Value; razon=($ml.Groups[2].Value.Trim() -replace '\s+',' '); tipoBien=$tipoBien; tipoDetalle=$tipoDet; provincia=$prov; tasacion=(Parse-Euro $tas); cargas=(Parse-Euro $car); lote=$loteNum; enajenacion=(Parse-Euro $ena); fechaSubasta=$fec; url="https://w6.seg-social.es/subastas/SubaSeControladorInter?opcion=13&EMB_ID=$($ml.Groups[1].Value)&opcion2=1&tipoOperacion=1"}
      }
    }
  }
  $uniq=$items | Sort-Object id -Unique
  if(-not $uniq -or $uniq.Count -eq 0) { throw '0 inmuebles extraidos: la TGSS devolvio paginas sin resultados. No se sobrescribe el JSON. Reintenta en 1 minuto.' }
  $Iacute=[char]0xCD; $Aacute=[char]0xC1; $Oacute=[char]0xD3; $Eacute=[char]0xC9; $Uacute=[char]0xDA; $Ntilde=[char]0xD1
  foreach($it in $uniq){
    $p = [string]$it.provincia
    $p = $p -replace 'ALMER.A',('ALMER'+$Iacute+'A')
    $p = $p -replace 'ARABA/.LAVA',('ARABA/'+$Aacute+'LAVA')
    $p = $p -replace 'C.CERES',('C'+$Aacute+'CERES')
    $p = $p -replace 'C.DIZ',('C'+$Aacute+'DIZ')
    $p = $p -replace 'C.RDOBA',('C'+$Oacute+'RDOBA')
    $p = $p -replace 'JA.N',('JA'+$Eacute+'N')
    $p = $p -replace 'LE.N',('LE'+$Oacute+'N')
    $p = $p -replace 'M.LAGA',('M'+$Aacute+'LAGA')
    $p = $p -replace 'VAL.NCIA/VALENCIA','VALENCIA'
    $it.provincia = $p
    if($it.tipoBien -like 'Finca R*'){ $it.tipoBien = 'Finca R'+$Uacute+'stica' }
    if($it.tipoDetalle -match '^VI.A$'){ $it.tipoDetalle = 'VI'+$Ntilde+'A' }
    if($it.tipoDetalle -eq 'REGADIO' -or $it.tipoDetalle -eq 'REGADIDO'){ $it.tipoDetalle = 'REGAD'+$Iacute+'O' }
  }
  # JSON manual: ConvertTo-Json de PS 5.1 envuelve el array en {"value":...,"Count":...}; se escribe a mano.
  function Q($s){ if($null -eq $s){ return '""' }; return '"' + ([string]$s -replace '\\','\\' -replace '"','\"' -replace "`r",'' -replace "`n",' ') + '"' }
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append('{"fuente":"TGSS - Subastas de Bienes Embargados (w6.seg-social.es)","fechaActualizacion":"')
  [void]$sb.Append((Get-Date).ToString('yyyy-MM-dd'))
  [void]$sb.Append('","total":'); [void]$sb.Append($uniq.Count)
  [void]$sb.Append(',"tiposIncluidos":["Finca R'); [void]$sb.Append($Uacute); [void]$sb.Append('stica (0101)","Finca Urbana (0102)"],"inmuebles":[')
  $first=$true
  foreach ($it in $uniq) {
    if(-not $first){ [void]$sb.Append(',') }; $first=$false
    [void]$sb.Append('{"id":'); [void]$sb.Append($it.id)
    [void]$sb.Append(',"razon":'); [void]$sb.Append((Q $it.razon))
    [void]$sb.Append(',"tipoBien":'); [void]$sb.Append((Q $it.tipoBien))
    [void]$sb.Append(',"tipoDetalle":'); [void]$sb.Append((Q ([string]$it.tipoDetalle)))
    [void]$sb.Append(',"provincia":'); [void]$sb.Append((Q $it.provincia))
    [void]$sb.Append(',"tasacion":'); [void]$sb.Append((Num $it.tasacion))
    [void]$sb.Append(',"cargas":'); [void]$sb.Append((Num $it.cargas))
    [void]$sb.Append(',"lote":'); [void]$sb.Append($it.lote)
    [void]$sb.Append(',"enajenacion":'); [void]$sb.Append((Num $it.enajenacion))
    [void]$sb.Append(',"fechaSubasta":'); [void]$sb.Append((Q $it.fechaSubasta))
    [void]$sb.Append(',"url":'); [void]$sb.Append((Q $it.url))
    [void]$sb.Append('}')
  }
  [void]$sb.Append(']}')
  # Copia de seguridad del JSON anterior antes de sobrescribir.
  if(Test-Path $dst){ Copy-Item $dst "$dst.bak" -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  [System.IO.File]::WriteAllText($dst, $sb.ToString(), (New-Object System.Text.UTF8Encoding $false))
  Write-Output "4/4 OK: $($uniq.Count) inmuebles -> $dst"
  exit 0
} catch {
  Write-Output ('ERROR: ' + $_.Exception.Message)
  exit 1
}
