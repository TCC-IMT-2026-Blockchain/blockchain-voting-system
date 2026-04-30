param(
  [string]$ElectionId = "ELEICAO_001"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

python "$ScriptDir\votify.py" audit --election-id $ElectionId --output "audit-$ElectionId.json"
