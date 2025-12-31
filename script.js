// script.js
// Match Intelligence — kompletní skript s opravou porovnávání textových metrik

// -------------------- Utility / formátování --------------------
function nowIso() { return new Date().toISOString(); }

function escapeHtml(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDateDMY(d) {
  const m = (d || '').match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!m) return new Date(0);
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  const yy = parseInt(m[3], 10);
  const year = 2000 + yy;
  return new Date(year, mm, dd);
}

function pct(v) {
  if (v === undefined || v === null || isNaN(v)) return "0 %";
  return (Math.round(v * 10) / 10).toString().replace('.', ',') + " %";
}
function num(v, digits = 2) {
  if (v === undefined || v === null || isNaN(v)) return "0,00";
  return (Math.round(v * Math.pow(10, digits)) / Math.pow(10, digits)).toString().replace('.', ',');
}
function share(cnt, total) {
  if (!total) return "0 %";
  return pct(cnt / total * 100);
}
function lastLabel(arr) {
  if (!arr || !arr.length) return "—";
  return arr.map(m => m.res).join('');
}
function resultString(m) {
  if (!m) return "—";
  return `${m.team1} vs ${m.team2}: ${m.hGoals}-${m.aGoals} (${m.dateStr})`;
}
function resToCz(res) {
  if (res === "W") return "Výhra";
  if (res === "D") return "Remíza";
  if (res === "L") return "Prohra";
  return res;
}
function tryParseNumber(str) {
  if (!str) return null;
  const normalized = ("" + str).replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!normalized) return null;
  const num = parseFloat(normalized[0]);
  return isNaN(num) ? null : num;
}
function fmtPctShort(x) {
  if (x === undefined || x === null || isNaN(x)) return "0,0 %";
  return (Math.round(x * 1000) / 10).toString().replace('.', ',') + ' %';
}
function fmtNumShort(x, d = 2) {
  if (x === undefined || x === null || isNaN(x)) return "0,00";
  return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toString().replace('.', ',');
}

// -------------------- Parsování bloku týmu a výpočty statistik --------------------
function parseTeamBlock(text) {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(l => l !== "");
  if (!lines.length) return null;

  let name = "Tým";
  const first = lines[0];
  const matchName = first.match(/Last matches:\s*(.+)$/i);
  if (matchName) name = matchName[1].trim();

  const idxList = lines.findIndex(l => /^Seznam zápasů/i.test(l));
  if (idxList === -1) return { name, matches: [], stats: {} };

  const startIdx = idxList + 1;

  const matchRegex =
    /^(.+?)\s+vs\s+(.+?):\s+(\d+)[\-:–]\s*(\d+)\s+-\s+(Výhra|Prohra|Remíza|W|D|L)\s+\((\d{2}\.\d{2}\.\d{2})\)$/i;

  const matchesRaw = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(matchRegex);
    if (!m) continue;

    const team1 = m[1].trim();
    const team2 = m[2].trim();
    const hGoals = parseInt(m[3], 10);
    const aGoals = parseInt(m[4], 10);
    const resWord = m[5].trim();
    const dateStr = m[6].trim();
    const dateObj = parseDateDMY(dateStr);

    const isHome = team1.toLowerCase() === name.toLowerCase();
    const isAway = team2.toLowerCase() === name.toLowerCase();
    if (!isHome && !isAway) continue;

    let gf, ga;
    if (isHome) { gf = hGoals; ga = aGoals; }
    else        { gf = aGoals; ga = hGoals; }

    let res = "D";
    if (gf > ga) res = "W";
    else if (gf < ga) res = "L";

    matchesRaw.push({
      team1,
      team2,
      hGoals,
      aGoals,
      gf,
      ga,
      res,
      resWord,
      dateStr,
      dateObj,
      isHome,
      lineOriginal: line
    });
  }

  if (!matchesRaw.length) return { name, matches: [], stats: {} };

  const matches = matchesRaw.slice().sort((a, b) => b.dateObj - a.dateObj);
  const n = matches.length;

  let wins = 0, draws = 0, losses = 0;
  let goalsFor = 0, goalsAgainst = 0;
  let cleanSheets = 0;
  let noLoss = 0;
  let atLeast1GF = 0;
  let more1GF = 0;
  let max1GA = 0;
  let highestWinDiff = -Infinity, highestLossDiff = -Infinity;
  let highestWin = null, highestLoss = null;
  let over25 = 0, under25 = 0;
  let bothScore = 0;

  let homeWins = 0, homeDraws = 0, homeLosses = 0;
  let awayWins = 0, awayDraws = 0, awayLosses = 0;
  let homeGF = 0, homeGA = 0, awayGF = 0, awayGA = 0;

  for (const m of matches) {
    goalsFor += m.gf;
    goalsAgainst += m.ga;

    if (m.ga === 0) cleanSheets++;
    if (m.res !== "L") noLoss++;
    if (m.gf >= 1) atLeast1GF++;
    if (m.gf > 1) more1GF++;
    if (m.ga <= 1) max1GA++;

    const totalG = m.hGoals + m.aGoals;
    if (totalG > 2.5) over25++;
    else under25++;
    if (m.hGoals > 0 && m.aGoals > 0) bothScore++;

    if (m.res === "W") {
      wins++;
      const diff = m.gf - m.ga;
      if (diff > highestWinDiff) {
        highestWinDiff = diff;
        highestWin = m;
      }
    } else if (m.res === "L") {
      losses++;
      const diff = m.ga - m.gf;
      if (diff > highestLossDiff) {
        highestLossDiff = diff;
        highestLoss = m;
      }
    } else {
      draws++;
    }

    if (m.isHome) {
      homeGF += m.gf;
      homeGA += m.ga;
      if (m.res === "W") homeWins++;
      else if (m.res === "D") homeDraws++;
      else homeLosses++;
    } else {
      awayGF += m.gf;
      awayGA += m.ga;
      if (m.res === "W") awayWins++;
      else if (m.res === "D") awayDraws++;
      else awayLosses++;
    }
  }

  const points = wins * 3 + draws;
  const avgGF = goalsFor / n;
  const avgGA = goalsAgainst / n;

  const winPct = wins / n * 100;
  const drawPct = draws / n * 100;
  const lossPct = losses / n * 100;

  const avgPoints = points / n;

  const last5 = matches.slice(0, 5);
  const last10 = matches.slice(0, 10);

  const ptsLast5 = last5.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0);
  const ptsLast10 = last10.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0);
  const avgPtsLast5 = last5.length ? ptsLast5 / last5.length : 0;

  let trend = "stabilní";
  if (matches.length >= 6) {
    const half = Math.floor(matches.length / 2);
    const firstHalf = matches.slice(half);
    const secondHalf = matches.slice(0, half);
    const ptsFirst = firstHalf.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0) / firstHalf.length;
    const ptsSecond = secondHalf.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0) / secondHalf.length;
    if (ptsSecond > ptsFirst + 0.3) trend = "rostoucí";
    else if (ptsSecond < ptsFirst - 0.3) trend = "klesající";
  }

  const homeMatches = homeWins + homeDraws + homeLosses;
  const awayMatches = awayWins + awayDraws + awayLosses;

  return {
    name,
    matches,
    stats: {
      total: n,
      wins,
      draws,
      losses,
      points,
      goalsFor,
      goalsAgainst,
      diff: goalsFor - goalsAgainst,
      avgGF,
      avgGA,
      winPct,
      drawPct,
      lossPct,
      noLoss,
      cleanSheets,
      atLeast1GF,
      more1GF,
      max1GA,
      highestWin,
      highestLoss,
      last5,
      last10,
      avgPoints,
      avgPtsLast5,
      trend,
      home: {
        matches: homeMatches,
        wins: homeWins,
        draws: homeDraws,
        losses: homeLosses,
        gf: homeGF,
        ga: homeGA,
        avgGF: homeMatches ? homeGF / homeMatches : 0,
        avgGA: homeMatches ? homeGA / homeMatches : 0
      },
      away: {
        matches: awayMatches,
        wins: awayWins,
        draws: awayDraws,
        losses: awayLosses,
        gf: awayGF,
        ga: awayGA,
        avgGF: awayMatches ? awayGF / awayMatches : 0,
        avgGA: awayMatches ? awayGA / awayMatches : 0
      },
      totalGoalsAvg: (goalsFor + goalsAgainst) / n,
      under25,
      over25,
      bothScore
    }
  };
}

// -------------------- Společní soupeři: data a analýza --------------------
function getCommonOpponentsData(home, away) {
  const A = home;
  const B = away;

  const oppsA = new Map();
  const oppsB = new Map();

  for (const m of A.matches) {
    const opp = m.isHome ? m.team2 : m.team1;
    if (opp.toLowerCase() === A.name.toLowerCase()) continue;
    if (opp.toLowerCase() === B.name.toLowerCase()) continue;
    if (!oppsA.has(opp)) oppsA.set(opp, []);
    oppsA.get(opp).push(m);
  }

  for (const m of B.matches) {
    const opp = m.isHome ? m.team2 : m.team1;
    if (opp.toLowerCase() === B.name.toLowerCase()) continue;
    if (opp.toLowerCase() === A.name.toLowerCase()) continue;
    if (!oppsB.has(opp)) oppsB.set(opp, []);
    oppsB.get(opp).push(m);
  }

  const common = [];
  for (const opp of oppsA.keys()) {
    if (oppsB.has(opp)) common.push(opp);
  }

  if (!common.length) return { rows: [], summary: null };

  function summarize(matches, teamName) {
    let pts = 0, gf = 0, ga = 0, w = 0, d = 0, l = 0;
    const lines = [];
    for (const m of matches) {
      const isHome = m.team1.toLowerCase() === teamName.toLowerCase();
      const gfor = isHome ? m.hGoals : m.aGoals;
      const gag = isHome ? m.aGoals : m.hGoals;
      const res = gfor > gag ? "W" : gfor < gag ? "L" : "D";
      if (res === "W") { pts += 3; w++; }
      else if (res === "D") { pts += 1; d++; }
      else { l++; }
      gf += gfor;
      ga += gag;
      lines.push({ date: m.dateStr, score: `${m.hGoals}:${m.aGoals}`, raw: m, res });
    }
    return { pts, gf, ga, w, d, l, lines };
  }

  const rows = [];
  let totalPtsA = 0, totalPtsB = 0, totalGfA = 0, totalGaA = 0, totalGfB = 0, totalGaB = 0;
  for (const opp of common) {
    const aMatches = oppsA.get(opp);
    const bMatches = oppsB.get(opp);
    const aData = summarize(aMatches, A.name);
    const bData = summarize(bMatches, B.name);
    rows.push({
      opponent: opp,
      a: aData,
      b: bData,
      better: aData.pts > bData.pts ? A.name : bData.pts > aData.pts ? B.name : "Vyrovnané"
    });
    totalPtsA += aData.pts; totalPtsB += bData.pts;
    totalGfA += aData.gf; totalGaA += aData.ga;
    totalGfB += bData.gf; totalGaB += bData.ga;
  }

  let overallBetter = "Vyrovnané";
  if (totalPtsA > totalPtsB) overallBetter = A.name;
  else if (totalPtsB > totalPtsA) overallBetter = B.name;

  const summary = {
    totalPtsA, totalPtsB,
    totalGfA, totalGaA,
    totalGfB, totalGaB,
    overallBetter
  };

  return { rows, summary };
}

// -------------------- Head-to-head: data a analýza --------------------
function getHeadToHeadData(home, away) {
  const A = home;
  const B = away;

  const h2h = A.matches.filter(m =>
    (m.team1.toLowerCase() === A.name.toLowerCase() && m.team2.toLowerCase() === B.name.toLowerCase()) ||
    (m.team1.toLowerCase() === B.name.toLowerCase() && m.team2.toLowerCase() === A.name.toLowerCase())
  );

  if (!h2h.length) return { rows: [], summary: null };

  h2h.sort((a, b) => b.dateObj - a.dateObj);

  const rows = [];
  let winsA = 0, winsB = 0, draws = 0, gfA = 0, gaA = 0;
  for (const m of h2h) {
    const isHomeA = m.team1.toLowerCase() === A.name.toLowerCase();
    const gA = isHomeA ? m.hGoals : m.aGoals;
    const gB = isHomeA ? m.aGoals : m.hGoals;
    const resA = gA > gB ? "W" : gA < gB ? "L" : "D";
    if (resA === "W") winsA++;
    else if (resA === "L") winsB++;
    else draws++;
    gfA += gA; gaA += gB;
    rows.push({
      date: m.dateStr,
      match: `${m.team1} vs ${m.team2}`,
      score: `${m.hGoals}:${m.aGoals}`,
      fromA: resToCz(resA)
    });
  }

  let overall = "Vyrovnané";
  if (winsA > winsB) overall = A.name;
  else if (winsB > winsA) overall = B.name;

  const summary = {
    totalMatches: h2h.length,
    winsA, winsB, draws,
    gfA, gaA,
    overall
  };

  return { rows, summary };
}

// -------------------- Poisson a odhady pravděpodobností --------------------
function poissonP(k, lambda) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  let res = p;
  for (let i = 1; i <= k; i++) {
    res *= lambda / i;
  }
  return res;
}

function computeMatchProbabilities(A, B) {
  const expA = (A.avgGF + B.avgGA) / 2;
  const expB = (B.avgGF + A.avgGA) / 2;

  const maxGoals = 6;

  let pAwin = 0, pBwin = 0, pDraw = 0;
  for (let i = 0; i <= maxGoals; i++) {
    const pAi = poissonP(i, expA);
    for (let j = 0; j <= maxGoals; j++) {
      const pBj = poissonP(j, expB);
      const p = pAi * pBj;
      if (i > j) pAwin += p;
      else if (i < j) pBwin += p;
      else pDraw += p;
    }
  }

  const total = pAwin + pBwin + pDraw;
  if (total > 0) {
    pAwin /= total;
    pBwin /= total;
    pDraw /= total;
  }

  const expectedGoals = expA + expB;

  return {
    expA,
    expB,
    expectedGoals,
    pAwin,
    pDraw,
    pBwin
  };
}

// -------------------- Vykreslení tabulek --------------------
function renderComparisonTable(home, away) {
  const container = document.getElementById('reportOutput');
  const probSummary = document.getElementById('probSummary');
  if (!container) return;

  const mapFieldToLabel = {
    total: "Počet odehraných zápasů",
    wins: "Počet výher",
    draws: "Počet remíz",
    losses: "Počet proher",
    points: "Celkový bodový zisk (3–1–0)",
    goalsFor: "Celkový počet vstřelených gólů",
    goalsAgainst: "Celkový počet inkasovaných gólů",
    diff: "Gólový rozdíl",
    avgGF: "Průměr vstřelených gólů na zápas",
    avgGA: "Průměr inkasovaných gólů na zápas",
    winPct: "Podíl výher (%)",
    drawPct: "Podíl remíz (%)",
    lossPct: "Podíl proher (%)",
    last5: "Bilance posledních 5 zápasů",
    last10: "Bilance posledních 10 zápasů",
    trend: "Trend formy",
    avgPoints: "Průměr bodů za zápas (celkově)",
    avgPtsLast5: "Průměr bodů za zápas v posledních 5 zápasech",
    over25: "Podíl zápasů s více než 2,5 gólu",
    bothScore: "Podíl zápasů, kde oba týmy skórovaly",
    totalGoalsAvg: "Průměrný celkový počet gólů v zápasech"
  };

  const keysPriority = [
    "Počet odehraných zápasů","Počet výher","Počet remíz","Počet proher",
    "Celkový bodový zisk (3–1–0)","Celkový počet vstřelených gólů","Celkový počet inkasovaných gólů",
    "Gólový rozdíl","Průměr vstřelených gólů na zápas","Průměr inkasovaných gólů na zápas",
    "Podíl výher (%)","Podíl remíz (%)","Podíl proher (%)",
    "Bilance posledních 5 zápasů","Bilance posledních 10 zápasů","Trend formy",
    "Průměr bodů za zápas (celkově)","Průměr bodů za zápas v posledních 5 zápasech",
    "Průměrný celkový počet gólů v zápasech","Podíl zápasů s více než 2,5 gólu","Podíl zápasů, kde oba týmy skórovaly"
  ];

  const homeStats = home.stats || {};
  const awayStats = away.stats || {};
  const availableLabels = new Set();
  for (const [field,label] of Object.entries(mapFieldToLabel)) {
    if (homeStats[field] !== undefined || awayStats[field] !== undefined) availableLabels.add(label);
  }

  const keys = [];
  for (const k of keysPriority) if (availableLabels.has(k)) keys.push(k);
  for (const [field,label] of Object.entries(mapFieldToLabel)) {
    if (availableLabels.has(label) && !keys.includes(label)) keys.push(label);
  }

  if (!keys.length) {
    container.innerHTML = `<div style="color:var(--text-dim)">Nebyly nalezeny porovnatelné metriky pro tabulku. Zkontroluj vstupní data.</div>`;
    if (probSummary) probSummary.innerHTML = "";
    return;
  }

  function getValueByLabel(stats, label) {
    for (const [field,lbl] of Object.entries(mapFieldToLabel)) {
      if (lbl === label) {
        const v = stats[field];
        if (v === undefined || v === null) return "—";
        if (field === "winPct" || field === "drawPct" || field === "lossPct") return pct(v);
        if (field === "avgGF" || field === "avgGA" || field === "avgPoints" || field === "avgPtsLast5" || field === "totalGoalsAvg") return num(v);
        if (field === "last5" || field === "last10") return lastLabel(v);
        if (field === "over25" || field === "bothScore") return share(v, stats.total);
        return String(v);
      }
    }
    return "—";
  }

  const probsGlobal = computeMatchProbabilities(home.stats, away.stats);

  const lowerIsBetter = [
    "Počet proher",
    "Průměr inkasovaných gólů na zápas",
    "Celkový počet inkasovaných gólů",
    "Podíl proher (%)"
  ];

  let html = `<table class="mi-compare-table"><thead><tr>
    <th>Parametr</th>
    <th>${escapeHtml(home.name)}</th>
    <th>${escapeHtml(away.name)}</th>
    <th>Kdo lepší</th>
  </tr></thead><tbody>`;

  let homeScore = 0, awayScore = 0;

  for (const label of keys) {
    const hVal = getValueByLabel(homeStats, label);
    const aVal = getValueByLabel(awayStats, label);

    const nH = tryParseNumber(String(hVal).replace(/\s/g,''));
    const nA = tryParseNumber(String(aVal).replace(/\s/g,''));

    let resultClass = "mi-compare-na";
    let resultText = "N/A";

    // --- OPRAVA: Speciální logika pro textové metriky Bilance a Trend ---
    if (label.includes("Bilance posledních")) {
        const getPts = (str) => [...str].reduce((acc, c) => acc + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0);
        const ptsH = getPts(String(hVal));
        const ptsA = getPts(String(aVal));
        if (ptsH > ptsA) { resultClass = "mi-compare-home"; resultText = "Domácí"; homeScore++; }
        else if (ptsA > ptsH) { resultClass = "mi-compare-away"; resultText = "Hosté"; awayScore++; }
        else { resultClass = "mi-compare-even"; resultText = "Vyrovnané"; }
    } 
    else if (label === "Trend formy") {
        const trendWeight = { "rostoucí": 2, "stabilní": 1, "klesající": 0 };
        const weightH = trendWeight[hVal] ?? -1;
        const weightA = trendWeight[aVal] ?? -1;
        if (weightH > weightA) { resultClass = "mi-compare-home"; resultText = "Domácí"; homeScore++; }
        else if (weightA > weightH) { resultClass = "mi-compare-away"; resultText = "Hosté"; awayScore++; }
        else if (weightH !== -1) { resultClass = "mi-compare-even"; resultText = "Vyrovnané"; }
    }
    // --- Standardní číselná logika ---
    else if (nH !== null && nA !== null) {
      if (lowerIsBetter.includes(label)) {
        if (nH < nA) { resultClass = "mi-compare-home"; resultText = "Domácí"; homeScore++; }
        else if (nA < nH) { resultClass = "mi-compare-away"; resultText = "Hosté"; awayScore++; }
        else { resultClass = "mi-compare-even"; resultText = "Vyrovnané"; }
      } else {
        if (nH > nA) { resultClass = "mi-compare-home"; resultText = "Domácí"; homeScore++; }
        else if (nA > nH) { resultClass = "mi-compare-away"; resultText = "Hosté"; awayScore++; }
        else { resultClass = "mi-compare-even"; resultText = "Vyrovnané"; }
      }
    }

    html += `<tr>
      <td>${escapeHtml(label)}</td>
      <td>${escapeHtml(hVal)}</td>
      <td>${escapeHtml(aVal)}</td>
      <td style="text-align:center"><span class="result-badge ${resultClass}">${escapeHtml(resultText)}</span></td>
    </tr>`;
  }

  let overall = "Vyrovnané";
  if (homeScore > awayScore) overall = `${escapeHtml(home.name)} má výhodu (${homeScore}:${awayScore})`;
  else if (awayScore > homeScore) overall = `${escapeHtml(away.name)} má výhodu (${homeScore}:${awayScore})`;

  html += `<tr class="mi-summary-row"><td>Souhrn</td><td colspan="2">${escapeHtml(overall)}</td><td></td></tr>`;
  html += `</tbody></table>`;

  const commonData = getCommonOpponentsData(home, away);
  if (commonData.rows.length) {
    html += `<div style="margin-top:12px"><div style="font-weight:700;color:var(--text-dim);font-size:12px;margin-bottom:8px">Výkonnost proti společným soupeřům</div>`;
    html += `<table class="mi-compare-table" style="margin-top:6px"><thead><tr>
      <th>Soupeř</th>
      <th>${escapeHtml(home.name)} — zápasy / body / skóre / W-D-L</th>
      <th>${escapeHtml(away.name)} — zápasy / body / skóre / W-D-L</th>
      <th>Kdo lépe</th>
    </tr></thead><tbody>`;
    for (const r of commonData.rows) {
      const homeCell = `${r.a.lines.map(l => `${l.date} ${l.score} ${resToCz(l.res)}`).join('\n')}\n\nBody: ${r.a.pts} • Skóre: ${r.a.gf}:${r.a.ga} • Bilance: ${r.a.w}-${r.a.d}-${r.a.l}`;
      const awayCell = `${r.b.lines.map(l => `${l.date} ${l.score} ${resToCz(l.res)}`).join('\n')}\n\nBody: ${r.b.pts} • Skóre: ${r.b.gf}:${r.b.ga} • Bilance: ${r.b.w}-${r.b.d}-${r.b.l}`;
      const badgeClass =
        r.better === home.name ? 'mi-compare-home' :
        r.better === away.name ? 'mi-compare-away' :
        'mi-compare-even';
      html += `<tr>
        <td style="vertical-align:top">${escapeHtml(r.opponent)}</td>
        <td style="white-space:pre-wrap; font-family:var(--font-mono)">${escapeHtml(homeCell)}</td>
        <td style="white-space:pre-wrap; font-family:var(--font-mono)">${escapeHtml(awayCell)}</td>
        <td style="text-align:center"><span class="result-badge ${badgeClass}">${escapeHtml(r.better)}</span></td>
      </tr>`;
    }
    const s = commonData.summary;
    const badgeClassSummary =
      s.overallBetter === home.name ? 'mi-compare-home' :
      s.overallBetter === away.name ? 'mi-compare-away' :
      'mi-compare-even';
    html += `<tr class="mi-summary-row"><td>Souhrn společných soupeřů</td>
      <td colspan="2">${escapeHtml(home.name)}: ${s.totalPtsA} bodů, skóre ${s.totalGfA}:${s.totalGaA} • ${escapeHtml(away.name)}: ${s.totalPtsB} bodů, skóre ${s.totalGfB}:${s.totalGaB}</td>
      <td style="text-align:center"><span class="result-badge ${badgeClassSummary}">${escapeHtml(s.overallBetter)}</span></td>
    </tr>`;
    html += `</tbody></table></div>`;
  } else {
    html += `<div style="margin-top:12px;color:var(--text-dim);font-size:13px">Společní soupeři: žádní nalezeni.</div>`;
  }

  const h2hData = getHeadToHeadData(home, away);
  if (h2hData.rows.length) {
    html += `<div style="margin-top:12px"><div style="font-weight:700;color:var(--text-dim);font-size:12px;margin-bottom:8px">Vzájemné zápasy (head-to-head)</div>`;
    html += `<table class="mi-compare-table" style="margin-top:6px"><thead><tr>
      <th>Datum</th>
      <th>Zápas</th>
      <th>Skóre</th>
      <th>Z pohledu ${escapeHtml(home.name)}</th>
    </tr></thead><tbody>`;
    for (const row of h2hData.rows) {
      html += `<tr>
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.match)}</td>
        <td>${escapeHtml(row.score)}</td>
        <td style="text-align:center">${escapeHtml(row.fromA)}</td>
      </tr>`;
    }
    const hs = h2hData.summary;
    const badgeClassH2H =
      hs.overall === home.name ? 'mi-compare-home' :
      hs.overall === away.name ? 'mi-compare-away' :
      'mi-compare-even';
    html += `<tr class="mi-summary-row"><td>Souhrn H2H</td>
      <td colspan="2">Zápasy: ${hs.totalMatches} • ${escapeHtml(home.name)} výhry: ${hs.winsA} • ${escapeHtml(away.name)} výhry: ${hs.winsB} • Remízy: ${hs.draws}</td>
      <td style="text-align:center"><span class="result-badge ${badgeClassH2H}">${escapeHtml(hs.overall)}</span></td>
    </tr>`;
    html += `</tbody></table></div>`;
  } else {
    html += `<div style="margin-top:12px;color:var(--text-dim);font-size:13px">Vzájemné zápasy: žádné nalezeny.</div>`;
  }

  if (probSummary) {
    const pA = probsGlobal.pAwin || 0;
    const pD = probsGlobal.pDraw || 0;
    const pB = probsGlobal.pBwin || 0;
    const expectedGoals = probsGlobal.expectedGoals || 0;

    probSummary.innerHTML = `
      <div class="prob-card">
        <div class="prob-title">Pravděpodobnosti (Poisson)</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <div class="prob-pill prob-home">${escapeHtml(home.name)} ${fmtPctShort(pA)}</div>
          <div class="prob-pill prob-draw">Remíza ${fmtPctShort(pD)}</div>
          <div class="prob-pill prob-away">${escapeHtml(away.name)} ${fmtPctShort(pB)}</div>
        </div>
        <div class="prob-bar" aria-hidden="true" style="margin-top:8px">
          <i style="width:${Math.max(2, Math.round((pA + 0.001) * 100))}%;"></i>
        </div>
      </div>
      <div class="prob-card">
        <div class="prob-title">Očekávané góly</div>
        <div class="prob-value">${fmtNumShort(probsGlobal.expA,2)} (domácí) • ${fmtNumShort(probsGlobal.expB,2)} (hosté)</div>
        <div style="margin-top:6px;color:var(--text-dim)">Celkem: ${fmtNumShort(expectedGoals,2)}</div>
      </div>
    `;
  }

  container.innerHTML = html;

  const textArea = document.getElementById('promptOutput');
  if (textArea) textArea.value = buildFullTextReport(home, away, commonData, h2hData, probsGlobal);
}

// -------------------- Textový report --------------------
function buildFullTextReport(home, away, commonData, h2hData, probsGlobal) {
  const A = home.stats;
  const B = away.stats;

  const mapFieldToLabel = {
    total: "Počet odehraných zápasů",
    wins: "Počet výher",
    draws: "Počet remíz",
    losses: "Počet proher",
    points: "Celkový bodový zisk (3–1–0)",
    goalsFor: "Celkový počet vstřelených gólů",
    goalsAgainst: "Celkový počet inkasovaných gólů",
    diff: "Gólový rozdíl",
    avgGF: "Průměr vstřelených gólů na zápas",
    avgGA: "Průměr inkasovaných gólů na zápas",
    winPct: "Podíl výher (%)",
    drawPct: "Podíl remíz (%)",
    lossPct: "Podíl proher (%)",
    last5: "Bilance posledních 5 zápasů",
    last10: "Bilance posledních 10 zápasů",
    trend: "Trend formy",
    avgPoints: "Průměr bodů za zápas (celkově)",
    avgPtsLast5: "Průměr bodů za zápas v posledních 5 zápasech",
    over25: "Podíl zápasů s více než 2,5 gólu",
    bothScore: "Podíl zápasů, kde oba týmy skórovaly",
    totalGoalsAvg: "Průměrný celkový počet gólů v zápasech"
  };

  let text = `MATCH INTELLIGENCE — KOMPLETNÍ REPORT\n\n`;
  text += `Tým A (domácí): ${home.name}\nTým B (hosté): ${away.name}\n\n`;

  text += `--- Porovnání metrik ---\n`;
  for (const [field,label] of Object.entries(mapFieldToLabel)) {
    const vA = A[field];
    const vB = B[field];
    if (vA === undefined && vB === undefined) continue;
    let sA =
      (field === "winPct" || field === "drawPct" || field === "lossPct") ? pct(vA) :
      (field === "avgGF" || field === "avgGA" || field === "avgPoints" || field === "avgPtsLast5" || field === "totalGoalsAvg") ? num(vA) :
      (field === "last5" || field === "last10") ? lastLabel(vA) :
      (field === "over25" || field === "bothScore") ? share(vA, A.total) :
      (vA === undefined ? "—" : String(vA));

    let sB =
      (field === "winPct" || field === "drawPct" || field === "lossPct") ? pct(vB) :
      (field === "avgGF" || field === "avgGA" || field === "avgPoints" || field === "avgPtsLast5" || field === "totalGoalsAvg") ? num(vB) :
      (field === "last5" || field === "last10") ? lastLabel(vB) :
      (field === "over25" || field === "bothScore") ? share(vB, B.total) :
      (vB === undefined ? "—" : String(vB));

    text += `${label}:\n - ${home.name}: ${sA}\n - ${away.name}: ${sB}\n`;
  }

  text += `\n--- Výkonnost proti společným soupeřům ---\n`;
  if (commonData.rows.length) {
    for (const r of commonData.rows) {
      text += `Soupeř: ${r.opponent}\n`;
      text += `${home.name} — Zápasy:\n`;
      for (const ln of r.a.lines) {
        text += `  • ${ln.date} ${ln.score} ${resToCz(ln.res)}\n`;
      }
      text += `  Body: ${r.a.pts} • Skóre: ${r.a.gf}:${r.a.ga} • Bilance: ${r.a.w}-${r.a.d}-${r.a.l}\n`;

      text += `${away.name} — Zápasy:\n`;
      for (const ln of r.b.lines) {
        text += `  • ${ln.date} ${ln.score} ${resToCz(ln.res)}\n`;
      }
      text += `  Body: ${r.b.pts} • Skóre: ${r.b.gf}:${r.b.ga} • Bilance: ${r.b.w}-${r.b.d}-${r.b.l}\n`;

      text += `Kdo lépe proti ${r.opponent}: ${r.better}\n\n`;
    }
    const s = commonData.summary;
    text += `Souhrn společných soupeřů:\n`;
    text += ` - ${home.name}: ${s.totalPtsA} bodů, skóre ${s.totalGfA}:${s.totalGaA}\n`;
    text += ` - ${away.name}: ${s.totalPtsB} bodů, skóre ${s.totalGfB}:${s.totalGaB}\n`;
    text += `Lepší proti společným soupeřům: ${s.overallBetter}\n\n`;
  }

  text += `--- Vzájemné zápasy (head-to-head) ---\n`;
  if (h2hData.rows.length) {
    for (const r of h2hData.rows) {
      text += `${r.date} — ${r.match} — ${r.score} — z pohledu ${home.name}: ${r.fromA}\n`;
    }
    const hs = h2hData.summary;
    text += `\nSouhrn H2H:\n`;
    text += ` - Počet zápasů: ${hs.totalMatches}\n`;
    text += ` - ${home.name} výhry: ${hs.winsA}\n`;
    text += ` - ${away.name} výhry: ${hs.winsB}\n`;
    text += ` - Remízy: ${hs.draws}\n`;
    text += ` - Celkové skóre z pohledu ${home.name}: ${hs.gfA}:${hs.gaA}\n`;
    text += `Kdo lépe ve vzájemných zápasech: ${hs.overall}\n\n`;
  }

  text += `--- Pravděpodobnosti a očekávané góly (Poisson) ---\n`;
  text += `${home.name} výhra: ${fmtPctShort(probsGlobal.pAwin)}\n`;
  text += `Remíza: ${fmtPctShort(probsGlobal.pDraw)}\n`;
  text += `${away.name} výhra: ${fmtPctShort(probsGlobal.pBwin)}\n`;
  text += `Očekávané góly (domácí / hosté / celkem): ${fmtNumShort(probsGlobal.expA,2)} / ${fmtNumShort(probsGlobal.expB,2)} / ${fmtNumShort(probsGlobal.expectedGoals,2)}\n\n`;

  text += `--- Doplňující poznámky ---\n`;
  text += `- Všechny odhady jsou orientační a vycházejí z Poissonova modelu.\n`;

  return text;
}

// -------------------- Historie (localStorage) --------------------
const HISTORY_KEY = "match_intelligence_history_v1";

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveHistory(arr) { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
function addHistoryItem(homeText, awayText, summary) {
  const hist = loadHistory();
  const item = { id: Date.now(), createdAt: nowIso(), homeText, awayText, summary };
  hist.unshift(item);
  if (hist.length > 300) hist.splice(300);
  saveHistory(hist);
  renderHistoryList();
}
function extractName(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const first = lines[0];
  const idx = first.indexOf(":");
  if (idx > -1) {
    const key = first.slice(0, idx).trim().toLowerCase();
    if (key.includes("název") || key.includes("tým") || key.includes("team")) {
      return first.slice(idx + 1).trim();
    }
  }
  for (const l of lines) {
    if (/^(název|tým|team)\b/i.test(l)) {
      const parts = l.split(":");
      if (parts.length > 1) return parts.slice(1).join(":").trim();
    }
  }
  return first;
}
function renderHistoryList() {
  const container = document.getElementById('historyList');
  if (!container) return;
  const hist = loadHistory();
  container.innerHTML = "";
  if (!hist.length) {
    const d = document.createElement('div'); d.className = 'mi-empty'; d.textContent = "Žádné uložené porovnání"; container.appendChild(d); return;
  }

  hist.forEach(item => {
    const row = document.createElement('div');
    row.className = 'mi-history-item';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.padding = '8px';
    row.style.borderBottom = '1px solid rgba(255,255,255,0.02)';

    const left = document.createElement('div');
    left.style.display = 'flex'; left.style.flexDirection = 'column'; left.style.gap = '4px';

    const teams = document.createElement('div');
    teams.style.fontWeight = '700'; teams.style.color = '#00f5ff';
    teams.textContent = `${extractName(item.homeText) || "DOMÁCÍ"} vs ${extractName(item.awayText) || "HOSTÉ"}`;

    const time = document.createElement('div');
    time.style.fontSize = '12px'; time.style.color = '#8fa0c0';
    time.textContent = new Date(item.createdAt).toLocaleString("cs-CZ");

    left.appendChild(teams); left.appendChild(time);

    const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'NAHRÁT'; loadBtn.style.padding = '6px 8px'; loadBtn.style.borderRadius = '6px';
    loadBtn.style.border = '1px solid rgba(255,255,255,0.04)'; loadBtn.style.background = 'transparent';
    loadBtn.style.color = '#00f5ff'; loadBtn.style.cursor = 'pointer';
    loadBtn.dataset.id = item.id; loadBtn.dataset.action = 'load';

    const delBtn = document.createElement('button');
    delBtn.textContent = 'SMAZAT'; delBtn.style.padding = '6px 8px'; delBtn.style.borderRadius = '6px';
    delBtn.style.border = '1px solid rgba(255,255,255,0.04)'; delBtn.style.background = 'transparent';
    delBtn.style.color = '#ff6b6b'; delBtn.style.cursor = 'pointer';
    delBtn.dataset.id = item.id; delBtn.dataset.action = 'delete';

    actions.appendChild(loadBtn); actions.appendChild(delBtn);

    row.appendChild(left); row.appendChild(actions); container.appendChild(row);
  });

  container.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const action = btn.dataset.action;
      const histArr = loadHistory();
      const item = histArr.find(h => h.id === id);
      if (!item) return;
      if (action === "load") {
        document.getElementById('homeInput').value = item.homeText;
        document.getElementById('awayInput').value = item.awayText;
        generatePrompt();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (action === "delete") {
        const updated = histArr.filter(h => h.id !== id);
        saveHistory(updated);
        renderHistoryList();
      }
    });
  });
}

// -------------------- UI: hlavní funkce --------------------
function generatePrompt() {
  const homeText = document.getElementById('homeInput').value.trim();
  const awayText = document.getElementById('awayInput').value.trim();
  const out = document.getElementById('promptOutput');

  if (!homeText || !awayText) {
    if (out) out.value = "Vyplň prosím blok pro domácí i hosty.";
    return;
  }

  const home = parseTeamBlock(homeText);
  const away = parseTeamBlock(awayText);

  if (!home || !home.matches.length || !away || !away.matches.length) {
    if (out) out.value = "Chyba při parsování zápasů. Zkontroluj formát.";
    return;
  }

  renderComparisonTable(home, away);
  addHistoryItem(homeText, awayText, "Generováno");
}

function copyPrompt() {
  const out = document.getElementById('promptOutput');
  if (!out || !out.value.trim()) return;
  navigator.clipboard.writeText(out.value).then(() => alert("Report zkopírován."));
}

function clearAll() {
  if (!confirm("Vymazat vše?")) return;
  document.getElementById('homeInput').value = "";
  document.getElementById('awayInput').value = "";
  if (document.getElementById('promptOutput')) document.getElementById('promptOutput').value = "";
  if (document.getElementById('reportOutput')) document.getElementById('reportOutput').innerHTML = "";
  if (document.getElementById('probSummary')) document.getElementById('probSummary').innerHTML = "";
}

window.addEventListener('DOMContentLoaded', () => {
  renderHistoryList();
});
