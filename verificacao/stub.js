// Stub determinístico do Gemini para testes. Lê o rótulo de verdade embutido na imagem sintética.
const Module = require('module');
const orig = Module._load;
let seed = parseInt(process.env.STUB_SEED || '42');
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ACC = parseFloat(process.env.STUB_ACCURACY || '1');
const FAIL = parseFloat(process.env.STUB_FAIL_RATE || '0');
class FakeModel {
  async generateContent([prompt, img]) {
    if (rnd() < FAIL) throw new Error('STUB: falha simulada da API');
    const raw = Buffer.from(img.inlineData.data, 'base64').toString('latin1');
    const m = raw.match(/PIROO_GT(\{.*?\})END/);
    const gt = m ? JSON.parse(m[1]) : {};
    const declared = (prompt.match(/- Tipo: (.*)/) || [])[1]?.trim();
    let conf = gt.tipoReal === declared;
    if (rnd() > ACC) conf = !conf;
    const txt = `Conformidade: ${conf ? 'Sim' : 'Não'}.
Parecer: análise simulada.
Sinalização: Presente.
Segurança da Carga: ${gt.segurancaOk === false ? 'Inadequada' : 'Adequada'}.
Estimativa de Peso: ${gt.pesoReal ?? 'Indeterminado'}.
Materiais Proibidos: ${gt.proibido ? gt.proibido : 'Nenhum'}`;
    return { response: { text: () => txt } };
  }
}
class GoogleGenerativeAI { constructor(){} getGenerativeModel(){ return new FakeModel(); } }
Module._load = function (req, ...a) {
  if (req === '@google/generative-ai') return { GoogleGenerativeAI };
  return orig.call(this, req, ...a);
};
