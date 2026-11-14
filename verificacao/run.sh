#!/bin/bash
APP=${APP:?defina APP}; KIT=${KIT:?defina KIT}
# uso: run.sh <dir_dados> <porta> [arquivo index]
D=${1:?informe a pasta de execucao}; P=${2:?informe a porta}; IDX=${3:-index.js}
rm -rf $D && mkdir -p $D && cd $D
ln -s $APP/node_modules node_modules
cp $APP/$IDX index.js
PORT=$P GEMINI_API_KEY=stub node --require $KIT/stub.js index.js > server.out 2>&1 &
echo $! > pid
for i in $(seq 1 30); do curl -s localhost:$P/api/ping >/dev/null && break; sleep 0.5; done
curl -s localhost:$P/api/ping | head -c 200; echo
