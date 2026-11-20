#!/bin/bash
# gen/run.sh <name> <seed> [restarts] [climb] [maxSec]
cd "$(dirname "$0")/.."
CFG=$(node -e "const c=require('./gen/cfgs.js')['$1'];c.maxSec=+('${5:-200}');console.log(JSON.stringify(c))")
node gen_long.js "$CFG" "$2" "${3:-150}" "${4:-2000}" "gen/$1_s$2.json" > "gen/$1_s$2.log" 2>&1
echo "$1 s$2 done: $(grep -o '"moves":[0-9]*' gen/$1_s$2.log | head -1)"
