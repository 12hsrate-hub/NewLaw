param(
    [string]$HostAlias = "newlaw-prod",
    [string]$Domain = "lawyer5rp.ru"
)

$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
    param(
        [string]$Step
    )

    if ($LASTEXITCODE -ne 0) {
        throw "Deployment failed at step: $Step"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$siteDir = Join-Path $repoRoot "site"
$nginxConfigPath = Join-Path $repoRoot "deploy/nginx/newlaw.conf"
$siteItems = Get-ChildItem -Force $siteDir

if (-not (Test-Path $nginxConfigPath)) {
    throw "Nginx config not found: $nginxConfigPath"
}

if ($siteItems.Count -eq 0) {
    throw "Site directory is empty: $siteDir"
}

Write-Host "Preparing remote directories on $HostAlias..."
& ssh -o BatchMode=yes $HostAlias "mkdir -p /srv/newlaw/site /etc/nginx/sites-available /etc/nginx/sites-enabled"
Assert-LastExitCode "prepare remote directories"

Write-Host "Uploading site files..."
& scp -r $siteItems.FullName "${HostAlias}:/srv/newlaw/site/"
Assert-LastExitCode "upload site files"

Write-Host "Uploading nginx config..."
& scp $nginxConfigPath "${HostAlias}:/etc/nginx/sites-available/newlaw.conf"
Assert-LastExitCode "upload nginx config"

Write-Host "Applying nginx configuration..."
$remoteCommand = @"
ln -sfn /etc/nginx/sites-available/newlaw.conf /etc/nginx/sites-enabled/newlaw.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
curl -kI https://127.0.0.1
curl -I http://127.0.0.1 -H 'Host: $Domain'
"@

& ssh -o BatchMode=yes $HostAlias $remoteCommand
Assert-LastExitCode "apply nginx configuration"

Write-Host "Running public smoke-check..."
$response = Invoke-WebRequest -UseBasicParsing "https://$Domain" -TimeoutSec 20
Write-Host "Deployment complete. Public status:" $response.StatusCode
