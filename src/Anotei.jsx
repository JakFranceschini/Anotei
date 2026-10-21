import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getDatabase, ref as dbRef, onValue, set as dbSet, update as dbUpdate, remove as dbRemove, runTransaction } from "firebase/database";

/* ---------- Firebase ---------- */
const firebaseConfig = {
  apiKey: "AIzaSyC5Ksfg-0N4_J2AxyeqNu4uL6ZbKdbWTKc",
  authDomain: "anotei-f5d92.firebaseapp.com",
  databaseURL: "https://anotei-f5d92-default-rtdb.firebaseio.com",
  projectId: "anotei-f5d92",
  storageBucket: "anotei-f5d92.firebasestorage.app",
  messagingSenderId: "170362988976",
  appId: "1:170362988976:web:c96086a67c4dbbabd1ce75",
  measurementId: "G-ZTWRMH8D5X",
};
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
// O Analytics só funciona em navegadores compatíveis; se não der, o app segue normalmente.
analyticsSupported().then((ok) => { if (ok) getAnalytics(firebaseApp); }).catch(() => {});

const NOTES_PATH = "anotei/notes";
const CATS_PATH = "anotei/categories";

// Formato único de nota/categoria, para comparar o que está local com o que está no banco.
const normNote = (id, n) => ({
  id,
  title: n.title ?? "",
  text: n.text ?? "",
  image: n.image ?? null,
  cat: n.cat ?? null,
  createdAt: n.createdAt ?? 0,
  updatedAt: n.updatedAt ?? n.createdAt ?? 0,
});
const normCat = (id, c, order) => ({ id, name: c.name ?? "", order: c.order ?? order ?? 0 });

/* ---------- Estilos ---------- */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

/* Zera a moldura que o template do Vite coloca em volta do app (margem, padding, fundo escuro). */
html, body, #root {
  margin: 0 !important;
  padding: 0 !important;
  border: 0 !important;
  width: 100% !important;
  max-width: none !important;
  min-height: 100%;
  display: block !important;
  text-align: left !important;
  background: #e5e7e9 !important;
  color-scheme: light;
}

.anotei, .anotei * { box-sizing: border-box; }

.anotei {
  --ink: #1f1f1f;
  --muted: #b3b8bc;
  --dark: #2a2a2a;
  --r: 16px;                            /* único raio de borda do app */
  --col: 80vw;                           /* coluna de conteúdo: 80% da largura da tela */
  --gut: clamp(14px, 4vw, 56px);         /* margem lateral da página */
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(14px, 4vw, 56px);
  font-family: 'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(900px 600px at 88% 0%, #cfe5ed 0%, transparent 62%),
    radial-gradient(760px 520px at 0% 100%, #f0dde4 0%, transparent 62%),
    #e5e7e9;
  background-attachment: fixed;
}

.anotei, .anotei * { -webkit-tap-highlight-color: transparent; }
.anotei button { font-family: inherit; cursor: pointer; }
.anotei button:focus:not(:focus-visible) { outline: none; }
.anotei button { -webkit-user-select: none; user-select: none; }
.anotei button:focus-visible,
.anotei input:focus-visible,
.anotei textarea:focus-visible {
  outline: 2px solid var(--dark);
  outline-offset: 3px;
}
/* Título e descrição ficam sem contorno: o cursor já mostra onde você está digitando. */
.anotei .input:focus-visible { outline: none; }

.wrap { max-width: 1120px; margin: 0 auto; }
/* Telas grandes: o conteúdo ocupa 50% da largura, igual à página da nota (a barra superior fica de fora). */
@media (min-width: 900px) {
  .wrap { width: min(var(--col), 100%); max-width: none; }
}

/* ----- Vidro ----- */
.glass {
  background: linear-gradient(140deg, rgba(247,247,247,.96) 0%, rgba(240,242,243,.93) 55%, rgba(226,238,243,.92) 100%);
  box-shadow:
    0 40px 70px -30px rgba(60,90,110,.38),
    0 8px 24px -12px rgba(60,90,110,.16),
    inset 0 1px 0 rgba(255,255,255,.95);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* ----- Cabeçalho ----- */
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.brand { display: flex; align-items: center; gap: 14px; min-width: 0; color: #9aa0a4; }
.brand h1 {
  margin: 0;
  color: var(--ink);
  font-size: clamp(1.3rem, 2.4vw, 1.7rem);
  font-weight: 600;
  letter-spacing: -.01em;
  white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.count { color: var(--muted); font-weight: 500; font-size: .95rem; margin-left: 4px; }

.icon-btn {
  width: 42px; height: 42px;
  flex: none;
  display: grid; place-items: center;
  border: 0; border-radius: var(--r);
  background: transparent;
  color: var(--ink);
  transition: background .15s ease;
}
.icon-btn:hover { background: rgba(0,0,0,.06); }

/* ----- Menu ----- */
.menu { position: relative; }
.menu-pop {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 20;
  min-width: 210px; padding: 6px;
  border-radius: var(--r);
  background: rgba(255,255,255,.97);
  box-shadow: 0 18px 40px -12px rgba(40,70,90,.35), 0 0 0 1px rgba(0,0,0,.04);
}
.menu-item {
  display: block; width: 100%; text-align: left;
  padding: 12px 14px; border: 0; border-radius: var(--r);
  background: transparent; color: var(--ink);
  font-size: .9rem; font-weight: 500;
}
.menu-item:hover:not(:disabled) { background: rgba(0,0,0,.05); }
.menu-item:disabled { color: var(--muted); cursor: default; }

/* ==========================  HOME  ========================== */
.home { padding-bottom: 110px; }
.search {
  display: block;
  margin-top: 22px;
  width: 100%; max-width: 520px; height: 50px;
  padding: 0 22px;
  border: 1px solid rgba(0,0,0,.06); border-radius: var(--r);
  background: rgba(255,255,255,.7);
  font: 500 .9rem 'Manrope', system-ui, sans-serif; color: var(--ink);
}
.search::placeholder { color: #b9bdc0; }

.notes {
  list-style: none; margin: 26px 0 0; padding: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  /* Todos os cards têm a mesma altura (a linha do grid é fixa e o card ocupa ela toda). */
  --note-h: 120px;
  grid-auto-rows: var(--note-h);
  align-items: stretch;
}

.category-grid {
  list-style: none; margin: 20px 0 0; padding: 0;
  display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px;
}
.category-card {
  position: relative; isolation: isolate; overflow: hidden;
  width: 100%; min-height: 100px; padding: 12px 14px; border-radius: var(--r);
  display: flex; flex-direction: column; align-items: stretch; justify-content: space-between; gap: 8px;
  border: 1px solid rgba(255,255,255,.78); color: var(--ink); text-align: left;
  background: rgba(255,255,255,.34);
  cursor: pointer; box-shadow: 0 18px 35px -24px rgba(60,90,110,.45), inset 0 1px 0 rgba(255,255,255,.9);
  backdrop-filter: blur(28px) saturate(145%); -webkit-backdrop-filter: blur(28px) saturate(145%);
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
}
.category-card:hover { transform: translateY(-3px); border-color: rgba(255,255,255,.98); background: rgba(255,255,255,.48); box-shadow: 0 25px 40px -24px rgba(60,90,110,.52), inset 0 1px 0 #fff; }
.category-card:active { transform: translateY(-1px); }
.category-card:focus-visible { outline: 2px solid var(--dark); outline-offset: 3px; }
.category-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.category-count { min-width: 28px; height: 25px; padding: 0 8px; display: inline-grid; place-items: center; border: 1px solid rgba(0,0,0,.045); border-radius: var(--r); background: rgba(255,255,255,.65); color: #747c81; font-size: .73rem; font-weight: 600; }
.category-entry { position: relative; min-width: 0; }
.category-delete { position: absolute; z-index: 2; top: 13px; right: 13px; width: 32px; height: 32px; display: grid; place-items: center; padding: 0; border: 1px solid rgba(0,0,0,.05); border-radius: var(--r); background: rgba(255,255,255,.7); color: #8b9296; cursor: pointer; transition: color .15s ease, background .15s ease; }
.category-delete:hover { background: #fff; color: #b34444; }
.category-delete svg { width: 16px; height: 16px; }
.category-entry .category-top { justify-content: flex-start; }
.category-copy { display: grid; gap: 5px; min-width: 0; }
.category-card strong { overflow: hidden; font-size: .94rem; font-weight: 600; line-height: 1.25; text-overflow: ellipsis; }
.category-card .category-hint { color: #8f959a; font-size: .73rem; font-weight: 500; }
.category-card.add-category { border-style: dashed; border-color: rgba(255,255,255,.78); background: rgba(255,255,255,.34); }
.category-back {
  display: inline-flex; align-items: center; gap: 9px;
  margin: 20px 0 -6px; padding: 10px 16px;
  border: 1px solid rgba(255,255,255,.86); border-radius: var(--r);
  background: rgba(255,255,255,.52); color: #555e63;
  box-shadow: 0 10px 24px -18px rgba(40,65,78,.45), inset 0 1px 0 rgba(255,255,255,.9);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  font: 600 .83rem 'Manrope', system-ui, sans-serif; cursor: pointer;
  transition: background .16s ease, color .16s ease, transform .16s ease, box-shadow .16s ease;
}
.category-back:hover { transform: translateY(-1px); background: rgba(255,255,255,.82); color: var(--ink); box-shadow: 0 14px 28px -18px rgba(40,65,78,.55), inset 0 1px 0 #fff; }
.category-back:focus-visible { outline: 2px solid var(--dark); outline-offset: 3px; }
.category-back svg { width: 16px; height: 16px; }
/* Voltar no corpo da página (acima da nota e do nome da categoria). */
.category-back.back-top {
  flex: none; align-self: flex-start; margin: 0 0 12px;
  background: var(--dark); border-color: var(--dark); color: #fff;
  box-shadow: 0 10px 22px -12px rgba(0,0,0,.5);
  backdrop-filter: none; -webkit-backdrop-filter: none;
}
.category-back.back-top:hover { background: #404040; border-color: #404040; color: #fff; box-shadow: 0 12px 24px -12px rgba(0,0,0,.55); }

.note {
  position: relative;
  display: flex; flex-direction: column;
  min-width: 0;
  border-radius: var(--r);
  padding: 6px 6px 8px;
  cursor: pointer;
  transition: box-shadow .15s ease;
  /* Vidro branco: fundo branco translúcido, com desfoque do que está atrás. */
  background: rgba(255,255,255,.28);
  border: 1px solid rgba(255,255,255,.7);
  box-shadow:
    0 22px 44px -22px rgba(60,90,110,.35),
    inset 0 1px 0 rgba(255,255,255,.5);
  backdrop-filter: blur(40px) saturate(150%);
  -webkit-backdrop-filter: blur(40px) saturate(150%);
}
.note:hover {
  background: rgba(255,255,255,.4);
  box-shadow:
    0 30px 54px -22px rgba(60,90,110,.45),
    inset 0 1px 0 rgba(255,255,255,.6);
}
.note-open {
  display: flex; flex-direction: column; gap: 8px;
  width: 100%; min-width: 0;
  flex: 1 1 auto; min-height: 0; overflow: hidden;
  padding: 14px 14px 0;
  border: 0; border-radius: var(--r);
  background: transparent; color: inherit; text-align: left;
}
/* O botão abre a nota; o ::after estende a área de clique para o cartão todo. */
.note-open::after {
  content: "";
  position: absolute; inset: 0;
  border-radius: var(--r);
}
.note-open:focus-visible { outline: none; }
.note-open:focus-visible::after { outline: 2px solid var(--dark); outline-offset: 2px; }
.note h2 {
  flex: none; margin: 0; font-size: 1.02rem; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
/* O texto preenche o espaço que sobra no card; o que passar some com um degradê no fim. */
.note .note-rich {
  flex: 1 1 auto; min-height: 0;
  color: #444; font-size: .86rem; line-height: 1.5; font-weight: 500;
  overflow-wrap: anywhere; overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent);
  mask-image: linear-gradient(to bottom, #000 calc(100% - 22px), transparent);
}
.note .rich h1, .note .rich h2, .note .rich h3 { font-size: 1.1em; margin: 0; font-weight: 700; }
.note .rich a { pointer-events: none; }
.note img { display: block; flex: none; width: 100%; height: 90px; object-fit: cover; border-radius: var(--r); }
.note-foot { display: flex; align-items: center; justify-content: space-between; margin-top: -1px; padding: 0 6px 0 20px; } /* data a 10px do conteúdo: a linha tem 36px (botão) e o texto 14px, centralizado */
.note-foot time { color: var(--muted); font-size: .78rem; line-height: 14px; font-weight: 500; }
.note-foot .icon-btn { position: relative; z-index: 1; width: 36px; height: 36px; }

@media (min-width: 700px) {
  .notes { grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 22px; --note-h: 140px; }
  .category-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr)); gap: 18px; }
  .category-card { min-height: 112px; border-radius: var(--r); padding: 14px 18px; }
  .category-card strong { font-size: 1.06rem; }
  .category-card .category-hint { font-size: .8rem; }
  .note { border-radius: var(--r); padding: 10px 10px 12px; }
  .note-open { gap: 12px; padding: 22px 22px 0; border-radius: var(--r); }
  .note-open::after, .note-open:focus-visible::after { border-radius: var(--r); }
  .note h2 { font-size: 1.3rem; }
  .note .note-rich { font-size: 1rem; line-height: 1.55; }
  .note img { height: 120px; border-radius: var(--r); }
  .note-foot { padding: 0 10px 0 24px; }
  .note-foot time { font-size: .82rem; line-height: 14px; }
}

.empty {
  margin: 60px auto 0; max-width: 340px; text-align: center;
  color: #8f959a; font-size: .95rem; font-weight: 500; line-height: 1.6;
}
.empty .publish { margin-top: 22px; width: 100%; max-width: 220px; flex: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
.empty .publish svg { width: 20px; height: 20px; flex: none; }

.new-fab {
  position: fixed;
  /* Centralizado na horizontal: left/right 0 + margem automática (sem transform, que a animação usa). */
  left: 0; right: 0; margin-inline: auto;
  width: fit-content;
  bottom: max(22px, env(safe-area-inset-bottom));
  z-index: 10;
}

/* ----- Barra superior fixa ----- */
.anotei { --bar: 64px; }
.anotei.has-bar { padding-top: calc(var(--bar) + clamp(14px, 3vw, 28px)); }
.appbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 30;
  height: var(--bar);
  background: rgba(255,255,255,.55);
  border-bottom: 1px solid rgba(255,255,255,.75);
  box-shadow: 0 10px 28px -18px rgba(40,70,90,.4), inset 0 -1px 0 rgba(0,0,0,.03);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
}
.appbar-in {
  height: 100%; max-width: 1232px; margin: 0 auto;
  padding: 0 clamp(14px, 4vw, 56px);
  display: flex; align-items: center; gap: 14px;
}
/* Telas grandes: ícone, nome e botão ficam nas bordas da coluna de conteúdo (50% da largura). */
@media (min-width: 900px) {
  .appbar-in { width: min(var(--col), calc(100% - 2 * var(--gut))); max-width: none; padding: 0; }
}
.appbar .brand { gap: 10px; color: #6b7176; }
.appbar .brand svg { width: 28px; height: 28px; flex: none; }
.brand-logo { display: block; width: 34px; height: 34px; flex: none; object-fit: contain; }
.appbar .brand-logo { width: 38px; height: 38px; }
.appbar .brand h1 { font-size: 1.25rem; }
.appbar-right { margin-left: auto; flex: none; display: flex; align-items: center; gap: 10px; }
.appbar .appbar-right .category-back { margin: 0; }
.theme-toggle {
  flex: none; width: 40px; height: 40px; padding: 0;
  display: grid; place-items: center;
  border: 1px solid rgba(255,255,255,.86); border-radius: var(--r);
  background: rgba(255,255,255,.52); color: #555e63;
  box-shadow: 0 10px 24px -18px rgba(40,65,78,.45), inset 0 1px 0 rgba(255,255,255,.9);
  transition: transform .15s ease, background-color .15s ease, color .15s ease, border-color .15s ease;
}
.theme-toggle:hover { background: rgba(255,255,255,.82); color: var(--ink); }
.theme-toggle:active { transform: scale(.93); }
.theme-toggle svg { animation: theme-spin .35s cubic-bezier(.2, .8, .3, 1.2) backwards; }
@keyframes theme-spin { from { opacity: 0; transform: rotate(-70deg) scale(.6); } to { opacity: 1; transform: none; } }
.appbar .category-back { margin: 0 0 0 auto; flex: none; background: var(--dark); border-color: var(--dark); color: #fff; box-shadow: 0 10px 22px -12px rgba(0,0,0,.5); }
.appbar .category-back:hover { background: #404040; border-color: #404040; color: #fff; box-shadow: 0 12px 24px -12px rgba(0,0,0,.55); }

/* ==========================  EDITOR  ========================== */
.anotei.is-editor { padding: 0; }
.editor-wrap {
  width: min(var(--col), calc(100% - 2 * var(--gut)));
  height: 100vh;
  height: 100dvh;
  margin: 0 auto;
  padding: calc(var(--bar) + 2vh) 0 2vh;
  padding: calc(var(--bar) + 2dvh) 0 2dvh;
  display: flex; flex-direction: column; align-items: stretch;
}
.editor {
  width: 100%;
  display: flex; flex-direction: column;
  flex: 1; min-height: 0;
  border-radius: var(--r);
  --pad: clamp(16px, 3vw, 28px);
  padding: var(--pad);
  /* Mesmo vidro dos cartões da home: branco translúcido com desfoque do que está atrás. */
  background: rgba(255,255,255,.28);
  border: 1px solid rgba(255,255,255,.7);
  box-shadow:
    0 22px 44px -22px rgba(60,90,110,.35),
    inset 0 1px 0 rgba(255,255,255,.5);
  backdrop-filter: blur(40px) saturate(150%);
  -webkit-backdrop-filter: blur(40px) saturate(150%);
}
/* Em telas pequenas, 70% da largura ficaria apertado demais. */
@media (max-width: 899px) {
  /* Mesmo cartão de vidro das telas grandes: branco translúcido com desfoque, borda e cantos arredondados. */
  .editor-wrap { width: 100%; padding: calc(var(--bar) + 2dvh) 12px 2dvh; align-items: stretch; }
  .editor {
    --pad: clamp(14px, 4vw, 20px);
    padding: var(--pad);
  }
  .actions { margin-bottom: 0; }
}
.head-left { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; color: #9aa0a4; }
.head-left .icon-btn { color: var(--ink); margin-left: -8px; }
.head-title {
  flex: 1; min-width: 0; width: 100%; padding: 0; border: 0; border-radius: 0; background: transparent;
  color: var(--ink); font: 600 clamp(1.25rem, 2.4vw, 1.5rem)/1.3 'Manrope', system-ui, sans-serif; letter-spacing: -.01em;
  text-overflow: ellipsis;
}
.head-title::placeholder { color: #c3c7ca; }
.anotei .head-title:focus-visible { outline: none; }
.head-left h1 {
  margin: 0; color: var(--ink);
  font-size: clamp(1.25rem, 2.4vw, 1.5rem); font-weight: 600; letter-spacing: -.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}

.form { margin-top: 10px; display: flex; flex-direction: column; flex: 1; min-height: 0; }
.field.desc { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.preview, .actions, .tbar-wrap { flex: none; }
.field { margin-bottom: 26px; }
.field label {
  display: block;
  margin-bottom: 6px;
  font-size: 1.2rem; font-weight: 600; color: var(--ink);
  transition: font-size .2s ease, color .2s ease, font-weight .2s ease;
}
/* Rótulos "Título" e "Descrição" ficam ocultos na tela, mas continuam disponíveis para leitores de tela. */
.field label.sr-only {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
  overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0;
}
.field[data-filled="true"] label { font-size: .85rem; font-weight: 500; color: var(--muted); }

.input {
  display: block; width: 100%;
  padding: 0; border: 0; border-radius: 0;
  background: transparent; color: var(--ink);
  font: 500 .9rem/1.4 'Manrope', system-ui, sans-serif;
  resize: none; overflow: hidden;
}
.input::placeholder { color: #c3c7ca; font-weight: 500; }
.field[data-filled="true"] .input { font-size: 1.05rem; font-weight: 600; line-height: 1.5; }
.field[data-filled="true"] input.input { font-size: 1.4rem; line-height: 1.3; }
textarea.input { min-height: 96px; }

.preview { position: relative; margin: 4px 0 8px; }
.preview-img {
  height: clamp(130px, 26vw, 200px);
  border-radius: var(--r);
  overflow: hidden;
  -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
          mask-image: linear-gradient(to bottom, #000 55%, transparent 100%);
}
.preview-img img { display: block; width: 100%; height: 100%; object-fit: cover; }
.preview .remove {
  position: absolute; top: 10px; right: 10px;
  width: 34px; height: 34px;
  display: grid; place-items: center;
  border: 0; border-radius: var(--r);
  background: rgba(255,255,255,.92); color: var(--ink);
  box-shadow: 0 4px 12px rgba(0,0,0,.12);
}

.actions {
  position: relative;
  margin-top: auto;
  padding-top: 12px;
  margin-bottom: -8px; /* aproxima o "Salvo" da borda de baixo */
  display: flex; align-items: center; justify-content: space-between; gap: 14px;
}
.publish {
  flex: 0 1 190px; min-width: 0;
  height: 58px;
  border: 1.5px solid var(--dark); border-radius: var(--r);
  background: transparent; color: #333;
  font-size: 1rem; font-weight: 500;
  transition: background .2s ease, color .2s ease, opacity .2s ease;
}
.publish.ready { background: var(--dark); color: #fff; box-shadow: 0 10px 24px -10px rgba(0,0,0,.5); }
.publish:disabled { opacity: .5; cursor: not-allowed; }

.fabs { position: relative; flex: none; margin-left: auto; }
.status { color: var(--muted); font-size: .85rem; font-weight: 500; }
.fab {
  width: clamp(54px, 14vw, 62px); height: clamp(54px, 14vw, 62px);
  display: grid; place-items: center;
  border: 0; border-radius: var(--r);
  background: var(--dark); color: #fff;
  box-shadow: 0 12px 26px -8px rgba(0,0,0,.5);
}
.fab.new-fab {
  width: fit-content; height: 54px; padding: 0 22px 0 18px; gap: 8px;
  display: inline-flex; align-items: center; border-radius: var(--r);
  font: 600 .92rem 'Manrope', system-ui, sans-serif; white-space: nowrap;
}
.fab svg { transition: transform .2s ease; }
.fab[aria-expanded="true"] svg { transform: rotate(45deg); }

.minis {
  position: absolute; left: 50%; bottom: calc(100% + 12px);
  transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.mini {
  width: 38px; height: 38px;
  display: grid; place-items: center;
  border: 0; border-radius: var(--r);
  background: rgba(255,255,255,.96); color: var(--ink);
  box-shadow: 0 8px 18px -6px rgba(40,70,90,.4), 0 0 0 1px rgba(0,0,0,.04);
  animation: pop .18s ease-out both;
}
.mini:nth-child(2) { animation-delay: .04s; }
.mini[data-active="true"] { background: var(--dark); color: #fff; animation: pulse 1.2s ease-in-out infinite; }
@keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.85); } to { opacity: 1; transform: none; } }
@keyframes pulse { 50% { box-shadow: 0 0 0 7px rgba(42,42,42,.15); } }

/* ----- Texto formatado (editor e cartões) ----- */
.rich p, .rich div { margin: 0; }
.rich h1 { font-size: 1.6em; line-height: 1.25; font-weight: 700; margin: .4em 0 .2em; }
.rich h2 { font-size: 1.3em; line-height: 1.3; font-weight: 700; margin: .4em 0 .2em; }
.rich h3 { font-size: 1.12em; line-height: 1.3; font-weight: 700; margin: .4em 0 .2em; }
.rich b, .rich strong { font-weight: 700; }
.rich blockquote { margin: .4em 0; padding: 2px 0 2px 14px; border-left: 3px solid var(--muted); color: #555; }
.rich pre {
  margin: .5em 0; padding: 12px 14px; border-radius: var(--r);
  background: rgba(0,0,0,.06); border: 1px solid rgba(0,0,0,.06);
  font-family: 'Manrope', system-ui, sans-serif !important;
  font-size: .88em; line-height: 1.55; font-weight: 400;
  white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2;
}
.rich pre * { font-family: inherit !important; }
.rich ul, .rich ol { margin: .3em 0; padding-left: 1.4em; }
.rich hr { border: 0; border-top: 1.5px solid rgba(0,0,0,.18); margin: .8em 0; }
.rich a { color: #1a73e8; text-decoration: underline; }
.rich ul.todo { list-style: none; padding-left: 0; }
.rich ul.todo > li { position: relative; padding-left: 1.7em; }
.rich ul.todo > li::before {
  content: ""; position: absolute; left: 0; top: .2em; width: 1.05em; height: 1.05em;
  border: 1.8px solid #666; border-radius: 30%; cursor: pointer;
}
.rich ul.todo > li[data-checked="true"] { color: var(--muted); text-decoration: line-through; }
.rich ul.todo > li[data-checked="true"]::before {
  background: var(--dark) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E") center / 80% no-repeat;
  border-color: var(--dark);
}
.field[data-filled="true"] .editable { font-size: 1rem; font-weight: 500; line-height: 1.6; }
.editable {
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; outline: none; overflow-wrap: anywhere;
  /* a área rola, mas sem mostrar a barra de rolagem */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.editable::-webkit-scrollbar { display: none; width: 0; height: 0; }
.editable[data-empty="true"]::before {
  content: attr(data-placeholder); float: left; height: 0; color: #c3c7ca; pointer-events: none;
}

/* ----- Barra de ferramentas ----- */
.tbar-wrap {
  position: sticky; top: 10px; z-index: 6;
  width: 100%; max-width: 100%;
  margin: 0 0 16px 0; border-radius: var(--r);
  background: rgba(250,251,252,.82);
  border: 1px solid rgba(255,255,255,.8);
  box-shadow: 0 10px 28px -14px rgba(40,70,90,.4), inset 0 1px 0 rgba(255,255,255,.6);
  backdrop-filter: blur(32px) saturate(160%);
  -webkit-backdrop-filter: blur(32px) saturate(160%);
}
.tbar { display: flex; align-items: center; gap: 2px; padding: 6px 8px; overflow-x: auto; scrollbar-width: none; }
.tbar::-webkit-scrollbar { display: none; }
@media (min-width: 900px) { .tbar { flex-wrap: wrap; justify-content: center; overflow: visible; row-gap: 4px; } .tbar-wrap { margin-left: -5px; width: calc(100% + 10px); max-width: none; } .tbar { padding-left: 8px; } }
.tb {
  flex: none; min-width: 36px; height: 36px; padding: 0 8px;
  display: grid; place-items: center;
  border: 0; border-radius: var(--r); background: transparent; color: var(--ink);
  font: 600 .85rem 'Manrope', system-ui, sans-serif;
}
.tb:hover { background: rgba(0,0,0,.06); }
.tb[data-active="true"] { background: var(--dark); color: #fff; }
.tb.tb-m, .tb-sep.tb-m { display: none; }
.tb-aa { font-weight: 700; font-size: .95rem; letter-spacing: -.02em; }
.more-selects { display: flex; flex-wrap: wrap; gap: 8px; }
.more-selects .tsel { flex: 1 1 120px; max-width: none; margin: 0; }
.more-btns { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
.tb-sep { flex: none; width: 1px; height: 20px; margin: 0 6px; background: rgba(0,0,0,.12); }
.tsel {
  flex: none; height: 36px; padding: 0 8px; border: 0; border-radius: var(--r);
  background: rgba(0,0,0,.05); color: var(--ink);
  font: 500 .8rem 'Manrope', system-ui, sans-serif;
}
.tb-a { display: grid; justify-items: center; line-height: 1; font-weight: 700; font-size: 1rem; }
.tb-a span { width: 16px; height: 3px; margin-top: 2px; border-radius: 2px; border: 1px solid rgba(0,0,0,.12); }
.tb-hl { padding: 1px 6px; border-radius: 5px; font-weight: 700; color: #1f1f1f; }
.tpanel {
  position: absolute; top: calc(100% + 8px); z-index: 7;
  left: clamp(0px, var(--px, 0px), calc(100% - 404px));
  width: 404px; max-width: 100%;
  padding: 14px; border-radius: var(--r);
  /* O painel fica dentro da barra (que já tem desfoque), então o desfoque próprio não alcança o texto: o fundo precisa ser praticamente opaco. */
  background: rgba(252,253,253,.98);
  border: 1px solid rgba(255,255,255,.85);
  box-shadow: 0 18px 40px -12px rgba(40,70,90,.35), 0 0 0 1px rgba(0,0,0,.04);
}
.swatches { display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; max-width: 380px; }
.sw { aspect-ratio: 1; padding: 0; border: 1px solid rgba(0,0,0,.14); border-radius: 50%; }
.tpanel-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; font-size: .8rem; font-weight: 500; }
.tpanel-row input[type="color"] {
  -webkit-appearance: none; appearance: none;
  width: 32px; height: 32px; padding: 0; vertical-align: middle;
  border: 1px solid rgba(0,0,0,.14); border-radius: 50%; background: none; overflow: hidden; cursor: pointer;
}
.tpanel-row input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
.tpanel-row input[type="color"]::-webkit-color-swatch { border: 0; border-radius: 50%; }
.tpanel-row input[type="color"]::-moz-color-swatch { border: 0; border-radius: 50%; }
.tp-btn {
  height: 34px; padding: 0 14px; border: 1px solid rgba(0,0,0,.12); border-radius: var(--r);
  background: #fff; color: var(--ink); font-size: .8rem; font-weight: 500;
}
.tp-btn.primary { background: var(--dark); border-color: var(--dark); color: #fff; }
.link-in {
  flex: 1; min-width: 160px; height: 34px; padding: 0 14px;
  border: 1px solid rgba(0,0,0,.12); border-radius: var(--r); background: #fff;
  font: 500 .85rem 'Manrope', system-ui, sans-serif; color: var(--ink);
}

/* ----- Categorias e layout de telas grandes ----- */
.head-right { display: flex; align-items: center; gap: 8px; }
.chips { display: flex; gap: 8px; margin-top: 16px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
.chip {
  flex: none; height: 36px; padding: 0 16px; border: 1px solid rgba(0,0,0,.08); border-radius: var(--r);
  background: rgba(255,255,255,.6); color: var(--ink); font-size: .85rem; font-weight: 500;
}
.chip[data-active="true"] { background: var(--dark); border-color: var(--dark); color: #fff; }

.anotei.is-shell { padding: 16px; height: 100vh; height: 100dvh; min-height: 0; overflow: hidden; }
.shell { display: grid; grid-template-columns: 250px 330px minmax(0, 1fr); gap: 16px; height: 100%; }
.pane { min-height: 0; display: flex; flex-direction: column; padding: 18px; border-radius: var(--r); }
.cat-list { flex: 1; min-height: 0; overflow-y: auto; margin-top: 18px; display: flex; flex-direction: column; gap: 2px; }
.cat-row { position: relative; display: flex; align-items: center; }
.cat-list > .cat { flex: none; }
.cat {
  flex: 1; min-width: 0; height: 42px; padding: 0 14px;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  border: 0; border-radius: var(--r); background: transparent; color: var(--ink);
  font-size: .92rem; font-weight: 500; text-align: left;
}
.cat span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cat em { font-style: normal; color: var(--muted); font-size: .8rem; }
.cat:hover { background: rgba(0,0,0,.05); }
.cat[data-active="true"] { background: var(--dark); color: #fff; }
.cat[data-active="true"] em { color: rgba(255,255,255,.6); }
.cat.add { flex: none; width: 100%; margin-top: 10px; justify-content: flex-start; color: #6b7176; }
.cat-act {
  position: absolute; top: 6px; width: 30px; height: 30px; display: grid; place-items: center;
  border: 0; border-radius: var(--r); background: transparent; color: #8f959a; opacity: 0;
}
.cat-act:nth-of-type(2) { right: 40px; }
.cat-act:nth-of-type(3) { right: 8px; }
.cat-row:hover .cat-act, .cat-row:focus-within .cat-act { opacity: 1; }
.cat-row:hover .cat em, .cat-row:focus-within .cat em { opacity: 0; }
.cat-row:hover .cat[data-active="true"] ~ .cat-act { color: #fff; }
.cat-row:hover .cat[data-active="true"] ~ .cat-act:hover { background: rgba(255,255,255,.18); }
.cat-act:hover { background: rgba(0,0,0,.06); color: var(--ink); }
.cat-in {
  margin-top: 10px; height: 42px; padding: 0 14px; border: 1px solid rgba(0,0,0,.1); border-radius: var(--r);
  background: #fff; color: var(--ink); font: 500 .9rem 'Manrope', system-ui, sans-serif;
}
.list .head h2 { margin: 0; font-size: 1.2rem; font-weight: 600; }
.list .search { margin-top: 14px; max-width: none; height: 44px; }
.nlist { list-style: none; margin: 0 -18px; padding: 18px 18px 22px; flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.nitem {
  width: 100%; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px;
  border: 1px solid rgba(255,255,255,.8); border-radius: var(--r); color: var(--ink); text-align: left;
  background: rgba(255,255,255,.55);
  box-shadow: 0 14px 28px -18px rgba(60,90,110,.4), inset 0 1px 0 rgba(255,255,255,.7);
  transition: background .15s ease, box-shadow .15s ease;
}
.nitem:hover { background: rgba(255,255,255,.8); }
.nitem[data-active="true"] { background: var(--dark); border-color: var(--dark); color: #fff; box-shadow: 0 14px 26px -12px rgba(0,0,0,.35); }
.nitem[data-active="true"] span { color: rgba(255,255,255,.75); }
.nitem[data-active="true"] time { color: rgba(255,255,255,.5); }
.nitem strong { font-size: .95rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nitem span {
  color: #666; font-size: .82rem; line-height: 1.4; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.nitem time { color: var(--muted); font-size: .75rem; }
.stage { min-height: 0; overflow: auto; border-radius: var(--r); display: flex; }
.stage .editor { flex: 1; min-height: 100%; border-radius: var(--r); }
.stage-empty { margin: auto; color: #8f959a; font-weight: 500; }

.note-date { margin-bottom: 18px; color: var(--muted); font-size: .85rem; font-weight: 500; }

/* Telas pequenas: só os botões principais na barra; o resto fica no painel "Aa". */
@media (max-width: 899px) {
  .tbar-wrap { width: 100%; margin: 4px 0 12px; border-radius: var(--r); }
  .tbar { padding: 4px 6px; gap: 0; overflow: hidden; justify-content: space-between; }
  .tb-x { display: none !important; }
  .tb.tb-m { display: grid; }
  .tb-sep.tb-m { display: block; }
  .tb { flex: 1 1 0; min-width: 0; max-width: 36px; height: 36px; padding: 0; }
  .tsel { height: 40px; max-width: 132px; padding: 0 6px; margin: 0 2px; text-overflow: ellipsis; }
  .tb-sep { margin: 0 3px; }
  .swatches { max-width: none; gap: 5px; }
  .tpanel { left: 0; right: 0; width: auto; }
}

/* Menus suspensos no estilo da barra (navegadores que permitem estilizar a lista; nos demais, usa a lista padrão). */
@supports (appearance: base-select) {
  .tsel, .tsel::picker(select) { appearance: base-select; }
  .tsel {
    display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
    padding: 0 12px; border-radius: var(--r); line-height: 1;
  }
  .tsel::picker-icon {
    content: ""; width: 6px; height: 6px; margin-top: -3px;
    border-right: 1.8px solid #6b7176; border-bottom: 1.8px solid #6b7176;
    transform: rotate(45deg); transition: rotate .15s ease;
  }
  .tsel:open::picker-icon { rotate: 180deg; }
  .tsel::picker(select) {
    margin-top: 8px; padding: 6px;
    border: 1px solid rgba(255,255,255,.75); border-radius: var(--r);
    background: rgba(255,255,255,.78);
    backdrop-filter: blur(18px) saturate(160%);
    -webkit-backdrop-filter: blur(18px) saturate(160%);
    box-shadow: 0 18px 40px -12px rgba(40,70,90,.35), 0 0 0 1px rgba(0,0,0,.04);
  }
  .tsel option {
    padding: 9px 14px; border-radius: var(--r); color: var(--ink);
    font: 500 .85rem 'Manrope', system-ui, sans-serif;
  }
  .tsel option:hover, .tsel option:focus-visible { background: rgba(0,0,0,.06); outline: none; }
  .tsel option:checked { background: var(--dark); color: #fff; }
  .tsel option::checkmark { display: none; }
}

/* ----- Aviso ----- */
.toast {
  position: fixed; left: 50%; bottom: max(20px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 50;
  max-width: calc(100vw - 32px);
  padding: 13px 22px;
  border-radius: var(--r);
  background: var(--dark); color: #fff;
  font-size: .9rem; font-weight: 500;
  box-shadow: 0 14px 30px -10px rgba(0,0,0,.5);
  animation: toast-in .2s ease-out both;
}
@keyframes toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ----- Confirmação de exclusão ----- */
.confirm-backdrop {
  position: fixed; inset: 0; z-index: 80; display: grid; place-items: center;
  padding: 20px; background: rgba(28,35,39,.24);
  backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  animation: confirm-fade .16s ease-out both;
}
.confirm-dialog {
  width: min(100%, 440px); padding: clamp(24px, 5vw, 34px);
  border: 1px solid rgba(255,255,255,.86); border-radius: var(--r);
  background: linear-gradient(145deg, rgba(255,255,255,.94), rgba(241,245,246,.86));
  color: var(--ink); box-shadow: 0 28px 80px -26px rgba(30,53,65,.42), inset 0 1px 0 #fff;
  backdrop-filter: blur(28px) saturate(150%); -webkit-backdrop-filter: blur(28px) saturate(150%);
  animation: confirm-pop .18s ease-out both;
}
.confirm-dialog h2 { margin: 0; font-size: 1.2rem; font-weight: 600; letter-spacing: -.02em; }
.confirm-dialog p { margin: 12px 0 26px; color: #737b80; font-size: .92rem; line-height: 1.55; }
.category-name-input { display: block; width: 100%; height: 46px; margin: 0 0 24px; padding: 0 15px; border: 1px solid rgba(0,0,0,.08); border-radius: var(--r); background: rgba(255,255,255,.72); color: var(--ink); font: 500 .9rem 'Manrope', system-ui, sans-serif; }
.category-name-input::placeholder { color: #aab0b4; }
.anotei .category-name-input:focus, .anotei .category-name-input:focus-visible { outline: none; }
.confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
.confirm-btn { min-height: 42px; padding: 0 18px; border: 1px solid rgba(0,0,0,.08); border-radius: var(--r); background: rgba(255,255,255,.74); color: var(--ink); font: 500 .87rem 'Manrope', system-ui, sans-serif; }
.confirm-btn:hover { background: #fff; }
.confirm-btn.danger { border-color: var(--dark); background: var(--dark); color: #fff; }
.confirm-btn.danger:hover { background: #404040; }
.confirm-btn:disabled { opacity: .45; cursor: default; }
@keyframes confirm-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes confirm-pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (max-width: 480px) { .confirm-actions { flex-direction: column-reverse; } .confirm-btn { width: 100%; } }

/* ----- Animações suaves ----- */
/* "backwards": o estado inicial vale só durante a animação, então hover e clique (transform) continuam funcionando depois. */
@keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes view-in { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes pop-in { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: none; } }
@keyframes drop-in { from { opacity: 0; transform: translateY(-6px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes bar-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }

/* Entrada dos cartões, em sequência */
.notes > li, .category-grid > li, .nlist > li { animation: rise .42s cubic-bezier(.2, .7, .3, 1) backwards; }
.notes > li:nth-child(2), .category-grid > li:nth-child(2), .nlist > li:nth-child(2) { animation-delay: .04s; }
.notes > li:nth-child(3), .category-grid > li:nth-child(3), .nlist > li:nth-child(3) { animation-delay: .08s; }
.notes > li:nth-child(4), .category-grid > li:nth-child(4), .nlist > li:nth-child(4) { animation-delay: .12s; }
.notes > li:nth-child(5), .category-grid > li:nth-child(5), .nlist > li:nth-child(5) { animation-delay: .16s; }
.notes > li:nth-child(6), .category-grid > li:nth-child(6), .nlist > li:nth-child(6) { animation-delay: .2s; }
.notes > li:nth-child(n+7), .category-grid > li:nth-child(n+7), .nlist > li:nth-child(n+7) { animation-delay: .24s; }

/* Telas e componentes que aparecem */
.editor { animation: view-in .34s cubic-bezier(.2, .7, .3, 1) backwards; }
.appbar { animation: bar-in .3s ease-out backwards; }
.tbar-wrap { animation: rise .36s .06s cubic-bezier(.2, .7, .3, 1) backwards; }
.empty, .stage-empty { animation: fade-in .4s ease-out backwards; }
.menu-pop { transform-origin: top right; animation: drop-in .16s ease-out backwards; }
.tpanel { animation: drop-in .16s ease-out backwards; }
.fab.new-fab { animation: pop-in .32s .1s cubic-bezier(.2, .8, .3, 1.2) backwards; }

/* Hover e clique */
.note { transition: transform .22s ease, box-shadow .22s ease, background .22s ease; }
.note:hover { transform: translateY(-2px); }
.note:active { transform: translateY(0) scale(.992); }
.nitem { transition: background .15s ease, box-shadow .2s ease, transform .18s ease; }
.nitem:hover:not([data-active="true"]) { transform: translateX(2px); }
.icon-btn, .fab, .chip, .tb, .cat, .tp-btn, .confirm-btn, .category-back {
  transition: transform .15s ease, background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .2s ease, opacity .2s ease;
}
.publish { transition: background .2s ease, color .2s ease, opacity .2s ease, transform .15s ease, box-shadow .2s ease; }
.icon-btn:active, .fab:active, .chip:active, .tb:active, .cat:active, .tp-btn:active,
.confirm-btn:not(:disabled):active, .publish:not(:disabled):active { transform: scale(.95); }
.category-back:active { transform: translateY(0) scale(.97); }
.menu-item { transition: background .15s ease; }

@media (prefers-reduced-motion: reduce) {
  .anotei *, .toast, .confirm-dialog, .confirm-backdrop { animation: none !important; transition: none !important; }
}

/* ==========================  TEMA ESCURO  ========================== */
html[data-theme="dark"],
html[data-theme="dark"] body,
html[data-theme="dark"] #root { background: #0e1113 !important; color-scheme: dark; }

.anotei.dark {
  --ink: #ebeef0;
  --muted: #7b848a;
  --dark: #e8ebed;      /* no escuro, os botões "cheios" ficam claros (com texto escuro) */
  --on-dark: #14181a;
  color-scheme: dark;
  background:
    radial-gradient(900px 600px at 88% 0%, #16303b 0%, transparent 62%),
    radial-gradient(760px 520px at 0% 100%, #2b1823 0%, transparent 62%),
    #0e1113;
  background-attachment: fixed;
}
.anotei.dark .glass {
  background: linear-gradient(140deg, rgba(40,46,50,.92) 0%, rgba(30,35,38,.92) 55%, rgba(26,38,44,.92) 100%);
  box-shadow: 0 40px 70px -30px rgba(0,0,0,.7), 0 8px 24px -12px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
}
.anotei.dark .brand { color: #9aa3a8; }
.anotei.dark .icon-btn:hover { background: rgba(255,255,255,.08); }

/* Barra superior */
.anotei.dark .appbar {
  background: rgba(16,19,21,.6);
  border-bottom-color: rgba(255,255,255,.08);
  box-shadow: 0 10px 28px -18px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.03);
}
.anotei.dark .appbar .brand { color: #9aa3a8; }
.anotei.dark .appbar .category-back { background: var(--dark); border-color: var(--dark); color: var(--on-dark); box-shadow: 0 10px 22px -12px rgba(0,0,0,.7); }
.anotei.dark .appbar .category-back:hover { background: #fff; border-color: #fff; color: var(--on-dark); }
.anotei.dark .theme-toggle { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); color: #d6dbde; box-shadow: 0 10px 24px -18px rgba(0,0,0,.8); }
.anotei.dark .theme-toggle:hover { background: rgba(255,255,255,.13); color: #fff; }

/* Menu, busca, categorias */
.anotei.dark .menu-pop { background: rgba(32,37,41,.97); box-shadow: 0 18px 40px -12px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.07); }
.anotei.dark .menu-item:hover:not(:disabled) { background: rgba(255,255,255,.07); }
.anotei.dark .search { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }
.anotei.dark .search::placeholder { color: #6f777c; }
.anotei.dark .category-card,
.anotei.dark .category-card.add-category { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.09); box-shadow: 0 18px 35px -24px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06); }
.anotei.dark .category-card:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.17); box-shadow: 0 25px 40px -24px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.08); }
.anotei.dark .category-count { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.08); color: #aab2b7; }
.anotei.dark .category-card .category-hint { color: #8b949a; }
.anotei.dark .category-delete { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.08); color: #9aa3a8; }
.anotei.dark .category-delete:hover { background: rgba(255,255,255,.15); color: #ff8f8f; }
.anotei.dark .category-back { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); color: #b6bec3; box-shadow: none; }
.anotei.dark .category-back:hover { background: rgba(255,255,255,.13); color: var(--ink); }
.anotei.dark .category-back.back-top { background: var(--dark); border-color: var(--dark); color: var(--on-dark); box-shadow: 0 10px 22px -12px rgba(0,0,0,.7); }
.anotei.dark .category-back.back-top:hover { background: #fff; border-color: #fff; color: var(--on-dark); }

/* Cartões de nota e editor */
.anotei.dark .note,
.anotei.dark .editor { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.09); box-shadow: 0 22px 44px -22px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06); }
.anotei.dark .note:hover { background: rgba(255,255,255,.09); box-shadow: 0 30px 54px -22px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.08); }
.anotei.dark .note .note-rich { color: #b9c0c4; }
.anotei.dark .empty, .anotei.dark .stage-empty { color: #7d868c; }
.anotei.dark .head-left { color: #9aa3a8; }
.anotei.dark .head-title::placeholder,
.anotei.dark .input::placeholder,
.anotei.dark .editable[data-empty="true"]::before { color: #5d666b; }
.anotei.dark .preview .remove { background: rgba(30,34,37,.92); color: var(--ink); box-shadow: 0 4px 12px rgba(0,0,0,.5); }

/* Botões principais */
.anotei.dark .publish { color: #dfe3e5; }
.anotei.dark .publish.ready { background: var(--dark); color: var(--on-dark); box-shadow: 0 10px 24px -10px rgba(0,0,0,.7); }
.anotei.dark .fab { background: var(--dark); color: var(--on-dark); box-shadow: 0 12px 26px -8px rgba(0,0,0,.7); }
.anotei.dark .mini { background: rgba(44,50,55,.96); color: var(--ink); box-shadow: 0 8px 18px -6px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.08); }
.anotei.dark .mini[data-active="true"] { background: var(--dark); color: var(--on-dark); }

/* Texto formatado */
.anotei.dark .rich blockquote { color: #aab2b7; }
.anotei.dark .rich pre { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.1); }
.anotei.dark .rich hr { border-top-color: rgba(255,255,255,.2); }
.anotei.dark .rich a { color: #8ab4f8; }
.anotei.dark .rich ul.todo > li::before { border-color: #8b949a; }
.anotei.dark .rich ul.todo > li[data-checked="true"]::before {
  background: var(--dark) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2314181a' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 12.5 4.5 4.5L19 7.5'/%3E%3C/svg%3E") center / 80% no-repeat;
  border-color: var(--dark);
}
/* Texto que foi pintado de preto/cinza-escuro no tema claro continua legível */
.anotei.dark .rich font[color="#1f1f1f"],
.anotei.dark .rich font[color="#000000"],
.anotei.dark .rich [style*="color: rgb(31, 31, 31)"],
.anotei.dark .rich [style*="color: rgb(0, 0, 0)"] { color: inherit !important; }
/* Texto marcador: texto escuro sobre o fundo destacado */
.anotei.dark .rich [style*="background-color"]:not([style*="transparent"]) { color: #1f1f1f; }

/* Barra de ferramentas */
.anotei.dark .tbar-wrap { background: rgba(34,39,42,.85); border-color: rgba(255,255,255,.1); box-shadow: 0 10px 28px -14px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.05); }
.anotei.dark .tb:hover { background: rgba(255,255,255,.09); }
.anotei.dark .tb[data-active="true"] { background: var(--dark); color: var(--on-dark); }
.anotei.dark .tb-sep { background: rgba(255,255,255,.14); }
.anotei.dark .tsel { background: rgba(255,255,255,.08); color: var(--ink); }
.anotei.dark .tsel option { background: #1d2124; color: var(--ink); }
.anotei.dark .tb-a span { border-color: rgba(255,255,255,.25); }
.anotei.dark .tpanel { background: rgba(30,35,38,.99); border-color: rgba(255,255,255,.1); box-shadow: 0 18px 40px -12px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.05); }
.anotei.dark .sw, .anotei.dark .tpanel-row input[type="color"] { border-color: rgba(255,255,255,.28); }
.anotei.dark .tp-btn { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.14); color: var(--ink); }
.anotei.dark .tp-btn.primary { background: var(--dark); border-color: var(--dark); color: var(--on-dark); }
.anotei.dark .link-in { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.14); color: var(--ink); }
@supports (appearance: base-select) {
  .anotei.dark .tsel::picker-icon { border-color: #9aa3a8; }
  .anotei.dark .tsel::picker(select) { background: rgba(30,35,38,.94); border-color: rgba(255,255,255,.1); box-shadow: 0 18px 40px -12px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.05); }
  .anotei.dark .tsel option:hover, .anotei.dark .tsel option:focus-visible { background: rgba(255,255,255,.08); }
  .anotei.dark .tsel option:checked { background: var(--dark); color: var(--on-dark); }
}

/* Chips e listas (layout largo) */
.anotei.dark .chip { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.1); }
.anotei.dark .chip[data-active="true"] { background: var(--dark); border-color: var(--dark); color: var(--on-dark); }
.anotei.dark .cat:hover { background: rgba(255,255,255,.07); }
.anotei.dark .cat[data-active="true"] { background: var(--dark); color: var(--on-dark); }
.anotei.dark .cat[data-active="true"] em { color: rgba(0,0,0,.55); }
.anotei.dark .cat.add { color: #9aa3a8; }
.anotei.dark .cat-in { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); }
.anotei.dark .nitem { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.09); box-shadow: 0 14px 28px -18px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05); }
.anotei.dark .nitem:hover { background: rgba(255,255,255,.09); }
.anotei.dark .nitem span { color: #9aa3a8; }
.anotei.dark .nitem[data-active="true"] { background: var(--dark); border-color: var(--dark); color: var(--on-dark); }
.anotei.dark .nitem[data-active="true"] span { color: rgba(0,0,0,.65); }
.anotei.dark .nitem[data-active="true"] time { color: rgba(0,0,0,.5); }

/* Aviso e diálogos */
.anotei.dark .toast { background: var(--dark); color: var(--on-dark); box-shadow: 0 14px 30px -10px rgba(0,0,0,.7); }
.anotei.dark .confirm-backdrop { background: rgba(0,0,0,.55); }
.anotei.dark .confirm-dialog { background: linear-gradient(145deg, rgba(36,41,45,.97), rgba(26,30,33,.95)); border-color: rgba(255,255,255,.1); box-shadow: 0 28px 80px -26px rgba(0,0,0,.85), inset 0 1px 0 rgba(255,255,255,.06); }
.anotei.dark .confirm-dialog p { color: #98a2a8; }
.anotei.dark .category-name-input { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); }
.anotei.dark .category-name-input::placeholder { color: #6f777c; }
.anotei.dark .confirm-btn { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.12); color: var(--ink); }
.anotei.dark .confirm-btn:hover { background: rgba(255,255,255,.14); }
.anotei.dark .confirm-btn.danger { background: var(--dark); border-color: var(--dark); color: var(--on-dark); }
.anotei.dark .confirm-btn.danger:hover { background: #cdd2d5; }

/* ==========================  LEMBRETES  ========================== */
.anotei { --on-dark: #fff; }

/* ----- Alternador Notas / Lembretes e filtros ----- */
.seg {
  display: inline-flex; align-items: center; gap: 4px; max-width: 100%; padding: 4px;
  border: 1px solid rgba(255,255,255,.86); border-radius: var(--r);
  background: rgba(255,255,255,.52);
  box-shadow: 0 10px 24px -18px rgba(40,65,78,.45), inset 0 1px 0 rgba(255,255,255,.9);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
}
.seg button {
  display: inline-flex; align-items: center; gap: 7px;
  height: 38px; padding: 0 18px; border: 0; border-radius: var(--r);
  background: transparent; color: #6b7176;
  font: 600 .85rem 'Manrope', system-ui, sans-serif; white-space: nowrap;
  transition: background .18s ease, color .18s ease, transform .15s ease;
}
.seg button:hover:not([data-active="true"]) { background: rgba(0,0,0,.05); color: var(--ink); }
.seg button[data-active="true"] { background: var(--dark); color: var(--on-dark); }
.seg button:active { transform: scale(.96); }
.seg em {
  min-width: 20px; height: 20px; padding: 0 6px; display: inline-grid; place-items: center;
  border-radius: var(--r); background: rgba(0,0,0,.08);
  font-style: normal; font-size: .7rem; font-weight: 700;
}
.seg button[data-active="true"] em { background: rgba(255,255,255,.24); }
.seg.sm button { height: 34px; padding: 0 14px; font-size: .8rem; }
.seg.top { margin: 0 0 6px; }

/* ----- Lista ----- */
.rem-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; }
.rem-head .section-title { margin: 0; }
.rem-sub { margin: 4px 0 0; color: var(--muted); font-size: .85rem; font-weight: 500; }
.rem-filters { margin-top: 14px; }

.rem-progress { display: flex; align-items: center; gap: 12px; margin-top: 18px; color: var(--muted); font-size: .82rem; font-weight: 500; }
.rem-bar { flex: 1; height: 6px; border-radius: var(--r); background: rgba(0,0,0,.08); overflow: hidden; }
.rem-bar i { display: block; height: 100%; border-radius: inherit; background: var(--dark); transition: width .35s ease; }

.rem-day { margin-top: 26px; scroll-margin-top: calc(var(--bar) + 16px); }
.rem-day-title { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px 6px; font-size: .95rem; font-weight: 600; letter-spacing: -.01em; }
.rem-day-title span { color: var(--muted); font-size: .8rem; font-weight: 500; }
.rem-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }

.rem-item {
  position: relative; display: flex; align-items: center; gap: 12px; min-width: 0;
  padding: 10px 6px 10px 14px; border-radius: var(--r); cursor: pointer;
  /* Mesmo vidro das notas */
  background: rgba(255,255,255,.28);
  border: 1px solid rgba(255,255,255,.7);
  box-shadow: 0 22px 44px -22px rgba(60,90,110,.35), inset 0 1px 0 rgba(255,255,255,.5);
  backdrop-filter: blur(40px) saturate(150%); -webkit-backdrop-filter: blur(40px) saturate(150%);
  transition: background .2s ease, transform .22s ease, opacity .22s ease, box-shadow .22s ease;
  animation: fade-in .3s ease-out backwards;
}
.rem-item:hover { background: rgba(255,255,255,.4); }
.rem-item.leaving { opacity: 0; transform: translateX(14px) scale(.98); pointer-events: none; }

.rem-check {
  flex: none; width: 26px; height: 26px; padding: 0; display: grid; place-items: center;
  border: 2px solid #aab0b4; border-radius: var(--r); background: transparent; color: var(--on-dark);
  transition: background .18s ease, border-color .18s ease, transform .15s ease;
}
.rem-check.on { background: var(--dark); border-color: var(--dark); }
.rem-check:active { transform: scale(.88); }
.rem-body { flex: 1; min-width: 0; }
.rem-body p { margin: 0; font-size: .95rem; font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
.rem-item.done .rem-body p { color: var(--muted); text-decoration: line-through; }
.rem-time {
  flex: none; height: 25px; padding: 0 10px; display: inline-grid; place-items: center;
  border: 1px solid rgba(0,0,0,.045); border-radius: var(--r); background: rgba(255,255,255,.65);
  color: #747c81; font-size: .73rem; font-weight: 600;
}
.rem-actions { flex: none; display: flex; }
.rem-actions .icon-btn { width: 36px; height: 36px; color: #8b9296; }
.rem-actions .icon-btn:hover { color: var(--ink); }

@media (min-width: 700px) {
  .rem-item { padding: 12px 10px 12px 18px; }
  .rem-body p { font-size: 1rem; }
}

/* ----- Botões flutuantes ----- */
.rem-dock {
  position: fixed; left: 0; right: 0; margin-inline: auto; width: fit-content; z-index: 10;
  bottom: max(22px, env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 10px;
}
.rem-dock .fab.new-fab { position: static; margin: 0; }
.rem-dock .fab:not(.new-fab) { width: 54px; height: 54px; animation: pop-in .32s .16s cubic-bezier(.2, .8, .3, 1.2) backwards; }

/* ----- Formulário e seletores ----- */
.rem-form h2 + .rem-row { margin-top: 18px; }
.rem-row { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
.rem-row .rem-field { flex: 1; min-width: 0; }
.rem-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
.rem-lbl { display: grid; gap: 6px; min-width: 0; }
.rem-lbl > span { color: #737b80; font-size: .78rem; font-weight: 600; }

.rem-field {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; height: 46px; padding: 0 15px;
  border: 1px solid rgba(0,0,0,.08); border-radius: var(--r);
  background: rgba(255,255,255,.72); color: var(--ink);
  font: 500 .9rem 'Manrope', system-ui, sans-serif; text-align: left;
}
.rem-field::placeholder { color: #aab0b4; }
.rem-field .ph { color: #aab0b4; }
.rem-field svg { flex: none; color: #8b9296; }
.rem-field.open { border-color: var(--dark); }
.anotei input.rem-field:focus, .anotei input.rem-field:focus-visible { outline: none; border-color: var(--dark); }

.rem-pick { position: relative; }
.rem-pop {
  position: absolute; top: calc(100% + 8px); left: 0; z-index: 6; padding: 12px;
  border-radius: var(--r); background: rgba(255,255,255,.98);
  box-shadow: 0 18px 40px -12px rgba(40,70,90,.35), 0 0 0 1px rgba(0,0,0,.05);
  animation: drop-in .16s ease-out backwards;
}
.rem-pop.date { width: min(292px, calc(100vw - 64px)); }
.rem-pop.time { left: auto; right: 0; width: 170px; }
.rem-pop-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: .88rem; }
.rem-pop-head b { font-weight: 600; }
.rem-nav { display: flex; gap: 2px; }
.rem-nav button { width: 30px; height: 30px; padding: 0; display: grid; place-items: center; border: 0; border-radius: var(--r); background: transparent; color: var(--ink); }
.rem-nav button:hover { background: rgba(0,0,0,.06); }
.rem-cal { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.rem-cal.week { margin-bottom: 2px; }
.rem-cal.week span { padding: 4px 0; text-align: center; color: var(--muted); font-size: .72rem; font-weight: 600; }
.rem-day-btn { aspect-ratio: 1; padding: 0; border: 0; border-radius: var(--r); background: transparent; color: var(--ink); font: 500 .82rem 'Manrope', system-ui, sans-serif; }
.rem-day-btn.out { color: #b9bdc0; }
.rem-day-btn:hover:not(.sel) { background: rgba(0,0,0,.06); }
.rem-day-btn.today { box-shadow: inset 0 0 0 1.5px var(--dark); }
.rem-day-btn.sel { background: var(--dark); color: var(--on-dark); box-shadow: none; }
.rem-pop-foot { display: flex; justify-content: flex-end; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(0,0,0,.06); }
.rem-pop-foot.split { justify-content: space-between; }
.rem-pop-foot button { padding: 8px 10px; border: 0; border-radius: var(--r); background: transparent; color: var(--ink); font: 600 .8rem 'Manrope', system-ui, sans-serif; }
.rem-pop-foot button:hover { background: rgba(0,0,0,.06); }
.rem-cols { display: flex; align-items: center; gap: 4px; }
.rem-col { position: relative; flex: 1; height: 190px; padding: 4px 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; scrollbar-width: none; }
.rem-col::-webkit-scrollbar { display: none; }
.rem-col-item { flex: none; height: 34px; border: 0; border-radius: var(--r); background: transparent; color: var(--ink); font: 500 .9rem 'Manrope', system-ui, sans-serif; }
.rem-col-item:hover:not(.sel) { background: rgba(0,0,0,.06); }
.rem-col-item.sel { background: var(--dark); color: var(--on-dark); }
.rem-col-sep { color: var(--muted); font-weight: 600; }

/* ----- Voz ----- */
.rem-voice { text-align: center; }
.rem-said { min-height: 110px; display: grid; place-items: center; margin: 14px 0 6px; }
.rem-voice .rem-said p { margin: 0; color: var(--ink); }
.rem-voice .rem-said p.rem-hint { color: #8f959a; font-size: .92rem; line-height: 1.6; }
.rem-hint span { display: inline-block; margin-top: 6px; font-size: .8rem; color: #aab0b4; }
.rem-said-text { font-size: 1.1rem; font-weight: 500; line-height: 1.5; }
.rem-hl { color: var(--muted); }
.rem-pv-text { font-size: 1.15rem; font-weight: 600; line-height: 1.4; }
.rem-chips { display: flex; justify-content: center; gap: 8px; margin-top: 12px; }
.rem-chip { height: 28px; padding: 0 12px; display: inline-grid; place-items: center; border: 1px solid rgba(0,0,0,.045); border-radius: var(--r); background: rgba(255,255,255,.65); color: #747c81; font-size: .78rem; font-weight: 600; }
.rem-voice p.rem-error, .rem-typed p.rem-error { margin: 10px 0 0; color: #b34444; font-size: .85rem; }
.rem-typed { display: grid; gap: 10px; margin-top: 8px; }
.rem-mic-wrap { position: relative; width: 84px; height: 84px; margin: 14px auto 22px; display: grid; place-items: center; }
.rem-mic {
  position: relative; z-index: 1; width: 68px; height: 68px; display: grid; place-items: center;
  border: 0; border-radius: var(--r); background: var(--dark); color: var(--on-dark);
  box-shadow: 0 12px 26px -8px rgba(0,0,0,.5);
  transition: transform .15s ease;
}
.rem-mic:active { transform: scale(.94); }
.rem-mic:disabled { opacity: .5; cursor: default; }
.rem-ring { position: absolute; inset: 0; margin: auto; width: 68px; height: 68px; border: 2px solid var(--dark); border-radius: 50%; opacity: 0; }
.rem-ring.on { animation: rem-ring 1.6s ease-out infinite; }
.rem-ring.on.r2 { animation-delay: .55s; }
@keyframes rem-ring { from { transform: scale(1); opacity: .5; } to { transform: scale(1.7); opacity: 0; } }
.rem-voice .confirm-actions { justify-content: center; flex-wrap: wrap; }

/* ----- Tema escuro ----- */
.anotei.dark .seg { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); box-shadow: 0 10px 24px -18px rgba(0,0,0,.8); }
.anotei.dark .seg button { color: #aab2b7; }
.anotei.dark .seg button:hover:not([data-active="true"]) { background: rgba(255,255,255,.08); color: #fff; }
.anotei.dark .seg em { background: rgba(255,255,255,.1); }
.anotei.dark .seg button[data-active="true"] em { background: rgba(0,0,0,.14); }
.anotei.dark .rem-bar { background: rgba(255,255,255,.1); }
.anotei.dark .rem-item { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.09); box-shadow: 0 22px 44px -22px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06); }
.anotei.dark .rem-item:hover { background: rgba(255,255,255,.09); }
.anotei.dark .rem-check { border-color: #6f777c; }
.anotei.dark .rem-check.on { border-color: var(--dark); }
.anotei.dark .rem-time, .anotei.dark .rem-chip { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.08); color: #aab2b7; }
.anotei.dark .rem-actions .icon-btn { color: #8b949a; }
.anotei.dark .rem-lbl > span { color: #8b949a; }
.anotei.dark .rem-field { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.12); }
.anotei.dark .rem-field::placeholder, .anotei.dark .rem-field .ph { color: #6f777c; }
.anotei.dark .rem-field.open { border-color: var(--dark); }
.anotei.dark .rem-pop { background: rgba(32,37,41,.99); box-shadow: 0 18px 40px -12px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.08); }
.anotei.dark .rem-nav button:hover,
.anotei.dark .rem-day-btn:hover:not(.sel),
.anotei.dark .rem-col-item:hover:not(.sel),
.anotei.dark .rem-pop-foot button:hover { background: rgba(255,255,255,.08); }
.anotei.dark .rem-day-btn.out { color: #5d666b; }
.anotei.dark .rem-pop-foot { border-top-color: rgba(255,255,255,.1); }
.anotei.dark .rem-voice .rem-said p.rem-hint { color: #8b949a; }
.anotei.dark .rem-hint span { color: #6f777c; }
.anotei.dark .rem-voice p.rem-error, .anotei.dark .rem-typed p.rem-error { color: #ff8f8f; }
/* ==========================  COMPRAS  ========================== */
/* ----- Abas na barra superior ----- */
.appbar-tabs { margin: 0; }
.nav-burger, .appbar-menu { display: none; }
@media (min-width: 700px) {
  /* marca à esquerda, abas no centro, tema à direita */
  .appbar-in.with-tabs { display: grid; grid-template-columns: 1fr auto 1fr; }
  .appbar-in.with-tabs .appbar-tabs { grid-column: 2; }
  .appbar-in.with-tabs .appbar-right { grid-column: 3; justify-self: end; margin-left: 0; }
}
@media (max-width: 699px) {
  /* celular: as abas viram um menu hambúrguer, na ponta direita da barra */
  .appbar-tabs { display: none; }
  .nav-burger { display: grid; }
  /* Aberto, a própria barra cresce para baixo: o painel tem o mesmo vidro e ocupa toda a largura. */
  .appbar.nav-open { height: auto; }
  .appbar.nav-open .appbar-in { height: var(--bar); }
  .appbar.nav-open .appbar-menu {
    display: grid; gap: 4px; padding: 6px clamp(14px, 4vw, 56px) 14px;
    border-top: 1px solid rgba(0,0,0,.06);
    animation: drop-in .16s ease-out backwards;
  }
}
.appbar-item {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  width: 100%; height: 48px; padding: 0 18px; border: 0; border-radius: var(--r);
  background: transparent; color: var(--ink);
  font: 600 .95rem 'Manrope', system-ui, sans-serif; text-align: left;
  transition: background .15s ease, color .15s ease, transform .15s ease;
}
.appbar-item:hover:not([data-active="true"]) { background: rgba(0,0,0,.06); }
.appbar-item:active { transform: scale(.985); }
.appbar-item[data-active="true"] { background: var(--dark); color: var(--on-dark); }
.appbar-item em {
  min-width: 22px; height: 22px; padding: 0 7px; display: inline-grid; place-items: center;
  border-radius: var(--r); background: rgba(0,0,0,.08); font-style: normal; font-size: .72rem; font-weight: 700;
}
.appbar-item[data-active="true"] em { background: rgba(255,255,255,.24); }
.anotei.dark .appbar.nav-open .appbar-menu { border-top-color: rgba(255,255,255,.08); }
.anotei.dark .appbar-item:hover:not([data-active="true"]) { background: rgba(255,255,255,.08); }
.anotei.dark .appbar-item em { background: rgba(255,255,255,.1); }
.anotei.dark .appbar-item[data-active="true"] em { background: rgba(0,0,0,.14); }

/* ----- Total ----- */
.shop-sum {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-top: 18px; padding: 18px 22px; border-radius: var(--r);
  background: var(--dark); color: var(--on-dark);
  box-shadow: 0 18px 36px -18px rgba(0,0,0,.5);
  animation: rise .42s cubic-bezier(.2, .7, .3, 1) backwards;
}
.shop-sum-label { display: block; font-size: .78rem; font-weight: 500; opacity: .7; }
.shop-sum-value { display: block; margin-top: 4px; font-size: 1.45rem; font-weight: 600; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.shop-sum-done { flex: none; text-align: right; }
.shop-sum-done .shop-sum-value { font-size: 1.15rem; opacity: .8; }
/* Barra de busca fixa: fica parada logo abaixo da barra superior enquanto a lista rola. */
.shop-search {
  position: sticky; top: calc(var(--bar) + 10px); z-index: 8;
  margin-top: 18px; border-radius: var(--r);
  background: #f7f7f7;
  box-shadow: 0 10px 24px -14px rgba(40,70,90,.35);
}
.anotei.dark .shop-search { background: #1d2124; }
/* no celular o .confirm-btn ocupa a largura toda; aqui ele fica do tamanho do texto */
.rem-head .shop-clear { flex: none; width: auto; min-height: 38px; padding: 0 14px; }

/* ----- Categorias e itens ----- */
.shop-cat { margin-top: 26px; }
.shop-cat-title {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  margin: 0 6px 10px; font-size: .95rem; font-weight: 600; letter-spacing: -.01em;
}
.shop-cat-title span { color: var(--muted); font-size: .8rem; font-weight: 500; font-variant-numeric: tabular-nums; }
.shop-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
@media (min-width: 1100px) {
  .shop-list { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
}
/* Telas grandes: 3 itens por linha (Compras e Contatos). */
@media (min-width: 1400px) {
  .shop-list { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
}
.shop-sub { display: block; margin-top: 2px; color: var(--muted); font-size: .76rem; font-weight: 500; overflow-wrap: anywhere; }

/* valor do item: botão que vira campo de texto ao tocar */
.shop-price-wrap { display: contents; }
.shop-price { height: 30px; cursor: pointer; font-variant-numeric: tabular-nums; transition: background .15s ease, border-color .15s ease; }
.shop-price:hover { background: rgba(255,255,255,.95); }
.shop-price.add { background: transparent; border: 1px dashed rgba(0,0,0,.28); font-weight: 500; }
.shop-price.add:hover { background: rgba(0,0,0,.05); }
.shop-price-input {
  flex: none; width: 112px; height: 38px; padding: 0 12px;
  border: 1px solid var(--dark); border-radius: var(--r);
  background: rgba(255,255,255,.9); color: var(--ink);
  font: 500 16px 'Manrope', system-ui, sans-serif; text-align: right;
  animation: fade-in .18s ease-out backwards;
}
.anotei .shop-price-input:focus, .anotei .shop-price-input:focus-visible { outline: none; }
@media (max-width: 480px) {
  .shop-item { gap: 10px; padding-left: 12px; }
  .shop-item .rem-actions .icon-btn { width: 32px; height: 32px; }
  .shop-price-input { width: 96px; }
  .shop-sum { padding: 16px 18px; gap: 12px; }
  .shop-sum-value { font-size: 1.25rem; }
  .shop-sum-done .shop-sum-value { font-size: 1.05rem; }
}

/* ----- Formulário ----- */
.shop-form { max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); overflow-y: auto; scrollbar-width: none; }
.shop-form::-webkit-scrollbar { display: none; }
.shop-block { margin-top: 16px; }
.shop-form h2 + .shop-block { margin-top: 18px; }
.shop-cats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.shop-cats .chip { width: 100%; min-width: 0; padding: 0 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.shop-two { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; margin: 16px 0 22px; }
/* Adicionar/Salvar à esquerda e Cancelar à direita (no celular, o principal continua em cima) */
@media (min-width: 481px) { .shop-actions { flex-direction: row-reverse; justify-content: flex-start; } }
.shop-err { margin: -8px 0 16px; color: #b34444; font-size: .85rem; font-weight: 500; animation: fade-in .2s ease-out backwards; }

/* "Quer adicionar outro item?" */
.shop-ask { display: grid; justify-items: center; text-align: center; gap: 8px; padding: 6px 0 24px; }
.shop-ask-check {
  width: 64px; height: 64px; display: grid; place-items: center; border-radius: var(--r);
  background: var(--dark); color: var(--on-dark);
  box-shadow: 0 12px 26px -8px rgba(0,0,0,.5);
  animation: pop-in .3s ease-out backwards;
}
.shop-ask-added { margin-top: 6px; color: var(--muted); font-size: .9rem; font-weight: 500; overflow-wrap: anywhere; }
.confirm-dialog .shop-ask h2 { margin: 0; }

/* ----- Tema escuro ----- */
.anotei.dark .shop-sum { box-shadow: 0 18px 36px -18px rgba(0,0,0,.8); }
.anotei.dark .shop-price:hover { background: rgba(255,255,255,.14); }
.anotei.dark .shop-price.add { background: transparent; border-color: rgba(255,255,255,.24); }
.anotei.dark .shop-price.add:hover { background: rgba(255,255,255,.08); }
.anotei.dark .shop-price-input { background: rgba(255,255,255,.09); }
.anotei.dark .shop-err { color: #ff8f8f; }

/* ==========================  CONTATOS  ========================== */
.contact-item { cursor: default; }
.contact-avatar {
  flex: none; width: 42px; height: 42px; display: grid; place-items: center;
  border-radius: var(--r); background: var(--dark); color: var(--on-dark);
  font-size: 1rem; font-weight: 600; text-transform: uppercase;
}
.contact-phone { display: block; margin-top: 2px; color: var(--muted); font-size: .82rem; font-weight: 500; font-variant-numeric: tabular-nums; }
.contact-item .rem-body p { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rem-actions a.icon-btn { width: 36px; height: 36px; color: #8b9296; text-decoration: none; }
.rem-actions a.icon-btn:hover { color: var(--ink); }
.contact-count { color: var(--muted); font-size: .85rem; font-weight: 500; }
.anotei.dark .rem-actions a.icon-btn { color: #8b949a; }

/* ==========================  COFRE DE SENHAS  ========================== */
.appbar-tabs button { padding: 0 14px; }
.vault-gate { margin: 36px auto 0; text-align: center; }
.vault-gate .rem-lbl { text-align: left; margin-bottom: 12px; }
.vault-lock {
  width: 64px; height: 64px; margin: 0 auto 18px; display: grid; place-items: center;
  border-radius: var(--r); background: var(--dark); color: var(--on-dark);
  box-shadow: 0 12px 26px -8px rgba(0,0,0,.5);
}
.vault-note { margin: 0 0 18px; color: #737b80; font-size: .82rem; line-height: 1.55; font-weight: 500; }
.vault-gate .vault-note { margin-top: -6px; }
.vault-warn { margin: 0 0 16px; padding: 12px 14px; border-radius: var(--r); background: rgba(179,68,68,.1); color: #b34444; font-size: .82rem; font-weight: 500; line-height: 1.5; }
.vault-field { position: relative; }
/* esconde o botão de "revelar senha" que o próprio navegador (Edge/Chrome) coloca no campo */
.anotei input::-ms-reveal, .anotei input::-ms-clear { display: none; }
.anotei input::-webkit-credentials-auto-fill-button { visibility: hidden; position: absolute; right: 0; pointer-events: none; }
.vault-field .rem-field { padding-right: 92px; }
.vault-tools { position: absolute; right: 4px; top: 3px; display: flex; }
.vault-tools .icon-btn { width: 40px; height: 40px; color: #8b9296; }
.vault-pass { display: block; margin-top: 4px; font-family: 'Manrope', system-ui, sans-serif; font-size: .88rem; overflow-wrap: anywhere; user-select: all; }
.vault-copy { display: block; max-width: 100%; padding: 0; border: 0; background: transparent; color: var(--muted); font: 500 .78rem 'Manrope', system-ui, sans-serif; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vault-copy:hover { color: var(--ink); }
.vault-textarea { height: 84px; padding: 12px 15px; resize: none; display: block; line-height: 1.45; }
.vault-head-btns { display: flex; gap: 8px; }
/* Todos os cards do cofre têm a mesma altura (a do maior). */
.shop-list.vault-list { grid-auto-rows: 1fr; align-items: stretch; }
.vault-card {
  display: flex; flex-direction: column; gap: 12px; min-width: 0; padding: 14px;
  border-radius: var(--r);
  background: rgba(255,255,255,.28);
  border: 1px solid rgba(255,255,255,.7);
  box-shadow: 0 22px 44px -22px rgba(60,90,110,.35), inset 0 1px 0 rgba(255,255,255,.5);
  backdrop-filter: blur(40px) saturate(150%); -webkit-backdrop-filter: blur(40px) saturate(150%);
  animation: fade-in .3s ease-out backwards;
  transition: background .2s ease;
}
.vault-card:hover { background: rgba(255,255,255,.4); }
.vault-card-head { display: flex; align-items: center; gap: 12px; min-width: 0; }
.vault-card-head .contact-avatar { width: 44px; height: 44px; }
.vault-title { flex: 1; min-width: 0; }
.vault-title strong { display: block; font-size: 1.02rem; font-weight: 600; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vault-title span { display: block; margin-top: 2px; color: var(--muted); font-size: .78rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vault-rows { display: grid; gap: 8px; }
.vault-row {
  display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; padding: 10px 12px;
  border: 1px solid rgba(0,0,0,.045); border-radius: var(--r);
  background: rgba(255,255,255,.65); color: var(--ink); text-align: left;
  transition: background .15s ease, transform .15s ease;
}
.vault-row:hover { background: rgba(255,255,255,.95); }
.vault-row:active { transform: scale(.985); }
.vault-txt { flex: 1; min-width: 0; display: grid; gap: 2px; }
.vault-lbl { color: #8f959a; font-size: .74rem; font-weight: 600; line-height: 1.2; white-space: nowrap; }
.vault-val { min-width: 0; font-size: .88rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vault-val.mono { font-family: 'Manrope', system-ui, sans-serif; letter-spacing: .02em; white-space: normal; overflow-wrap: anywhere; }
.vault-row svg { flex: none; color: #8b9296; }
.vault-row:hover svg { color: var(--ink); }
.vault-notes { margin: 0; padding: 0 4px 2px; color: #737b80; font-size: .8rem; line-height: 1.5; font-weight: 500; overflow-wrap: anywhere; }
.anotei.dark .vault-card { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.09); box-shadow: 0 22px 44px -22px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06); }
.anotei.dark .vault-card:hover { background: rgba(255,255,255,.09); }
.anotei.dark .vault-row { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.08); }
.anotei.dark .vault-row:hover { background: rgba(255,255,255,.13); }
.anotei.dark .vault-lbl { color: #8b949a; }
.anotei.dark .vault-row svg { color: #8b949a; }
.anotei.dark .vault-row:hover svg { color: var(--ink); }
.anotei.dark .vault-notes { color: #98a2a8; }
.contact-avatar.has-img { background: #fff; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); }
.contact-avatar img { display: block; width: 100%; height: 100%; padding: 6px; object-fit: contain; }
.vault-icon-row { display: flex; align-items: center; gap: 10px; }
.vault-icon-row .rem-field { flex: 1; min-width: 0; }
.vault-icon-row .contact-avatar { flex: none; }
.vault-icon-link { margin-top: 8px; padding: 0; border: 0; background: transparent; color: #737b80; font: 600 .78rem 'Manrope', system-ui, sans-serif; text-decoration: underline; text-underline-offset: 3px; }
.vault-icon-link:hover { color: var(--ink); }
.anotei.dark .vault-icon-link { color: #98a2a8; }
.anotei.dark .vault-note { color: #98a2a8; }
.anotei.dark .vault-warn { background: rgba(255,143,143,.12); color: #ff8f8f; }
.anotei.dark .vault-tools .icon-btn { color: #8b949a; }
@media (max-width: 480px) {
  .contact-item { gap: 10px; padding-left: 12px; }
  .contact-avatar { width: 38px; height: 38px; }
  .contact-item .rem-actions .icon-btn, .contact-item .rem-actions a.icon-btn { width: 32px; height: 32px; }
}
`;

/* ---------- Ícones ---------- */
const svgProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

// Logo do app (public/assets/logo.png).
const NoteIcon = () => (<img className="brand-logo" src="/assets/logo.png" alt="" width="34" height="34" draggable="false" />);
const DotsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);
const PlusIcon = () => (
  <svg {...svgProps} width="26" height="26" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
);
const ImageIcon = () => (
  <svg {...svgProps} width="17" height="17"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.6" /><path d="m21 16-5-5-8 8" /></svg>
);
const MicIcon = () => (
  <svg {...svgProps} width="17" height="17"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
);
const BackIcon = () => (
  <svg {...svgProps} width="24" height="24"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
);
const MinimalBackIcon = () => (
  <svg {...svgProps} width="17" height="17" strokeWidth="1.6" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
);
const TrashIcon = () => (
  <svg {...svgProps} width="18" height="18"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
const MoonIcon = () => (
  <svg {...svgProps} width="20" height="20"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
);
const SunIcon = () => (
  <svg {...svgProps} width="20" height="20"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
const CloseIcon = () => (
  <svg {...svgProps} width="16" height="16" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
);

/* ---------- Utilitários ---------- */
const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

const formatDate = (ts) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(ts);

// Data completa, ex.: "15 de outubro de 2026, 21:30"
const formatFullDate = (ts) => {
  const d = new Date(ts);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
  return `${day}, ${time}`;
};

// Reduz a imagem para não pesar (importante quando for salvar no Firebase).
function fileToDataUrl(file, maxSize = 1000) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const SpeechRecognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/* ---------- Texto formatado: limpeza e utilitários ---------- */
const escapeHtml = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const elOf = (n) => (n && n.nodeType === 1 ? n : n?.parentElement) || null;

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "SPAN", "FONT", "P", "DIV", "BR", "H1", "H2", "H3", "BLOCKQUOTE", "PRE", "UL", "OL", "LI", "A", "HR", "SUB", "SUP"]);
const DROP_TAGS = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|HEAD|TITLE|META|LINK|NOSCRIPT)$/;
const ALLOWED_STYLES = ["color", "background-color", "font-size", "font-family", "text-align", "font-weight", "font-style", "text-decoration", "text-decoration-line", "margin-left", "padding-left"];

function cleanChildren(from, to) {
  from.childNodes.forEach((c) => {
    if (c.nodeType === 3) return to.appendChild(document.createTextNode(c.nodeValue));
    if (c.nodeType !== 1) return;
    if (!ALLOWED_TAGS.has(c.tagName)) {
      if (!DROP_TAGS.test(c.tagName)) cleanChildren(c, to);
      return;
    }
    const el = document.createElement(c.tagName === "FONT" ? "span" : c.tagName);
    ALLOWED_STYLES.forEach((prop) => {
      const v = c.style.getPropertyValue(prop);
      if (v && !/url\(|expression|javascript/i.test(v)) el.style.setProperty(prop, v);
    });
    if (c.tagName === "A") {
      const href = c.getAttribute("href") || "";
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (c.tagName === "UL" && c.classList.contains("todo")) el.className = "todo";
    if (c.tagName === "LI" && c.dataset.checked) el.dataset.checked = c.dataset.checked === "true" ? "true" : "false";
    cleanChildren(c, el);
    to.appendChild(el);
  });
}

// Deixa só o que o app sabe mostrar (protege contra HTML colado de outros sites).
// Notas antigas, em texto puro, são convertidas automaticamente.
function cleanHtml(html = "") {
  if (!/<\/?[a-z][^>]*>/i.test(html)) html = escapeHtml(html).replace(/\n/g, "<br>");
  const out = document.createElement("div");
  cleanChildren(new DOMParser().parseFromString(html, "text/html").body, out);
  return out.innerHTML.replace(/\u200B/g, "").trim();
}
const htmlToPlain = (html = "") =>
  (new DOMParser().parseFromString(html, "text/html").body.textContent || "").replace(/\u200B/g, "");

/* ---------- Barra de formatação ---------- */
const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
const FONTS = [
  ["Manrope", "Manrope, sans-serif"],
  ["Serifada", "Georgia, 'Times New Roman', serif"],
  ["Monoespaçada", "'Courier New', monospace"],
  ["Manuscrita", "'Segoe Print', 'Comic Sans MS', cursive"],
];
const hsl = (h, sat, l) => {
  sat /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
};
const HUES = [0, 25, 45, 130, 175, 210, 230, 265, 300, 335];
const PALETTE = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  ...HUES.map((h) => hsl(h, 75, 42)),
  ...HUES.map((h) => hsl(h, 90, 62)),
  ...HUES.map((h) => hsl(h, 90, 86)),
];

const Ic = ({ d, children }) => (
  <svg {...svgProps} width="17" height="17">{d && <path d={d} />}{children}</svg>
);
const AlignIcon = ({ lines }) => (
  <Ic d={lines.map(([a, b], i) => `M${a} ${6 + i * 4}H${b}`).join("")} />
);
const ALIGN_LINES = {
  left: [[4, 20], [4, 14], [4, 20], [4, 14]],
  center: [[4, 20], [7, 17], [4, 20], [7, 17]],
  right: [[4, 20], [10, 20], [4, 20], [10, 20]],
  justify: [[4, 20], [4, 20], [4, 20], [4, 20]],
};
const prevent = (e) => e.preventDefault(); // botões não tiram o foco (nem a seleção) do texto

const Btn = ({ label, on, active, children, cls = "" }) => (
  <button type="button" className={"tb" + cls} aria-label={label} title={label} aria-pressed={active ?? undefined}
    data-active={Boolean(active)} onMouseDown={prevent} onClick={on}>
    {children}
  </button>
);
const Sep = ({ cls = "" }) => <span className={"tb-sep" + cls} aria-hidden="true" />;

function ColorInput({ onPick }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const h = () => onPick(el.value);
    el.addEventListener("change", h); // só quando a cor é confirmada
    return () => el.removeEventListener("change", h);
  });
  return <input ref={ref} type="color" defaultValue="#1a73e8" aria-label="Escolher outra cor" />;
}

function Toolbar({ editorRef, onChange }) {
  const saved = useRef(null);
  const [panel, setPanel] = useState(null); // null | "color" | "bg" | "link"
  const [url, setUrl] = useState("");
  const [px, setPx] = useState(0);
  const wrapRef = useRef(null);
  const [last, setLast] = useState({ color: "#1f1f1f", bg: "#fff176" });
  const [st, setSt] = useState({ size: 16, font: FONTS[0][0], block: "p", al: "left" });

  const readState = useCallback(() => {
    const el = elOf(getSelection().anchorNode);
    if (!el || !editorRef.current?.contains(el)) return;
    const cs = getComputedStyle(el);
    const q = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    const fam = cs.fontFamily.replace(/["']/g, "").toLowerCase();
    const inTodo = !!el.closest("ul.todo");
    setSt({
      b: q("bold"), i: q("italic"), u: q("underline"), s: q("strikeThrough"),
      ul: q("insertUnorderedList") && !inTodo, ol: q("insertOrderedList"), todo: inTodo,
      al: q("justifyCenter") ? "center" : q("justifyRight") ? "right" : q("justifyFull") ? "justify" : "left",
      size: Math.round(parseFloat(cs.fontSize)),
      font: (FONTS.find(([, v]) => fam.startsWith(v.split(",")[0].replace(/'/g, "").toLowerCase())) || FONTS[0])[0],
      block: el.closest("h1,h2,h3,blockquote,pre")?.tagName.toLowerCase() || "p",
    });
  }, [editorRef]);

  // Guarda a seleção para poder aplicar o formato mesmo depois de clicar num menu.
  useEffect(() => {
    const h = () => {
      const s = getSelection();
      if (!s.rangeCount || !editorRef.current?.contains(s.anchorNode)) return;
      saved.current = s.getRangeAt(0).cloneRange();
      readState();
    };
    document.addEventListener("selectionchange", h);
    return () => document.removeEventListener("selectionchange", h);
  }, [editorRef, readState]);

  const run = (fn) => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus({ preventScroll: true });
    const s = getSelection();
    if (saved.current) { s.removeAllRanges(); s.addRange(saved.current); }
    document.execCommand("defaultParagraphSeparator", false, "p");
    document.execCommand("styleWithCSS", false, true);
    fn(s, ed);
    onChange();
    readState();
  };
  const cmd = (c, v) => run(() => document.execCommand(c, false, v));

  const setSize = (px) => run((s, ed) => {
    if (!s.rangeCount) return;
    if (s.isCollapsed) { // sem seleção: vale para o que for digitado a seguir
      const sp = document.createElement("span");
      sp.style.fontSize = px + "px";
      sp.textContent = "\u200B";
      s.getRangeAt(0).insertNode(sp);
      const r = document.createRange();
      r.setStart(sp.firstChild, 1);
      r.collapse(true);
      s.removeAllRanges();
      s.addRange(r);
      return;
    }
    document.execCommand("styleWithCSS", false, false);
    document.execCommand("fontSize", false, "7"); // marca o trecho; trocamos pelo tamanho exato em px
    const spans = [...ed.querySelectorAll('font[size="7"]')].map((f) => {
      const sp = document.createElement("span");
      sp.style.fontSize = px + "px";
      while (f.firstChild) sp.appendChild(f.firstChild);
      f.replaceWith(sp);
      sp.querySelectorAll("[style]").forEach((c) => c.style.removeProperty("font-size"));
      return sp;
    });
    if (spans.length) {
      const r = document.createRange();
      r.setStartBefore(spans[0]);
      r.setEndAfter(spans[spans.length - 1]);
      s.removeAllRanges();
      s.addRange(r);
    }
  });

  const list = (kind) => run((s) => {
    const ul = elOf(s.anchorNode)?.closest("ul");
    if (kind === "todo") {
      if (ul?.classList.contains("todo")) return document.execCommand("insertUnorderedList");
      if (!ul) document.execCommand("insertUnorderedList");
      elOf(getSelection().anchorNode)?.closest("ul")?.classList.add("todo");
    } else if (kind === "ul") {
      if (ul?.classList.contains("todo")) ul.classList.remove("todo");
      else document.execCommand("insertUnorderedList");
    } else document.execCommand("insertOrderedList");
  });

  const applyColor = (c) => {
    const bg = panel === "bg";
    run(() => document.execCommand(bg ? "hiliteColor" : "foreColor", false, c ?? (bg ? "transparent" : "#1f1f1f")));
    if (c) setLast((l) => ({ ...l, [bg ? "bg" : "color"]: c }));
    setPanel(null);
  };

  useEffect(() => {
    if (!panel) return;
    const out = (e) => { if (!wrapRef.current?.contains(e.target)) setPanel(null); };
    const esc = (e) => e.key === "Escape" && setPanel(null);
    document.addEventListener("pointerdown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", out); document.removeEventListener("keydown", esc); };
  }, [panel]);

  const openPanel = (name, e) => {
    const w = wrapRef.current.getBoundingClientRect();
    const b = e.currentTarget.getBoundingClientRect();
    setPx(b.left + b.width / 2 - w.left - 202); // abre centralizado embaixo do botão
    if (name === "link") {
      const a = saved.current && elOf(saved.current.startContainer)?.closest("a");
      setUrl(a?.getAttribute("href") || "");
    }
    setPanel((p) => (p === name ? null : name));
  };
  const applyLink = () => {
    let u = url.trim();
    if (!u) return;
    if (!/^(https?:|mailto:|tel:)/i.test(u)) u = "https://" + u;
    run((s) => {
      if (s.isCollapsed && !elOf(s.anchorNode)?.closest("a"))
        document.execCommand("insertHTML", false, `<a href="${u.replace(/"/g, "&quot;")}">${escapeHtml(u)}</a>`);
      else document.execCommand("createLink", false, u);
    });
    setPanel(null);
  };

  const sizeOptions = SIZES.includes(st.size) ? SIZES : [...SIZES, st.size].sort((a, b) => a - b);

  // Itens "extras": ficam na barra em telas grandes e dentro do painel "Aa" em telas pequenas.
  const X = " tb-x";
  const selects = (x = "") => (
    <>
      <select className={"tsel" + x} aria-label="Estilo do parágrafo" value={st.block}
        onChange={(e) => cmd("formatBlock", `<${e.target.value}>`)}>
        <option value="p">Texto normal</option>
        <option value="h1">Título</option>
        <option value="h2">Subtítulo</option>
        <option value="h3">Título pequeno</option>
        <option value="blockquote">Citação</option>
        <option value="pre">Bloco de código</option>
      </select>
      <select className={"tsel" + x} aria-label="Fonte" value={st.font}
        onChange={(e) => cmd("fontName", FONTS.find((f) => f[0] === e.target.value)[1])}>
        {FONTS.map(([n]) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select className={"tsel" + x} aria-label="Tamanho da fonte" value={st.size} onChange={(e) => setSize(+e.target.value)}>
        {sizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </>
  );
  const bRedo = (x = "") => <Btn cls={x} label="Refazer" on={() => cmd("redo")}><Ic d="m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" /></Btn>;
  const bStrike = (x = "") => <Btn cls={x} label="Riscado" active={st.s} on={() => cmd("strikeThrough")}><s>S</s></Btn>;
  const bHl = (x = "") => (
    <Btn cls={x} label="Cor de destaque" active={panel === "bg"} on={(e) => openPanel("bg", e)}>
      <span className="tb-hl" style={{ background: last.bg }}>A</span>
    </Btn>
  );
  const bOl = (x = "") => <Btn cls={x} label="Lista numerada" active={st.ol} on={() => list("ol")}>1.</Btn>;
  const aligns = (x = "") =>
    [["left", "justifyLeft", "Alinhar à esquerda"], ["center", "justifyCenter", "Centralizar"], ["right", "justifyRight", "Alinhar à direita"], ["justify", "justifyFull", "Justificar"]].map(([k, c, l]) => (
      <Btn key={k} cls={x} label={l} active={st.al === k} on={() => cmd(c)}><AlignIcon lines={ALIGN_LINES[k]} /></Btn>
    ));
  const bLink = (x = "") => (
    <Btn cls={x} label="Link" active={panel === "link"} on={(e) => openPanel("link", e)}>
      <Ic d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Btn>
  );
  // Bloco de código: liga/desliga. Parágrafos vizinhos viram um único bloco.
  const codeBlock = () => run((s, ed) => {
    if (elOf(s.anchorNode)?.closest("pre")) return document.execCommand("formatBlock", false, "<p>");
    document.execCommand("formatBlock", false, "<pre>");
    ed.querySelectorAll("pre").forEach((pre) => {
      let next = pre.nextElementSibling;
      while (next && next.tagName === "PRE") {
        pre.appendChild(document.createTextNode("\n"));
        while (next.firstChild) pre.appendChild(next.firstChild);
        next.remove();
        next = pre.nextElementSibling;
      }
    });
  });
  const bCode = (x = "") => (
    <Btn cls={x} label="Bloco de código" active={st.block === "pre"} on={codeBlock}>
      <Ic d="m8 7-5 5 5 5M16 7l5 5-5 5M14 5l-4 14" />
    </Btn>
  );
  const bHr = (x = "") => <Btn cls={x} label="Linha divisória" on={() => cmd("insertHorizontalRule")}><Ic d="M3 12h18M8 6h8M8 18h8" /></Btn>;
  const bClear = (x = "") => (
    <Btn cls={x} label="Limpar formatação" on={() => run(() => { document.execCommand("removeFormat"); document.execCommand("unlink"); document.execCommand("formatBlock", false, "<p>"); })}>Tx</Btn>
  );

  return (
    <div className="tbar-wrap" ref={wrapRef}>
      <div className="tbar" role="toolbar" aria-label="Formatação do texto">
        <Btn label="Desfazer" on={() => cmd("undo")}><Ic d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></Btn>
        {bRedo(X)}
        <Sep />
        {selects(X)}
        <Sep cls={X} />
        <Btn label="Negrito" active={st.b} on={() => cmd("bold")}><b>B</b></Btn>
        <Btn label="Itálico" active={st.i} on={() => cmd("italic")}><i>I</i></Btn>
        <Btn label="Sublinhado" active={st.u} on={() => cmd("underline")}><u>U</u></Btn>
        {bStrike(X)}
        <Btn label="Cor do texto" active={panel === "color"} on={(e) => openPanel("color", e)}>
          <span className="tb-a">A<span style={{ background: last.color }} /></span>
        </Btn>
        {bHl(X)}
        <Sep />
        <Btn label="Lista com marcadores" active={st.ul} on={() => list("ul")}>
          <Ic d="M9 6h11M9 12h11M9 18h11"><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></Ic>
        </Btn>
        {bOl(X)}
        <Btn label="Lista de tarefas" active={st.todo} on={() => list("todo")}>
          <Ic d="m5 7.5 1.5 1.5L9 6M14 7.5h7M14 17.5h7"><rect x="3" y="4" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /></Ic>
        </Btn>
        <Sep cls={X} />
        {aligns(X)}
        <Sep cls={X} />
        {bLink(X)}
        {bCode(X)}
        {bHr(X)}
        {bClear(X)}
        <Sep cls=" tb-m" />
        <Btn cls=" tb-m" label="Mais formatação" active={panel === "more"} on={(e) => openPanel("more", e)}>
          <svg {...svgProps} width="18" height="18" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
        </Btn>
      </div>

      {panel === "more" && (
        <div className="tpanel" style={{ "--px": px + "px" }}>
          <div className="more-selects">{selects()}</div>
          <div className="more-btns">
            {bRedo()}{bStrike()}{bHl()}{bOl()}
            {aligns()}
            {bLink()}{bCode()}{bHr()}{bClear()}
          </div>
        </div>
      )}

      {(panel === "color" || panel === "bg") && (
        <div className="tpanel" style={{ "--px": px + "px" }}>
          <div className="swatches">
            {PALETTE.map((c) => (
              <button key={c} type="button" className="sw" style={{ background: c }} aria-label={c} onMouseDown={prevent} onClick={() => applyColor(c)} />
            ))}
          </div>
          <div className="tpanel-row">
            <label>Outra cor <ColorInput onPick={applyColor} /></label>
            <button type="button" className="tp-btn" onMouseDown={prevent} onClick={() => applyColor(null)}>
              {panel === "bg" ? "Sem destaque" : "Cor padrão"}
            </button>
          </div>
        </div>
      )}
      {panel === "link" && (
        <div className="tpanel" style={{ "--px": px + "px" }}>
          <div className="tpanel-row" style={{ marginTop: 0 }}>
            <input className="link-in" type="url" placeholder="Cole o endereço do link" aria-label="Endereço do link"
              value={url} onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } }} />
            <button type="button" className="tp-btn primary" onClick={applyLink}>Aplicar</button>
            <button type="button" className="tp-btn" onClick={() => { cmd("unlink"); setPanel(null); }}>Remover link</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Menu de três pontos ---------- */
function Menu({ label, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <DotsIcon />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// Categorias que vinham por padrão em versões anteriores (removidas).
const DEFAULT_CAT_IDS = ["anotacoes", "afazeres", "compras"];

/* ---------- App ---------- */
/* ==========================  LEMBRETES  ==========================
   Lógica trazida do Lembrei (voz, data e hora, avisos), agora no mesmo banco do Anotei
   (anotei-f5d92) e com a mesma aparência do app. Os lembretes ficam em "anotei/reminders". */
const REMINDERS_PATH = "anotei/reminders";
const REMINDERS_CACHE = "anotei-reminders-cache";
const remindersRef = dbRef(db, REMINDERS_PATH);
const reminderRef = (id) => dbRef(db, `${REMINDERS_PATH}/${id}`);
// o Realtime Database não aceita `undefined`
const dropUndefined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/* ----- utilitários de data e texto ----- */
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const remId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function dateLabel(key) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = fromKey(key);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  return cap(d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" }));
}

/* ------------------- interpretação da fala (pt-BR) ------------------- */
const TRIGGER =
  /^\s*(?:por favor[, ]*)?(?:(?:me\s+)?(?:lembrete|lembr(?:ando|ar|e|a)(?:-me)?|adicione|adicionar|crie|criar|anote|anotar))\s*(?:(?:um\s+)?lembrete\s*)?(?:de\s+|para\s+|que\s+|: ?)?/i;

const END = "(?=\\s|$|[.,;!?])";
const PER = "(?:\\s+(?:da|de|pela|à|a)\\s+(manhã|manha|tarde|noite|madrugada))?";
const MONTH = "(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)";
const MONTHS = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
const WEEK = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

const RE = {
  rel: new RegExp("(^|\\s)(?:em|daqui\\s+a)\\s+(\\d{1,3})\\s+(minutos?|horas?|dias?)" + END, "i"),
  noon: new RegExp("(^|\\s)(?:ao\\s+)?meio[- ]dia" + END, "i"),
  midnight: new RegExp("(^|\\s)(?:[àa]\\s+)?meia[- ]noite" + END, "i"),
  timeA: new RegExp("(^|\\s)(?:(?:às|as|à|a)\\s+)?(\\d{1,2})(?:[:h]\\s?(\\d{2})|\\s*h(?:oras?)?)" + PER + END, "i"),
  timeB: new RegExp("(^|\\s)(?:às|as|à)\\s+(\\d{1,2})" + PER + END, "i"),
  timeC: new RegExp("(^|\\s)(\\d{1,2})\\s+(?:da|de|pela)\\s+(manhã|manha|tarde|noite|madrugada)" + END, "i"),
  afterTomorrow: new RegExp("(^|\\s)depois\\s+de\\s+amanh[ãa]" + END, "i"),
  tomorrow: new RegExp("(^|\\s)amanh[ãa]" + END, "i"),
  today: new RegExp("(^|\\s)hoje" + END, "i"),
  weekday: new RegExp("(^|\\s)(?:(?:n[ao]|para|pra)\\s+)?(?:pr[oó]xim[ao]\\s+)?(domingo|segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado)(?:-feira)?" + END, "i"),
  dayMonth: new RegExp("(^|\\s)(?:(?:no|para|pra)\\s+)?(?:dia\\s+)?(\\d{1,2})\\s+de\\s+" + MONTH + END, "i"),
  dayNum: new RegExp("(^|\\s)(?:(?:no|para|pra)\\s+)?dia\\s+(\\d{1,2})" + END, "i"),
};

function toTime(h, m, per) {
  h = Number(h);
  m = Number(m || 0);
  const p = per ? fold(per) : "";
  if ((p === "tarde" || p === "noite") && h < 12) h += 12;
  if ((p === "noite" || p === "madrugada") && h === 12) h = 0;
  if (h > 23 || m > 59) return "";
  return `${pad(h)}:${pad(m)}`;
}

function parseReminder(raw, defaultKey) {
  let s = raw.trim().replace(TRIGGER, "");
  const take = (re) => {
    const m = s.match(re);
    if (!m) return null;
    s = s.replace(re, " ");
    return m;
  };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = "";
  let time = "";
  let m;

  // "em 30 minutos", "daqui a 2 horas", "em 3 dias"
  if ((m = take(RE.rel))) {
    const n = Number(m[2]);
    const u = m[3].toLowerCase();
    const t = new Date(now);
    if (u.startsWith("min")) t.setMinutes(t.getMinutes() + n);
    else if (u.startsWith("hora")) t.setHours(t.getHours() + n);
    else t.setDate(t.getDate() + n);
    date = toKey(t);
    if (!u.startsWith("dia")) time = `${pad(t.getHours())}:${pad(t.getMinutes())}`;
  }

  // horário
  if (!time) {
    if ((m = take(RE.noon))) time = "12:00";
    else if ((m = take(RE.midnight))) time = "00:00";
    else if ((m = take(RE.timeA))) time = toTime(m[2], m[3], m[4]);
    else if ((m = take(RE.timeB))) time = toTime(m[2], 0, m[3]);
    else if ((m = take(RE.timeC))) time = toTime(m[2], 0, m[3]);
  }

  // data
  if (!date) {
    if ((m = take(RE.afterTomorrow))) date = toKey(addDays(today, 2));
    else if ((m = take(RE.tomorrow))) date = toKey(addDays(today, 1));
    else if ((m = take(RE.today))) date = toKey(today);
    else if ((m = take(RE.weekday))) {
      const target = WEEK[fold(m[2])];
      let diff = (target - today.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      date = toKey(addDays(today, diff));
    } else if ((m = take(RE.dayMonth))) {
      const month = MONTHS[fold(m[3])];
      let d = new Date(today.getFullYear(), month, Number(m[2]));
      if (d < today) d = new Date(today.getFullYear() + 1, month, Number(m[2]));
      date = toKey(d);
    } else if ((m = take(RE.dayNum))) {
      let d = new Date(today.getFullYear(), today.getMonth(), Number(m[2]));
      if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, Number(m[2]));
      date = toKey(d);
    }
  }

  if (!date) {
    date = defaultKey || toKey(today);
    // horário que já passou hoje → assume amanhã
    if (time && !defaultKey) {
      const due = new Date(`${toKey(today)}T${time}:00`);
      if (due < now) date = toKey(addDays(today, 1));
    }
  }

  // limpeza do texto
  s = s.replace(/\s+/g, " ").trim();
  let prev;
  do {
    prev = s;
    s = s.replace(/\s+(?:às|as|à|a|em|no|na|para|pra|de|do|da|dia|ao|o)\s*$/i, "").trim();
  } while (s !== prev);
  s = s.replace(/^[\s,.;:!?-]+|[\s,.;:!?-]+$/g, "").replace(/^(?:de|para|que)\s+/i, "");
  if (!s) s = raw.trim().replace(TRIGGER, "").trim() || raw.trim();

  return { text: cap(s), date, time };
}


/* ----- dados: ouve o banco em tempo real ----- */
function useReminders(onError) {
  // começa com o último cache local: os lembretes aparecem na hora, antes do banco responder
  const [items, setItems] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem(REMINDERS_CACHE));
      return Array.isArray(c) ? c : [];
    } catch {
      return [];
    }
  });
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef([]);
  itemsRef.current = items;
  const errRef = useRef(onError);
  errRef.current = onError;

  const fail = useCallback((e) => {
    console.error("Firebase:", e);
    errRef.current?.("Não foi possível salvar o lembrete no banco de dados");
  }, []);

  useEffect(() => {
    const off = onValue(
      remindersRef,
      (snap) => {
        const list = Object.values(snap.val() || {}).filter((r) => r && typeof r === "object" && r.id && r.date);
        setItems(list);
        try {
          localStorage.setItem(REMINDERS_CACHE, JSON.stringify(list));
        } catch {
          /* armazenamento indisponível */
        }
        setLoaded(true);
      },
      (e) => {
        console.error("Firebase:", e);
        errRef.current?.("Sem acesso ao banco de dados. Usando os lembretes salvos neste aparelho");
        setLoaded(true);
      }
    );
    return off;
  }, []);

  const add = useCallback(async (r) => {
    const item = dropUndefined({ id: remId(), done: false, createdAt: Date.now(), ...r });
    dbSet(reminderRef(item.id), item).catch(fail);
    return item;
  }, [fail]);

  const toggle = useCallback((id) => {
    const cur = itemsRef.current.find((i) => i.id === id);
    if (!cur) return;
    // completedAt: null apaga o campo no banco
    dbUpdate(reminderRef(id), { done: !cur.done, completedAt: cur.done ? null : Date.now() }).catch(fail);
  }, [fail]);

  const update = useCallback(async (id, fields) => {
    dbUpdate(reminderRef(id), dropUndefined(fields)).catch(fail);
  }, [fail]);

  const remove = useCallback((id) => {
    dbRemove(reminderRef(id)).catch(fail);
  }, [fail]);

  const clearDone = useCallback(() => {
    const batch = {};
    itemsRef.current.filter((i) => i.done).forEach((i) => (batch[i.id] = null));
    if (Object.keys(batch).length) dbUpdate(remindersRef, batch).catch(fail);
  }, [fail]);

  return { items, loaded, add, toggle, update, remove, clearDone };
}

/* ----- avisos do sistema ----- */
// ponte do APK gerado pelo freewebtoapk (só existe dentro do app Android)
const bridge = () => (typeof window !== "undefined" ? window.WebToApk || null : null);
const numId = (id) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) % 2147483647 || 1;
};
const dueMs = (r) => new Date(`${r.date}T${r.time}:00`).getTime();

function askNotifPermission() {
  try {
    const b = bridge();
    if (b) {
      if (b.requestNotificationPermission) b.requestNotificationPermission();
      return;
    }
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } catch {
    /* noop */
  }
}

async function notifyDevice(body, id) {
  try {
    if (bridge()) return; // no APK, o aviso é agendado pelo sistema Android
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opts = {
      body,
      icon: "/assets/logo.png",
      badge: "/assets/logo.png",
      tag: id,
      renotify: true,
      vibrate: [200, 100, 200],
    };
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification("Anotei", opts); // Android + Windows
    else new Notification("Anotei", opts); // fallback desktop
  } catch (e) {
    console.error("Notificação:", e);
  }
}

// Relógio + alerta na hora de cada lembrete. Fica no app inteiro (não só na tela de lembretes).
function useReminderAlerts(items, loaded) {
  const [now, setNow] = useState(() => new Date());
  const notified = useRef(new Set());
  const primed = useRef(false);
  const scheduled = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  const todayKey = toKey(now);

  // alerta quando chega a hora de um lembrete
  useEffect(() => {
    if (!loaded) return;
    const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    // na primeira carga, lembretes que já passaram não devem disparar aviso
    const first = !primed.current;
    primed.current = true;
    items.forEach((r) => {
      if (r.done || !r.time || r.date !== todayKey || notified.current.has(r.id)) return;
      if (first) {
        if (r.time <= hm) notified.current.add(r.id);
        return;
      }
      if (r.time <= hm) {
        notified.current.add(r.id);
        notifyDevice(r.text, r.id);
      }
    });
  }, [now, items, todayKey, loaded]);

  // Android (APK): agenda os lembretes no sistema, para tocarem com o app fechado
  useEffect(() => {
    const b = bridge();
    if (!b || !loaded) return;
    try {
      const want = new Map();
      items.forEach((r) => {
        if (r.done || !r.time) return;
        const at = dueMs(r);
        if (at > Date.now()) want.set(r.id, { at, text: r.text, sig: `${r.text}|${at}` });
      });
      if (scheduled.current === null) {
        b.cancelAllNotifications(); // primeira sincronização: recomeça do zero
        scheduled.current = new Map();
      }
      scheduled.current.forEach((_, id) => {
        if (!want.has(id)) {
          b.cancelNotification(numId(id));
          scheduled.current.delete(id);
        }
      });
      want.forEach((w, id) => {
        if (scheduled.current.get(id) !== w.sig) {
          b.scheduleNotification(numId(id), "Anotei", w.text, String(w.at), "none");
          scheduled.current.set(id, w.sig);
        }
      });
    } catch (e) {
      console.error("Agendamento:", e);
    }
  }, [items, loaded]);

  return { now, todayKey, notified };
}

/* ----- ícones ----- */
function RIcon({ name, size = 20 }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  switch (name) {
    case "plus":
      return (<svg {...p}><path d="M12 5v14M5 12h14" /></svg>);
    case "check":
      return (<svg {...p} strokeWidth={2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
    case "mic":
      return (<svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>);
    case "calendar":
      return (<svg {...p}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" /></svg>);
    case "edit":
      return (<svg {...p}><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4zM13.5 6.5l4 4" /></svg>);
    case "clock":
      return (<svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></svg>);
    case "trash":
      return (<svg {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>);
    case "phone":
      return (<svg {...p}><path d="M5 4h3.5l1.7 4.3-2.1 1.3a11 11 0 005.3 5.3l1.3-2.1L19 14.5V18a2 2 0 01-2 2A13 13 0 013 6a2 2 0 012-2z" /></svg>);
    case "copy":
      return (<svg {...p}><rect x="9" y="9" width="11" height="11" rx="3" /><path d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3" /></svg>);
    case "lock":
      return (<svg {...p}><rect x="5" y="11" width="14" height="9" rx="3" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>);
    case "eye":
      return (<svg {...p}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);
    case "eye-off":
      return (<svg {...p}><path d="M3 3l18 18M10.6 6.1A9.6 9.6 0 0112 6c6.4 0 10 6 10 6a17 17 0 01-3.2 3.9M6.5 7.6C3.9 9.3 2 12 2 12s3.6 6 10 6c1.5 0 2.8-.3 4-.8M9.9 9.9a3 3 0 004.2 4.2" /></svg>);
    case "key":
      return (<svg {...p}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M17 6l3 3M14.5 8.5l2 2" /></svg>);
    case "refresh":
      return (<svg {...p}><path d="M20 11a8 8 0 00-14.5-3.5L4 9M4 4v5h5M4 13a8 8 0 0014.5 3.5L20 15M20 20v-5h-5" /></svg>);
    case "chev-left":
      return (<svg {...p} strokeWidth={2.2}><path d="M14.5 6l-6 6 6 6" /></svg>);
    case "chev-right":
      return (<svg {...p} strokeWidth={2.2}><path d="M9.5 6l6 6-6 6" /></svg>);
    default:
      return null;
  }
}

/* ----- comando de voz ----- */
function Said({ text }) {
  const m = text.match(TRIGGER);
  if (!m || !m[0].trim()) return <>{text}</>;
  const lead = m[0].replace(/\s+$/, "");
  return (
    <>
      <span className="rem-hl">{lead}</span>
      {text.slice(lead.length)}
    </>
  );
}

function VoiceDialog({ defaultDate, onSave, onClose }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [parsed, setParsed] = useState(null);
  const [typed, setTyped] = useState("");
  const recRef = useRef(null);
  const txtRef = useRef("");

  const interpret = useCallback(
    (t) => {
      const clean = t.trim();
      if (clean) setParsed(parseReminder(clean, defaultDate));
    },
    [defaultDate]
  );

  const start = useCallback(() => {
    if (!SpeechRecognition) return;
    setError("");
    setParsed(null);
    setTranscript("");
    txtRef.current = "";
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      txtRef.current = t;
      setTranscript(t);
    };
    rec.onerror = (e) => {
      const msgs = {
        "not-allowed": "Permita o acesso ao microfone no navegador para usar a voz.",
        "service-not-allowed": "Permita o acesso ao microfone no navegador para usar a voz.",
        "no-speech": "Não ouvi nada. Toque no microfone e tente de novo.",
        "audio-capture": "Nenhum microfone encontrado.",
        network: "Sem conexão com o serviço de voz.",
      };
      if (e.error !== "aborted") setError(msgs[e.error] || "Não foi possível usar o microfone.");
    };
    rec.onend = () => {
      setListening(false);
      interpret(txtRef.current);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      /* já estava ouvindo */
    }
  }, [interpret]);

  useEffect(() => {
    start();
    return () => {
      const r = recRef.current;
      if (r) {
        r.onend = null;
        r.onerror = null;
        r.onresult = null;
        try {
          r.abort();
        } catch {
          /* noop */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onMic = () => {
    if (listening) recRef.current?.stop();
    else start();
  };

  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="confirm-dialog rem-voice" role="dialog" aria-modal="true" aria-label="Comando de voz">
        <h2>Como posso te ajudar?</h2>

        <div className="rem-said" aria-live="polite">
          {parsed ? (
            <div className="rem-preview">
              <p className="rem-pv-text">{parsed.text}</p>
              <div className="rem-chips">
                <span className="rem-chip">{dateLabel(parsed.date)}</span>
                {parsed.time && <span className="rem-chip">{parsed.time}</span>}
              </div>
            </div>
          ) : transcript ? (
            <p className="rem-said-text"><Said text={transcript} /></p>
          ) : (
            <p className="rem-hint">
              {listening ? "Estou ouvindo…" : "Toque no microfone e fale."}
              <br />
              <span>Ex.: “Lembre-me de ligar para a Maria amanhã às 14h”</span>
            </p>
          )}
          {error && <p className="rem-error">{error}</p>}
        </div>

        {!SpeechRecognition && (
          <form
            className="rem-typed"
            onSubmit={(e) => {
              e.preventDefault();
              interpret(typed);
            }}
          >
            <p className="rem-error">Este navegador não tem reconhecimento de voz. Digite a frase:</p>
            <input className="rem-field" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Lembre-me de…" />
            <button className="confirm-btn" type="submit">Interpretar</button>
          </form>
        )}

        <div className="rem-mic-wrap">
          <span className={"rem-ring r2" + (listening ? " on" : "")} />
          <span className={"rem-ring r1" + (listening ? " on" : "")} />
          <button
            type="button"
            className="rem-mic"
            onClick={onMic}
            disabled={!SpeechRecognition}
            aria-label={listening ? "Parar de ouvir" : "Começar a ouvir"}
          >
            <RIcon name="mic" size={28} />
          </button>
        </div>

        <div className="confirm-actions">
          <button type="button" className="confirm-btn" onClick={onClose}>Cancelar</button>
          {parsed && (
            <>
              <button type="button" className="confirm-btn" onClick={start} disabled={!SpeechRecognition}>Falar de novo</button>
              <button type="button" className="confirm-btn danger" onClick={() => onSave(parsed)}>Adicionar</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ----- seletores de data e hora ----- */
function usePopover(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // fecha só o seletor, não o formulário inteiro
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, setOpen, ref]);
}

const WEEK_INITIALS = ["D", "S", "T", "Q", "Q", "S", "S"];

function DatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? fromKey(value) : new Date()));
  const ref = useRef(null);
  usePopover(open, setOpen, ref);

  const toggle = () => {
    if (!open) setView(value ? fromKey(value) : new Date());
    setOpen(!open);
  };

  const y = view.getFullYear();
  const m = view.getMonth();
  const first = new Date(y, m, 1);
  const start = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const todayK = toKey(new Date());
  const shown = value ? fromKey(value).toLocaleDateString("pt-BR") : "dd/mm/aaaa";

  return (
    <div className="rem-pick" ref={ref}>
      <button type="button" className={"rem-field" + (open ? " open" : "")} onClick={toggle} aria-haspopup="dialog" aria-expanded={open}>
        <span className={value ? "" : "ph"}>{shown}</span>
        <RIcon name="calendar" size={20} />
      </button>
      {open && (
        <div className="rem-pop date" role="dialog" aria-label="Escolher data">
          <div className="rem-pop-head">
            <b>{cap(view.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }))}</b>
            <div className="rem-nav">
              <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="Mês anterior">
                <RIcon name="chev-left" size={18} />
              </button>
              <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="Próximo mês">
                <RIcon name="chev-right" size={18} />
              </button>
            </div>
          </div>
          <div className="rem-cal week">
            {WEEK_INITIALS.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="rem-cal">
            {cells.map((d) => {
              const k = toKey(d);
              const cls = ["rem-day-btn", d.getMonth() !== m ? "out" : "", k === value ? "sel" : "", k === todayK ? "today" : ""].join(" ");
              return (
                <button
                  type="button"
                  key={k}
                  className={cls}
                  onClick={() => {
                    onChange(k);
                    setOpen(false);
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="rem-pop-foot">
            <button
              type="button"
              onClick={() => {
                onChange(todayK);
                setOpen(false);
              }}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  usePopover(open, setOpen, ref);
  const [h, mi] = value ? value.split(":") : ["", ""];

  useEffect(() => {
    if (!open || !ref.current) return;
    ref.current.querySelectorAll(".rem-col").forEach((col) => {
      const el = col.querySelector(".rem-col-item.sel");
      if (el) col.scrollTop = el.offsetTop - col.clientHeight / 2 + el.offsetHeight / 2;
    });
  }, [open]);

  const setH = (n) => onChange(`${pad(n)}:${mi || "00"}`);
  const setM = (n) => onChange(`${h || pad(new Date().getHours())}:${pad(n)}`);

  return (
    <div className="rem-pick" ref={ref}>
      <button type="button" className={"rem-field" + (open ? " open" : "")} onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
        <span className={value ? "" : "ph"}>{value || "--:--"}</span>
        <RIcon name="clock" size={20} />
      </button>
      {open && (
        <div className="rem-pop time" role="dialog" aria-label="Escolher horário">
          <div className="rem-cols">
            <div className="rem-col" aria-label="Hora">
              {Array.from({ length: 24 }, (_, n) => (
                <button type="button" key={n} className={"rem-col-item" + (pad(n) === h ? " sel" : "")} onClick={() => setH(n)}>
                  {pad(n)}
                </button>
              ))}
            </div>
            <span className="rem-col-sep">:</span>
            <div className="rem-col" aria-label="Minuto">
              {Array.from({ length: 60 }, (_, n) => (
                <button type="button" key={n} className={"rem-col-item" + (pad(n) === mi ? " sel" : "")} onClick={() => setM(n)}>
                  {pad(n)}
                </button>
              ))}
            </div>
          </div>
          <div className="rem-pop-foot split">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Limpar
            </button>
            <button type="button" onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----- novo lembrete / editar lembrete ----- */
function ReminderForm({ defaultDate, initial, onSave, onVoice, onClose }) {
  const editing = !!initial;
  const [text, setText] = useState(initial?.text ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? "");
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || !date) return;
    onSave({ text: cap(text.trim()), date, time });
  };

  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="confirm-dialog rem-form" role="dialog" aria-modal="true" aria-label={editing ? "Editar lembrete" : "Novo lembrete"} onSubmit={submit}>
        <h2>{editing ? "Editar lembrete" : "Novo lembrete"}</h2>
        <div className="rem-row">
          <input
            ref={ref}
            className="rem-field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="O que você precisa lembrar?"
            aria-label="Lembrete"
            maxLength={140}
            autoComplete="off"
          />
          {onVoice && (
            <button type="button" className="icon-btn" onClick={onVoice} aria-label="Ditar por voz">
              <RIcon name="mic" />
            </button>
          )}
        </div>
        <div className="rem-two">
          <div className="rem-lbl">
            <span>Data</span>
            <DatePicker value={date} onChange={setDate} />
          </div>
          <div className="rem-lbl">
            <span>Horário</span>
            <TimePicker value={time} onChange={setTime} />
          </div>
        </div>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="confirm-btn danger" disabled={!text.trim() || !date}>
            {editing ? "Salvar" : "Adicionar lembrete"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ----- item da lista ----- */
function ReminderItem({ r, leaving, onToggle, onEdit, onRemove }) {
  return (
    <li className={"rem-item" + (r.done ? " done" : "") + (leaving ? " leaving" : "")} onClick={() => onToggle(r.id)}>
      <button
        type="button"
        className={"rem-check" + (r.done ? " on" : "")}
        role="checkbox"
        aria-checked={!!r.done}
        aria-label={`Marcar “${r.text}” como ${r.done ? "pendente" : "concluído"}`}
      >
        {r.done && <RIcon name="check" size={14} />}
      </button>
      <div className="rem-body">
        <p>{r.text}</p>
      </div>
      {r.time && <span className="rem-time">{r.time}</span>}
      <div className="rem-actions">
        <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(r); }} aria-label={`Editar “${r.text}”`}>
          <RIcon name="edit" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onRemove(r); }} aria-label={`Excluir “${r.text}”`}>
          <RIcon name="trash" size={18} />
        </button>
      </div>
    </li>
  );
}

/* ----- tela de lembretes ----- */
function RemindersScreen({ rem, now, todayKey, notified, leaving, onAskDelete, onAskClearDone }) {
  const { items, loaded, add, toggle, update } = rem;
  const [filter, setFilter] = useState("all"); // "all" | "today" | "done"
  const [mode, setMode] = useState(null); // null | "add" | "edit" | "voice"
  const [editing, setEditing] = useState(null);

  // todos os lembretes, separados por data (pendentes primeiro, depois por horário)
  const sections = useMemo(() => {
    const byDate = {};
    items.forEach((i) => (byDate[i.date] = byDate[i.date] || []).push(i));
    return Object.keys(byDate)
      .sort()
      .map((date) => ({
        date,
        list: byDate[date]
          .slice()
          .sort(
            (x, y) =>
              Number(!!x.done) - Number(!!y.done) ||
              (x.time || "99:99").localeCompare(y.time || "99:99") ||
              (x.createdAt || 0) - (y.createdAt || 0)
          ),
      }));
  }, [items]);

  const todayList = useMemo(() => sections.find((s) => s.date === todayKey)?.list || [], [sections, todayKey]);
  const todayDone = todayList.filter((i) => i.done).length;
  const todayPending = todayList.length - todayDone;

  const doneAll = useMemo(() => items.filter((i) => i.done), [items]);
  const doneGroups = useMemo(() => {
    const map = {};
    doneAll.forEach((i) => (map[i.date] = map[i.date] || []).push(i));
    return Object.keys(map)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => ({ date, list: map[date].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)) }));
  }, [doneAll]);

  const scrollToDay = (key) => {
    setTimeout(() => document.getElementById("rem-day-" + key)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  // depois de salvar, mostra onde o lembrete foi parar
  const reveal = (date) => {
    if (filter === "done" || (filter === "today" && date !== todayKey)) setFilter("all");
    if (filter !== "today" || date !== todayKey) scrollToDay(date);
  };

  const closeForm = useCallback(() => {
    setMode(null);
    setEditing(null);
  }, []);

  const handleSave = async ({ text, date, time }) => {
    if (time) askNotifPermission();
    const item = await add({ text, date, time });
    if (time && new Date(`${date}T${time}:00`) <= new Date()) notified.current.add(item.id);
    setMode(null);
    reveal(date);
  };

  const handleEditSave = async ({ text, date, time }) => {
    if (!editing) return;
    if (time) askNotifPermission();
    await update(editing.id, { text, date, time });
    // se mudou data/hora, o alerta pode disparar de novo
    notified.current.delete(editing.id);
    if (time && new Date(`${date}T${time}:00`) <= new Date()) notified.current.add(editing.id);
    closeForm();
    if (filter !== "done") reveal(date);
  };

  const openEdit = (r) => {
    setEditing(r);
    setMode("edit");
  };

  const row = (r) => (
    <ReminderItem
      key={r.id}
      r={r}
      leaving={leaving === r.id || (leaving === "done" && r.done)}
      onToggle={toggle}
      onEdit={openEdit}
      onRemove={onAskDelete}
    />
  );

  const emptyBox = (title, hint) => (
    <div className="empty">
      <p style={{ margin: 0 }}>{title}<br />{hint}</p>
    </div>
  );

  return (
    <div className="rem">
      <div className="rem-head">
        <h2 className="section-title">
          {filter === "today" ? "Hoje" : filter === "done" ? "Concluídos" : "Lembretes"}
        </h2>
        {filter === "done" && doneAll.length > 0 && (
          <button type="button" className="confirm-btn" onClick={onAskClearDone}>Limpar concluídos</button>
        )}
      </div>
      {filter === "today" && (
        <p className="rem-sub">{cap(now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }))}</p>
      )}

      <div className="seg sm rem-filters" role="tablist" aria-label="Filtro de lembretes">
        <button type="button" role="tab" aria-selected={filter === "all"} data-active={filter === "all"} onClick={() => setFilter("all")}>
          Todos
        </button>
        <button type="button" role="tab" aria-selected={filter === "today"} data-active={filter === "today"} onClick={() => setFilter("today")}>
          Hoje{todayPending > 0 && <em>{todayPending > 99 ? "99+" : todayPending}</em>}
        </button>
        <button type="button" role="tab" aria-selected={filter === "done"} data-active={filter === "done"} onClick={() => setFilter("done")}>
          Concluídos{doneAll.length > 0 && <em>{doneAll.length > 99 ? "99+" : doneAll.length}</em>}
        </button>
      </div>

      {filter === "today" && todayList.length > 0 && (
        <div className="rem-progress">
          <div className="rem-bar" role="progressbar" aria-valuemin={0} aria-valuemax={todayList.length} aria-valuenow={todayDone}>
            <i style={{ width: `${(todayDone / todayList.length) * 100}%` }} />
          </div>
          <span>{todayDone} de {todayList.length} concluídos</span>
        </div>
      )}

      {filter === "all" &&
        (sections.length === 0
          ? loaded && emptyBox("Nenhum lembrete ainda.", "Toque em Novo lembrete ou no microfone para adicionar.")
          : sections.map((sec) => {
              const label = dateLabel(sec.date);
              const fixed = ["Hoje", "Amanhã", "Ontem"].includes(label);
              const d = fromKey(sec.date);
              return (
                <section className="rem-day" id={"rem-day-" + sec.date} key={sec.date}>
                  <h3 className="rem-day-title">
                    {fixed ? label : cap(d.toLocaleDateString("pt-BR", { weekday: "long" }))}
                    <span>{d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}</span>
                  </h3>
                  <ul className="rem-list">{sec.list.map(row)}</ul>
                </section>
              );
            }))}

      {filter === "today" &&
        (todayList.length === 0
          ? loaded && emptyBox("Nada marcado para hoje.", "Toque em Novo lembrete ou no microfone para adicionar.")
          : <section className="rem-day"><ul className="rem-list">{todayList.map(row)}</ul></section>)}

      {filter === "done" &&
        (doneGroups.length === 0
          ? loaded && emptyBox("Nenhum lembrete concluído.", "Marque um lembrete como feito e ele aparece aqui.")
          : doneGroups.map((g) => (
              <section className="rem-day" key={g.date}>
                <h3 className="rem-day-title">{dateLabel(g.date)}</h3>
                <ul className="rem-list">{g.list.map(row)}</ul>
              </section>
            )))}

      {!mode && (
        <div className="rem-dock">
          <button type="button" className="fab new-fab" onClick={() => setMode("add")} aria-label="Novo lembrete" title="Novo lembrete">
            <RIcon name="plus" size={22} />
            <span>Novo lembrete</span>
          </button>
          <button type="button" className="fab" onClick={() => setMode("voice")} aria-label="Adicionar por voz" title="Adicionar por voz">
            <RIcon name="mic" size={22} />
          </button>
        </div>
      )}

      {mode === "add" && (
        <ReminderForm defaultDate={todayKey} onSave={handleSave} onVoice={() => setMode("voice")} onClose={closeForm} />
      )}
      {mode === "edit" && editing && (
        <ReminderForm defaultDate={todayKey} initial={editing} onSave={handleEditSave} onClose={closeForm} />
      )}
      {mode === "voice" && (
        <VoiceDialog defaultDate={filter === "today" ? todayKey : undefined} onSave={handleSave} onClose={closeForm} />
      )}
    </div>
  );
}

/* ==========================  COMPRAS  ==========================
   Lógica trazida do Comprei (lista de mercado com valores, totais e categorias automáticas),
   agora no mesmo banco do Anotei (anotei-f5d92) e com a mesma aparência do app.
   Os itens ficam em "anotei/shopping". */
const SHOP_PATH = "anotei/shopping";
const SHOP_CACHE = "anotei-shopping-cache";
const shopRef = dbRef(db, SHOP_PATH);
const shopItemRef = (id) => dbRef(db, `${SHOP_PATH}/${id}`);

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shopNum = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });

/* Quantidade: "2" | "0,5" -> número. Vazio -> null. Inválido -> NaN */
function parseQty(text) {
  const clean = String(text).trim().replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/* Máscara de valor: guarda só os dígitos (centavos) e exibe em reais */
const toDigits = (text) => text.replace(/\D/g, "").replace(/^0+/, "").slice(0, 8);
const maskBRL = (digits) => (digits ? brl.format(Number(digits) / 100) : "");
const digitsToPrice = (digits) => (digits ? Number(digits) / 100 : null);
const priceToDigits = (price) => (price == null ? "" : String(Math.round(price * 100)));

/* ----- categorias (automáticas pelo nome do produto) ----- */
const SHOP_CATS = [
  { id: "alimentos", label: "Alimentos" },
  { id: "carnes", label: "Carnes" },
  { id: "limpeza", label: "Limpeza" },
  { id: "frutas", label: "Frutas" },
  { id: "verduras", label: "Verduras" },
  { id: "outros", label: "Outros" },
];
const SHOP_CAT_IDS = SHOP_CATS.map((c) => c.id);

const SHOP_KEYWORDS = {
  limpeza: ["sabao", "detergente", "desinfetante", "sanitaria", "amaciante", "esponja", "lixo", "multiuso", "alcool", "limpador", "cloro", "vassoura", "rodo", "lava"],
  carnes: ["carne", "bife", "frango", "peixe", "linguica", "presunto", "salsicha", "bacon", "costela", "picanha", "hamburguer", "file", "patinho", "acem", "coxa", "peito", "tilapia", "salmao", "camarao", "mortadela", "calabresa"],
  frutas: ["fruta", "banana", "maca", "uva", "morango", "laranja", "limao", "abacate", "abacaxi", "melancia", "mamao", "manga", "pera", "framboesa", "melao", "kiwi"],
  verduras: ["tomate", "alface", "cenoura", "batata", "cebola", "alho", "verdura", "legume", "couve", "brocolis", "pepino", "pimentao", "abobrinha", "repolho", "salada", "rucula", "espinafre", "coentro", "cheiro", "mandioca", "beterraba"],
  alimentos: ["leite", "ovo", "pao", "queijo", "iogurte", "manteiga", "margarina", "arroz", "feijao", "macarrao", "massa", "farinha", "acucar", "sal", "oleo", "azeite", "cafe", "cha", "agua", "suco", "refrigerante", "cerveja", "vinho", "chocolate", "biscoito", "bolacha", "sorvete", "molho", "cereal", "aveia", "requeijao", "bolo", "pizza", "sardinha", "atum", "milho", "ervilha", "maionese", "ketchup", "mostarda", "granola", "mel", "geleia"],
};

/* Palavra do nome bate com a palavra-chave (evita "maca" casar com "macarrao") */
function shopMatches(name, key) {
  return fold(name)
    .split(/[^a-z]+/)
    .some((t) => t === key || t === key + "s" || t === key + "es" || (key.length >= 5 && t.startsWith(key)));
}

function shopCategoryFor(name) {
  for (const id of ["limpeza", "carnes", "frutas", "verduras", "alimentos"]) {
    if (SHOP_KEYWORDS[id].some((k) => shopMatches(name, k))) return id;
  }
  return "outros";
}

// Formato único de item (o banco pode ter itens sem categoria ou sem valor).
const normShop = (r) => ({
  id: r.id,
  name: r.name,
  qty: Number(r.qty) > 0 ? Number(r.qty) : 1,
  price: r.price == null || !Number.isFinite(Number(r.price)) ? null : Number(r.price),
  cat: SHOP_CAT_IDS.includes(r.cat) ? r.cat : shopCategoryFor(r.name),
  done: !!r.done,
  createdAt: r.createdAt || 0,
});

/* ----- dados: ouve o banco em tempo real ----- */
function useShopping(onError) {
  // começa com o último cache local: a lista aparece na hora, antes do banco responder
  const [items, setItems] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem(SHOP_CACHE));
      return Array.isArray(c) ? c : [];
    } catch {
      return [];
    }
  });
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef([]);
  itemsRef.current = items;
  const errRef = useRef(onError);
  errRef.current = onError;

  const fail = useCallback((e) => {
    console.error("Firebase:", e);
    errRef.current?.("Não foi possível salvar a lista de compras no banco de dados");
  }, []);

  useEffect(() => {
    // sem internet o banco pode demorar a responder: não deixa a tela esperando para sempre
    const timer = setTimeout(() => setLoaded(true), 5000);
    const off = onValue(
      shopRef,
      (snap) => {
        const list = Object.values(snap.val() || {})
          .filter((r) => r && typeof r === "object" && r.id && typeof r.name === "string")
          .map(normShop)
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
        setItems(list);
        try {
          localStorage.setItem(SHOP_CACHE, JSON.stringify(list));
        } catch {
          /* armazenamento indisponível */
        }
        setLoaded(true);
      },
      (e) => {
        console.error("Firebase:", e);
        errRef.current?.("Sem acesso ao banco de dados. Usando a lista de compras salva neste aparelho");
        setLoaded(true);
      }
    );
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);

  const add = useCallback((r) => {
    const item = dropUndefined({ id: remId(), done: false, createdAt: Date.now(), ...r });
    dbSet(shopItemRef(item.id), item).catch(fail);
    return item;
  }, [fail]);

  const toggle = useCallback((id) => {
    const cur = itemsRef.current.find((i) => i.id === id);
    if (!cur) return;
    dbUpdate(shopItemRef(id), { done: !cur.done }).catch(fail);
  }, [fail]);

  // price: null apaga o valor no banco
  const update = useCallback((id, fields) => {
    dbUpdate(shopItemRef(id), dropUndefined(fields)).catch(fail);
  }, [fail]);

  const remove = useCallback((id) => {
    dbRemove(shopItemRef(id)).catch(fail);
  }, [fail]);

  const clearAll = useCallback(() => {
    dbRemove(shopRef).catch(fail);
  }, [fail]);

  return { items, loaded, add, toggle, update, remove, clearAll };
}

/* Anima um número até o valor final (respeita prefers-reduced-motion) */
function useAnimatedNumber(target, duration = 450) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (t0) => {
      const t = Math.min(1, (t0 - start) / duration);
      const v = from + (target - from) * (1 - Math.pow(1 - t, 3));
      fromRef.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

/* ----- valor do item: toque para digitar (vazio remove o valor) ----- */
function PriceCell({ item, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const cancelled = useRef(false);
  const hasPrice = item.price != null;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const open = () => {
    cancelled.current = false;
    setText(priceToDigits(item.price));
    setEditing(true);
  };

  const commit = () => {
    if (!cancelled.current) onSave(digitsToPrice(text));
    setEditing(false);
  };

  // a linha inteira marca/desmarca o item; o valor não deve disparar isso
  return (
    <span className="shop-price-wrap" onClick={(e) => e.stopPropagation()}>
      {editing ? (
        <input
          ref={inputRef}
          className="shop-price-input"
          inputMode="numeric"
          placeholder="R$ 0,00"
          aria-label="Valor unitário"
          value={maskBRL(text)}
          onChange={(e) => setText(toDigits(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.stopPropagation();
              cancelled.current = true;
              e.currentTarget.blur();
            }
          }}
        />
      ) : hasPrice ? (
        <button type="button" className="rem-time shop-price" onClick={open} aria-label={`Editar valor de “${item.name}”`}>
          {brl.format(item.price * item.qty)}
        </button>
      ) : (
        <button type="button" className="rem-time shop-price add" onClick={open} aria-label={`Adicionar valor de “${item.name}”`}>
          + valor
        </button>
      )}
    </span>
  );
}

/* ----- novo item / editar item ----- */
function ShoppingForm({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [cat, setCat] = useState(initial?.cat ?? "alimentos");
  const [touched, setTouched] = useState(editing); // categoria escolhida à mão: para de sugerir
  const [qty, setQty] = useState(initial ? String(initial.qty).replace(".", ",") : "1");
  const [price, setPrice] = useState(initial ? priceToDigits(initial.price) : ""); // só dígitos (centavos)
  const [error, setError] = useState("");
  const [lastAdded, setLastAdded] = useState(""); // preenchido = mostra "Quer adicionar outro item?"
  const nameRef = useRef(null);

  useEffect(() => {
    if (!lastAdded) nameRef.current?.focus();
  }, [lastAdded]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleName = (value) => {
    setName(value);
    setError("");
    if (!touched) setCat(value.trim() ? shopCategoryFor(value) : "alimentos");
  };

  const submit = (e) => {
    e.preventDefault();
    const clean = name.trim();
    const q = parseQty(qty);
    if (!clean) return setError("Digite o nome do produto.");
    if (q == null || Number.isNaN(q) || q <= 0) return setError("Informe uma quantidade válida.");
    onSave({ name: clean, qty: q, price: digitsToPrice(price), cat });
    if (editing) return; // quem chamou fecha o formulário
    setName("");
    setQty("1");
    setPrice("");
    setCat("alimentos");
    setTouched(false);
    setError("");
    setLastAdded(clean);
  };

  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="confirm-dialog rem-form shop-form" role="dialog" aria-modal="true" aria-label={editing ? "Editar item" : "Novo item"}>
        {lastAdded ? (
          <>
            <div className="shop-ask">
              <span className="shop-ask-check" aria-hidden="true"><RIcon name="check" size={28} /></span>
              <div className="shop-ask-added">{lastAdded} adicionado</div>
              <h2>Quer adicionar outro item?</h2>
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={onClose}>Não, terminei</button>
              <button type="button" className="confirm-btn danger" autoFocus onClick={() => setLastAdded("")}>Sim, adicionar outro</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2>{editing ? "Editar item" : "Novo item"}</h2>
            <label className="rem-lbl shop-block">
              <span>Produto</span>
              <input
                ref={nameRef}
                className="rem-field"
                value={name}
                onChange={(e) => handleName(e.target.value)}
                placeholder="Ex.: Leite integral"
                maxLength={80}
                autoComplete="off"
              />
            </label>
            <div className="rem-lbl shop-block">
              <span>Categoria</span>
              <div className="shop-cats" role="group" aria-label="Categoria">
                {SHOP_CATS.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    className="chip"
                    data-active={cat === c.id}
                    aria-pressed={cat === c.id}
                    onClick={() => { setCat(c.id); setTouched(true); }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="shop-two">
              <label className="rem-lbl">
                <span>Qtd.</span>
                <input
                  className="rem-field"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => { setQty(e.target.value); setError(""); }}
                  onFocus={(e) => e.target.select()}
                  autoComplete="off"
                />
              </label>
              <label className="rem-lbl">
                <span>Valor unitário (opcional)</span>
                <input
                  className="rem-field"
                  inputMode="numeric"
                  placeholder="R$ 0,00"
                  value={maskBRL(price)}
                  onChange={(e) => setPrice(toDigits(e.target.value))}
                  autoComplete="off"
                />
              </label>
            </div>
            {error && <div className="shop-err" role="alert">{error}</div>}
            <div className="confirm-actions shop-actions">
              <button type="button" className="confirm-btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="confirm-btn danger">{editing ? "Salvar" : "Adicionar"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ----- item da lista ----- */
function ShoppingItem({ item, leaving, onToggle, onPrice, onEdit, onRemove }) {
  const sub = item.price != null
    ? `${shopNum.format(item.qty)} × ${brl.format(item.price)}`
    : `${shopNum.format(item.qty)} un. · sem valor`;
  return (
    <li className={"rem-item shop-item" + (item.done ? " done" : "") + (leaving ? " leaving" : "")} onClick={() => onToggle(item.id)}>
      <button
        type="button"
        className={"rem-check" + (item.done ? " on" : "")}
        role="checkbox"
        aria-checked={item.done}
        aria-label={`Marcar “${item.name}” como ${item.done ? "pendente" : "comprado"}`}
      >
        {item.done && <RIcon name="check" size={14} />}
      </button>
      <div className="rem-body">
        <p>{item.name}</p>
        <span className="shop-sub">{sub}</span>
      </div>
      <PriceCell item={item} onSave={(p) => onPrice(item.id, p)} />
      <div className="rem-actions">
        <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(item); }} aria-label={`Editar “${item.name}”`}>
          <RIcon name="edit" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={(e) => { e.stopPropagation(); onRemove(item); }} aria-label={`Remover “${item.name}”`}>
          <RIcon name="trash" size={18} />
        </button>
      </div>
    </li>
  );
}

/* ----- tela de compras ----- */
function ShoppingScreen({ shop, leaving, onAskDelete, onAskClear }) {
  const { items, loaded, add, toggle, update } = shop;
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState(null); // null | "add" | "edit"
  const [editing, setEditing] = useState(null);

  // totais em uma única passagem pela lista
  const { total, doneTotal } = useMemo(() => {
    let total = 0, doneTotal = 0;
    for (const i of items) {
      if (i.price != null) {
        const v = i.price * i.qty;
        total += v;
        if (i.done) doneTotal += v;
      }
    }
    return { total, doneTotal };
  }, [items]);
  const shownTotal = useAnimatedNumber(total);
  const shownDoneTotal = useAnimatedNumber(doneTotal);

  // agrupa por categoria (pendentes primeiro, marcados no fim)
  const groups = useMemo(() => {
    const q = fold(query.trim());
    const by = new Map(SHOP_CATS.map((c) => [c.id, { ...c, pending: [], done: [], subtotal: 0 }]));
    for (const i of items) {
      if (q && !fold(i.name).includes(q)) continue;
      const g = by.get(i.cat);
      if (!g) continue;
      (i.done ? g.done : g.pending).push(i);
      if (i.price != null) g.subtotal += i.price * i.qty;
    }
    return [...by.values()]
      .map(({ pending, done, ...g }) => ({ ...g, items: [...pending, ...done] }))
      .filter((g) => g.items.length > 0);
  }, [items, query]);

  const closeForm = useCallback(() => {
    setMode(null);
    setEditing(null);
  }, []);

  const handleEditSave = (data) => {
    if (editing) update(editing.id, data);
    closeForm();
  };

  const emptyBox = (title, hint) => (
    <div className="empty">
      <p style={{ margin: 0 }}>{title}{hint && <><br />{hint}</>}</p>
    </div>
  );

  return (
    <div className="rem shop">
      <div className="rem-head">
        <h2 className="section-title">
          Compras
        </h2>
        {items.length > 0 && (
          <button type="button" className="confirm-btn shop-clear" onClick={onAskClear}>Limpar lista</button>
        )}
      </div>

      <section className="shop-sum" aria-live="polite">
        <div>
          <span className="shop-sum-label">Total da compra</span>
          <span className="shop-sum-value">{brl.format(shownTotal)}</span>
        </div>
        <div className="shop-sum-done">
          <span className="shop-sum-label">Já marcados</span>
          <span className="shop-sum-value">{brl.format(shownDoneTotal)}</span>
        </div>
      </section>

      {items.length > 0 && (
        <input
          className="search shop-search"
          type="search"
          inputMode="search"
          placeholder="Pesquisar produtos"
          aria-label="Pesquisar produtos"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {items.length === 0
        ? loaded && emptyBox("Sua lista está vazia.", "Toque em Novo item para adicionar o primeiro — o valor pode ficar para depois.")
        : groups.length === 0
          ? emptyBox(`Nenhum produto encontrado para “${query.trim()}”.`)
          : groups.map((g) => (
              <section className="shop-cat" key={g.id}>
                <h3 className="shop-cat-title">
                  {g.label}
                  <span>{g.subtotal > 0 ? brl.format(g.subtotal) : `${g.items.length} ${g.items.length === 1 ? "item" : "itens"}`}</span>
                </h3>
                <ul className="shop-list">
                  {g.items.map((item) => (
                    <ShoppingItem
                      key={item.id}
                      item={item}
                      leaving={leaving === item.id || leaving === "all"}
                      onToggle={toggle}
                      onPrice={(id, price) => update(id, { price })}
                      onEdit={(i) => { setEditing(i); setMode("edit"); }}
                      onRemove={onAskDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}

      {!mode && (
        <div className="rem-dock">
          <button type="button" className="fab new-fab" onClick={() => setMode("add")} aria-label="Novo item" title="Novo item">
            <RIcon name="plus" size={22} />
            <span>Novo item</span>
          </button>
        </div>
      )}

      {mode === "add" && <ShoppingForm onSave={add} onClose={closeForm} />}
      {mode === "edit" && editing && <ShoppingForm initial={editing} onSave={handleEditSave} onClose={closeForm} />}
    </div>
  );
}

/* ==========================  CONTATOS  ==========================
   Agenda de telefones, no mesmo banco do Anotei. Os contatos ficam em "anotei/contacts". */
const CONTACTS_PATH = "anotei/contacts";
const CONTACTS_CACHE = "anotei-contacts-cache";
const contactsRef = dbRef(db, CONTACTS_PATH);
const contactRef = (id) => dbRef(db, `${CONTACTS_PATH}/${id}`);

/* Telefone: guarda só os dígitos (até 11) e exibe como (11) 91234-5678 */
const phoneDigits = (t) => String(t || "").replace(/\D/g, "").slice(0, 11);
function formatPhone(value) {
  const d = phoneDigits(value);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}${d.length > 6 ? "-" + d.slice(6) : ""}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function useContacts(onError) {
  const [items, setItems] = useState(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CONTACTS_CACHE));
      return Array.isArray(c) ? c : [];
    } catch {
      return [];
    }
  });
  const [loaded, setLoaded] = useState(false);
  const errRef = useRef(onError);
  errRef.current = onError;

  const fail = useCallback((e) => {
    console.error("Firebase:", e);
    errRef.current?.("Não foi possível salvar o contato no banco de dados");
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 5000);
    const off = onValue(
      contactsRef,
      (snap) => {
        const list = Object.values(snap.val() || {})
          .filter((c) => c && typeof c === "object" && c.id && typeof c.name === "string")
          .map((c) => ({ id: c.id, name: c.name, phone: phoneDigits(c.phone), createdAt: c.createdAt || 0 }));
        setItems(list);
        try {
          localStorage.setItem(CONTACTS_CACHE, JSON.stringify(list));
        } catch {
          /* armazenamento indisponível */
        }
        setLoaded(true);
      },
      (e) => {
        console.error("Firebase:", e);
        errRef.current?.("Sem acesso ao banco de dados. Usando os contatos salvos neste aparelho");
        setLoaded(true);
      }
    );
    return () => {
      clearTimeout(timer);
      off();
    };
  }, []);

  const add = useCallback((c) => {
    const item = dropUndefined({ id: remId(), createdAt: Date.now(), ...c });
    dbSet(contactRef(item.id), item).catch(fail);
    return item;
  }, [fail]);
  const update = useCallback((id, fields) => {
    dbUpdate(contactRef(id), dropUndefined(fields)).catch(fail);
  }, [fail]);
  const remove = useCallback((id) => {
    dbRemove(contactRef(id)).catch(fail);
  }, [fail]);

  return { items, loaded, add, update, remove };
}

/* ----- novo contato / editar contato ----- */
function ContactForm({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [error, setError] = useState("");
  const [lastAdded, setLastAdded] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (!lastAdded) nameRef.current?.focus();
  }, [lastAdded]);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return setError("Digite o nome do contato.");
    if (phone.length < 8) return setError("Informe um telefone válido.");
    onSave({ name: cap(clean), phone });
    if (editing) return; // quem chamou fecha o formulário
    setName("");
    setPhone("");
    setError("");
    setLastAdded(cap(clean));
  };

  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="confirm-dialog rem-form shop-form" role="dialog" aria-modal="true" aria-label={editing ? "Editar contato" : "Novo contato"}>
        {lastAdded ? (
          <>
            <div className="shop-ask">
              <span className="shop-ask-check" aria-hidden="true"><RIcon name="check" size={28} /></span>
              <div className="shop-ask-added">{lastAdded} adicionado</div>
              <h2>Quer adicionar outro contato?</h2>
            </div>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={onClose}>Não, terminei</button>
              <button type="button" className="confirm-btn danger" autoFocus onClick={() => setLastAdded("")}>Sim, adicionar outro</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2>{editing ? "Editar contato" : "Novo contato"}</h2>
            <label className="rem-lbl shop-block">
              <span>Nome</span>
              <input
                ref={nameRef}
                className="rem-field"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="Ex.: Maria Silva"
                maxLength={60}
                autoComplete="off"
              />
            </label>
            <label className="rem-lbl shop-block" style={{ marginBottom: 22 }}>
              <span>Telefone</span>
              <input
                className="rem-field"
                type="tel"
                inputMode="tel"
                placeholder="(11) 91234-5678"
                value={formatPhone(phone)}
                onChange={(e) => { setPhone(phoneDigits(e.target.value)); setError(""); }}
                autoComplete="off"
              />
            </label>
            {error && <div className="shop-err" role="alert">{error}</div>}
            <div className="confirm-actions shop-actions">
              <button type="button" className="confirm-btn" onClick={onClose}>Cancelar</button>
              <button type="submit" className="confirm-btn danger">{editing ? "Salvar" : "Adicionar"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ----- item da lista ----- */
function ContactItem({ c, leaving, onEdit, onRemove }) {
  return (
    <li className={"rem-item contact-item" + (leaving ? " leaving" : "")}>
      <span className="contact-avatar" aria-hidden="true">{(c.name.trim()[0] || "?")}</span>
      <div className="rem-body">
        <p>{c.name}</p>
        <span className="contact-phone">{formatPhone(c.phone)}</span>
      </div>
      <div className="rem-actions">
        <button type="button" className="icon-btn" onClick={() => onEdit(c)} aria-label={`Editar “${c.name}”`}>
          <RIcon name="edit" size={18} />
        </button>
        <button type="button" className="icon-btn" onClick={() => onRemove(c)} aria-label={`Excluir “${c.name}”`}>
          <RIcon name="trash" size={18} />
        </button>
      </div>
    </li>
  );
}

/* ----- tela de contatos ----- */
function ContactsScreen({ contacts, leaving, onAskDelete }) {
  const { items, loaded, add, update } = contacts;
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState(null); // null | "add" | "edit"
  const [editing, setEditing] = useState(null);

  // agrupa por letra inicial, em ordem alfabética
  const groups = useMemo(() => {
    const q = fold(query.trim());
    const qd = query.replace(/\D/g, "");
    const by = new Map();
    items
      .filter((c) => !q || fold(c.name).includes(q) || (qd && c.phone.includes(qd)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }))
      .forEach((c) => {
        const ch = fold(c.name.trim()).charAt(0).toUpperCase();
        const letter = /[A-Z]/.test(ch) ? ch : "#";
        if (!by.has(letter)) by.set(letter, []);
        by.get(letter).push(c);
      });
    return [...by.entries()].sort(([a], [b]) => (a === "#") - (b === "#") || a.localeCompare(b));
  }, [items, query]);

  const closeForm = useCallback(() => {
    setMode(null);
    setEditing(null);
  }, []);

  const handleEditSave = (data) => {
    if (editing) update(editing.id, data);
    closeForm();
  };

  return (
    <div className="rem shop">
      <div className="rem-head">
        <h2 className="section-title">Contatos</h2>
      </div>

      {items.length > 0 && (
        <input
          className="search shop-search"
          type="search"
          inputMode="search"
          placeholder="Pesquisar nome ou telefone"
          aria-label="Pesquisar contatos"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {items.length === 0
        ? loaded && (
            <div className="empty">
              <p style={{ margin: 0 }}>Nenhum contato ainda.<br />Toque em Novo contato para adicionar o primeiro.</p>
            </div>
          )
        : groups.length === 0
          ? (
            <div className="empty">
              <p style={{ margin: 0 }}>Nenhum contato encontrado para “{query.trim()}”.</p>
            </div>
          )
          : groups.map(([letter, list]) => (
              <section className="shop-cat" key={letter}>
                <h3 className="shop-cat-title">{letter}<span>{list.length}</span></h3>
                <ul className="shop-list">
                  {list.map((c) => (
                    <ContactItem
                      key={c.id}
                      c={c}
                      leaving={leaving === c.id}
                      onEdit={(x) => { setEditing(x); setMode("edit"); }}
                      onRemove={onAskDelete}
                    />
                  ))}
                </ul>
              </section>
            ))}

      {!mode && (
        <div className="rem-dock">
          <button type="button" className="fab new-fab" onClick={() => setMode("add")} aria-label="Novo contato" title="Novo contato">
            <RIcon name="plus" size={22} />
            <span>Novo contato</span>
          </button>
        </div>
      )}

      {mode === "add" && <ContactForm onSave={add} onClose={closeForm} />}
      {mode === "edit" && editing && <ContactForm initial={editing} onSave={handleEditSave} onClose={closeForm} />}
    </div>
  );
}

/* ==========================  COFRE DE SENHAS  ==========================
   Tudo é criptografado NO APARELHO antes de ir ao banco (AES-256-GCM). A chave nasce da senha mestra
   (PBKDF2-SHA256, 600 mil voltas + sal aleatório) e só existe na memória enquanto o cofre está aberto.
   O banco guarda apenas: sal, uma "prova" cifrada da senha mestra e os itens cifrados.
   A senha mestra NÃO é guardada em lugar nenhum: se for esquecida, os dados não têm como ser recuperados. */
const VAULT_PATH = "anotei/vault";
const vaultMetaRef = dbRef(db, `${VAULT_PATH}/meta`);
const vaultItemsRef = dbRef(db, `${VAULT_PATH}/items`);
const vaultItemRef = (id) => dbRef(db, `${VAULT_PATH}/items/${id}`);
const VAULT_ITER = 600000;
const VAULT_IDLE_MS = 3 * 60 * 1000; // bloqueia sozinho após 3 min sem uso
const VAULT_HIDDEN_MS = 60 * 1000; // ... ou 1 min com a aba/app em segundo plano
const VAULT_CLIP_MS = 30 * 1000; // limpa a área de transferência após 30 s
const vEnc = new TextEncoder();
const vDec = new TextDecoder();

const vB64 = (buf) => {
  const a = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s);
};
const vUnb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const vCryptoOk = () => typeof crypto !== "undefined" && !!crypto.subtle && !!crypto.getRandomValues;

async function vDerive(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", vEnc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false, // a chave não pode ser exportada
    ["encrypt", "decrypt"]
  );
}
// `aad` amarra o conteúdo ao seu id: trocar itens de lugar no banco faz a leitura falhar.
async function vSeal(key, obj, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: vEnc.encode(aad) }, key, vEnc.encode(JSON.stringify(obj)));
  return { iv: vB64(iv), ct: vB64(ct) };
}
async function vOpen(key, box, aad) {
  const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv: vUnb64(box.iv), additionalData: vEnc.encode(aad) }, key, vUnb64(box.ct));
  return JSON.parse(vDec.decode(buf));
}

// Gerador de senhas com sorteio criptográfico (sem viés).
function vGenerate(len = 20) {
  const sets = ["abcdefghijkmnopqrstuvwxyz", "ABCDEFGHJKLMNPQRSTUVWXYZ", "23456789", "!@#$%&*?-_+="];
  const all = sets.join("");
  const rnd = (n) => {
    const lim = Math.floor(0x100000000 / n) * n;
    const a = new Uint32Array(1);
    do { crypto.getRandomValues(a); } while (a[0] >= lim);
    return a[0] % n;
  };
  const out = sets.map((s) => s[rnd(s.length)]);
  while (out.length < len) out.push(all[rnd(all.length)]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

/* ----- tela de entrada: criar o cofre ou digitar a senha mestra ----- */
function VaultGate({ meta, onCreate, onUnlock }) {
  const creating = !meta;
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const msg = creating ? await onCreate(pw, pw2) : (await onUnlock(pw)) ? "" : "Senha mestra incorreta.";
      if (msg) setErr(msg);
    } catch (x) {
      console.error("Cofre:", x);
      setErr("Algo deu errado. Tente de novo.");
    }
    setBusy(false);
  };

  return (
    <form className="confirm-dialog vault-gate" onSubmit={submit}>
      <div className="vault-lock" aria-hidden="true"><RIcon name="lock" size={28} /></div>
      <h2>{creating ? "Criar cofre de senhas" : "Cofre bloqueado"}</h2>
      <p>
        {creating
          ? "Escolha uma senha mestra. Ela protege tudo e não fica salva em lugar nenhum."
          : "Digite a senha mestra para abrir seus logins."}
      </p>
      <label className="rem-lbl">
        <span>Senha mestra</span>
        <div className="vault-field">
          <input
            className="rem-field"
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => { setPw(e.target.value); setErr(""); }}
            autoFocus
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Senha mestra"
          />
          <div className="vault-tools">
            <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
              <RIcon name={show ? "eye-off" : "eye"} size={18} />
            </button>
          </div>
        </div>
      </label>
      {creating && (
        <label className="rem-lbl">
          <span>Repita a senha mestra</span>
          <input
            className="rem-field"
            type={show ? "text" : "password"}
            value={pw2}
            onChange={(e) => { setPw2(e.target.value); setErr(""); }}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Repita a senha mestra"
          />
        </label>
      )}
      {creating && (
        <p className="vault-warn" style={{ textAlign: "left" }}>
          Atenção: se você esquecer a senha mestra, não existe como recuperar os dados. Use uma frase longa, com 12 caracteres ou mais.
        </p>
      )}
      {err && <div className="shop-err" role="alert" style={{ margin: "0 0 14px" }}>{err}</div>}
      <div className="confirm-actions" style={{ justifyContent: "center" }}>
        <button type="submit" className="confirm-btn danger" disabled={busy || !pw}>
          {busy ? "Aguarde…" : creating ? "Criar cofre" : "Abrir cofre"}
        </button>
      </div>
    </form>
  );
}

/* ----- trocar a senha mestra ----- */
function VaultPasswordDialog({ onSubmit, onClose }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const msg = await onSubmit(cur, next, next2);
    if (msg) { setErr(msg); setBusy(false); }
  };
  const field = (label, value, set) => (
    <label className="rem-lbl shop-block">
      <span>{label}</span>
      <input className="rem-field" type="password" value={value} autoComplete="off" spellCheck={false}
        onChange={(e) => { set(e.target.value); setErr(""); }} />
    </label>
  );
  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="confirm-dialog rem-form shop-form" role="dialog" aria-modal="true" aria-label="Trocar senha mestra" onSubmit={submit}>
        <h2>Trocar senha mestra</h2>
        {field("Senha mestra atual", cur, setCur)}
        {field("Nova senha mestra", next, setNext)}
        {field("Repita a nova senha", next2, setNext2)}
        <p className="vault-note" style={{ marginTop: 14 }}>Todos os itens serão criptografados de novo com a nova senha.</p>
        {err && <div className="shop-err" role="alert">{err}</div>}
        <div className="confirm-actions shop-actions">
          <button type="button" className="confirm-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="confirm-btn danger" disabled={busy || !cur || !next}>{busy ? "Aguarde…" : "Trocar senha"}</button>
        </div>
      </form>
    </div>
  );
}

/* ----- novo login / editar login ----- */
function VaultForm({ initial, onSave, onClose }) {
  const editing = !!initial;
  const [f, setF] = useState({
    name: initial?.name ?? "", user: initial?.user ?? "", pass: initial?.pass ?? "",
    url: initial?.url ?? "", notes: initial?.notes ?? "", icon: initial?.icon ?? "",
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setError(""); };

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!f.name.trim()) return setError("Digite o nome do serviço.");
    if (!f.pass) return setError("Digite a senha.");
    const icon = f.icon.trim();
    if (icon && !vIconOk(icon)) return setError("O link da imagem precisa começar com https://");
    setBusy(true);
    try {
      await onSave({ name: f.name.trim(), user: f.user.trim(), pass: f.pass, url: f.url.trim(), notes: f.notes.trim(), icon });
    } catch (x) {
      console.error("Cofre:", x);
      setError("Não foi possível salvar.");
      setBusy(false);
    }
  };

  return (
    <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="confirm-dialog rem-form shop-form" role="dialog" aria-modal="true" aria-label={editing ? "Editar login" : "Novo login"} onSubmit={submit}>
        <h2>{editing ? "Editar login" : "Novo login"}</h2>
        <label className="rem-lbl shop-block">
          <span>Serviço</span>
          <input ref={nameRef} className="rem-field" value={f.name} onChange={set("name")} placeholder="Ex.: Gmail" maxLength={80} autoComplete="off" />
        </label>
        <label className="rem-lbl shop-block">
          <span>Usuário ou e-mail</span>
          <input className="rem-field" value={f.user} onChange={set("user")} maxLength={120} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </label>
        <div className="rem-lbl shop-block">
          <span>Senha</span>
          <div className="vault-field">
            <input className="rem-field" type={showPw ? "text" : "password"} value={f.pass} onChange={set("pass")}
              maxLength={200} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-label="Senha" />
            <div className="vault-tools">
              <button type="button" className="icon-btn" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}>
                <RIcon name={showPw ? "eye-off" : "eye"} size={18} />
              </button>
              <button type="button" className="icon-btn" onClick={() => { setF((x) => ({ ...x, pass: vGenerate(20) })); setShowPw(true); setError(""); }} aria-label="Gerar senha forte" title="Gerar senha forte">
                <RIcon name="refresh" size={18} />
              </button>
            </div>
          </div>
        </div>
        <label className="rem-lbl shop-block">
          <span>Endereço do site (opcional)</span>
          <input className="rem-field" value={f.url} onChange={set("url")} maxLength={200} autoComplete="off" autoCapitalize="off" spellCheck={false} />
        </label>
        <div className="rem-lbl shop-block">
          <span>Ícone (opcional) — link de uma imagem</span>
          <div className="vault-icon-row">
            <input className="rem-field" value={f.icon} onChange={set("icon")} placeholder="https://…/logo.png" maxLength={500}
              autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="url" aria-label="Link da imagem do ícone" />
            <VaultIcon src={f.icon.trim()} name={f.name || "?"} />
          </div>
          <div>
            <button type="button" className="vault-icon-link" onClick={() => {
              const raw = f.url.trim();
              if (!raw) return setError("Preencha o endereço do site para usar o ícone dele.");
              try {
                const host = new URL(/^https?:\/\//i.test(raw) ? raw : "https://" + raw).hostname;
                setF((x) => ({ ...x, icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128` }));
                setError("");
              } catch {
                setError("Endereço do site inválido.");
              }
            }}>
              Usar o ícone do site acima
            </button>
          </div>
        </div>
        <label className="rem-lbl shop-block" style={{ marginBottom: 22 }}>
          <span>Observações (opcional)</span>
          <textarea className="rem-field vault-textarea" value={f.notes} onChange={set("notes")} maxLength={500} />
        </label>
        {error && <div className="shop-err" role="alert">{error}</div>}
        <div className="confirm-actions shop-actions">
          <button type="button" className="confirm-btn" onClick={onClose}>Cancelar</button>
          <button type="submit" className="confirm-btn danger" disabled={busy}>{editing ? "Salvar" : "Adicionar"}</button>
        </div>
      </form>
    </div>
  );
}

/* ícone do login: imagem da web (só https) ou, se faltar/falhar, a inicial do nome */
const vIconOk = (u) => /^https:\/\/\S+$/i.test(u || "");
function VaultIcon({ src, name }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const img = vIconOk(src) && !failed;
  return (
    <span className={"contact-avatar" + (img ? " has-img" : "")} aria-hidden="true">
      {img ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" draggable="false" onError={() => setFailed(true)} /> : (name.trim()[0] || "?")}
    </span>
  );
}

/* ----- item da lista ----- */
function VaultItem({ it, onCopyPass, onCopyUser, onEdit, onRemove }) {
  const site = (it.url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return (
    <li className="vault-card">
      <div className="vault-card-head">
        <VaultIcon src={it.icon} name={it.name} />
        <div className="vault-title">
          <strong>{it.name}</strong>
          {site && <span>{site}</span>}
        </div>
        <div className="rem-actions">
          <button type="button" className="icon-btn" onClick={() => onEdit(it)} aria-label={`Editar “${it.name}”`}>
            <RIcon name="edit" size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => onRemove(it)} aria-label={`Excluir “${it.name}”`}>
            <RIcon name="trash" size={18} />
          </button>
        </div>
      </div>
      <div className="vault-rows">
        {it.user && (
          <button type="button" className="vault-row" onClick={() => onCopyUser(it)} title="Toque para copiar" aria-label={`Copiar usuário de ${it.name}`}>
            <span className="vault-txt">
              <span className="vault-lbl">Usuário</span>
              <span className="vault-val">{it.user}</span>
            </span>
            <RIcon name="copy" size={16} />
          </button>
        )}
        <button type="button" className="vault-row" onClick={() => onCopyPass(it)} title="Toque para copiar" aria-label={`Copiar senha de ${it.name}`}>
          <span className="vault-txt">
            <span className="vault-lbl">Senha</span>
            <span className="vault-val mono">{it.pass}</span>
          </span>
          <RIcon name="copy" size={16} />
        </button>
      </div>
      {it.notes && <p className="vault-notes">{it.notes}</p>}
    </li>
  );
}

/* ----- tela do cofre ----- */
function VaultScreen({ toast }) {
  // A chave fica só neste estado: ao sair da aba, o componente desmonta e o cofre se bloqueia.
  const [key, setKey] = useState(null);
  const [meta, setMeta] = useState(undefined); // undefined = carregando | null = não existe | objeto
  const [raw, setRaw] = useState({});
  const [items, setItems] = useState([]);
  const [bad, setBad] = useState(0);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState(null); // null | "add" | "edit"
  const [editing, setEditing] = useState(null);
  const [askDelete, setAskDelete] = useState(null);
  const [pwDialog, setPwDialog] = useState(false);
  const fails = useRef(0);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const supported = vCryptoOk();

  // escuta o banco (só dados cifrados)
  useEffect(() => {
    const fail = (e) => { console.error("Firebase:", e); toastRef.current("Sem acesso ao banco de dados"); };
    const offMeta = onValue(vaultMetaRef, (s) => setMeta(s.val() || null), fail);
    const offItems = onValue(vaultItemsRef, (s) => setRaw(s.val() || {}), fail);
    return () => { offMeta(); offItems(); };
  }, []);

  // decifra os itens sempre que a chave ou os dados mudam
  useEffect(() => {
    if (!key) { setItems([]); setBad(0); return undefined; }
    let dead = false;
    (async () => {
      const out = [];
      let failed = 0;
      for (const [id, box] of Object.entries(raw)) {
        if (!box || typeof box !== "object" || !box.iv || !box.ct) continue;
        try {
          out.push({ id, ...(await vOpen(key, box, id)), updatedAt: box.updatedAt || 0 });
        } catch {
          failed++;
        }
      }
      if (!dead) { setItems(out); setBad(failed); }
    })();
    return () => { dead = true; };
  }, [key, raw]);

  const lock = useCallback((silent) => {
    setKey(null);
    setItems([]);
    setMode(null);
    setEditing(null);
    setAskDelete(null);
    setPwDialog(false);
    setQuery("");
    if (silent !== true) toastRef.current("Cofre bloqueado");
  }, []);

  // bloqueio automático: inatividade e app em segundo plano
  useEffect(() => {
    if (!key) return undefined;
    let idle;
    let hidden;
    const reset = () => { clearTimeout(idle); idle = setTimeout(() => lock(), VAULT_IDLE_MS); };
    const vis = () => { if (document.hidden) hidden = setTimeout(() => lock(), VAULT_HIDDEN_MS); else clearTimeout(hidden); };
    const evs = ["pointerdown", "keydown", "scroll", "touchstart"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true, capture: true }));
    document.addEventListener("visibilitychange", vis);
    reset();
    return () => {
      clearTimeout(idle);
      clearTimeout(hidden);
      evs.forEach((e) => window.removeEventListener(e, reset, { capture: true }));
      document.removeEventListener("visibilitychange", vis);
    };
  }, [key, lock]);

  /* ----- criar / abrir ----- */
  const createVault = async (pw, pw2) => {
    if (pw.length < 10) return "A senha mestra precisa ter pelo menos 10 caracteres.";
    if (pw !== pw2) return "As senhas não são iguais.";
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k = await vDerive(pw, salt, VAULT_ITER);
    const m = { v: 1, kdf: "PBKDF2-SHA256", iter: VAULT_ITER, salt: vB64(salt), check: await vSeal(k, { ok: "anotei-vault" }, "meta"), createdAt: Date.now() };
    // só cria se ainda não existir (evita sobrescrever um cofre criado em outro aparelho)
    const r = await runTransaction(vaultMetaRef, (cur) => (cur === null ? m : undefined));
    if (!r.committed) return "Já existe um cofre. Digite a senha mestra para abri-lo.";
    setKey(k);
    return "";
  };

  const unlock = async (pw) => {
    const k = await vDerive(pw, vUnb64(meta.salt), meta.iter);
    try {
      const c = await vOpen(k, meta.check, "meta");
      if (c.ok !== "anotei-vault") throw new Error("bad");
    } catch {
      fails.current += 1; // freia tentativas em sequência
      await new Promise((r) => setTimeout(r, Math.min(fails.current * 1500, 10000)));
      return false;
    }
    fails.current = 0;
    setKey(k);
    return true;
  };

  const changeMaster = async (cur, next, next2) => {
    try {
      if (next.length < 10) return "A nova senha precisa ter pelo menos 10 caracteres.";
      if (next !== next2) return "As novas senhas não são iguais.";
      if (bad > 0) return "Alguns itens não puderam ser lidos. A troca foi cancelada para não perder dados.";
      const oldKey = await vDerive(cur, vUnb64(meta.salt), meta.iter);
      try { await vOpen(oldKey, meta.check, "meta"); } catch { return "Senha mestra atual incorreta."; }
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const nk = await vDerive(next, salt, VAULT_ITER);
      const updates = {
        meta: { v: 1, kdf: "PBKDF2-SHA256", iter: VAULT_ITER, salt: vB64(salt), check: await vSeal(nk, { ok: "anotei-vault" }, "meta"), createdAt: meta.createdAt || Date.now() },
      };
      for (const it of items) {
        const { id, updatedAt, ...data } = it;
        updates[`items/${id}`] = { id, ...(await vSeal(nk, data, id)), updatedAt: Date.now() };
      }
      setKey(nk);
      try {
        await dbUpdate(dbRef(db, VAULT_PATH), updates); // tudo de uma vez: ou troca tudo, ou nada
      } catch (e) {
        setKey(oldKey);
        throw e;
      }
      setPwDialog(false);
      toast("Senha mestra alterada");
      return "";
    } catch (e) {
      console.error("Cofre:", e);
      return "Não foi possível trocar a senha. Nada foi alterado.";
    }
  };

  /* ----- itens ----- */
  const saveItem = async (data, id) => {
    const iid = id || remId();
    const box = await vSeal(key, data, iid);
    await dbSet(vaultItemRef(iid), { id: iid, ...box, updatedAt: Date.now() });
  };
  const closeForm = useCallback(() => { setMode(null); setEditing(null); }, []);
  const handleSave = async (data) => {
    await saveItem(data, editing?.id);
    toast(editing ? "Login atualizado" : "Login salvo");
    closeForm();
  };
  const confirmDelete = () => {
    const it = askDelete;
    setAskDelete(null);
    if (!it) return;
    dbRemove(vaultItemRef(it.id)).catch((e) => { console.error("Firebase:", e); toast("Não foi possível apagar"); });
    toast("Login removido");
  };

  const clipTimer = useRef(null);
  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copiada. Some da área de transferência em 30 s`);
      clearTimeout(clipTimer.current);
      clipTimer.current = setTimeout(() => { navigator.clipboard.writeText("").catch(() => {}); }, VAULT_CLIP_MS);
    } catch {
      toast("Não foi possível copiar");
    }
  };

  const list = useMemo(() => {
    const q = fold(query.trim());
    return items
      .filter((i) => !q || fold(`${i.name} ${i.user || ""} ${i.url || ""}`).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
  }, [items, query]);

  /* ----- telas ----- */
  if (!supported) {
    return (
      <div className="rem shop">
        <h2 className="section-title">Cofre de senhas</h2>
        <div className="empty"><p style={{ margin: 0 }}>Este navegador não oferece criptografia segura. Abra o Anotei por um endereço seguro (https).</p></div>
      </div>
    );
  }
  if (meta === undefined) {
    return (
      <div className="rem shop">
        <h2 className="section-title">Cofre de senhas</h2>
        <div className="empty"><p style={{ margin: 0 }}>Conectando ao cofre…</p></div>
      </div>
    );
  }
  if (!key) {
    return (
      <div className="rem shop">
        <h2 className="section-title">Cofre de senhas</h2>
        <VaultGate meta={meta} onCreate={createVault} onUnlock={unlock} />
      </div>
    );
  }

  return (
    <div className="rem shop">
      <div className="rem-head">
        <h2 className="section-title">Cofre de senhas</h2>
      </div>

      {bad > 0 && (
        <p className="vault-warn" style={{ marginTop: 16 }}>
          {bad} {bad === 1 ? "item não pôde ser aberto" : "itens não puderam ser abertos"} com esta senha mestra (dados corrompidos ou alterados).
        </p>
      )}

      {items.length > 0 && (
        <input
          className="search shop-search"
          type="search"
          placeholder="Pesquisar logins"
          aria-label="Pesquisar logins"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {items.length === 0 ? (
        <div className="empty"><p style={{ margin: 0 }}>Seu cofre está vazio.<br />Toque em Novo login para guardar o primeiro.</p></div>
      ) : list.length === 0 ? (
        <div className="empty"><p style={{ margin: 0 }}>Nenhum login encontrado para “{query.trim()}”.</p></div>
      ) : (
        <section className="shop-cat">
          <ul className="shop-list vault-list">
            {list.map((it) => (
              <VaultItem
                key={it.id}
                it={it}
                onCopyPass={(x) => copy(x.pass, "Senha")}
                onCopyUser={(x) => copy(x.user, "Usuário")}
                onEdit={(x) => { setEditing(x); setMode("edit"); }}
                onRemove={setAskDelete}
              />
            ))}
          </ul>
        </section>
      )}

      {!mode && (
        <div className="rem-dock">
          <button type="button" className="fab new-fab" onClick={() => setMode("add")} aria-label="Novo login" title="Novo login">
            <RIcon name="plus" size={22} />
            <span>Novo login</span>
          </button>
        </div>
      )}

      {mode === "add" && <VaultForm onSave={handleSave} onClose={closeForm} />}
      {mode === "edit" && editing && <VaultForm initial={editing} onSave={handleSave} onClose={closeForm} />}
      {pwDialog && <VaultPasswordDialog onSubmit={changeMaster} onClose={() => setPwDialog(false)} />}
      {askDelete && (
        <div className="confirm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAskDelete(null); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true">
            <h2>Remover este login?</h2>
            <p>“{askDelete.name}” será apagado do cofre. Essa ação não pode ser desfeita.</p>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" autoFocus onClick={() => setAskDelete(null)}>Cancelar</button>
              <button type="button" className="confirm-btn danger" onClick={confirmDelete}>Remover login</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function Anotei() {
  // Notas e categorias ficam salvas neste navegador entre sessões.
  const [notes, setNotes] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("anotei-notes") || "[]");
      if (!Array.isArray(saved)) return [];
      // Uma vez: as categorias que vinham por padrão foram removidas; suas notas ficam sem categoria.
      if (!localStorage.getItem("anotei-defaults-removed")) {
        return saved.map((n) => (DEFAULT_CAT_IDS.includes(n.cat) ? { ...n, cat: null } : n));
      }
      return saved;
    } catch { return []; }
  });

  // Tema: lembra a última escolha (light | dark) entre aberturas do programa.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("anotei-theme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  const isDark = theme === "dark";
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("anotei-theme", theme); } catch { /* ignora */ }
  }, [theme]);

  const [view, setView] = useState("home"); // "home" | "editor"
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false); // true enquanto a nota aberta é uma nota nova

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);

  const [listening, setListening] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [categories, setCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("anotei-categories") || "null");
      if (Array.isArray(saved)) {
        if (localStorage.getItem("anotei-defaults-removed")) return saved;
        return saved.filter((c) => !DEFAULT_CAT_IDS.includes(c.id));
      }
    } catch { /* começa sem categorias */ }
    return [];
  });
  useEffect(() => { try { localStorage.setItem("anotei-defaults-removed", "1"); } catch { /* ignora */ } }, []);
  const [activeCat, setActiveCat] = useState("categories"); // "categories", "all" ou id da categoria aberta
  const [cat, setCat] = useState(null); // categoria da nota aberta
  const [docKey, setDocKey] = useState(0); // muda a cada nota aberta (recarrega o editor)
  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState("");
  // O layout mantém categorias e cartões na tela principal em qualquer tamanho.
  const wide = false;

  const textRef = useRef(null);
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  /* ----- Lembretes ----- */
  const rem = useReminders(showToast);
  const { now, todayKey, notified } = useReminderAlerts(rem.items, rem.loaded);
  const [section, setSection] = useState(() => {
    try { const s = localStorage.getItem("anotei-section"); return s === "reminders" || s === "shopping" || s === "contacts" || s === "vault" ? s : "notes"; }
    catch { return "notes"; }
  });
  useEffect(() => { try { localStorage.setItem("anotei-section", section); } catch { /* ignora */ } }, [section]);
  // Menu hambúrguer das abas (telas pequenas): fecha ao tocar fora da barra ou com Esc
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    if (!navOpen) return undefined;
    const onPointer = (e) => { if (!e.target.closest?.(".appbar")) setNavOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setNavOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);
  const pickSection = (id) => { setSection(id); setNavOpen(false); };
  const [remLeaving, setRemLeaving] = useState(null); // id (ou "done") do lembrete que está saindo com animação

  /* ----- Compras ----- */
  const shop = useShopping(showToast);
  const [shopLeaving, setShopLeaving] = useState(null); // id (ou "all") do item que está saindo com animação

  /* ----- Contatos ----- */
  const contacts = useContacts(showToast);
  const [contactLeaving, setContactLeaving] = useState(null);

  /* ----- Firebase: sincronização ----- */
  const notesLive = useRef(notes);
  const catsLive = useRef(categories);
  notesLive.current = notes;
  catsLive.current = categories;
  const remoteNotes = useRef(new Map()); // id -> JSON do que está no banco
  const remoteCats = useRef(new Map());
  const writing = useRef(false); // true enquanto enviamos mudanças (ignora o "eco" do banco)
  const [dbReady, setDbReady] = useState({ notes: false, cats: false });

  // Escuta o banco: ao abrir o app e a cada mudança (inclusive vinda de outro aparelho).
  useEffect(() => {
    const flag = (k) => { try { return localStorage.getItem(k) === "1"; } catch { return true; } };
    const setFlag = (k) => { try { localStorage.setItem(k, "1"); } catch { /* ignora */ } };
    const fail = () => showToast("Sem acesso ao banco de dados. Usando os dados salvos neste aparelho");

    const offNotes = onValue(dbRef(db, NOTES_PATH), (snap) => {
      if (writing.current) return;
      const val = snap.val() || {};
      const list = Object.entries(val).filter(([, n]) => n && typeof n === "object").map(([id, n]) => normNote(id, n));
      remoteNotes.current = new Map(list.map((n) => [n.id, JSON.stringify(n)]));
      // Primeira vez com o banco vazio: as notas que já existiam neste navegador sobem para o banco.
      const migrate = !list.length && notesLive.current.length && !flag("anotei-db-notes-sent");
      if (!migrate) setNotes(list.sort((a, b) => b.updatedAt - a.updatedAt));
      setFlag("anotei-db-notes-sent");
      setDbReady((r) => (r.notes ? r : { ...r, notes: true }));
    }, fail);

    const offCats = onValue(dbRef(db, CATS_PATH), (snap) => {
      if (writing.current) return;
      const val = snap.val() || {};
      const list = Object.entries(val).filter(([, c]) => c && typeof c === "object").map(([id, c]) => normCat(id, c));
      remoteCats.current = new Map(list.map((c) => [c.id, JSON.stringify(c)]));
      const migrate = !list.length && catsLive.current.length && !flag("anotei-db-cats-sent");
      if (!migrate) setCategories(list.sort((a, b) => a.order - b.order).map(({ id, name }) => ({ id, name })));
      setFlag("anotei-db-cats-sent");
      setDbReady((r) => (r.cats ? r : { ...r, cats: true }));
    }, fail);

    return () => { offNotes(); offCats(); };
  }, [showToast]);

  // Envia ao banco o que mudou nas notas (criar, editar, apagar, apagar tudo).
  useEffect(() => {
    if (!dbReady.notes) return;
    const failed = () => showToast("Não foi possível salvar no banco de dados");
    writing.current = true;
    try {
      const ids = new Set();
      for (const n of notes) {
        const norm = normNote(n.id, n);
        ids.add(n.id);
        const json = JSON.stringify(norm);
        if (remoteNotes.current.get(n.id) === json) continue;
        remoteNotes.current.set(n.id, json);
        const { id, ...data } = norm;
        dbSet(dbRef(db, `${NOTES_PATH}/${id}`), data).catch(failed);
      }
      for (const id of [...remoteNotes.current.keys()]) {
        if (ids.has(id)) continue;
        remoteNotes.current.delete(id);
        dbRemove(dbRef(db, `${NOTES_PATH}/${id}`)).catch(failed);
      }
    } finally { writing.current = false; }
  }, [notes, dbReady.notes, showToast]);

  // Mesmo para as categorias (a ordem é guardada no campo "order").
  useEffect(() => {
    if (!dbReady.cats) return;
    const failed = () => showToast("Não foi possível salvar as categorias no banco de dados");
    writing.current = true;
    try {
      const ids = new Set();
      categories.forEach((c, i) => {
        const norm = normCat(c.id, c, i);
        norm.order = i;
        ids.add(c.id);
        const json = JSON.stringify(norm);
        if (remoteCats.current.get(c.id) === json) return;
        remoteCats.current.set(c.id, json);
        const { id, ...data } = norm;
        dbSet(dbRef(db, `${CATS_PATH}/${id}`), data).catch(failed);
      });
      for (const id of [...remoteCats.current.keys()]) {
        if (ids.has(id)) continue;
        remoteCats.current.delete(id);
        dbRemove(dbRef(db, `${CATS_PATH}/${id}`)).catch(failed);
      }
    } finally { writing.current = false; }
  }, [categories, dbReady.cats, showToast]);

  useEffect(() => {
    try { localStorage.setItem("anotei-notes", JSON.stringify(notes)); }
    catch { showToast("Armazenamento cheio: remova imagens ou notas antigas"); }
  }, [notes, showToast]);

  useEffect(() => {
    try { localStorage.setItem("anotei-categories", JSON.stringify(categories)); }
    catch { showToast("Não foi possível salvar as categorias neste navegador"); }
  }, [categories, showToast]);

  useEffect(() => () => {
    clearTimeout(toastTimer.current);
    recRef.current?.stop?.();
  }, []);

  // Coloca o texto da nota no editor ao abrir a tela. O editor não é "controlado" pelo React
  // (assim o cursor não pula enquanto você digita); o estado `text` guarda o HTML.
  useEffect(() => {
    if (view === "editor" && textRef.current) textRef.current.innerHTML = cleanHtml(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, docKey]);

  // Sempre começa do topo ao trocar de tela.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  const editingNote = useMemo(() => notes.find((n) => n.id === editingId) || null, [notes, editingId]);
  const cleanText = useMemo(() => {
    const c = cleanHtml(text);
    return htmlToPlain(c).trim() ? c : "";
  }, [text]);
  const hasContent = Boolean(title.trim() || cleanText || image);

  // Há alterações que ainda não foram publicadas?
  const dirty = editingNote
    ? title.trim() !== editingNote.title || cleanText !== editingNote.text || image !== editingNote.image || cat !== (editingNote.cat ?? null)
    : hasContent;

  const statusText = hasContent ? (dirty ? "Salvando…" : "Salvo") : "";

  /* ----- Navegação ----- */
  const goHome = () => {
    recRef.current?.stop?.();
    setTitle("");
    setText("");
    setImage(null);
    setEditingId(null);
    setCat(null);
    setView("home");
  };

  const saveCurrent = () => {
    recRef.current?.stop?.();
    if (hasContent) {
      if (dirty) persist(); // garante que nada digitado nos últimos instantes se perca
    } else if (editingId) {
      // (o banco é atualizado automaticamente quando a lista de notas muda)
      setNotes((list) => list.filter((n) => n.id !== editingId)); // nota que ficou vazia não vale a pena guardar
    }
  };
  const handleBack = () => {
    saveCurrent();
    goHome();
  };

  const openNew = () => {
    setTitle("");
    setText("");
    setImage(null);
    setEditingId(null);
    setCat(activeCat === "all" || activeCat === "categories" ? null : activeCat);
    setDocKey((k) => k + 1);
    setCreating(true);
    setView("editor");
  };

  const openNote = (note) => {
    setTitle(note.title);
    setText(note.text);
    setImage(note.image);
    setEditingId(note.id);
    setCat(note.cat ?? null);
    setDocKey((k) => k + 1);
    setCreating(false);
    setView("editor");
  };

  /* ----- Salvamento automático ----- */
  const persist = () => {
    if (!hasContent) return;
    const now = Date.now();
    const data = { title: title.trim(), text: cleanText, image, cat };

    if (editingId) {
      setNotes((list) =>
        list
          .map((n) => (n.id === editingId ? { ...n, ...data, updatedAt: now } : n))
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    } else {
      const id = newId();
      setNotes((list) => [{ id, ...data, createdAt: now, updatedAt: now }, ...list]);
      setEditingId(id); // a partir daqui, os próximos salvamentos atualizam essa mesma nota
    }
  };

  // Salva sozinho 0,6 s depois de você parar de digitar.
  // Esse intervalo também evita uma escrita no banco a cada tecla.
  useEffect(() => {
    if (view !== "editor" || !dirty || !hasContent) return;
    const t = setTimeout(persist, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text, image, cat, view, editingId, notes]);

  /* ----- Apagar ----- */
  const handleDelete = (id) => {
    setConfirmDialog({ type: "note", id, title: "Apagar esta nota?", message: "Esta nota será removida do Anotei.", confirmLabel: "Apagar nota" });
  };

  const handleDeleteAll = () => {
    if (!notes.length) return;
    setConfirmDialog({ type: "allNotes", title: "Apagar todas as notas?", message: "Essa ação não pode ser desfeita.", confirmLabel: "Apagar todas" });
  };

  /* ----- Imagem ----- */
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImage(await fileToDataUrl(file));
    } catch {
      showToast("Não foi possível abrir essa imagem");
    }
  };

  /* ----- Ditado por voz ----- */
  const toggleListening = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    if (!SpeechRecognition) {
      showToast("Este navegador não permite ditado por voz");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) said += e.results[i][0].transcript;
      }
      const ed = textRef.current;
      if (said.trim() && ed) {
        ed.append((ed.textContent ? " " : "") + said.trim());
        setText(ed.innerHTML);
      }
    };
    rec.onerror = () => {
      setListening(false);
      showToast("Não foi possível usar o microfone");
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  /* ----- Busca ----- */
  const visibleNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(
      (n) =>
        (activeCat === "all" || activeCat === "categories" || n.cat === activeCat) &&
        (!q || (n.title + " " + htmlToPlain(n.text)).toLowerCase().includes(q))
    );
  }, [notes, query, activeCat]);

  /* ----- Categorias ----- */
  const addCategory = (name) => {
    name = name.trim();
    if (!name) return;
    const id = newId();
    setCategories((l) => [...l, { id, name }]);
    setActiveCat(id);
  };
  const openNewCategory = () => { setNewCategoryName(""); setNewCategoryOpen(true); };
  const saveNewCategory = (event) => {
    event.preventDefault();
    addCategory(newCategoryName);
    setNewCategoryOpen(false);
    setNewCategoryName("");
  };
  const renameCategory = (c) => {
    const name = window.prompt("Novo nome da categoria", c.name)?.trim();
    if (name) setCategories((l) => l.map((x) => (x.id === c.id ? { ...x, name } : x)));
  };
  const deleteCategory = (c) => {
    setConfirmDialog({
      type: "category", id: c.id, title: `Excluir “${c.name}”?`,
      message: "As notas dela não serão apagadas e ficarão sem categoria.", confirmLabel: "Excluir categoria",
    });
  };
  const confirmDeletion = () => {
    if (!confirmDialog) return;
    if (confirmDialog.type === "category") {
      const { id } = confirmDialog;
      setCategories((list) => list.filter((category) => category.id !== id));
      setNotes((list) => list.map((note) => (note.cat === id ? { ...note, cat: null } : note)));
      if (activeCat === id) setActiveCat("categories");
      if (cat === id) setCat(null);
      showToast("Categoria excluída");
    } else if (confirmDialog.type === "reminder") {
      const { id } = confirmDialog;
      notified.current.delete(id);
      setRemLeaving(id);
      setTimeout(() => { rem.remove(id); setRemLeaving(null); }, 240); // tempo da animação de saída
      showToast("Lembrete apagado");
    } else if (confirmDialog.type === "doneReminders") {
      setRemLeaving("done");
      setTimeout(() => { rem.clearDone(); setRemLeaving(null); }, 240);
      showToast("Lembretes concluídos apagados");
    } else if (confirmDialog.type === "contact") {
      const { id } = confirmDialog;
      setContactLeaving(id);
      setTimeout(() => { contacts.remove(id); setContactLeaving(null); }, 240);
      showToast("Contato removido");
    } else if (confirmDialog.type === "shopItem") {
      const { id } = confirmDialog;
      setShopLeaving(id);
      setTimeout(() => { shop.remove(id); setShopLeaving(null); }, 240);
      showToast("Item removido");
    } else if (confirmDialog.type === "shopClear") {
      setShopLeaving("all");
      setTimeout(() => { shop.clearAll(); setShopLeaving(null); }, 240);
      showToast("Lista de compras limpa");
    } else if (confirmDialog.type === "note") {
      const { id } = confirmDialog;
      setNotes((list) => list.filter((note) => note.id !== id));
      if (id === editingId) goHome();
      showToast("Nota apagada");
    } else {
      setNotes([]);
      showToast("Todas as notas foram apagadas");
    }
    setConfirmDialog(null);
  };

  useEffect(() => {
    if (!confirmDialog && !newCategoryOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setConfirmDialog(null);
        setNewCategoryOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [confirmDialog, newCategoryOpen]);
  const openNewWide = () => { saveCurrent(); openNew(); };
  const openNoteWide = (n) => {
    if (view === "editor" && n.id === editingId) return;
    saveCurrent();
    openNote(n);
  };

  const editorSection = (
          <section className="editor glass" aria-label={creating ? "Nova nota" : "Editar nota"}>
            <header className="head">
              <div className="head-left">
                <input
                  id="anotei-title"
                  className="head-title"
                  type="text"
                  placeholder="Sem título"
                  aria-label="Título"
                  value={title}
                  maxLength={120}
                  autoComplete="off"
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      textRef.current?.focus();
                    }
                  }}
                />
              </div>
              <div className="head-right">
              {editingId && (
                <Menu label="Mais opções da nota">
                  {(close) => (
                    <button
                      type="button"
                      role="menuitem"
                      className="menu-item"
                      onClick={() => {
                        close();
                        handleDelete(editingId);
                      }}
                    >
                      Apagar nota
                    </button>
                  )}
                </Menu>
              )}
              </div>
            </header>

            <div className="form">
              <time className="note-date" dateTime={new Date(editingNote?.updatedAt || Date.now()).toISOString()}>
                {formatFullDate(editingNote?.updatedAt || Date.now())}
              </time>
              <Toolbar
                key={docKey}
                editorRef={textRef}
                onChange={() => setText(textRef.current.innerHTML)}
              />
              <div className="field desc" data-filled={cleanText ? "true" : "false"}>
                <div
                  id="anotei-text"
                  ref={textRef}
                  className="input rich editable"
                  contentEditable
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Descrição"
                  spellCheck
                  data-placeholder="Seu texto..."
                  data-empty={cleanText ? "false" : "true"}
                  onInput={(e) => {
                    if (e.nativeEvent.inputType === "insertParagraph") {
                      const li = elOf(getSelection().anchorNode)?.closest("ul.todo > li");
                      if (li) li.dataset.checked = "false"; // item novo nunca nasce marcado
                    }
                    setText(e.currentTarget.innerHTML);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const h = e.clipboardData.getData("text/html");
                    const t = e.clipboardData.getData("text/plain");
                    document.execCommand("insertHTML", false, h ? cleanHtml(h) : escapeHtml(t).replace(/\n/g, "<br>"));
                    setText(e.currentTarget.innerHTML);
                  }}
                  onClick={(e) => {
                    // Clique na caixinha de uma tarefa marca/desmarca.
                    const li = e.target.closest?.("ul.todo > li");
                    if (li && e.target === li && e.nativeEvent.offsetX < 28) {
                      li.dataset.checked = li.dataset.checked === "true" ? "false" : "true";
                      setText(e.currentTarget.innerHTML);
                    }
                  }}
                />
              </div>

              {image && (
                <div className="preview">
                  <div className="preview-img">
                    <img src={image} alt="Imagem anexada à nota" />
                  </div>
                  <button type="button" className="remove" aria-label="Remover imagem" onClick={() => setImage(null)}>
                    <CloseIcon />
                  </button>
                </div>
              )}

              <div className="actions">
                <span className="status" role="status" aria-live="polite">
                  {statusText}
                </span>

                <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
              </div>
            </div>
          </section>
  );

  const activeName = activeCat === "all" ? "Todas as notas" : categories.find((c) => c.id === activeCat)?.name || "";
  const shell = (
    <div className="shell">
      <aside className="pane glass" aria-label="Categorias">
        <header className="head">
          <div className="brand"><NoteIcon /><h1>Anotei</h1></div>
          <Menu label="Mais opções">
            {(close) => (
              <button type="button" role="menuitem" className="menu-item" disabled={!notes.length}
                onClick={() => { close(); handleDeleteAll(); }}>
                Apagar todas as notas
              </button>
            )}
          </Menu>
        </header>
        <nav className="cat-list">
          <button type="button" className="cat" data-active={activeCat === "all"} onClick={() => setActiveCat("all")}>
            <span>Todas as notas</span><em>{notes.length}</em>
          </button>
          {categories.map((c) => (
            <div className="cat-row" key={c.id}>
              <button type="button" className="cat" data-active={activeCat === c.id} onClick={() => setActiveCat(c.id)}>
                <span>{c.name}</span><em>{notes.filter((n) => n.cat === c.id).length}</em>
              </button>
              <button type="button" className="cat-act" aria-label={`Renomear ${c.name}`} onClick={() => renameCategory(c)}>
                <Ic d="M4 20h4L19 9l-4-4L4 16v4Z" />
              </button>
              <button type="button" className="cat-act" aria-label={`Excluir ${c.name}`} onClick={() => deleteCategory(c)}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </nav>
        {adding ? (
          <input className="cat-in" autoFocus placeholder="Nome da categoria" aria-label="Nome da nova categoria"
            value={newCat} onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { addCategory(newCat); setNewCat(""); setAdding(false); }
              if (e.key === "Escape") { setNewCat(""); setAdding(false); }
            }}
            onBlur={() => { setNewCat(""); setAdding(false); }} />
        ) : (
          <button type="button" className="cat add" onClick={() => setAdding(true)}>+ Nova categoria</button>
        )}
      </aside>

      <section className="pane list glass" aria-label="Notas">
        <header className="head">
          <h2>{activeName}<span className="count">{visibleNotes.length}</span></h2>
          <button type="button" className="icon-btn" aria-label="Nova nota" onClick={openNewWide}><PlusIcon /></button>
        </header>
        <input className="search" type="search" placeholder="Buscar nas notas" aria-label="Buscar nas notas"
          value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="nlist">
          {visibleNotes.map((n) => (
            <li key={n.id}>
              <button type="button" className="nitem" data-active={view === "editor" && n.id === editingId} onClick={() => openNoteWide(n)}>
                <strong>{n.title || "Sem título"}</strong>
                <span>{htmlToPlain(n.text).slice(0, 140) || (n.image ? "Imagem" : "")}</span>
                <time dateTime={new Date(n.updatedAt).toISOString()}>{formatDate(n.updatedAt)}</time>
              </button>
            </li>
          ))}
        </ul>
        {visibleNotes.length === 0 && (
          <p className="empty">{query ? `Nenhuma nota encontrada para “${query}”.` : "Nenhuma nota aqui ainda."}</p>
        )}
      </section>

      <main className="stage">
        {view === "editor" ? editorSection : <p className="stage-empty">Escolha uma nota ou crie uma nova.</p>}
      </main>
    </div>
  );

  // Ação do botão "Voltar" da barra superior (nenhuma na tela de categorias).
  const backAction = view === "editor" ? handleBack : activeCat !== "categories" ? () => setActiveCat("categories") : null;

  /* ==========================  TELAS  ========================== */
  return (
    <div className={"anotei" + (isDark ? " dark" : "") + (wide ? " is-shell" : view === "editor" ? " is-editor" : " has-bar")}>
      <style>{css}</style>

      {!wide && (
        <header className={"appbar" + (navOpen && view === "home" ? " nav-open" : "")}>
          <div className={"appbar-in" + (view === "home" ? " with-tabs" : "")}>
            <div className="brand">
              <NoteIcon />
              <h1>Anotei</h1>
            </div>
            {view === "home" && (
              <div className="seg appbar-tabs" role="tablist" aria-label="Seção do app">
                <button type="button" role="tab" aria-selected={section === "notes"} data-active={section === "notes"} onClick={() => setSection("notes")}>
                  Notas
                </button>
                <button type="button" role="tab" aria-selected={section === "reminders"} data-active={section === "reminders"} onClick={() => setSection("reminders")}>
                  Lembretes
                </button>
                <button type="button" role="tab" aria-selected={section === "shopping"} data-active={section === "shopping"} onClick={() => setSection("shopping")}>
                  Compras
                </button>
                <button type="button" role="tab" aria-selected={section === "contacts"} data-active={section === "contacts"} onClick={() => setSection("contacts")}>
                  Contatos
                </button>
                <button type="button" role="tab" aria-selected={section === "vault"} data-active={section === "vault"} onClick={() => setSection("vault")}>
                  Senhas
                </button>
              </div>
            )}
            <div className="appbar-right">
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
                title={isDark ? "Tema claro" : "Tema escuro"}
              >
                {isDark ? <SunIcon /> : <MoonIcon />}
              </button>
              {view === "home" && (
                <button
                  type="button"
                  className="theme-toggle nav-burger"
                  aria-label="Menu de seções"
                  aria-controls="appbar-menu"
                  aria-expanded={navOpen}
                  onClick={() => setNavOpen((o) => !o)}
                >
                  <svg {...svgProps} width="20" height="20" key={navOpen ? "x" : "bars"}>
                    {navOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                  </svg>
                </button>
              )}
            </div>
          </div>
          {view === "home" && (
            <nav className="appbar-menu" id="appbar-menu" aria-label="Seções do app">
              {[["notes", "Notas"], ["reminders", "Lembretes"], ["shopping", "Compras"], ["contacts", "Contatos"], ["vault", "Senhas"]].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className="appbar-item"
                  data-active={section === id}
                  aria-current={section === id ? "page" : undefined}
                  onClick={() => pickSection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          )}
        </header>
      )}

      {wide ? shell : view === "home" ? (
        <main className="wrap home">
          {section === "reminders" ? (
            <RemindersScreen
              rem={rem}
              now={now}
              todayKey={todayKey}
              notified={notified}
              leaving={remLeaving}
              onAskDelete={(r) => setConfirmDialog({ type: "reminder", id: r.id, title: "Apagar este lembrete?", message: `“${r.text}” será removido do Anotei.`, confirmLabel: "Apagar lembrete" })}
              onAskClearDone={() => setConfirmDialog({ type: "doneReminders", title: "Limpar concluídos?", message: "Todos os lembretes concluídos serão apagados. Essa ação não pode ser desfeita.", confirmLabel: "Limpar tudo" })}
            />
          ) : section === "shopping" ? (
            <ShoppingScreen
              shop={shop}
              leaving={shopLeaving}
              onAskDelete={(i) => setConfirmDialog({ type: "shopItem", id: i.id, title: "Remover este item?", message: `“${i.name}” será removido da lista de compras.`, confirmLabel: "Remover item" })}
              onAskClear={() => setConfirmDialog({ type: "shopClear", title: "Limpar a lista?", message: "Deseja limpar todos os itens? Essa ação não pode ser desfeita.", confirmLabel: "Limpar tudo" })}
            />
          ) : section === "vault" ? (
            <VaultScreen toast={showToast} />
          ) : section === "contacts" ? (
            <ContactsScreen
              contacts={contacts}
              leaving={contactLeaving}
              onAskDelete={(c) => setConfirmDialog({ type: "contact", id: c.id, title: "Remover este contato?", message: `“${c.name}” será removido da sua lista de contatos.`, confirmLabel: "Remover contato" })}
            />
          ) : activeCat === "categories" ? (
            <>
              <h2 className="section-title">Categorias</h2>
              <ul className="category-grid" aria-label="Categorias">
                <li>
                  <button type="button" className="category-card glass" onClick={() => setActiveCat("all")}>
                    <span className="category-top"><span className="category-count">{notes.length}</span></span>
                    <span className="category-copy"><strong>Todas as notas</strong><span className="category-hint">Ver todas as notas</span></span>
                  </button>
                </li>
                {categories.map((c) => {
                  const count = notes.filter((n) => n.cat === c.id).length;
                  return (
                    <li className="category-entry" key={c.id}>
                      <button type="button" className="category-card glass" onClick={() => setActiveCat(c.id)}>
                        <span className="category-top"><span className="category-count">{count}</span></span>
                        <span className="category-copy"><strong>{c.name}</strong><span className="category-hint">{count === 1 ? "1 nota salva" : `${count} notas salvas`}</span></span>
                      </button>
                      <button type="button" className="category-delete" aria-label={`Apagar categoria ${c.name}`} title={`Apagar ${c.name}`} onClick={() => deleteCategory(c)}>
                        <TrashIcon />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <button type="button" className="category-back back-top" onClick={backAction}>
                <MinimalBackIcon /> Voltar
              </button>
              <h2 className="section-title">{activeName}</h2>
              {notes.length === 0 ? (
            <div className="empty">
              <p style={{ margin: 0 }}>Nenhuma nota ainda.<br />Toque em nova nota para escrever a primeira.</p>
              <button type="button" className="publish ready" onClick={openNew}>
                <PlusIcon />
                Nova nota
              </button>
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="empty">
              <p style={{ margin: 0 }}>{query ? `Nenhuma nota encontrada para “${query}”.` : "Nenhuma nota nesta categoria."}</p>
              {!query && (
                <button type="button" className="publish ready" onClick={openNew}>
                  <PlusIcon />
                  Nova nota
                </button>
              )}
            </div>
          ) : (
            <ul className="notes">
              {visibleNotes.map((n) => (
                <li key={n.id} className="note glass">
                  <button type="button" className="note-open" onClick={() => openNote(n)}>
                    <h2>{n.title || "Sem título"}</h2>
                  </button>
                  <div className="note-foot">
                    <time dateTime={new Date(n.updatedAt).toISOString()}>{formatFullDate(n.updatedAt)}</time>
                    <button type="button" className="icon-btn" aria-label="Apagar nota" onClick={() => handleDelete(n.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
            </>
          )}

          {section === "notes" && (activeCat === "categories" || notes.some((n) => activeCat === "all" || n.cat === activeCat)) && (
            <button
              type="button"
              className="fab new-fab"
              aria-label={activeCat === "categories" ? "Nova categoria" : "Nova nota"}
              title={activeCat === "categories" ? "Nova categoria" : "Nova nota"}
              onClick={activeCat === "categories" ? openNewCategory : openNew}
            >
              <PlusIcon />
              <span>{activeCat === "categories" ? "Nova categoria" : "Nova nota"}</span>
            </button>
          )}
        </main>
      ) : (
        <main className="editor-wrap">
          <button type="button" className="category-back back-top" onClick={backAction}>
            <MinimalBackIcon /> Voltar
          </button>
          {editorSection}
        </main>
      )}

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {confirmDialog && (
        <div className="confirm-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setConfirmDialog(null); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <h2 id="confirm-title">{confirmDialog.title}</h2>
            <p id="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" autoFocus onClick={() => setConfirmDialog(null)}>Cancelar</button>
              <button type="button" className="confirm-btn danger" onClick={confirmDeletion}>{confirmDialog.confirmLabel}</button>
            </div>
          </section>
        </div>
      )}

      {newCategoryOpen && (
        <div className="confirm-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setNewCategoryOpen(false); }}>
          <form className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="new-category-title" onSubmit={saveNewCategory}>
            <h2 id="new-category-title">Nova categoria</h2>
            <p>Escolha um nome para organizar suas notas.</p>
            <input
              className="category-name-input"
              autoFocus
              aria-label="Nome da categoria"
              placeholder="Ex.: Estudos"
              maxLength={40}
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
            />
            <div className="confirm-actions">
              <button type="button" className="confirm-btn" onClick={() => setNewCategoryOpen(false)}>Cancelar</button>
              <button type="submit" className="confirm-btn danger" disabled={!newCategoryName.trim()}>Criar categoria</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}