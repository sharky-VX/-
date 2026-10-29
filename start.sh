#!/usr/bin/env bash
# Mantiene el bot vivo: si se cae o usas .restart, vuelve a iniciar solo.
# Se detiene con Ctrl+C o si el bot reporta un error fatal (sesión cerrada / otra instancia).
cd "$(dirname "$0")"
while true; do
  node index.js
  code=$?
  case $code in
    2|130|143) echo "⛔ Bot detenido (código $code)."; break ;;
  esac
  echo "♻️ Reiniciando en 3 segundos... (Ctrl+C para salir)"
  sleep 3
done
