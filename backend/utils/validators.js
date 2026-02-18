
// ================= LANGUAGE VALIDATION (client-side) =================

// List of allowed programming languages / popular frameworks (case-insensitive)
const ALLOWED_LANGUAGES = new Set([
    'html', 'css', 'javascript', 'java', 'python', 'c', 'c++', 'c#', 'php', 'sql', 'typescript',
    'ruby', 'go', 'rust', 'kotlin', 'swift', 'r', 'matlab', 'scala', 'perl', 'dart', 'lua',
    'bash', 'shell', 'powershell',
    // Popular libraries/frameworks / runtimes included intentionally
    'react', 'vue', 'angular', 'svelte', 'node.js', 'node', 'express', 'next.js', 'nuxt', 'django', 'flask', 'asp.net',
    'graphql'
].map(s => s.toLowerCase()));

// Simple alias map for common shortnames
const LANGUAGE_ALIASES = {
    'js': 'javascript',
    'ts': 'typescript',
    'nodejs': 'node.js',
    'csharp': 'c#',
    'cpp': 'c++',
    'py': 'python',
    'html5': 'html'
};

export function splitSkills(skillString) {
    if (!skillString) return [];
    return skillString.split(',').map(s => s.trim()).filter(Boolean);
}

export function normalizeLang(input) {
    if (!input) return '';
    return input.trim().toLowerCase();
}

export function isValidLanguage(input) {
    const n = normalizeLang(input);
    if (!n) return false;
    if (ALLOWED_LANGUAGES.has(n)) return true;
    if (LANGUAGE_ALIASES[n] && ALLOWED_LANGUAGES.has(LANGUAGE_ALIASES[n])) return true;
    return false;
}

// UI helpers: attach an error message element next to a field and toggle messages
function ensureFieldErrorEl(field) {
    if (!field) return null;
    let el = field.nextElementSibling;
    if (el && el.classList && el.classList.contains('field-error')) return el;
    // create error element
    el = document.createElement('div');
    el.className = 'field-error text-red-400 text-sm mt-1';
    field.parentNode.insertBefore(el, field.nextSibling);
    return el;
}

export function validateFieldAndShow(field) {
    if (!field) return false;
    const val = field.value || '';
    const msgEl = ensureFieldErrorEl(field);
    if (!val) {
        if (msgEl) msgEl.textContent = '';
        field.classList.remove('border-red-500');
        return false;
    }
    if (isValidLanguage(val)) {
        if (msgEl) msgEl.textContent = '';
        field.classList.remove('border-red-500');
        return true;
    } else {
        if (msgEl) msgEl.textContent = 'Please enter a valid programming language.';
        field.classList.add('border-red-500');
        return false;
    }
}

// Attach realtime validation to a field by id
export function attachLanguageValidationToField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    // validate while typing
    field.addEventListener('input', () => validateFieldAndShow(field));
    // validate on blur as well
    field.addEventListener('blur', () => validateFieldAndShow(field));
    // create the error element now (so layout doesn't jump)
    ensureFieldErrorEl(field);
}
