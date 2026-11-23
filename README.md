# PIROO-MVP

**Plataforma Integrada de Rastreabilidade e Orquestração Operacional**
Módulo de Check-in Digital e Evidências no Gate · versão 2.3.0

O PIROO-MVP digitaliza o atendimento de cargas no portão (gate) de unidades de recebimento de resíduos sólidos. Cada entrada gera um protocolo único, com evidência fotográfica, parecer automático de conformidade produzido por inteligência artificial (Google Gemini) e comprovante com QR Code. Os registros alimentam inventário, relatórios, alertas e indicadores operacionais, em substituição ao apontamento manual.

O sistema constitui o produto técnico-tecnológico da dissertação de mestrado Projetos de Transformação Digital no Setor de Resíduos Sólidos, desenvolvida pela mestranda Daniela Correia Batista sob orientação do Prof. Dr. Edson Melo de Souza e coorientação da Profa. Dra. Cristina Dai Prá Martens, no Programa de Pós-Graduação em Gestão de Projetos (PPGP) da Universidade Nove de Julho (Uninove).

## Funcionalidades

| Módulo | Descrição |
|---|---|
| Entrada (check-in) | Registro da carga com validação contra cadastros mestres, fotografia obrigatória, análise por IA e cronometragem do atendimento |
| Comprovante | Protocolo de seis dígitos, dados da carga, parecer da IA, QR Code e exportação em PDF |
| Inventário | Lista de entradas com selo de situação (conforme, não conforme, pendente), evidência fotográfica e exportação CSV |
| Descargas | Relatório filtrável por unidade, tipo de resíduo e período, com gráficos, ranking de geradores e PDF |
| Alertas | Inconformidade, material proibido, segurança da carga e análise pendente, com resolução registrada |
| Rastrear | Consulta de qualquer carga pelo número do protocolo |
| Dashboard | Entradas, peso, taxa de conformidade, tempo médio de check-in e alertas abertos |
| Usuários e Cadastros | Perfis operador, auditor e administrador; unidades, transportadores, veículos e geradores |
| API | Documentação integrada, exportação JSON, trilha de auditoria e webhooks |

## Arquitetura

- **Backend:** Node.js e Express, Helmet, CORS, limitação de requisições, express-validator, Winston (logs), bcrypt (senhas), SQLite embarcado via sql.js (cadastros, alertas, auditoria e webhooks), arquivo JSON (entradas), PDFKit (relatórios) e Google Generative AI (`gemini-2.5-flash`).
- **Frontend:** React (Create React App), Recharts, qrcode.react, html2pdf.js e lucide-react. A versão compilada é servida pelo próprio backend a partir de `backend/frontend-build`.

## Estrutura do repositório

```
backend/            servidor (index.js), dependências e interface compilada (frontend-build)
frontend/           código-fonte da interface React
docs/               manual de operação, vídeo de demonstração e relatório-piloto de verificação
verificacao/        kit de verificação funcional com dados sintéticos (IA simulada)
CHANGELOG.md        alterações da versão 2.3.0
```

## Instalação e execução

Requisitos: Node.js 18 ou superior e uma chave de API do Google Gemini.

```bash
cd backend
npm install
cp .env.example .env      # no Windows: copy .env.example .env
# edite o .env e informe GEMINI_API_KEY
npm start
```

Acesse `http://localhost:3000`. No primeiro acesso, use o login `admin` e a senha `admin123`, cadastre um administrador nominal e restrinja o uso da conta padrão. Para conferir se o servidor está ativo, acesse `http://localhost:3000/api/ping`.

Na primeira inicialização, o servidor cria `piroo.db`, `historico.json`, `uploads/` e `logs/` na pasta `backend`, com unidades, transportadores, placas e geradores de exemplo. Esses arquivos não são versionados.

### Recompilar a interface (opcional)

```bash
cd frontend
npm install
npm run build
# copie o conteúdo de frontend/build para backend/frontend-build
```

## Documentação

- `docs/PIROO-MVP_Manual_de_Operacao.docx`: manual de operação, com instalação, perfis, procedimento de cada tela, validações, alertas e solução de problemas.
- `docs/PIROO-MVP_Demonstracao.mp4`: vídeo de demonstração de todas as funcionalidades.
- `docs/Relatorio_Piloto_PIROO_v2.3.0.docx`: relatório-piloto da verificação funcional com dados sintéticos.

## Verificação funcional

A pasta `verificacao` reproduz a verificação descrita no relatório-piloto. O arquivo `stub.js` substitui a chamada ao Gemini por um simulador determinístico, de modo que os testes não usam dados reais nem chave de API. As instruções estão em `verificacao/LEIAME.md`, e os resultados de referência, em `resumo_v23.json`.

## Limitações conhecidas

- A autenticação ocorre apenas na interface; o servidor pressupõe rede interna confiável.
- A interface compilada chama `http://localhost:3000/api`; o uso em outros dispositivos da rede exige recompilar o frontend com o endereço do servidor.
- Não há troca de senha pela interface nem modo offline.

## Licença

© 2026 Daniela Correia Batista, Edson Melo de Souza e Cristina Dai Prá Martens.

- Código-fonte (`backend/`, `frontend/` e `verificacao/`): licença MIT, conforme o arquivo [LICENSE](LICENSE).
- Documentação, manual, vídeo de demonstração e relatório-piloto (`docs/`): Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional (CC BY-SA 4.0), conforme [docs/LICENSE.txt](docs/LICENSE.txt).
