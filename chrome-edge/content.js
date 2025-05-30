// content.js

// --- Extension State Management ---
let extensionEnabled = true;
let copyStats = { copiedToday: 0, sitesVisited: new Set() };

// Load extension state
chrome.storage.sync.get(['extensionEnabled'], (result) => {
    extensionEnabled = result.extensionEnabled !== false;
    if (!extensionEnabled) {
        removeAllCopyButtons();
    }
});

// Listen for toggle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleExtension') {
        extensionEnabled = message.enabled;
        if (extensionEnabled) {
            processAllMath();
        } else {
            removeAllCopyButtons();
        }
        sendResponse({ success: true });
    }
});

// Function to remove all copy buttons
function removeAllCopyButtons() {
    document.querySelectorAll('.latex-copy-btn').forEach(btn => btn.remove());
    document.querySelectorAll('.latex-copy-attached').forEach(el => {
        el.classList.remove('latex-copy-attached');
    });
}

// Track stats
async function updateStats() {
    const today = new Date().toDateString();
    const hostname = window.location.hostname;
    
    // Update daily copy count
    const todayKey = `stats_${today}`;
    const result = await chrome.storage.local.get([todayKey, 'sitesVisited']);
    const todayCount = (result[todayKey] || 0) + 1;
    const sitesVisited = result.sitesVisited || {};
    sitesVisited[hostname] = true;
    
    await chrome.storage.local.set({
        [todayKey]: todayCount,
        sitesVisited: sitesVisited
    });
    
    // Notify popup if it's open
    try {
        chrome.runtime.sendMessage({
            action: 'updateStats',
            copiedToday: todayCount
        });
    } catch (e) {
        // Popup might not be open
    }
}

// --- Inject CSS for better integration ---
const style = document.createElement('style');
style.textContent = `
    .latex-copy-btn {
        font-feature-settings: "tnum";
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }
    
    .latex-copy-btn:focus {
        outline: 2px solid rgba(59, 130, 246, 0.5) !important;
        outline-offset: 2px !important;
    }
    
    .latex-copy-btn:active {
        transform: translateY(-1px) !important;
    }
    
    /* Ensure math containers can hold positioned buttons */
    .katex, .MathJax, .mjx-math, .mwe-math-element {
        position: relative !important;
    }
    
    /* Improve contrast on light backgrounds */
    @media (prefers-color-scheme: light) {
        .latex-copy-btn {
            background-color: rgba(0, 0, 0, 0.85) !important;
            border-color: rgba(0, 0, 0, 0.2) !important;
        }
        .latex-copy-btn:hover {
            background-color: rgba(0, 0, 0, 0.95) !important;
            border-color: rgba(0, 0, 0, 0.3) !important;
        }
    }
`;
document.head.appendChild(style);

// --- Utility: Validate LaTeX ---
function isValidLatex(latex) {
    if (!latex || typeof latex !== 'string') return false;
    latex = latex.trim();
    if (!latex) return false;
    if (/^[,\s\$"'`]*$/.test(latex)) return false;
    if (latex.length < 3) return false;
    if (!/[a-zA-Z0-9\\]/.test(latex)) return false;
    return true;
}

// --- Utility: Strip common LaTeX delimiters ---
function stripLatexDelimiters(latex) {
    if (!latex) return '';
    return latex
        .replace(/^\s*(\$\$|\\\[|\\\()\s*/, '')
        .replace(/\s*(\$\$|\\\]|\\\))\s*$/, '')
        .trim();
}

// --- Copy Button Creation ---
function createCopyButton(el, latex) {
    let existing = el.querySelector('.latex-copy-btn');
    if (existing) return; // Prevent duplicate

    const btn = document.createElement('button');
    btn.className = 'latex-copy-btn';
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy LaTeX Code</span>
    `;
    btn.title = 'Copy LaTeX equation';

    Object.assign(btn.style, {
        position: 'absolute',
        top: '6px',
        right: '6px',
        zIndex: '10000',
        opacity: '0',
        fontSize: '11px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontWeight: '500',
        padding: '6px 10px',
        borderRadius: '8px',
        backgroundColor: 'rgba(17, 17, 17, 0.95)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: 'translateY(-2px)',
        userSelect: 'none'
    });

    // Hover effects
    btn.onmouseenter = () => {
        Object.assign(btn.style, {
            backgroundColor: 'rgba(45, 45, 45, 0.98)',
            borderColor: 'rgba(255, 255, 255, 0.25)',
            transform: 'translateY(-3px)',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.5), 0 3px 6px rgba(0, 0, 0, 0.3)'
        });
    };

    btn.onmouseleave = () => {
        if (!btn.classList.contains('copied')) {
            Object.assign(btn.style, {
                backgroundColor: 'rgba(17, 17, 17, 0.95)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2)'
            });
        }
    };

    btn.onclick = e => {
        e.stopPropagation();
        e.preventDefault();
        
        // Check if extension is enabled
        if (!extensionEnabled) {
            return;
        }
        
        // Immediate visual feedback
        btn.classList.add('copied');
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"></polyline>
            </svg>
            <span>Copied LaTeX Code!</span>
        `;
        Object.assign(btn.style, {
            backgroundColor: 'rgba(34, 197, 94, 0.95)',
            borderColor: 'rgba(34, 197, 94, 0.4)',
            color: '#ffffff'
        });

        navigator.clipboard.writeText(latex).then(() => {
            // Update stats
            updateStats();
            
            // Reset after delay
            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>Copy LaTeX Code</span>
                `;
                Object.assign(btn.style, {
                    backgroundColor: 'rgba(17, 17, 17, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff'
                });
            }, 1500);
        }).catch(() => {
            // Error state
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span>Error</span>
            `;
            Object.assign(btn.style, {
                backgroundColor: 'rgba(239, 68, 68, 0.95)',
                borderColor: 'rgba(239, 68, 68, 0.4)'
            });
            setTimeout(() => btn.remove(), 2000);
        });
    };

    const style = window.getComputedStyle(el);
    if (style.position === 'static') {
        el.style.position = 'relative';
    }

    el.appendChild(btn);
    
    // Smooth fade-in animation
    requestAnimationFrame(() => {
        btn.style.opacity = '1';
    });
}

// --- Extract LaTeX from Element ---
function extractLatex(el) {
    const attrSources = [
        'data-latex', 'data-original', 'data-src-text', 'data-tex', 'data-math-formula', 'data-formula'
    ];

    const tryGet = (selector, prop = 'textContent') => {
        const target = el.querySelector && el.querySelector(selector);
        return target && target[prop] ? target[prop].trim() : '';
    };

    // Try annotations
    let raw = tryGet('annotation[encoding*="tex"]');
    if (isValidLatex(raw)) return raw;

    // Try script tag
    raw = tryGet('script[type^="math/tex"]');
    if (isValidLatex(raw)) return raw;

    // Try attributes
    for (let attr of attrSources) {
        raw = el.getAttribute(attr);
        if (isValidLatex(raw)) return raw.trim();
    }

    // Try image alt text
    raw = tryGet('img[alt]', 'alt');
    if (isValidLatex(raw)) return raw;

    // Try MathML
    raw = tryGet('math[alttext]', 'alttext');
    if (isValidLatex(raw)) return raw;

    // Fallback to visible inner text
    raw = el.innerText?.trim();
    if (isValidLatex(raw)) return raw;

    return '';
}

// --- Extract from Page Source ---
let pageLatexSource = [];
function extractLatexFromPageSource() {
    try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', window.location.href, false);
        xhr.send(null);
        if (xhr.status === 200) {
            const matches = xhr.responseText.match(/\$\$([\s\S]*?)\$\$/g);
            if (matches) {
                pageLatexSource = matches.map(m => m.replace(/^\$\$|\$\$$/g, '').trim()).filter(isValidLatex);
            }
        }
    } catch (e) {
        pageLatexSource = [];
    }
}

function findBestLatexFromSource(text) {
    if (!text || !pageLatexSource.length) return '';
    const norm = s => s.replace(/\s+/g, '').replace(/[⁡\u200B-\u200D\uFEFF]/g, '').toLowerCase();
    const tnorm = norm(text);
    let best = '', score = 0;

    for (let src of pageLatexSource) {
        const snorm = norm(src);
        let shared = 0;
        for (let c of tnorm) if (snorm.includes(c)) shared++;
        const similarity = shared / ((tnorm.length + snorm.length) / 2);
        if (similarity > 0.5 && snorm.length > 10 && similarity > score) {
            best = src;
            score = similarity;
        }
    }
    return best;
}

// --- Main Logic ---
function processAllMath() {
    // Don't process if extension is disabled
    if (!extensionEnabled) {
        return;
    }
    
    const selectors = [
        '.katex', '.MathJax', '.MathJax_Display', '.MathJax_Preview',
        'math', 'script[type^="math/tex"]', '.mjx-math', '.mjx-chtml', '.mjx-mrow',
        '[data-latex]', '[data-math-formula]', '[data-original]', '[data-src-text]',
        '.mwe-math-element', '.mwe-math-mathml-a11y', '.mwe-math-mathml-inline',
        '.mwe-math-fallback-image-inline', '.mwe-math-fallback-image-display',
        'svg[data-tex]', 'img[alt]', 'math[alttext]'
    ];

    document.querySelectorAll(selectors.join(',')).forEach(el => {
        // Avoid duplicate processing
        if (el.classList.contains('latex-copy-attached')) return;

        // Avoid nested math elements (e.g., a child of .katex inside another .katex)
        if (el.closest('.latex-copy-attached')) return;

        el.classList.add('latex-copy-attached');
        
        el.addEventListener('mouseenter', () => {
            // Check if extension is still enabled
            if (!extensionEnabled) return;
            
            let visibleText = el.innerText?.trim();
            let latex = findBestLatexFromSource(visibleText);
            if (!isValidLatex(latex)) {
                latex = extractLatex(el);
            }

            if (isValidLatex(latex)) {
                latex = stripLatexDelimiters(latex);
                latex = `$$${latex}$$`;
                createCopyButton(el, latex);
            }
        });

        el.addEventListener('mouseleave', () => {
            const btn = el.querySelector('.latex-copy-btn');
            if (btn && !btn.matches(':hover') && !btn.classList.contains('copied')) {
                // Smooth fade-out
                btn.style.opacity = '0';
                btn.style.transform = 'translateY(0px)';
                setTimeout(() => {
                    if (btn.parentNode && !btn.matches(':hover')) {
                        btn.remove();
                    }
                }, 200);
            }
        });
    });
}


// --- Initialize ---
extractLatexFromPageSource();
processAllMath();
setTimeout(processAllMath, 500);

// --- Observe Dynamic Changes ---
const observer = new MutationObserver(() => processAllMath());
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
});
