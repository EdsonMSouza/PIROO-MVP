import json, statistics as st, math, sys
def resumo(f, label):
    r = json.load(open(f))
    V, I = r['validos'], r['invalidos']
    tent = len(V) + len(I)
    incompletos = [x for x in V + I if x['faltando']]
    bloqueados = [x for x in I if x['faltando']]
    aceitos_incompletos = [x for x in V if x['faltando']]
    por_campo = {}
    for x in incompletos:
        c = x['faltando']; por_campo.setdefault(c, [0, 0]); por_campo[c][0] += 1
        if x['status'] != 200: por_campo[c][1] += 1
    # gabarito de conformidade
    gt_nc = sum(1 for v in V if v['gt']['tipoReal'] != v['dados']['tipoResiduo'])
    ia_nc = sum(1 for v in V if 'conformidade: não' in v['resp']['analiseIA'].lower())
    ia_erro = sum(1 for v in V if v['resp']['analiseIA'].startswith('Erro'))
    gt_conf_rate = 100 * (1 - gt_nc / len(V))
    # matriz IA vs gabarito
    tp = sum(1 for v in V if v['gt']['tipoReal'] != v['dados']['tipoResiduo'] and 'conformidade: não' in v['resp']['analiseIA'].lower())
    fn = gt_nc - tp
    fn_por_erro = sum(1 for v in V if v['gt']['tipoReal'] != v['dados']['tipoResiduo'] and v['resp']['analiseIA'].startswith('Erro'))
    n = len(V); D = 900000
    exp_coll = n * (n - 1) / (2 * D)
    lat = r['latencias_ms']
    q = lambda p: sorted(lat)[int(p * (len(lat) - 1))]
    dec = len(lat) // 10
    out = dict(
        cenario=label, tentativas=tent, aceitos=len(V), rejeitados=len(I),
        incompletos=len(incompletos), incompletos_bloqueados=len(bloqueados), incompletos_aceitos=len(aceitos_incompletos),
        por_campo=por_campo,
        com_evidencia=sum(1 for v in V if v['resp'].get('fotoUrl')),
        protocolos_distintos=r['protocolos_distintos'], colisoes=len(V) - r['protocolos_distintos'],
        colisoes_esperadas_teoria=round(exp_coll, 2),
        rastreio_correto=r['rastreio_correto'], rastreio_pct=round(100 * r['rastreio_correto'] / n, 2),
        csv=r['csv_linhas_dados'], csv_quebradas=r['csv_linhas_com_colunas_erradas'], json=r['json_total'], hist=r['n_historico'],
        pdf_ok=r['pdf_ok'], pdf_bytes=r['pdf_bytes'],
        conf_gabarito=round(gt_conf_rate, 1), conf_kpi_sistema=r['kpis']['taxaConformidade'],
        nc_gabarito=gt_nc, nc_detectadas=tp, nc_nao_detectadas=fn, nc_perdidas_por_falha_ia=fn_por_erro, falhas_ia=ia_erro,
        alertas=len(r['alertas']),
        lat_med=round(st.median(lat), 1), lat_p95=round(q(.95), 1),
        lat_primeiro_decil=round(st.median(lat[:dec]), 1), lat_ultimo_decil=round(st.median(lat[-dec:]), 1),
        adversariais=r['adversariais'], acesso=r['acesso'], reincidencia=r['reincidencia'])
    return out
A = resumo('resA.json', 'A: IA ideal (acurácia 100%, sem falhas), 3.000 tentativas')
B = resumo('resB.json', 'B: IA com acurácia 90% e 20% de falhas, 1.000 tentativas')
json.dump([A, B], open('resumo.json', 'w'), ensure_ascii=False, indent=1)
for o in (A, B):
    print('\n=====', o['cenario'])
    for k, v in o.items():
        if k not in ('cenario',): print(k, ':', v)
# probabilidade de colisão por horizonte operacional
print('\nP(>=1 colisão) por volume acumulado:')
for n in [100, 500, 1000, 1500, 3000, 10000, 36000]:
    print(n, round(1 - math.exp(-n * (n - 1) / (2 * 900000)), 3))
