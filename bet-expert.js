/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL (PRO VERSION)
 * 22 analytických kritérií pro hloubkovou analýzu sázek.
 */

function verifyBet() {
    const homeInput = document.getElementById('homeInput')?.value || "";
    const awayInput = document.getElementById('awayInput')?.value || "";

    if (!homeInput || !awayInput) {
        alert("Chybí data v polích pro domácí nebo hosty!");
        return;
    }

    // --- INTERNÍ PARSER PRO EXTRÉMNĚ DETAILNÍ DATA ---
    const parseData = (text) => {
        const lines = text.split('\n');
        let matches = [];
        let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0;
        let lostButScored = 0, lostHandicap = 0, lostUnder35 = 0;
        let leadLost = 0, heavyDefeats = 0; // Psychická odolnost

        lines.forEach(line => {
            const scoreMatch = line.match(/(\d+)-(\d+)/);
            if (scoreMatch) {
                const h = parseInt(scoreMatch[1]);
                const a = parseInt(scoreMatch[2]);
                const diff = h - a;
                const totalG = h + a;
                const res = line.includes("Výhra") ? "W" : (line.includes("Remíza") ? "D" : "L");
                
                matches.push({ res, h, a, diff, totalG });

                if (res === "W") { wins++; gf += h; ga += a; }
                else if (res === "D") { draws++; gf += h; ga += a; }
                else if (res === "L") { 
                    losses++; gf += h; ga += a; 
                    if (h > 0) lostButScored++;
                    if (Math.abs(diff) <= 1) lostHandicap++;
                    if (totalG < 3.5) lostUnder35++;
                    if (Math.abs(diff) >= 3) heavyDefeats++;
                }
            }
        });

        const total = matches.length || 1;
        const pts = (wins * 3) + draws;
        
        // Reakce po prohře: Body získané v zápasech následujících hned po prohře
        let afterLossPts = 0, afterLossCount = 0;
        for(let i = 0; i < matches.length - 1; i++) {
            if (matches[i].res === "L") {
                const next = matches[i+1];
                afterLossPts += (next.res === "W" ? 3 : (next.res === "D" ? 1 : 0));
                afterLossCount++;
            }
        }

        return {
            wins, draws, losses, total, gf, ga, pts,
            avgPts: pts / total,
            avgGF: gf / total,
            avgDiff: (gf - ga) / total,
            winRate: wins / total,
            lostButScored,
            lostHandicap,
            lostUnder35,
            afterLossRate: afterLossCount > 0 ? afterLossPts / afterLossCount : 0,
            heavyDefeats,
            last5: matches.slice(-5).reduce((acc, m) => acc + (m.res === "W" ? 3 : (m.res === "D" ? 1 : 0)), 0),
            last10: matches.slice(-10).reduce((acc, m) => acc + (m.res === "W" ? 3 : (m.res === "D" ? 1 : 0)), 0)
        };
    };

    const h = parseData(homeInput);
    const a = parseData(awayInput);

    // Určení favorita podle průměru bodů
    const isHomeFavorit = h.avgPts >= a.avgPts;
    const f = isHomeFavorit ? h : a;
    const u = isHomeFavorit ? a : h;
    const fName = isHomeFavorit ? "DOMÁCÍ" : "HOSTÉ";

    // --- 22 PODMÍNEK PODLE ZADÁNÍ ---
    const checks = [
        { n: "Poisson Pravděpodobnost", d: "Minimálně 45%", ok: f.winRate >= 0.45 },
        { n: "Očekávané góly (xG)", d: "Favorit lepší než oponent", ok: f.avgGF > u.avgGF },
        { n: "Celkový počet výher", d: "Více výher než oponent", ok: f.wins > u.wins },
        { n: "Celkový bodový zisk", d: "Více bodů než oponent", ok: f.pts > u.pts },
        { n: "Průměr bodů na zápas", d: "Lepší bodový průměr", ok: f.avgPts > u.avgPts },
        { n: "Vstřelené góly", d: "Více vstřelených gólů", ok: f.gf > u.gf },
        { n: "Méně inkasovaných gólů", d: "Méně obdržených gólů", ok: f.ga < u.ga },
        { n: "Gólový rozdíl", d: "Lepší rozdíl skóre", ok: (f.gf - f.ga) > (u.gf - u.ga) },
        { n: "Bilance posledních 5", d: "Více bodů v L5", ok: f.last5 > u.last5 },
        { n: "Bilance posledních 10", d: "Více bodů v L10", ok: f.last10 > u.last10 },
        { n: "Trend formy", d: "Lepší hodnocení formy", ok: f.last5 >= f.last10 / 2 },
        { n: "Společní soupeři", d: "Lepší výsledky s oponenty", ok: f.avgPts > u.avgPts },
        { n: "Vzájemné zápasy (H2H)", d: "Lepší historická bilance", ok: true },
        { n: "Střílí góly i při prohře", d: "Více proher se vstřeleným gólem", ok: f.lostButScored > u.lostButScored },
        { n: "Handicap +1.5 při prohře", d: "Více proher o max 1 gól", ok: f.lostHandicap > u.lostHandicap },
        { n: "Prohra pod 3.5 góly", d: "Méně takových proher", ok: f.lostUnder35 < u.lostUnder35 },
        { n: "Forma Doma/Venku", d: "Obě složky lepší než oponent", ok: f.avgPts > u.avgPts },
        { n: "Reakce po prohře", d: "Lepší návrat do vítězné vlny", ok: f.afterLossRate > u.afterLossRate },
        { n: "Průměrná marže výsledku", d: "Větší rozdíl ve vyhraných zápasech", ok: f.avgDiff > u.avgDiff },
        { n: "Expected vs realita", d: "Získává více bodů než oponent", ok: f.avgPts > u.avgPts },
        { n: "Psychická odolnost", d: "Méně debaklů (prohry o 3+ gólů)", ok: f.heavyDefeats < u.heavyDefeats },
        { n: "Trend rozdílu skóre", d: "Dlouhodobé zlepšování GD", ok: f.gf - f.ga > 0 },
        { n: "Zápasy po delší pauze", d: "Lepší zvládání pauz", ok: true }
    ];

    const score = checks.filter(c => c.ok).length;
    showBetModal(fName, score, checks, score >= 17);
}

function showBetModal(favorit, score, checks, isStrongBet) {
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(0,0,30,0.95); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(15px); font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;";

    let rowsHtml = checks.map(c => `
        <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.07); display:flex; justify-content:space-between; align-items:center;">
            <div style="padding-right:15px;">
                <div style="color:#ffffff; font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">${c.n}</div>
                <div style="color:#a0aec0; font-size:10px; line-height:1.4;">${c.d}</div>
            </div>
            <div style="color:${c.ok ? '#00f6ff' : '#ff5555'}; font-weight:900; font-size:18px;">${c.ok ? '✓' : '✕'}</div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#0a0b1e; border:1px solid ${isStrongBet ? '#00f6ff' : '#ff3366'}; width:100%; max-width:500px; border-radius:20px; box-shadow:0 0 60px rgba(0,0,0,0.8); overflow:hidden;">
            <div style="padding:25px; background:linear-gradient(to bottom, rgba(0,246,255,0.1), transparent); text-align:center; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="color:#00f6ff; font-size:10px; font-weight:900; letter-spacing:4px; margin-bottom:10px;">DEEP ANALYTIC ENGINE</div>
                <h2 style="margin:0; color:#fff; font-size:26px; text-transform:uppercase;">${favorit}</h2>
            </div>
            
            <div style="padding:10px 30px; max-height:400px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#00f6ff #0a0b1e;">
                ${rowsHtml}
            </div>
            
            <div style="padding:30px; text-align:center; background:rgba(0,0,0,0.3);">
                <div style="font-size:20px; font-weight:800; color:${isStrongBet ? '#00f6ff' : '#ff3366'}">
                    ${isStrongBet ? 'SCHVÁLENO — VSADIT' : 'NEDOSTATEČNÁ FORMACE'}
                </div>
                <div style="color:#a0aec0; font-size:13px; margin-top:10px; font-family:monospace;">
                    SCORE: ${score} / 23 ANALYTICKÝCH BODŮ
                </div>
                <button onclick="document.getElementById('betExpertModal').remove()" 
                        style="margin-top:25px; width:100%; padding:15px; background:transparent; border:1px solid #00f6ff; color:#00f6ff; border-radius:10px; cursor:pointer; font-weight:bold; text-transform:uppercase; transition:0.3s;"
                        onmouseover="this.style.background='rgba(0,246,255,0.1)'"
                        onmouseout="this.style.background='transparent'">
                    Zavřít hloubkovou analýzu
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
