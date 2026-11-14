const express    = require('express');
const multer     = require('multer');
const cors       = require('cors');
const fs         = require('fs');
const path       = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const initSqlJs  = require('sql.js');
const bcrypt     = require('bcryptjs');
const PDFDocument = require('pdfkit');
const winston    = require('winston');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const { body, param, query, validationResult } = require('express-validator');
const axios      = require('axios');

require('dotenv').config();

// ==========================================
// LOGGER ESTRUTURADO — Winston
// ==========================================
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
          return `[${timestamp}] ${level}: ${message}${extra}`;
        })
      )
    }),
    new winston.transports.File({
      filename: './logs/piroo-error.log',
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: './logs/piroo-combined.log',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10
    })
  ]
});

if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');

// ==========================================
// BANCO DE DADOS SQLite via sql.js (puro JS)
// ==========================================
const DB_FILE = './piroo.db';
let db;

async function inicializarBanco() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_FILE)) {
    db = new SQL.Database(fs.readFileSync(DB_FILE));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT NOT NULL DEFAULT 'operador',
      unidade TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS alertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      protocolo INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      resolvido INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      endereco TEXT,
      responsavel TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS transportadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      cnpj TEXT,
      contato TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS veiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      placa TEXT NOT NULL UNIQUE,
      transportador_id INTEGER NOT NULL,
      tipo TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (transportador_id) REFERENCES transportadores(id)
    );
    CREATE TABLE IF NOT EXISTS geradores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      cnpj TEXT,
      contato TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT,
      acao TEXT NOT NULL,
      entidade TEXT NOT NULL,
      entidade_id TEXT,
      detalhe TEXT,
      ip TEXT,
      timestamp TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      descricao TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  // Seed: admin padrão
  if (!dbGet("SELECT id FROM usuarios WHERE login = 'admin'", [])) {
    const hash = bcrypt.hashSync('admin123', 10);
    dbRun("INSERT INTO usuarios (nome, login, senha, perfil, unidade) VALUES (?, ?, ?, ?, ?)",
      ['Administrador', 'admin', hash, 'admin', 'Todas']);
  }

  // Seed: dados mestres iniciais
  if (!dbGet("SELECT id FROM unidades LIMIT 1", [])) {
    ["Ecoponto Sul", "Aterro Central", "Transbordo Norte", "Unidade Vila Maria"]
      .forEach(nome => dbRun("INSERT OR IGNORE INTO unidades (nome) VALUES (?)", [nome]));
    const transp = [
      { nome: "TransLog Soluções", placas: ["ABC-1234", "XYZ-9876", "BRA-2E19"] },
      { nome: "Rápido Verde",      placas: ["KJH-5544", "LMN-1122", "GAT-0I22"] },
      { nome: "EcoTransporte",     placas: ["PLK-9988", "MNO-3321"] }
    ];
    transp.forEach(t => {
      dbRun("INSERT OR IGNORE INTO transportadores (nome) VALUES (?)", [t.nome]);
      const reg = dbGet("SELECT id FROM transportadores WHERE nome = ?", [t.nome]);
      if (reg) t.placas.forEach(p =>
        dbRun("INSERT OR IGNORE INTO veiculos (placa, transportador_id) VALUES (?, ?)", [p, reg.id]));
    });
    ["Construtora Alfa", "Prefeitura SP", "Limpa Tudo ME", "Logística Express", "Particular"]
      .forEach(nome => dbRun("INSERT OR IGNORE INTO geradores (nome) VALUES (?)", [nome]));
  }

  salvarBanco();
  logger.info('Banco SQLite inicializado', { tabelas: ['usuarios','alertas','unidades','transportadores','veiculos','geradores','audit_log','webhooks'] });
}

function salvarBanco() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}

function dbRun(sql, params = [])  { db.run(sql, params); }
function dbGet(sql, params = []) {
  const s = db.prepare(sql); s.bind(params);
  if (s.step()) { const r = s.getAsObject(); s.free(); return r; }
  s.free(); return null;
}
function dbAll(sql, params = []) {
  const s = db.prepare(sql); s.bind(params);
  const rows = [];
  while (s.step()) rows.push(s.getAsObject());
  s.free(); return rows;
}

// Grava evento no audit_log
function auditLog({ usuario = 'sistema', acao, entidade, entidade_id = null, detalhe = null, ip = null }) {
  try {
    dbRun("INSERT INTO audit_log (usuario, acao, entidade, entidade_id, detalhe, ip) VALUES (?,?,?,?,?,?)",
      [usuario, acao, entidade, String(entidade_id || ''), detalhe ? JSON.stringify(detalhe) : null, ip]);
    salvarBanco();
  } catch (e) { logger.error('Falha ao gravar audit_log', { error: e.message }); }
}

// ==========================================
// MULTER — Upload de imagens
// ==========================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas imagens são permitidas.'));
    }
    cb(null, true);
  }
});

// ==========================================
// GEMINI
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// EXPRESS — Middlewares globais
// ==========================================
const app = express();
app.use(express.static(path.join(__dirname, 'frontend-build')));

// Segurança: headers HTTP
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static('uploads'));

// Header de versão em todas as respostas
app.use((req, res, next) => {
  res.setHeader('X-PIROO-Version', '2.3.0');
  next();
});

// Rate limiting global
const limiterGlobal = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Tente novamente em 1 minuto.', code: 'RATE_LIMIT_EXCEEDED' }
});

// Rate limiting restrito para check-in (operação pesada com IA)
const limiterCheckin = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'Limite de check-ins por minuto atingido.', code: 'CHECKIN_RATE_LIMIT' }
});

app.use('/api/', limiterGlobal);

// Middleware de log de requisições
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    logger.info('HTTP', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - inicio,
      ip: req.ip
    });
  });
  next();
});

// Helper: extrai IP real
const getIp = (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

// Helper: processa erros de validação
const validar = (req, res, next) => {
  const erros = validationResult(req);
  if (!erros.isEmpty()) {
    logger.warn('Validação falhou', { path: req.path, erros: erros.array() });
    return res.status(422).json({ error: 'Dados inválidos.', detalhes: erros.array(), code: 'VALIDATION_ERROR' });
  }
  next();
};

const DATA_FILE = './historico.json';
const BASE_URL  = process.env.SERVIDOR || `http://localhost:${process.env.PORT || 3001}`;
const TIPOS_RESIDUO = ["Alvenaria/Entulho", "Madeira", "Plástico/Reciclável", "Poda", "Misturado", "Gesso"];

function lerHistorico() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]'); } catch { return []; }
}

// [v2.3.0] Situação da análise por IA: 'conforme' | 'nao_conforme' | 'pendente'.
// Falha ou ausência de análise passa a ser 'pendente' e não entra na taxa de conformidade.
function situacaoIA(r) {
  if (r.situacaoIA) return r.situacaoIA;
  const t = (r.analiseIA || '').toLowerCase().replace(/\*/g, '');
  if (/conformidade:\s*n[ãa]o/.test(t)) return 'nao_conforme';
  if (/conformidade:\s*sim/.test(t)) return 'conforme';
  return 'pendente';
}

// [v2.3.0] Indicadores de conformidade: denominador = cargas efetivamente analisadas.
function indicadoresConformidade(registros) {
  const conformes    = registros.filter(r => situacaoIA(r) === 'conforme').length;
  const naoConformes = registros.filter(r => situacaoIA(r) === 'nao_conforme').length;
  const analisados   = conformes + naoConformes;
  return {
    taxaConformidade: analisados > 0 ? parseFloat(((conformes / analisados) * 100).toFixed(1)) : 0,
    analisadosIA: analisados,
    naoConformesIA: naoConformes,
    pendentesIA: registros.length - analisados
  };
}

// [v2.3.0] Tempo de atendimento no gate (segundos), quando o início foi registrado.
function indicadoresTempo(registros) {
  const tempos = registros.map(r => r.tempoAtendimentoSeg).filter(v => typeof v === 'number');
  if (!tempos.length) return { tempoMedioAtendimentoSeg: null, desvioAtendimentoSeg: null, atendimentosCronometrados: 0 };
  const media = tempos.reduce((a, v) => a + v, 0) / tempos.length;
  const dp = Math.sqrt(tempos.reduce((a, v) => a + (v - media) ** 2, 0) / tempos.length);
  return { tempoMedioAtendimentoSeg: parseFloat(media.toFixed(1)), desvioAtendimentoSeg: parseFloat(dp.toFixed(1)), atendimentosCronometrados: tempos.length };
}

// [v2.3.0] Protocolo de 6 dígitos sem repetição (formato preservado para QR Code e consulta pública).
function gerarProtocoloUnico(historico) {
  const usados = new Set(historico.map(r => String(r.protocolo)));
  if (usados.size >= 900000) throw new Error('Faixa de protocolos esgotada.');
  let p;
  do { p = Math.floor(100000 + Math.random() * 900000); } while (usados.has(String(p)));
  return p;
}

// [v2.3.0] Campo CSV com aspas e escape (evita deslocamento de colunas por ';' ou quebra de linha).
const csvCampo = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

function detectarAnomalias(analiseIA, protocolo) {
  const texto = analiseIA.toLowerCase().replace(/\*/g, '');
  const alertas = [];
  if (situacaoIA({ analiseIA }) === 'nao_conforme')
    alertas.push({ protocolo, tipo: 'INCONFORMIDADE', descricao: 'IA detectou inconformidade no tipo de resíduo declarado.' });
  if (!texto.includes('materiais proibidos: nenhum') && texto.includes('materiais proibidos:')) {
    const match = analiseIA.match(/Materiais Proibidos:\s*(.+)/i);
    if (match && match[1].toLowerCase() !== 'nenhum')
      alertas.push({ protocolo, tipo: 'MATERIAL_PROIBIDO', descricao: `Materiais proibidos: ${match[1]}` });
  }
  if (texto.includes('segurança da carga: inadequada'))
    alertas.push({ protocolo, tipo: 'SEGURANÇA', descricao: 'Carga com segurança inadequada.' });
  return alertas;
}

// Dispara webhooks registrados de forma assíncrona
async function dispararWebhooks(evento, payload) {
  const hooks = dbAll("SELECT url FROM webhooks WHERE ativo = 1", []);
  hooks.forEach(async ({ url }) => {
    try {
      await axios.post(url, { evento, payload, timestamp: new Date().toISOString() }, { timeout: 5000 });
      logger.info('Webhook disparado', { evento, url });
    } catch (e) {
      logger.warn('Webhook falhou', { url, erro: e.message });
    }
  });
}

// ==========================================
// HEALTH CHECK / PING
// ==========================================
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    versao: '2.3.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    modulos: ['auth','usuarios','unidades','transportadores','veiculos','geradores',
              'checkin','historico','relatorios','dashboard','alertas','audit_log',
              'webhooks','rastreabilidade']
  });
});

// ==========================================
// AUTENTICAÇÃO
// ==========================================
app.post('/api/login',
  [body('login').trim().notEmpty(), body('senha').notEmpty()],
  validar,
  (req, res) => {
    const { login, senha } = req.body;
    const usuario = dbGet("SELECT * FROM usuarios WHERE login = ? AND ativo = 1", [login]);
    if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
      logger.warn('Login falhou', { login, ip: getIp(req) });
      auditLog({ usuario: login, acao: 'LOGIN_FALHOU', entidade: 'usuarios', ip: getIp(req) });
      return res.status(401).json({ error: 'Credenciais inválidas.', code: 'UNAUTHORIZED' });
    }
    logger.info('Login bem-sucedido', { login, perfil: usuario.perfil });
    auditLog({ usuario: login, acao: 'LOGIN', entidade: 'usuarios', entidade_id: usuario.id, ip: getIp(req) });
    res.json({ id: usuario.id, nome: usuario.nome, login: usuario.login, perfil: usuario.perfil, unidade: usuario.unidade });
  }
);

// ==========================================
// DADOS MESTRES
// ==========================================
app.get('/api/homologados', (req, res) => {
  const unidades      = dbAll("SELECT id, nome FROM unidades WHERE ativo = 1 ORDER BY nome", []);
  const transpList    = dbAll("SELECT id, nome FROM transportadores WHERE ativo = 1 ORDER BY nome", []);
  const veiculos      = dbAll("SELECT id, placa, transportador_id FROM veiculos WHERE ativo = 1", []);
  const geradores     = dbAll("SELECT id, nome FROM geradores WHERE ativo = 1 ORDER BY nome", []);
  const transportadores = transpList.map(t => ({
    ...t, placas: veiculos.filter(v => v.transportador_id === t.id).map(v => v.placa)
  }));
  res.json({ unidades: unidades.map(u => u.nome), tiposResiduo: TIPOS_RESIDUO, geradores, transportadores });
});

app.get('/api/historico', (req, res) => res.json(lerHistorico()));

// ==========================================
// CHECK-IN COM IA
// ==========================================
app.post('/api/checkin',
  limiterCheckin,
  upload.single('imagem'),
  async (req, res) => {
    const erros = [];
    const { unidade, transportador, placa, gerador, tipoResiduo, peso, usuario } = req.body;
    if (!unidade)     erros.push('unidade é obrigatória');
    if (!transportador) erros.push('transportador é obrigatório');
    if (!placa)       erros.push('placa é obrigatória');
    if (!gerador)     erros.push('gerador é obrigatório');
    if (!tipoResiduo) erros.push('tipoResiduo é obrigatório');
    if (!usuario)     erros.push('usuario (operador) é obrigatório');
    if (!peso || isNaN(parseFloat(peso))) erros.push('peso deve ser numérico');
    if (!req.file)    erros.push('imagem (evidência fotográfica) é obrigatória');

    // [v2.3.0] Validação contra dados mestres e taxonomia controlada, no servidor
    let transpReg = null, geradorReg = null;
    if (!erros.length) {
      if (!dbGet("SELECT id FROM unidades WHERE nome = ? AND ativo = 1", [unidade]))
        erros.push('unidade não cadastrada ou inativa');
      transpReg = dbGet("SELECT id FROM transportadores WHERE nome = ? AND ativo = 1", [transportador]);
      if (!transpReg) erros.push('transportador não homologado');
      else if (!dbGet("SELECT id FROM veiculos WHERE placa = ? AND transportador_id = ? AND ativo = 1", [placa, transpReg.id]))
        erros.push('placa não vinculada ao transportador');
      geradorReg = dbGet("SELECT id FROM geradores WHERE nome = ? AND ativo = 1", [gerador]);
      if (!geradorReg) erros.push('gerador não cadastrado');
      if (!TIPOS_RESIDUO.includes(tipoResiduo)) erros.push('tipoResiduo fora da lista controlada');
      if (!(parseFloat(peso) > 0)) erros.push('peso deve ser maior que zero');
      if (!dbGet("SELECT id FROM usuarios WHERE nome = ? AND ativo = 1", [usuario]))
        erros.push('operador não cadastrado ou inativo');
    }
    if (erros.length) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(422).json({ error: 'Dados inválidos.', detalhes: erros, code: 'VALIDATION_ERROR' });
    }

    try {
      const dataHora  = new Date().toISOString();
      // [v2.3.0] Tempo de atendimento: do início do preenchimento (enviado pela tela) ao registro
      let tempoAtendimentoSeg = null;
      const inicio = Date.parse(req.body.inicioAtendimento || '');
      if (!isNaN(inicio)) {
        const seg = (Date.parse(dataHora) - inicio) / 1000;
        if (seg >= 0 && seg <= 4 * 3600) tempoAtendimentoSeg = parseFloat(seg.toFixed(1));
      }
      let analiseIA   = 'Análise automática indisponível.';

      if (req.file) {
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          const prompt = `Você é um auditor de gate de resíduos.
          Analise a imagem da carga.
          Dados declarados:
          - Tipo: ${tipoResiduo}
          - Peso declarado: ${peso} kg
          Sua tarefa:
          1. Confirme se o material visual condiz com "${tipoResiduo}" respondendo apenas "Sim" ou "Não".
          2. Se o material não estiver visível, mas coberto, responda "Sim".
          3. Avalie se o volume na caçamba é compatível com ${peso}kg.
          4. Estime o peso (kg) com base na imagem se possível.
          5. Identifique materiais proibidos (lixo hospitalar, inflamáveis).
          6. Verifique sinalização na lateral do veículo, segurança da carga e limites de segurança.
          Responda no formato:
          Conformidade: [Sim/Não].
          Parecer: [Resumo].
          Sinalização: [Presente/Ausente].
          Segurança da Carga: [Adequada/Inadequada].
          Estimativa de Peso: [Valor em kg ou "Indeterminado"].
          Materiais Proibidos: [Lista ou "Nenhum"].`;
          const imagePart = {
            inlineData: { data: fs.readFileSync(req.file.path).toString('base64'), mimeType: req.file.mimetype }
          };
          const result = await model.generateContent([prompt, imagePart]);
          analiseIA = result.response.text();
          logger.info('Análise IA concluída', { placa, conformidade: analiseIA.includes('Conformidade: Sim') });
        } catch (iaErr) {
          logger.error('Erro na IA', { error: iaErr.message, placa });
          analiseIA = 'Erro ao processar imagem com a IA.';
        }
      }

      const situacao = situacaoIA({ analiseIA });

      // [v2.3.0] Protocolo gerado e gravado no mesmo trecho síncrono: sem repetição nem concorrência
      const historico = lerHistorico();
      const protocolo = gerarProtocoloUnico(historico);
      const novoRegistro = {
        protocolo, data: dataHora, unidade, usuario,
        transportador, transportadorId: String(transpReg.id),
        placa, gerador, geradorId: String(geradorReg.id),
        tipoResiduo, peso: parseFloat(peso),
        observacao: req.body.observacao || '',
        fotoUrl: `/uploads/${req.file.filename}`,
        analiseIA, situacaoIA: situacao,
        inicioAtendimento: tempoAtendimentoSeg !== null ? new Date(inicio).toISOString() : null,
        tempoAtendimentoSeg
      };
      historico.unshift(novoRegistro);
      fs.writeFileSync(DATA_FILE, JSON.stringify(historico, null, 2));

      const alertasDetectados = detectarAnomalias(analiseIA, protocolo);
      if (situacao === 'pendente')
        alertasDetectados.push({ protocolo, tipo: 'IA_PENDENTE', descricao: 'Análise automática não concluída; conferência manual necessária.' });
      alertasDetectados.forEach(a =>
        dbRun("INSERT INTO alertas (protocolo, tipo, descricao) VALUES (?, ?, ?)", [a.protocolo, a.tipo, a.descricao])
      );
      if (alertasDetectados.length > 0) {
        salvarBanco();
        dispararWebhooks('ALERTA_ANOMALIA', { protocolo, alertas: alertasDetectados });
      }

      auditLog({ usuario, acao: 'CHECKIN', entidade: 'checkin', entidade_id: protocolo,
        detalhe: { unidade, transportador, placa, tipoResiduo, peso }, ip: getIp(req) });

      logger.info('Check-in registrado', { protocolo, unidade, transportador, placa });
      res.json(novoRegistro);

    } catch (error) {
      logger.error('Erro no check-in', { error: error.message, stack: error.stack });
      res.status(500).json({ error: 'Falha na orquestração do registro de gate.', code: 'INTERNAL_ERROR' });
    }
  }
);

// ==========================================
// DOWNLOAD CSV
// ==========================================
app.get('/api/download-csv', (req, res) => {
  const registros = lerHistorico();
  if (!registros.length) return res.status(404).json({ error: 'Sem dados.', code: 'NOT_FOUND' });
  const header = ['Protocolo','Data','Unidade','Operador','Transportador','Placa','Gerador','Residuo','Peso','Status_IA','Situacao_IA','Tempo_Atendimento_s','Observacao'].map(csvCampo).join(';') + '\n';
  const rows = registros.map(r => [r.protocolo, r.data, r.unidade, r.usuario, r.transportador, r.placa, r.gerador,
    r.tipoResiduo, r.peso, r.analiseIA, situacaoIA(r), r.tempoAtendimentoSeg ?? '', r.observacao].map(csvCampo).join(';')
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=auditoria_gate.csv');
  res.send('\uFEFF' + header + rows);
});

// ==========================================
// EXPORTAÇÃO JSON ESTRUTURADA (interoperabilidade)
// ==========================================
app.get('/api/export/json', [
  query('unidade').optional().trim(),
  query('tipoResiduo').optional().trim(),
  query('dataInicio').optional().isISO8601(),
  query('dataFim').optional().isISO8601()
], validar, (req, res) => {
  const { unidade, tipoResiduo, dataInicio, dataFim } = req.query;
  let registros = lerHistorico();
  if (unidade)     registros = registros.filter(r => r.unidade === unidade);
  if (tipoResiduo) registros = registros.filter(r => r.tipoResiduo === tipoResiduo);
  if (dataInicio)  registros = registros.filter(r => new Date(r.data) >= new Date(dataInicio));
  if (dataFim)     registros = registros.filter(r => new Date(r.data) <= new Date(dataFim + 'T23:59:59'));
  res.json({
    meta: {
      versao_api: '2.3.0',
      gerado_em: new Date().toISOString(),
      total: registros.length,
      filtros: { unidade: unidade || null, tipoResiduo: tipoResiduo || null, dataInicio: dataInicio || null, dataFim: dataFim || null }
    },
    dados: registros.map(({ fotoUrl, ...r }) => r)
  });
});

// ==========================================
// RELATÓRIOS
// ==========================================
app.get('/api/relatorio/transportador', [query('id').notEmpty().isInt()], validar, (req, res) => {
  const { id } = req.query;
  const filtrados = lerHistorico()
    .filter(reg => String(reg.transportadorId) === String(id))
    .map(reg => ({ ...reg, fotoUrl: reg.fotoUrl ? `${BASE_URL}${reg.fotoUrl}` : null }));
  res.json(filtrados);
});

app.get('/api/relatorio/gerador', [query('id').notEmpty().isInt()], validar, (req, res) => {
  const { id } = req.query;
  const filtrados = lerHistorico()
    .filter(reg => String(reg.geradorId) === String(id))
    .map(reg => ({ ...reg, fotoUrl: reg.fotoUrl ? `${BASE_URL}${reg.fotoUrl}` : null }));
  res.json(filtrados);
});

app.get('/api/relatorio/descargas', (req, res) => {
  const { unidade, tipoResiduo, dataInicio, dataFim } = req.query;
  let registros = lerHistorico();
  if (unidade)     registros = registros.filter(r => r.unidade === unidade);
  if (tipoResiduo) registros = registros.filter(r => r.tipoResiduo === tipoResiduo);
  if (dataInicio)  registros = registros.filter(r => new Date(r.data) >= new Date(dataInicio));
  if (dataFim)     registros = registros.filter(r => new Date(r.data) <= new Date(dataFim + 'T23:59:59'));
  const totalRegistros = registros.length;
  const pesoTotal = registros.reduce((acc, r) => acc + (r.peso || 0), 0);
  const pesoMedio = totalRegistros > 0 ? pesoTotal / totalRegistros : 0;
  const porTipo = {};
  registros.forEach(r => {
    if (!porTipo[r.tipoResiduo]) porTipo[r.tipoResiduo] = { quantidade: 0, peso: 0 };
    porTipo[r.tipoResiduo].quantidade++;
    porTipo[r.tipoResiduo].peso += r.peso || 0;
  });
  const porGerador = {};
  registros.forEach(r => {
    if (!porGerador[r.gerador]) porGerador[r.gerador] = { quantidade: 0, peso: 0 };
    porGerador[r.gerador].quantidade++;
    porGerador[r.gerador].peso += r.peso || 0;
  });
  const rankingGeradores = Object.entries(porGerador)
    .map(([nome, dados]) => ({ nome, ...dados }))
    .sort((a, b) => b.peso - a.peso);
  const conf = indicadoresConformidade(registros);
  const porDia = {};
  registros.forEach(r => {
    const dia = r.data?.substring(0, 10);
    if (dia) {
      if (!porDia[dia]) porDia[dia] = { quantidade: 0, peso: 0 };
      porDia[dia].quantidade++;
      porDia[dia].peso += r.peso || 0;
    }
  });
  const serieTemporal = Object.entries(porDia).map(([data, v]) => ({ data, ...v })).sort((a, b) => a.data.localeCompare(b.data));
  res.json({ totalRegistros, pesoTotal: parseFloat(pesoTotal.toFixed(2)), pesoMedio: parseFloat(pesoMedio.toFixed(2)),
    ...conf, ...indicadoresTempo(registros), porTipo, rankingGeradores, serieTemporal, registros });
});

app.get('/api/relatorio/pdf', (req, res) => {
  const { unidade, tipoResiduo, dataInicio, dataFim } = req.query;
  let registros = lerHistorico();
  if (unidade)     registros = registros.filter(r => r.unidade === unidade);
  if (tipoResiduo) registros = registros.filter(r => r.tipoResiduo === tipoResiduo);
  if (dataInicio)  registros = registros.filter(r => new Date(r.data) >= new Date(dataInicio));
  if (dataFim)     registros = registros.filter(r => new Date(r.data) <= new Date(dataFim + 'T23:59:59'));
  const pesoTotal = registros.reduce((acc, r) => acc + (r.peso || 0), 0);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=relatorio_descargas_${Date.now()}.pdf`);
  doc.pipe(res);
  doc.fontSize(18).fillColor('#3182ce').text('PIROO — Relatório de Descargas', { align: 'center' });
  doc.fontSize(10).fillColor('#718096').text(`Gerado em: ${new Date().toLocaleString('pt-BR')}  |  Versão da API: 2.3.0`, { align: 'center' });
  doc.moveDown();
  doc.fontSize(11).fillColor('#2d3748').text('Filtros aplicados:', { underline: true });
  doc.fontSize(10).fillColor('#4a5568')
    .text(`Unidade: ${unidade || 'Todas'}`)
    .text(`Tipo de Resíduo: ${tipoResiduo || 'Todos'}`)
    .text(`Período: ${dataInicio || '—'} até ${dataFim || '—'}`);
  doc.moveDown();
  doc.fontSize(12).fillColor('#2d3748').text('Resumo Executivo', { underline: true });
  doc.moveDown(0.3);
  const conf = indicadoresConformidade(registros);
  const taxa = conf.taxaConformidade.toFixed(1);
  doc.fontSize(10).fillColor('#4a5568')
    .text(`Total de registros: ${registros.length}`)
    .text(`Peso total: ${pesoTotal.toFixed(2)} kg`)
    .text(`Peso médio: ${registros.length > 0 ? (pesoTotal / registros.length).toFixed(2) : 0} kg`)
    .text(`Taxa de conformidade (IA): ${taxa}% sobre ${conf.analisadosIA} cargas analisadas`)
    .text(`Cargas com análise pendente: ${conf.pendentesIA}`);
  doc.moveDown();
  doc.fontSize(12).fillColor('#2d3748').text('Registros Detalhados', { underline: true });
  doc.moveDown(0.5);
  const colWidths = [65, 80, 60, 70, 55, 60, 60, 65];
  const headers = ['Protocolo', 'Data', 'Unidade', 'Gerador', 'Resíduo', 'Transportador', 'Placa', 'Peso (kg)'];
  let x = 50;
  doc.rect(50, doc.y, 495, 18).fill('#3182ce');
  let hY = doc.y - 18;
  doc.fillColor('white').fontSize(8);
  headers.forEach((h, i) => { doc.text(h, x + 2, hY + 5, { width: colWidths[i] - 4, lineBreak: false }); x += colWidths[i]; });
  doc.moveDown(0.1);
  registros.slice(0, 80).forEach((r, idx) => {
    if (doc.y > 750) doc.addPage();
    doc.rect(50, doc.y, 495, 18).fill(idx % 2 === 0 ? '#f7fafc' : '#ffffff').stroke('#e2e8f0');
    const rY = doc.y; x = 50;
    doc.fillColor('#2d3748').fontSize(7.5);
    [String(r.protocolo), new Date(r.data).toLocaleDateString('pt-BR'), r.unidade || '',
     r.gerador || '', r.tipoResiduo || '', r.transportador || '', r.placa || '', String(r.peso || 0)]
      .forEach((c, i) => { doc.text(c, x + 2, rY + 5, { width: colWidths[i] - 4, lineBreak: false }); x += colWidths[i]; });
    doc.moveDown(0.1);
  });
  if (registros.length > 80)
    doc.moveDown().fontSize(9).fillColor('#718096')
      .text(`... e mais ${registros.length - 80} registros. Exporte o CSV para visualização completa.`);
  doc.moveDown(2).fontSize(8).fillColor('#a0aec0')
    .text('PIROO-MVP v2.3.0 — Plataforma Integrada de Rastreabilidade e Orquestração Operacional', { align: 'center' });
  doc.end();
});

// ==========================================
// DASHBOARD — KPIs
// ==========================================
app.get('/api/dashboard/kpis', (req, res) => {
  const registros = lerHistorico();
  const hoje = new Date().toISOString().substring(0, 10);
  const registrosHoje = registros.filter(r => r.data?.startsWith(hoje));
  const pesoTotal = registros.reduce((acc, r) => acc + (r.peso || 0), 0);
  const pesoHoje  = registrosHoje.reduce((acc, r) => acc + (r.peso || 0), 0);
  const conf = indicadoresConformidade(registros);
  const porTipo = {};
  registros.forEach(r => { if (!porTipo[r.tipoResiduo]) porTipo[r.tipoResiduo] = 0; porTipo[r.tipoResiduo] += r.peso || 0; });
  const ultimos7Dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dStr = d.toISOString().substring(0, 10);
    const regs = registros.filter(r => r.data?.startsWith(dStr));
    ultimos7Dias.push({ data: dStr, quantidade: regs.length, peso: regs.reduce((a, r) => a + (r.peso || 0), 0) });
  }
  const totalAlertasRow = dbGet("SELECT COUNT(*) as total FROM alertas WHERE resolvido = 0", []);
  const totalAlertas = totalAlertasRow ? (totalAlertasRow.total || 0) : 0;
  res.json({ totalRegistros: registros.length, registrosHoje: registrosHoje.length,
    pesoTotal: parseFloat(pesoTotal.toFixed(2)), pesoHoje: parseFloat(pesoHoje.toFixed(2)),
    ...conf, ...indicadoresTempo(registros), alertasAbertos: totalAlertas, porTipo, ultimos7Dias });
});

// ==========================================
// ALERTAS
// ==========================================
app.get('/api/alertas', (req, res) => {
  // [v2.3.0] Paginação: ?limite (padrão 100, máx. 1000) e ?offset; total no cabeçalho X-Total-Count
  const limite = Math.min(Math.max(parseInt(req.query.limite) || 100, 1), 1000);
  const offset = Math.max(parseInt(req.query.offset) || 0, 0);
  const total = dbGet("SELECT COUNT(*) as total FROM alertas", [])?.total || 0;
  res.setHeader('X-Total-Count', String(total));
  res.json(dbAll("SELECT * FROM alertas ORDER BY criado_em DESC, id DESC LIMIT ? OFFSET ?", [limite, offset]));
});

app.patch('/api/alertas/:id/resolver',
  [param('id').isInt()], validar,
  (req, res) => {
    dbRun("UPDATE alertas SET resolvido = 1 WHERE id = ?", [parseInt(req.params.id)]);
    salvarBanco();
    auditLog({ acao: 'ALERTA_RESOLVIDO', entidade: 'alertas', entidade_id: req.params.id, ip: getIp(req) });
    res.json({ ok: true });
  }
);

// ==========================================
// RASTREABILIDADE PÚBLICA
// ==========================================
app.get('/api/protocolo/:numero',
  [param('numero').isInt({ min: 100000, max: 999999 })], validar,
  (req, res) => {
    const registro = lerHistorico().find(r => String(r.protocolo) === String(req.params.numero));
    if (!registro) return res.status(404).json({ error: 'Protocolo não encontrado.', code: 'NOT_FOUND' });
    const { fotoUrl, ...dados } = registro;
    res.json(dados);
  }
);

// ==========================================
// USUÁRIOS
// ==========================================
app.get('/api/usuarios', (req, res) => {
  res.json(dbAll("SELECT id, nome, login, perfil, unidade, ativo, criado_em FROM usuarios ORDER BY nome", []));
});

app.post('/api/usuarios', [
  body('nome').trim().notEmpty().isLength({ max: 100 }),
  body('login').trim().notEmpty().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9._-]+$/),
  body('senha').isLength({ min: 6 }),
  body('perfil').isIn(['operador', 'auditor', 'admin'])
], validar, (req, res) => {
  const { nome, login, senha, perfil, unidade } = req.body;
  if (dbGet("SELECT id FROM usuarios WHERE login = ?", [login]))
    return res.status(409).json({ error: 'Login já cadastrado.', code: 'CONFLICT' });
  const hash = bcrypt.hashSync(senha, 10);
  dbRun("INSERT INTO usuarios (nome, login, senha, perfil, unidade) VALUES (?, ?, ?, ?, ?)",
    [nome, login, hash, perfil || 'operador', unidade || '']);
  salvarBanco();
  const novo = dbGet("SELECT id FROM usuarios WHERE login = ?", [login]);
  auditLog({ usuario: login, acao: 'USUARIO_CRIADO', entidade: 'usuarios', entidade_id: novo?.id, ip: getIp(req) });
  res.status(201).json({ id: novo?.id, nome, login, perfil, unidade });
});

app.patch('/api/usuarios/:id/status',
  [param('id').isInt(), body('ativo').isBoolean()], validar,
  (req, res) => {
    dbRun("UPDATE usuarios SET ativo = ? WHERE id = ?", [req.body.ativo ? 1 : 0, parseInt(req.params.id)]);
    salvarBanco();
    auditLog({ acao: 'USUARIO_STATUS', entidade: 'usuarios', entidade_id: req.params.id,
      detalhe: { ativo: req.body.ativo }, ip: getIp(req) });
    res.json({ ok: true });
  }
);

app.get('/api/operadores', (req, res) => {
  res.json(dbAll("SELECT id, nome, unidade FROM usuarios WHERE ativo = 1 ORDER BY nome", []));
});

// ==========================================
// UNIDADES
// ==========================================
app.get('/api/unidades', (req, res) => res.json(dbAll("SELECT * FROM unidades ORDER BY nome", [])));

app.post('/api/unidades',
  [body('nome').trim().notEmpty().isLength({ max: 100 })], validar,
  (req, res) => {
    const { nome, endereco, responsavel } = req.body;
    if (dbGet("SELECT id FROM unidades WHERE nome = ?", [nome]))
      return res.status(409).json({ error: 'Unidade já cadastrada.', code: 'CONFLICT' });
    dbRun("INSERT INTO unidades (nome, endereco, responsavel) VALUES (?, ?, ?)", [nome, endereco || '', responsavel || '']);
    salvarBanco();
    const nova = dbGet("SELECT * FROM unidades WHERE nome = ?", [nome]);
    auditLog({ acao: 'UNIDADE_CRIADA', entidade: 'unidades', entidade_id: nova?.id, detalhe: { nome }, ip: getIp(req) });
    res.status(201).json(nova);
  }
);

app.patch('/api/unidades/:id',
  [param('id').isInt()], validar,
  (req, res) => {
    const id = parseInt(req.params.id);
    if (!dbGet("SELECT id FROM unidades WHERE id = ?", [id]))
      return res.status(404).json({ error: 'Unidade não encontrada.', code: 'NOT_FOUND' });
    const { nome, endereco, responsavel, ativo } = req.body;
    if (nome !== undefined)       dbRun("UPDATE unidades SET nome = ? WHERE id = ?", [nome, id]);
    if (endereco !== undefined)   dbRun("UPDATE unidades SET endereco = ? WHERE id = ?", [endereco, id]);
    if (responsavel !== undefined) dbRun("UPDATE unidades SET responsavel = ? WHERE id = ?", [responsavel, id]);
    if (ativo !== undefined)      dbRun("UPDATE unidades SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, id]);
    salvarBanco();
    auditLog({ acao: 'UNIDADE_ATUALIZADA', entidade: 'unidades', entidade_id: id, ip: getIp(req) });
    res.json(dbGet("SELECT * FROM unidades WHERE id = ?", [id]));
  }
);

// ==========================================
// TRANSPORTADORES
// ==========================================
app.get('/api/transportadores', (req, res) => {
  const transp   = dbAll("SELECT * FROM transportadores ORDER BY nome", []);
  const veiculos = dbAll("SELECT * FROM veiculos ORDER BY placa", []);
  res.json(transp.map(t => ({ ...t, veiculos: veiculos.filter(v => v.transportador_id === t.id) })));
});

app.post('/api/transportadores',
  [body('nome').trim().notEmpty().isLength({ max: 150 })], validar,
  (req, res) => {
    const { nome, cnpj, contato } = req.body;
    if (dbGet("SELECT id FROM transportadores WHERE nome = ?", [nome]))
      return res.status(409).json({ error: 'Transportador já cadastrado.', code: 'CONFLICT' });
    dbRun("INSERT INTO transportadores (nome, cnpj, contato) VALUES (?, ?, ?)", [nome, cnpj || '', contato || '']);
    salvarBanco();
    const novo = dbGet("SELECT * FROM transportadores WHERE nome = ?", [nome]);
    auditLog({ acao: 'TRANSPORTADOR_CRIADO', entidade: 'transportadores', entidade_id: novo?.id, ip: getIp(req) });
    res.status(201).json(novo);
  }
);

app.patch('/api/transportadores/:id',
  [param('id').isInt()], validar,
  (req, res) => {
    const id = parseInt(req.params.id);
    if (!dbGet("SELECT id FROM transportadores WHERE id = ?", [id]))
      return res.status(404).json({ error: 'Transportador não encontrado.', code: 'NOT_FOUND' });
    const { nome, cnpj, contato, ativo } = req.body;
    if (nome !== undefined)    dbRun("UPDATE transportadores SET nome = ? WHERE id = ?", [nome, id]);
    if (cnpj !== undefined)    dbRun("UPDATE transportadores SET cnpj = ? WHERE id = ?", [cnpj, id]);
    if (contato !== undefined) dbRun("UPDATE transportadores SET contato = ? WHERE id = ?", [contato, id]);
    if (ativo !== undefined)   dbRun("UPDATE transportadores SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, id]);
    salvarBanco();
    auditLog({ acao: 'TRANSPORTADOR_ATUALIZADO', entidade: 'transportadores', entidade_id: id, ip: getIp(req) });
    res.json(dbGet("SELECT * FROM transportadores WHERE id = ?", [id]));
  }
);

// ==========================================
// VEÍCULOS
// ==========================================
app.get('/api/veiculos', (req, res) => {
  const { transportador_id } = req.query;
  if (transportador_id)
    return res.json(dbAll("SELECT * FROM veiculos WHERE transportador_id = ? ORDER BY placa", [parseInt(transportador_id)]));
  res.json(dbAll("SELECT v.*, t.nome as transportador_nome FROM veiculos v JOIN transportadores t ON t.id = v.transportador_id ORDER BY v.placa", []));
});

app.post('/api/veiculos', [
  body('placa').trim().notEmpty().matches(/^[A-Z0-9-]{6,8}$/i),
  body('transportador_id').isInt()
], validar, (req, res) => {
  const { placa, transportador_id, tipo } = req.body;
  const placaFmt = placa.toUpperCase().trim();
  if (dbGet("SELECT id FROM veiculos WHERE placa = ?", [placaFmt]))
    return res.status(409).json({ error: 'Placa já cadastrada.', code: 'CONFLICT' });
  if (!dbGet("SELECT id FROM transportadores WHERE id = ?", [parseInt(transportador_id)]))
    return res.status(404).json({ error: 'Transportador não encontrado.', code: 'NOT_FOUND' });
  dbRun("INSERT INTO veiculos (placa, transportador_id, tipo) VALUES (?, ?, ?)", [placaFmt, parseInt(transportador_id), tipo || '']);
  salvarBanco();
  const novo = dbGet("SELECT * FROM veiculos WHERE placa = ?", [placaFmt]);
  auditLog({ acao: 'VEICULO_CRIADO', entidade: 'veiculos', entidade_id: novo?.id, detalhe: { placa: placaFmt, transportador_id }, ip: getIp(req) });
  res.status(201).json(novo);
});

app.patch('/api/veiculos/:id',
  [param('id').isInt()], validar,
  (req, res) => {
    const id = parseInt(req.params.id);
    if (!dbGet("SELECT id FROM veiculos WHERE id = ?", [id]))
      return res.status(404).json({ error: 'Veículo não encontrado.', code: 'NOT_FOUND' });
    const { placa, tipo, ativo } = req.body;
    if (placa !== undefined) dbRun("UPDATE veiculos SET placa = ? WHERE id = ?", [placa.toUpperCase().trim(), id]);
    if (tipo !== undefined)  dbRun("UPDATE veiculos SET tipo = ? WHERE id = ?", [tipo, id]);
    if (ativo !== undefined) dbRun("UPDATE veiculos SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, id]);
    salvarBanco();
    res.json(dbGet("SELECT * FROM veiculos WHERE id = ?", [id]));
  }
);

// ==========================================
// GERADORES
// ==========================================
app.get('/api/geradores', (req, res) => res.json(dbAll("SELECT * FROM geradores ORDER BY nome", [])));

app.post('/api/geradores',
  [body('nome').trim().notEmpty().isLength({ max: 150 })], validar,
  (req, res) => {
    const { nome, cnpj, contato } = req.body;
    if (dbGet("SELECT id FROM geradores WHERE nome = ?", [nome]))
      return res.status(409).json({ error: 'Gerador já cadastrado.', code: 'CONFLICT' });
    dbRun("INSERT INTO geradores (nome, cnpj, contato) VALUES (?, ?, ?)", [nome, cnpj || '', contato || '']);
    salvarBanco();
    const novo = dbGet("SELECT * FROM geradores WHERE nome = ?", [nome]);
    auditLog({ acao: 'GERADOR_CRIADO', entidade: 'geradores', entidade_id: novo?.id, ip: getIp(req) });
    res.status(201).json(novo);
  }
);

app.patch('/api/geradores/:id',
  [param('id').isInt()], validar,
  (req, res) => {
    const id = parseInt(req.params.id);
    if (!dbGet("SELECT id FROM geradores WHERE id = ?", [id]))
      return res.status(404).json({ error: 'Gerador não encontrado.', code: 'NOT_FOUND' });
    const { nome, cnpj, contato, ativo } = req.body;
    if (nome !== undefined)    dbRun("UPDATE geradores SET nome = ? WHERE id = ?", [nome, id]);
    if (cnpj !== undefined)    dbRun("UPDATE geradores SET cnpj = ? WHERE id = ?", [cnpj, id]);
    if (contato !== undefined) dbRun("UPDATE geradores SET contato = ? WHERE id = ?", [contato, id]);
    if (ativo !== undefined)   dbRun("UPDATE geradores SET ativo = ? WHERE id = ?", [ativo ? 1 : 0, id]);
    salvarBanco();
    res.json(dbGet("SELECT * FROM geradores WHERE id = ?", [id]));
  }
);

// ==========================================
// AUDIT LOG
// ==========================================
app.get('/api/audit-log', (req, res) => {
  const { entidade, usuario, limite = 200 } = req.query;
  let sql = "SELECT * FROM audit_log WHERE 1=1";
  const params = [];
  if (entidade) { sql += " AND entidade = ?"; params.push(entidade); }
  if (usuario)  { sql += " AND usuario LIKE ?"; params.push(`%${usuario}%`); }
  sql += ` ORDER BY timestamp DESC LIMIT ${Math.min(parseInt(limite) || 200, 500)}`;
  res.json(dbAll(sql, params));
});

// ==========================================
// WEBHOOKS
// ==========================================
app.get('/api/webhooks', (req, res) => res.json(dbAll("SELECT id, url, descricao, ativo, criado_em FROM webhooks", [])));

app.post('/api/webhooks', [
  body('url').isURL({ protocols: ['http', 'https'] }),
  body('descricao').optional().trim().isLength({ max: 200 })
], validar, (req, res) => {
  const { url, descricao } = req.body;
  if (dbGet("SELECT id FROM webhooks WHERE url = ?", [url]))
    return res.status(409).json({ error: 'URL já registrada.', code: 'CONFLICT' });
  dbRun("INSERT INTO webhooks (url, descricao) VALUES (?, ?)", [url, descricao || '']);
  salvarBanco();
  auditLog({ acao: 'WEBHOOK_CRIADO', entidade: 'webhooks', detalhe: { url }, ip: getIp(req) });
  res.status(201).json(dbGet("SELECT * FROM webhooks WHERE url = ?", [url]));
});

app.patch('/api/webhooks/:id',
  [param('id').isInt(), body('ativo').isBoolean()], validar,
  (req, res) => {
    dbRun("UPDATE webhooks SET ativo = ? WHERE id = ?", [req.body.ativo ? 1 : 0, parseInt(req.params.id)]);
    salvarBanco();
    res.json({ ok: true });
  }
);

app.delete('/api/webhooks/:id',
  [param('id').isInt()], validar,
  (req, res) => {
    dbRun("DELETE FROM webhooks WHERE id = ?", [parseInt(req.params.id)]);
    salvarBanco();
    res.json({ ok: true });
  }
);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend-build', 'index.html'));
});

// ==========================================
// MIDDLEWARE GLOBAL DE ERROS
// ==========================================
app.use((err, req, res, next) => {
  logger.error('Erro não tratado', { error: err.message, stack: err.stack, path: req.path });
  if (err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: 'Arquivo muito grande. Máximo: 10MB.', code: 'FILE_TOO_LARGE' });
  if (err.message === 'Apenas imagens são permitidas.')
    return res.status(415).json({ error: err.message, code: 'UNSUPPORTED_MEDIA' });
  res.status(500).json({ error: 'Erro interno do servidor.', code: 'INTERNAL_ERROR', timestamp: new Date().toISOString() });
});



// ==========================================
// INICIALIZAÇÃO
// ==========================================
const PORT = process.env.PORT || 3001;

inicializarBanco().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info('Servidor iniciado', {
      versao: '2.0.0',
      porta: PORT,
      banco: DB_FILE,
      ambiente: process.env.NODE_ENV || 'development'
    });
    console.log(`
  ╔══════════════════════════════════════════════╗
  ║     PIROO-MVP v2.0.0 — PRODUÇÃO ROBUSTA      ║
  ╠══════════════════════════════════════════════╣
  ║  Servidor : http://localhost:${PORT}            ║
  ║  Banco    : ${DB_FILE}                   ║
  ║  Logs     : ./logs/piroo-combined.log         ║
  ╠══════════════════════════════════════════════╣
  ║  Segurança  : Helmet + Rate Limit + Validação ║
  ║  Auditoria  : audit_log + Winston             ║
  ║  Integração : Webhooks + Export JSON          ║
  ║  Health     : GET /api/ping                   ║
  ╚══════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  logger.error('Falha ao inicializar banco', { error: err.message });
  process.exit(1);
});
