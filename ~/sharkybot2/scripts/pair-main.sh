#!/data/data/com.termux/files/usr/bin/bash
# Limpia sesion del PRINCIPAL y pide codigo FIJO SHAR-KNEX
set -e
cd "$(dirname "$0")/.."
echo "Borrando session del bot principal..."
rm -rf session
NUM="${1:-${PAIRING_NUMBER:-}}"
if [ -z "$NUM" ]; then
  echo "Uso: bash scripts/pair-main.sh 584XXXXXXXXX"
  echo "  o export PAIRING_NUMBER=584XXXXXXXXX"
  exit 1
fi
export PAIRING_NUMBER="$NUM"
echo "Arrancando con PAIRING_NUMBER=$NUM"
echo "Cuando salga el codigo, en el telefono escribe: SHAR-KNEX"
exec bash start.sh
