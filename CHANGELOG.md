# PIROO-MVP v2.3.0 (13/11/2026)

Correções derivadas da verificação funcional com dados sintéticos (relatório-piloto, 13/11/2026).
Versão anterior preservada em `index_v2.2.0_antes_correcoes.js` e `frontend/src/App_v2.2.0_antes_correcoes.js`.

## Backend (`index.js`)

1. **Protocolo único.** O número de 6 dígitos é sorteado e conferido contra o histórico antes da gravação, no mesmo trecho síncrono, sem risco de repetição por concorrência. Formato preservado para QR Code e consulta pública.
2. **Validação no servidor.** O check-in só é aceito com unidade, transportador, placa vinculada ao transportador, gerador e operador cadastrados e ativos; tipo de resíduo da lista controlada; peso maior que zero; e fotografia anexada. Os IDs de transportador e gerador passam a ser definidos pelo servidor. Imagem de registro rejeitado é descartada.
3. **Situação da análise por IA.** Novo campo `situacaoIA` (`conforme`, `nao_conforme`, `pendente`). Falha da IA gera alerta `IA_PENDENTE` e não entra na taxa de conformidade, cujo denominador passa a ser o número de cargas analisadas. Registros antigos são interpretados pelo texto da análise.
4. **Tempo de atendimento.** Campo opcional `inicioAtendimento` enviado pela tela; o servidor grava `tempoAtendimentoSeg` (0 a 4 horas). Painel e relatório de descargas passam a informar tempo médio, desvio padrão e número de atendimentos cronometrados.
5. **CSV.** Todos os campos entre aspas, com escape; novas colunas `Situacao_IA`, `Tempo_Atendimento_s` e `Observacao`.
6. **Alertas.** Paginação por `?limite` (padrão 100, máximo 1000) e `?offset`; total no cabeçalho `X-Total-Count`.
7. Indicadores de conformidade do PDF, do painel e das descargas unificados (`analisadosIA`, `naoConformesIA`, `pendentesIA`).

## Frontend (`src/App.js`, `src/App.css`, build em `backend/frontend-build`)

1. Envio de `inicioAtendimento` (primeira interação com o formulário de entrada).
2. Mensagem com os motivos quando o servidor recusa o registro.
3. Selo `PENDENTE` quando a IA não concluiu a análise; corrigido o selo do Inventário, que marcava como não conforme qualquer parecer contendo a palavra "não".
4. Card "Tempo Médio de Check-in" no painel; cards de conformidade mostram cargas analisadas e pendentes.
5. Removida da tela de login a exibição da credencial padrão.

## Fora do escopo desta versão

Autenticação no servidor (o MVP pressupõe rede interna confiável), checklist configurável, taxonomia de motivos de reprovação, modo offline (PWA).
