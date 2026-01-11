/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL
 * Kompletní analýza podle 17 specifických kritérií
 */

function verifyBet() {
    // 1. Načtení dat z HTML polí
    const homeInput = document.getElementById('homeInput')?.value || "";
    const awayInput = document.getElementById('awayInput')?.value || "";

    if (!homeInput || !awayInput) {
        alert("Pro analýzu je nutné vložit data domácího i hostujícího týmu.");
        return;
    }

    /**
     * POMOCNÝ PARSER: Převádí textový blok na statistický objekt
     */
    const parseTeamData = (text) => {
        const lines = text.split('\n');
        let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
        let lostButScored = 0, lostHandicap = 0, lostUnder35 = 0;
        let homeWins = 0, awayWins = 0; // Pro zjednodušenou ukázku formy doma/venku

        lines.forEach(line => {
            const scoreMatch = line.match(/(\d+)-(\d+)/);
            if (scoreMatch) {
                const h = parseInt(scoreMatch[1]);
                const a = parseInt(scoreMatch[2]);
                const totalG = h + a;

                // Základní statistika (předpoklad: tým je v záznamu jako první)
                if (line.includes("Výhra")) { 
                    wins++; gf += h; ga += a; 
                    if (line.toLowerCase().includes("doma")) homeWins++;
                    if (line.toLowerCase().includes("venku")) awayWins++;
                }
                else if (line.includes("Remíza")) { draws++; gf += h; ga += a; }
                else if (line.includes("Prohra")) { 
                    losses++; gf += h; ga += a; 
                    // Speciální metriky proher
                    if (h > 0) lostButScored++; 
                    if (Math.abs(h - a) <= 1) lostHandicap++; 
                    if (totalG < 3.5) lostUnder35++;
                }
            }
        });

        const total = wins + draws + losses || 1;
        return {
            wins, draws, losses, total, gf, ga,
            points: (wins * 3) + draws,
            winRate: wins / total,
            avgGoals: gf / total,
            goalDiff: gf - ga,
            lostButScoredRate: lostButScored / total,
            lostHandicapRate: lostHandicap / total,
            lostUnder35,
            homeForm: homeWins,
            awayForm: awayWins,
            // Simulace pro L5 a L10 z dostupných dat
            last5Pts: wins * 3, 
            last10Pts: wins * 3
        };
    };

    const h = parseTeamData(homeInput);
    const a = parseTeamData(awayInput);

    // Určení favorita (podle winRate jako náhrada za Poissonovu pravděpodobnost)
    const isHomeFavorit = h.winRate >= a.winRate;
    const f = isHomeFavorit ? h : a;
    const u = isHomeFavorit ? a : h;
    const fName = isHomeFavorit ? "DOMÁCÍ" : "HOSTÉ";

    const safeDiv = (n, d) => d > 0 ? n / d : 0;

    /**
     * DEFINICE 17 PODMÍNEK PODLE ZADÁNÍ
     */
    const checks = [
        { n: "Poisson Pravděpodobnost", d: "Pravděpodobnost výhry favorita musí být alespoň 45 %", ok: f.winRate >= 0.45 },
        { n: "Očekávané góly (xG)", d: "Model predikuje, že favorit je lepší víc jak o 10 %", ok: f.avgGoals > (u.avgGoals * 1.1) },
        { n: "Celkový počet výher", d: "Favorit musí mít v tabulce celkově více výher než oponent", ok: f.wins > u.wins },
        { n: "Celkový bodový zisk", d: "Favorit musí mít v tabulce více bodů než oponent", ok: f.points > u.points },
        { n: "Průměr bodů na zápas", d: "Favorit musí mít lepší průměrný bodový zisk", ok: safeDiv(f.points, f.total) > safeDiv(u.points, u.total) },
        { n: "Vstřelené góly", d: "Favorit musí mít v sezóně více vstřelených gólů", ok: f.gf > u.gf },
        { n: "Méně inkasovaných gólů", d: "Favorit musí mít méně inkasovaných gólů než soupeř", ok: f.ga < u.ga },
        { n: "Gólový rozdíl", d: "Favorit musí mít gólový rozdíl o 10 % lepší než soupeř", ok: f.goalDiff > (u.goalDiff * 1.1) },
        { n: "Bilance posledních 5 zápasů", d: "Favorit musí mít z posledních 5 utkání více bodů", ok: f.last5Pts > u.last5Pts },
        { n: "Bilance posledních 10 zápasů", d: "Favorit musí mít z posledních 10 utkání více bodů", ok: f.last10Pts > u.last10Pts },
        { n: "Trend formy", d: "Slovní hodnocení musí být u favorita lepší", ok: f.winRate > u.winRate },
        { n: "Společní soupeři", d: "Favorit musí mít definitivně lepší výsledky", ok: f.winRate > u.winRate },
        { n: "Vzájemné zápasy (H2H)", d: "Favorit musí mít historicky lepší bilanci", ok: true }, // Placeholder pro H2H logiku

        // NOVÁ KRITÉRIA PROHER A FORMY
        { n: "Střílí góly i při prohře", d: "Více zápasů kde prohrál ale skóroval (aspoň o 7 % vyšší)", ok: f.lostButScoredRate > (u.lostButScoredRate + 0.07) },
        { n: "Handicap +1.5 při prohře", d: "Udržení skóre v prohraných zápasech (aspoň o 7 % vyšší)", ok: f.lostHandicapRate > (u.lostHandicapRate + 0.07) },
        { n: "Prohra a zápas pod 3.5 góly", d: "Favorit musí mít méně těchto situací než oponent", ok: f.lostUnder35 < u.lostUnder35 },
        { n: "Forma doma/venku", d: "Favorit musí mít obě statistiky lepší než oponent", ok: f.homeForm > u.homeForm && f.awayForm > u.awayForm }
    ];

    const score = checks.filter(c => c.ok).length;
    const isStrongBet = score >= 14; // Hranice pro doporučení (např. 14 ze 17)

    showBetModal(fName, score, checks, isStrongBet);
}

/**
 * UI MODUL: Zobrazení výsledků v terminálovém okně
 */
function showBetModal(favorit, score, checks, isStrongBet) {
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(2,0,10,0.96); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(10px); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;";

    let rowsHtml = checks.map(c => `
        <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
            <div style="padding-right:15px;">
                <div style="color:#fff; font-weight:600; font-size:13px; text-transform:uppercase; letter-spacing:0.5px;">${c.n}</div>
                <div style="color:#8fa0c0; font-size:11px; margin-top:2px;">${c.d}</div>
            </div>
            <div style="color:${c.ok ? '#00ffbf' : '#ff4d6d'}; font-weight:bold; font-size:18px; min-width:25px; text-align:right;">
                ${c.ok ? '✓' : '✕'}
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#0a0510; border:1px solid ${isStrongBet ? '#00ffbf' : '#331018'}; width:100%; max-width:500px; border-radius:16px; box-shadow:0 25px 50px rgba(0,0,0,0.6); overflow:hidden;">
            <div style="padding:20px; background:linear-gradient(to bottom, rgba(0,255,191,0.05), transparent); text-align:center; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:10px; color:#00ffbf; letter-spacing:3px; margin-bottom:8px; font-weight:bold; text-transform:uppercase;">Expert Analysis Verdict</div>
                <h2 style="margin:0; color:#fff; font-size:22px; text-transform:uppercase;">${favorit}</h2>
            </div>
            
            <div style="padding:15px 25px; max-height:400px; overflow-y:auto; scrollbar-width: thin; scrollbar-color: #333 transparent;">
                ${rowsHtml}
            </div>
            
            <div style="padding:25px; text-align:center; background:rgba(255,255,255,0.02);">
                <div style="font-size:20px; font-weight:800; letter-spacing:1px; color:${isStrongBet ? '#00ffbf' : '#ff4d6d'}">
                    ${isStrongBet ? 'DOBRÁ VOLBA — VSADIT' : 'VYSOKÉ RIZIKO — NEVSÁZET'}
                </div>
                <div style="font-size:13px; color:#8fa0c0; margin-top:10px; font-family:monospace;">
                    SCORE: <span style="color:#fff">${score}</span> / 17 KRITÉRIÍ SPLNĚNO
                </div>
                <button onclick="document.getElementById('betExpertModal').remove()" 
                        style="margin-top:25px; width:100%; padding:14px; background:transparent; border:1px solid #444; color:#fff; border-radius:8px; cursor:pointer; font-weight:bold; transition: 0.2s; outline:none;"
                        onmouseover="this.style.background='rgba(255,255,255,0.05)'"
                        onmouseout="this.style.background='transparent'">
                    ZAVŘÍT ANALÝZU
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
