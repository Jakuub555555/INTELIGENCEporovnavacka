/**

 * MATCH INTELLIGENCE - BET EXPERT MODUL

 * Přísná filtrace podle 15 analytických kritérií s podrobným popisem

 */



function verifyBet() {

    const homeInput = document.getElementById('homeInput')?.value.trim();

    const awayInput = document.getElementById('awayInput')?.value.trim();



    if (!homeInput || !awayInput) {

        // V prostředí iFrame nepoužíváme alert, ale můžeme logovat nebo zobrazit UI zprávu

        console.warn("Chybějící data pro analýzu.");

        return;

    }



    // Načtení dat z hlavního skriptu (předpokládá existenci těchto funkcí)

    const home = parseTeamBlock(homeInput);

    const away = parseTeamBlock(awayInput);

    const probs = computeMatchProbabilities(home.stats, away.stats);

    const common = getCommonOpponentsData(home, away);

    const h2h = getHeadToHeadData(home, away);



    const hs = home.stats;

    const as = away.stats;



    // Určení favorita podle Poissonovy pravděpodobnosti

    const isHomeFavorit = probs.pAwin >= probs.pBwin;

    const f = isHomeFavorit ? hs : as; 

    const u = isHomeFavorit ? as : hs; 

    const fName = isHomeFavorit ? home.name : away.name;

    const fProb = isHomeFavorit ? probs.pAwin : probs.pBwin;



    const safeDiv = (a, b) => b > 0 ? a / b : 0;

    const calcPts = (list) => list ? list.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0) : 0;

    const trendPower = { "rostoucí": 2, "stabilní": 1, "klesající": 0 };



    // --- 15 PODMÍNEK PRO VERDIKT PODLE ZADÁNÍ ---

    const checks = [

        { 

            n: "Poisson Pravděpodobnost", 

            d: "favorit musí mít větší pravděpodobnost 45%+", 

            ok: fProb >= 0.45 

        },

        { 

            n: "Celkový počet výher", 

            d: "favorit musí mít větší počet výher než oponent", 

            ok: f.wins > u.wins 

        },

        { 

            n: "Očekávané góly", 

            d: "favorit musí mít 2,8+ očekávané góly", 

            ok: (isHomeFavorit ? probs.expA : probs.expB) >= 2.8 

        },

        { 

            n: "Celkový bodový zisk", 

            d: "favorit musí mít lepší bodový zisk než oponent", 

            ok: f.points > u.points 

        },

        { 

            n: "Vstřelené góly", 

            d: "favorit musí mít více vstřelených gólů než oponent", 

            ok: f.goalsFor > u.goalsFor 

        },

        { 

            n: "Méně inkasovaných gólů", 

            d: "favorit musí mít méně inkasovaných gólů než oponent", 

            ok: f.goalsAgainst < u.goalsAgainst 

        },

        { 

            n: "Gólový rozdíl", 

            d: "favorit musí mít více než oponent aspoň o 10+", 

            ok: (f.goalsFor - f.goalsAgainst) >= (u.goalsFor - u.goalsAgainst) + 10 

        },

        { 

            n: "Bilance posledních 5 zápasů", 

            d: "favorit musí mít lepší bilanci než oponent", 

            ok: calcPts(f.last5) > calcPts(u.last5) 

        },

        { 

            n: "Bilance posledních 10 zápasů", 

            d: "favorit musí mít lepší bilanci než oponent", 

            ok: calcPts(f.last10) > calcPts(u.last10) 

        },

        { 

            n: "Trend formy", 

            d: "favorit musí mít lepší než oponent", 

            ok: (trendPower[f.trend] || 0) > (trendPower[u.trend] || 0) 

        },

        { 

            n: "Průměr bodů/zápas", 

            d: "favorit musí mít vyšší než oponent", 

            ok: safeDiv(f.points, f.total) > safeDiv(u.points, u.total) 

        },

        { 

            n: "Průměr bodů (L5)", 

            d: "favorit musí mít vyšší než oponent", 

            ok: safeDiv(calcPts(f.last5), 5) > safeDiv(calcPts(u.last5), 5) 

        },

        { 

            n: "Podíl zápasů Over 2.5", 

            d: "favorit musí mít vyšší než oponent", 

            ok: safeDiv(f.over25, f.total) > safeDiv(u.over25, u.total) 

        },

        { 

            n: "Lepší proti spol. soupeřům", 

            d: "favorit musí být výrazně lepší než oponent", 

            ok: common.summary && common.summary.overallBetter === fName 

        },

        { 

            n: "Lepší ve vzájemných (H2H)", 

            d: "favorit musí být výrazně lepší než oponent", 

            ok: h2h.summary && h2h.summary.overall === fName 

        }

    ];



    const score = checks.filter(c => c.ok).length;

    const isStrongBet = score >= 12;



    showBetModal(fName, score, checks, isStrongBet);

}



function showBetModal(favorit, score, checks, isStrongBet) {

    const old = document.getElementById('betExpertModal');

    if (old) old.remove();



    const modal = document.createElement('div');

    modal.id = 'betExpertModal';

    modal.style = "position:fixed; inset:0; background:rgba(2,0,10,0.95); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(10px);";



    let rowsHtml = checks.map(c => `

        <div style="padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-family: 'Inter', sans-serif;">

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">

                <span style="color:#fff; font-weight:600; font-size:13px;">${c.n}</span>

                <span style="color:${c.ok ? '#00e676' : '#ff6b6b'}; font-weight:bold; font-size:16px;">${c.ok ? '✓' : '✕'}</span>

            </div>

            <div style="color:#8fa0c0; font-size:11px; line-height:1.2;">${c.d}</div>

        </div>

    `).join('');



    modal.innerHTML = `

        <div style="background:#0a0510; border:1px solid ${isStrongBet ? '#00f5ff' : '#441020'}; width:100%; max-width:500px; border-radius:16px; box-shadow:0 25px 50px rgba(0,0,0,0.5); overflow:hidden;">

            <div style="padding:20px; background:linear-gradient(to bottom, rgba(255,255,255,0.05), transparent); text-align:center; border-bottom:1px solid rgba(255,255,255,0.1);">

                <div style="font-size:11px; color:#00f5ff; letter-spacing:3px; margin-bottom:8px; font-weight:bold;">AI EXPERT VERDICT</div>

                <h2 style="margin:0; color:#fff; font-size:22px; text-transform:uppercase;">${favorit}</h2>

            </div>

            

            <div style="padding:15px 25px; max-height:400px; overflow-y:auto; scrollbar-width: thin;">

                ${rowsHtml}

            </div>

            

            <div style="padding:25px; text-align:center; background:rgba(255,255,255,0.02);">

                <div style="font-size:20px; font-weight:800; letter-spacing:0.5px; color:${isStrongBet ? '#00e676' : '#ff6b6b'}">

                    ${isStrongBet ? 'DOBRÁ VOLBA — VSADIT' : 'VYSOKÉ RIZIKO — NEVSÁZET'}

                </div>

                <div style="font-size:13px; color:#8fa0c0; margin-top:10px; font-family:monospace;">

                    SCORE: <span style="color:#fff">${score}</span> / 15 KRITÉRIÍ SPLNĚNO

                </div>

                <button onclick="document.getElementById('betExpertModal').remove()" 

                        style="margin-top:25px; width:100%; padding:12px; background:rgba(0,245,255,0.1); border:1px solid #00f5ff; color:#00f5ff; border-radius:8px; cursor:pointer; font-weight:bold; transition: 0.2s; outline:none;"

                        onmouseover="this.style.background='rgba(0,245,255,0.2)'"

                        onmouseout="this.style.background='rgba(0,245,255,0.1)'">

                    ZAVŘÍT ANALÝZU

                </button>

            </div>

        </div>

    `;

    document.body.appendChild(modal);

}
