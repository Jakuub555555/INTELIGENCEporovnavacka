/**
 * MATCH INTELLIGENCE - BET EXPERT MODUL (v2.1)
 * Odolnější verze kompatibilní se staršími parsery
 */

function verifyBet() {
    // 1. Kontrola existence vstupů
    const hEl = document.getElementById('homeInput');
    const aEl = document.getElementById('awayInput');
    
    if (!hEl?.value || !aEl?.value) {
        console.warn("Chybějící data pro analýzu.");
        return;
    }

    // 2. Načtení dat (zde musí existovat vaše původní funkce v hlavním skriptu)
    const home = parseTeamBlock(hEl.value.trim());
    const away = parseTeamBlock(aEl.value.trim());
    const probs = computeMatchProbabilities(home.stats, away.stats);
    
    // Ošetření volitelných funkcí (pokud neexistují, vrátíme prázdný objekt)
    const common = typeof getCommonOpponentsData === 'function' ? getCommonOpponentsData(home, away) : {};
    const h2h = typeof getHeadToHeadData === 'function' ? getHeadToHeadData(home, away) : {};

    const hs = home.stats;
    const as = away.stats;

    const isHomeFavorit = probs.pAwin >= probs.pBwin;
    const f = isHomeFavorit ? hs : as; 
    const u = isHomeFavorit ? as : hs; 
    const fName = isHomeFavorit ? home.name : away.name;
    const fProb = isHomeFavorit ? probs.pAwin : probs.pBwin;

    const safeDiv = (a, b) => (b && b > 0) ? a / b : 0;
    const calcPts = (list) => Array.isArray(list) ? list.reduce((s, m) => s + (m.res === "W" ? 3 : m.res === "D" ? 1 : 0), 0) : 0;
    const trendPower = { "rostoucí": 2, "stabilní": 1, "klesající": 0 };
    
    const fExG = isHomeFavorit ? (probs.expA || 0) : (probs.expB || 0);
    const uExG = isHomeFavorit ? (probs.expB || 0) : (probs.expA || 0);

    // --- FILTRACE (S OŠETŘENÍM CHYBĚJÍCÍCH DAT) ---
    const checks = [
        { n: "Poisson Pravděpodobnost", d: "45%+", ok: fProb >= 0.45 },
        { n: "Očekávané góly (xG)", d: "o 10% lepší", ok: fExG > (uExG * 1.1) },
        { n: "Celkový počet výher", d: "více výher", ok: (f.wins || 0) > (u.wins || 0) },
        { n: "Celkový bodový zisk", d: "více bodů", ok: (f.points || 0) > (u.points || 0) },
        { n: "Průměr bodů na zápas", d: "vyšší průměr", ok: safeDiv(f.points, f.total) > safeDiv(u.points, u.total) },
        { n: "Vstřelené góly", d: "více gólů", ok: (f.goalsFor || 0) > (u.goalsFor || 0) },
        { n: "Méně inkasovaných gólů", d: "méně gólů", ok: (f.goalsAgainst || 0) < (u.goalsAgainst || 0) },
        { n: "Gólový rozdíl", d: "o 10% lepší", ok: (f.goalsFor - f.goalsAgainst) > ((u.goalsFor - u.goalsAgainst) * 1.1) },
        { n: "Bilance posledních 5", d: "L5 forma", ok: calcPts(f.last5) > calcPts(u.last5) },
        { n: "Bilance posledních 10", d: "L10 forma", ok: calcPts(f.last10) > calcPts(u.last10) },
        { n: "Trend formy", d: "lepší trend", ok: (trendPower[f.trend] || 0) > (trendPower[u.trend] || 0) },
        { n: "Společní soupeři", d: "lepší výsledky", ok: common?.summary?.overallBetter === fName },
        { n: "Vzájemné zápasy (H2H)", d: "H2H bilance", ok: h2h?.summary?.overall === fName },
        
        // Nové podmínky - pokud data v 'f' a 'u' chybí, budou FALSE, ale kód poběží
        { n: "Gól i při prohře", d: "+7% úspěšnost", ok: safeDiv(f.lostButScored, f.total) > (safeDiv(u.lostButScored, u.total) + 0.07) },
        { n: "Rezistence (+1.5 HC)", d: "+7% stabilita", ok: safeDiv(f.lostHandicap, f.total) > (safeDiv(u.lostHandicap, u.total) + 0.07) },
        { n: "Prohra pod 3.5 gólu", d: "méně selhání", ok: (f.lostUnder35 || 0) < (u.lostUnder35 || 99) },
        { n: "Forma Doma/Venku", d: "obě lepší", ok: (f.homeFormPts || 0) > (u.homeFormPts || 0) && (f.awayFormPts || 0) > (u.awayFormPts || 0) }
    ];

    const score = checks.filter(c => c.ok).length;
    showBetModal(fName, score, checks, score >= 14);
}

// Funkce showBetModal zůstává stejná jako v předchozí odpovědi...
