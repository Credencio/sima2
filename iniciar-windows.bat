@echo off
chcp 65001 >nul
title Bolsa de Precos SIMA - servidor local
cd /d "%~dp0"
echo.
echo  Bolsa de Precos SIMA
echo  A iniciar o servidor local em http://localhost:8000
echo  Para parar, feche esta janela.
echo.
where py >nul 2>nul && (start "" http://localhost:8000 & py -m http.server 8000 & goto :eof)
where python >nul 2>nul && (start "" http://localhost:8000 & python -m http.server 8000 & goto :eof)
echo  Python nao foi encontrado neste computador.
echo  Instale-o em https://www.python.org/downloads/ (marque "Add python.exe to PATH")
echo  ou abra o ficheiro index.html directamente no navegador.
echo.
pause
