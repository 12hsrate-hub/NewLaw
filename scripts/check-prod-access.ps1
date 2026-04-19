param(
    [string]$HostAlias = "newlaw-prod"
)

$command = "hostname && whoami && pwd"
ssh -o BatchMode=yes -o ConnectTimeout=10 $HostAlias $command
