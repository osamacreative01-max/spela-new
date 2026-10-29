# Regenerates js\textures.js from assets\tex\label-*.jpg
# WebGL file:// pages par local images upload nahi kar sakta (SecurityError),
# isliye can labels data: URL ke roop mein embed karte hain.
# assets\tex\ = web ke liye resized (1200 px wide) copies; asli full-res
# artwork assets\label-*.jpg mein rehta hai.
# Run:  powershell -ExecutionPolicy Bypass -File make-textures.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path $root 'js\textures.js'

$map = [ordered]@{
  'assets/tex/label-pinkgin.jpg' = 'assets\tex\label-pinkgin.jpg'
  'assets/tex/label-rum.jpg'     = 'assets\tex\label-rum.jpg'
  'assets/tex/label-whisky.jpg'  = 'assets\tex\label-whisky.jpg'
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('/* AUTO-GENERATED FILE - do not edit by hand.')
[void]$sb.AppendLine('   Regenerate after changing a label:')
[void]$sb.AppendLine('   powershell -ExecutionPolicy Bypass -File make-textures.ps1')
[void]$sb.AppendLine('   (WebGL cannot upload file:// images, so labels are embedded as data: URLs.) */')
[void]$sb.AppendLine('window.SEPELA_TEX = {')
$first = $true
foreach ($k in $map.Keys) {
  $path = Join-Path $root $map[$k]
  if (-not (Test-Path $path)) { throw "Missing label: $path" }
  $bytes = [IO.File]::ReadAllBytes($path)
  $b64 = [Convert]::ToBase64String($bytes)
  $comma = if ($first) { '' } else { ',' }
  $first = $false
  [void]$sb.AppendLine("$comma`"$k`": `"data:image/jpeg;base64,$b64`"")
}
[void]$sb.Append('};')

[IO.File]::WriteAllText($out, $sb.ToString(), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("wrote {0} ({1:N0} bytes)" -f $out, (Get-Item $out).Length)
