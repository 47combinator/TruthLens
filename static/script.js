/**
 * TruthLens — Frontend Logic
 * Handles user input, API calls, and result rendering.
 */

// --- DOM Elements ---
const newsInput = document.getElementById('newsInput');
const charCount = document.getElementById('charCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const samplesSection = document.getElementById('samplesSection');

// --- Escape HTML to prevent XSS ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Character Count ---
newsInput.addEventListener('input', () => {
    const len = newsInput.value.length;
    charCount.textContent = `${len} / 2000`;
});

// --- Fill sample text ---
function fillSample(chip) {
    newsInput.value = chip.textContent.trim();
    newsInput.dispatchEvent(new Event('input'));
    newsInput.focus();
    // Scroll to input
    document.getElementById('inputSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Analyze News ---
async function analyzeNews() {
    const text = newsInput.value.trim();

    if (!text) {
        showError('Please enter a news headline or paragraph to analyze.');
        return;
    }

    if (text.length < 10) {
        showError('Please enter a longer text (at least 10 characters) for accurate analysis.');
        return;
    }

    // Show loading state
    analyzeBtn.classList.add('loading');
    analyzeBtn.disabled = true;
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';

    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        const data = await response.json();

        if (!response.ok) {
            showError(data.error || 'Something went wrong. Please try again.');
            return;
        }

        displayResults(data);
    } catch (err) {
        showError('Network error. Please check your connection and try again.');
    } finally {
        analyzeBtn.classList.remove('loading');
        analyzeBtn.disabled = false;
    }
}

// --- Display Results ---
function displayResults(data) {
    const verdict = (data.verdict || 'UNCERTAIN').toUpperCase();
    const confidence = data.confidence || 0;
    const explanation = data.explanation || 'No explanation provided.';
    const tips = data.tips || [];

    // Set verdict banner class
    const verdictBanner = document.getElementById('verdictBanner');
    verdictBanner.className = 'verdict-banner';
    if (verdict === 'REAL') {
        verdictBanner.classList.add('verdict-real');
    } else if (verdict === 'FAKE') {
        verdictBanner.classList.add('verdict-fake');
    } else {
        verdictBanner.classList.add('verdict-uncertain');
    }

    // Set verdict icon
    const verdictIcon = document.getElementById('verdictIcon');
    if (verdict === 'REAL') {
        verdictIcon.innerHTML = '✅';
    } else if (verdict === 'FAKE') {
        verdictIcon.innerHTML = '🚫';
    } else {
        verdictIcon.innerHTML = '⚠️';
    }

    // Set verdict text
    document.getElementById('verdictText').textContent =
        verdict === 'REAL' ? 'Likely Real' :
            verdict === 'FAKE' ? 'Likely Fake' :
                'Uncertain';

    // Set confidence
    document.getElementById('confidenceValue').textContent = `${confidence}%`;

    // Animate confidence ring
    const ringFill = document.getElementById('ringFill');
    const circumference = 2 * Math.PI * 35; // r=35
    const offset = circumference - (confidence / 100) * circumference;
    ringFill.style.strokeDasharray = circumference;
    ringFill.style.strokeDashoffset = circumference;

    // Trigger animation after a small delay
    requestAnimationFrame(() => {
        setTimeout(() => {
            ringFill.style.strokeDashoffset = offset;
        }, 100);
    });

    // Set explanation
    document.getElementById('explanationText').textContent = explanation;

    // Set evidence for/against
    const evidenceFor = data.evidence_for || '';
    const evidenceAgainst = data.evidence_against || '';
    const evidenceBlock = document.getElementById('evidenceBlock');

    if (evidenceFor || evidenceAgainst) {
        evidenceBlock.style.display = 'block';
        document.getElementById('evidenceForText').textContent = evidenceFor || 'No supporting evidence found in search results.';
        document.getElementById('evidenceAgainstText').textContent = evidenceAgainst || 'No contradicting evidence found in search results.';
    } else {
        evidenceBlock.style.display = 'none';
    }

    // Set search queries used
    const searchQueries = data.search_queries || [];
    const queriesBlock = document.getElementById('queriesBlock');
    const queriesList = document.getElementById('queriesList');
    queriesList.innerHTML = '';

    if (searchQueries.length > 0) {
        queriesBlock.style.display = 'block';
        searchQueries.forEach(q => {
            const chip = document.createElement('span');
            chip.className = 'query-chip';
            chip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> ${escapeHtml(q)}`;
            queriesList.appendChild(chip);
        });
    } else {
        queriesBlock.style.display = 'none';
    }

    // Set tips
    const tipsList = document.getElementById('tipsList');
    tipsList.innerHTML = '';
    tips.forEach(tip => {
        const li = document.createElement('li');
        li.textContent = tip;
        tipsList.appendChild(li);
    });

    // Set web sources with categories
    const webSources = data.web_sources || [];
    const sourceCounts = data.source_counts || {};
    const sourcesBlock = document.getElementById('sourcesBlock');
    const sourcesList = document.getElementById('sourcesList');
    sourcesList.innerHTML = '';

    if (webSources.length > 0) {
        sourcesBlock.style.display = 'block';

        // Source category summary bar
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'sources-summary';
        const categoryConfig = {
            'Indian News': { emoji: '🇮🇳', cssClass: 'cat-indian' },
            'International News': { emoji: '🌍', cssClass: 'cat-international' },
            'Fact-Check': { emoji: '✓', cssClass: 'cat-factcheck' },
            'General': { emoji: '🔗', cssClass: 'cat-general' },
        };
        for (const [cat, count] of Object.entries(sourceCounts)) {
            const cfg = categoryConfig[cat] || categoryConfig['General'];
            const badge = document.createElement('span');
            badge.className = `summary-badge ${cfg.cssClass}`;
            badge.innerHTML = `${cfg.emoji} ${count} ${cat}`;
            summaryDiv.appendChild(badge);
        }
        sourcesList.appendChild(summaryDiv);

        // Render each source
        webSources.forEach(source => {
            const a = document.createElement('a');
            a.className = 'source-item';
            a.href = source.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';

            const cat = source.category || 'General';
            const cfg = categoryConfig[cat] || categoryConfig['General'];

            a.innerHTML = `
                <div class="source-header-row">
                    <span class="source-category-tag ${cfg.cssClass}">${cfg.emoji} ${escapeHtml(cat)}</span>
                </div>
                <div class="source-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    ${escapeHtml(source.title)}
                </div>
                <div class="source-snippet">${escapeHtml(source.snippet)}</div>
                <span class="source-url">${escapeHtml(source.url)}</span>
            `;
            sourcesList.appendChild(a);
        });

        const countEl = document.createElement('p');
        countEl.className = 'sources-count';
        countEl.textContent = `${webSources.length} sources found across reputed Indian, international, and fact-checking websites`;
        sourcesList.appendChild(countEl);
    } else {
        sourcesBlock.style.display = 'none';
    }

    // Show results
    resultsSection.style.display = 'block';
    errorSection.style.display = 'none';

    // Scroll to results
    setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
}

// --- Show Error ---
function showError(message) {
    document.getElementById('errorText').textContent = message;
    errorSection.style.display = 'block';
    resultsSection.style.display = 'none';
    errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Reset Form ---
function resetForm() {
    newsInput.value = '';
    charCount.textContent = '0 / 2000';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    newsInput.focus();
    document.getElementById('inputSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Allow Ctrl+Enter to submit ---
newsInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        analyzeNews();
    }
});
