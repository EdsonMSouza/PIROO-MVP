# Kit de verificação funcional do PIROO-MVP (dados sintéticos)

Requisitos: Node.js 18+, Python 3 com `requests` e um shell bash (no Windows, Git Bash ou WSL). Use caminhos absolutos em `APP` e `KIT`.

1. Copie a pasta `backend` do PIROO para um diretório de teste (sem o `.env`) e rode `npm ci`.
2. Opcional, para cargas grandes: na cópia de teste, eleve os limites `max: 15` e `max: 120` do rate limit.
3. Defina `APP` (pasta do backend de teste) e `KIT` (esta pasta) e suba o servidor com a IA simulada:
   `STUB_ACCURACY=1 STUB_FAIL_RATE=0 ./run.sh ./execA 3201`
4. Rode a bateria: `python harness.py 3201 3000 resA.json 7`
5. Repita com `STUB_ACCURACY=0.9 STUB_FAIL_RATE=0.2` na porta 3202 (`resB.json`, 1000 tentativas, semente 13).
6. `python analisar.py` gera `resumo.json` e imprime os resultados.

`stub.js` substitui a chamada ao Gemini: o rótulo verdadeiro de cada carga vai embutido na imagem sintética.
Nenhum dado real é usado. Resultados de 13/11/2026 em `resumo.json`.

## Versão 2.3.0

Para o backend corrigido, use `harness_v23.py` (envia o início do atendimento e testa o escape do CSV) e `analisar_v23.py`, que lê `fixA.json` e `fixB.json` e gera `resumo_v23.json`. Mesmas sementes e parâmetros dos cenários A e B.
