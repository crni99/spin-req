async function createParty() {
    const name = document.getElementById('inp-name').value.trim();
    const djName = document.getElementById('inp-dj').value.trim();
    const duration = parseInt(document.getElementById('inp-duration').value);

    const top1 = document.getElementById('inp-top1').value.trim();
    const top2 = document.getElementById('inp-top2').value.trim();
    const top3 = document.getElementById('inp-top3').value.trim();

    if (!name) { showCreateError('Enter the name of the party!'); return; }

    const btn = document.getElementById('btn-create');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating...';

    const id = genId();
    const djToken = generateToken();
    const endTs = Date.now() + duration * 60 * 1000;

    const { error } = await supabaseClient.from('parties').insert({
        id, name, dj_name: djName || null,
        duration_min: duration,
        end_timestamp: endTs,
        ended: false,
        dj_token: djToken,
        top_song_1: top1 || null,
        top_song_2: top2 || null,
        top_song_3: top3 || null
    });

    btn.disabled = false;
    btn.innerHTML = '🎉 Create party';

    if (error) {
        showCreateError('Error: ' + error.message);
        return;
    }

    saveDjToken(id, djToken);
    closeCreateModal();
    const djUrl = buildUrl(id, true, djToken);
    history.pushState({}, '', djUrl);
    loadDjView(id);
}

async function loadDjView(partyId) {
    try {
        const { data: party, error } = await supabaseClient
            .from('parties').select('*').eq('id', partyId).single();
        if (error || !party) { toast('Party not found!', 'error'); return; }

        const urlToken = new URLSearchParams(window.location.search).get('token')
            || getDjToken(partyId);
        if (!urlToken || party.dj_token !== urlToken) {
            toast('Access denied!', 'error');
            showPage('page-landing');
            return;
        }

        saveDjToken(partyId, urlToken);
        currentParty = party;
        showPage('page-dj');

        const guestUrl = buildUrl(partyId, false);
        document.getElementById('dj-link-url').textContent = guestUrl;

        startTimer('dj-timer', party);
        await refreshDjLists();
        subscribeRealtime(partyId, 'dj');
        setTimeout(() => {
            document.querySelector('#page-dj .dj-layout')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
    } catch (err) {
        toast('Failed to load DJ view', 'error');
        console.error('loadDjView:', err);
    }
}

async function refreshDjLists() {
    if (!currentParty) return;
    try {
        const { data, error } = await supabaseClient
            .from('requests').select('*').eq('party_id', currentParty.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        allRequests = data;
        renderDjLists(data);
    } catch (err) {
        toast('Failed to load requests', 'error');
        console.error('refreshDjLists:', err);
    }
}

let activePlaylistTab = 'accepted';

function renderDjLists(requests) {
    const pending = requests.filter(p => p.status === 'pending');
    const accepted = requests.filter(p => p.status === 'accepted')
        .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    const rejected = requests.filter(p => p.status === 'rejected')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    document.getElementById('dj-pending-count').textContent = pending.length + ' waiting';
    document.getElementById('dj-decided-count').textContent =
        accepted.length + ' accepted · ' + rejected.length + ' rejected';

    const pList = document.getElementById('dj-pending-list');
    if (pending.length === 0) {
        pList.innerHTML = '<div class="empty"><div class="empty-icon">🎵</div>No requests yet</div>';
    } else {
        pList.innerHTML = pending.map((p, i) => `
            <div class="req-card req-card--pending" id="req-${p.id}" data-id="${p.id}">
                <div class="req-info">
                    <div class="req-song">${esc(p.song)}</div>
                    <div class="req-meta">${timeAgo(p.created_at)}</div>
                </div>
                <div class="req-actions">
                    <button class="btn-accept" onclick="decide(${p.id}, 'accepted')">✓ Yes</button>
                    <button class="btn-reject" onclick="decide(${p.id}, 'rejected')">✗ No</button>
                </div>
            </div>
        `).join('');
    }

    const dList = document.getElementById('dj-decided-list');
    dList.innerHTML = `
        <div class="playlist-tabs">
            <button class="tab-btn tab-accepted ${activePlaylistTab === 'accepted' ? 'active' : ''}"
                onclick="switchPlaylistTab('accepted')">
                ✓ Accepted <span class="tab-count">${accepted.length}</span>
            </button>
            <button class="tab-btn tab-rejected ${activePlaylistTab === 'rejected' ? 'active' : ''}"
                onclick="switchPlaylistTab('rejected')">
                ✗ Rejected <span class="tab-count">${rejected.length}</span>
            </button>
        </div>
        <div id="tab-accepted" class="${activePlaylistTab === 'accepted' ? '' : 'tab-hidden'}">
            ${accepted.length === 0
            ? '<div class="empty"><div class="empty-icon">📋</div>No accepted songs yet</div>'
            : `<div class="drag-list" id="drag-list">${accepted.map((p, i) => `
                    <div class="req-card draggable" draggable="true" data-id="${p.id}" data-order="${p.sort_order || i}">
                        <div class="drag-handle">⠿</div>
                        <div class="req-info">
                            <div class="req-song">${esc(p.song)}</div>
                            <div class="req-meta">${timeAgo(p.created_at)}</div>
                        </div>
                    </div>
                `).join('')}</div>`
        }
        </div>
        <div id="tab-rejected" class="${activePlaylistTab === 'rejected' ? '' : 'tab-hidden'}">
            ${rejected.length === 0
            ? '<div class="empty"><div class="empty-icon">🚫</div>No rejected songs yet</div>'
            : rejected.map((p, i) => `
                    <div class="req-card">
                        <div class="req-info">
                            <div class="req-song">${esc(p.song)}</div>
                            <div class="req-meta">${timeAgo(p.created_at)}</div>
                        </div>
                    </div>
                `).join('')
        }
        </div>
    `;

    if (activePlaylistTab === 'accepted' && accepted.length > 0) {
        initDragDrop();
    }
}

function switchPlaylistTab(tab) {
    activePlaylistTab = tab;
    renderDjLists(allRequests);
}

function initDragDrop() {
    const list = document.getElementById('drag-list');
    if (!list) return;

    let draggedEl = null;

    list.querySelectorAll('.draggable').forEach(card => {
        card.addEventListener('dragstart', e => {
            draggedEl = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            saveSortOrder();
        });

        card.addEventListener('dragover', e => {
            e.preventDefault();
            if (card === draggedEl) return;
            const rect = card.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            list.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            card.classList.add('drag-over');
            if (e.clientY < mid) {
                list.insertBefore(draggedEl, card);
            } else {
                list.insertBefore(draggedEl, card.nextSibling);
            }
        });
    });
}

async function saveSortOrder() {
    const list = document.getElementById('drag-list');
    if (!list) return;
    try {
        const updates = [...list.querySelectorAll('.draggable')].map((card, i) => ({
            id: parseInt(card.dataset.id),
            sort_order: i
        }));
        const { error } = await supabaseClient.rpc('update_sort_orders', { updates });
        if (error) throw error;
        await refreshDjLists();
    } catch (err) {
        toast('Error saving order', 'error');
        console.error('saveSortOrder:', err);
    }
}

async function decide(requestId, status) {
    try {
        let updateData = { status };
        if (status === 'accepted') {
            const accepted = allRequests.filter(r => r.status === 'accepted');
            updateData.sort_order = accepted.length;
        }
        const { error } = await supabaseClient
            .from('requests').update(updateData).eq('id', requestId);
        if (error) throw error;
        await refreshDjLists();
    } catch (err) {
        toast('Failed to update request', 'error');
        console.error('decide:', err);
    }
}

async function extendParty() {
    if (!currentParty) return;
    try {
        const newEnd = currentParty.end_timestamp + 30 * 60 * 1000;
        const { data, error } = await supabaseClient
            .from('parties').update({ end_timestamp: newEnd })
            .eq('id', currentParty.id).select().single();
        if (error) throw error;
        currentParty = data;
        startTimer('dj-timer', data);
        toast('+30 minutes added ✓', 'success');
    } catch (err) {
        toast('Failed to extend party', 'error');
        console.error('extendParty:', err);
    }
}

async function endParty() {
    if (!currentParty) return;
    if (!confirm('End the party? This cannot be undone.')) return;
    try {
        const { error } = await supabaseClient
            .from('parties').update({ ended: true }).eq('id', currentParty.id);
        if (error) throw error;
        currentParty.ended = true;
        showDjEnded();
        toast('The party is over!', 'success');
    } catch (err) {
        toast('Failed to end party', 'error');
        console.error('endParty:', err);
    }
}

function showDjEnded() {
    clearInterval(timerInterval);
    const timer = document.getElementById('dj-timer');
    timer.textContent = 'ENDED';
    timer.className = 'timer-badge ended';
    const btnExtend = document.getElementById('btn-extend-party');
    const btnEnd = document.getElementById('btn-end-party');
    if (btnExtend) btnExtend.disabled = true;
    if (btnEnd) btnEnd.disabled = true;
}

function buildExportText() {
    const accepted = allRequests.filter(r => r.status === 'accepted').sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const rejected = allRequests.filter(r => r.status === 'rejected');

    const lines = [
        `SpinReq — ${currentParty.name}`,
        currentParty.dj_name ? `DJ: ${currentParty.dj_name}` : '',
        `Date: ${new Date().toLocaleDateString('en-US')}`,
        '',
    ];

    if (accepted.length) {
        lines.push('ACCEPTED:');
        accepted.forEach(r => lines.push(`${r.song}`));
        lines.push('');
    }

    if (rejected.length) {
        lines.push('REJECTED:');
        rejected.forEach(r => lines.push(`${r.song}`));
        lines.push('');
    }

    lines.push(`Total: ${allRequests.length} requests`);
    lines.push(`Accepted: ${accepted.length}`);
    lines.push(`Rejected: ${rejected.length}`);

    return lines.filter(l => l !== undefined).join('\n');
}

function toggleExportMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('export-menu');
    menu.classList.toggle('open');
    const close = () => { menu.classList.remove('open'); document.removeEventListener('click', close); };
    if (menu.classList.contains('open')) document.addEventListener('click', close);
}

function exportClipboard() {
    if (!currentParty || allRequests.length === 0) { toast('Nothing to export yet!', 'error'); return; }
    navigator.clipboard.writeText(buildExportText())
        .then(() => toast('Copied to clipboard ✓', 'success'))
        .catch(() => toast('Could not copy', 'error'));
    document.getElementById('export-menu').classList.remove('open');
}

function exportTxt() {
    if (!currentParty || allRequests.length === 0) {
        toast('Nothing to export yet!', 'error');
        return;
    }
    const blob = new Blob([buildExportText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spinreq-${currentParty.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    document.getElementById('export-menu').classList.remove('open');
}

function copyLink() {
    const url = buildUrl(currentParty.id, false);
    navigator.clipboard.writeText(url)
        .then(() => toast('Link copied! ✓', 'success'))
        .catch(() => toast('Could not copy, please copy manually', 'error'));
}