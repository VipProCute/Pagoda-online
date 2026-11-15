# Ky Dai: render thu mot san (704x352) bang Blender khong giao dien, chi in cac dong can xem.
# Dung: powershell -ExecutionPolicy Bypass -File tools/blender/kydao/thu-san.ps1 <ma san> [chess|xiangqi] [final]
# Anh thu ghi o assets-src/prev/<ma san>/prev-<ma san>-<bien the>.png (khong commit).
# Them "final": render ban cuoi ca hai bien the vao public/img/kydao/fields2/ (mat vai phut).
# (File nay chi dung ky tu ASCII vi PowerShell 5.1 doc sai dau tieng Viet khi khong co BOM.)
param([Parameter(Mandatory = $true)][string]$Field, [string]$Variant = 'chess', [string]$Mode = 'prev')
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$blender = if ($env:BLENDER) { $env:BLENDER } else { 'H:\blender.exe' }
if ($Field -notmatch '^[a-z0-9_]+$') { Write-Output 'Ma san khong hop le'; exit 2 }
if (-not (Test-Path $blender)) { Write-Output "Khong thay Blender o $blender : dat bien moi truong BLENDER"; exit 1 }
$out = Join-Path $repo ("assets-src\prev\" + $Field)
New-Item -ItemType Directory -Force $out | Out-Null
if ($Mode -eq 'final') { $Variant = 'both' }
$lines = & $blender -b --factory-startup -P (Join-Path $repo 'tools\blender\kydao\field2.py') -- $repo $Field $Variant $Mode $out 2>&1 | ForEach-Object { "$_" }
$keep = $lines | Where-Object { $_ -match '^RESULT|Traceback|Error|File ".*line \d+|SystemExit|Thieu|Khong thay|Thi.u|Kh.ng th.y' -and $_ -notmatch 'HIPEW' }
if ($keep) { $keep | Select-Object -Last 25 } else { $lines | Select-Object -Last 12 }
if (-not ($lines | Where-Object { $_ -match '^RESULT' })) { exit 1 }
