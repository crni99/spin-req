const SUPABASE_URL = 'https://nygqnsqcivgkidsesewv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GzsSZRVMWehFVuRA7DWvOg_vpXr2N_W';

let supabaseClient = null;

let currentParty = null;
let timerInterval = null;
let realtimeChannel = null;
let allRequests = [];

function initSupabase() {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function saveDjToken(partyId, token) {
    localStorage.setItem('dj_token_' + partyId, token);
}
function getDjToken(partyId) {
    return localStorage.getItem('dj_token_' + partyId);
}