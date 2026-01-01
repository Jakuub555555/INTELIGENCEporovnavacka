/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL
 * Přísná filtrace podle 15 analytických kritérií
 */

function verifyBet() {
    const homeInput = document.getElementById('homeInput').value.trim();
    const awayInput = document.getElementById('awayInput').value.trim();

    if (!homeInput || !awayInput) {
        alert("Nejdříve vložte data pro oba týmy!");
        return;
    }

    // Načtení dat z hlavního skriptu
    const home = parseTeamBlock(homeInput);
    const away = parseTeamBlock(awayInput);
    const common = getCommonOpponentsData(home, away);
    const h2h = getHeadToHeadData(home, away);
    const probs = computeMatchProbabilities(home.stats, away.stats);

    const hs = home.stats;
    const as = away.stats;

    // Určení favorita podle pravděpodobnosti
    const isHomeFavorit = probs.pAwin >= probs.pBwin;
    const f = isHomeFavorit ? hs : as; 
    const u = isHomeFavorit ? as : hs; 
    const fName = isHomeFavorit ? home.name : away.name;
    const fProb = isHomeFavorit ? probs.pAwin : probs.pBwin;

    const calcPts = (list) => list ? list.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0) : 0;
    const trendPower = { "rostoucí": 2, "stabilní": 1, "klesající": 0 };

    // --- 15 PODMÍNEK PRO VERDIKT ---
    const checks = [
        { n: "Poisson Pravděpodobnost (45%+)", ok: fProb >= 0.45 },
        { n: "Celkový počet výher", ok: f.wins > u.wins },
        { n: "Očekávané góly (3.2+)", ok: (probs.expA + probs.expB) >= 3.2 },
        { n: "Celkový bodový zisk", ok: f.points > u.points },
        { n: "Vstřelené góly", ok: f.goalsFor > u.goalsFor },
        { n: "Méně inkasovaných gólů", ok: f.goalsAgainst < u.goalsAgainst },
        { n: "Gólový rozdíl (12+)", ok: (f.goalsFor - f.goalsAgainst) >= 12 },
        { n: "Bilance posledních 5 zápasů", ok: calcPts(f.last5) > calcPts(u.last5) },
        { n: "Bilance posledních 10 zápasů", ok: calcPts(f.last10) > calcPts(u.last10) },
        { n: "Trend formy", ok: (trendPower[f.trend] || 0) > (trendPower[u.trend] || 0) },
        { n: "Průměr bodů/zápas (2+)", ok: (f.points / f.total) >= 2.0 },
        { n: "Průměr bodů (L5) (2+)", ok: (calcPts(f.last5) / 5) >= 2.0 },
        { n: "Podíl zápasů Over 2.5", ok: (f.over25 / f.total) > (u.over25 / u.total) },
        { n: "Lepší proti spol. soupeřům", ok: common.summary && common.summary.overallBetter === fName },
        { n: "Lepší ve vzájemných (H2H)", ok: h2h.summary && h2h.summary.overall === fName }
    ];

    const score = checks.filter(c => c.ok).length;
    const isStrongBet = score >= 12; // Podmínka: 12 a více bodů z tabulky

    showBetModal(fName, score, checks, isStrongBet);
}

function showBetModal(favorit, score, checks, isStrongBet) {
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(2,0,10,0.9); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(5px);";

    let rowsHtml = checks.map(c => `
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-family: 'JetBrains Mono', monospace; font-size:12px;">
            <span style="color:#8fa0c0">${c.n}</span>
            <span style="color:${c.ok ? '#00e676' : '#ff6b6b'}; font-weight:bold;">${c.ok ? '✓' : '✕'}</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#05000a; border:1px solid ${isStrongBet ? '#00f5ff' : '#24103a'}; width:100%; max-width:450px; border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,1);">
            <div style="padding:15px; border-bottom:1px solid #24103a; text-align:center;">
                <div style="font-size:10px; color:#00f5ff; letter-spacing:2px; margin-bottom:5px;">TERMINAL VERDICT</div>
                <h2 style="margin:0; color:#fff; font-size:18px;">${favorit}</h2>
            </div>
            <div style="padding:15px; max-height:350px; overflow-y:auto; background:rgba(255,255,255,0.01);">
                ${rowsHtml}
            </div>
            <div style="padding:20px; text-align:center;">
                <div style="font-size:22px; font-weight:bold; letter-spacing:1px; color:${isStrongBet ? '#00e676' : '#ff6b6b'}">
                    ${isStrongBet ? 'DOBRÁ VOLBA — VSADIT' : 'VYSOKÉ RIZIKO — NEVSÁZET'}
                </div>
                <div style="font-size:12px; color:#8fa0c0; margin-top:8px;">Úspěšnost kritérií: ${score} / 15</div>
                <button onclick="document.getElementById('betExpertModal').remove()" style="margin-top:20px; width:100%; padding:10px; background:transparent; border:1px solid #24103a; color:#00f5ff; border-radius:6px; cursor:pointer; font-weight:bold; transition: 0.3s;">ZAVŘÍT</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
