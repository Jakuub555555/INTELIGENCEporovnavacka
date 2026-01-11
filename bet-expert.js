/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL (v2.0)
 * Přísná filtrace podle 17 analytických kritérií
 */

function verifyBet() {
    const homeInput = document.getElementById('homeInput')?.value.trim();
    const awayInput = document.getElementById('awayInput')?.value.trim();

    if (!homeInput || !awayInput) {
        console.warn("Chybějící data pro analýzu.");
        return;
    }

    const home = parseTeamBlock(homeInput);
    const away = parseTeamBlock(awayInput);
    const probs = computeMatchProbabilities(home.stats, away.stats);
    const common = getCommonOpponentsData(home, away);
    const h2h = getHeadToHeadData(home, away);

    const hs = home.stats;
    const as = away.stats;

    // Určení favorita podle pravděpodobnosti
    const isHomeFavorit = probs.pAwin >= probs.pBwin;
    const f = isHomeFavorit ? hs : as; 
    const u = isHomeFavorit ? as : hs; 
    const fName = isHomeFavorit ? home.name : away.name;
    const fProb = isHomeFavorit ? probs.pAwin : probs.pBwin;
    const uProb = isHomeFavorit ? probs.pBwin : probs.pAwin;

    // Pomocné výpočty
    const safeDiv = (a, b) => b > 0 ? a / b : 0;
    const calcPts = (list) => list ? list.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0) : 0;
    const trendPower = { "rostoucí": 2, "stabilní": 1, "klesající": 0 };
    
    // xG a Goal Diff výpočty pro 10% srovnání
    const fExG = isHomeFavorit ? probs.expA : probs.expB;
    const uExG = isHomeFavorit ? probs.expB : probs.expA;
    const fGD = f.goalsFor - f.goalsAgainst;
    const uGD = u.goalsFor - u.goalsAgainst;

    // --- 17 PODMÍNEK PODLE NOVÉHO ZADÁNÍ ---
    const checks = [
        { n: "Poisson Pravděpodobnost", d: "favorit musí mít 45%+", ok: fProb >= 0.45 },
        { n: "Očekávané góly (xG)", d: "favorit musí být o 10% lepší v xG", ok: fExG > (uExG * 1.1) },
        { n: "Celkový počet výher", d: "favorit musí mít více výher", ok: f.wins > u.wins },
        { n: "Celkový bodový zisk", d: "favorit musí mít více bodů", ok: f.points > u.points },
        { n: "Průměr bodů na zápas", d: "favorit musí mít vyšší průměr", ok: safeDiv(f.points, f.total) > safeDiv(u.points, u.total) },
        { n: "Vstřelené góly", d: "favorit musí mít více vstřelených gólů", ok: f.goalsFor > u.goalsFor },
        { n: "Méně inkasovaných gólů", d: "favorit musí mít méně inkasovaných", ok: f.goalsAgainst < u.goalsAgainst },
        { n: "Gólový rozdíl", d: "favorit musí být o 10% lepší v GD", ok: fGD > (uGD * 1.1) },
        { n: "Bilance posledních 5 zápasů", d: "více bodů v L5", ok: calcPts(f.last5) > calcPts(u.last5) },
        { n: "Bilance posledních 10 zápasů", d: "více bodů v L10", ok: calcPts(f.last10) > calcPts(u.last10) },
        { n: "Trend formy", d: "lepší slovní hodnocení", ok: (trendPower[f.trend] || 0) > (trendPower[u.trend] || 0) },
        { n: "Společní soupeři", d: "výrazně lepší výsledky", ok: common.summary && common.summary.overallBetter === fName },
        { n: "Vzájemné zápasy (H2H)", d: "lepší historická bilance", ok: h2h.summary && h2h.summary.overall === fName },
        
        // NOVÁ KRITÉRIA
        { 
            n: "Gól i při prohře", 
            d: "o 7% vyšší úspěšnost skórovat i při prohře", 
            ok: safeDiv(f.lostButScored, f.total) > (safeDiv(u.lostButScored, u.total) + 0.07) 
        },
        { 
            n: "Rezistence (Handicap +1.5)", 
            d: "o 7% lepší udržení skóre při prohrách", 
            ok: safeDiv(f.lostHandicap, f.total) > (safeDiv(u.lostHandicap, u.total) + 0.07) 
        },
        { 
            n: "Prohra pod 3.5 gólu", 
            d: "favorit musí mít méně těchto selhání", 
            ok: f.lostUnder35 < u.lostUnder35 
        },
        { 
            n: "Forma Doma/Venku", 
            d: "musí mít obě statistiky lepší než oponent", 
            ok: f.homeFormPts > u.homeFormPts && f.awayFormPts > u.awayFormPts 
        }
    ];

    const score = checks.filter(c => c.ok).length;
    // Nastavení přísnosti: 14 ze 17 pro silnou sázku
    const isStrongBet = score >= 14;

    showBetModal(fName, score, checks, isStrongBet);
}

function showBetModal(favorit, score, checks, isStrongBet) {
    const old = document.getElementById('betExpertModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'betExpertModal';
    modal.style = "position:fixed; inset:0; background:rgba(2,0,10,0.96); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(12px); font-family: 'Inter', sans-serif;";

    let rowsHtml = checks.map(c => `
        <div style="padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#e0e6ed; font-weight:500; font-size:12px;">${c.n}</span>
                <span style="color:${c.ok ? '#00e676' : '#ff6b6b'}; font-weight:bold; font-size:14px;">${c.ok ? '✓' : '✕'}</span>
            </div>
            <div style="color:#63789d; font-size:10px;">${c.d}</div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:#0a0510; border:1px solid ${isStrongBet ? '#00f5ff' : '#441020'}; width:100%; max-width:450px; border-radius:20px; box-shadow:0 30px 60px rgba(0,0,0,0.8); overflow:hidden;">
            <div style="padding:20px; background:linear-gradient(135deg, rgba(0,245,255,0.1) 0%, transparent 100%); text-align:center;">
                <div style="font-size:10px; color:#00f5ff; letter-spacing:4px; margin-bottom:5px; font-weight:900;">ADVANCED AI ANALYTICS</div>
                <h2 style="margin:0; color:#fff; font-size:24px; text-transform:uppercase; letter-spacing:1px;">${favorit}</h2>
            </div>
            
            <div style="padding:10px 25px; max-height:380px; overflow-y:auto; scrollbar-width: thin; scrollbar-color: #333 transparent;">
                ${rowsHtml}
            </div>
            
            <div style="padding:20px; text-align:center; background:rgba(255,255,255,0.02); border-top:1px solid rgba(255,255,255,0.05);">
                <div style="font-size:18px; font-weight:800; color:${isStrongBet ? '#00e676' : '#ff6b6b'}">
                    ${isStrongBet ? 'OPTIMÁLNÍ PŘÍLEŽITOST' : 'NEDOSTATEČNÁ DATA / RIZIKO'}
                </div>
                <div style="font-size:12px; color:#8fa0c0; margin-top:5px;">
                    MATCH SCORE: <span style="color:#fff; font-weight:bold;">${score} / 17</span>
                </div>
                <button onclick="document.getElementById('betExpertModal').remove()" 
                        style="margin-top:20px; width:100%; padding:14px; background:${isStrongBet ? '#00e676' : 'rgba(255,255,255,0.05)'}; border:none; color:${isStrongBet ? '#000' : '#fff'}; border-radius:10px; cursor:pointer; font-weight:bold; text-transform:uppercase; font-size:12px;">
                    Zavřít detailní analýzu
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
