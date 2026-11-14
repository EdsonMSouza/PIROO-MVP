import json, statistics as st
def res(f):
    r=json.load(open(f)); V,I=r['validos'],r['invalidos']
    inc=[x for x in V+I if x['faltando']]
    gt_nc=sum(1 for v in V if v['gt']['tipoReal']!=v['dados']['tipoResiduo'])
    sit=lambda v: v['resp']['situacaoIA']
    tp=sum(1 for v in V if v['gt']['tipoReal']!=v['dados']['tipoResiduo'] and sit(v)=='nao_conforme')
    pend=sum(1 for v in V if sit(v)=='pendente')
    pend_nc=sum(1 for v in V if sit(v)=='pendente' and v['gt']['tipoReal']!=v['dados']['tipoResiduo'])
    fp=sum(1 for v in V if v['gt']['tipoReal']==v['dados']['tipoResiduo'] and sit(v)=='nao_conforme')
    analis=[v for v in V if sit(v)!='pendente']
    gt_conf_analis=100*sum(1 for v in analis if v['gt']['tipoReal']==v['dados']['tipoResiduo'])/len(analis)
    erros_t=[abs(v['resp']['tempoAtendimentoSeg']-v['gt']['durSeg']) for v in V if v['resp'].get('tempoAtendimentoSeg') is not None]
    lat=r['latencias_ms']
    return dict(tent=len(V)+len(I),aceitos=len(V),incompletos=len(inc),incompletos_bloqueados=sum(1 for x in inc if x['status']!=200),
      protocolos_distintos=r['protocolos_distintos'],colisoes=len(V)-r['protocolos_distintos'],rastreio=r['rastreio_correto'],
      csv=r['csv_linhas_dados'],csv_cols=r['csv_colunas'],csv_quebradas=r['csv_linhas_com_colunas_erradas'],csv_escape_status=r['csv_caso_escape_status'],
      json=r['json_total'],hist=r['n_historico'],pdf=r['pdf_ok'],
      kpi=r['kpis']['taxaConformidade'],kpi_analis=r['kpis']['analisadosIA'],kpi_pend=r['kpis']['pendentesIA'],gt_conf_analisadas=round(gt_conf_analis,1),
      nc_gt=gt_nc,nc_det=tp,nc_em_pendentes=pend_nc,pendentes=pend,fp=fp,
      tempo_medio_kpi=r['kpis']['tempoMedioAtendimentoSeg'],cronometrados=r['kpis']['atendimentosCronometrados'],
      tempo_medio_gt=round(st.mean(v['gt']['durSeg'] for v in V),1),erro_tempo_max_s=round(max(erros_t),2),
      alertas_total=r['alertas_total'],alertas_listados=len(r['alertas']),
      adversariais=r['adversariais'],acesso=r['acesso'],lat_med=round(st.median(lat),1),reinc=r['reincidencia'])
out={'A':res('fixA.json'),'B':res('fixB.json')}
json.dump(out,open('resumo_v23.json','w'),ensure_ascii=False,indent=1)
for k,o in out.items():
    print('=====',k)
    for a,b in o.items(): print(' ',a,':',b)
