function init() {
    initSupabase();
    handleRoute();
    window.addEventListener('popstate', handleRoute);

    document.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const activePage = document.querySelector('.page.active')?.id;
            if (activePage === 'page-guest') sendRequest();
        }
        if (e.key === 'Escape') closeCreateModal();
    });
}

function handleRoute() {
    const params = new URLSearchParams(window.location.search);
    const partyId = params.get('p');
    const isDj = params.get('dj') === '1';

    if (partyId) {
        const landing = document.getElementById('page-landing');
        if (landing) landing.remove();
        if (isDj) loadDjView(partyId);
        else loadGuestView(partyId);
    } else {
        showPage('page-landing');
    }
}

function subscribeRealtime(partyId, role) {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

    realtimeChannel = supabaseClient
        .channel('party-' + partyId)
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'requests',
            filter: 'party_id=eq.' + partyId
        }, async () => {
            if (role === 'dj') await refreshDjLists();
            else await refreshGuestView();
        })
        .on('postgres_changes', {
            event: 'UPDATE', schema: 'public', table: 'parties',
            filter: 'id=eq.' + partyId
        }, async (payload) => {
            const updated = payload.new;
            currentParty = { ...currentParty, ...updated };
            if (role === 'dj') startTimer('dj-timer', currentParty);
            else startTimer('guest-timer', currentParty);
            if (updated.ended && role === 'guest') showGuestEnded();
        })
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') return;
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                toast('Connection lost. Please refresh the page.', 'error');
            }
            if (err) console.error('Realtime error:', err);
        });
}

init();