"""
TruthLens — AI-Powered Fake News Detection Tool  v5.0
=====================================================
Two-pass RAG pipeline:
  Pass 1: LLaMA 3.3 70B extracts targeted search queries
  Search: Multi-strategy DuckDuckGo (text + news) with smart retry
  Pass 2: LLaMA 3.3 70B analyses claim vs. evidence → verdict
"""

import os, json, time, re
from flask import Flask, render_template, request, jsonify
from groq import Groq
from dotenv import load_dotenv
from ddgs import DDGS
from urllib.parse import urlparse

try:
    from supabase import create_client
except ImportError:
    create_client = None

load_dotenv()
app = Flask(__name__)
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# Supabase client (optional — gracefully skipped if not configured)
_sb_url = os.getenv("SUPABASE_URL")
_sb_key = os.getenv("SUPABASE_KEY")
supabase = create_client(_sb_url, _sb_key) if (create_client and _sb_url and _sb_key) else None

def log_to_supabase(claim, result):
    """Silently save verification result to Supabase. Never raises."""
    if not supabase:
        return
    try:
        supabase.table("verifications").insert({
            "claim": claim[:1000],
            "verdict": result.get("verdict"),
            "confidence": result.get("confidence"),
            "sources_count": result.get("sources_count", 0),
            "explanation": result.get("explanation", "")[:2000],
        }).execute()
    except Exception:
        pass  # Never crash the app over logging

# ─── Expanded & Trusted Source Database ─────────────────────────────────
INDIAN_NEWS_SITES = [
    "ndtv.com", "thehindu.com", "hindustantimes.com", "indianexpress.com",
    "timesofindia.indiatimes.com", "livemint.com", "thequint.com",
    "scroll.in", "theprint.in", "news18.com", "indiatoday.in",
    "deccanherald.com", "telegraphindia.com", "economictimes.indiatimes.com",
    "business-standard.com", "pib.gov.in", "moneycontrol.com",
    "firstpost.com", "wionews.com", "thestatesman.com",
    "dnaindia.com", "outlookindia.com", "newslaundry.com",
    "thewire.in", "swarajyamag.com",
]

INTERNATIONAL_NEWS_SITES = [
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nytimes.com",
    "theguardian.com", "washingtonpost.com", "aljazeera.com", "france24.com",
    "dw.com", "cnn.com", "npr.org", "abc.net.au", "bloomberg.com",
    "forbes.com", "economist.com", "nature.com", "sciencedirect.com",
    "who.int", "un.org", "nasa.gov", "nih.gov", "cdc.gov",
    "time.com", "independent.co.uk", "sky.com", "nbcnews.com",
    "cbsnews.com", "abcnews.go.com", "usatoday.com",
    "scmp.com", "japantimes.co.jp", "straitstimes.com",
]

FACT_CHECK_SITES = [
    "factcheck.org", "snopes.com", "politifact.com", "altnews.in",
    "boomlive.in", "vishvasnews.com", "factly.in", "thip.media",
    "fullfact.org", "checkyourfact.com", "truthorfiction.com",
    "reuters.com/fact-check", "apnews.com/hub/ap-fact-check",
    "africacheck.org", "logically.ai", "leadstories.com",
    "misbar.com", "newschecker.in",
]

ALL_REPUTED = set(INDIAN_NEWS_SITES + INTERNATIONAL_NEWS_SITES + FACT_CHECK_SITES)


def classify_source(url):
    """Classify a URL into a source category."""
    try:
        domain = urlparse(url).netloc.lower().replace("www.", "")
    except Exception:
        return "General"

    for site in FACT_CHECK_SITES:
        if site in domain or site in url:
            return "Fact-Check"
    for site in INDIAN_NEWS_SITES:
        if site in domain:
            return "Indian News"
    for site in INTERNATIONAL_NEWS_SITES:
        if site in domain:
            return "International News"
    return "General"


def safe_search(query, max_results=8):
    """Run DuckDuckGo search with cascading fallback: text → news → retry."""
    results = []

    # Strategy 1: Text search (most reliable)
    for attempt in range(2):
        try:
            ddgs = DDGS()
            results = list(ddgs.text(query, max_results=max_results))
            if results:
                return [
                    {
                        "title": r.get("title", ""),
                        "body": r.get("body", ""),
                        "href": r.get("href", ""),
                        "url": r.get("href", ""),
                    }
                    for r in results
                ]
        except Exception as e:
            print(f"  Text search attempt {attempt+1} failed: {e}")
            time.sleep(1.2)

    # Strategy 2: News search
    try:
        ddgs = DDGS()
        results = list(ddgs.news(query, max_results=max_results))
        if results:
            return results
    except Exception as e:
        print(f"  News search failed: {e}")

    return []


# ─── PASS 1: Extract searchable queries from the claim ─────────────────
EXTRACT_PROMPT = """You are a search query extraction assistant. Given a news claim or headline, extract 3 different short search queries that would help verify whether this claim is true or false.

Rules:
- Each query should be 4-8 words, focused on the KEY FACTUAL CLAIM
- Remove opinions, adjectives, and emotional language
- Focus on WHO, WHAT, WHEN, WHERE — the verifiable facts
- Make queries diverse: rephrase the claim differently each time
- Keep queries simple and natural (like what someone would type into Google)

Respond with ONLY valid JSON:
{
  "queries": ["query 1", "query 2", "query 3"]
}"""


def extract_search_queries(claim):
    """Use LLM to extract smart, targeted search queries from the claim."""
    try:
        response = client.chat.completions.create(
            messages=[
                {"role": "system", "content": EXTRACT_PROMPT},
                {"role": "user", "content": claim},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        data = json.loads(response.choices[0].message.content)
        return data.get("queries", [claim])[:3]
    except Exception as e:
        print(f"Query extraction error: {e}")
        return [claim]


def search_all_sources(original_claim, extracted_queries):
    """
    Run multiple searches sequentially with de-duplication.
    Strategy: original -> extracted queries -> fact-check -> fallback
    """
    all_results = []
    seen_urls = set()

    def add_results(results, source_type="text"):
        added = 0
        for r in results:
            url = r.get("url") or r.get("href", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                normalized = {
                    "title": r.get("title", "No title"),
                    "body": r.get("body", r.get("description", "No snippet")),
                    "href": url,
                    "_category": classify_source(url),
                    "_source_type": source_type,
                }
                all_results.append(normalized)
                added += 1
        return added

    # ── Search 1: Original claim ──
    print(f"[Search 1] Original: {original_claim[:60]}...")
    results = safe_search(original_claim, max_results=10)
    count = add_results(results, "text")
    print(f"  -> {len(results)} found, {count} new")

    # ── Search 2-4: Extracted queries ──
    for i, query in enumerate(extracted_queries):
        print(f"[Search {2+i}] Query: {query}")
        time.sleep(0.5)
        results = safe_search(query, max_results=8)
        count = add_results(results, "text")
        print(f"  -> {len(results)} found, {count} new")

    # ── Search 5: Fact-check specific ──
    fact_query = f"{original_claim} fact check"
    print(f"[Search {2+len(extracted_queries)}] Fact-check: {fact_query[:60]}...")
    time.sleep(0.5)
    results = safe_search(fact_query, max_results=6)
    count = add_results(results, "fact-check")
    print(f"  -> {len(results)} found, {count} new")

    # ── Search 6: Site-specific searches for top sources ──
    if len(all_results) < 8:
        short_claim = " ".join(original_claim.split()[:5])
        for site in ["reuters.com", "bbc.com", "ndtv.com"]:
            site_query = f"site:{site} {short_claim}"
            print(f"[Search Extra] Site: {site_query[:60]}...")
            time.sleep(0.4)
            results = safe_search(site_query, max_results=3)
            add_results(results, "site-search")

    # ── Search 7: Fallback short query ──
    if len(all_results) < 5:
        words = original_claim.split()
        short = " ".join(words[:6]) if len(words) > 6 else original_claim
        print(f"[Search Fallback] Short: {short}")
        time.sleep(0.4)
        results = safe_search(short, max_results=8)
        add_results(results, "fallback")

    print(f"\n[OK] Total unique sources: {len(all_results)}")
    return all_results


def format_search_results(results):
    """Format search results for the LLM, sorted by reliability."""
    if not results:
        return "NO WEB SEARCH RESULTS WERE FOUND FOR THIS CLAIM."

    priority = {"Fact-Check": 0, "Indian News": 1, "International News": 2, "General": 3}
    results.sort(key=lambda r: priority.get(r.get("_category", "General"), 3))

    formatted = []
    for i, r in enumerate(results, 1):
        title = r.get("title", "No title")
        body = r.get("body", "No snippet")
        url = r.get("href", "")
        cat = r.get("_category", "General")
        formatted.append(f"[Source {i}] [{cat}] {title}\n{body}\nURL: {url}")

    return "\n\n".join(formatted)


# ─── PASS 2: Analyze with strict evidence-based rules ──────────────────
ANALYSIS_PROMPT = """You are a world-class fact-checker working for a major news verification agency. You must be EXTREMELY CAREFUL and ACCURATE in your verdicts.

You will receive:
1. A news claim submitted by a user.
2. Web search results from reputed sources (Indian news, international news, and fact-checking sites).

## YOUR DECISION FRAMEWORK (follow this strictly):

### Mark as REAL (when credible sources CONFIRM):
- Multiple reputed news outlets (Reuters, BBC, NDTV, The Hindu, etc.) report the same story
- Official sources (government, PIB, WHO, etc.) have confirmed it
- Fact-checking sites have verified it as true
- The core facts in the claim match what credible sources report
- Even if only 1-2 reputed sources report it, if the facts align, lean REAL

### Mark as FAKE (only when you have CONTRADICTING evidence):
- A fact-checking site has EXPLICITLY debunked this claim
- Multiple reputed sources DIRECTLY CONTRADICT the claim with different facts
- The claim contains specific details that are PROVABLY wrong based on sources
- IMPORTANT: Do NOT mark as FAKE just because you cannot find the exact news

### Mark as UNCERTAIN (when evidence is mixed or truly insufficient):
- You cannot find any evidence either way
- Sources discuss the topic but don't clearly confirm or deny the specific claim
- The news is too recent for sources to have covered it
- WHEN IN DOUBT, choose UNCERTAIN over FAKE

## CRITICAL RULES:
- NEVER mark real/true news as FAKE. This is the worst possible error.
- If search results DISCUSS the topic and generally SUPPORT the narrative, mark REAL.
- "I can't find this exact headline" does NOT mean it's fake.
- If search results show the topic is real and being discussed, that IS evidence it's real.
- Be GENEROUS when sources partially confirm a claim.
- Only use FAKE when you have CLEAR, DIRECT contradicting evidence.

## CONFIDENCE GUIDELINES:
- REAL with many supporting sources: 80-95%
- REAL with some supporting sources: 60-80%
- UNCERTAIN with no evidence: 30-50%
- UNCERTAIN with mixed evidence: 40-60%
- FAKE with clear debunking: 80-95%
- FAKE with some contradicting evidence: 60-80%

Respond in this JSON format ONLY:

{
  "verdict": "REAL" | "FAKE" | "UNCERTAIN",
  "confidence": <number from 0 to 100>,
  "explanation": "<3-5 sentences. MUST reference specific sources by name. Explain WHAT EVIDENCE you found. Be specific about which outlets reported this.>",
  "evidence_for": "<What evidence SUPPORTS the claim? List specific sources and what they say. If none, say 'No direct supporting evidence found in search results.'>",
  "evidence_against": "<What evidence CONTRADICTS the claim? List specific sources. If none, say 'No contradicting evidence found in search results.'>",
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"],
  "sources_used": ["<source 1>", "<source 2>"]
}"""


@app.route("/")
def index():
    """Serve the main page."""
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    """Two-pass analysis: extract queries → multi-strategy search → verdict."""
    data = request.get_json()
    news_text = data.get("text", "").strip()

    if not news_text:
        return jsonify({"error": "Please enter a news headline or paragraph to analyze."}), 400

    if len(news_text) < 10:
        return jsonify({"error": "Please enter a longer text (at least 10 characters) for better analysis."}), 400

    try:
        # ── PASS 1: Extract smart search queries ──
        print(f"\n{'='*60}")
        print(f"Analyzing: {news_text[:80]}...")
        print(f"{'='*60}")
        extracted_queries = extract_search_queries(news_text)
        all_queries = [news_text] + extracted_queries
        print(f"Extracted queries: {extracted_queries}")

        # ── SEARCH: Multi-strategy ──
        all_results = search_all_sources(news_text, extracted_queries)
        search_context = format_search_results(all_results)

        # Build raw sources for frontend
        raw_sources = []
        for r in all_results:
            raw_sources.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("href", ""),
                "category": r.get("_category", "General"),
            })

        # ── PASS 2: Evidence-based analysis ──
        user_message = (
            f"NEWS CLAIM TO ANALYZE:\n\"{news_text}\"\n\n"
            f"SEARCH QUERIES USED: {json.dumps(all_queries)}\n\n"
            f"WEB SEARCH RESULTS ({len(all_results)} sources found):\n{search_context}"
        )

        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": ANALYSIS_PROMPT},
                {"role": "user", "content": user_message},
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.1,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )

        response_text = chat_completion.choices[0].message.content
        result = json.loads(response_text)

        # Attach metadata
        result["web_sources"] = raw_sources
        result["search_queries"] = all_queries
        result["sources_count"] = len(raw_sources)

        category_counts = {}
        for s in raw_sources:
            cat = s["category"]
            category_counts[cat] = category_counts.get(cat, 0) + 1
        result["source_counts"] = category_counts

        print(f"\n=> Verdict: {result.get('verdict')} ({result.get('confidence')}%)")
        print(f"=> Sources: {len(raw_sources)} total | {category_counts}")

        # Log to Supabase (non-blocking, silent on failure)
        log_to_supabase(news_text, result)

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(debug=False, use_reloader=False, host="0.0.0.0", port=port)
