#!/bin/sh
# Bolsa de Preços SIMA — servidor local (macOS / Linux)
cd "$(dirname "$0")" || exit 1
PORT=8000
URL="http://localhost:$PORT"
echo ""
echo " Bolsa de Preços SIMA"
echo " A iniciar o servidor local em $URL  (Ctrl+C para parar)"
echo ""
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else echo " Python não encontrado. Abra o ficheiro index.html directamente no navegador."; exit 1; fi
( sleep 1; (command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") ) &
exec "$PY" -m http.server "$PORT"
