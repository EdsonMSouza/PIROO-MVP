"""Bateria de testes do PIROO-MVP com dados sintéticos.
Uso: python harness.py <porta> <n_checkins> <saida.json> [seed]
O gabarito (tipo real, materiais proibidos, segurança) é embutido na imagem e lido pelo stub da IA.
"""
import sys, json, time, random, statistics, csv, io
import requests

PORT, N, OUT = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
SEED = int(sys.argv[4]) if len(sys.argv) > 4 else 7
rng = random.Random(SEED)
B = f'http://localhost:{PORT}/api'

meta = requests.get(f'{B}/homologados').json()
ops = requests.get(f'{B}/operadores').json()
TIPOS = meta['tiposResiduo']
TRANSP = meta['transportadores']
GER = meta['geradores']
UNID = meta['unidades']
# perfil de risco: um transportador e um gerador com não conformidade elevada (gabarito)
BAD_T, BAD_G = TRANSP[0]['id'], GER[0]['id']
PESO = {'Alvenaria/Entulho': (4000, 12000), 'Madeira': (500, 3000), 'Plástico/Reciclável': (200, 1500),
        'Poda': (300, 2500), 'Misturado': (1000, 8000), 'Gesso': (500, 4000)}


def img(gt):
    return b'\xff\xd8\xff\xe0' + bytes(rng.getrandbits(8) for _ in range(256)) + b'PIROO_GT' + \
        json.dumps(gt).encode() + b'END\xff\xd9'


def gerar_carga(i):
    t = rng.choice(TRANSP); g = rng.choice(GER)
    real = rng.choice(TIPOS)
    p_div = 0.35 if (t['id'] == BAD_T or g['id'] == BAD_G) else 0.08
    declarado = rng.choice([x for x in TIPOS if x != real]) if rng.random() < p_div else real
    lo, hi = PESO[real]
    gt = {'tipoReal': real, 'pesoReal': rng.randint(lo, hi),
          'proibido': 'Inflamáveis' if rng.random() < 0.02 else None,
          'segurancaOk': rng.random() > 0.05}
    dados = dict(unidade=rng.choice(UNID), usuario=rng.choice(ops)['nome'], transportador=t['nome'],
                 transportadorId=str(t['id']), placa=rng.choice(t['placas']), gerador=g['nome'],
                 geradorId=str(g['id']), tipoResiduo=declarado, peso=str(gt['pesoReal']), observacao='')
    return dados, gt


res = {'validos': [], 'invalidos': [], 'adversariais': [], 'latencias_ms': []}

# ---------- 1. Carga principal com 10% de registros incompletos (simula falha de preenchimento)
CAMPOS = ['unidade', 'transportador', 'placa', 'gerador', 'tipoResiduo', 'peso', 'usuario']
for i in range(N):
    dados, gt = gerar_carga(i)
    faltando = None
    if rng.random() < 0.10:
        faltando = rng.choice(CAMPOS)
        dados[faltando] = ''
    t0 = time.perf_counter()
    r = requests.post(f'{B}/checkin', data=dados, files={'imagem': ('carga.jpg', img(gt), 'image/jpeg')})
    ms = (time.perf_counter() - t0) * 1000
    reg = {'i': i, 'status': r.status_code, 'faltando': faltando, 'gt': gt, 'dados': dados, 'ms': ms}
    if r.status_code == 200:
        reg['resp'] = r.json(); res['latencias_ms'].append(ms); res['validos'].append(reg)
    else:
        reg['resp'] = r.json(); res['invalidos'].append(reg)

# ---------- 2. Casos adversariais (cada um deveria ser rejeitado segundo a especificação)
base, gt = gerar_carga(-1)
casos = {
    'peso_negativo': {**base, 'peso': '-500'},
    'peso_zero': {**base, 'peso': '0'},
    'tipo_fora_taxonomia': {**base, 'tipoResiduo': 'Lixo hospitalar'},
    'placa_nao_homologada': {**base, 'placa': 'ZZZ-0000'},
    'transportador_nao_cadastrado': {**base, 'transportador': 'Transp; Fantasma', 'transportadorId': ''},
    'gerador_nao_cadastrado': {**base, 'gerador': 'Gerador X', 'geradorId': ''},
    'operador_inexistente': {**base, 'usuario': 'Fulano Não Cadastrado'},
}
for nome, d in casos.items():
    r = requests.post(f'{B}/checkin', data=d, files={'imagem': ('c.jpg', img(gt), 'image/jpeg')})
    res['adversariais'].append({'caso': nome, 'status': r.status_code})
r = requests.post(f'{B}/checkin', data=base)  # sem foto
res['adversariais'].append({'caso': 'sem_evidencia_fotografica', 'status': r.status_code})

# ---------- 3. Controle de acesso (requisições sem credencial)
acc = {}
r = requests.post(f'{B}/usuarios', json={'nome': 'Intruso', 'login': f'intruso{SEED}', 'senha': 'abc123', 'perfil': 'admin'})
acc['criar_admin_sem_login'] = r.status_code
acc['listar_usuarios_sem_login'] = requests.get(f'{B}/usuarios').status_code
acc['historico_completo_sem_login'] = requests.get(f'{B}/historico').status_code
al = requests.get(f'{B}/alertas').json()
acc['resolver_alerta_sem_login'] = requests.patch(f'{B}/alertas/{al[0]["id"]}/resolver').status_code if al else None
acc['login_padrao_admin123'] = requests.post(f'{B}/login', json={'login': 'admin', 'senha': 'admin123'}).status_code
res['acesso'] = acc

# ---------- 4. Rastreabilidade, exportações e KPIs
hist = requests.get(f'{B}/historico').json()
res['n_historico'] = len(hist)
protos = [v['resp']['protocolo'] for v in res['validos']]
res['protocolos_distintos'] = len(set(protos))
recuperados_ok = 0
for v in res['validos']:
    r = requests.get(f"{B}/protocolo/{v['resp']['protocolo']}").json()
    if r.get('data') == v['resp']['data'] and r.get('placa') == v['resp']['placa']:
        recuperados_ok += 1
res['rastreio_correto'] = recuperados_ok
csvtxt = requests.get(f'{B}/download-csv').content.decode('utf-8-sig')
linhas = csvtxt.strip().split('\n')
res['csv_linhas_dados'] = len(linhas) - 1
res['csv_linhas_com_colunas_erradas'] = sum(1 for l in linhas[1:] if len(next(csv.reader([l], delimiter=';'))) != 10)
res['json_total'] = requests.get(f'{B}/export/json').json()['meta']['total']
pdf = requests.get(f'{B}/relatorio/pdf')
res['pdf_bytes'] = len(pdf.content); res['pdf_ok'] = pdf.content[:4] == b'%PDF'
res['kpis'] = requests.get(f'{B}/dashboard/kpis').json()
res['alertas'] = requests.get(f'{B}/alertas').json()
# reincidência por transportador e gerador via endpoints de relatório
reinc = {}
for t in TRANSP:
    regs = requests.get(f'{B}/relatorio/transportador', params={'id': t['id']}).json()
    nc = sum(1 for x in regs if 'conformidade: não' in x['analiseIA'].lower())
    reinc[f"T{t['id']}"] = {'n': len(regs), 'nc': nc, 'bad': t['id'] == BAD_T}
for g in GER:
    regs = requests.get(f'{B}/relatorio/gerador', params={'id': g['id']}).json()
    nc = sum(1 for x in regs if 'conformidade: não' in x['analiseIA'].lower())
    reinc[f"G{g['id']}"] = {'n': len(regs), 'nc': nc, 'bad': g['id'] == BAD_G}
res['reincidencia'] = reinc
json.dump(res, open(OUT, 'w'), ensure_ascii=False, default=str)
print('ok', len(res['validos']), len(res['invalidos']))
