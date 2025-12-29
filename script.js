// ---------- Pomocné funkce ----------

// parseuje datum ve formátu DD.MM.RR -> Date
function parseDateDMY(d) {
    const m = d.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
    if (!m) return new Date(0);
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10) - 1;
    const yy = parseInt(m[3], 10);
    const year = 2000 + yy;
    return new Date(year, mm, dd);
}

function pct(v) {
    return (Math.round(v * 10) / 10).toString().replace('.', ',');
}
function num(v) {
    return (Math.round(v * 100) / 100).toString().replace('.', ',');
}
function share(cnt, total) {
    if (!total) return "0 %";
    return pct(cnt / total * 100) + " %";
}

function lastLabel(arr) {
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

// ---------- Parsing jednoho týmu ----------

function parseTeamBlock(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l !== "");
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

    // seřadíme podle data – od nejnovějšího po nejstarší
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

    const ptsLast5 = last5.reduce(
        (s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0),
        0
    );
    const ptsLast10 = last10.reduce(
        (s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0),
        0
    );
    const avgPtsLast5 = last5.length ? ptsLast5 / last5.length : 0;

    let trend = "stabilní";
    if (matches.length >= 6) {
        const half = Math.floor(matches.length / 2);
        const firstHalf = matches.slice(half);      // starší
        const secondHalf = matches.slice(0, half);  // novější
        const ptsFirst = firstHalf.reduce(
            (s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0),
            0
        ) / firstHalf.length;
        const ptsSecond = secondHalf.reduce(
            (s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0),
            0
        ) / secondHalf.length;
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

// ---------- Společní soupeři & vzájemné zápasy ----------

function buildCommonOpponentsSection(home, away) {
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

    if (!common.length) {
        return `Výkonnost proti společným soupeřům

Společní soupeři: žádní společní soupeři nebyli nalezeni.
`;
    }

    let text = `Výkonnost proti společným soupeřům

Společní soupeři: ${common.join(', ')}

`;

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
            lines.push(`- ${m.team1} vs ${m.team2}: ${m.hGoals}-${m.aGoals} (${resToCz(res)} ${m.dateStr})`);
        }
        return { pts, gf, ga, w, d, l, lines };
    }

    for (const opp of common) {
        const aData = summarize(oppsA.get(opp), A.name);
        const bData = summarize(oppsB.get(opp), B.name);

        text += `Soupeř: ${opp}

[ ${A.name} proti ${opp} ]
${aData.lines.join('\n')}
Body: ${aData.pts}
Skóre: ${aData.gf}:${aData.ga}
Bilance (W-D-L): ${aData.w}-${aData.d}-${aData.l}

[ ${B.name} proti ${opp} ]
${bData.lines.join('\n')}
Body: ${bData.pts}
Skóre: ${bData.gf}:${bData.ga}
Bilance (W-D-L): ${bData.w}-${bData.d}-${bData.l}

`;
    }

    // Souhrn
    let totalPtsA = 0, totalPtsB = 0;
    let totalGfA = 0, totalGaA = 0, totalGfB = 0, totalGaB = 0;

    for (const opp of common) {
        const aData = summarize(oppsA.get(opp), A.name);
        const bData = summarize(oppsB.get(opp), B.name);
        totalPtsA += aData.pts;
        totalPtsB += bData.pts;
        totalGfA += aData.gf; totalGaA += aData.ga;
        totalGfB += bData.gf; totalGaB += bData.ga;
    }

    let better = "vyrovnaná";
    if (totalPtsA > totalPtsB) better = A.name;
    else if (totalPtsB > totalPtsA) better = B.name;

    text += `Souhrn proti společným soupeřům
- ${A.name}: ${totalPtsA} bodů, skóre ${totalGfA}:${totalGaA}
- ${B.name}: ${totalPtsB} bodů, skóre ${totalGfB}:${totalGaB}
Lepší výkonnost proti společným soupeřům: ${better}

`;

    return text;
}

function buildHeadToHeadSection(home, away) {
    const A = home;
    const B = away;

    const h2h = A.matches.filter(m =>
        m.team1.toLowerCase() === A.name.toLowerCase() && m.team2.toLowerCase() === B.name.toLowerCase() ||
        m.team1.toLowerCase() === B.name.toLowerCase() && m.team2.toLowerCase() === A.name.toLowerCase()
    );

    if (!h2h.length) {
        return `Výsledky vzájemných zápasů (pokud existují)

Žádné vzájemné zápasy nenalezeny.

`;
    }

    // seřadíme od nejnovějšího
    h2h.sort((a, b) => b.dateObj - a.dateObj);

    let text = `Výsledky vzájemných zápasů (pokud existují)

`;

    let winsA = 0, winsB = 0, draws = 0;
    let gfA = 0, gaA = 0;

    for (const m of h2h) {
        const isHomeA = m.team1.toLowerCase() === A.name.toLowerCase();
        const gA = isHomeA ? m.hGoals : m.aGoals;
        const gB = isHomeA ? m.aGoals : m.hGoals;

        gfA += gA;
        gaA += gB;

        let resA = "D";
        if (gA > gB) { resA = "W"; winsA++; }
        else if (gA < gB) { resA = "L"; winsB++; }
        else draws++;

        text += `- ${m.team1} vs ${m.team2}: ${m.hGoals}-${m.aGoals} (${m.dateStr}) – z pohledu ${A.name}: ${resToCz(resA)}\n`;
    }

    const total = h2h.length;
    text += `\nSouhrnná bilance vzájemných zápasů
- ${A.name}: ${winsA} výher
- ${B.name}: ${winsB} výher
- Remízy: ${draws}
- Celkové skóre z pohledu ${A.name}: ${gfA}:${gaA}

`;

    return text;
}

// ---------- Match Intelligence report builder ----------

function buildPrompt(home, away) {
    const A = home.stats;
    const B = away.stats;

    const favorite =
        A.avgPoints > B.avgPoints + 0.3 ? home.name :
        B.avgPoints > A.avgPoints + 0.3 ? away.name :
        "vyrovnané";

    const commonOppSection = buildCommonOpponentsSection(home, away);
    const h2hSection = buildHeadToHeadSection(home, away);

    return `📌 MATCH INTELLIGENCE REPORT
Tým A (domácí): ${home.name}
Tým B (hosté): ${away.name}

Základní statistiky

[ TÝM A – ${home.name} ]
Počet odehraných zápasů: ${A.total}
Počet výher: ${A.wins}
Počet remíz: ${A.draws}
Počet proher: ${A.losses}
Celkový bodový zisk (3–1–0): ${A.points}
Celkový počet vstřelených gólů: ${A.goalsFor}
Celkový počet inkasovaných gólů: ${A.goalsAgainst}
Gólový rozdíl: ${A.diff}
Průměr vstřelených gólů na zápas: ${num(A.avgGF)}
Průměr inkasovaných gólů na zápas: ${num(A.avgGA)}

[ TÝM B – ${away.name} ]
Počet odehraných zápasů: ${B.total}
Počet výher: ${B.wins}
Počet remíz: ${B.draws}
Počet proher: ${B.losses}
Celkový bodový zisk (3–1–0): ${B.points}
Celkový počet vstřelených gólů: ${B.goalsFor}
Celkový počet inkasovaných gólů: ${B.goalsAgainst}
Gólový rozdíl: ${B.diff}
Průměr vstřelených gólů na zápas: ${num(B.avgGF)}
Průměr inkasovaných gólů na zápas: ${num(B.avgGA)}

Výkonnostní ukazatele

[ TÝM A – ${home.name} ]
Podíl výher (%): ${pct(A.winPct)}
Podíl remíz (%): ${pct(A.drawPct)}
Podíl proher (%): ${pct(A.lossPct)}
Počet zápasů bez porážky: ${A.noLoss}
Počet zápasů s čistým kontem: ${A.cleanSheets}
Počet zápasů s alespoň 1 vstřeleným gólem: ${A.atLeast1GF}
Počet zápasů s více než 1 vstřeleným gólem: ${A.more1GF}
Počet zápasů, kde tým inkasoval max. 1 gól: ${A.max1GA}
Nejvyšší vítězství: ${resultString(A.highestWin)}
Nejvyšší porážka: ${resultString(A.highestLoss)}

[ TÝM B – ${away.name} ]
Podíl výher (%): ${pct(B.winPct)}
Podíl remíz (%): ${pct(B.drawPct)}
Podíl proher (%): ${pct(B.lossPct)}
Počet zápasů bez porážky: ${B.noLoss}
Počet zápasů s čistým kontem: ${B.cleanSheets}
Počet zápasů s alespoň 1 vstřeleným gólem: ${B.atLeast1GF}
Počet zápasů s více než 1 vstřeleným gólem: ${B.more1GF}
Počet zápasů, kde tým inkasoval max. 1 gól: ${B.max1GA}
Nejvyšší vítězství: ${resultString(B.highestWin)}
Nejvyšší porážka: ${resultString(B.highestLoss)}

Trendy a forma

[ TÝM A – ${home.name} ]
Bilance posledních 5 zápasů (W/D/L, od nejnovějších): ${lastLabel(A.last5)}
Bilance posledních 10 zápasů (W/D/L, od nejnovějších): ${lastLabel(A.last10)}
Průměr bodů za zápas (celkově): ${num(A.avgPoints)}
Průměr bodů za zápas v posledních 5 zápasech: ${num(A.avgPtsLast5)}
Trend formy (rostoucí / stabilní / klesající): ${A.trend}

[ TÝM B – ${away.name} ]
Bilance posledních 5 zápasů (W/D/L, od nejnovějších): ${lastLabel(B.last5)}
Bilance posledních 10 zápasů (W/D/L, od nejnovějších): ${lastLabel(B.last10)}
Průměr bodů za zápas (celkově): ${num(B.avgPoints)}
Průměr bodů za zápas v posledních 5 zápasech: ${num(B.avgPtsLast5)}
Trend formy (rostoucí / stabilní / klesající): ${B.trend}

Domácí / venkovní výkony

[ TÝM A – ${home.name} ]
Bilance domácích zápasů (W-D-L): ${A.home.wins}-${A.home.draws}-${A.home.losses}
Bilance venkovních zápasů (W-D-L): ${A.away.wins}-${A.away.draws}-${A.away.losses}
Průměr gólů doma (GF/GA): ${num(A.home.avgGF)} / ${num(A.home.avgGA)}
Průměr gólů venku (GF/GA): ${num(A.away.avgGF)} / ${num(A.away.avgGA)}

[ TÝM B – ${away.name} ]
Bilance domácích zápasů (W-D-L): ${B.home.wins}-${B.home.draws}-${B.home.losses}
Bilance venkovních zápasů (W-D-L): ${B.away.wins}-${B.away.draws}-${B.away.losses}
Průměr gólů doma (GF/GA): ${num(B.home.avgGF)} / ${num(B.home.avgGA)}
Průměr gólů venku (GF/GA): ${num(B.away.avgGF)} / ${num(B.away.avgGA)}

Styl zápasů

[ TÝM A – ${home.name} ]
Průměrný celkový počet gólů v zápasech: ${num(A.totalGoalsAvg)}
Podíl zápasů s méně než 2,5 gólu: ${share(A.under25, A.total)}
Podíl zápasů s více než 2,5 gólu: ${share(A.over25, A.total)}
Podíl zápasů, kde oba týmy skórovaly: ${share(A.bothScore, A.total)}
Podíl zápasů s čistým kontem: ${share(A.cleanSheets, A.total)}

[ TÝM B – ${away.name} ]
Průměrný celkový počet gólů v zápasech: ${num(B.totalGoalsAvg)}
Podíl zápasů s méně než 2,5 gólu: ${share(B.under25, B.total)}
Podíl zápasů s více než 2,5 gólu: ${share(B.over25, B.total)}
Podíl zápasů, kde oba týmy skórovaly: ${share(B.bothScore, B.total)}
Podíl zápasů s čistým kontem: ${share(B.cleanSheets, B.total)}

Srovnání týmů

Porovnání bodového zisku:
- Tým A (${home.name}): ${num(A.avgPoints)} bodu na zápas
- Tým B (${away.name}): ${num(B.avgPoints)} bodu na zápas

Porovnání gólové produktivity:
- Tým A: ${num(A.avgGF)} gólů / zápas
- Tým B: ${num(B.avgGF)} gólů / zápas

Porovnání defenzivy:
- Tým A: ${num(A.avgGA)} inkasovaných / zápas
- Tým B: ${num(B.avgGA)} inkasovaných / zápas

Porovnání konzistence výkonů:
- Tým A – trend: ${A.trend}
- Tým B – trend: ${B.trend}

${commonOppSection}${h2hSection}Match Intelligence – závěry

Statistický favorit zápasu (dle dosavadních dat): ${favorite}
Odhad pravděpodobnosti výhry Týmu A
Odhad pravděpodobnosti remízy
Odhad pravděpodobnosti výhry Týmu B
Očekávaný počet gólů v zápase
`;
}

// ---------- Ovládací funkce ----------

function generatePrompt() {
    const homeText = document.getElementById('homeInput').value.trim();
    const awayText = document.getElementById('awayInput').value.trim();
    const out = document.getElementById('promptOutput');

    if (!homeText || !awayText) {
        out.value = "Vyplň prosím blok pro domácí i hosty (včetně části 'Seznam zápasů').";
        return;
    }

    const home = parseTeamBlock(homeText);
    const away = parseTeamBlock(awayText);

    if (!home || !home.matches.length) {
        out.value = "Domácí tým: nepodařilo se najít platné zápasy v části 'Seznam zápasů'. Zkontroluj formát řádků.";
        return;
    }
    if (!away || !away.matches.length) {
        out.value = "Hostující tým: nepodařilo se najít platné zápasy v části 'Seznam zápasů'. Zkontroluj formát řádků.";
        return;
    }

    out.value = buildPrompt(home, away);
}

function copyPrompt() {
    const out = document.getElementById('promptOutput');
    if (!out.value.trim()) {
        alert("Není co kopírovat.");
        return;
    }
    out.select();
    document.execCommand('copy');
    alert("Match Intelligence zkopírována.");
}

function clearAll() {
    document.getElementById('homeInput').value = "";
    document.getElementById('awayInput').value = "";
    document.getElementById('promptOutput').value = "";
}

// ---------- Dodatečné funkce pro odhad pravděpodobností a očekávaných gólů ----------

function poissonP(k, lambda) {
    // jednoduché Poissonovo PMF (k může být 0..n)
    // používáme iterativní výpočet pro stabilitu
    if (lambda <= 0) return k === 0 ? 1 : 0;
    let p = Math.exp(-lambda);
    let res = p;
    for (let i = 1; i <= k; i++) {
        res *= lambda / i;
    }
    return res;
}

function computeMatchProbabilities(A, B) {
    // A, B jsou stats objekty (home.stats / away.stats)
    // Odhad očekávaných gólů: kombinace ofenzivy vlastního týmu a defenzivy soupeře
    const expA = (A.avgGF + B.avgGA) / 2;
    const expB = (B.avgGF + A.avgGA) / 2;

    // omezíme lambda na rozumné maximum (např. 5) pro sumaci
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

    // zbytek pravděpodobnosti (ocas) přiřadíme k očekávaným hodnotám (normalizace)
    const total = pAwin + pBwin + pDraw;
    if (total > 0) {
        pAwin /= total;
        pBwin /= total;
        pDraw /= total;
    }

    // očekávaný počet gólů v zápase = expA + expB
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

function fmtPct(x) {
    return (Math.round(x * 1000) / 10).toString().replace('.', ',') + ' %';
}
function fmtNum(x, digits = 2) {
    return (Math.round(x * Math.pow(10, digits)) / Math.pow(10, digits)).toString().replace('.', ',');
}

// ---------- Upravený buildPrompt, který přidá vyhodnocení pravděpodobností ----------

function buildPrompt(home, away) {
    const A = home.stats;
    const B = away.stats;

    const favorite =
        A.avgPoints > B.avgPoints + 0.3 ? home.name :
        B.avgPoints > A.avgPoints + 0.3 ? away.name :
        "vyrovnané";

    const commonOppSection = buildCommonOpponentsSection(home, away);
    const h2hSection = buildHeadToHeadSection(home, away);

    // spočítáme pravděpodobnosti a očekávané góly
    const probs = computeMatchProbabilities(A, B);

    return `📌 MATCH INTELLIGENCE REPORT
Tým A (domácí): ${home.name}
Tým B (hosté): ${away.name}

Základní statistiky

[ TÝM A – ${home.name} ]
Počet odehraných zápasů: ${A.total}
Počet výher: ${A.wins}
Počet remíz: ${A.draws}
Počet proher: ${A.losses}
Celkový bodový zisk (3–1–0): ${A.points}
Celkový počet vstřelených gólů: ${A.goalsFor}
Celkový počet inkasovaných gólů: ${A.goalsAgainst}
Gólový rozdíl: ${A.diff}
Průměr vstřelených gólů na zápas: ${num(A.avgGF)}
Průměr inkasovaných gólů na zápas: ${num(A.avgGA)}

[ TÝM B – ${away.name} ]
Počet odehraných zápasů: ${B.total}
Počet výher: ${B.wins}
Počet remíz: ${B.draws}
Počet proher: ${B.losses}
Celkový bodový zisk (3–1–0): ${B.points}
Celkový počet vstřelených gólů: ${B.goalsFor}
Celkový počet inkasovaných gólů: ${B.goalsAgainst}
Gólový rozdíl: ${B.diff}
Průměr vstřelených gólů na zápas: ${num(B.avgGF)}
Průměr inkasovaných gólů na zápas: ${num(B.avgGA)}

Výkonnostní ukazatele

[ TÝM A – ${home.name} ]
Podíl výher (%): ${pct(A.winPct)}
Podíl remíz (%): ${pct(A.drawPct)}
Podíl proher (%): ${pct(A.lossPct)}
Počet zápasů bez porážky: ${A.noLoss}
Počet zápasů s čistým kontem: ${A.cleanSheets}
Počet zápasů s alespoň 1 vstřeleným gólem: ${A.atLeast1GF}
Počet zápasů s více než 1 vstřeleným gólem: ${A.more1GF}
Počet zápasů, kde tým inkasoval max. 1 gól: ${A.max1GA}
Nejvyšší vítězství: ${resultString(A.highestWin)}
Nejvyšší porážka: ${resultString(A.highestLoss)}

[ TÝM B – ${away.name} ]
Podíl výher (%): ${pct(B.winPct)}
Podíl remíz (%): ${pct(B.drawPct)}
Podíl proher (%): ${pct(B.lossPct)}
Počet zápasů bez porážky: ${B.noLoss}
Počet zápasů s čistým kontem: ${B.cleanSheets}
Počet zápasů s alespoň 1 vstřeleným gólem: ${B.atLeast1GF}
Počet zápasů s více než 1 vstřeleným gólem: ${B.more1GF}
Počet zápasů, kde tým inkasoval max. 1 gól: ${B.max1GA}
Nejvyšší vítězství: ${resultString(B.highestWin)}
Nejvyšší porážka: ${resultString(B.highestLoss)}

Trendy a forma

[ TÝM A – ${home.name} ]
Bilance posledních 5 zápasů (W/D/L, od nejnovějších): ${lastLabel(A.last5)}
Bilance posledních 10 zápasů (W/D/L, od nejnovějších): ${lastLabel(A.last10)}
Průměr bodů za zápas (celkově): ${num(A.avgPoints)}
Průměr bodů za zápas v posledních 5 zápasech: ${num(A.avgPtsLast5)}
Trend formy (rostoucí / stabilní / klesající): ${A.trend}

[ TÝM B – ${away.name} ]
Bilance posledních 5 zápasů (W/D/L, od nejnovějších): ${lastLabel(B.last5)}
Bilance posledních 10 zápasů (W/D/L, od nejnovějších): ${lastLabel(B.last10)}
Průměr bodů za zápas (celkově): ${num(B.avgPoints)}
Průměr bodů za zápas v posledních 5 zápasech: ${num(B.avgPtsLast5)}
Trend formy (rostoucí / stabilní / klesající): ${B.trend}

Domácí / venkovní výkony

[ TÝM A – ${home.name} ]
Bilance domácích zápasů (W-D-L): ${A.home.wins}-${A.home.draws}-${A.home.losses}
Bilance venkovních zápasů (W-D-L): ${A.away.wins}-${A.away.draws}-${A.away.losses}
Průměr gólů doma (GF/GA): ${num(A.home.avgGF)} / ${num(A.home.avgGA)}
Průměr gólů venku (GF/GA): ${num(A.away.avgGF)} / ${num(A.away.avgGA)}

[ TÝM B – ${away.name} ]
Bilance domácích zápasů (W-D-L): ${B.home.wins}-${B.home.draws}-${B.home.losses}
Bilance venkovních zápasů (W-D-L): ${B.away.wins}-${B.away.draws}-${B.away.losses}
Průměr gólů doma (GF/GA): ${num(B.home.avgGF)} / ${num(B.home.avgGA)}
Průměr gólů venku (GF/GA): ${num(B.away.avgGF)} / ${num(B.away.avgGA)}

Styl zápasů

[ TÝM A – ${home.name} ]
Průměrný celkový počet gólů v zápasech: ${num(A.totalGoalsAvg)}
Podíl zápasů s méně než 2,5 gólu: ${share(A.under25, A.total)}
Podíl zápasů s více než 2,5 gólu: ${share(A.over25, A.total)}
Podíl zápasů, kde oba týmy skórovaly: ${share(A.bothScore, A.total)}
Podíl zápasů s čistým kontem: ${share(A.cleanSheets, A.total)}

[ TÝM B – ${away.name} ]
Průměrný celkový počet gólů v zápasech: ${num(B.totalGoalsAvg)}
Podíl zápasů s méně než 2,5 gólu: ${share(B.under25, B.total)}
Podíl zápasů s více než 2,5 gólu: ${share(B.over25, B.total)}
Podíl zápasů, kde oba týmy skórovaly: ${share(B.bothScore, B.total)}
Podíl zápasů s čistým kontem: ${share(B.cleanSheets, B.total)}

Srovnání týmů

Porovnání bodového zisku:
- Tým A (${home.name}): ${num(A.avgPoints)} bodu na zápas
- Tým B (${away.name}): ${num(B.avgPoints)} bodu na zápas

Porovnání gólové produktivity:
- Tým A: ${num(A.avgGF)} gólů / zápas
- Tým B: ${num(B.avgGF)} gólů / zápas

Porovnání defenzivy:
- Tým A: ${num(A.avgGA)} inkasovaných / zápas
- Tým B: ${num(B.avgGA)} inkasovaných / zápas

Porovnání konzistence výkonů:
- Tým A – trend: ${A.trend}
- Tým B – trend: ${B.trend}

${commonOppSection}${h2hSection}Match Intelligence – závěry

Statistický favorit zápasu (dle dosavadních dat): ${favorite}

Odhad pravděpodobnosti výhry Týmu A: ${fmtPct(probs.pAwin)}
Odhad pravděpodobnosti remízy: ${fmtPct(probs.pDraw)}
Odhad pravděpodobnosti výhry Týmu B: ${fmtPct(probs.pBwin)}
Očekávaný počet gólů v zápase: ${fmtNum(probs.expectedGoals, 2)}

Poznámka: odhady jsou založeny na jednoduchém Poissonově modelu kombinujícím průměrné vstřelené góly a průměr inkasovaných gólů soupeře; slouží jako orientační statistika.
`;
}
