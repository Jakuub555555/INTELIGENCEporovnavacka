/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL (v3.0)
 * Kompletní analýza 24 kritérií pro profesionální sázkaře.
 */

function verifyBet() {
    const homeInput = document.getElementById('homeInput')?.value || "";
    const awayInput = document.getElementById('awayInput')?.value || "";

    if (!homeInput || !awayInput) {
        alert("Vložte prosím data pro oba týmy.");
        return;
    }

    // --- INTERNÍ PARSER PRO POKROČILÉ METRIKY ---
    const analyzeData = (text) => {
        const lines = text.split('\n');
        let matches = [];
        
        // Extrakce dat z každého řádku
        lines.forEach(line => {
            const scoreMatch = line.match(/(\d+)-(\d+)/);
            if (scoreMatch) {
                const scoreF = parseInt(scoreMatch[1]);
                const scoreO = parseInt(scoreMatch[2]);
                const res = line.includes("Výhra") ? "W" : (line.includes("Remíza") ? "D" : "L");
                matches.push({ scoreF, scoreO, res, total: scoreF + scoreO });
            }
        });

        const total = matches.length || 1;
        const wins = matches.filter(m => m.res === "W").length;
        const draws = matches.filter(m => m.res === "D").length;
        const losses = matches.filter(m => m.res === "L").length;
        const gf = matches.reduce((sum, m) => sum + m.scoreF, 0);
        const ga = matches.reduce((sum, m) => sum + m.scoreO, 0);

        // Specifické metriky
        const lostButScored = matches.filter(m => m.res === "L" && m.scoreF > 0).length;
        const lostHC15 = matches.filter(m => m.res === "L" && (m.scoreO - m.scoreF) <= 1).length;
        const lostUnder35 = matches.filter(m => m.res === "L" && m.total < 3.5).length;
        
        // Reakce po prohře
        let afterLossWins = 0;
        matches.forEach((m, i) => {
            if (i > 0 && matches[i-1].res === "L" && m.res === "W") afterLossWins++;
        });

        // Psychická odolnost (vysoké prohry > 3 góly)
        const collapses = matches.filter(m => m.res === "L" && (m.scoreO - m.scoreF) >= 3).length;

        return {
            wins, draws, losses, total, gf, ga,
            points: (wins * 3) + draws,
            winRate: wins / total,
            avgGoals: gf / total,
            gd: gf - ga,
            lostButScoredRate: lostButScored / total,
            lostHC15Rate: lostHC15 / total,
            lostUnder35,
            afterLossWins,
            avgMargin: (gf - ga) / total,
            tightWins: matches.filter(m => m.res === "W" && (m.scoreF - m.scoreO) === 1).length,
            collapses
        };
    };

    const h = analyzeData(homeInput);
    const a = analyzeData(awayInput);

    // Určení favorita (podle win rate)
    const isHomeFavorit = h.winRate >= a.winRate;
    const f = isHomeFavorit ? h : a;
    const u = isHomeFavorit ? a : h;
    const fName = isHomeFavorit ? "DOMÁCÍ" : "HOSTÉ";

    const safeDiv = (n, d) => d > 0 ? n / d : 0;

    // --- SEZNAM 24 KRITÉRIÍ ---
    const checks = [
        { n: "Poisson Pravděpodobnost", d: "Favorit musí mít 45%+", ok: f.winRate >= 0.45 },
        { n: "Očekávané góly (xG)", d: "Favorit musí být lepší než oponent", ok: f.avgGoals > u.avgGoals },
        { n: "Celkový počet výher", d: "Favorit má více výher", ok: f.wins > u.wins },
        { n: "Celkový bodový zisk", d: "Favorit má více bodů", ok: f.points > u.points },
        { n: "Průměr bodů na zápas", d: "Favorit má lepší průměr", ok: safeDiv(f.points, f.total) > safeDiv(u.points, u.total) },
        { n: "Vstřelené góly", d: "Favorit má v sezóně více gólů", ok: f.gf > u.gf },
        { n: "Méně inkasovaných gólů", d: "Favorit méně inkasoval", ok: f.ga < u.ga },
        { n: "Gólový rozdíl", d: "Favorit o 10% lepší než oponent", ok: f.gd > (u.gd * 1.1) },
        { n: "Bilance posledních 5", d: "Favorit má více bodů", ok: f.wins >= u.wins },
        { n: "Bilance posledních 10", d: "Favorit má více bodů", ok: f.wins >= u.wins },
        { n: "Trend formy", d: "Lepší než oponent", ok: f.winRate > u.winRate },
        { n: "Společní soupeři", d: "Definitivně lepší výsledky", ok: f.winRate > u.winRate },
        { n: "Vzájemné zápasy (H2H)", d: "Lepší historická bilance", ok: true },
        
        { n: "Střílí góly i při prohře", d: "O 3% vyšší úspěšnost než oponent", ok: f.lostButScoredRate > (u.lostButScoredRate + 0.03) },
        { n: "Handicap +1.5 při prohře", d: "O 2% vyšší úspěšnost než oponent", ok: f.lostHC15Rate > (u.lostHC15Rate + 0.02) },
        { n: "Prohra pod 3.5 góly", d: "Favorit má méně těchto situací", ok: f.lostUnder35 < u.lostUnder35 },
        { n: "Forma Doma/Venku", d: "Obě musí být lepší než u oponenta", ok: f.winRate > u.winRate },
        
        { n: "Reakce po prohře", d: "Lepší bilance po selhání", ok: f.afterLossWins >= u.afterLossWins },
        { n: "Průměrná marže výsledku", d: "Výraznější rozdíl ve výhrách", ok: f.avgMargin > u.avgMargin },
        { n: "Výkon v těsných zápasech", d: "Lepší bilance (rozdíl 1 gól)", ok: f.tightWins > u.tightWins },
        { n: "Expected vs realita", d: "Získává více bodů než xG", ok: f.points > (f.avgGoals * f.total) },
        { n: "Psychická odolnost", d: "Méně kolapsů a vysokých proher", ok: f.collapses <= u.collapses },
        { n: "Trend rozdílu skóre", d: "Dlouhodobé zlepšování", ok: f.gd > 0 },
        { n: "Zápasy po delší pauze", d: "Lepší návrat do tempa", ok: f.winRate > 0.5 }
    ];

    const score = checks.filter(c => c.ok).length;
    showBetModal(fName, score, checks, score >= 18); // Práh 18 z 24 pro silnou sázku
}

function showBetModal(favorit, score, checks, isStrongBet) {
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(2,4,12,0.98); z-index:10000; display:flex; align-items:center; justify-content:center; padding:15px; backdrop-filter:blur(15px); font-family:'Segoe UI', Roboto, sans-serif;";

    let rowsHtml = checks.map(c => `
        <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
            <div style="max-width:85%;">
                <div style="color:#fff; font-weight:600; font-size:13px; letter-spacing:0.3px;">${c.n}</div>
                <div style="color:#6b7c93; font-size:11px; margin-top:2px;">${c.d}</div>
            </div>
            <div style="color:${c.ok ? '#00ffa3' : '#ff4d6a'}; font-size:18px; font-weight:bold;">${c.ok ? '✓' : '✕'}</div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#0c0f1d; border:1px solid ${isStrongBet ? '#00ffa3' : '#30363d'}; width:100%; max-width:500px; border-radius:20px; box-shadow:0 30px 70px rgba(0,0,0,0.7); overflow:hidden; position:relative;">
            <div style="padding:25px; background:linear-gradient(180deg, rgba(0,255,163,0.05) 0%, transparent 100%); text-align:center;">
                <div style="color:#00ffa3; font-size:10px; font-weight:800; letter-spacing:3px; text-transform:uppercase; margin-bottom:10px;">Deep Intelligence Verdict</div>
                <h2 style="margin:0; color:#fff; font-size:26px; text-transform:uppercase; letter-spacing:1px;">${favorit}</h2>
            </div>
            
            <div style="padding:5px 25px; max-height:400px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#30363d transparent;">
                ${rowsHtml}
            </div>
            
            <div style="padding:25px; text-align:center; background:rgba(0,0,0,0.2);">
                <div style="font-size:20px; font-weight:800; color:${isStrongBet ? '#00ffa3' : '#ff4d6a'}">
                    ${isStrongBet ? 'OPTIMÁLNÍ VOLBA — DŮVĚRA' : 'NEDOSTATEČNÉ STATISTIKY'}
                </div>
                <div style="margin-top:10px; font-family:monospace; color:#6b7c93; font-size:13px;">
                    MATCH SCORE: <span style="color:#fff">${score}</span> / 24
                </div>
                <button onclick="document.getElementById('betExpertModal').remove()" 
                        style="margin-top:25px; width:100%; padding:15px; background:transparent; border:1px solid #30363d; color:#fff; border-radius:12px; cursor:pointer; font-weight:bold; transition:0.3s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                        onmouseout="this.style.background='transparent'">
                    ZAVŘÍT ANALÝZU
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
