import { useState, useEffect } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://urhberxpqyuoxbqrjaqc.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVyaGJlcnhwcXl1b3hicXJqYXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MDkwMzMsImV4cCI6MjA5MjM4NTAzM30.hAb8uzApR4mnYH2-crhIa-a4_PpcY7XurX07rVl8Cc4";

// Supabase REST helper (no npm needed)
const sb = {
  headers: {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  },
  authHeaders: (token) => ({
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${token || SUPABASE_ANON_KEY}`,
  }),

  async signUp(email, password, prenom) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify({ email, password, data: { prenom } }),
    });
    return r.json();
  },

  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: sb.headers,
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },

  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: sb.authHeaders(token),
    });
    return r.json();
  },

  async from(table, token) {
    return {
      select: async (cols = "*", filters = "") => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols}${filters}`, {
          headers: sb.authHeaders(token),
        });
        return r.json();
      },
      insert: async (data) => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
          method: "POST",
          headers: { ...sb.authHeaders(token), "Prefer": "return=representation" },
          body: JSON.stringify(data),
        });
        return r.json();
      },
      update: async (data, match) => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
          method: "PATCH",
          headers: { ...sb.authHeaders(token), "Prefer": "return=representation" },
          body: JSON.stringify(data),
        });
        return r.json();
      },
      delete: async (match) => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
          method: "DELETE",
          headers: sb.authHeaders(token),
        });
        return r.ok;
      },
    };
  },

  // Run raw SQL via RPC
  async rpc(fn, params, token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: sb.authHeaders(token),
      body: JSON.stringify(params),
    });
    return r.json();
  },
};

// ─── SQL SETUP SCRIPT (run once in Supabase SQL editor) ───────────────────────
const SETUP_SQL = `
-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  prenom text,
  role text default 'cliente',
  created_at timestamp default now()
);
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);

-- Assessments table
create table if not exists assessments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  phase text,
  energie int, sommeil int, stress int, charge_mentale int,
  securite int, douleur int, digestion int, humeur int, motivation int,
  created_at timestamp default now()
);
alter table assessments enable row level security;
create policy "Users own assessments" on assessments for all using (auth.uid() = user_id);

-- Journal entries
create table if not exists journal_entries (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade,
  text text,
  mood int,
  created_at timestamp default now()
);
alter table journal_entries enable row level security;
create policy "Users own journal" on journal_entries for all using (auth.uid() = user_id);

-- Content table
create table if not exists content (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text,
  duration text,
  description text,
  phases text[],
  module text,
  created_at timestamp default now()
);
alter table content enable row level security;
create policy "All can read content" on content for select using (true);
create policy "Only admin inserts content" on content for insert using (true);

-- Insert sample content
insert into content (title, type, duration, description, phases, module) values
('Respiration 4-7-8', 'respiration', '5 min', 'Une pratique de respiration douce pour calmer le système nerveux.', array['refuge','deconnexion'], 'systeme-nerveux'),
('Scan corporel guidé', 'reconnexion', '10 min', 'Un voyage d''écoute intérieure du sommet de la tête jusqu''aux pieds.', array['deconnexion','refuge'], 'fondations'),
('Mobilité douce debout', 'mouvement', '15 min', 'Des mouvements fluides pour réveiller le corps en douceur.', array['reancrage','deconnexion'], 'mouvement'),
('Ancrage : pieds-terre', 'reconnexion', '8 min', 'Une pratique somatique pour revenir au présent.', array['refuge','resistance','deconnexion'], 'fondations'),
('Activation progressive', 'mouvement', '20 min', 'Une séance structurée pour construire de la force et de l''énergie.', array['reancrage','elan'], 'mouvement'),
('Force & Stabilité', 'mouvement', '30 min', 'Une séance complète pour canaliser l''élan et construire dans la puissance.', array['elan'], 'mouvement'),
('Journalisation corporelle', 'journal', '10 min', 'Des prompts guidés pour explorer ce qui bloque.', array['resistance','deconnexion'], 'fondations'),
('Rituel de récupération', 'recuperation', '12 min', 'Un rituel apaisant pour récupérer et honorer les efforts.', array['refuge','reancrage'], 'systeme-nerveux'),
('Comprendre ton système nerveux', 'video', '12 min', 'Pourquoi ton corps réagit comme il le fait — et comment l''accompagner.', array['refuge','deconnexion'], 'systeme-nerveux'),
('Les 5 phases expliquées', 'video', '15 min', 'Comprendre la logique des phases comme une boussole.', array['reancrage'], 'fondations'),
('Hormones & énergie féminine', 'video', '18 min', 'Comment tes hormones influencent ton énergie.', array['elan','reancrage'], 'hormones'),
('Le cycle de l''autosabotage', 'video', '11 min', 'Comprendre pourquoi tu sais quoi faire mais ne le fais pas.', array['resistance'], 'fondations')
on conflict do nothing;
`;

// ─── BRAND & PHASES ───────────────────────────────────────────────────────────
const BRAND = {
  rose: "#FF2D78", roseDark: "#CC1F5E", roseSoft: "#FF6FA3",
  orange: "#FF6B00", orangeLight: "#FF9A40",
  dark: "#0D0A12", darkCard: "#16111F", darkMid: "#1E1729",
  gray: "#8B7FA0", grayLight: "#C4B8D4", white: "#FAF7FF",
};

const PHASES = {
  refuge: { id: "refuge", name: "Refuge", number: 1, emoji: "🌙", color: "#7B5EA7", gradient: "linear-gradient(135deg, #4A3570 0%, #7B5EA7 100%)", tagline: "Ton corps a besoin de sécurité, pas de performance.", description: "Tu es en mode surcharge ou survie. Ton système nerveux est en protection. Ce n'est pas un échec — c'est de l'intelligence. Aujourd'hui, la meilleure chose à faire est de ralentir, de sécuriser, d'apaiser.", needs: ["Ralentir", "Sécuriser", "Apaiser", "Soutenir"] },
  deconnexion: { id: "deconnexion", name: "Déconnexion", number: 2, emoji: "🌫️", color: "#5B8DB8", gradient: "linear-gradient(135deg, #2E5F8A 0%, #5B8DB8 100%)", tagline: "Reviens à toi. Ton corps attend que tu le retrouves.", description: "Tu es dans le brouillard. Tu fonctionnes en pilote automatique sans vraiment te sentir. Ce n'est pas de la paresse — tu t'es simplement éloignée de toi.", needs: ["Revenir à soi", "Sentir", "Se reconnecter", "Présence"] },
  resistance: { id: "resistance", name: "Résistance", number: 3, emoji: "🔥", color: "#C45C2E", gradient: "linear-gradient(135deg, #8B3A1A 0%, #C45C2E 100%)", tagline: "La résistance est une information, pas une faiblesse.", description: "Tu sais ce que tu veux faire, mais quelque chose bloque. Il y a de la friction, de la fermeture, peut-être de l'autosabotage. C'est ton système qui te protège.", needs: ["Diminuer la lutte", "Comprendre le blocage", "Ouvrir doucement"] },
  reancrage: { id: "reancrage", name: "Réancrage", number: 4, emoji: "🌱", color: "#3D8C6E", gradient: "linear-gradient(135deg, #1E5C46 0%, #3D8C6E 100%)", tagline: "Tu retrouves ton sol. Construis depuis ici.", description: "Tu commences à retrouver de la stabilité. La clarté revient, le corps se sent plus présent. C'est le moment parfait pour ancrer des habitudes.", needs: ["Consolider", "Ancrer", "Bâtir", "Structurer"] },
  elan: { id: "elan", name: "Élan", number: 5, emoji: "✨", color: "#D4A017", gradient: "linear-gradient(135deg, #8B6B0A 0%, #D4A017 100%)", tagline: "Tu es prête. Avance avec intention, pas avec intensité.", description: "Ton système est disponible. L'énergie est présente, le corps est stable. Aujourd'hui, tu peux avancer, construire, renforcer — sans tomber dans l'excès.", needs: ["Canaliser", "Progresser", "Construire", "Renforcer"] },
};

const MODULES = [
  { id: "fondations", name: "Fondations", icon: "🏛️", color: "#6B4FA0" },
  { id: "mouvement", name: "Mouvement", icon: "💫", color: "#C45C2E" },
  { id: "alimentation", name: "Alimentation", icon: "🌿", color: "#3D8C6E" },
  { id: "sante-intestinale", name: "Santé intestinale", icon: "🌸", color: "#D4A017" },
  { id: "hormones", name: "Hormones", icon: "⚡", color: "#FF2D78" },
  { id: "systeme-nerveux", name: "Système nerveux", icon: "🧠", color: "#5B8DB8" },
];

function computePhase(a) {
  let s = { refuge: 0, deconnexion: 0, resistance: 0, reancrage: 0, elan: 0 };
  if (a.energie <= 3) s.refuge += 3; else if (a.energie <= 5) s.deconnexion += 2; else if (a.energie <= 7) s.reancrage += 2; else s.elan += 3;
  if (a.sommeil <= 3) s.refuge += 3; else if (a.sommeil <= 5) { s.deconnexion += 1; s.refuge += 1; } else if (a.sommeil <= 7) s.reancrage += 1; else s.elan += 2;
  if (a.stress >= 8) s.refuge += 3; else if (a.stress >= 6) { s.resistance += 2; s.refuge += 1; } else if (a.stress >= 4) s.resistance += 1; else s.reancrage += 1;
  if (a.chargeMentale >= 8) s.refuge += 2; else if (a.chargeMentale >= 6) { s.deconnexion += 2; s.resistance += 1; } else if (a.chargeMentale >= 4) s.deconnexion += 1; else s.elan += 1;
  if (a.securite <= 3) s.refuge += 3; else if (a.securite <= 5) s.deconnexion += 2; else if (a.securite <= 7) s.reancrage += 2; else s.elan += 2;
  if (a.douleur >= 7) s.refuge += 3; else if (a.douleur >= 4) s.refuge += 1;
  if (a.digestion >= 7) s.refuge += 2; else if (a.digestion >= 5) s.resistance += 1;
  if (a.humeur <= 3) s.refuge += 2; else if (a.humeur <= 5) { s.deconnexion += 2; s.resistance += 1; } else if (a.humeur <= 7) s.reancrage += 1; else s.elan += 2;
  if (a.motivation <= 3) { s.refuge += 1; s.deconnexion += 1; } else if (a.motivation <= 5) s.resistance += 3; else if (a.motivation <= 7) s.reancrage += 2; else s.elan += 3;
  return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --rose: #FF2D78; --orange: #FF6B00; --dark: #0D0A12; --dark-card: #16111F; --dark-mid: #1E1729; --gray: #8B7FA0; --gray-light: #C4B8D4; --white: #FAF7FF; }
  body { background: var(--dark); color: var(--white); font-family: 'DM Sans', sans-serif; min-height: 100vh; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: var(--dark); } ::-webkit-scrollbar-thumb { background: var(--rose); border-radius: 2px; }
  .app-layout { display: flex; min-height: 100vh; }
  .sidebar { width: 72px; background: var(--dark-card); border-right: 1px solid rgba(255,45,120,0.15); display: flex; flex-direction: column; align-items: center; padding: 20px 0; gap: 8px; position: fixed; top: 0; left: 0; height: 100vh; z-index: 100; transition: width 0.3s ease; }
  .sidebar.expanded { width: 220px; }
  .sidebar-logo { width: 44px; height: 44px; background: linear-gradient(135deg, var(--rose), var(--orange)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: white; margin-bottom: 16px; flex-shrink: 0; cursor: pointer; }
  .nav-item { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; color: var(--gray); font-size: 20px; border: none; background: transparent; flex-shrink: 0; }
  .sidebar.expanded .nav-item { width: 180px; justify-content: flex-start; padding: 0 14px; gap: 12px; }
  .nav-item:hover { background: rgba(255,45,120,0.1); color: #FF6FA3; }
  .nav-item.active { background: rgba(255,45,120,0.15); color: var(--rose); }
  .nav-label { font-size: 13px; font-weight: 500; display: none; white-space: nowrap; }
  .sidebar.expanded .nav-label { display: block; }
  .sidebar-bottom { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .sidebar.expanded .sidebar-bottom { align-items: flex-start; padding-left: 16px; }
  .main-content { margin-left: 72px; flex: 1; min-height: 100vh; transition: margin-left 0.3s ease; }
  .main-content.expanded { margin-left: 220px; }
  .top-bar { background: var(--dark-card); border-bottom: 1px solid rgba(255,255,255,0.06); padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
  .page-content { padding: 20px 24px 60px; max-width: 700px; }
  .card { background: var(--dark-card); border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); }
  .gradient-text { background: linear-gradient(135deg, var(--rose), var(--orange)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .btn-primary { background: linear-gradient(135deg, var(--rose), var(--orange)); color: white; border: none; padding: 12px 24px; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 8px 25px rgba(255,45,120,0.3); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-secondary { background: rgba(255,45,120,0.1); color: var(--rose); border: 1px solid rgba(255,45,120,0.3); padding: 10px 20px; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
  .btn-ghost { background: transparent; color: var(--gray-light); border: 1px solid rgba(255,255,255,0.1); padding: 10px 20px; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 14px; cursor: pointer; transition: all 0.2s; }
  .btn-ghost:hover { border-color: var(--gray); color: var(--white); }
  .input-group { display: flex; flex-direction: column; gap: 6px; }
  .input-group label { font-size: 12px; font-weight: 600; color: var(--gray-light); text-transform: uppercase; letter-spacing: 0.8px; }
  .input-group input, .input-group textarea, .input-group select { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; color: var(--white); font-family: 'DM Sans', sans-serif; font-size: 15px; outline: none; transition: border-color 0.2s; }
  .input-group input:focus, .input-group textarea:focus, .input-group select:focus { border-color: var(--rose); }
  .input-group textarea { resize: vertical; min-height: 100px; }
  .input-group select option { background: #1E1729; }
  .error-msg { color: #FF6FA3; font-size: 13px; padding: 10px 14px; background: rgba(255,107,163,0.1); border-radius: 10px; border: 1px solid rgba(255,107,163,0.2); }
  input[type=range] { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(to right, var(--rose) 0%, var(--rose) var(--val,50%), rgba(255,255,255,0.1) var(--val,50%), rgba(255,255,255,0.1) 100%); outline: none; }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: white; border: 3px solid var(--rose); cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
  .progress-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--rose), var(--orange)); border-radius: 2px; transition: width 0.5s ease; }
  .tabs { display: flex; gap: 4px; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 4px; }
  .tab { padding: 8px 16px; border-radius: 9px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; color: var(--gray); border: none; background: transparent; }
  .tab.active { background: rgba(255,45,120,0.15); color: var(--rose); }
  .tag { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; background: rgba(255,255,255,0.06); color: var(--gray-light); }
  .phase-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .content-card { background: var(--dark-card); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); padding: 16px; cursor: pointer; transition: all 0.2s; display: flex; gap: 12px; }
  .content-card:hover { border-color: rgba(255,45,120,0.3); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
  .content-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  .stat-card { background: var(--dark-card); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); padding: 20px; }
  .assess-q { padding: 22px; background: var(--dark-mid); border-radius: 16px; border: 1px solid rgba(255,255,255,0.06); }
  .val-display { font-size: 24px; font-weight: 700; color: var(--rose); min-width: 32px; text-align: center; }
  .option-pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 24px; border: 1.5px solid rgba(255,255,255,0.12); cursor: pointer; font-size: 14px; transition: all 0.2s; background: rgba(255,255,255,0.03); }
  .option-pill:hover { border-color: rgba(255,45,120,0.4); }
  .option-pill.selected { background: rgba(255,45,120,0.15); border-color: var(--rose); color: #FF6FA3; }
  .login-bg { min-height: 100vh; background: var(--dark); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .login-orb { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; }
  .login-card { background: var(--dark-card); border-radius: 28px; border: 1px solid rgba(255,45,120,0.2); padding: 44px 36px; width: 420px; max-width: 90vw; position: relative; z-index: 1; }
  .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--rose), var(--orange)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; cursor: pointer; flex-shrink: 0; }
  .phase-hero { border-radius: 22px; padding: 28px 24px; position: relative; overflow: hidden; }
  .journal-entry { background: var(--dark-mid); border-radius: 14px; padding: 16px; border: 1px solid rgba(255,255,255,0.05); }
  .admin-table { width: 100%; border-collapse: collapse; }
  .admin-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: var(--gray); padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .admin-table td { padding: 11px 14px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
  .notif { position: fixed; bottom: 24px; right: 24px; background: var(--dark-card); border: 1px solid rgba(255,45,120,0.4); border-radius: 14px; padding: 14px 20px; font-size: 14px; z-index: 999; animation: slideUp 0.3s ease; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
  .fade-in { animation: fadeIn 0.35s ease; }
  .spinner { width: 32px; height: 32px; border: 3px solid rgba(255,45,120,0.2); border-top-color: var(--rose); border-radius: 50%; animation: spin 0.8s linear infinite; }
  .pulse-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--rose); animation: pulse 2s infinite; display: inline-block; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.5;transform:scale(1.3);} }
  @media (max-width: 768px) {
    .grid-2 { grid-template-columns: 1fr; }
    .grid-3 { grid-template-columns: 1fr 1fr; }
    .main-content { margin-left: 0 !important; padding-bottom: 80px; }
    .sidebar { display: none; }
    .bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: var(--dark-card); border-top: 1px solid rgba(255,255,255,0.08); padding: 8px 0 16px; z-index: 100; justify-content: space-around; }
    .bottom-nav-item { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; color: var(--gray); cursor: pointer; padding: 6px 10px; border-radius: 10px; }
    .bottom-nav-item.active { color: var(--rose); }
    .bottom-nav-item span:first-child { font-size: 20px; }
    .page-content { padding: 16px 16px 80px; }
  }
  @media (min-width: 769px) { .bottom-nav { display: none; } }
`;

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Spinner() {
  return <div style={{ display:"flex", justifyContent:"center", padding:40 }}><div className="spinner" /></div>;
}

function Notif({ msg, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return <div className="notif">✓ {msg}</div>;
}

function PhaseTag({ phaseId }) {
  const p = PHASES[phaseId]; if (!p) return null;
  return <span className="phase-badge" style={{ background:`${p.color}22`, color:p.color }}>{p.emoji} {p.name}</span>;
}

const TYPE_ICONS = { video:"🎬", respiration:"🌬️", reconnexion:"🔮", mouvement:"💃", journal:"📓", recuperation:"🛁" };
const TYPE_COLORS = { video:"#6B4FA0", respiration:"#5B8DB8", reconnexion:"#7B5EA7", mouvement:"#C45C2E", journal:"#D4A017", recuperation:"#3D8C6E" };

function ContentCard({ item }) {
  return (
    <div className="content-card">
      <div className="content-icon" style={{ background:`${TYPE_COLORS[item.type]||"#6B4FA0"}22` }}>
        {TYPE_ICONS[item.type]||"📄"}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{item.title}</div>
        <div style={{ fontSize:12, color:BRAND.gray, marginBottom:8, lineHeight:1.5 }}>{item.description}</div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          <span className="tag">{item.duration}</span>
          {(item.phases||[]).slice(0,2).map(ph => <PhaseTag key={ph} phaseId={ph} />)}
        </div>
      </div>
    </div>
  );
}

function SliderQ({ label, sub, value, onChange, lo, hi }) {
  const pct = ((value-1)/9)*100;
  return (
    <div className="assess-q">
      <div style={{ fontWeight:600, fontSize:16, marginBottom:4 }}>{label}</div>
      {sub && <div style={{ fontSize:13, color:BRAND.gray, marginBottom:16 }}>{sub}</div>}
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ flex:1 }}>
          <input type="range" min={1} max={10} value={value} style={{"--val":`${pct}%`}} onChange={e=>onChange(+e.target.value)} />
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:BRAND.gray, marginTop:4 }}>
            <span>{lo||"1"}</span><span>{hi||"10"}</span>
          </div>
        </div>
        <div className="val-display">{value}</div>
      </div>
    </div>
  );
}

// ─── LOGIN / SIGNUP ───────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit() {
    if (!email || !password) { setErr("Remplis tous les champs."); return; }
    setLoading(true); setErr("");
    try {
      if (mode === "signup") {
        if (!prenom) { setErr("Entre ton prénom."); setLoading(false); return; }
        const res = await sb.signUp(email, password, prenom);
        if (res.error) { setErr(res.error.message); setLoading(false); return; }
        setErr(""); setMode("login");
        setErr("Compte créé ! Connecte-toi maintenant.");
      } else {
        const res = await sb.signIn(email, password);
        if (res.error) { setErr("Courriel ou mot de passe incorrect."); setLoading(false); return; }
        const user = await sb.getUser(res.access_token);
        onAuth({ ...user, access_token: res.access_token, prenom: user.user_metadata?.prenom || email.split("@")[0] });
      }
    } catch(e) { setErr("Erreur de connexion. Vérifie ta connexion internet."); }
    setLoading(false);
  }

  return (
    <div className="login-bg">
      <div className="login-orb" style={{ width:400, height:400, background:"#FF2D78", top:-100, right:-100, opacity:0.15 }} />
      <div className="login-orb" style={{ width:300, height:300, background:"#FF6B00", bottom:-80, left:-80, opacity:0.12 }} />
      <div className="login-card fade-in">
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:52, height:52, background:"linear-gradient(135deg,#FF2D78,#FF6B00)", borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px", fontSize:22 }}>○</div>
          <div style={{ fontFamily:"Playfair Display,serif", fontSize:20, fontWeight:700, marginBottom:4 }}>
            Ma méthode, <span className="gradient-text">ta méthode</span>
          </div>
          <div style={{ fontSize:13, color:BRAND.gray }}>par Johannie Vallée · Origine</div>
        </div>

        <div className="tabs" style={{ marginBottom:24 }}>
          <button className={`tab ${mode==="login"?"active":""}`} style={{ flex:1 }} onClick={()=>{setMode("login");setErr("");}}>Me connecter</button>
          <button className={`tab ${mode==="signup"?"active":""}`} style={{ flex:1 }} onClick={()=>{setMode("signup");setErr("");}}>Créer un compte</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {mode==="signup" && (
            <div className="input-group">
              <label>Prénom</label>
              <input value={prenom} onChange={e=>setPrenom(e.target.value)} placeholder="Ton prénom" />
            </div>
          )}
          <div className="input-group">
            <label>Courriel</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.com" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          <div className="input-group">
            <label>Mot de passe</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handleSubmit()} />
          </div>
          {err && <div className="error-msg">{err}</div>}
          <button className="btn-primary" onClick={handleSubmit} disabled={loading} style={{ padding:"14px", marginTop:4 }}>
            {loading ? "..." : mode==="login" ? "Me connecter" : "Créer mon compte"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SELF-ASSESSMENT ──────────────────────────────────────────────────────────
function Assessment({ token, userId, onComplete }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState({ energie:5, sommeil:5, stress:5, chargeMentale:5, securite:5, douleur:1, digestion:5, humeur:5, motivation:5 });

  const questions = [
    { key:"energie", label:"Mon niveau d'énergie aujourd'hui", sub:"Comment te sens-tu physiquement ?", lo:"Épuisée", hi:"Pleine d'énergie" },
    { key:"sommeil", label:"La qualité de mon sommeil cette nuit", sub:"As-tu bien dormi ? Te sens-tu reposée ?", lo:"Très mauvais", hi:"Excellent" },
    { key:"stress", label:"Mon niveau de stress", sub:"Quelle est l'intensité de la pression que tu ressens ?", lo:"Très calme", hi:"Très stressée" },
    { key:"chargeMentale", label:"Ma charge mentale", sub:"À quel point ton esprit tourne-t-il à plein régime ?", lo:"Légère", hi:"Très lourde" },
    { key:"securite", label:"Ma sécurité intérieure dans mon corps", sub:"Est-ce que tu te sens ancrée et en sécurité ?", lo:"Très tendue", hi:"Bien ancrée" },
    { key:"douleur", label:"Douleur ou inconfort physique", sub:"As-tu des douleurs ou tensions dans le corps ?", lo:"Aucune", hi:"Douleur intense" },
    { key:"digestion", label:"Mon ventre et ma digestion", sub:"Comment se porte ton système digestif ?", lo:"Très bien", hi:"Très difficile" },
    { key:"humeur", label:"Mon humeur générale", sub:"Comment te sens-tu émotionnellement ?", lo:"Très bas", hi:"Très bien" },
    { key:"motivation", label:"Ma motivation réelle", sub:"As-tu envie d'avancer et de prendre soin de toi ?", lo:"Absente", hi:"Très présente" },
  ];

  async function handleNext() {
    if (step < questions.length - 1) { setStep(s=>s+1); return; }
    setSaving(true);
    const phase = computePhase(answers);
    try {
      const tbl = await sb.from("assessments", token);
      await tbl.insert({ user_id:userId, phase, energie:answers.energie, sommeil:answers.sommeil, stress:answers.stress, charge_mentale:answers.chargeMentale, securite:answers.securite, douleur:answers.douleur, digestion:answers.digestion, humeur:answers.humeur, motivation:answers.motivation });
    } catch(e) { console.error(e); }
    onComplete(phase);
  }

  const q = questions[step];
  const pct = (step / questions.length) * 100;

  return (
    <div className="page-content fade-in" style={{ maxWidth:580 }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
          <span style={{ fontSize:13, color:BRAND.gray }}>Question {step+1} / {questions.length}</span>
          <span style={{ fontSize:13, color:BRAND.rose, fontWeight:600 }}>{Math.round(pct)}%</span>
        </div>
        <div className="progress-bar"><div className="progress-fill" style={{ width:`${pct}%` }} /></div>
      </div>

      <div style={{ fontFamily:"Playfair Display,serif", fontSize:22, fontWeight:700, marginBottom:6 }}>
        Comment te sens-tu <span className="gradient-text">aujourd'hui ?</span>
      </div>
      <div style={{ fontSize:13, color:BRAND.gray, marginBottom:24 }}>Sois honnête avec toi-même. Il n'y a pas de bonne ou mauvaise réponse.</div>

      <SliderQ key={q.key} label={q.label} sub={q.sub} value={answers[q.key]} onChange={v=>setAnswers(a=>({...a,[q.key]:v}))} lo={q.lo} hi={q.hi} />

      <div style={{ display:"flex", gap:12, marginTop:24 }}>
        {step > 0 && <button className="btn-ghost" onClick={()=>setStep(s=>s-1)}>← Retour</button>}
        <button className="btn-primary" style={{ flex:1 }} onClick={handleNext} disabled={saving}>
          {saving ? "Sauvegarde..." : step===questions.length-1 ? "Voir ma phase ✨" : "Continuer →"}
        </button>
      </div>
    </div>
  );
}

// ─── PHASE RESULT ─────────────────────────────────────────────────────────────
function PhaseResult({ phaseId, content, onDashboard }) {
  const phase = PHASES[phaseId];
  const rec = content.filter(c => c.phases?.includes(phaseId)).slice(0, 4);
  return (
    <div className="page-content fade-in" style={{ maxWidth:620 }}>
      <div className="phase-hero" style={{ background:phase.gradient, marginBottom:22 }}>
        <div style={{ fontSize:44, marginBottom:10 }}>{phase.emoji}</div>
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, opacity:0.7, marginBottom:4 }}>Ta phase aujourd'hui</div>
        <div style={{ fontFamily:"Playfair Display,serif", fontSize:28, fontWeight:700, marginBottom:8 }}>Phase {phase.name}</div>
        <div style={{ fontSize:14, opacity:0.85, fontStyle:"italic", marginBottom:12 }}>"{phase.tagline}"</div>
        <div style={{ fontSize:13, opacity:0.8, lineHeight:1.7 }}>{phase.description}</div>
      </div>

      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:BRAND.gray, marginBottom:10 }}>Ce dont tu as besoin aujourd'hui</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {phase.needs.map(n=><span key={n} className="tag" style={{ background:`${phase.color}20`, color:phase.color }}>{n}</span>)}
        </div>
      </div>

      {rec.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:BRAND.gray, marginBottom:12 }}>Recommandé pour toi maintenant</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {rec.map(item=><ContentCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      <button className="btn-primary" style={{ width:"100%" }} onClick={onDashboard}>Voir mon tableau de bord</button>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user, phaseId, content, assessHistory, onStartAssess }) {
  const phase = phaseId ? PHASES[phaseId] : null;
  const today = new Date().toLocaleDateString("fr-CA", { weekday:"long", day:"numeric", month:"long" });
  const rec = content.filter(c => phaseId && c.phases?.includes(phaseId)).slice(0,3);

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:13, color:BRAND.gray, marginBottom:4, textTransform:"capitalize" }}>{today}</div>
        <div style={{ fontFamily:"Playfair Display,serif", fontSize:24, fontWeight:700 }}>
          Bonjour, <span className="gradient-text">{user.prenom}</span> 🌸
        </div>
      </div>

      {phase ? (
        <div style={{ background:phase.gradient, borderRadius:20, padding:"22px 20px", marginBottom:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, opacity:0.7, marginBottom:6 }}>Ta phase aujourd'hui</div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ fontSize:26 }}>{phase.emoji}</span>
            <span style={{ fontFamily:"Playfair Display,serif", fontSize:22, fontWeight:700 }}>Phase {phase.name}</span>
          </div>
          <div style={{ fontSize:13, opacity:0.85, fontStyle:"italic" }}>"{phase.tagline}"</div>
        </div>
      ) : (
        <div className="card" style={{ padding:"24px 20px", marginBottom:20, textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:10 }}>🔮</div>
          <div style={{ fontFamily:"Playfair Display,serif", fontSize:17, fontWeight:700, marginBottom:6 }}>Découvre ta phase du jour</div>
          <div style={{ fontSize:13, color:BRAND.gray, marginBottom:18, lineHeight:1.6 }}>Prends 2 minutes pour évaluer ton état et recevoir tes recommandations personnalisées.</div>
          <button className="btn-primary" onClick={onStartAssess}>Commencer mon évaluation ✨</button>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom:20 }}>
        <div className="stat-card">
          <div style={{ fontSize:12, color:BRAND.gray, textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>Évaluations totales</div>
          <div style={{ fontSize:26, fontWeight:700 }} className="gradient-text">{assessHistory.length}</div>
        </div>
        <div className="stat-card">
          <div style={{ fontSize:12, color:BRAND.gray, textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>Séances disponibles</div>
          <div style={{ fontSize:26, fontWeight:700 }} className="gradient-text">{content.length}</div>
        </div>
      </div>

      {phase && rec.length > 0 && (
        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:BRAND.gray, marginBottom:12 }}>Recommandé pour toi</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {rec.map(item=><ContentCard key={item.id} item={item} />)}
          </div>
        </div>
      )}

      <div>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:BRAND.gray, marginBottom:12 }}>Toutes les phases</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {Object.values(PHASES).map(p=>(
            <div key={p.id} className="card" style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:22 }}>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>Phase {p.name}</div>
                <div style={{ fontSize:12, color:BRAND.gray }}>{p.needs.slice(0,2).join(" · ")}</div>
              </div>
              <div style={{ width:9, height:9, borderRadius:"50%", background:p.color }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PHASES LIBRARY ──────────────────────────────────────────────────────────
function PhasesLib({ content }) {
  const [sel, setSel] = useState(null);
  if (sel) {
    const phase = PHASES[sel];
    const items = content.filter(c=>c.phases?.includes(sel));
    return (
      <div className="page-content fade-in">
        <button className="btn-ghost" style={{ marginBottom:18, fontSize:13 }} onClick={()=>setSel(null)}>← Retour</button>
        <div className="phase-hero" style={{ background:phase.gradient, marginBottom:22 }}>
          <div style={{ fontSize:42, marginBottom:10 }}>{phase.emoji}</div>
          <div style={{ fontFamily:"Playfair Display,serif", fontSize:26, fontWeight:700, marginBottom:8 }}>Phase {phase.name}</div>
          <div style={{ fontSize:14, opacity:0.85, lineHeight:1.7 }}>{phase.description}</div>
        </div>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:BRAND.gray, marginBottom:12 }}>Contenus ({items.length})</div>
        {items.length === 0 && <div style={{ textAlign:"center", padding:32, color:BRAND.gray, fontSize:14 }}>Aucun contenu pour cette phase pour l'instant.</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {items.map(item=><ContentCard key={item.id} item={item} />)}
        </div>
      </div>
    );
  }
  return (
    <div className="page-content fade-in">
      <div style={{ fontFamily:"Playfair Display,serif", fontSize:22, fontWeight:700, marginBottom:4 }}>Les <span className="gradient-text">Phases</span></div>
      <div style={{ fontSize:13, color:BRAND.gray, marginBottom:22 }}>Chaque phase a ses besoins, ses séances et son rythme.</div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {Object.values(PHASES).map(p=>(
          <div key={p.id} onClick={()=>setSel(p.id)} style={{ background:`${p.color}18`, border:`2px solid ${p.color}30`, borderRadius:18, padding:"18px 20px", cursor:"pointer", transition:"all 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
            onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <span style={{ fontSize:34 }}>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:16, color:p.color, marginBottom:3 }}>Phase {p.name}</div>
                <div style={{ fontSize:13, color:BRAND.grayLight }}>{p.tagline}</div>
                <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                  {p.needs.map(n=><span key={n} className="tag" style={{ background:`${p.color}18`, color:p.color, fontSize:11 }}>{n}</span>)}
                </div>
              </div>
              <span style={{ color:p.color }}>→</span>
            </div>
            <div style={{ marginTop:8, fontSize:12, color:BRAND.gray }}>{content.filter(c=>c.phases?.includes(p.id)).length} contenus disponibles</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MODULES LIBRARY ─────────────────────────────────────────────────────────
function ModulesLib({ content }) {
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("tous");

  if (sel) {
    const mod = MODULES.find(m=>m.id===sel);
    const items = content.filter(c=>c.module===sel);
    const seances = items.filter(c=>c.type!=="video");
    const capsules = items.filter(c=>c.type==="video");
    return (
      <div className="page-content fade-in">
        <button className="btn-ghost" style={{ marginBottom:18, fontSize:13 }} onClick={()=>setSel(null)}>← Retour</button>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:22 }}>
          <span style={{ fontSize:38 }}>{mod.icon}</span>
          <div>
            <div style={{ fontFamily:"Playfair Display,serif", fontSize:20, fontWeight:700 }}>{mod.name}</div>
            <div style={{ fontSize:13, color:BRAND.gray }}>{seances.length} séances · {capsules.length} capsules</div>
          </div>
        </div>
        <div className="tabs" style={{ marginBottom:18 }}>
          <button className={`tab ${tab==="tous"?"active":""}`} onClick={()=>setTab("tous")}>Tous</button>
          <button className={`tab ${tab==="seances"?"active":""}`} onClick={()=>setTab("seances")}>Séances</button>
          <button className={`tab ${tab==="capsules"?"active":""}`} onClick={()=>setTab("capsules")}>Capsules</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {(tab==="tous"?items:tab==="seances"?seances:capsules).map(item=><ContentCard key={item.id} item={item} />)}
          {items.length===0 && <div style={{ textAlign:"center", padding:32, color:BRAND.gray, fontSize:14 }}>Aucun contenu dans ce module pour l'instant.</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <div style={{ fontFamily:"Playfair Display,serif", fontSize:22, fontWeight:700, marginBottom:4 }}>Les <span className="gradient-text">Modules</span></div>
      <div style={{ fontSize:13, color:BRAND.gray, marginBottom:22 }}>Explore le programme par thème à ton propre rythme.</div>
      <div className="grid-2">
        {MODULES.map(mod=>{
          const count = content.filter(c=>c.module===mod.id).length;
          return (
            <div key={mod.id} className="card" style={{ padding:"18px 16px", cursor:"pointer", transition:"all 0.2s" }}
              onClick={()=>setSel(mod.id)}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${mod.color}50`;e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.transform="translateY(0)";}}>
              <div style={{ fontSize:30, marginBottom:10 }}>{mod.icon}</div>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:5, color:mod.color }}>{mod.name}</div>
              <div style={{ fontSize:12, color:BRAND.gray }}>{count} contenu{count!==1?"s":""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── JOURNAL ─────────────────────────────────────────────────────────────────
function Journal({ token, userId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [mood, setMood] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const tbl = await sb.from("journal_entries", token);
        const data = await tbl.select("*", `&user_id=eq.${userId}&order=created_at.desc`);
        setEntries(Array.isArray(data) ? data : []);
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const tbl = await sb.from("journal_entries", token);
      const res = await tbl.insert({ user_id:userId, text, mood });
      const newEntry = Array.isArray(res) ? res[0] : { id:Date.now(), text, mood, created_at:new Date().toISOString() };
      setEntries(e=>[newEntry, ...e]);
      setText(""); setMood(5); setShowForm(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div className="page-content fade-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <div>
          <div style={{ fontFamily:"Playfair Display,serif", fontSize:22, fontWeight:700 }}>Mon <span className="gradient-text">Journal</span></div>
          <div style={{ fontSize:13, color:BRAND.gray, marginTop:4 }}>Tes ressentis, tes victoires, ton évolution.</div>
        </div>
        <button className="btn-primary" style={{ fontSize:13, padding:"10px 18px" }} onClick={()=>setShowForm(s=>!s)}>+ Écrire</button>
      </div>

      {showForm && (
        <div className="card" style={{ padding:20, marginBottom:18 }}>
          <SliderQ label="Comment je me sens" value={mood} onChange={setMood} lo="Très bas" hi="Très bien" />
          <div className="input-group" style={{ marginTop:14, marginBottom:14 }}>
            <label>Ma note du jour</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Qu'est-ce qui se passe pour toi aujourd'hui ?" />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving?"...":"Sauvegarder"}</button>
            <button className="btn-ghost" onClick={()=>setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? <Spinner /> : entries.length === 0 && !showForm ? (
        <div style={{ textAlign:"center", padding:"50px 20px", color:BRAND.gray }}>
          <div style={{ fontSize:36, marginBottom:10 }}>📓</div>
          <div style={{ fontSize:15, marginBottom:4 }}>Ton journal est vide pour l'instant.</div>
          <div style={{ fontSize:13 }}>Commence à écrire pour suivre ton évolution.</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {entries.map(e=>(
            <div key={e.id} className="journal-entry">
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:12, color:BRAND.gray }}>{new Date(e.created_at).toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"long"})}</div>
                <div style={{ fontSize:13, fontWeight:700, color:BRAND.rose }}>Humeur : {e.mood}/10</div>
              </div>
              <div style={{ fontSize:14, lineHeight:1.7, color:BRAND.grayLight }}>{e.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function Profile({ user, assessHistory }) {
  return (
    <div className="page-content fade-in">
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:28, background:BRAND.darkCard, borderRadius:20, padding:20, border:"1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ width:60, height:60, borderRadius:"50%", background:"linear-gradient(135deg,#FF2D78,#FF6B00)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700 }}>
          {user.prenom?.[0]?.toUpperCase()||"?"}
        </div>
        <div>
          <div style={{ fontFamily:"Playfair Display,serif", fontSize:19, fontWeight:700 }}>{user.prenom}</div>
          <div style={{ fontSize:13, color:BRAND.gray }}>{user.email}</div>
          <span className="tag" style={{ marginTop:6, display:"inline-flex", background:"rgba(255,45,120,0.15)", color:BRAND.rose }}>✨ Cliente</span>
        </div>
      </div>

      <div>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1.5, color:BRAND.gray, marginBottom:12 }}>Mon historique de phases</div>
        {assessHistory.length === 0 ? (
          <div className="card" style={{ padding:20, textAlign:"center", color:BRAND.gray, fontSize:14 }}>
            Complète ton premier self-assessment pour commencer à suivre ton évolution.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {assessHistory.slice(0,10).map((h,i)=>{
              const p = PHASES[h.phase];
              return p ? (
                <div key={i} className="card" style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:20 }}>{p.emoji}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>Phase {p.name}</div>
                    <div style={{ fontSize:12, color:BRAND.gray }}>{new Date(h.created_at).toLocaleDateString("fr-CA",{weekday:"short",day:"numeric",month:"short"})}</div>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────────
function Admin({ token, content, setContent, notify }) {
  const [tab, setTab] = useState("contenus");
  const [form, setForm] = useState({ title:"", type:"reconnexion", duration:"", description:"", phases:[], module:"fondations" });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!form.title || !form.description) { notify("Remplis le titre et la description."); return; }
    setSaving(true);
    try {
      const tbl = await sb.from("content", token);
      const res = await tbl.insert({ ...form, phases: form.phases.length ? form.phases : ["reancrage"] });
      const newItem = Array.isArray(res) && res[0] ? res[0] : { ...form, id:"local_"+Date.now(), phases: form.phases.length ? form.phases : ["reancrage"] };
      setContent(c=>[...c, newItem]);
      setForm({ title:"", type:"reconnexion", duration:"", description:"", phases:[], module:"fondations" });
      notify("Contenu ajouté avec succès ✓");
    } catch(e) { notify("Erreur lors de l'ajout."); }
    setSaving(false);
  }

  return (
    <div className="page-content fade-in">
      <div style={{ fontFamily:"Playfair Display,serif", fontSize:22, fontWeight:700, marginBottom:4 }}>Espace <span className="gradient-text">Admin</span></div>
      <div style={{ fontSize:13, color:BRAND.gray, marginBottom:22 }}>Gère tes contenus, tes phases et tes données.</div>

      <div className="grid-3" style={{ marginBottom:22 }}>
        {[["Contenus","📚",content.length],["Phases","◎",5],["Modules","⊞",6]].map(([l,i,v])=>(
          <div key={l} className="stat-card">
            <div style={{ fontSize:12, color:BRAND.gray, textTransform:"uppercase", letterSpacing:0.6, marginBottom:6 }}>{i} {l}</div>
            <div style={{ fontSize:24, fontWeight:700 }} className="gradient-text">{v}</div>
          </div>
        ))}
      </div>

      <div className="tabs" style={{ marginBottom:18 }}>
        {[["contenus","Contenus"],["ajouter","+ Ajouter"]].map(([id,label])=>(
          <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {tab==="contenus" && (
        <div style={{ overflowX:"auto" }}>
          <table className="admin-table">
            <thead><tr><th>Titre</th><th>Type</th><th>Durée</th><th>Phases</th></tr></thead>
            <tbody>
              {content.map(item=>(
                <tr key={item.id}>
                  <td style={{ fontWeight:500 }}>{item.title}</td>
                  <td><span className="tag">{item.type}</span></td>
                  <td style={{ color:BRAND.gray }}>{item.duration}</td>
                  <td><div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>{(item.phases||[]).map(ph=><PhaseTag key={ph} phaseId={ph} />)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="ajouter" && (
        <div className="card" style={{ padding:22 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div className="input-group">
              <label>Titre</label>
              <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Respiration anti-stress" />
            </div>
            <div className="grid-2">
              <div className="input-group">
                <label>Type</label>
                <select value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                  <option value="reconnexion">Séance de reconnexion</option>
                  <option value="respiration">Respiration</option>
                  <option value="mouvement">Mouvement</option>
                  <option value="journal">Journalisation</option>
                  <option value="recuperation">Récupération</option>
                  <option value="video">Capsule vidéo</option>
                </select>
              </div>
              <div className="input-group">
                <label>Durée</label>
                <input value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} placeholder="Ex: 15 min" />
              </div>
            </div>
            <div className="input-group">
              <label>Description</label>
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Décris le contenu..." />
            </div>
            <div className="input-group">
              <label>Module</label>
              <select value={form.module} onChange={e=>setForm(f=>({...f,module:e.target.value}))}>
                {MODULES.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:600, color:BRAND.grayLight, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 }}>Phases associées</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {Object.values(PHASES).map(p=>(
                  <span key={p.id} className={`option-pill ${form.phases.includes(p.id)?"selected":""}`}
                    onClick={()=>setForm(f=>({...f,phases:f.phases.includes(p.id)?f.phases.filter(x=>x!==p.id):[...f.phases,p.id]}))}>
                    {p.emoji} {p.name}
                  </span>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving?"Ajout en cours...":"Ajouter ce contenu"}</button>
          </div>
        </div>
      )}

      <div style={{ marginTop:28, padding:16, background:"rgba(255,45,120,0.06)", borderRadius:14, border:"1px solid rgba(255,45,120,0.15)" }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:BRAND.roseSoft }}>⚙️ Configuration de la base de données</div>
        <div style={{ fontSize:12, color:BRAND.gray, lineHeight:1.8 }}>
          Pour initialiser les tables Supabase, copie et exécute le SQL ci-dessous dans <strong style={{color:BRAND.grayLight}}>Supabase → SQL Editor</strong>.
        </div>
        <div style={{ marginTop:10 }}>
          <button className="btn-secondary" style={{ fontSize:12 }} onClick={()=>{navigator.clipboard.writeText(SETUP_SQL);alert("SQL copié ! Colle-le dans Supabase → SQL Editor → New query → Run");}}>
            📋 Copier le SQL d'initialisation
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("dashboard");
  const [assessStage, setAssessStage] = useState("idle");
  const [todayPhase, setTodayPhase] = useState(null);
  const [content, setContent] = useState([]);
  const [assessHistory, setAssessHistory] = useState([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [notif, setNotif] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const notify = (msg) => setNotif(msg);

  // Load content + today's phase after login
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoadingContent(true);
      try {
        // Load content
        const tbl = await sb.from("content", user.access_token);
        const data = await tbl.select("*", "&order=created_at.asc");
        if (Array.isArray(data) && data.length > 0) setContent(data);

        // Load assessment history
        const aTbl = await sb.from("assessments", user.access_token);
        const history = await aTbl.select("phase,created_at", `&user_id=eq.${user.id}&order=created_at.desc`);
        if (Array.isArray(history)) {
          setAssessHistory(history);
          if (history.length > 0) {
            const latest = history[0];
            const latestDate = new Date(latest.created_at).toDateString();
            const today = new Date().toDateString();
            if (latestDate === today) setTodayPhase(latest.phase);
          }
        }
      } catch(e) { console.error(e); }
      setLoadingContent(false);
    })();
  }, [user]);

  function handleAuth(u) { setUser(u); }

  function handleAssessComplete(phase) {
    setTodayPhase(phase);
    setAssessHistory(h => [{ phase, created_at: new Date().toISOString() }, ...h]);
    setAssessStage("result");
  }

  if (!user) return (
    <>
      <style>{css}</style>
      <AuthScreen onAuth={handleAuth} />
    </>
  );

  const isAdmin = user.email === "origine.medias@gmail.com" || user.email?.includes("admin");

  const navItems = [
    { id:"dashboard", icon:"⊕", label:"Tableau de bord" },
    { id:"phases", icon:"◎", label:"Phases" },
    { id:"modules", icon:"⊞", label:"Modules" },
    { id:"journal", icon:"✎", label:"Journal" },
    { id:"profile", icon:"◉", label:"Profil" },
    ...(isAdmin ? [{ id:"admin", icon:"⚙", label:"Admin" }] : []),
  ];

  const goTo = (id) => { setScreen(id); if(id==="dashboard") setAssessStage("idle"); setSidebarOpen(false); };

  const renderContent = () => {
    if (screen === "dashboard") {
      if (assessStage === "assessing") return <Assessment token={user.access_token} userId={user.id} onComplete={handleAssessComplete} />;
      if (assessStage === "result" && todayPhase) return <PhaseResult phaseId={todayPhase} content={content} onDashboard={()=>setAssessStage("idle")} />;
      return <Dashboard user={user} phaseId={todayPhase} content={content} assessHistory={assessHistory} onStartAssess={()=>setAssessStage("assessing")} />;
    }
    if (screen === "phases") return <PhasesLib content={content} />;
    if (screen === "modules") return <ModulesLib content={content} />;
    if (screen === "journal") return <Journal token={user.access_token} userId={user.id} />;
    if (screen === "profile") return <Profile user={user} assessHistory={assessHistory} />;
    if (screen === "admin") return <Admin token={user.access_token} content={content} setContent={setContent} notify={notify} />;
  };

  const today = new Date().toLocaleDateString("fr-CA", { weekday:"short", day:"numeric", month:"short" });

  return (
    <>
      <style>{css}</style>
      <div className="app-layout">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen?"expanded":""}`}
          onMouseEnter={()=>setSidebarOpen(true)} onMouseLeave={()=>setSidebarOpen(false)}>
          <div className="sidebar-logo" onClick={()=>goTo("dashboard")}>○</div>
          {navItems.map(item=>(
            <button key={item.id} className={`nav-item ${screen===item.id?"active":""}`} onClick={()=>goTo(item.id)}>
              <span style={{ fontSize:18, flexShrink:0 }}>{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
          <div className="sidebar-bottom">
            <div className="user-avatar" onClick={()=>goTo("profile")}>{user.prenom?.[0]?.toUpperCase()||"?"}</div>
            {sidebarOpen && <div style={{ fontSize:12, color:BRAND.gray, paddingLeft:4, marginTop:4 }}>{user.prenom}</div>}
          </div>
        </div>

        {/* Main */}
        <div className={`main-content ${sidebarOpen?"expanded":""}`}>
          <div className="top-bar">
            <div>
              <div style={{ fontSize:13, color:BRAND.gray }}>{today}</div>
              {todayPhase && assessStage==="idle" && (
                <div style={{ fontSize:12, color:BRAND.grayLight, marginTop:2, display:"flex", alignItems:"center", gap:5 }}>
                  <span>{PHASES[todayPhase]?.emoji}</span> Phase {PHASES[todayPhase]?.name} aujourd'hui
                </div>
              )}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              {assessStage==="idle" && (
                <button className="btn-primary" style={{ fontSize:12, padding:"8px 14px" }} onClick={()=>{ setScreen("dashboard"); setAssessStage("assessing"); }}>
                  {todayPhase?"Réévaluer":"Évaluation ✨"}
                </button>
              )}
              <div className="user-avatar" onClick={()=>goTo("profile")}>{user.prenom?.[0]?.toUpperCase()||"?"}</div>
            </div>
          </div>

          {loadingContent && screen==="dashboard" && assessStage==="idle" ? <Spinner /> : renderContent()}
        </div>

        {/* Mobile nav */}
        <div className="bottom-nav">
          {navItems.slice(0,5).map(item=>(
            <div key={item.id} className={`bottom-nav-item ${screen===item.id?"active":""}`} onClick={()=>goTo(item.id)}>
              <span>{item.icon}</span><span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {notif && <Notif msg={notif} onClose={()=>setNotif(null)} />}
    </>
  );
}
