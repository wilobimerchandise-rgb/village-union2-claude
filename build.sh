#!/bin/sh
# Concatenate parts into app.js (p13 must stay last: it closes the IIFE and calls init()).
cd "$(dirname "$0")"
ORDER="p1 p2 p3 p4 p5 p6 p7 p8 p9 p10 p11 p12 p14 p15 p16 p17 p18 p19 p20 p21 p22 p23 p24 p25 p26 p27 p28 p29 p30 p31 p32 p33 p34 p35 p13"
: > app.js
for p in $ORDER; do [ -f parts/$p.js ] && cat parts/$p.js >> app.js; done
node --check app.js && echo "built app.js ($(wc -c < app.js) bytes)"
# optional minified copy (esbuild): app.min.js
ESB=/opt/npm-tools/node_modules/.bin/esbuild; [ -x "$ESB" ] || ESB=$(command -v esbuild)
[ -n "$ESB" ] && $ESB app.js --minify --target=es2019 --outfile=app.min.js --log-level=error && echo "built app.min.js ($(wc -c < app.min.js) bytes)"
