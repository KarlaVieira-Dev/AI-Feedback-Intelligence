const CATEGORY_RULES = [
  { category: "Pagamentos", keywords: ["cobranca", "cartao", "fatura", "pagamento"] },
  { category: "Performance", keywords: ["demora", "lento", "carregar", "travando", "performance"] },
  { category: "Estabilidade", keywords: ["fecha", "crash", "erro", "bug", "falha"] },
  { category: "Relatorios", keywords: ["relatorio", "exportar", "exportacao", "dados"] },
  { category: "Cadastro", keywords: ["cadastro", "operadores", "campo", "login", "senha"] },
  { category: "Logistica", keywords: ["entrega", "pedido", "status", "atrasou"] },
  { category: "Integracoes", keywords: ["integracao", "erp", "api"] },
  { category: "Suporte", keywords: ["atendimento", "suporte", "retorno", "duvida"] },
];

const THEME_RULES = [
  { theme: "Velocidade e confiabilidade", keywords: ["demora", "lento", "fecha", "crash", "bug", "falha"] },
  { theme: "Financeiro e faturamento", keywords: ["cobranca", "cartao", "fatura"] },
  { theme: "Operacao e produtividade", keywords: ["exportar", "exportacao", "manual", "horas", "unidade"] },
  { theme: "Onboarding e uso", keywords: ["cadastro", "campo", "passo a passo", "duvida"] },
  { theme: "Visibilidade operacional", keywords: ["entrega", "pedido", "status", "acompanhar"] },
  { theme: "Ecossistema e integracoes", keywords: ["integracao", "erp", "api"] },
];

const NEGATIVE_WORDS = ["urgente", "duplicada", "erro", "falha", "fecha", "atrasou", "nao consigo", "desiste"];
const POSITIVE_WORDS = ["excelente", "gosto", "ajuda", "bom", "otimo", "resolveu"];
const CRITICAL_WORDS = ["urgente", "duplicada", "fecha", "nao consigo", "falha", "atrasou"];

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchRule(text, rules, fallbackKey, fallbackValue) {
  const rule = rules.find((item) => item.keywords.some((keyword) => text.includes(keyword)));
  return rule?.[fallbackKey] ?? fallbackValue;
}

function scoreWords(text, words) {
  return words.reduce((score, word) => score + (text.includes(word) ? 1 : 0), 0);
}

function detectSentiment(text) {
  const negative = scoreWords(text, NEGATIVE_WORDS);
  const positive = scoreWords(text, POSITIVE_WORDS);

  if (negative > positive) return "Negativo";
  if (positive > negative) return "Positivo";
  return "Neutro";
}

function detectPriority(text, sentiment) {
  const criticalScore = scoreWords(text, CRITICAL_WORDS);
  if (criticalScore >= 2 || (criticalScore >= 1 && sentiment === "Negativo")) return "Critica";
  if (sentiment === "Negativo") return "Alta";
  if (sentiment === "Neutro") return "Media";
  return "Baixa";
}

function getMainProblem(originalText, category) {
  const clean = originalText.trim().replace(/\s+/g, " ");
  if (clean.length <= 120) return clean;
  return `${category}: ${clean.slice(0, 116).trim()}...`;
}

function getAction(category, priority) {
  const actions = {
    Pagamentos: "Acionar Financeiro/CX para resolver o caso e mapear recorrencia de cobranca.",
    Performance: "Priorizar diagnostico tecnico e medir tempo de carregamento por segmento.",
    Estabilidade: "Abrir incidente de produto com logs e passos de reproducao.",
    Relatorios: "Validar necessidade de filtros/exportacao com Produto e Operacoes.",
    Cadastro: "Revisar mensagens de erro e simplificar campos obrigatorios.",
    Logistica: "Criar visibilidade de status e alerta proativo para pedidos em risco.",
    Integracoes: "Avaliar integracao como oportunidade de roadmap ou parceria.",
    Suporte: "Transformar resposta do suporte em conteudo de autosservico.",
  };

  const prefix = priority === "Critica" ? "Resolver em ate 24h. " : "";
  return `${prefix}${actions[category] ?? "Agrupar feedbacks similares e validar impacto com usuarios."}`;
}

export async function classifyWithOpenAI(_input) {
  throw new Error("OpenAI API ainda nao configurada. Use classifyFeedback como fallback local.");
}

export function classifyFeedback(input) {
  const text = normalize(input.text ?? "");
  const category = matchRule(text, CATEGORY_RULES, "category", "Experiencia do usuario");
  const theme = matchRule(text, THEME_RULES, "theme", "Experiencia geral");
  const sentiment = detectSentiment(text);
  const priority = detectPriority(text, sentiment);
  const mainProblem = getMainProblem(input.text, category);

  return {
    category,
    sentiment,
    priority,
    mainProblem,
    executiveSummary: `${sentiment}. Feedback ligado a ${category}, com foco em ${theme}.`,
    actionSuggestion: getAction(category, priority),
    theme,
  };
}
