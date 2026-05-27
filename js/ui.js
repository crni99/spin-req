function generateToken() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

let toastTimeout;
function toast(msg, type = '') {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show ' + type;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { el.className = ''; }, 3000);
}

function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function openCreateModal() {
    document.getElementById('modal-create').classList.add('open');
}

function closeCreateModal() {
    document.getElementById('modal-create').classList.remove('open');
}

function showCreateError(msg) {
    const el = document.getElementById('create-error');
    el.textContent = msg;
    el.style.display = 'block';
}

function startTimer(elId, party) {
    clearInterval(timerInterval);
    const el = document.getElementById(elId);
    const isDjTimer = elId === 'dj-timer';

    function tick() {
        if (!currentParty) return;
        const now = Date.now();
        const end = currentParty.end_timestamp;
        const diff = end - now;

        if (currentParty.ended || diff <= 0) {
            el.textContent = 'ENDED';
            el.className = 'timer-badge ended';
            clearInterval(timerInterval);
            if (isDjTimer && !currentParty.ended) {
                supabaseClient
                    .from('parties')
                    .update({ ended: true })
                    .eq('id', currentParty.id)
                    .then(() => { currentParty.ended = true; });
            }
            return;
        }

        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent = [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
        el.className = 'timer-badge' + (diff < 5 * 60000 ? ' warning' : '');
    }

    tick();
    timerInterval = setInterval(tick, 1000);
}

function genId() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function buildUrl(partyId, isDj, token = null) {
    const base = window.location.origin + window.location.pathname;
    let url = base + '?p=' + partyId;
    if (isDj && token) url += '&dj=1&token=' + token;
    return url;
}

function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function timeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 60) return diff + 's ago';
    if (diff < 3600) return Math.floor(diff / 60) + 'min ago';
    return Math.floor(diff / 3600) + 'h ago';
}

async function getIpHash() {
    const raw = navigator.userAgent + Intl.DateTimeFormat().resolvedOptions().timeZone + window.screen.width;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('');
}