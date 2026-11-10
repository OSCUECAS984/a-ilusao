#!/usr/bin/env sh
# Junta as partes de src/ no arquivo único index.html (o jogo que se abre no navegador).
set -e
cd "$(dirname "$0")"
{
  cat src/01-interface.html \
      src/02-nucleo-e-sprites.js \
      src/03-mapas.js \
      src/04-audio-entrada-ui.js \
      src/05-cenas-e-laco.js
  printf '\n</script>\n'
} > index.html
echo "index.html gerado a partir de src/"
