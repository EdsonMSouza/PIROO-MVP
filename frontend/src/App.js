import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import { QRCodeSVG } from 'qrcode.react';
import html2pdf from 'html2pdf.js';
import {
    Camera, Truck, LayoutDashboard, Lock,
    Building2, User, MessageSquare, LogOut, FileText,
    Download, PlusCircle, Bell, Users, BarChart2,
    CheckCircle, AlertTriangle, Search, UserPlus,
    ShieldCheck, TrendingUp, Scale, Activity, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { FaIdCard } from "react-icons/fa";
import { SiMaterialformkdocs } from "react-icons/si";
import { GiWeight } from "react-icons/gi";
import { FiBox } from "react-icons/fi";

const API_URL = "http://localhost:3000/api";
// [v2.3.0] Situação da análise por IA (usa o campo do servidor; registros antigos são interpretados pelo texto)
const situacaoIA = (r) => {
    if (r?.situacaoIA) return r.situacaoIA;
    const t = (r?.analiseIA || '').toLowerCase().replace(/\*/g, '');
    if (/conformidade:\s*n[ãa]o/.test(t)) return 'nao_conforme';
    if (/conformidade:\s*sim/.test(t)) return 'conforme';
    return 'pendente';
};
const ROTULO_IA = { conforme: 'CONFORME', nao_conforme: 'NÃO CONFORME', pendente: 'PENDENTE' };
const COR_IA = {
    conforme: { bg: '#f0fff4', fg: '#22543d' },
    nao_conforme: { bg: '#fff5f5', fg: '#822727' },
    pendente: { bg: '#fffaf0', fg: '#7b341e' }
};
const CORES_GRAFICO = ['#3182ce', '#48bb78', '#ed8936', '#9f7aea', '#f56565', '#38b2ac'];

// ==========================================
// COMPONENTE: KPI CARD
// ==========================================
function KpiCard({ icon, label, value, sub, color }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 14, padding: '20px 24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderTop: `4px solid ${color || '#3182ce'}`,
            display: 'flex', flexDirection: 'column', gap: 6
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: color || '#3182ce' }}>
                {icon}
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#718096', letterSpacing: 0.5 }}>{label}</span>
            </div>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#2d3748', lineHeight: 1.1 }}>{value}</span>
            {sub && <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>{sub}</span>}
        </div>
    );
}

// ==========================================
// COMPONENTE: TELA DE LOGIN
// ==========================================
function TelaLogin({ onLogin }) {
    const [login, setLogin] = useState('');
    const [senha, setSenha] = useState('');
    const [erro, setErro] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/login`, { login, senha });
            onLogin(res.data);
        } catch {
            setErro('Login ou senha inválidos.');
        }
    };

    return (
        <div className="login-container">
            <form onSubmit={handleSubmit} className="login-card">
                <Lock size={48} color="#3182ce" />
                <h2>PIROO-MVP</h2>
                <p style={{ color: '#718096', fontSize: '0.85rem', marginBottom: 10 }}>Plataforma Integrada de Rastreabilidade</p>
                <input
                    type="text" placeholder="Login"
                    value={login} onChange={e => setLogin(e.target.value)}
                    style={{ fontSize: '1rem', textAlign: 'left' }}
                />
                <input
                    type="password" placeholder="Senha"
                    value={senha} onChange={e => setSenha(e.target.value)}
                    style={{ fontSize: '1rem', textAlign: 'left', marginTop: 8 }}
                />
                {erro && <p style={{ color: '#f56565', fontSize: '0.85rem', margin: '5px 0' }}>{erro}</p>}
                <button type="submit" className="btn-submit" style={{ marginTop: 10 }}>Entrar</button>
            </form>
        </div>
    );
}

// ==========================================
// COMPONENTE: DASHBOARD
// ==========================================
function TelaDashboard({ alertasAbertos }) {
    const [kpis, setKpis] = useState(null);
    const [loading, setLoading] = useState(true);

    const carregarKpis = useCallback(() => {
        axios.get(`${API_URL}/dashboard/kpis`)
            .then(res => { setKpis(res.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    useEffect(() => {
        carregarKpis();
        const intervalo = setInterval(carregarKpis, 30000);
        return () => clearInterval(intervalo);
    }, [carregarKpis]);

    if (loading) return <p style={{ color: '#718096', padding: 20 }}>Carregando KPIs...</p>;
    if (!kpis) return <p style={{ color: '#f56565' }}>Erro ao carregar métricas.</p>;

    const dadosTipo = Object.entries(kpis.porTipo || {}).map(([nome, peso]) => ({ nome, peso: parseFloat(peso.toFixed(1)) }));
    const dadosPizza = dadosTipo.slice(0, 6);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ color: '#2d3748' }}>Dashboard Operacional</h2>
                <span style={{ fontSize: '0.78rem', color: '#a0aec0' }}>Atualização automática a cada 30s</span>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                <KpiCard icon={<Activity size={18} />} label="Entradas Hoje" value={kpis.registrosHoje} sub={`${kpis.totalRegistros} no total`} color="#3182ce" />
                <KpiCard icon={<Scale size={18} />} label="Peso Hoje (kg)" value={kpis.pesoHoje.toLocaleString('pt-BR')} sub={`Total: ${kpis.pesoTotal.toLocaleString('pt-BR')} kg`} color="#48bb78" />
                <KpiCard icon={<ShieldCheck size={18} />} label="Conformidade IA" value={`${kpis.taxaConformidade}%`} sub={`${kpis.analisadosIA ?? kpis.totalRegistros} analisadas · ${kpis.pendentesIA ?? 0} pendentes`} color={kpis.taxaConformidade >= 80 ? '#48bb78' : '#f56565'} />
                <KpiCard icon={<Clock size={18} />} label="Tempo Médio de Check-in" value={kpis.tempoMedioAtendimentoSeg != null ? `${Math.round(kpis.tempoMedioAtendimentoSeg)} s` : '—'} sub={kpis.atendimentosCronometrados ? `DP ${Math.round(kpis.desvioAtendimentoSeg)} s · ${kpis.atendimentosCronometrados} cronometrados` : 'sem registros cronometrados'} color="#805ad5" />
                <KpiCard icon={<Bell size={18} />} label="Alertas Abertos" value={kpis.alertasAbertos} sub="anomalias detectadas" color={kpis.alertasAbertos > 0 ? '#f56565' : '#48bb78'} />
            </div>

            {/* Gráfico de linha — últimos 7 dias */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: '#2d3748', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="#3182ce" /> Entradas — Últimos 7 Dias
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={kpis.ultimos7Dias}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="data" tick={{ fontSize: 11 }} tickFormatter={v => v.substring(5)} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, n) => [v, n === 'quantidade' ? 'Entradas' : 'Peso (kg)']} />
                        <Legend formatter={v => v === 'quantidade' ? 'Entradas' : 'Peso (kg)'} />
                        <Line type="monotone" dataKey="quantidade" stroke="#3182ce" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="peso" stroke="#48bb78" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Barras por tipo */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ color: '#2d3748', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={18} color="#3182ce" /> Peso por Tipo de Resíduo (kg)
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={dadosTipo} layout="vertical">
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={110} />
                            <Tooltip />
                            <Bar dataKey="peso" fill="#3182ce" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Pizza por tipo */}
                <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                    <h3 style={{ color: '#2d3748', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={18} color="#9f7aea" /> Distribuição por Tipo
                    </h3>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie data={dadosPizza} dataKey="peso" nameKey="nome" cx="50%" cy="50%" outerRadius={75} label={({ nome, percent }) => `${(percent * 100).toFixed(0)}%`}>
                                {dadosPizza.map((_, i) => <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v) => [`${v} kg`]} />
                            <Legend formatter={(v) => <span style={{ fontSize: '0.75rem' }}>{v}</span>} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

// ==========================================
// COMPONENTE: TELA DE ALERTAS
// ==========================================
function TelaAlertas({ onContagem }) {
    const [alertas, setAlertas] = useState([]);

    const carregar = useCallback(() => {
        axios.get(`${API_URL}/alertas`).then(res => {
            setAlertas(res.data);
            onContagem(res.data.filter(a => !a.resolvido).length);
        });
    }, [onContagem]);

    useEffect(() => { carregar(); }, [carregar]);

    const resolver = async (id) => {
        await axios.patch(`${API_URL}/alertas/${id}/resolver`);
        carregar();
    };

    const badgeColor = { INCONFORMIDADE: '#f56565', MATERIAL_PROIBIDO: '#e53e3e', SEGURANÇA: '#ed8936' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h2 style={{ color: '#2d3748' }}>Central de Alertas</h2>
            {alertas.length === 0 && <p style={{ color: '#a0aec0' }}>Nenhum alerta registrado.</p>}
            {alertas.map(a => (
                <div key={a.id} style={{
                    background: '#fff', borderRadius: 12, padding: 20,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    borderLeft: `5px solid ${a.resolvido ? '#48bb78' : (badgeColor[a.tipo] || '#3182ce')}`,
                    opacity: a.resolvido ? 0.6 : 1
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <span style={{
                                background: a.resolvido ? '#c6f6d5' : '#fff5f5',
                                color: a.resolvido ? '#22543d' : '#822727',
                                padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800
                            }}>
                                {a.resolvido ? 'RESOLVIDO' : a.tipo}
                            </span>
                            <p style={{ marginTop: 8, fontWeight: 600, color: '#2d3748' }}>Protocolo: {a.protocolo}</p>
                            <p style={{ fontSize: '0.88rem', color: '#4a5568', marginTop: 4 }}>{a.descricao}</p>
                            <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: 4 }}>
                                {new Date(a.criado_em).toLocaleString('pt-BR')}
                            </p>
                        </div>
                        {!a.resolvido && (
                            <button onClick={() => resolver(a.id)} style={{
                                background: '#f0fff4', border: '1px solid #48bb78', color: '#22543d',
                                padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', whiteSpace: 'nowrap'
                            }}>
                                <CheckCircle size={14} /> Resolver
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ==========================================
// COMPONENTE: RASTREABILIDADE
// ==========================================
function TelaRastreabilidade() {
    const [numero, setNumero] = useState('');
    const [resultado, setResultado] = useState(null);
    const [erro, setErro] = useState('');
    const [loading, setLoading] = useState(false);

    const consultar = async () => {
        if (!numero.trim()) return;
        setLoading(true); setErro(''); setResultado(null);
        try {
            const res = await axios.get(`${API_URL}/protocolo/${numero.trim()}`);
            setResultado(res.data);
        } catch {
            setErro('Protocolo não encontrado. Verifique o número e tente novamente.');
        } finally { setLoading(false); }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 style={{ color: '#2d3748' }}>Rastreabilidade por Protocolo</h2>
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                    <input
                        type="number" placeholder="Digite o número do protocolo..."
                        value={numero} onChange={e => setNumero(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && consultar()}
                        style={{
                            flex: 1, padding: '12px 16px', border: '2px solid #e2e8f0',
                            borderRadius: 10, fontSize: '1rem', outline: 'none'
                        }}
                    />
                    <button onClick={consultar} disabled={loading} style={{
                        background: '#3182ce', color: 'white', border: 'none',
                        padding: '12px 24px', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
                    }}>
                        <Search size={16} /> {loading ? 'Buscando...' : 'Consultar'}
                    </button>
                </div>
                {erro && <p style={{ color: '#f56565', marginTop: 12, fontSize: '0.88rem' }}>{erro}</p>}
            </div>

            {resultado && (
                <div style={{ background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', borderTop: '4px solid #48bb78' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div>
                            <span style={{ background: '#c6f6d5', color: '#22543d', padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800 }}>
                                PROTOCOLO VERIFICADO
                            </span>
                            <h3 style={{ marginTop: 8, color: '#2d3748' }}>#{resultado.protocolo}</h3>
                        </div>
                        <QRCodeSVG value={`${window.location.origin}?validar=${resultado.protocolo}`} size={80} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                        {[
                            ['Data/Hora', new Date(resultado.data).toLocaleString('pt-BR')],
                            ['Unidade', resultado.unidade],
                            ['Operador', resultado.usuario],
                            ['Gerador', resultado.gerador],
                            ['Transportador', resultado.transportador],
                            ['Placa', resultado.placa],
                            ['Tipo de Resíduo', resultado.tipoResiduo],
                            ['Peso', `${resultado.peso} kg`],
                        ].map(([label, val]) => (
                            <div key={label}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase' }}>{label}</span>
                                <p style={{ fontWeight: 600, color: '#2d3748', marginTop: 2 }}>{val || '—'}</p>
                            </div>
                        ))}
                    </div>
                    {resultado.observacao && (
                        <div style={{ marginTop: 16, background: '#f7fafc', borderRadius: 8, padding: 12 }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase' }}>Observações</span>
                            <p style={{ marginTop: 4, fontSize: '0.88rem', color: '#4a5568' }}>{resultado.observacao}</p>
                        </div>
                    )}
                    <div style={{ marginTop: 16, background: '#f0fff4', borderLeft: '4px solid #48bb78', borderRadius: 8, padding: 12 }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#22543d', textTransform: 'uppercase' }}>Análise IA</span>
                        <p style={{ marginTop: 4, fontSize: '0.85rem', color: '#2d3748', whiteSpace: 'pre-line' }}>{resultado.analiseIA}</p>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// COMPONENTE: CADASTRO DE USUÁRIOS
// ==========================================
function TelaCadastroUsuarios() {
    const [usuarios, setUsuarios] = useState([]);
    const [form, setForm] = useState({ nome: '', login: '', senha: '', perfil: 'operador', unidade: '' });
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState('');
    const unidades = ["Ecoponto Sul", "Aterro Central", "Transbordo Norte", "Unidade Vila Maria", "Todas"];

    const carregar = () => axios.get(`${API_URL}/usuarios`).then(res => setUsuarios(res.data));
    useEffect(() => { carregar(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErro(''); setSucesso('');
        try {
            await axios.post(`${API_URL}/usuarios`, form);
            setSucesso(`Usuário "${form.nome}" cadastrado com sucesso.`);
            setForm({ nome: '', login: '', senha: '', perfil: 'operador', unidade: '' });
            carregar();
        } catch (err) {
            setErro(err.response?.data?.error || 'Erro ao cadastrar usuário.');
        }
    };

    const toggleStatus = async (id, ativo) => {
        await axios.patch(`${API_URL}/usuarios/${id}/status`, { ativo: !ativo });
        carregar();
    };

    const perfilBadge = { admin: '#3182ce', auditor: '#9f7aea', operador: '#48bb78' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 style={{ color: '#2d3748' }}>Gestão de Usuários</h2>

            {/* Formulário de cadastro */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 28, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: '#2d3748', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserPlus size={18} color="#3182ce" /> Novo Usuário
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="input-group">
                        <label><User size={16} /> Nome Completo</label>
                        <input type="text" value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required />
                    </div>
                    <div className="input-group">
                        <label><Lock size={16} /> Login</label>
                        <input type="text" value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} required />
                    </div>
                    <div className="input-group">
                        <label><Lock size={16} /> Senha</label>
                        <input type="password" value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} required minLength={6} />
                    </div>
                    <div className="input-group">
                        <label><ShieldCheck size={16} /> Perfil</label>
                        <select value={form.perfil} onChange={e => setForm({ ...form, perfil: e.target.value })}>
                            <option value="operador">Operador</option>
                            <option value="auditor">Auditor</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>
                    <div className="input-group" style={{ gridColumn: 'span 2' }}>
                        <label><Building2 size={16} /> Unidade</label>
                        <select value={form.unidade} onChange={e => setForm({ ...form, unidade: e.target.value })}>
                            <option value="">Selecione...</option>
                            {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    {erro && <p style={{ color: '#f56565', gridColumn: 'span 2', fontSize: '0.88rem' }}>{erro}</p>}
                    {sucesso && <p style={{ color: '#22543d', gridColumn: 'span 2', fontSize: '0.88rem', background: '#f0fff4', padding: '8px 12px', borderRadius: 8 }}>{sucesso}</p>}
                    <button type="submit" className="btn-submit" style={{ gridColumn: 'span 2' }}>
                        <UserPlus size={16} /> Cadastrar Usuário
                    </button>
                </form>
            </div>

            {/* Lista de usuários */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ color: '#2d3748', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color="#3182ce" /> Usuários Cadastrados ({usuarios.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {usuarios.map(u => (
                        <div key={u.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0',
                            background: u.ativo ? '#fff' : '#f7fafc', opacity: u.ativo ? 1 : 0.6
                        }}>
                            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%',
                                    background: perfilBadge[u.perfil] || '#3182ce',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800
                                }}>
                                    {u.nome.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p style={{ fontWeight: 700, color: '#2d3748', margin: 0 }}>{u.nome}</p>
                                    <p style={{ fontSize: '0.78rem', color: '#718096', margin: 0 }}>
                                        @{u.login} · {u.unidade || 'Sem unidade'}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span style={{
                                    background: (perfilBadge[u.perfil] || '#3182ce') + '22',
                                    color: perfilBadge[u.perfil] || '#3182ce',
                                    padding: '3px 10px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800
                                }}>
                                    {u.perfil.toUpperCase()}
                                </span>
                                <button onClick={() => toggleStatus(u.id, u.ativo)} style={{
                                    background: u.ativo ? '#fff5f5' : '#f0fff4',
                                    border: `1px solid ${u.ativo ? '#feb2b2' : '#9ae6b4'}`,
                                    color: u.ativo ? '#822727' : '#22543d',
                                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                                    fontSize: '0.75rem', fontWeight: 700
                                }}>
                                    {u.ativo ? 'Desativar' : 'Reativar'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ==========================================
// COMPONENTE: RELATÓRIO DE DESCARGAS
// ==========================================
function TelaRelatorioDescargas() {
    const [filtros, setFiltros] = useState({ unidade: '', tipoResiduo: '', dataInicio: '', dataFim: '' });
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(false);

    const unidades = ["Ecoponto Sul", "Aterro Central", "Transbordo Norte", "Unidade Vila Maria"];
    const tiposResiduo = ["Alvenaria/Entulho", "Madeira", "Plástico/Reciclável", "Poda", "Misturado", "Gesso"];

    const consultar = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filtros.unidade)     params.set('unidade', filtros.unidade);
        if (filtros.tipoResiduo) params.set('tipoResiduo', filtros.tipoResiduo);
        if (filtros.dataInicio)  params.set('dataInicio', filtros.dataInicio);
        if (filtros.dataFim)     params.set('dataFim', filtros.dataFim);
        try {
            const res = await axios.get(`${API_URL}/relatorio/descargas?${params}`);
            setDados(res.data);
        } catch { alert('Erro ao carregar relatório.'); }
        finally { setLoading(false); }
    };

    const baixarPDF = () => {
        const params = new URLSearchParams();
        if (filtros.unidade)     params.set('unidade', filtros.unidade);
        if (filtros.tipoResiduo) params.set('tipoResiduo', filtros.tipoResiduo);
        if (filtros.dataInicio)  params.set('dataInicio', filtros.dataInicio);
        if (filtros.dataFim)     params.set('dataFim', filtros.dataFim);
        window.open(`${API_URL}/relatorio/pdf?${params}`, '_blank');
    };

    const dadosTipo = dados ? Object.entries(dados.porTipo).map(([nome, v]) => ({ nome, peso: parseFloat(v.peso.toFixed(1)), qtd: v.quantidade })) : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 style={{ color: '#2d3748' }}>Relatório de Descargas</h2>

            {/* Filtros */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                    <div className="input-group">
                        <label><Building2 size={16} /> Unidade</label>
                        <select value={filtros.unidade} onChange={e => setFiltros({ ...filtros, unidade: e.target.value })}>
                            <option value="">Todas</option>
                            {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label><SiMaterialformkdocs size={16} /> Tipo de Resíduo</label>
                        <select value={filtros.tipoResiduo} onChange={e => setFiltros({ ...filtros, tipoResiduo: e.target.value })}>
                            <option value="">Todos</option>
                            {tiposResiduo.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="input-group">
                        <label>Data Início</label>
                        <input type="date" value={filtros.dataInicio} onChange={e => setFiltros({ ...filtros, dataInicio: e.target.value })} />
                    </div>
                    <div className="input-group">
                        <label>Data Fim</label>
                        <input type="date" value={filtros.dataFim} onChange={e => setFiltros({ ...filtros, dataFim: e.target.value })} />
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                    <button onClick={consultar} disabled={loading} className="btn-submit" style={{ flex: 1 }}>
                        {loading ? 'Consultando...' : 'Gerar Relatório'}
                    </button>
                    {dados && (
                        <button onClick={baixarPDF} style={{
                            background: '#2d3748', color: 'white', border: 'none',
                            padding: '12px 20px', borderRadius: 10, cursor: 'pointer',
                            fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8
                        }}>
                            <Download size={16} /> Exportar PDF
                        </button>
                    )}
                </div>
            </div>

            {dados && (
                <>
                    {/* KPIs do relatório */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
                        <KpiCard icon={<FileText size={18} />} label="Registros" value={dados.totalRegistros} color="#3182ce" />
                        <KpiCard icon={<Scale size={18} />} label="Peso Total (kg)" value={dados.pesoTotal.toLocaleString('pt-BR')} color="#48bb78" />
                        <KpiCard icon={<GiWeight size={18} />} label="Peso Médio (kg)" value={dados.pesoMedio.toLocaleString('pt-BR')} color="#ed8936" />
                        <KpiCard icon={<ShieldCheck size={18} />} label="Conformidade" value={`${dados.taxaConformidade}%`} sub={`${dados.analisadosIA ?? dados.totalRegistros} analisadas · ${dados.pendentesIA ?? 0} pendentes`} color={dados.taxaConformidade >= 80 ? '#48bb78' : '#f56565'} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Gráfico por tipo */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                            <h3 style={{ color: '#2d3748', marginBottom: 16 }}>Peso por Tipo de Resíduo</h3>
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={dadosTipo}>
                                    <XAxis dataKey="nome" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={50} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="peso" fill="#3182ce" radius={[4, 4, 0, 0]} name="Peso (kg)" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Ranking de geradores */}
                        <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                            <h3 style={{ color: '#2d3748', marginBottom: 16 }}>Ranking de Geradores</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {dados.rankingGeradores.slice(0, 5).map((g, i) => (
                                    <div key={g.nome} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{
                                            width: 24, height: 24, borderRadius: '50%', background: CORES_GRAFICO[i],
                                            color: 'white', fontSize: '0.7rem', fontWeight: 800,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                        }}>{i + 1}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{g.nome}</span>
                                                <span style={{ fontSize: '0.78rem', color: '#718096' }}>{g.peso.toFixed(0)} kg</span>
                                            </div>
                                            <div style={{ background: '#e2e8f0', borderRadius: 4, height: 6, marginTop: 4 }}>
                                                <div style={{
                                                    width: `${(g.peso / dados.rankingGeradores[0].peso * 100).toFixed(0)}%`,
                                                    background: CORES_GRAFICO[i], height: '100%', borderRadius: 4
                                                }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Série temporal */}
                    {dados.serieTemporal.length > 1 && (
                        <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                            <h3 style={{ color: '#2d3748', marginBottom: 16 }}>Evolução Temporal das Descargas</h3>
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={dados.serieTemporal}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="quantidade" stroke="#3182ce" strokeWidth={2} name="Entradas" dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="peso" stroke="#48bb78" strokeWidth={2} name="Peso (kg)" dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Tabela */}
                    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ color: '#2d3748' }}>Registros Detalhados ({dados.registros.length})</h3>
                            <a href={`${API_URL}/download-csv`} style={{
                                background: '#2d3748', color: 'white', padding: '8px 14px',
                                borderRadius: 8, textDecoration: 'none', fontSize: '0.82rem',
                                fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6
                            }}>
                                <Download size={14} /> CSV
                            </a>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <thead>
                                <tr style={{ background: '#f7fafc' }}>
                                    {['Protocolo', 'Data', 'Unidade', 'Gerador', 'Resíduo', 'Transportador', 'Placa', 'Peso (kg)', 'IA'].map(h => (
                                        <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: '#718096', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {dados.registros.map((r, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '9px 8px', fontWeight: 700, color: '#3182ce' }}>{r.protocolo}</td>
                                        <td style={{ padding: '9px 8px' }}>{new Date(r.data).toLocaleDateString('pt-BR')}</td>
                                        <td style={{ padding: '9px 8px' }}>{r.unidade}</td>
                                        <td style={{ padding: '9px 8px' }}>{r.gerador}</td>
                                        <td style={{ padding: '9px 8px' }}>{r.tipoResiduo}</td>
                                        <td style={{ padding: '9px 8px' }}>{r.transportador}</td>
                                        <td style={{ padding: '9px 8px' }}>{r.placa}</td>
                                        <td style={{ padding: '9px 8px', fontWeight: 600 }}>{r.peso}</td>
                                        <td style={{ padding: '9px 8px' }}>
                                            <span style={{
                                                background: COR_IA[situacaoIA(r)].bg,
                                                color: COR_IA[situacaoIA(r)].fg,
                                                padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700
                                            }}>
                                                {ROTULO_IA[situacaoIA(r)]}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

// ==========================================
// COMPONENTE: CHECK-IN (original preservado)
// ==========================================
function TelaCheckin({ metaData, API_URL }) {
    const [dados, setDados] = useState({
        unidade: '', usuario: '', transportador: '', transportadorId: null,
        placa: '', gerador: '', geradorId: null, tipoResiduo: '', peso: '', observacao: ''
    });
    const [placasFiltradas, setPlacasFiltradas] = useState([]);
    const [preview, setPreview] = useState(null);
    const [fotoArquivo, setFotoArquivo] = useState(null);
    const [protocolo, setProtocolo] = useState(null);
    const [analiseIA, setAnaliseIA] = useState('');
    const [loading, setLoading] = useState(false);
    // [v2.3.0] Início do atendimento: primeira interação com o formulário (métrica de eficiência no gate)
    const [inicioAtendimento, setInicioAtendimento] = useState(null);
    useEffect(() => {
        if (!inicioAtendimento && (fotoArquivo || Object.values(dados).some(v => v)))
            setInicioAtendimento(new Date().toISOString());
    }, [dados, fotoArquivo, inicioAtendimento]);

    const handleEmpresaChange = (e) => {
        const nome = e.target.value;
        const emp = metaData.transportadores.find(t => t.nome === nome);
        setPlacasFiltradas(emp ? emp.placas : []);
        setDados({ ...dados, transportador: nome, transportadorId: emp ? emp.id : null, placa: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData();
        Object.keys(dados).forEach(key => formData.append(key, dados[key]));
        formData.append('imagem', fotoArquivo);
        if (inicioAtendimento) formData.append('inicioAtendimento', inicioAtendimento);
        try {
            const res = await axios.post(`${API_URL}/checkin`, formData);
            setProtocolo(res.data.protocolo);
            setAnaliseIA(res.data.analiseIA);
        } catch (err) {
            const det = err.response?.data?.detalhes;
            alert(det?.length ? `Registro não aceito:\n- ${det.join('\n- ')}` : "Erro no envio");
        }
        finally { setLoading(false); }
    };

    const gerarPDF = () => {
        const elemento = document.getElementById('area-protocolo');
        if (!elemento) return;
        html2pdf().set({
            margin: 0.5, filename: `PIROO-Protocolo-${protocolo}.pdf`,
            image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).from(elemento).save();
    };

    if (protocolo) return (
        <div className="resultado-container">
            <div id="area-protocolo" className="protocolo-pdf-box">
                <div className="pdf-header">
                    <Building2 size={32} color="#3182ce" />
                    <h2>Comprovante de Check-in Digital</h2>
                    <p>Unidade: {dados.unidade}</p>
                </div>
                <div className="pdf-body">
                    <div className="pdf-grid-info">
                        <p><strong>Protocolo:</strong> {protocolo}</p>
                        <p><strong>Data:</strong> {new Date().toLocaleString()}</p>
                        <p><strong>Operador:</strong> {dados.usuario}</p>
                        <p><strong>Gerador:</strong> {dados.gerador} (ID: {dados.geradorId || 'N/A'})</p>
                        <p><strong>Transportador:</strong> {dados.transportador} (ID: {dados.transportadorId || 'N/A'})</p>
                        <p><strong>Placa:</strong> {dados.placa}</p>
                        <p><strong>Resíduo:</strong> {dados.tipoResiduo}</p>
                        <p><strong>Peso:</strong> {dados.peso} kg</p>
                        <p><strong>Observações:</strong> {dados.observacao || "Nenhuma"}</p>
                    </div>
                    <div className="pdf-section ia-box">
                        <strong>Análise Técnica da Carga com IA</strong>
                        <div style={{ whiteSpace: 'pre-line', fontSize: '0.9rem', marginTop: '5px' }}>{analiseIA}</div>
                    </div>
                    <div className="pdf-footer-qr">
                        <QRCodeSVG value={`${window.location.origin}?validar=${protocolo}`} size={120} />
                        <p>Validação de Autenticidade Digital</p>
                    </div>
                </div>
            </div>
            <div className="acoes-pos-envio">
                <button onClick={gerarPDF} className="btn-pdf"><FileText size={18} /> Salvar PDF</button>
                <button style={{ backgroundColor: '#4887bb' }} className="btn-pdf" onClick={() => window.location.reload()}><PlusCircle size={18} /> Novo Check-in</button>
            </div>
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="checkin-form">
            <div className="input-group">
                <label><User size={24} /> Operador</label>
                <select onChange={e => setDados({ ...dados, usuario: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {metaData.operadores?.map(u => <option key={u.id} value={u.nome}>{u.nome}</option>)}
                </select>
            </div>
            <div className="input-group">
                <label><Building2 size={24} /> Unidade</label>
                <select onChange={e => setDados({ ...dados, unidade: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {metaData.unidades.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
            </div>
            <div className="input-group">
                <label><Truck size={24} /> Transportador</label>
                <select value={dados.transportador} onChange={handleEmpresaChange} required>
                    <option value="">Selecione...</option>
                    {metaData.transportadores.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
            </div>
            <div className="input-group">
                <label><FaIdCard size={24} /> Placa</label>
                <select value={dados.placa} onChange={e => setDados({ ...dados, placa: e.target.value })} required disabled={!placasFiltradas.length}>
                    <option value="">Selecione...</option>
                    {placasFiltradas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
            </div>
            <div className="input-group">
                <label><FiBox size={24} /> Gerador</label>
                <select value={dados.gerador} onChange={(e) => {
                    const nome = e.target.value;
                    const obj = metaData.geradores.find(g => g.nome === nome);
                    setDados({ ...dados, gerador: nome, geradorId: obj ? obj.id : null });
                }} required>
                    <option value="">Selecione...</option>
                    {metaData.geradores.map(g => <option key={g.id} value={g.nome}>{g.nome}</option>)}
                </select>
            </div>
            <div className="input-group">
                <label><SiMaterialformkdocs size={24} /> Tipo de Resíduo</label>
                <select onChange={e => setDados({ ...dados, tipoResiduo: e.target.value })} required>
                    <option value="">Selecione...</option>
                    {metaData.tiposResiduo.map(tr => <option key={tr} value={tr}>{tr}</option>)}
                </select>
            </div>
            <div className="input-group">
                <label><GiWeight size={24} /> Peso (kg)</label>
                <input type="number" value={dados.peso} onChange={e => setDados({ ...dados, peso: e.target.value })} required />
            </div>
            <div className="input-group full-width">
                <label><MessageSquare size={24} /> Observação</label>
                <textarea value={dados.observacao} onChange={e => setDados({ ...dados, observacao: e.target.value })} rows="2" />
            </div>
            <div className="camera-container full-width">
                {preview && <img src={preview} alt="Preview" className="image-preview" />}
                <input type="file" accept="image/*" capture="environment" id="cam" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) { setFotoArquivo(e.target.files[0]); setPreview(URL.createObjectURL(e.target.files[0])); } }} />
                <label htmlFor="cam" className={`btn-camera ${fotoArquivo ? 'foto-ok' : ''}`}>
                    <Camera /> {fotoArquivo ? "Foto OK" : "Capturar Carga"}
                </label>
            </div>
            <button type="submit" className="btn-submit full-width" disabled={loading || !fotoArquivo}>
                {loading ? "Analisando com IA..." : "Prosseguir"}
            </button>
        </form>
    );
}

// ==========================================
// COMPONENTE: TELA DE CADASTROS
// ==========================================

// --- Sub-componente reutilizável: linha de item com toggle de status ---
function ItemLista({ label, sub, ativo, onToggle, onSelect, selecionado }) {
    return (
        <div onClick={onSelect} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '11px 16px', borderRadius: 10,
            border: `1px solid ${selecionado ? '#3182ce' : '#e2e8f0'}`,
            background: selecionado ? '#ebf8ff' : '#fff',
            cursor: onSelect ? 'pointer' : 'default',
            opacity: ativo ? 1 : 0.55, transition: 'all 0.15s'
        }}>
            <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#2d3748', margin: 0, fontSize: '0.88rem' }}>{label}</p>
                {sub && <p style={{ fontSize: '0.75rem', color: '#718096', margin: 0 }}>{sub}</p>}
            </div>
            {!ativo && <span style={{ fontSize: '0.65rem', background: '#edf2f7', color: '#718096', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>INATIVO</span>}
            <button onClick={e => { e.stopPropagation(); onToggle(); }} style={{
                background: ativo ? '#fff5f5' : '#f0fff4',
                border: `1px solid ${ativo ? '#feb2b2' : '#9ae6b4'}`,
                color: ativo ? '#822727' : '#22543d',
                padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap'
            }}>{ativo ? 'Desativar' : 'Reativar'}</button>
        </div>
    );
}

// --- Sub-componente: cabeçalho de seção com botão de adicionar ---
function SecaoHeader({ titulo, total, onAdd, adicionando }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
                <h3 style={{ color: '#2d3748', margin: 0 }}>{titulo}</h3>
                <p style={{ fontSize: '0.78rem', color: '#a0aec0', margin: '2px 0 0' }}>{total} registro{total !== 1 ? 's' : ''} cadastrado{total !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={onAdd} style={{
                background: adicionando ? '#edf2f7' : '#3182ce', color: adicionando ? '#4a5568' : 'white',
                border: 'none', padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
                fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8
            }}>
                <PlusCircle size={15} /> {adicionando ? 'Cancelar' : 'Novo cadastro'}
            </button>
        </div>
    );
}

// --- Sub-componente: campo de formulário ---
function Campo({ label, children }) {
    return (
        <div className="input-group">
            <label style={{ fontSize: '0.8rem' }}>{label}</label>
            {children}
        </div>
    );
}

// --- Seção: Unidades ---
function SecaoUnidades() {
    const [itens, setItens] = useState([]);
    const [form, setForm] = useState({ nome: '', endereco: '', responsavel: '' });
    const [adicionando, setAdicionando] = useState(false);
    const [feedback, setFeedback] = useState('');

    const carregar = () => axios.get(`${API_URL}/unidades`)
        .then(r => setItens(r.data))
        .catch(err => console.error('Erro ao carregar unidades:', err.response?.status, err.message));
    useEffect(() => { carregar(); }, []);

    const salvar = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/unidades`, form);
            setForm({ nome: '', endereco: '', responsavel: '' });
            setAdicionando(false);
            setFeedback(`Unidade "${form.nome}" cadastrada com sucesso.`);
            carregar();
            setTimeout(() => setFeedback(''), 4000);
        } catch (err) { setFeedback(err.response?.data?.error || 'Erro ao salvar.'); }
    };

    const toggle = async (id, ativo) => {
        await axios.patch(`${API_URL}/unidades/${id}`, { ativo: !ativo });
        carregar();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecaoHeader titulo="Unidades Operacionais" total={itens.length} onAdd={() => setAdicionando(v => !v)} adicionando={adicionando} />

            {adicionando && (
                <form onSubmit={salvar} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Campo label="Nome da unidade *">
                        <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required placeholder="Ex: Ecoponto Norte" />
                    </Campo>
                    <Campo label="Responsável">
                        <input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} placeholder="Nome do responsável" />
                    </Campo>
                    <Campo label="Endereço" >
                        <input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço completo" style={{ gridColumn: 'span 2' }} />
                    </Campo>
                    <button type="submit" className="btn-submit" style={{ gridColumn: 'span 2' }}>Salvar Unidade</button>
                </form>
            )}

            {feedback && <p style={{ color: feedback.includes('sucesso') ? '#22543d' : '#822727', background: feedback.includes('sucesso') ? '#f0fff4' : '#fff5f5', padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem' }}>{feedback}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itens.map(u => (
                    <ItemLista key={u.id} label={u.nome}
                        sub={[u.responsavel, u.endereco].filter(Boolean).join(' · ')}
                        ativo={!!u.ativo} onToggle={() => toggle(u.id, u.ativo)} />
                ))}
            </div>
        </div>
    );
}

// --- Seção: Transportadores ---
function SecaoTransportadores({ onTransportadorSelecionado, transportadorSelecionado }) {
    const [itens, setItens] = useState([]);
    const [form, setForm] = useState({ nome: '', cnpj: '', contato: '' });
    const [adicionando, setAdicionando] = useState(false);
    const [feedback, setFeedback] = useState('');

    const carregar = () => axios.get(`${API_URL}/transportadores`)
        .then(r => setItens(r.data))
        .catch(err => console.error('Erro ao carregar transportadores:', err.response?.status, err.message));
    useEffect(() => { carregar(); }, []);

    const salvar = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/transportadores`, form);
            setForm({ nome: '', cnpj: '', contato: '' });
            setAdicionando(false);
            setFeedback(`Transportador "${form.nome}" cadastrado.`);
            carregar();
            setTimeout(() => setFeedback(''), 4000);
        } catch (err) { setFeedback(err.response?.data?.error || 'Erro ao salvar.'); }
    };

    const toggle = async (id, ativo) => {
        await axios.patch(`${API_URL}/transportadores/${id}`, { ativo: !ativo });
        carregar();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecaoHeader titulo="Transportadores Homologados" total={itens.length} onAdd={() => setAdicionando(v => !v)} adicionando={adicionando} />

            {adicionando && (
                <form onSubmit={salvar} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Campo label="Razão social *">
                        <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required placeholder="Ex: TransLog Soluções" />
                    </Campo>
                    <Campo label="CNPJ">
                        <input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                    </Campo>
                    <Campo label="Contato" >
                        <input value={form.contato} onChange={e => setForm({ ...form, contato: e.target.value })} placeholder="Telefone ou e-mail" />
                    </Campo>
                    <button type="submit" className="btn-submit" style={{ gridColumn: 'span 2' }}>Salvar Transportador</button>
                </form>
            )}

            {feedback && <p style={{ color: feedback.includes('cadastrado') ? '#22543d' : '#822727', background: feedback.includes('cadastrado') ? '#f0fff4' : '#fff5f5', padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem' }}>{feedback}</p>}

            <p style={{ fontSize: '0.78rem', color: '#718096', margin: 0 }}>
                Selecione um transportador para gerenciar suas placas na aba <strong>Veículos</strong>.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itens.map(t => (
                    <ItemLista key={t.id} label={t.nome}
                        sub={[t.cnpj, t.contato].filter(Boolean).join(' · ')}
                        ativo={!!t.ativo}
                        onToggle={() => toggle(t.id, t.ativo)}
                        selecionado={transportadorSelecionado?.id === t.id}
                        onSelect={() => onTransportadorSelecionado(t)} />
                ))}
            </div>
        </div>
    );
}

// --- Seção: Veículos (placas por transportador) ---
function SecaoVeiculos({ transportadorSelecionado }) {
    const [veiculos, setVeiculos] = useState([]);
    const [todos, setTodos] = useState([]);
    const [form, setForm] = useState({ placa: '', tipo: '' });
    const [adicionando, setAdicionando] = useState(false);
    const [feedback, setFeedback] = useState('');

    const carregarTodos = () => axios.get(`${API_URL}/veiculos`)
        .then(r => setTodos(r.data))
        .catch(err => console.error('Erro ao carregar veículos:', err.response?.status, err.message));

    useEffect(() => { carregarTodos(); }, []);

    useEffect(() => {
        if (transportadorSelecionado) {
            setVeiculos(todos.filter(v => v.transportador_id === transportadorSelecionado.id));
        } else {
            setVeiculos(todos);
        }
    }, [transportadorSelecionado, todos]);

    const salvar = async (e) => {
        e.preventDefault();
        if (!transportadorSelecionado) return;
        try {
            await axios.post(`${API_URL}/veiculos`, { ...form, transportador_id: transportadorSelecionado.id });
            setForm({ placa: '', tipo: '' });
            setAdicionando(false);
            setFeedback(`Placa "${form.placa}" cadastrada.`);
            carregarTodos();
            setTimeout(() => setFeedback(''), 4000);
        } catch (err) { setFeedback(err.response?.data?.error || 'Erro ao salvar.'); }
    };

    const toggle = async (id, ativo) => {
        await axios.patch(`${API_URL}/veiculos/${id}`, { ativo: !ativo });
        carregarTodos();
    };

    const titulo = transportadorSelecionado
        ? `Veículos — ${transportadorSelecionado.nome}`
        : 'Veículos (selecione um transportador)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecaoHeader titulo={titulo} total={veiculos.length}
                onAdd={() => setAdicionando(v => !v)} adicionando={adicionando} />

            {!transportadorSelecionado && (
                <div style={{ background: '#fffaf0', border: '1px solid #fbd38d', borderRadius: 10, padding: '12px 16px', fontSize: '0.85rem', color: '#744210' }}>
                    Acesse a aba <strong>Transportadores</strong>, clique em um registro e retorne aqui para gerenciar as placas.
                </div>
            )}

            {adicionando && transportadorSelecionado && (
                <form onSubmit={salvar} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Campo label="Placa *">
                        <input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} required placeholder="ABC-1234" maxLength={8} />
                    </Campo>
                    <Campo label="Tipo de veículo">
                        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
                            <option value="">Selecione...</option>
                            <option value="Caminhão Basculante">Caminhão Basculante</option>
                            <option value="Caminhão Caçamba">Caminhão Caçamba</option>
                            <option value="Caminhão Baú">Caminhão Baú</option>
                            <option value="Caminhão Poliguindaste">Caminhão Poliguindaste</option>
                            <option value="Utilitário">Utilitário</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </Campo>
                    <button type="submit" className="btn-submit" style={{ gridColumn: 'span 2' }}>Salvar Veículo</button>
                </form>
            )}

            {feedback && <p style={{ color: feedback.includes('cadastrada') ? '#22543d' : '#822727', background: feedback.includes('cadastrada') ? '#f0fff4' : '#fff5f5', padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem' }}>{feedback}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {veiculos.map(v => (
                    <ItemLista key={v.id}
                        label={v.placa}
                        sub={[v.tipo, v.transportador_nome].filter(Boolean).join(' · ')}
                        ativo={!!v.ativo}
                        onToggle={() => toggle(v.id, v.ativo)} />
                ))}
                {veiculos.length === 0 && transportadorSelecionado && (
                    <p style={{ color: '#a0aec0', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                        Nenhum veículo cadastrado para este transportador.
                    </p>
                )}
            </div>
        </div>
    );
}

// --- Seção: Geradores ---
function SecaoGeradores() {
    const [itens, setItens] = useState([]);
    const [form, setForm] = useState({ nome: '', cnpj: '', contato: '' });
    const [adicionando, setAdicionando] = useState(false);
    const [feedback, setFeedback] = useState('');

    const carregar = () => axios.get(`${API_URL}/geradores`)
        .then(r => setItens(r.data))
        .catch(err => console.error('Erro ao carregar geradores:', err.response?.status, err.message));
    useEffect(() => { carregar(); }, []);

    const salvar = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_URL}/geradores`, form);
            setForm({ nome: '', cnpj: '', contato: '' });
            setAdicionando(false);
            setFeedback(`Gerador "${form.nome}" cadastrado.`);
            carregar();
            setTimeout(() => setFeedback(''), 4000);
        } catch (err) { setFeedback(err.response?.data?.error || 'Erro ao salvar.'); }
    };

    const toggle = async (id, ativo) => {
        await axios.patch(`${API_URL}/geradores/${id}`, { ativo: !ativo });
        carregar();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SecaoHeader titulo="Geradores de Resíduos" total={itens.length} onAdd={() => setAdicionando(v => !v)} adicionando={adicionando} />

            {adicionando && (
                <form onSubmit={salvar} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <Campo label="Razão social / Nome *">
                        <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} required placeholder="Ex: Construtora Beta" />
                    </Campo>
                    <Campo label="CNPJ / CPF">
                        <input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
                    </Campo>
                    <Campo label="Contato">
                        <input value={form.contato} onChange={e => setForm({ ...form, contato: e.target.value })} placeholder="Telefone ou e-mail" />
                    </Campo>
                    <button type="submit" className="btn-submit" style={{ gridColumn: 'span 2' }}>Salvar Gerador</button>
                </form>
            )}

            {feedback && <p style={{ color: feedback.includes('cadastrado') ? '#22543d' : '#822727', background: feedback.includes('cadastrado') ? '#f0fff4' : '#fff5f5', padding: '8px 14px', borderRadius: 8, fontSize: '0.85rem' }}>{feedback}</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {itens.map(g => (
                    <ItemLista key={g.id} label={g.nome}
                        sub={[g.cnpj, g.contato].filter(Boolean).join(' · ')}
                        ativo={!!g.ativo} onToggle={() => toggle(g.id, g.ativo)} />
                ))}
            </div>
        </div>
    );
}

// --- Componente principal: TelaCadastros com sub-menu ---
function TelaCadastros() {
    const [secao, setSecao] = useState('unidades');
    const [transportadorSelecionado, setTransportadorSelecionado] = useState(null);

    const abas = [
        { id: 'unidades',        label: 'Unidades',        icon: <Building2 size={15} /> },
        { id: 'transportadores', label: 'Transportadores', icon: <Truck size={15} /> },
        { id: 'veiculos',        label: 'Veículos',        icon: <FaIdCard size={15} /> },
        { id: 'geradores',       label: 'Geradores',       icon: <FiBox size={15} /> },
    ];

    const handleTransportador = (t) => {
        setTransportadorSelecionado(t);
        setSecao('veiculos');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Cabeçalho */}
            <div className="gate-explanation-card">
                <div className="gate-header-top">
                    <span className="gate-status-tag">Gestão de Cadastros</span>
                </div>
                <div className="gate-description" style={{ marginTop: 8 }}>
                    <p>
                        Módulo de manutenção dos dados mestres do sistema. Os registros cadastrados aqui
                        alimentam diretamente o formulário de check-in de gate, substituindo os dados
                        fixos anteriores por uma base dinâmica e persistente no banco de dados.
                    </p>
                </div>
            </div>

            {/* Sub-menu de abas */}
            <div style={{
                display: 'flex', gap: 8, background: '#fff',
                padding: 8, borderRadius: 14,
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
            }}>
                {abas.map(a => (
                    <button key={a.id}
                        onClick={() => setSecao(a.id)}
                        style={{
                            flex: 1, padding: '10px 8px', border: 'none', borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s',
                            background: secao === a.id ? '#ebf8ff' : 'transparent',
                            color: secao === a.id ? '#2c5282' : '#718096'
                        }}>
                        {a.icon} {a.label}
                        {a.id === 'veiculos' && transportadorSelecionado && (
                            <span style={{ background: '#3182ce', color: 'white', borderRadius: 20, fontSize: '0.6rem', padding: '1px 6px', fontWeight: 800 }}>
                                {transportadorSelecionado.nome.split(' ')[0]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Conteúdo da aba ativa */}
            <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                {secao === 'unidades'        && <SecaoUnidades />}
                {secao === 'transportadores' && <SecaoTransportadores onTransportadorSelecionado={handleTransportador} transportadorSelecionado={transportadorSelecionado} />}
                {secao === 'veiculos'        && <SecaoVeiculos transportadorSelecionado={transportadorSelecionado} />}
                {secao === 'geradores'       && <SecaoGeradores />}
            </div>
        </div>
    );
}

// ==========================================
// COMPONENTE: DOCUMENTAÇÃO DA API
// ==========================================
const API_MODULES = [
    {
        title: "Autenticação", color: "#533AB7", endpoints: [
            {
                method: "POST", path: "/login", desc: "Autenticar usuário e obter dados da sessão", auth: false,
                params: `{\n  "login": "admin",\n  "senha": "admin123"\n}`,
                response: `{\n  "id": 1,\n  "nome": "Administrador",\n  "login": "admin",\n  "perfil": "admin",\n  "unidade": "Todas"\n}`
            }
        ]
    },
    {
        title: "Usuários", color: "#0F6E56", endpoints: [
            {
                method: "GET", path: "/usuarios", desc: "Listar todos os usuários cadastrados", auth: true,
                params: `(sem corpo)`,
                response: `[\n  { "id": 1, "nome": "Administrador", "login": "admin",\n    "perfil": "admin", "unidade": "Todas", "ativo": 1 }\n]`
            },
            {
                method: "POST", path: "/usuarios", desc: "Cadastrar novo usuário no sistema", auth: true,
                params: `{\n  "nome": "João Silva",\n  "login": "joao",\n  "senha": "senha123",\n  "perfil": "operador",\n  "unidade": "Ecoponto Sul"\n}`,
                response: `{ "id": 2, "nome": "João Silva", "login": "joao",\n  "perfil": "operador", "unidade": "Ecoponto Sul" }`
            },
            {
                method: "PATCH", path: "/usuarios/:id/status", desc: "Ativar ou desativar um usuário", auth: true,
                params: `{ "ativo": false }`,
                response: `{ "ok": true }`
            }
        ]
    },
    {
        title: "Operadores", color: "#185FA5", endpoints: [
            {
                method: "GET", path: "/operadores", desc: "Listar operadores ativos (uso no check-in)", auth: false,
                params: `(sem corpo)`,
                response: `[\n  { "id": 1, "nome": "Administrador", "unidade": "Todas" },\n  { "id": 2, "nome": "João Silva", "unidade": "Ecoponto Sul" }\n]`
            }
        ]
    },
    {
        title: "Dados Mestres", color: "#854F0B", endpoints: [
            {
                method: "GET", path: "/homologados", desc: "Listar unidades, tipos de resíduo, geradores e transportadores homologados", auth: false,
                params: `(sem corpo)`,
                response: `{\n  "unidades": ["Ecoponto Sul", "Aterro Central"],\n  "tiposResiduo": ["Alvenaria/Entulho", "Madeira"],\n  "geradores": [{ "id": 1, "nome": "Construtora Alfa" }],\n  "transportadores": [{ "id": 101, "nome": "TransLog Soluções", "placas": ["ABC-1234"] }]\n}`
            }
        ]
    },
    {
        title: "Check-in de Gate", color: "#639922", endpoints: [
            {
                method: "POST", path: "/checkin", desc: "Registrar entrada de veículo com análise de imagem por IA (multipart/form-data)", auth: false,
                params: `Content-Type: multipart/form-data\n\nunidade, transportador, transportadorId,\nplaca, gerador, geradorId, tipoResiduo,\npeso, observacao, usuario, imagem (arquivo)`,
                response: `{\n  "protocolo": 482931,\n  "data": "2025-07-10T14:32:00.000Z",\n  "analiseIA": "Conformidade: Sim.\\nParecer: ..."\n}`
            }
        ]
    },
    {
        title: "Histórico e Auditoria", color: "#3C3489", endpoints: [
            {
                method: "GET", path: "/historico", desc: "Retornar todos os registros de check-in", auth: false,
                params: `(sem corpo)`,
                response: `[\n  { "protocolo": 482931, "data": "...", "unidade": "Ecoponto Sul",\n    "transportador": "TransLog", "peso": 1500, "analiseIA": "..." }\n]`
            },
            {
                method: "GET", path: "/download-csv", desc: "Download do histórico completo em formato CSV", auth: false,
                params: `(sem corpo — retorna arquivo CSV)`,
                response: `Protocolo;Data;Unidade;Operador;Transportador;...\n482931;2025-07-10;Ecoponto Sul;...`
            }
        ]
    },
    {
        title: "Relatórios", color: "#D85A30", endpoints: [
            {
                method: "GET", path: "/relatorio/descargas", desc: "Relatório agregado com filtros combinados por unidade, tipo e período", auth: false,
                params: `Query params (todos opcionais):\n?unidade=Ecoponto Sul\n&tipoResiduo=Madeira\n&dataInicio=2025-01-01\n&dataFim=2025-12-31`,
                response: `{ "totalRegistros": 42, "pesoTotal": 58320.50,\n  "taxaConformidade": 92.8, "porTipo": {...},\n  "rankingGeradores": [...], "serieTemporal": [...] }`
            },
            {
                method: "GET", path: "/relatorio/pdf", desc: "Gerar e baixar PDF do relatório (mesmos filtros de /descargas)", auth: false,
                params: `?unidade=Ecoponto Sul&dataInicio=2025-01-01&dataFim=2025-12-31`,
                response: `(retorna arquivo PDF binário para download)`
            },
            {
                method: "GET", path: "/relatorio/transportador", desc: "Registros filtrados por ID de transportador homologado", auth: false,
                params: `?id=101`,
                response: `[\n  { "protocolo": 482931, "transportador": "TransLog",\n    "fotoUrl": "https://backend.onrender.com/uploads/..." }\n]`
            },
            {
                method: "GET", path: "/relatorio/gerador", desc: "Registros filtrados por ID de gerador", auth: false,
                params: `?id=1`,
                response: `[\n  { "protocolo": 482931, "gerador": "Construtora Alfa",\n    "fotoUrl": "https://backend.onrender.com/uploads/..." }\n]`
            }
        ]
    },
    {
        title: "Dashboard", color: "#185FA5", endpoints: [
            {
                method: "GET", path: "/dashboard/kpis", desc: "KPIs consolidados para o painel em tempo real", auth: false,
                params: `(sem corpo)`,
                response: `{ "totalRegistros": 128, "registrosHoje": 7,\n  "pesoTotal": 184500.00, "pesoHoje": 9800.00,\n  "taxaConformidade": 91.4, "alertasAbertos": 3,\n  "porTipo": {...}, "ultimos7Dias": [...] }`
            }
        ]
    },
    {
        title: "Alertas", color: "#A32D2D", endpoints: [
            {
                method: "GET", path: "/alertas", desc: "Listar alertas de anomalia detectados automaticamente pela IA", auth: false,
                params: `(sem corpo)`,
                response: `[\n  { "id": 1, "protocolo": 482931, "tipo": "INCONFORMIDADE",\n    "descricao": "IA detectou inconformidade...",\n    "resolvido": 0, "criado_em": "2025-07-10 14:32:00" }\n]`
            },
            {
                method: "PATCH", path: "/alertas/:id/resolver", desc: "Marcar alerta como resolvido", auth: false,
                params: `(sem corpo — apenas o ID na URL)\nPATCH /alertas/1/resolver`,
                response: `{ "ok": true }`
            }
        ]
    },
    {
        title: "Rastreabilidade Pública", color: "#0F6E56", endpoints: [
            {
                method: "GET", path: "/protocolo/:numero", desc: "Consulta pública de protocolo via QR Code, sem necessidade de autenticação", auth: false,
                params: `Parâmetro de rota:\nGET /protocolo/482931`,
                response: `{ "protocolo": 482931, "data": "2025-07-10T14:32:00.000Z",\n  "unidade": "Ecoponto Sul", "transportador": "TransLog",\n  "placa": "ABC-1234", "tipoResiduo": "Alvenaria/Entulho",\n  "peso": 1500, "analiseIA": "Conformidade: Sim..." }`
            }
        ]
    }
];

const METODO_STYLE = {
    GET:   { bg: '#ebf8ff', color: '#2c5282' },
    POST:  { bg: '#f0fff4', color: '#22543d' },
    PATCH: { bg: '#fffaf0', color: '#7b341e' }
};

function TelaDocumentacao() {
    const [abertos, setAbertos] = useState(new Set());
    const [busca, setBusca] = useState('');
    const BASE = API_URL;

    const toggle = (key) => {
        setAbertos(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    const termo = busca.toLowerCase();
    const modulosFiltrados = API_MODULES.map(mod => ({
        ...mod,
        endpoints: mod.endpoints.filter(ep =>
            !termo ||
            ep.path.toLowerCase().includes(termo) ||
            ep.desc.toLowerCase().includes(termo) ||
            ep.method.toLowerCase().includes(termo) ||
            mod.title.toLowerCase().includes(termo)
        )
    })).filter(mod => mod.endpoints.length > 0);

    const totalEndpoints = API_MODULES.reduce((acc, m) => acc + m.endpoints.length, 0);

    return (
        <div className="historico-container">
            {/* Cabeçalho */}
            <div className="gate-explanation-card" style={{ marginBottom: 0 }}>
                <div className="gate-header-top">
                    <span className="gate-status-tag">Documentação da API REST</span>
                </div>
                <div className="gate-description" style={{ marginTop: 10 }}>
                    <p>
                        Todos os endpoints do PIROO-MVP v2.0 estão disponíveis para integração com sistemas externos via HTTP.
                        A base URL varia conforme o ambiente: <strong>{BASE}</strong> (produção).
                        Endpoints marcados como <strong>Admin</strong> exigem que o usuário autenticado possua perfil <code>admin</code>.
                        Total de endpoints disponíveis: <strong>{totalEndpoints}</strong>.
                    </p>
                </div>
            </div>

            {/* Base URL e busca */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '20px 0 4px' }}>
                <div style={{
                    flex: 1, minWidth: 240, background: '#edf2f7', borderRadius: 10,
                    padding: '10px 16px', fontFamily: 'monospace', fontSize: '0.85rem',
                    color: '#2d3748', display: 'flex', alignItems: 'center', gap: 10
                }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Base URL</span>
                    <span>{BASE}</span>
                </div>
                <input
                    type="text"
                    placeholder="Buscar endpoint, módulo ou método..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    style={{
                        flex: 1, minWidth: 200, padding: '10px 16px',
                        border: '2px solid #e2e8f0', borderRadius: 10,
                        fontSize: '0.9rem', outline: 'none', background: '#fff'
                    }}
                />
            </div>

            {/* Módulos */}
            {modulosFiltrados.map((mod, mi) => (
                <div key={mi} style={{
                    background: '#fff', borderRadius: 14,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    overflow: 'hidden', borderTop: `4px solid ${mod.color}`
                }}>
                    {/* Cabeçalho do módulo */}
                    <div style={{
                        padding: '14px 20px', background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: mod.color, flexShrink: 0 }} />
                        <strong style={{ color: '#2d3748', fontSize: '0.95rem' }}>{mod.title}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#a0aec0', marginLeft: 'auto' }}>
                            {mod.endpoints.length} endpoint{mod.endpoints.length > 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Endpoints */}
                    {mod.endpoints.map((ep, ei) => {
                        const key = `${mi}-${ei}`;
                        const aberto = abertos.has(key);
                        const ms = METODO_STYLE[ep.method] || METODO_STYLE.GET;
                        return (
                            <div key={ei} style={{ borderBottom: ei < mod.endpoints.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                {/* Linha clicável */}
                                <div
                                    onClick={() => toggle(key)}
                                    style={{
                                        padding: '12px 20px', display: 'flex', alignItems: 'center',
                                        gap: 12, cursor: 'pointer',
                                        background: aberto ? '#f7fafc' : 'transparent'
                                    }}
                                >
                                    <span style={{
                                        fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px',
                                        borderRadius: 5, minWidth: 50, textAlign: 'center',
                                        background: ms.bg, color: ms.color, flexShrink: 0
                                    }}>{ep.method}</span>
                                    <code style={{ fontSize: '0.82rem', color: '#2d3748', flex: 1 }}>{ep.path}</code>
                                    <span style={{ fontSize: '0.78rem', color: '#718096', textAlign: 'right', maxWidth: 260 }}>{ep.desc}</span>
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px',
                                        borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                                        background: ep.auth ? '#fff5f5' : '#f0fff4',
                                        color: ep.auth ? '#822727' : '#22543d'
                                    }}>{ep.auth ? 'Admin' : 'Público'}</span>
                                    <span style={{
                                        fontSize: '0.75rem', color: '#a0aec0',
                                        transition: 'transform 0.2s',
                                        transform: aberto ? 'rotate(90deg)' : 'none',
                                        flexShrink: 0
                                    }}>›</span>
                                </div>

                                {/* Detalhe expandido */}
                                {aberto && (
                                    <div style={{ padding: '4px 20px 18px', borderTop: '1px solid #edf2f7' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                                    Corpo / Parâmetros
                                                </p>
                                                <pre style={{
                                                    background: '#f8fafc', border: '1px solid #e2e8f0',
                                                    borderRadius: 8, padding: '10px 14px',
                                                    fontSize: '0.75rem', fontFamily: 'monospace',
                                                    color: '#2d3748', whiteSpace: 'pre-wrap',
                                                    lineHeight: 1.7, margin: 0, overflowX: 'auto'
                                                }}>{ep.params}</pre>
                                            </div>
                                            <div>
                                                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 }}>
                                                    Exemplo de resposta
                                                </p>
                                                <pre style={{
                                                    background: '#f0fff4', border: '1px solid #c6f6d5',
                                                    borderRadius: 8, padding: '10px 14px',
                                                    fontSize: '0.75rem', fontFamily: 'monospace',
                                                    color: '#22543d', whiteSpace: 'pre-wrap',
                                                    lineHeight: 1.7, margin: 0, overflowX: 'auto'
                                                }}>{ep.response}</pre>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 12 }}>
                                            <p style={{ fontSize: '0.65rem', fontWeight: 800, color: '#718096', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>
                                                URL completa
                                            </p>
                                            <code style={{
                                                display: 'block', background: '#edf2f7', borderRadius: 6,
                                                padding: '8px 12px', fontSize: '0.78rem', color: '#2c5282'
                                            }}>{ep.method} {BASE}{ep.path}</code>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}

            {modulosFiltrados.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#a0aec0' }}>
                    Nenhum endpoint encontrado para "{busca}".
                </div>
            )}
        </div>
    );
}

// ==========================================
// APP PRINCIPAL
// ==========================================
function App() {
    const [telaAtiva, setTelaAtiva] = useState('dashboard');
    const [usuario, setUsuario] = useState(() => {
        const s = localStorage.getItem('piroo_usuario');
        return s ? JSON.parse(s) : null;
    });
    const [alertasAbertos, setAlertasAbertos] = useState(0);
    const [registros, setRegistros] = useState([]);
    const [fotoExibida, setFotoExibida] = useState(null);
    const [metaData, setMetaData] = useState({ unidades: [], tiposResiduo: [], geradores: [], transportadores: [], operadores: [] });

    useEffect(() => {
        if (!usuario) return;
        // Carrega dados mestres dinâmicos do banco (unidades, transportadores, geradores)
        Promise.all([
            axios.get(`${API_URL}/homologados`),
            axios.get(`${API_URL}/operadores`)
        ]).then(([homol, ops]) => {
            setMetaData(prev => ({ ...prev, ...homol.data, operadores: ops.data }));
        });
        axios.get(`${API_URL}/alertas`).then(res => setAlertasAbertos(res.data.filter(a => !a.resolvido).length));
    }, [usuario]);

    useEffect(() => {
        if (telaAtiva === 'historico' && usuario) {
            axios.get(`${API_URL}/historico`).then(res => setRegistros(res.data));
        }
    }, [telaAtiva, usuario]);

    const handleLogin = (dados) => {
        setUsuario(dados);
        localStorage.setItem('piroo_usuario', JSON.stringify(dados));
    };

    const handleLogout = () => {
        localStorage.removeItem('piroo_usuario');
        setUsuario(null);
        window.location.href = window.location.origin;
    };

    if (!usuario) return <TelaLogin onLogin={handleLogin} />;

    const isAdmin = usuario.perfil === 'admin';

    return (
        <div className="App">
            <header className="gate-explanation-card">
                <div className="gate-description">
                    <div className="gate-header-top">
                        <span className="gate-status-tag">PIROO-MVP: Plataforma Integrada de Rastreabilidade e Orquestração Operacional</span>
                    </div>
                    <p>
                        Ecossistema de digitalização de fluxos de pátio para gestão de resíduos. A Inteligência Artificial analisa
                        evidências fotográficas em tempo real, gerando <strong>Protocolos Digitais Únicos</strong> com rastreabilidade
                        completa, auditoria blindada e <strong>conciliação documental instantânea</strong>.
                        Usuário ativo: <strong>{usuario.nome}</strong> ({usuario.perfil}).
                    </p>
                </div>
            </header>

            <nav className="nav-menu">
                <button className={telaAtiva === 'dashboard' ? 'active' : ''} onClick={() => setTelaAtiva('dashboard')}>
                    <LayoutDashboard size={16} /> Dashboard
                </button>
                <button className={telaAtiva === 'checkin' ? 'active' : ''} onClick={() => setTelaAtiva('checkin')}>
                    <Truck size={16} /> Entrada
                </button>
                <button className={telaAtiva === 'historico' ? 'active' : ''} onClick={() => setTelaAtiva('historico')}>
                    <FileText size={16} /> Inventário
                </button>
                <button className={telaAtiva === 'descargas' ? 'active' : ''} onClick={() => setTelaAtiva('descargas')}>
                    <BarChart2 size={16} /> Descargas
                </button>
                <button className={telaAtiva === 'alertas' ? 'active' : ''} onClick={() => setTelaAtiva('alertas')} style={{ position: 'relative' }}>
                    <Bell size={16} /> Alertas
                    {alertasAbertos > 0 && (
                        <span style={{
                            position: 'absolute', top: 6, right: 6, background: '#f56565',
                            color: 'white', borderRadius: '50%', width: 18, height: 18,
                            fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>{alertasAbertos}</span>
                    )}
                </button>
                <button className={telaAtiva === 'rastreabilidade' ? 'active' : ''} onClick={() => setTelaAtiva('rastreabilidade')}>
                    <Search size={16} /> Rastrear
                </button>
                {isAdmin && (
                    <button className={telaAtiva === 'usuarios' ? 'active' : ''} onClick={() => setTelaAtiva('usuarios')}>
                        <Users size={16} /> Usuários
                    </button>
                )}
                {(isAdmin || usuario.perfil === 'auditor') && (
                    <button className={telaAtiva === 'cadastros' ? 'active' : ''} onClick={() => setTelaAtiva('cadastros')}>
                        <PlusCircle size={16} /> Cadastros
                    </button>
                )}
                <button className={telaAtiva === 'documentacao' ? 'active' : ''} onClick={() => setTelaAtiva('documentacao')}>
                    <FileText size={16} /> API Docs
                </button>
                <button className="btn-logout" onClick={handleLogout}><LogOut size={16} /></button>
            </nav>

            <main>
                {telaAtiva === 'dashboard'       && <TelaDashboard alertasAbertos={alertasAbertos} />}
                {telaAtiva === 'checkin'         && <TelaCheckin metaData={metaData} API_URL={API_URL} />}
                {telaAtiva === 'descargas'       && <TelaRelatorioDescargas />}
                {telaAtiva === 'alertas'         && <TelaAlertas onContagem={setAlertasAbertos} />}
                {telaAtiva === 'rastreabilidade' && <TelaRastreabilidade />}
                {telaAtiva === 'documentacao'    && <TelaDocumentacao />}
                {(isAdmin || usuario.perfil === 'auditor') && telaAtiva === 'cadastros' && <TelaCadastros />}
                {isAdmin && telaAtiva === 'usuarios' && <TelaCadastroUsuarios />}

                {telaAtiva === 'historico' && (
                    <div className="historico-container">
                        <div className="header-auditoria">
                            <h2>Relatório de Inventário</h2>
                            <a href={`${API_URL}/download-csv`} className="btn-download"><Download size={18} /> Exportar CSV</a>
                        </div>
                        <div className="auditoria-grid">
                            {registros.map((reg, i) => (
                                <div key={i} className="card-auditoria">
                                    <div className="card-header">
                                        <strong>Protocolo: {reg.protocolo}</strong>
                                        <span className="data-tag">{new Date(reg.data).toLocaleString()}</span>
                                    </div>
                                    <div className="card-body-grid">
                                        <div className="info-item"><label>Unidade</label><span>{reg.unidade}</span></div>
                                        <div className="info-item"><label>Operador</label><span>{reg.usuario}</span></div>
                                        <div className="info-item"><label>Gerador</label><span>{reg.gerador}</span></div>
                                        <div className="info-item"><label>Resíduo</label><span>{reg.tipoResiduo}</span></div>
                                        <div className="info-item"><label>Transportador</label><span>{reg.transportador}</span></div>
                                        <div className="info-item"><label>Placa</label><span>{reg.placa}</span></div>
                                        <div className="info-item"><label>Peso</label><span>{reg.peso} kg</span></div>
                                    </div>
                                    {reg.fotoUrl && (
                                        <button className="btn-ver-foto" onClick={() => setFotoExibida(`http://localhost:3000${reg.fotoUrl}`)}>
                                            <Camera size={16} /> Visualizar Evidência Fotográfica
                                        </button>
                                    )}
                                    <div className={`ia-badge ${({ conforme: 'good', nao_conforme: 'bad', pendente: 'pending' })[situacaoIA(reg)]}`}>
                                        <label>IA:</label>
                                        <div style={{ whiteSpace: 'pre-line', fontWeight: 'normal' }}>{reg.analiseIA}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {fotoExibida && (
                <div className="modal-foto" onClick={() => setFotoExibida(null)}>
                    <div className="modal-conteudo">
                        <img src={fotoExibida} alt="Ampliada" />
                        <button className="btn-fechar-modal">Fechar X</button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
