const fs = require('fs');

/**
 * CONFIGURAÇÃO DO GRAPHQL
 * Busca repositórios, estrelas, forks, linguagens e o calendário de contribuições de 1 ano.
 */
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
const fromDate = oneYearAgo.toISOString();

const GRAPHQL_QUERY = `
query($fromDate: DateTime!) {
  viewer {
    login
    name
    bio
    followers {
      totalCount
    }
    following {
      totalCount
    }
    repositories(first: 100, ownerAffiliations: OWNER) {
      totalCount
      nodes {
        isPrivate
        stargazerCount
        forkCount
        languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
          edges {
            size
            node {
              name
              color
            }
          }
        }
      }
    }
    contributionsCollection(from: $fromDate) {
      restrictedContributionsCount
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
          }
        }
      }
    }
  }
}
`;

/**
 * Dados de demonstração (Mock) caso o token GH_PAT não esteja configurado localmente.
 * Isso garante que o preview não fique quebrado durante o desenvolvimento local.
 */
const MOCK_DATA = {
  login: "Cesarcfw",
  name: "César Filho",
  bio: "Desenvolvedor & Acadêmico de Ciência da Computação",
  followers: { totalCount: 84 },
  following: { totalCount: 96 },
  repositories: {
    totalCount: 28,
    nodes: [
      { isPrivate: false, stargazerCount: 15, forkCount: 4, languages: { edges: [{ size: 45000, node: { name: "TypeScript", color: "#3178c6" } }, { size: 30000, node: { name: "JavaScript", color: "#f7df1e" } }, { size: 15000, node: { name: "Python", color: "#3572A5" } }, { size: 8000, node: { name: "Jupyter Notebook", color: "#DA5B0B" } }] } },
      { isPrivate: true, stargazerCount: 2, forkCount: 0, languages: { edges: [{ size: 25000, node: { name: "Vue", color: "#41b883" } }, { size: 10000, node: { name: "C++", color: "#f34b7d" } }] } }
    ]
  },
  contributionsCollection: {
    restrictedContributionsCount: 145,
    totalCommitContributions: 210,
    totalPullRequestContributions: 18,
    totalIssueContributions: 4,
    contributionCalendar: {
      totalContributions: 355,
      weeks: Array.from({ length: 52 }, (_, weekIdx) => {
        const sunday = new Date();
        sunday.setDate(sunday.getDate() - (52 - weekIdx) * 7);
        return {
          contributionDays: Array.from({ length: 7 }, (_, dayIdx) => {
            const date = new Date(sunday);
            date.setDate(sunday.getDate() + dayIdx);
            const hasContrib = (weekIdx % 3 !== 0) || (dayIdx > 2);
            return {
              contributionCount: hasContrib ? 3 : 0,
              date: date.toISOString().split('T')[0]
            };
          })
        };
      })
    }
  }
};

/**
 * Busca dados da API GraphQL do GitHub ou retorna dados de Mock se o token não existir.
 */
async function fetchGitHubData() {
  const token = process.env.GH_PAT;
  if (!token) {
    console.warn("\n⚠️ AVISO: A variável de ambiente 'GH_PAT' não foi encontrada.");
    console.warn("Gerando SVGs usando dados de demonstração (MOCK_DATA) para o preview local.\n");
    return MOCK_DATA;
  }

  console.log("Iniciando requisição à API do GitHub...");
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'node-fetch'
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { fromDate }
    }),
  });

  const json = await response.json();
  if (json.errors) {
    console.error("Erros retornados pela API do GitHub:", json.errors);
    throw new Error("Erro na requisição GraphQL");
  }

  return json.data.viewer;
}

/**
 * 1. GERADOR DO CARD DE ESTATÍSTICAS GERAIS (my-stats.svg)
 */
function generateStatsSVG(data) {
  const name = data.name || data.login;
  const followers = data.followers.totalCount;
  const totalRepos = data.repositories.totalCount;
  const privateRepos = data.repositories.nodes.filter(r => r.isPrivate).length;
  const publicRepos = totalRepos - privateRepos;
  const stars = data.repositories.nodes.reduce((acc, r) => acc + r.stargazerCount, 0);
  const forks = data.repositories.nodes.reduce((acc, r) => acc + r.forkCount, 0);
  const publicCommits = data.contributionsCollection.totalCommitContributions;
  const privateCommits = data.contributionsCollection.restrictedContributionsCount;
  const totalCommits = publicCommits + privateCommits;
  const pullRequests = data.contributionsCollection.totalPullRequestContributions;
  const issues = data.contributionsCollection.totalIssueContributions;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="530" height="260" viewBox="0 0 530 260">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8257e6" />
      <stop offset="100%" stop-color="#3a1c1c" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>
  <style>
    .card { fill: #121214; stroke: #8257e6; stroke-width: 1.5; rx: 12px; filter: url(#shadow); }
    .header-bar { fill: url(#headerGrad); height: 12px; rx: 12px 12px 0 0; }
    .title { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 18px; font-weight: bold; fill: #8257e6; }
    .subtitle { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 13px; fill: #7c7c8a; }
    .label { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 14px; fill: #e1e1e6; font-weight: 500; }
    .value { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 14px; fill: #8257e6; font-weight: bold; }
    .icon { font-size: 16px; }
  </style>
  <rect width="530" height="260" class="card" />
  <rect width="530" height="12" class="header-bar" />
  <g transform="translate(25, 45)">
    <text x="0" y="0" class="title">Estatísticas do Git — ${name}</text>
    <text x="0" y="20" class="subtitle">Dados de repositórios públicos e privados</text>
  </g>
  <line x1="25" y1="80" x2="505" y2="80" stroke="#29292e" stroke-width="1" />
  
  <!-- Coluna 1 -->
  <g transform="translate(25, 110)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="icon">🔥</text>
      <text x="25" y="-3" class="label">Commits (Ano):</text>
      <text x="145" y="-3" class="value">${totalCommits}</text>
      <text x="195" y="-4" class="subtitle">(${publicCommits} pub / ${privateCommits} priv)</text>
    </g>
    <g transform="translate(0, 30)">
      <text x="0" y="0" class="icon">📁</text>
      <text x="25" y="-3" class="label">Repositórios:</text>
      <text x="145" y="-3" class="value">${totalRepos}</text>
      <text x="195" y="-4" class="subtitle">(${publicRepos} pub / ${privateRepos} priv)</text>
    </g>
    <g transform="translate(0, 60)">
      <text x="0" y="0" class="icon">🔀</text>
      <text x="25" y="-3" class="label">Pull Requests:</text>
      <text x="145" y="-3" class="value">${pullRequests}</text>
    </g>
    <g transform="translate(0, 90)">
      <text x="0" y="0" class="icon">❗</text>
      <text x="25" y="-3" class="label">Issues Abertas:</text>
      <text x="145" y="-3" class="value">${issues}</text>
    </g>
  </g>
  
  <!-- Coluna 2 (Ajustada para o lado para evitar overlap) -->
  <g transform="translate(365, 110)">
    <g transform="translate(0, 0)">
      <text x="0" y="0" class="icon">⭐</text>
      <text x="25" y="-3" class="label">Estrelas:</text>
      <text x="110" y="-3" class="value">${stars}</text>
    </g>
    <g transform="translate(0, 30)">
      <text x="0" y="0" class="icon">🍴</text>
      <text x="25" y="-3" class="label">Forks:</text>
      <text x="110" y="-3" class="value">${forks}</text>
    </g>
    <g transform="translate(0, 60)">
      <text x="0" y="0" class="icon">👥</text>
      <text x="25" y="-3" class="label">Seguidores:</text>
      <text x="110" y="-3" class="value">${followers}</text>
    </g>
  </g>
  
  <line x1="25" y1="225" x2="505" y2="225" stroke="#29292e" stroke-width="1" />
  <text x="25" y="245" class="subtitle">Atualizado via GitHub Actions</text>
</svg>
  `;
}

/**
 * 2. GERADOR DO CARD DE IDIOMAS (my-languages.svg)
 */
function generateLanguagesSVG(data) {
  const langMap = {};
  
  data.repositories.nodes.forEach(repo => {
    if (repo.languages && repo.languages.edges) {
      repo.languages.edges.forEach(edge => {
        let name = edge.node.name;
        let color = edge.node.color || '#cccccc';
        const size = edge.size;
        
        // Mapeia Jupyter Notebook como Python
        if (name === "Jupyter Notebook") {
          name = "Python";
          color = "#3572A5";
        }
        
        if (!langMap[name]) {
          langMap[name] = { name, color, size: 0 };
        }
        langMap[name].size += size;
      });
    }
  });

  const sortedLangs = Object.values(langMap)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  const totalSize = sortedLangs.reduce((acc, curr) => acc + curr.size, 0);

  let barElements = '';
  let legendElements = '';
  let currentX = 0;
  const barWidth = 480;

  sortedLangs.forEach((lang, idx) => {
    const percentage = totalSize > 0 ? (lang.size / totalSize) * 100 : 0;
    const width = (percentage / 100) * barWidth;
    
    barElements += `<rect x="${currentX}" y="0" width="${width}" height="12" fill="${lang.color}" ${idx === 0 ? 'rx="6" ry="6"' : ''} ${idx === sortedLangs.length - 1 ? 'rx="6" ry="6"' : ''} />`;
    
    if (idx > 0 && idx < sortedLangs.length) {
      barElements += `<rect x="${currentX}" y="0" width="4" height="12" fill="${lang.color}" />`;
    }
    
    currentX += width;

    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const xPos = col === 0 ? 0 : 250;
    const yPos = row * 28;

    legendElements += `
      <g transform="translate(${xPos}, ${yPos})">
        <circle cx="5" cy="5" r="5" fill="${lang.color}" />
        <text x="18" y="9" class="label">${lang.name}</text>
        <text x="160" y="9" class="value">${percentage.toFixed(1)}%</text>
      </g>
    `;
  });

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="530" height="260" viewBox="0 0 530 260">
  <defs>
    <linearGradient id="headerGradLangs" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8257e6" />
      <stop offset="100%" stop-color="#3a1c1c" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>
  <style>
    .card { fill: #121214; stroke: #8257e6; stroke-width: 1.5; rx: 12px; filter: url(#shadow); }
    .header-bar { fill: url(#headerGradLangs); height: 12px; rx: 12px 12px 0 0; }
    .title { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 18px; font-weight: bold; fill: #8257e6; }
    .subtitle { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 13px; fill: #7c7c8a; }
    .label { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 14px; fill: #e1e1e6; }
    .value { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 14px; fill: #8257e6; font-weight: bold; }
  </style>
  <rect width="530" height="260" class="card" />
  <rect width="530" height="12" class="header-bar" />
  
  <g transform="translate(25, 45)">
    <text x="0" y="0" class="title">Linguagens Mais Utilizadas</text>
    <text x="0" y="20" class="subtitle">Linguagens dominantes nos repositórios ativos</text>
  </g>
  <line x1="25" y1="80" x2="505" y2="80" stroke="#29292e" stroke-width="1" />

  <g transform="translate(25, 100)">
    ${barElements}
  </g>

  <g transform="translate(25, 135)">
    ${legendElements}
  </g>

  <line x1="25" y1="225" x2="505" y2="225" stroke="#29292e" stroke-width="1" />
  <text x="25" y="245" class="subtitle">Atualizado via GitHub Actions</text>
</svg>
  `;
}

/**
 * 3. GERADOR DO CARD DE STREAK DE CONTRIBUIÇÕES (my-streak.svg)
 */
function generateStreakSVG(data) {
  const days = [];
  data.contributionsCollection.contributionCalendar.weeks.forEach(w => {
    w.contributionDays.forEach(d => {
      days.push({
        date: d.date,
        count: d.contributionCount
      });
    });
  });
  days.sort((a, b) => new Date(a.date) - new Date(b.date));

  let longestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < days.length; i++) {
    if (days[i].count > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else {
      tempStreak = 0;
    }
  }

  let todayIdx = days.length - 1;
  if (todayIdx >= 0) {
    let checkIdx = todayIdx;
    if (days[todayIdx].count === 0 && todayIdx > 0 && days[todayIdx - 1].count > 0) {
      checkIdx = todayIdx - 1;
    }
    while (checkIdx >= 0 && days[checkIdx].count > 0) {
      currentStreak++;
      checkIdx--;
    }
  }

  const totalContributions = data.contributionsCollection.contributionCalendar.totalContributions;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="530" height="260" viewBox="0 0 530 260">
  <defs>
    <linearGradient id="headerGradStreak" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8257e6" />
      <stop offset="100%" stop-color="#3a1c1c" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>
  <style>
    .card { fill: #121214; stroke: #8257e6; stroke-width: 1.5; rx: 12px; filter: url(#shadow); }
    .header-bar { fill: url(#headerGradStreak); height: 12px; rx: 12px 12px 0 0; }
    .title { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 18px; font-weight: bold; fill: #8257e6; }
    .subtitle { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 13px; fill: #7c7c8a; }
    .streak-val { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 28px; font-weight: 800; fill: #ffffff; text-anchor: middle; }
    .streak-lbl { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 12px; fill: #8257e6; font-weight: bold; text-anchor: middle; }
    .streak-sub { font-family: 'Segoe UI', Ubuntu, sans-serif; font-size: 10px; fill: #7c7c8a; text-anchor: middle; }
  </style>
  <rect width="530" height="260" class="card" />
  <rect width="530" height="12" class="header-bar" />
  
  <g transform="translate(25, 45)">
    <text x="0" y="0" class="title">Streak de Contribuições</text>
    <text x="0" y="20" class="subtitle">Atividade contínua no GitHub nos últimos 365 dias</text>
  </g>
  <line x1="25" y1="80" x2="505" y2="80" stroke="#29292e" stroke-width="1" />

  <!-- Estatística 1: Total Contribs -->
  <g transform="translate(95, 140)">
    <text x="0" y="0" class="streak-val">${totalContributions}</text>
    <text x="0" y="25" class="streak-lbl">TOTAL DE CONTRIBS</text>
    <text x="0" y="40" class="streak-sub">Último ano</text>
  </g>

  <!-- Linha divisória interna 1 -->
  <line x1="195" y1="110" x2="195" y2="180" stroke="#29292e" stroke-width="1" />

  <!-- Estatística 2: Streak Atual -->
  <g transform="translate(265, 140)">
    <text x="0" y="0" class="streak-val" fill="#8257e6">${currentStreak} dias</text>
    <text x="0" y="25" class="streak-lbl" fill="#8257e6">STREAK ATUAL</text>
    <text x="0" y="40" class="streak-sub">Fogo aceso!</text>
  </g>

  <!-- Linha divisória interna 2 -->
  <line x1="335" y1="110" x2="335" y2="180" stroke="#29292e" stroke-width="1" />

  <!-- Estatística 3: Maior Streak -->
  <g transform="translate(435, 140)">
    <text x="0" y="0" class="streak-val">${longestStreak} dias</text>
    <text x="0" y="25" class="streak-lbl">MAIOR STREAK</text>
    <text x="0" y="40" class="streak-sub">Recorde pessoal</text>
  </g>

  <line x1="25" y1="225" x2="505" y2="225" stroke="#29292e" stroke-width="1" />
  <text x="25" y="245" class="subtitle">Atualizado via GitHub Actions</text>
</svg>
  `;
}

// Execução principal
async function run() {
  try {
    console.log("Iniciando geração de estatísticas...");
    const data = await fetchGitHubData();
    
    const statsSvg = generateStatsSVG(data);
    fs.writeFileSync('my-stats.svg', statsSvg, 'utf-8');
    console.log("Card 'my-stats.svg' gerado!");

    const langsSvg = generateLanguagesSVG(data);
    fs.writeFileSync('my-languages.svg', langsSvg, 'utf-8');
    console.log("Card 'my-languages.svg' gerado!");

    const streakSvg = generateStreakSVG(data);
    fs.writeFileSync('my-streak.svg', streakSvg, 'utf-8');
    console.log("Card 'my-streak.svg' gerado!");

    console.log("\n✅ Todos os SVGs foram criados com sucesso na raiz do projeto!");
  } catch (error) {
    console.error("Falha ao gerar as estatísticas:", error);
    process.exit(1);
  }
}

run();
