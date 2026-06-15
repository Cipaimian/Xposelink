const { VIRUSTOTAL_API_KEY } = require("../config");

// Test if a keyword appears as a whole word/segment in a URL string.
// Uses \b (word boundary) so "nu" matches "/nu/" or "?nu=" but NOT "binusmaya".
// Keywords with hyphens (e.g. "slot-gacor") are matched as a complete unit.
function matchesKeyword(text, kw) {
  const escaped = kw.trim().replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

// How old a VT scan can be before we re-submit (7 days in seconds)
const VT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

class SecurityService {
  constructor({ safeBrowsingService } = {}) {
    this.safeBrowsingService = safeBrowsingService || null;
    // ── Malware / phishing ──────────────────────────────────────────────────
    this.badDomains = [
      "phishing-demo.test",
      "malware-download.test",
      "free-gift-card.example",
      "bit.ly.bad-redirect.test",
    ];
    this.suspiciousKeywords = [
      "login-verification", "free-money", "gift-card",
      "claim-now", "urgent-update", "password-reset",
    ];
    this.suspiciousTlds = [".zip", ".mov", ".country"];

    // ── Known adult content domains ─────────────────────────────────────────
    this.adultDomains = [
      "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com",
      "redtube.com", "youporn.com", "tube8.com", "spankbang.com",
      "tnaflix.com", "drtuber.com", "beeg.com", "hclips.com",
      "hotmovs.com", "txxx.com", "porntrex.com", "vporn.com",
      "eporner.com", "fapster.xxx", "fuq.com", "sexvid.xxx",
      "onlyfans.com", "fansly.com", "manyvids.com",
      "chaturbate.com", "myfreecams.com", "livejasmin.com", "stripchat.com",
      "brazzers.com", "naughtyamerica.com", "realitykings.com",
      "bangbros.com", "mofos.com", "wankz.com", "clips4sale.com",
      "adultfriendfinder.com", "ashley-madison.com",
    ];

    // ── Adult keywords (multilingual) ───────────────────────────────────────
    this.adultKeywords = [
      // English
      "porn", "xxx", "sex", "nude", "naked", "erotic", "hentai",
      "nsfw", "adult-content", "escort", "stripper", "webcam-sex",
      "onlyfans", "nudes", "lewd", "milf", "fetish", "camgirl",
      "sexting", "boobs", "pussy", "cock", "dick", "blowjob",
      "hardcore", "softcore", "bdsm", "orgasm", "cumshot",
      // Indonesian / Malay
      "bokep", "bugil", "telanjang", "esek", "ngentot", "memek",
      "kontol", "seks", "porno", "dewasa-18", "video-mesum",
      "coli", "colmek", "abg-bugil", "jilbab-bugil",
      // Spanish
      "sexo", "porno", "desnudo", "erotico", "adulto", "follar",
      "coger", "puta", "escort-sexy", "webcam-erotica",
      // Portuguese
      "sexo-explicito", "nu", "erótico", "putaria", "gostosa",
      "xvideos", "nude-brasil",
      // French
      "sexe", "erotique", "adulte", "nue", "pornographie", "baise",
      "escort-paris", "webcam-sex",
      // German
      "nackt", "erotik", "pornos", "ficken", "sex-cam", "nutten",
      "escort-berlin", "deutsche-pornos",
      // Italian
      "porno", "sesso", "nuda", "erotico", "scopare", "escort-italia",
      // Russian (transliterated)
      "porno", "seks", "erotika", "golaya", "prostitutka",
      "onlayn-seks", "vebkamera-seks",
      // Chinese (pinyin)
      "seqing", "huangse", "chengren", "luoti", "xingai",
      "aiqing-wangzhan", "seyouyou",
      // Japanese (romaji)
      "ero", "eroge", "hentai", "ecchi", "kanojo-x",
      "av-joyuu", "oppai", "pantsu",
      // Korean (transliterated)
      "yadom", "avdak", "seksi", "nuchida", "avnori",
      // Thai (transliterated)
      "suaphon", "siangphet", "khonsong", "pono-thai",
      // Vietnamese (transliterated)
      "phim-sex", "gai-goi", "lam-tinh", "hiep-dam",
      // Turkish
      "porno", "seks", "erotik", "gizli-cekim", "escort-istanbul",
      // Arabic (transliterated)
      "jins", "alniyak", "mutas-ajnabi", "aflam-jinsiyya",
      "banat-sex", "qarib-min-k",
      // Dutch
      "porno", "seks", "naakte", "erotisch", "prostituee",
      // Polish
      "porno", "seks", "nago", "erotyczny", "prostytutka",
      // Hindi (transliterated)
      "chudai", "nangi", "desi-sex", "bhabhi-xxx", "hindi-porn",
    ];

    // ── Known gambling domains ──────────────────────────────────────────────
    this.gamblingDomains = [
      "bet365.com", "pokerstars.com", "888casino.com", "draftkings.com",
      "fanduel.com", "betway.com", "williamhill.com", "ladbrokes.com",
      "1xbet.com", "betsson.com", "unibet.com", "bwin.com",
      "casumo.com", "leovegas.com", "mrgreen.com", "casinorewards.com",
      "bovada.lv", "betonline.ag", "mybookie.ag", "sportsbetting.ag",
      "betmgm.com", "caesarssportsbook.com", "pointsbet.com",
      "parimatch.com", "melbet.com", "22bet.com",
      // Indonesian illegal gambling
      "judionline.com", "togel4d.com", "poker88.com", "dominoqq.com",
      "bandarq.com", "pokerv.com", "dewapoker.com", "idnpoker.com",
      "slotgacor.com", "pragmaticplay.id", "olympus-slot.com",
    ];

    // ── Gambling keywords (multilingual) ───────────────────────────────────
    this.gamblingKeywords = [
      // English
      "casino", "poker", "gambling", "jackpot", "sportsbook",
      "roulette", "blackjack", "slot-machine", "betting-site",
      "online-bet", "wager", "bookie", "oddsmaker", "free-bet",
      "bet-now", "sports-betting", "live-betting", "crypto-gambling",
      // Indonesian / Malay (very common illegal gambling terms)
      "judi", "togel", "bandar-judi", "agen-slot", "daftar-slot",
      "slot-gacor", "slot-online", "taruhan", "maxwin",
      "scatter", "pragmatic-play-demo", "zeus-slot",
      "mahjong-ways", "bandar-togel", "link-slot",
      "bocoran-slot", "rtp-slot", "agen-bola", "sbobet",
      "sabung-ayam", "dewa-slot", "kakek-zeus", "naga-slot",
      "slot-88", "nexus-slot", "deposit-pulsa-slot",
      // Spanish
      "apuesta", "casino-online", "tragamonedas", "ruleta",
      "poker-online", "juego-de-azar", "apuesta-deportiva",
      // Portuguese
      "apostas", "cassino", "jogo-online", "bet-esporte",
      "cassino-online", "poker-online", "maquina-caca-niquel",
      // French
      "pari-en-ligne", "casino-en-ligne", "machine-a-sous",
      "jeu-hasard", "paris-sportifs", "poker-en-ligne",
      // German
      "online-wetten", "spielautomat", "glucksspiel",
      "sportwetten", "online-casino", "poker-online",
      // Italian
      "scommesse", "casinò-online", "slot-online",
      "gioco-azzardo", "poker-online", "scommesse-sportive",
      // Russian (transliterated)
      "kazino", "poker-online", "stavki", "slot-mashina",
      "bukmekher", "azartnye-igry", "igrovye-avtomaty",
      // Chinese (pinyin)
      "duchang", "bo-a", "online-duzhu", "qiangpai",
      "wanghang-duchang", "caipiao", "laohudanji",
      // Japanese (romaji)
      "pachinko", "casino-online", "kakeguri", "betto",
      "slotsuki", "online-casino", "sports-betting",
      // Korean (transliterated)
      "dosa-kkum", "pheom-gyeong", "seunma", "baduk-online",
      "kaseino", "sports-beoting", "meoktu",
      // Thai (transliterated)
      "gambling-thai", "casino-thai", "bet-online-th",
      "kheenkhao", "sa-gaming", "lotto-thai",
      // Vietnamese (transliterated)
      "co-bac", "casino-online", "da-ga", "lo-de",
      "ban-ca", "bau-cua", "tien-len-online",
      // Turkish
      "bahis", "kumar", "casino-oyunlari",
      "canli-casino", "spor-bahis", "slot-oyunlari",
      // Arabic (transliterated)
      "maysir", "qimar", "casino-arabi", "bet-arabi",
      "al-qimar", "jalsat-casino",
      // Dutch
      "gokken", "casino-online", "sportweddenschappen",
      "gokautomaat", "poker-online",
      // Polish
      "hazard", "kasyno-online", "zaklady-sportowe",
      "automat-do-gry", "poker-online",
      // Hindi (transliterated)
      "satta", "matka", "jua", "cricket-bet",
      "teen-patti-real-money", "online-gambling-india",
    ];
  }

  // ── Heuristic fallback ────────────────────────────────────────────────────
  analyzeUrl(url) {
    const hostname = url.hostname.toLowerCase();
    const fullUrl  = url.toString().toLowerCase();
    // also check path + query string for keyword matching
    const pathAndQuery = (url.pathname + url.search).toLowerCase();

    const indicators = [];
    let riskScore = 5;
    let category  = "safe";

    // ── Malware / phishing checks ──────────────────────────────────────────
    const matchedBadDomain  = this.badDomains.find((d) => hostname === d || hostname.endsWith(`.${d}`));
    const matchedSuspicious = this.suspiciousKeywords.find((kw) => matchesKeyword(fullUrl, kw));
    const matchedBadTld     = this.suspiciousTlds.find((tld) => hostname.endsWith(tld));

    if (matchedBadDomain)  { indicators.push(`Matched blocked domain: ${matchedBadDomain}`);       riskScore += 75; category = "malicious"; }
    if (matchedSuspicious) { indicators.push(`Matched suspicious keyword: ${matchedSuspicious}`);   riskScore += 20; if (category === "safe") category = "suspicious"; }
    if (matchedBadTld)     { indicators.push(`Matched suspicious TLD: ${matchedBadTld}`);           riskScore += 15; if (category === "safe") category = "suspicious"; }

    // ── Adult content checks ───────────────────────────────────────────────
    const matchedAdultDomain  = this.adultDomains.find((d) => hostname === d || hostname.endsWith(`.${d}`));
    const matchedAdultKeyword = this.adultKeywords.find((kw) => matchesKeyword(fullUrl, kw) || matchesKeyword(pathAndQuery, kw));

    if (matchedAdultDomain) {
      indicators.push(`Known adult content site: ${matchedAdultDomain}`);
      riskScore = Math.max(riskScore, 80);
      category  = "adult";
    }
    if (matchedAdultKeyword && !matchedAdultDomain) {
      indicators.push(`Adult content keyword detected: "${matchedAdultKeyword}"`);
      riskScore = Math.max(riskScore, 65);
      category  = "adult";
    }

    // ── Gambling checks ────────────────────────────────────────────────────
    const matchedGamblingDomain  = this.gamblingDomains.find((d) => hostname === d || hostname.endsWith(`.${d}`));
    const matchedGamblingKeyword = this.gamblingKeywords.find((kw) => matchesKeyword(fullUrl, kw) || matchesKeyword(pathAndQuery, kw));

    if (matchedGamblingDomain) {
      indicators.push(`Known gambling site: ${matchedGamblingDomain}`);
      riskScore = Math.max(riskScore, 75);
      if (category === "safe") category = "gambling";
    }
    if (matchedGamblingKeyword && !matchedGamblingDomain) {
      indicators.push(`Gambling keyword detected: "${matchedGamblingKeyword}"`);
      riskScore = Math.max(riskScore, 60);
      if (category === "safe") category = "gambling";
    }

    // ── Final verdict ──────────────────────────────────────────────────────
    const verdict =
      category === "malicious" || riskScore >= 70 ? "malicious" :
      category === "adult"     ? "inappropriate" :
      category === "gambling"  ? "inappropriate" :
      riskScore >= 40          ? "suspicious"    : "safe";

    return {
      verdict,
      category,
      riskScore:     Math.min(riskScore, 100),
      indicators,
      checkedDomain: hostname,
      provider:      "heuristic",
    };
  }

  // ── Build VT URL id (base64url, no padding) ───────────────────────────────
  buildUrlId(urlString) {
    return Buffer.from(urlString)
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  // ── Submit URL to VT and return the analysis ID ──────────────────────────
  async submitForScan(urlString) {
    const res = await fetch("https://www.virustotal.com/api/v3/urls", {
      method:  "POST",
      headers: {
        "x-apikey":     VIRUSTOTAL_API_KEY,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: `url=${encodeURIComponent(urlString)}`,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.data?.id ?? null; // e.g. "u-abc123-..."
  }

  // ── Poll GET /analyses/{id} until completed or timeout ───────────────────
  async pollAnalysis(analysisId, { intervalMs = 4000, maxWaitMs = 30000 } = {}) {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, intervalMs));
      try {
        const res = await fetch(
          `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
          { headers: { "x-apikey": VIRUSTOTAL_API_KEY } },
        );
        if (!res.ok) return null;
        const json = await res.json().catch(() => null);
        const status = json?.data?.attributes?.status;
        if (status === "completed") return json;
        // "queued" or "in-progress" → keep polling
      } catch {
        return null;
      }
    }
    return null; // timed out
  }

  // ── Parse VT GET /analyses/{id} completed response ────────────────────────
  parseAnalysisResult(urlString, json) {
    const stats = json?.data?.attributes?.stats;
    if (!stats) return null;

    const malicious  = stats.malicious  || 0;
    const suspicious = stats.suspicious || 0;
    const harmless   = stats.harmless   || 0;
    const undetected = stats.undetected || 0;
    const timeout    = stats.timeout    || 0;
    const total      = malicious + suspicious + harmless + undetected + timeout || 1;

    const raw       = ((malicious * 12 + suspicious * 4) / total) * 100;
    const riskScore = Math.min(100, Math.round(raw));

    const indicators = [];
    if (malicious  > 0) indicators.push(`${malicious} vendor${malicious   > 1 ? "s" : ""} flagged as malicious`);
    if (suspicious > 0) indicators.push(`${suspicious} vendor${suspicious > 1 ? "s" : ""} flagged as suspicious`);

    const verdict  = malicious > 0 || suspicious > 2 ? "malicious" : "safe";
    const hostname = (() => { try { return new URL(urlString).hostname; } catch { return urlString; } })();

    return {
      verdict,
      category:      verdict === "malicious" ? "malicious" : "safe",
      riskScore,
      indicators,
      checkedDomain: hostname,
      provider:      "virustotal",
      vtStats:       { malicious, suspicious, harmless, undetected, timeout, total },
      scanAge:       "just scanned",
    };
  }

  // ── Parse VT GET /urls/{id} response ─────────────────────────────────────
  parseVTResult(urlString, json) {
    const attrs = json.data?.attributes;
    const stats = attrs?.last_analysis_stats;
    if (!stats) return null;

    const malicious  = stats.malicious  || 0;
    const suspicious = stats.suspicious || 0;
    const harmless   = stats.harmless   || 0;
    const undetected = stats.undetected || 0;
    const timeout    = stats.timeout    || 0;
    const total      = malicious + suspicious + harmless + undetected + timeout || 1;

    // Weighted risk score: malicious counts 12x, suspicious 4x
    const raw      = ((malicious * 12 + suspicious * 4) / total) * 100;
    const riskScore = Math.min(100, Math.round(raw));

    const indicators = [];
    if (malicious  > 0) indicators.push(`${malicious} vendor${malicious   > 1 ? "s" : ""} flagged as malicious`);
    if (suspicious > 0) indicators.push(`${suspicious} vendor${suspicious > 1 ? "s" : ""} flagged as suspicious`);

    const verdict = malicious > 0 || suspicious > 2 ? "malicious" : "safe";

    const hostname = (() => { try { return new URL(urlString).hostname; } catch { return urlString; } })();

    // Check scan freshness
    const lastAnalysisDate = attrs.last_analysis_date; // unix timestamp
    const ageSeconds = lastAnalysisDate ? (Date.now() / 1000 - lastAnalysisDate) : 0;
    if (ageSeconds > VT_MAX_AGE_SECONDS) {
      // Stale result — re-submit for fresh scan (fire-and-forget), still return cached result
      this.submitForScan(urlString);
    }

    return {
      verdict,
      category: verdict === "malicious" ? "malicious" : "safe",
      riskScore,
      indicators,
      checkedDomain: hostname,
      provider:      "virustotal",
      vtStats: { malicious, suspicious, harmless, undetected, timeout, total },
      scanAge:       lastAnalysisDate
        ? `${Math.round(ageSeconds / 86400)} days ago`
        : "unknown",
    };
  }

  // ── VirusTotal lookup ─────────────────────────────────────────────────────
  async checkWithVirusTotal(urlString) {
    if (!VIRUSTOTAL_API_KEY) return null;

    const urlId = this.buildUrlId(urlString);

    try {
      const res = await fetch(
        `https://www.virustotal.com/api/v3/urls/${urlId}`,
        { headers: { "x-apikey": VIRUSTOTAL_API_KEY } },
      );

      if (res.ok) {
        const json = await res.json();
        // Check scan freshness — re-scan if stale but still return cached result
        const lastAnalysisDate = json.data?.attributes?.last_analysis_date;
        const ageSeconds = lastAnalysisDate ? (Date.now() / 1000 - lastAnalysisDate) : 0;
        if (ageSeconds > VT_MAX_AGE_SECONDS) {
          this.submitForScan(urlString).catch(() => {});
        }
        return this.parseVTResult(urlString, json);
      }

      if (res.status === 404) {
        const analysisId = await this.submitForScan(urlString);
        if (!analysisId) return null;

        const analysisJson = await this.pollAnalysis(analysisId);
        if (!analysisJson) {
          // Timed out — return null so caller uses heuristic
          console.warn("[SecurityService] VT: scan timed out after 30s, using heuristic");
          return null;
        }
        return this.parseAnalysisResult(urlString, analysisJson);
      }

      if (res.status === 429) {
        console.warn("[SecurityService] VirusTotal rate limit hit — falling back to heuristic");
        return null;
      }

      return null;
    } catch (err) {
      console.warn("[SecurityService] VirusTotal request failed:", err.message);
      return null;
    }
  }

  // ── Merge VT result with heuristic adult/gambling checks ─────────────────
  // VT only knows malware/phishing. We always layer heuristic on top so that
  // adult and gambling sites are flagged even when VT says "safe".
  mergeResults(vtResult, heuristic) {
    // If heuristic found adult/gambling, override verdict regardless of VT
    if (heuristic.category === "adult" || heuristic.category === "gambling") {
      return {
        ...vtResult,
        verdict:    "inappropriate",
        category:   heuristic.category,
        riskScore:  Math.max(vtResult.riskScore, heuristic.riskScore),
        indicators: [...(vtResult.indicators || []), ...heuristic.indicators],
        provider:   "virustotal+heuristic",
      };
    }
    // VT flagged malicious — keep VT result, still append any heuristic notes
    return {
      ...vtResult,
      indicators: [...(vtResult.indicators || []), ...heuristic.indicators],
      provider:   "virustotal+heuristic",
    };
  }


  // ── Google Safe Browsing lookup (async, real-time API) ────────────────────
  async checkSafeBrowsing(urlString) {
    if (!this.safeBrowsingService) return null;
    return this.safeBrowsingService.check(urlString);
  }

  // Layer Google Safe Browsing result on top of an analysis. A match
  // is a strong signal, so we override verdict to malicious and adjust risk score.
  applySafeBrowsingMatch(analysis, sbResult) {
    if (!sbResult?.matched) return analysis;
    return {
      ...analysis,
      verdict:   sbResult.verdict,
      category:  sbResult.category,
      riskScore: Math.max(analysis.riskScore ?? 0, sbResult.riskScore),
      indicators: [
        ...(sbResult.indicators || []),
        ...(analysis.indicators || []),
      ],
      provider: analysis.provider
        ? `${analysis.provider}+${sbResult.provider}`
        : sbResult.provider,
    };
  }

  // ── Public entry point ────────────────────────────────────────────────────
  async check(urlString, verificationService) {
    const normalizedUrl = verificationService.normalizeUrl(urlString);
    if (!normalizedUrl) {
      const error = new Error("Please provide a valid URL");
      error.status = 400;
      throw error;
    }

    const parsedUrl = new URL(normalizedUrl);
    const heuristic = this.analyzeUrl(parsedUrl);
    const sbResult  = await this.checkSafeBrowsing(normalizedUrl);
    const vtResult  = await this.checkWithVirusTotal(normalizedUrl);

    // Google Safe Browsing hit — strong signal, use that as base
    if (sbResult?.matched) {
      let analysis = this.applySafeBrowsingMatch(heuristic, sbResult);
      // Also layer VT result if available
      if (vtResult) {
        analysis = this.mergeResults(vtResult, analysis);
      }
      return {
        message: "URL security analysis completed",
        data: {
          url: normalizedUrl,
          ...analysis,
        },
      };
    }

    // VT has a result — merge with heuristic
    // If both timed out, fall back to heuristic only
    let analysis = vtResult
      ? this.mergeResults(vtResult, heuristic)
      : heuristic;

    return {
      message: "URL security analysis completed",
      data: {
        url: normalizedUrl,
        ...analysis,
      },
    };
  }
}

module.exports = SecurityService;
