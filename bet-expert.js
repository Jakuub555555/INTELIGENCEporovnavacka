// bet-expert.js - Rozšiřující modul pro Match Intelligence

function verifyBet() {
    const homeInput = document.getElementById('homeInput').value.trim();
    const awayInput = document.getElementById('awayInput').value.trim();

    if (!homeInput || !awayInput) {
        alert("Chybí vstupní data pro analýzu!");
        return;
    }

    // 1. Příprava dat pomocí existujících funkcí z script.js
    const home = parseTeamBlock(homeInput);
    const away = parseTeamBlock(awayInput);
    const common = getCommonOpponentsData(home, away);
    const h2h = getHeadToHeadData(home, away);
    const probs = computeMatchProbabilities(home.stats, away.stats);

    const hs = home.stats;
    const as = away.stats;

    // 2. Definice favorita (podle Poissonovy pravděpodobnosti výhry)
    const isHomeFavorit = probs.pAwin >= probs.pBwin;
    const f = isHomeFavorit ? hs : as; // Favorit stats
    const u = isHomeFavorit ? as : hs; // Underdog stats
    const fName = isHomeFavorit ? home.name : away.name;
    const fProb = isHomeFavorit ? probs.pAwin : probs.pBwin;

    // Pomocná funkce pro body z bilance (W=3, D=1, L=0)
    const calcPts = (list) => list.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0);
    const trendPower = { "rostoucí": 2, "stabilní": 1, "klesající": 0 };

    // 3. LOGIKA OVĚŘENÍ (Vašich 15 podmínek)
    const checks = [
        { n: "Poisson Pravděpodobnost (45%+)", ok: fProb >= 0.45 },
        { n: "Celkový počet výher", ok: f.wins > u.wins },
        { n: "Očekávané góly (3.2+)", ok: (probs.expA + probs.expB) >= 3.2 },
        { n: "Celkový bodový zisk", ok: f.points > u.points },
        { n: "Vstřelené góly", ok: f.goalsFor > u.goalsFor },
        { n: "Inkasované góly (méně)", ok: f.goalsAgainst < u.goalsAgainst },
        { n: "Gólový rozdíl (12+)", ok: (f.goalsFor - f.goalsAgainst) >= 12 },
        { n: "Bilance posledních 5 zápasů", ok: calcPts(f.last5) > calcPts(u.last5) },
        { n: "Bilance posledních 10 zápasů", ok: calcPts(f.last10) > calcPts(u.last10) },
        { n: "Trend formy", ok: trendPower[f.trend] > trendPower[u.trend] },
        { n: "Průměr bodů/zápas (2+)", ok: f.avgPoints >= 2.0 },
        { n: "Průměr bodů (posledních 5) (2+)", ok: f.avgPtsLast5 >= 2.0 },
        { n: "Podíl zápasů Over 2.5", ok: (f.over25 / f.total) > (u.over25 / u.total) },
        { n: "Společné soupeře (výkonnost)", ok: common.summary && common.summary.overallBetter === fName },
        { n: "Vzájemné zápasy (H2H)", ok: h2h.summary && h2h.summary.overall === fName }
    ];

    const score = checks.filter(c => c.ok).length;
    const isStrongBet = score >= 13; // Práh pro doporučení (např. 13 z 15)

    // 4. Zobrazení výsledku v novém okně (Modal)
    showBetModal(fName, score, checks, isStrongBet);
}

function showBetModal(favorit, score, checks, isStrongBet) {
    // Odstranění starého modalu, pokud existuje
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(2,0,10,0.95); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; font-family:system-ui, sans-serif;";

    let rowsHtml = checks.map(c => `
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:13px;">
            <span style="color:#8fa0c0">${c.n}</span>
            <span style="color:${c.ok ? '#00e676' : '#ff6b6b'}; font-weight:bold;">${c.ok ? '✓ SPLNĚNO' : '✕ NESPLNĚNO'}</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#090010; border:2px solid ${isStrongBet ? '#00f5ff' : '#24103a'}; width:100%; max-width:500px; border-radius:16px; overflow:hidden; box-shadow:0 0 50px rgba(0,245,255,0.15);">
            <div style="padding:20px; background:rgba(255,255,255,0.02); text-align:center; border-bottom:1px solid #24103a;">
                <div style="font-size:10px; letter-spacing:2px; color:#00f5ff; margin-bottom:5px;">BET EXPERT VERDICT</div>
                <h2 style="margin:0; color:#fff; text-transform:uppercase;">${favorit}</h2>
            </div>
            <div style="padding:20px; max-height:400px; overflow-y:auto;">
                ${rowsHtml}
            </div>
            <div style="padding:20px; text-align:center; background:rgba(0,0,0,0.3);">
                <div style="font-size:24px; font-weight:bold; color:${isStrongBet ? '#00e676' : '#ffeb3b'}">
                    ${isStrongBet ? 'ANO - VSADIT' : 'NE - NEVSÁZET'}
                </div>
                <div style="font-size:12px; color:#8fa0c0; margin-top:5px;">Skóre důvěry: ${score} z ${checks.length}</div>
                <button onclick="document.getElementById('betExpertModal').remove()" style="margin-top:20px; width:100%; padding:12px; background:#00f5ff; border:none; border-radius:8px; color:#000; font-weight:bold; cursor:pointer;">ZAVŘÍT EXPERTA</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
