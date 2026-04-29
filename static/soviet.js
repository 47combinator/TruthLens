/**
 * TruthLens — Frontend Logic v5.0
 * Animated counters, loading progress, particles, and dynamic results.
 */

// --- DOM Elements ---
const newsInput = document.getElementById('newsInput');
const charCount = document.getElementById('charCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const errorSection = document.getElementById('errorSection');
const samplesSection = document.getElementById('samplesSection');
const cursorGlow = document.getElementById('cursorGlow');
const navbar = document.getElementById('navbar');

// --- Escape HTML to prevent XSS ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Particles disabled for stable design ---

// --- Cursor Glow Effect ---
let cursorX = 0, cursorY = 0, glowX = 0, glowY = 0;

document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
});

function animateCursor() {
    glowX += (cursorX - glowX) * 0.08;
    glowY += (cursorY - glowY) * 0.08;
    if (cursorGlow) {
        cursorGlow.style.left = glowX + 'px';
        cursorGlow.style.top = glowY + 'px';
    }
    requestAnimationFrame(animateCursor);
}
animateCursor();

// --- Navbar scroll effect ---
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    if (scrollTop > 60) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
    lastScroll = scrollTop;
}, { passive: true });

// --- Scroll Reveal (IntersectionObserver) ---
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px'
});

document.querySelectorAll('.reveal-up').forEach(el => {
    revealObserver.observe(el);
});

// --- Character Count ---
newsInput.addEventListener('input', () => {
    const len = newsInput.value.length;
    charCount.textContent = `${len} / 2000`;
    if (len > 0) {
        charCount.classList.add('has-text');
    } else {
        charCount.classList.remove('has-text');
    }
});

// --- Fill sample text ---
function fillSample(chip) {
    const textEl = chip.querySelector('.sample-text');
    newsInput.value = textEl ? textEl.textContent.trim() : chip.textContent.trim();
    newsInput.dispatchEvent(new Event('input'));
    newsInput.focus();
    document.getElementById('inputSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Loading Progress Animation ---
let loadingInterval = null;

function startLoadingProgress() {
    const steps = ['step1', 'step2', 'step3'];
    let current = 0;

    // Reset all steps
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('active', 'done');
        }
    });

    // Activate first step
    const first = document.getElementById(steps[0]);
    if (first) first.classList.add('active');

    loadingInterval = setInterval(() => {
        current++;
        if (current >= steps.length) {
            clearInterval(loadingInterval);
            return;
        }

        // Mark previous as done
        const prev = document.getElementById(steps[current - 1]);
        if (prev) {
            prev.classList.remove('active');
            prev.classList.add('done');
        }

        // Activate current
        const curr = document.getElementById(steps[current]);
        if (curr) curr.classList.add('active');
    }, 3000);
}

function stopLoadingProgress() {
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
}

// --- Animated Counter ---
function animateCounter(element, target, duration = 1200) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
        const current = Math.round(start + (target - start) * eased);
        element.textContent = current;
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
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
    startLoadingProgress();

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
        stopLoadingProgress();
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
        verdictIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else if (verdict === 'FAKE') {
        verdictIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
        verdictIcon.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    }

    // Set verdict text
    document.getElementById('verdictText').textContent =
        verdict === 'REAL' ? 'Likely Real' :
            verdict === 'FAKE' ? 'Likely Fake' :
                'Uncertain';

    // Set confidence with animated counter
    const confEl = document.getElementById('confidenceValue');
    confEl.textContent = '0%';
    setTimeout(() => {
        animateCounter(confEl, confidence, 1400);
        // Add % after animation
        setTimeout(() => {
            confEl.textContent = confidence + '%';
        }, 1500);
    }, 300);

    // Animate confidence ring
    const ringFill = document.getElementById('ringFill');
    const circumference = 2 * Math.PI * 35;
    const offset = circumference - (confidence / 100) * circumference;
    ringFill.style.strokeDasharray = circumference;
    ringFill.style.strokeDashoffset = circumference;

    requestAnimationFrame(() => {
        setTimeout(() => {
            ringFill.style.strokeDashoffset = offset;
        }, 200);
    });

    // Stats bar with animated counters
    const webSources = data.web_sources || [];
    const searchQueries = data.search_queries || [];
    const sourceCounts = data.source_counts || {};

    setTimeout(() => {
        animateCounter(document.getElementById('statSources'), webSources.length, 1000);
        animateCounter(document.getElementById('statQueries'), searchQueries.length, 1000);
        animateCounter(document.getElementById('statCategories'), Object.keys(sourceCounts).length, 800);
    }, 400);

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
    const queriesBlock = document.getElementById('queriesBlock');
    const queriesList = document.getElementById('queriesList');
    queriesList.innerHTML = '';

    if (searchQueries.length > 0) {
        queriesBlock.style.display = 'block';
        searchQueries.forEach((q, i) => {
            const chip = document.createElement('span');
            chip.className = 'query-chip';
            chip.style.animationDelay = (i * 0.08) + 's';
            chip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> ${escapeHtml(q)}`;
            queriesList.appendChild(chip);
        });
    } else {
        queriesBlock.style.display = 'none';
    }

    // Set tips
    const tipsList = document.getElementById('tipsList');
    tipsList.innerHTML = '';
    tips.forEach((tip, i) => {
        const li = document.createElement('li');
        li.style.animationDelay = (i * 0.1) + 's';
        li.textContent = tip;
        tipsList.appendChild(li);
    });

    // Set web sources with categories
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

        // Render each source (show first 5, rest collapsed)
        const maxVisible = 5;
        webSources.forEach((source, idx) => {
            const a = document.createElement('a');
            a.className = 'source-item';
            if (idx >= maxVisible) a.classList.add('source-hidden');
            a.href = source.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.animationDelay = (idx * 0.06) + 's';

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

        // Update toggle text
        const toggle = document.getElementById('sourcesToggle');
        if (webSources.length > maxVisible) {
            toggle.style.display = 'inline';
            toggle.textContent = `Show All (${webSources.length}) ▾`;
            toggle.dataset.expanded = 'false';
        } else {
            toggle.style.display = 'none';
        }

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

// --- Toggle Sources ---
function toggleSources() {
    const toggle = document.getElementById('sourcesToggle');
    const hidden = document.querySelectorAll('.source-hidden');
    const expanded = toggle.dataset.expanded === 'true';

    if (expanded) {
        hidden.forEach(el => el.style.display = 'none');
        toggle.textContent = `Show All (${hidden.length + 5}) ▾`;
        toggle.dataset.expanded = 'false';
    } else {
        hidden.forEach(el => el.style.display = 'block');
        toggle.textContent = 'Show Less ▴';
        toggle.dataset.expanded = 'true';
    }
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
    charCount.classList.remove('has-text');
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

// --- Card tilt and cursor glow disabled for stable design ---
// No floating elements, no moving cards. Bold and stable.
