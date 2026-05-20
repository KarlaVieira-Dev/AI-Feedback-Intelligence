const API_URL = "/api";

const state = {
  view: "dashboard",
  feedbacks: [],
  dashboard: null,
  selectedId: null,
  modalFeedbackId: null,
  error: "",
  query: "",
  filters: {
    category: "",
    sentiment: "",
    priority: "",
    theme: "",
    source: "",
    channel: "",
  },
  page: 1,
  pageSize: 6,
  darkMode: false,
  status: "",
};

const priorityClass = {
  Critica: "danger",
  Alta: "warning",
  Media: "neutral",
  Baixa: "success",
};

const impactClass = {
  Crítico: "danger",
  Alto: "warning",
  Médio: "neutral",
  Baixo: "success",
};

const sentimentColors = {
  Negativo: "#ef4444",
  Neutro: "#f59e0b",
  Positivo: "#10b981",
};

const icons = {
  brain: "AI",
  chart: "DB",
  input: "+",
  file: "FB",
  alert: "!",
  check: "OK",
  upload: "UP",
  search: "Q",
};

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro inesperado" }));
    throw new Error(error.message);
  }

  return response.json();
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadData() {
  try {
    const [feedbacks, dashboard] = await Promise.all([api("/feedbacks"), api("/dashboard")]);
    state.feedbacks = feedbacks;
    state.dashboard = dashboard;
    state.error = "";
  } catch (error) {
    state.error = error.message;
  }
  render();
}

function setView(view) {
  state.view = view;
  state.status = "";
  state.page = 1;
  render();
}

function selectFeedback(id) {
  state.modalFeedbackId = id;
  render();
}

function closeFeedbackModal() {
  state.modalFeedbackId = null;
  render();
}

function uniqueOptions(key) {
  return [...new Set(state.feedbacks.map((feedback) => feedback[key]).filter(Boolean))].sort();
}

function selectOptions(key, label) {
  const value = state.filters[key];
  return `
    <label class="filter-field">
      ${label}
      <select id="filter-${key}">
        <option value="">Todos</option>
        ${uniqueOptions(key)
          .map((option) => `<option value="${escapeHtml(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`)
          .join("")}
      </select>
    </label>
  `;
}

function resetFilters() {
  state.filters = { category: "", sentiment: "", priority: "", theme: "", source: "", channel: "" };
  state.query = "";
  state.page = 1;
  render();
}

function getClassificationReason(feedback) {
  const pieces = [
    `Categoria definida como ${feedback.category} por sinais do texto original e do contexto do canal.`,
    `Sentimento ${feedback.sentiment.toLowerCase()} identificado pela intensidade do relato e termos de impacto operacional.`,
    `Prioridade ${feedback.priority.toLowerCase()} atribuida considerando urgencia, risco para cliente e potencial impacto em receita ou operacao.`,
  ];

  if (feedback.theme) {
    pieces.push(`O tema "${feedback.theme}" agrupa feedbacks similares para analise executiva.`);
  }

  if (feedback.potentialImpact) {
    pieces.push(`Impacto potencial ${feedback.potentialImpact.toLowerCase()} calculado pela combinacao de prioridade, sentimento, recorrencia e categoria.`);
  }

  return pieces.join(" ");
}

function getFilteredFeedbacks() {
  const term = state.query.toLowerCase();
  return state.feedbacks.filter((feedback) => {
    const matchesSearch = `${feedback.customer} ${feedback.text} ${feedback.theme} ${feedback.category} ${feedback.mainProblem}`
      .toLowerCase()
      .includes(term);
    const matchesCategory = !state.filters.category || feedback.category === state.filters.category;
    const matchesSentiment = !state.filters.sentiment || feedback.sentiment === state.filters.sentiment;
    const matchesPriority = !state.filters.priority || feedback.priority === state.filters.priority;
    const matchesTheme = !state.filters.theme || feedback.theme === state.filters.theme;
    const matchesSource = !state.filters.source || feedback.source === state.filters.source;
    const matchesChannel = !state.filters.channel || feedback.channel === state.filters.channel;

    return matchesSearch && matchesCategory && matchesSentiment && matchesPriority && matchesTheme && matchesSource && matchesChannel;
  });
}

function getTrendData() {
  const byDate = state.feedbacks.reduce((acc, feedback) => {
    const date = new Date(feedback.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    acc[date] = (acc[date] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(byDate)
    .map(([date, value]) => ({ date, value }))
    .slice(-8);
}

function renderTrend(items = []) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return `
    <div class="trend-chart">
      ${items
        .map(
          (item) => `
            <div class="trend-bar">
              <span style="height:${Math.max((item.value / max) * 100, 12)}%"></span>
              <small>${escapeHtml(item.date)}</small>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().trim());
  const hasHeader = headers.some((header) => ["text", "feedback", "cliente", "customer"].includes(header));
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows
    .map((line, index) => {
      const values = parseCsvLine(line);
      if (hasHeader) {
        const record = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] ?? ""]));
        return {
          text: record.text || record.feedback || record.comentario || values[0],
          customer: record.customer || record.cliente || `CSV ${index + 1}`,
          source: record.source || record.fonte || "CSV",
          channel: record.channel || record.canal || "Upload CSV",
        };
      }

      return {
        text: values[0],
        customer: values[1] || `CSV ${index + 1}`,
        source: values[2] || "CSV",
        channel: values[3] || "Upload CSV",
      };
    })
    .filter((item) => item.text?.trim());
}

function statCard(icon, label, value, tone = "") {
  return `
    <section class="stat ${tone}">
      <div class="stat-top">
        <div class="stat-icon">${icon}</div>
        <span class="stat-trend">Agora</span>
      </div>
      <p>${label}</p>
      <strong>${value}</strong>
    </section>
  `;
}

function badge(value) {
  return `<span class="badge ${priorityClass[value] ?? "neutral"}">${escapeHtml(value)}</span>`;
}

function impactBadge(value) {
  return `<span class="impact-pill ${impactClass[value] ?? "neutral"}">${escapeHtml(value ?? "Sem dados")}</span>`;
}

function feedbackRow(feedback) {
  return `
    <button class="feedback-row" type="button" data-select="${feedback.id}">
      <div>
        <strong>${escapeHtml(feedback.customer)}</strong>
        <p>${escapeHtml(feedback.text)}</p>
      </div>
      <div class="row-badges">
        ${badge(feedback.priority)}
        ${impactBadge(feedback.potentialImpact)}
      </div>
    </button>
  `;
}

function renderBars(items = []) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return `
    <div class="bar-list">
      ${items
        .map(
          (item) => `
            <div class="bar-item">
              <span>${escapeHtml(item.name)}</span>
              <div><i style="width:${(item.value / max) * 100}%"></i></div>
              <strong>${item.value}</strong>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderSentiments(items = []) {
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  return `
    <div class="sentiment-meter">
      ${items
        .map(
          (item) => `
            <span title="${escapeHtml(item.name)}: ${item.value}" style="width:${(item.value / total) * 100}%; background:${sentimentColors[item.name] ?? "#64748b"}"></span>
          `,
        )
        .join("")}
    </div>
    <div class="legend-row">
      ${items
        .map(
          (item) => `
            <span><i style="background:${sentimentColors[item.name] ?? "#64748b"}"></i>${escapeHtml(item.name)} (${item.value})</span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderDashboard() {
  const dashboard = state.dashboard ?? {};
  const critical = state.feedbacks.filter((feedback) => feedback.priority === "Critica");
  const themesLabel = (dashboard.topThemes ?? []).map((theme) => theme.name).slice(0, 2).join(", ") || "Sem dados";
  const executiveSummary =
    critical.length > 0
      ? `${critical.length} feedbacks criticos exigem acao imediata. O sentimento predominante e ${dashboard.dominantSentiment ?? "Sem dados"} e os temas mais recorrentes sao ${themesLabel}.`
      : `Operacao sem alertas criticos no momento. O sentimento predominante e ${dashboard.dominantSentiment ?? "Sem dados"}.`;

  return `
    <main class="view">
      <div class="view-title">
        <div>
          <span class="eyebrow">Visao executiva</span>
          <h1>AI Feedback Intelligence</h1>
        </div>
        <div class="hero-mark">${icons.brain}</div>
      </div>

      <div class="stats-grid">
        ${statCard(icons.file, "Total de feedbacks", dashboard.total ?? 0)}
        ${statCard(icons.alert, "Feedbacks criticos", dashboard.criticalPriorities ?? 0, "danger")}
        ${statCard(icons.alert, "Impacto alto ou critico", dashboard.highPotentialImpact ?? 0, "danger")}
        ${statCard(icons.chart, "Sentimento predominante", dashboard.dominantSentiment ?? "Sem dados")}
        ${statCard(icons.check, "Temas recorrentes", themesLabel, "success")}
      </div>

      <section class="alert-panel ${critical.length ? "critical" : ""}">
        <div>
          <span class="eyebrow">Resumo executivo automatico</span>
          <strong>${escapeHtml(executiveSummary)}</strong>
        </div>
        <button class="secondary-button" type="button" data-view="list">Ver base</button>
      </section>

      <section class="dashboard-grid">
        <div class="panel">
          <div class="panel-header"><h2>Distribuicao por sentimento</h2></div>
          ${renderSentiments(dashboard.bySentiment ?? [])}
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Principais temas</h2></div>
          ${renderBars(dashboard.topThemes ?? [])}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header"><h2>Distribuicao por impacto potencial</h2></div>
        ${renderBars(dashboard.byPotentialImpact ?? [])}
      </section>

      <section class="panel">
        <div class="panel-header"><h2>Tendencia temporal de feedbacks</h2></div>
        ${renderTrend(getTrendData())}
      </section>

      <section class="dashboard-grid compact">
        <div class="panel">
          <div class="panel-header"><h2>Prioridades criticas</h2></div>
          <div class="list">${critical.length ? critical.map(feedbackRow).join("") : emptyState()}</div>
        </div>
        <div class="panel">
          <div class="panel-header"><h2>Problemas recorrentes</h2></div>
          <div class="problem-list">
            ${(dashboard.recurringProblems ?? [])
              .map(
                (problem, index) => `
                  <div class="problem-item">
                    <span>${index + 1}</span>
                    <p>${escapeHtml(problem.name)}</p>
                    <strong>${problem.value}x</strong>
                  </div>
                `,
              )
              .join("")}
          </div>
        </div>
      </section>
    </main>
  `;
}

function renderForm() {
  return `
    <main class="view">
      <div class="view-title">
        <div>
          <span class="eyebrow">Entrada de dados</span>
          <h1>Cadastrar ou importar feedbacks</h1>
        </div>
        <div class="hero-mark">${icons.input}</div>
      </div>

      <section class="form-grid">
        <form class="panel form-panel" id="feedback-form">
          <div class="panel-header"><h2>Novo feedback</h2><span>${icons.brain}</span></div>
          <label>Cliente<input name="customer" placeholder="Ex.: Conta Enterprise Norte" /></label>
          <div class="field-row">
            <label>Fonte<input name="source" value="Manual" /></label>
            <label>Canal<input name="channel" value="Entrada manual" /></label>
          </div>
          <label>Feedback<textarea name="text" placeholder="Cole aqui o texto bruto do cliente..." required></textarea></label>
          <button class="primary-button" type="submit">${icons.brain} Classificar com IA</button>
        </form>

        <section class="panel form-panel">
          <div class="panel-header"><h2>Importacao rapida</h2><span>${icons.upload}</span></div>
          <label>Um feedback por linha<textarea id="import-text" placeholder="Ex.: Nao consigo concluir o cadastro..."></textarea></label>
          <button class="secondary-button" type="button" id="import-button">${icons.upload} Importar lote</button>
          <div class="upload-box">
            <label>Upload CSV
              <input id="csv-input" type="file" accept=".csv,text/csv" />
            </label>
            <p>Colunas aceitas: text, feedback, customer, cliente, source, fonte, channel, canal.</p>
          </div>
          ${state.status ? `<p class="status">${escapeHtml(state.status)}</p>` : ""}
        </section>
      </section>
    </main>
  `;
}

function renderList() {
  const filtered = getFilteredFeedbacks();
  const totalPages = Math.max(Math.ceil(filtered.length / state.pageSize), 1);
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageItems = filtered.slice(start, start + state.pageSize);

  return `
    <main class="view">
      <div class="view-title">
        <div>
          <span class="eyebrow">Base analisada</span>
          <h1>Feedbacks classificados</h1>
        </div>
        <div class="search-box">${icons.search}<input id="search-input" value="${escapeHtml(state.query)}" placeholder="Buscar feedback" /></div>
      </div>

      <section class="filters-panel">
        ${selectOptions("category", "Categoria")}
        ${selectOptions("sentiment", "Sentimento")}
        ${selectOptions("priority", "Prioridade")}
        ${selectOptions("theme", "Tema")}
        ${selectOptions("source", "Fonte")}
        ${selectOptions("channel", "Canal")}
        <label class="filter-field">
          Itens por pagina
          <select id="page-size">
            ${[5, 6, 10, 20].map((size) => `<option value="${size}" ${state.pageSize === size ? "selected" : ""}>${size}</option>`).join("")}
          </select>
        </label>
        <button class="secondary-button" type="button" id="clear-filters">Limpar filtros</button>
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>${filtered.length} feedbacks encontrados</h2>
        </div>
        <div class="table">
          <div class="table-head">
            <span>Cliente</span>
            <span>Categoria</span>
            <span>Sentimento</span>
            <span>Prioridade</span>
            <span>Impacto</span>
            <span>Tema</span>
          </div>
          ${
            pageItems.length
              ? pageItems
                  .map(
                    (feedback) => `
                      <button class="table-row" type="button" data-select="${feedback.id}">
                        <span>${escapeHtml(feedback.customer)}</span>
                        <span>${escapeHtml(feedback.category)}</span>
                        <span>${escapeHtml(feedback.sentiment)}</span>
                        ${badge(feedback.priority)}
                        ${impactBadge(feedback.potentialImpact)}
                        <span>${escapeHtml(feedback.theme)}</span>
                      </button>
                    `,
                  )
                  .join("")
              : emptyState()
          }
        </div>
        <div class="pagination">
          <span>Pagina ${state.page} de ${totalPages}</span>
          <div>
            <button class="secondary-button" type="button" id="prev-page" ${state.page === 1 ? "disabled" : ""}>Anterior</button>
            <button class="secondary-button" type="button" id="next-page" ${state.page === totalPages ? "disabled" : ""}>Proxima</button>
          </div>
        </div>
      </section>
    </main>
  `;
}

function metric(label, value, large = false) {
  return `
    <div class="metric ${large ? "large" : ""}">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderDetail() {
  const feedback = state.feedbacks.find((item) => item.id === state.selectedId);
  if (!feedback) return `<main class="view">${emptyState()}</main>`;

  return `
    <main class="view">
      <button class="back-button" type="button" id="back-button">Voltar</button>
      <div class="detail-layout">
        <section class="panel detail-main">
          <span class="eyebrow">${escapeHtml(feedback.source)} | ${escapeHtml(feedback.channel)}</span>
          <h1>${escapeHtml(feedback.customer)}</h1>
          <p class="feedback-text">${escapeHtml(feedback.text)}</p>
          <div class="insight-box">
            <h2>Resumo executivo</h2>
            <p>${escapeHtml(feedback.executiveSummary)}</p>
          </div>
          <div class="insight-box action">
            <h2>Sugestao de acao</h2>
            <p>${escapeHtml(feedback.actionSuggestion)}</p>
          </div>
        </section>

        <aside class="panel detail-side">
          <h2>Classificacao IA</h2>
          ${metric("Categoria", feedback.category)}
          ${metric("Sentimento", feedback.sentiment)}
          ${metric("Prioridade", feedback.priority)}
          ${metric("Impacto potencial", feedback.potentialImpact)}
          ${metric("Tema", feedback.theme)}
          ${metric("Problema principal", feedback.mainProblem, true)}
        </aside>
      </div>
    </main>
  `;
}

function renderFeedbackModal() {
  const feedback = state.feedbacks.find((item) => item.id === state.modalFeedbackId);
  if (!feedback) return "";

  return `
    <div class="modal-backdrop" data-close-modal="true">
      <section class="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-modal-title">
        <div class="modal-header">
          <div>
            <span class="eyebrow">${escapeHtml(feedback.source)} | ${escapeHtml(feedback.channel)}</span>
            <h2 id="feedback-modal-title">${escapeHtml(feedback.customer)}</h2>
          </div>
          <button class="modal-close" type="button" data-close-modal="true">Fechar</button>
        </div>

        <div class="modal-body">
          <section class="modal-main">
            <div class="insight-box original">
              <h3>Feedback original</h3>
              <p>${escapeHtml(feedback.text)}</p>
            </div>
            <div class="insight-box action">
              <h3>Sugestao da IA</h3>
              <p>${escapeHtml(feedback.actionSuggestion)}</p>
            </div>
            <div class="insight-box">
              <h3>Justificativa da classificacao</h3>
              <p>${escapeHtml(getClassificationReason(feedback))}</p>
            </div>
          </section>

          <aside class="modal-side">
            ${metric("Categoria", feedback.category)}
            ${metric("Sentimento", feedback.sentiment)}
            ${metric("Prioridade", feedback.priority)}
            ${metric("Impacto potencial", feedback.potentialImpact)}
            ${metric("Problema principal", feedback.mainProblem, true)}
          </aside>
        </div>
      </section>
    </div>
  `;
}

function renderArchitecture() {
  return `
    <main class="view">
      <div class="view-title">
        <div>
          <span class="eyebrow">Arquitetura da Solucao</span>
          <h1>Plataforma de inteligencia operacional</h1>
        </div>
        <div class="hero-mark">${icons.brain}</div>
      </div>

      <section class="architecture-grid">
        <div class="panel architecture-card">
          <span>01</span>
          <h2>Entrada de feedbacks</h2>
          <p>Cadastro manual, importacao em lote e upload CSV alimentam a mesma API de feedbacks.</p>
        </div>
        <div class="panel architecture-card">
          <span>02</span>
          <h2>Classificacao IA</h2>
          <p>O modulo local classifica categoria, sentimento, prioridade, problema, resumo e acao sugerida.</p>
        </div>
        <div class="panel architecture-card">
          <span>03</span>
          <h2>Camada OpenAI-ready</h2>
          <p>A funcao classifyWithOpenAI esta preparada para substituir o fallback local mantendo o mesmo contrato.</p>
        </div>
        <div class="panel architecture-card">
          <span>04</span>
          <h2>Inteligencia operacional</h2>
          <p>Dashboard, alertas criticos, filtros, tendencia temporal, tabela paginada e detalhe acionavel.</p>
        </div>
      </section>

      <section class="panel flow-panel">
        <div class="panel-header"><h2>Fluxo da solucao</h2></div>
        <div class="flow">
          <span>CSV / formulario</span>
          <i></i>
          <span>API Node</span>
          <i></i>
          <span>Classificador</span>
          <i></i>
          <span>Dashboard CX / Produto / Ops</span>
        </div>
      </section>
    </main>
  `;
}

function emptyState() {
  return `<div class="empty-state">${icons.file}<p>Nenhum feedback encontrado.</p></div>`;
}

function layout(content) {
  return `
    <div class="app-shell ${state.darkMode ? "dark" : ""}">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">${icons.brain}</div>
          <div><strong>AI Feedback</strong><span>Intelligence</span></div>
        </div>
        <nav>
          <button class="${state.view === "dashboard" ? "active" : ""}" data-view="dashboard">${icons.chart} Dashboard</button>
          <button class="${state.view === "form" ? "active" : ""}" data-view="form">${icons.input} Entrada</button>
          <button class="${state.view === "list" ? "active" : ""}" data-view="list">${icons.file} Feedbacks</button>
          <button class="${state.view === "architecture" ? "active" : ""}" data-view="architecture">${icons.brain} Arquitetura</button>
        </nav>
        <div class="sidebar-footer">
          <span>MVP Portfolio</span>
          <strong>Produto, Ops e CX</strong>
          <button class="theme-toggle" type="button" id="theme-toggle">${state.darkMode ? "Light mode" : "Dark mode"}</button>
        </div>
      </aside>
      <div class="content-area">
        ${state.error ? `<div class="error-banner">${escapeHtml(state.error)}</div>` : ""}
        ${content}
      </div>
      ${renderFeedbackModal()}
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => selectFeedback(button.dataset.select));
  });

  document.querySelectorAll("[data-close-modal]").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target === element) closeFeedbackModal();
    });
  });

  const backButton = document.querySelector("#back-button");
  if (backButton) backButton.addEventListener("click", () => setView("list"));

  const searchInput = document.querySelector("#search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      state.page = 1;
      render();
    });
  }

  ["category", "sentiment", "priority", "theme", "source", "channel"].forEach((key) => {
    const field = document.querySelector(`#filter-${key}`);
    if (field) {
      field.addEventListener("change", (event) => {
        state.filters[key] = event.target.value;
        state.page = 1;
        render();
      });
    }
  });

  const clearFilters = document.querySelector("#clear-filters");
  if (clearFilters) clearFilters.addEventListener("click", resetFilters);

  const pageSize = document.querySelector("#page-size");
  if (pageSize) {
    pageSize.addEventListener("change", (event) => {
      state.pageSize = Number(event.target.value);
      state.page = 1;
      render();
    });
  }

  const prevPage = document.querySelector("#prev-page");
  if (prevPage) prevPage.addEventListener("click", () => { state.page -= 1; render(); });

  const nextPage = document.querySelector("#next-page");
  if (nextPage) nextPage.addEventListener("click", () => { state.page += 1; render(); });

  const themeToggle = document.querySelector("#theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      state.darkMode = !state.darkMode;
      render();
    });
  }

  const form = document.querySelector("#feedback-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      state.status = "Classificando feedback...";
      render();
      const created = await api("/feedbacks", { method: "POST", body: JSON.stringify(data) });
      await loadData();
      selectFeedback(created.id);
    });
  }

  const importButton = document.querySelector("#import-button");
  if (importButton) {
    importButton.addEventListener("click", async () => {
      const text = document.querySelector("#import-text").value;
      const items = text
        .split("\n")
        .map((line, index) => ({ text: line.trim(), customer: `Importado ${index + 1}`, source: "Importacao", channel: "Lote" }))
        .filter((item) => item.text);

      if (!items.length) return;
      await api("/feedbacks/import", { method: "POST", body: JSON.stringify({ items }) });
      state.status = `${items.length} feedbacks importados.`;
      await loadData();
      state.view = "form";
      render();
    });
  }

  const csvInput = document.querySelector("#csv-input");
  if (csvInput) {
    csvInput.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const content = await file.text();
      const items = parseCsv(content);
      if (!items.length) {
        state.status = "CSV sem feedbacks validos.";
        render();
        return;
      }
      await api("/feedbacks/import", { method: "POST", body: JSON.stringify({ items }) });
      state.status = `${items.length} feedbacks importados via CSV.`;
      await loadData();
      state.view = "form";
      render();
    });
  }
}

function render() {
  const views = {
    dashboard: renderDashboard,
    form: renderForm,
    list: renderList,
    detail: renderDetail,
    architecture: renderArchitecture,
  };

  document.querySelector("#root").innerHTML = layout(views[state.view]());
  bindEvents();
}

loadData();
