import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyFeedback } from "./classifier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.resolve(__dirname, "../data/sample-feedbacks.json");
const sampleFeedbacks = JSON.parse(fs.readFileSync(samplePath, "utf8"));

let feedbacks = sampleFeedbacks.map((feedback, index) => createFeedback(feedback, index + 1));

function createFeedback(input, sequence = feedbacks.length + 1) {
  const createdAt = input.createdAt ?? new Date(Date.now() - sequence * 86400000).toISOString();
  const classification = classifyFeedback(input);

  return {
    id: input.id ?? `fb-${String(sequence).padStart(3, "0")}`,
    source: input.source ?? "Manual",
    customer: input.customer ?? "Cliente nao informado",
    channel: input.channel ?? "Entrada manual",
    text: input.text,
    createdAt,
    ...classification,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] ?? 0) + 1;
    return acc;
  }, {});
}

function topBy(items, key, limit = 5) {
  return Object.entries(countBy(items, key))
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function topItem(items, key, fallback = "Sem dados") {
  return topBy(items, key, 1)[0]?.name ?? fallback;
}

function getPotentialImpact(feedback, allFeedbacks) {
  const categoryCounts = countBy(allFeedbacks, "category");
  const priorityScore = { Baixa: 1, Media: 2, Alta: 3, Critica: 4 }[feedback.priority] ?? 1;
  const sentimentScore = { Positivo: 0, Neutro: 1, Negativo: 2 }[feedback.sentiment] ?? 1;
  const recurrenceScore = categoryCounts[feedback.category] >= 3 ? 2 : categoryCounts[feedback.category] >= 2 ? 1 : 0;
  const categoryScore = ["Pagamentos", "Estabilidade", "Integracoes"].includes(feedback.category)
    ? 2
    : ["Logistica", "Relatorios", "Cadastro"].includes(feedback.category)
      ? 1
      : 0;

  const score = priorityScore + sentimentScore + recurrenceScore + categoryScore;

  if (score >= 8) return "Crítico";
  if (score >= 6) return "Alto";
  if (score >= 4) return "Médio";
  return "Baixo";
}

function withPotentialImpact(items) {
  return items.map((feedback) => ({
    ...feedback,
    potentialImpact: getPotentialImpact(feedback, items),
  }));
}

export function listFeedbacks() {
  return withPotentialImpact(feedbacks).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getFeedback(id) {
  return withPotentialImpact(feedbacks).find((feedback) => feedback.id === id);
}

export function addFeedback(input) {
  const feedback = createFeedback(input);
  feedbacks = [feedback, ...feedbacks];
  return getFeedback(feedback.id);
}

export function importFeedbacks(items) {
  const created = items
    .filter((item) => item.text?.trim())
    .map((item) => addFeedback(item));
  return created;
}

export function getDashboard() {
  const enrichedFeedbacks = withPotentialImpact(feedbacks);
  const critical = enrichedFeedbacks.filter((feedback) => feedback.priority === "Critica");
  const highImpact = enrichedFeedbacks.filter((feedback) => ["Alto", "Crítico"].includes(feedback.potentialImpact));
  const recurringProblems = topBy(enrichedFeedbacks, "mainProblem", 5);
  const topThemes = topBy(enrichedFeedbacks, "theme", 5);

  return {
    total: enrichedFeedbacks.length,
    bySentiment: topBy(enrichedFeedbacks, "sentiment", 10),
    dominantSentiment: topItem(enrichedFeedbacks, "sentiment"),
    topThemes,
    recurringThemes: topThemes.length,
    criticalPriorities: critical.length,
    highPotentialImpact: highImpact.length,
    byPotentialImpact: topBy(enrichedFeedbacks, "potentialImpact", 10),
    recurringProblems,
    byPriority: topBy(enrichedFeedbacks, "priority", 10),
    byCategory: topBy(enrichedFeedbacks, "category", 10),
  };
}
