$ErrorActionPreference = 'Stop'
$workspace = Resolve-Path (Join-Path $PSScriptRoot '../..')
$toolsDirectory = Join-Path $workspace '.tools'
$driverDirectory = Join-Path $toolsDirectory 'edge-webdriver'
$programFilesX86 = ${env:ProgramFiles(x86)}
$locations = @(
    (Join-Path $programFilesX86 'Microsoft/EdgeWebView/Application')
    (Join-Path $env:LOCALAPPDATA 'Microsoft/EdgeWebView/Application')
)

$runtime = Get-ChildItem -LiteralPath $locations -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' -and (Test-Path (Join-Path $_.FullName 'msedgewebview2.exe')) } |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1
if (-not $runtime) { throw 'Microsoft Edge WebView2 Runtime was not found.' }

$driver = Join-Path $driverDirectory 'msedgedriver.exe'
if (Test-Path $driver) {
    if ((& $driver --version | Select-Object -First 1) -match [regex]::Escape($runtime.Name)) {
        Write-Output $driver
        exit 0
    }
}

New-Item -ItemType Directory -Path $driverDirectory -Force | Out-Null
$archive = Join-Path $toolsDirectory 'edge-webdriver.zip'
$uri = "https://msedgedriver.microsoft.com/$($runtime.Name)/edgedriver_win64.zip"
Invoke-WebRequest -Uri $uri -UseBasicParsing -OutFile $archive -TimeoutSec 60
Expand-Archive -LiteralPath $archive -DestinationPath $driverDirectory -Force
Write-Output $driver
