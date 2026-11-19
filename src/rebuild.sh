#!/bin/bash
# Regenerate art + project, check levels, export HTML5.  Usage: src/rebuild.sh [--art]
set -e
cd "$(dirname "$0")"
node solve.js > /dev/null || { echo "level check failed"; node solve.js; exit 1; }
if [ "$1" == "--art" ]; then python3 gen_art.py ../project/assets; fi
python3 build_project.py
rm -rf ../html5
(cd /workspace/tools/gdexp && npx gdexport -p /workspace/phantom-photon/project/game.json -o /workspace/phantom-photon/html5 -v v5.6.285 >/dev/null)
python3 patch_html.py ../html5
echo built
