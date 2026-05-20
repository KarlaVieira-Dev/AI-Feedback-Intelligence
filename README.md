# AI Feedback Intelligence

MVP para transformar feedbacks nao estruturados em insights acionaveis para times de Produto, Operacoes e CX.

## O que o MVP entrega

- Cadastro manual de feedbacks.
- Importacao rapida em lote, com um feedback por linha.
- Classificacao automatica simulada por IA:
  - categoria
  - sentimento
  - prioridade
  - problema principal
  - resumo executivo
  - sugestao de acao
  - tema
- Dashboard executivo com:
  - total de feedbacks
  - feedbacks criticos
  - sentimento predominante
  - temas recorrentes
  - grafico simples de sentimento
  - principais temas
  - problemas recorrentes
- Filtros por categoria, sentimento e prioridade.
- Tela de lista e tela de detalhes do feedback.
- Dados simulados para demonstracao e testes.

## Arquitetura da Solucao

O MVP foi desenhado com uma arquitetura simples, facil de apresentar em entrevistas e pronta para evolucao:

1. **Front-end estatico**
   - Implementado em `src/main.js` e `src/styles.css`.
   - Renderiza as telas de dashboard, cadastro/importacao, lista filtravel e detalhe.
   - Consome a API via `fetch`.

2. **Back-end Node.js**
   - Implementado em `server/index.js` usando o modulo HTTP nativo do Node.
   - Serve tanto a API quanto os arquivos estaticos do front-end.
   - Nao depende de banco de dados nem pacotes externos, para facilitar execucao local.

3. **Camada de classificacao**
   - Implementada em `server/classifier.js`.
   - Hoje usa regras deterministicas para simular uma classificacao por IA.
   - Ja possui uma funcao `classifyWithOpenAI` reservada para futura integracao com OpenAI API.

4. **Camada de dados e metricas**
   - Implementada em `server/store.js`.
   - Mantem os feedbacks em memoria.
   - Calcula os agregados do dashboard, como sentimento predominante, feedbacks criticos e temas recorrentes.

## Estrutura de Pastas

```text
.
|-- data/
|   `-- sample-feedbacks.json      # exemplos iniciais usados pela API
|-- server/
|   |-- classifier.js              # classificacao simulada e ponto futuro para OpenAI
|   |-- index.js                   # servidor HTTP, API e arquivos estaticos
|   `-- store.js                   # armazenamento em memoria e metricas
|-- src/
|   |-- main.js                    # front-end em JavaScript nativo
|   `-- styles.css                 # camada visual do MVP
|-- index.html
|-- package.json
`-- README.md
```

## Como Executar

Execute o MVP:

```bash
npm run dev
```

O projeto nao depende de pacotes externos. Se preferir, tambem pode executar:

```bash
node server/index.js
```

URL padrao:

- App e API: `http://localhost:4000`

No PowerShell do Windows, se `npm` for bloqueado pela politica de execucao, use:

```bash
npm.cmd run dev
```

## API

Rotas principais:

- `GET /api/feedbacks`: lista feedbacks classificados.
- `GET /api/feedbacks/:id`: detalhe de um feedback.
- `POST /api/feedbacks`: cadastra e classifica um feedback.
- `POST /api/feedbacks/import`: importa um lote de feedbacks.
- `GET /api/dashboard`: retorna indicadores agregados.

## Preparacao para OpenAI API

Para manter o MVP simples e apresentavel sem credenciais, a classificacao usa regras locais em `server/classifier.js`.

Para evoluir para OpenAI API, substitua a chamada atual de `classifyFeedback(input)` por uma chamada assincrona a `classifyWithOpenAI(input)`, retornando o mesmo contrato:

```json
{
  "category": "Pagamentos",
  "sentiment": "Negativo",
  "priority": "Critica",
  "mainProblem": "Cobranca duplicada no cartao",
  "executiveSummary": "Feedback negativo sobre cobranca duplicada.",
  "actionSuggestion": "Acionar Financeiro/CX e corrigir recorrencia.",
  "theme": "Financeiro e faturamento"
}
```

Essa separacao permite trocar o motor de classificacao sem reescrever dashboard, filtros ou telas.
