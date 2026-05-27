async function loadGuestView(partyId) {
    const { data: party, error } = await supabaseClient
        .from('parties').select('*').eq('id', partyId).single();
    if (error || !party) { toast('Party not found!', 'error'); return; }

    currentParty = party;
    showPage('page-guest');

    document.getElementById('guest-party-name').textContent = party.name;
    document.getElementById('guest-dj-name').textContent =
        party.dj_name ? '🎧 ' + party.dj_name : '';

    if (party.ended || Date.now() > party.end_timestamp) {
        showGuestEnded();
    } else {
        startTimer('guest-timer', party);
    }

    await refreshGuestView();
    subscribeRealtime(partyId, 'guest');
    setTimeout(() => {
        const target = party.ended || Date.now() > party.end_timestamp
            ? document.getElementById('guest-ended-banner')
            : document.getElementById('guest-req-form');
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

async function refreshGuestView() {
    if (!currentParty) return;

    const ipHash = await getIpHash();
    const { count } = await supabaseClient
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('party_id', currentParty.id)
        .eq('ip_hash', ipHash);

    updateQuota(count || 0);

    const { data } = await supabaseClient
        .from('requests').select('*')
        .eq('party_id', currentParty.id)
        .eq('status', 'accepted')
        .order('sort_order', { ascending: true });

    renderGuestAccepted(data || []);
}

function renderGuestAccepted(list) {
    document.getElementById('guest-accepted-count').textContent = list.length;
    const el = document.getElementById('guest-accepted-list');

    if (list.length === 0) {
        el.innerHTML = '<div class="empty"><div class="empty-icon">🎵</div>No songs accepted yet</div>';
        return;
    }

    const newSignature = list.map(r => r.id + ':' + r.sort_order).join(',');
    if (el.dataset.signature === newSignature) return;
    el.dataset.signature = newSignature;

    el.innerHTML = list.map((p, i) => `
        <div class="req-card">
            <div class="req-number">${i + 1}</div>
            <div class="req-info">
                <div class="req-song">${esc(p.song)}</div>
                <div class="req-meta">${timeAgo(p.created_at)}</div>
            </div>
            <span class="chip accepted">Accepted</span>
        </div>
    `).join('');
}

async function sendRequest() {
    if (!currentParty) return;
    const song = document.getElementById('inp-song').value.trim();
    if (!song) { toast('Enter the song title!', 'error'); return; }

    if (currentParty.ended || Date.now() > currentParty.end_timestamp) {
        toast('The party is over!', 'error'); return;
    }

    const btn = document.getElementById('btn-send');
    btn.disabled = true;
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';

    const ipHash = await getIpHash();
    const { count } = await supabaseClient
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('party_id', currentParty.id)
        .eq('ip_hash', ipHash);

    if ((count || 0) >= 3) {
        toast('You have used all 3 requests!', 'error');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return;
    }

    const { error } = await supabaseClient.from('requests').insert({
        party_id: currentParty.id,
        song,
        ip_hash: ipHash,
        status: 'pending'
    });

    btn.disabled = false;
    btn.innerHTML = originalHtml;

    if (error) { toast('Error: ' + error.message, 'error'); return; }

    document.getElementById('inp-song').value = '';
    toast('Request sent! ✓', 'success');
    await refreshGuestView();
}

function updateQuota(used) {
    const remaining = 3 - used;
    document.getElementById('quota-text').textContent =
        remaining > 0 ? `${remaining} request${remaining === 1 ? '' : 's'} remaining` : 'No requests left.';

    for (let i = 1; i <= 3; i++) {
        document.getElementById('dot-' + i).className = 'quota-dot' + (i <= used ? ' used' : '');
    }

    if (remaining === 0) {
        document.getElementById('btn-send').disabled = true;
        document.getElementById('inp-song').disabled = true;
    }
}

function showGuestEnded() {
    document.getElementById('guest-ended-banner').style.display = 'block';
    document.getElementById('guest-req-form').style.display = 'none';
    document.getElementById('guest-timer').textContent = 'ENDED';
    document.getElementById('guest-timer').className = 'timer-badge ended';
    const liveDot = document.querySelector('.live-dot');
    if (liveDot) liveDot.style.background = 'var(--danger)';
    const liveText = liveDot?.nextSibling;
    if (liveText) liveText.textContent = ' The party is over';
}