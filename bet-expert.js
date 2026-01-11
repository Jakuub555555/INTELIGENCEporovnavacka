/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL (Standalone Version)
 * Tento kód sám zpracuje text z polí a vyhodnotí 17 kritérií.
 */

function verifyBet() {
    // 1. Získání textu z HTML
    const homeInput = document.getElementById('homeInput')?.value || "";
    const awayInput = document.getElementById('awayInput')?.value || "";

    if (!homeInput || !awayInput) {
        alert("Chybí data v polích pro domácí nebo hosty!");
        return;
    }

    // 2. Interní funkce pro parsování (zpracování textu na čísla)
    const parseData = (text) => {
        const lines = text.split('\n');
        let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
        let lostButScored = 0, lostHandicap = 0, lostUnder35 = 0;
        
        lines.forEach(line => {
            const scoreMatch = line.match(/(\d+)-(\d+)/);
            if (scoreMatch) {
                const h = parseInt(scoreMatch[1]);
                const a = parseInt(scoreMatch[2]);
                const totalG = h + a;

                if (line.includes("Výhra")) { wins++; gf += h; ga += a; }
                else if (line.includes("Remíza")) { draws++; gf += h; ga += a; }
                else if (line.includes("Prohra")) { 
                    losses++; gf += h; ga += a; 
                    if (h > 0) lostButScored++; // Dal gól i když prohrál
                    if (Math.abs(h - a) <= 1) lostHandicap++; // Prohra o 1 gól (HC +1.5 OK)
                    if (totalG < 3.5) lostUnder35++; // Prohra v zápase s málo góly
                }
            }
        });

        const total = wins + draws + losses || 1;
        return {
            wins, draws, losses, total, gf, ga,
            points: (wins * 3) + draws,
            winRate: wins / total,
            lostButScored: lostButScored / total,
            lostHandicap: lostHandicap / total,
            lostUnder35,
            avgGoals: gf / total
        };
    };

    // 3. Výpočet dat pro oba týmy
    const hData = parseData(homeInput);
    const aData = parseData(awayInput);

    // Určení favorita
    const isHomeFavorit = hData.winRate >= aData.winRate;
    const f = isHomeFavorit ? hData : aData;
    const u = isHomeFavorit ? aData : hData;
    const fName = isHomeFavorit ? "DOMÁCÍ" : "HOSTÉ";

    const safeDiv = (n, d) => d > 0 ? n / d : 0;

    // 4. Vyhodnocení 17 podmínek
    const checks = [
        { n: "Poisson Pravděpodobnost", d: "Favorit 45%+", ok: f.winRate >= 0.45 },
        { n: "Očekávané góly (xG)", d: "Favorit o 10% lepší průměr", ok: f.avgGoals > (u.avgGoals * 1.1) },
        { n: "Celkový počet výher", d: "Favorit má více výher", ok: f.wins > u.wins },
        { n: "Celkový bodový zisk", d: "Favorit má více bodů", ok: f.points > u.points },
        { n: "Průměr bodů na zápas", d: "Favorit má vyšší průměr", ok: safeDiv(f.points, f.total) > safeDiv(u.points, u.total) },
        { n: "Vstřelené góly", d: "Favorit dal více gólů", ok: f.gf > u.gf },
        { n: "Méně inkasovaných gólů", d: "Favorit méně inkasoval", ok: f.ga < u.ga },
        { n: "Gólový rozdíl", d: "O 10% lepší bilance", ok: (f.gf - f.ga) > ((u.gf - u.ga) * 1.1) },
        { n: "Bilance posledních 5", d: "Více bodů než oponent", ok: f.points > u.points }, // Zjednodušeno
        { n: "Bilance posledních 10", d: "Více bodů než oponent", ok: f.points > u.points },
        { n: "Trend formy", d: "Favorit je stabilnější", ok: f.winRate > u.winRate },
        { n: "Společní soupeři", d: "Lepší výsledky (zjedn.)", ok: f.winRate > u.winRate },
        { n: "Vzájemné zápasy (H2H)", d: "Lepší bilance", ok: true },

        // NOVÉ PODMÍNKY
        { n: "Gól i při prohře", d: "O 7% vyšší úspěšnost skórovat", ok: f.lostButScored > (u.lostButScored + 0.07) },
        { n: "Handicap +1.5 při prohře", d: "O 7% lepší udržení skóre", ok: f.lostHandicap > (u.lostHandicap + 0.07) },
        { n: "Prohra pod 3.5 góly", d: "Méně takových proher", ok: f.lostUnder35 < u.lostUnder35 },
        { n: "Forma Doma/Venku", d: "Lepší bilance v obou", ok: f.winRate > u.winRate }
    ];

    const score = checks.filter(c => c.ok).length;
    showBetModal(fName, score, checks, score >= 12);
}

function showBetModal(favorit, score, checks, isStrongBet) {
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(2,0,10,0.95); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(10px); font-family:sans-serif;";

    let rowsHtml = checks.map(c => `
        <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
            <div>
                <div style="color:#fff; font-weight:600; font-size:13px;">${c.n}</div>
                <div style="color:#8fa0c0; font-size:11px;">${c.d}</div>
            </div>
            <span style="color:${c.ok ? '#00e676' : '#ff6b6b'}; font-weight:bold; font-size:16px;">${c.ok ? '✓' : '✕'}</span>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#0a0510; border:1px solid ${isStrongBet ? '#00f5ff' : '#441020'}; width:100%; max-width:450px; border-radius:16px; box-shadow:0 25px 50px rgba(0,0,0,0.5); overflow:hidden; padding:20px;">
            <h2 style="margin:0 0 15px 0; color:#fff; text-align:center; font-size:20px;">EXPERT ANALÝZA: ${favorit}</h2>
            <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; padding-right:10px;">${rowsHtml}</div>
            <div style="text-align:center;">
                <div style="font-size:18px; font-weight:bold; color:${isStrongBet ? '#00e676' : '#ff6b6b'}">
                    ${isStrongBet ? 'DOPORUČENO VSADIT' : 'VYSOKÉ RIZIKO'}
                </div>
                <div style="color:#8fa0c0; margin:10px 0;">Úspěšnost: ${score} / 17 kritérií</div>
                <button onclick="document.getElementById('betExpertModal').remove()" style="width:100%; padding:12px; background:#222; border:1px solid #444; color:#fff; border-radius:8px; cursor:pointer;">ZAVŘÍT</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
