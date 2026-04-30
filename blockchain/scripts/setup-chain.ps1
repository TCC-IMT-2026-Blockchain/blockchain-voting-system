param(
  [string]$ElectionSupply = "100"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlockchainDir = Split-Path -Parent $ScriptDir

python "$ScriptDir\votify.py" up
python "$ScriptDir\votify.py" authorize-slave
python "$ScriptDir\votify.py" setup --initial-supply $ElectionSupply
