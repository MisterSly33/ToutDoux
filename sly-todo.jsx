import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Clock, Check, X, Pencil,
  Star, StarOff, Calendar, Loader2, Volume2, VolumeX, Coffee, Sparkles,
  CalendarClock, Repeat, Flag, CalendarDays, Leaf, CloudOff, StickyNote,
  ChevronLeft, ChevronRight, CalendarRange, Heart, Ban, Bell, BellOff, Search,
  Download, Upload, Home, MoreHorizontal, Target, Zap, ListChecks,
  BarChart2, Settings2, BookOpen, Settings, Flame, Eye, EyeOff, Timer, MoreVertical, Info, Copy, ChevronsRight, CheckCheck
} from "lucide-react";

if (typeof window !== "undefined") {
  const __mem = {}; let __ls = null;
  try { __ls = window.localStorage; window.localStorage.setItem("__t","1"); window.localStorage.removeItem("__t"); } catch (e) { __ls = null; }
  window.storage = { get: async (k)=>{const v=__ls?__ls.getItem(k):__mem[k];return v!=null?{key:k,value:v}:null;}, set: async (k,v)=>{if(__ls)__ls.setItem(k,v);else __mem[k]=v;return true;}, delete: async (k)=>{if(__ls)__ls.removeItem(k);else delete __mem[k];return true;}, list: async ()=>({keys:[]}) };
}

const STORAGE_KEY = "sly-todo-data";
const APP_VERSION = "2026.08.28-36";

// ── Pleines lunes ──
// Calcule la phase lunaire (0 = nouvelle lune, 0.5 = pleine lune) pour une date.
function moonPhase(date) {
  // Référence : nouvelle lune du 6 janvier 2000 18:14 UTC
  const synodic = 29.53058867;
  const ref = Date.UTC(2000, 0, 6, 18, 14, 0) / 86400000;
  const d = date.getTime() / 86400000;
  let phase = ((d - ref) % synodic) / synodic;
  if (phase < 0) phase += 1;
  return phase; // 0..1
}
// Vrai si la date (jour) est une pleine lune (à ±0.5 jour près)
function isFullMoon(iso) {
  const d = new Date(iso + "T12:00:00Z");
  const p = moonPhase(d);
  // pleine lune ≈ 0.5 ; on prend une fenêtre d'un jour
  const dist = Math.min(Math.abs(p - 0.5), Math.abs(p - 0.5 + 1), Math.abs(p - 0.5 - 1));
  return dist < (0.5 / 29.53058867); // ~ ±0.5 jour
}
// Trouve la prochaine pleine lune à partir d'aujourd'hui (dans les 40 jours)
function nextFullMoon(fromISO) {
  const start = new Date(fromISO + "T12:00:00Z");
  for (let i = 0; i < 40; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    if (isFullMoon(iso)) return iso;
  }
  return null;
}

// Centralized palette. Every color in this file is applied via inline style,
// never via Tailwind arbitrary-value classes (e.g. text-[#fff]), because this
// runtime has no JIT compiler and those classes silently do nothing.
// ── Thèmes : trois ambiances, sélectionnables dans les Réglages ──
const THEMES_PALETTE = {
  neutre: {
    bg: "#14161C", surface: "#1E2129", surfaceRaised: "#262A34",
    border: "#363B47", borderStrong: "#454B59",
    text: "#F4F6FA", textDim: "#D5DAE4", textFaint: "#A8AFBD", textGhost: "#7C8494",
    accent: "#5B9BD5", accentLight: "#A9CCE8", accentGlow: "#7FB3E0", danger: "#E05260",
    onAccent: "#0E1014", points: "#FFD700",
  },
  cosmos: {
    bg: "#0B0810", surface: "#1A1424", surfaceRaised: "#211934",
    border: "#3D3150", borderStrong: "#4A3F5C",
    text: "#FFFFFF", textDim: "#E4E0F0", textFaint: "#B8B2CC", textGhost: "#9089A0",
    accent: "#8B5CF6", accentLight: "#C4B5FD", accentGlow: "#C084FC", danger: "#E11D48",
    onAccent: "#0B0810", points: "#FFD700",
  },
  jardin: {
    bg: "#F0D2E4", surface: "#FFF8FC", surfaceRaised: "#FBE6F1",
    border: "#DDA9C9", borderStrong: "#CB88B3",
    text: "#2A1420", textDim: "#4A2639", textFaint: "#6E4058", textGhost: "#8A5C74",
    accent: "#B02E7E", accentLight: "#C9589C", accentGlow: "#D97BB4", danger: "#C01F5B",
    onAccent: "#FFFFFF", points: "#B8860B",
  },
  // Blanc chaud (crème, sable, terracotta doux)
  sable: {
    bg: "#F6EAD5", surface: "#FFFDF8", surfaceRaised: "#F5ECDD",
    border: "#DFCBA9", borderStrong: "#CDB48D",
    text: "#33291D", textDim: "#524230", textFaint: "#7A6448", textGhost: "#9A8264",
    accent: "#C2683A", accentLight: "#E0A47C", accentGlow: "#D98A5A", danger: "#C0402B",
    onAccent: "#FFFFFF", points: "#B07A12",
  },
  // Nature (verts feuillage, mousse)
  nature: {
    bg: "#E1EEDB", surface: "#F8FCF6", surfaceRaised: "#E2EFDD",
    border: "#BAD8AE", borderStrong: "#9FC791",
    text: "#1E2E1C", textDim: "#33472F", textFaint: "#54704E", textGhost: "#728C6B",
    accent: "#3B8E4E", accentLight: "#7FC08C", accentGlow: "#5FAE70", danger: "#C0402B",
    onAccent: "#FFFFFF", points: "#9A7B10",
  },
};

// C est mutable : on bascule ses valeurs selon le thème choisi (voir applyTheme).
const C = { ...THEMES_PALETTE.neutre };
function applyTheme(themeId) {
  const p = THEMES_PALETTE[themeId] || THEMES_PALETTE.neutre;
  Object.assign(C, p);
}



const PRESET_COLORS = [
  { name: "violet", value: "#8B5CF6" },
  { name: "indigo", value: "#818CF8" },
  { name: "magenta", value: "#E879F9" },
  { name: "prune", value: "#C026D3" },
  { name: "lavande", value: "#A78BFA" },
  { name: "peri", value: "#6366F1" },
  { name: "menthe", value: "#7DD3AE" },
];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];

const URGENCY = [
  { level: 1, label: "Basse", color: "#8B8698" },
  { level: 2, label: "Normale", color: "#8B5CF6" },
  { level: 3, label: "Haute", color: "#E11D48" },
];

const SELF_CARE_THRESHOLD_MIN = 420; // 7h
const SELF_CARE_THRESHOLD_COUNT = 8;

const uid = () => Math.random().toString(36).slice(2, 10);

function seedWellbeingTheme() {
  return { id: "th-bienetre", name: "Bien-être", color: "#7DD3AE", wellbeing: true };
}
function seedWellbeingTasks(themeId, orderStart) {
  const today = todayISODate();
  return [
    { id: "tk-" + uid(), themeId, title: "Boire 2 litres d'eau", duration: "indeterminee", time: null, inToday: true, done: false, order: orderStart + 1, urgency: 2, recurrence: "daily", postponedTo: null, dueDate: null, startDate: today },
    { id: "tk-" + uid(), themeId, title: "Lire", duration: "indeterminee", time: null, inToday: true, done: false, order: orderStart + 2, urgency: 2, recurrence: "daily", postponedTo: null, dueDate: null, startDate: today },
    { id: "tk-" + uid(), themeId, title: "Aïkido", duration: "indeterminee", time: null, inToday: true, done: false, order: orderStart + 3, urgency: 2, recurrence: "weekly", postponedTo: null, dueDate: null, startDate: today },
  ];
}

// --- Korrigan / Musicalarue checklist, imported from the dedicated Korrigan app ---
const KORRIGAN_CHAPTER_LABELS = { admin: "Administratif", materiel: "Matériel", organisation: "Organisation" };
const KORRIGAN_SUBCAT_LABELS = {
  carte: "Carte & objectifs", papiers: "Papiers & contrats", tickets: "Tickets & tarifs", caisse: "Caisse & paiement",
  cuisson: "Cuisson", ustensiles: "Ustensiles", mobilier: "Mobilier", deco: "Déco & signalétique",
  energie: "Énergie", securite: "Sécurité", nettoyage_chaud: "Nettoyage — zone chaude",
  nettoyage_froid: "Nettoyage — zone froide & comptoir", vaisselle: "Vaisselle & emballages",
  tests: "Tests à la maison", equipe: "Équipe & planning", vigilance: "Points de vigilance",
  elec_plan: "Plan électrique", cuisine_org: "Organisation cuisine", veille: "Veille & réassort festival",
  montage_site: "Montage site & festival", finitions: "Finitions J-1 semaine", idees: "Idées complémentaires",
};
const KORRIGAN_ASSIGNEE_LABELS = { sly: "Sly", mag: "Magali", both: "Sly + Magali" };
const KORRIGAN_SUBCAT_DEFAULT_URGENCY = {
  papiers: "urgent", idees: "urgent",
  caisse: "bientot", cuisson: "bientot", mobilier: "bientot", energie: "bientot",
  securite: "bientot", vaisselle: "bientot", tests: "bientot", elec_plan: "bientot",
  tickets: "bientot", finitions: "bientot",
  ustensiles: "sans_delai", deco: "sans_delai", nettoyage_chaud: "sans_delai", nettoyage_froid: "sans_delai",
  equipe: "sans_delai", vigilance: "sans_delai", cuisine_org: "sans_delai", veille: "sans_delai",
  montage_site: "sans_delai", carte: "sans_delai",
};
function korriganInferUrgency(text, subcat) {
  const t = (text || "").toLowerCase();
  if (t.includes("urgent") || t.includes("avant le 12/06") || t.includes("avant le 17/06")) return 3;
  if (t.includes("avant le") || t.includes("avant 16h30") || t.includes("avant le 13/07")) return 2;
  const fallback = KORRIGAN_SUBCAT_DEFAULT_URGENCY[subcat] || "sans_delai";
  return fallback === "urgent" ? 3 : fallback === "bientot" ? 2 : 1;
}
// [text, chapter, subcat, status ('faire'|'preparer'|'reflechir'|'acheter'|'ok'), assignee, bring]
const KORRIGAN_RAW_ITEMS = [
  ["Carte finalisée : Complète 10€, Galette-saucisse 10€, Courgettes-feta 10€, Sucre 3€, Caramel 4€, Chocolat 4€, Lot 4 crêpes sucre 10€", "admin", "carte", "faire", null, false],
  ["Confirmer le prix du menu Complète + Sucre (12€ à valider, marge réduite vs 13€ normal)", "admin", "carte", "reflechir", null, false],
  ["Objectif : 4 500 produits sur 3 jours (1 900 complètes / 350 courgettes-feta / 900 galette-saucisse / 1 350 crêpes sucrées)", "admin", "carte", "faire", null, false],
  ["Réduire et finaliser la carte (moins de recettes pour fluidifier la prod)", "admin", "carte", "faire", null, false],
  ["Finaliser et renvoyer la convention signée (avant le 17/06)", "admin", "papiers", "faire", "both", false],
  ["Effectuer le règlement — 1 948 € HT / 2 337,60 € TTC (avant le 17/06)", "admin", "papiers", "faire", "both", false],
  ["Compléter la liste nominative du personnel (dates/lieux de naissance manquants)", "admin", "papiers", "faire", null, false],
  ["Transmettre la liste à exposants@musicalarue.com (avant le 17/06)", "admin", "papiers", "faire", null, false],
  ["Réunir l'attestation RC professionnelle", "admin", "papiers", "acheter", null, true],
  ["Réunir l'attestation couvrant les risques alimentaires", "admin", "papiers", "acheter", null, true],
  ["Réunir les documents de conformité électrique / gaz", "admin", "papiers", "acheter", null, true],
  ["Préparer le chèque de caution (200 €)", "admin", "papiers", "preparer", null, true],
  ["Préparer le chèque de droit de place (5 €, Trésor Public)", "admin", "papiers", "preparer", null, true],
  ["Confirmer le devis vaisselle compostable Fiest'Embal (54,49 € TTC)", "admin", "papiers", "faire", null, false],
  ["Prévoir une copie photo des documents (RC, assurances, conformité) sur le téléphone en secours", "admin", "papiers", "preparer", null, false],
  ["Liste nominative du personnel + badges/bracelets à récupérer", "admin", "papiers", "faire", null, true],
  ["Préparer les affiches prix", "admin", "tickets", "preparer", null, true],
  ["Associer chaque couleur de ticket à un produit de la carte", "admin", "tickets", "reflechir", null, false],
  ["Tamponner les tickets avant le festival", "admin", "tickets", "faire", null, false],
  ["Vérifier le stock de tickets rouges (3 400 annoncés)", "admin", "tickets", "faire", null, true],
  ["Vérifier le stock de tickets bleus (1 900 annoncés)", "admin", "tickets", "faire", null, true],
  ["Vérifier le stock de tickets jaunes (2 800 annoncés)", "admin", "tickets", "faire", null, true],
  ["Vérifier le stock de tickets volets (1 000 annoncés)", "admin", "tickets", "faire", null, true],
  ["Vérifier le stock de tickets oranges (500 annoncés)", "admin", "tickets", "faire", null, true],
  ["Vérifier le stock de tickets marrons (300 annoncés)", "admin", "tickets", "faire", null, true],
  ["Vérifier le stock de tickets verts (400 annoncés)", "admin", "tickets", "faire", null, true],
  ["Prévoir tampon + encre fraîche en réserve", "admin", "tickets", "acheter", null, true],
  ["Fond de caisse (150-200 €)", "admin", "caisse", "preparer", null, true],
  ["Structure caisse + SumUp + téléphone/chargeur/power bank", "admin", "caisse", "faire", null, true],
  ["Vérifier branchements téléphone / SumUp, recharger SumUp", "admin", "caisse", "faire", null, false],
  ["Étudier l'ajout d'une 2e caisse de 18h30 à 22h30 (pic de service)", "admin", "caisse", "reflechir", null, false],
  ["4 billigs (2 prêtés Dînette + 2 loués)", "materiel", "cuisson", "faire", null, true],
  ["Cales biseautées pour les billigs (si fabrication impossible : acheter)", "materiel", "cuisson", "preparer", null, true],
  ["Bouteilles de gaz (x3-4)", "materiel", "cuisson", "acheter", null, true],
  ["Détendeurs gaz (remplacement / secours)", "materiel", "cuisson", "acheter", null, true],
  ["Plancha + ustensiles plancha", "materiel", "cuisson", "faire", null, true],
  ["Bain-marie", "materiel", "cuisson", "faire", null, true],
  ["Faire réviser la saladette avant le festival", "materiel", "cuisson", "faire", null, false],
  ["Saladette", "materiel", "cuisson", "faire", null, true],
  ["Chambre froide + marche d'accès", "materiel", "cuisson", "faire", null, true],
  ["Marche pour la chambre froide (si fabrication impossible : acheter)", "materiel", "cuisson", "preparer", null, true],
  ["Outil de coupe d'oignons", "materiel", "ustensiles", "ok", null, true],
  ["Gastros inox / plastiques", "materiel", "ustensiles", "faire", null, true],
  ["Rozel, spatules, roue, louches, pinceau", "materiel", "ustensiles", "faire", null, true],
  ["Robot(s) + balance", "materiel", "ustensiles", "faire", null, true],
  ["Plateaux, planches à découper, couteaux", "materiel", "ustensiles", "faire", null, true],
  ["Casseroles, fouet, maryse", "materiel", "ustensiles", "faire", null, true],
  ["Contenants pour pâte (bacs à pâte)", "materiel", "ustensiles", "faire", null, true],
  ["Entonnoirs, gants", "materiel", "ustensiles", "faire", null, true],
  ["Allume-gaz, briquet", "materiel", "ustensiles", "faire", null, true],
  ["Essuie-tout, aluminium (cuisine)", "materiel", "ustensiles", "acheter", null, true],
  ["Barnum 3x3m", "materiel", "mobilier", "acheter", null, true],
  ["Lino sol 3x6m", "materiel", "mobilier", "acheter", null, true],
  ["3 tables 1,80m + bancs vissés", "materiel", "mobilier", "faire", null, true],
  ["Chaise longue (pause équipe)", "materiel", "mobilier", "acheter", null, true],
  ["Choisir un thème déco simple et original", "materiel", "deco", "reflechir", null, false],
  ["Canisses ou bâches pour le comptoir", "materiel", "deco", "acheter", null, true],
  ["Velcro pour fixation banderole", "materiel", "deco", "acheter", null, true],
  ["Affiches / signalétique (impression)", "materiel", "deco", "preparer", null, true],
  ["Signalétique client : Commande ici / Retrait Galettes / Retrait Crêpes", "materiel", "deco", "preparer", null, true],
  ["Signalétique équipe (recettes, carte, rangement chambre froide)", "materiel", "deco", "preparer", null, false],
  ["Affichage : provenance des produits (fournisseurs, bio/local)", "materiel", "deco", "preparer", null, false],
  ["Plan électrique imprimé", "materiel", "energie", "faire", null, true],
  ["Rallonges et multiprises", "materiel", "energie", "acheter", null, true],
  ["Éclairage stand + éclairage banderole", "materiel", "energie", "acheter", null, true],
  ["Banderole + velcro de fixation", "materiel", "energie", "faire", null, true],
  ["Chauffe-eau", "materiel", "energie", "faire", null, true],
  ["Raccord eau / robinet gardena", "materiel", "energie", "faire", null, true],
  ["Extincteur", "materiel", "securite", "faire", null, true],
  ["Trousse premiers secours", "materiel", "securite", "faire", null, true],
  ["Joints détendeur secours / détecteur de fuites", "materiel", "securite", "acheter", null, true],
  ["Niveau, cales de mise à niveau", "materiel", "securite", "faire", null, true],
  ["Talkie-walkie", "materiel", "securite", "faire", null, true],
  ["Éponges / paille de fer", "materiel", "nettoyage_chaud", "acheter", null, true],
  ["Produits vaisselle, douchette / bassines", "materiel", "nettoyage_chaud", "acheter", null, true],
  ["Bidons 20L pour huiles / graisses usagées", "materiel", "nettoyage_chaud", "acheter", null, true],
  ["Seau pour déchets alimentaires", "materiel", "nettoyage_chaud", "acheter", null, true],
  ["Sacs poubelle 100L", "materiel", "nettoyage_froid", "acheter", null, true],
  ["Microfibres", "materiel", "nettoyage_froid", "acheter", null, true],
  ["Savon mains + distributeur", "materiel", "nettoyage_froid", "acheter", null, true],
  ["Désinfectant mains", "materiel", "nettoyage_froid", "acheter", null, true],
  ["Balai, pelle", "materiel", "nettoyage_froid", "acheter", null, true],
  ["Tester la protection des tables avec aluminium", "materiel", "nettoyage_froid", "faire", null, false],
  ["Assiettes / emballages compostables + couverts", "materiel", "vaisselle", "acheter", null, true],
  ["Serviettes / essuie-tout (comptoir)", "materiel", "vaisselle", "acheter", null, true],
  ["Seaux pour serviettes papier clients (comptoir)", "materiel", "vaisselle", "acheter", null, true],
  ["Brumisateur (optionnel, si retenu)", "materiel", "vaisselle", "reflechir", null, true],
  ["Devis vaisselle compostable Fiest'Embal reçu (serviettes + plateaux carton, 54,49€ TTC)", "materiel", "vaisselle", "ok", null, false],
  ["Tester l'implantation complète du stand", "organisation", "tests", "faire", "both", false],
  ["Vérifier que tout rentre dans le Vito + remorque", "organisation", "tests", "faire", "both", false],
  ["Chronométrer le montage et identifier les étapes à simplifier", "organisation", "tests", "faire", "both", false],
  ["Chronométrer le démontage et identifier les étapes à simplifier", "organisation", "tests", "faire", "both", false],
  ["Tester la solution anti-bouchon évier (farine)", "organisation", "tests", "faire", null, false],
  ["Tester le comptoir : 3 tables 1,80m + bancs vissés", "organisation", "tests", "faire", null, false],
  ["Tester la marche pour la chambre froide", "organisation", "tests", "faire", null, false],
  ["Tester les cales biseautées sous les billigs", "organisation", "tests", "faire", null, false],
  ["Tester l'éclairage stand", "organisation", "tests", "faire", null, false],
  ["Tester l'éclairage banderole + fixation velcro", "organisation", "tests", "faire", null, false],
  ["Remplir les fiches techniques billigs (allumage, température réelle, points chauds/froids)", "organisation", "tests", "faire", null, false],
  ["Choisir les prénoms bretons des 4 billigs", "organisation", "equipe", "reflechir", null, false],
  ["Répartition des postes : Sylvain (4 billigs complètes), Noah (galette-saucisse), Charlotte (sucré), Erwan (caisse), Mika (réassort), Fabrice (polyvalent/plonge)", "organisation", "equipe", "faire", null, false],
  ["Établir le planning de montage / démontage", "organisation", "equipe", "faire", "both", false],
  ["Établir le planning de production (rotation billigs/crêpiers)", "organisation", "equipe", "faire", null, false],
  ["Établir le planning de service (caisse/vente/plonge, pauses 17h30-18h15)", "organisation", "equipe", "faire", null, false],
  ["Établir le planning de nettoyage fin de soirée", "organisation", "equipe", "faire", null, false],
  ["Briefer l'équipe (fiches de poste, billigs nommés, système seaux)", "organisation", "equipe", "faire", "both", false],
  ["Tabliers, bandanas, bandeaux : compter, laver, repasser", "organisation", "equipe", "faire", null, true],
  ["Goulot d'étranglement identifié : l'encaissement (700-900 transactions/jour estimées, 3-4/min en rush)", "organisation", "vigilance", "faire", null, false],
  ["Prévoir un plan B pluie (bâches supplémentaires, protection matériel électrique)", "organisation", "vigilance", "reflechir", null, false],
  ["Prévoir glace/glaçons et eau supplémentaires pour l'équipe (chaleur en cuisine)", "organisation", "vigilance", "preparer", null, false],
  ["Prévoir chargeurs / batterie externe pour SumUp et téléphones", "organisation", "vigilance", "acheter", null, true],
  ["Contacts utiles imprimés : Dylan Le Grel, régie festival, urgences", "organisation", "vigilance", "preparer", null, true],
  ["Limiter les denrées fragiles apportées", "organisation", "vigilance", "faire", null, false],
  ["Établir le plan électrique complet (positionner chaque appareil)", "organisation", "elec_plan", "faire", "both", false],
  ["Vérifier la cohérence avec les 6x16A mono déclarés", "organisation", "elec_plan", "faire", null, false],
  ["Lister les rallonges et multiprises nécessaires", "organisation", "elec_plan", "faire", null, false],
  ["Prévoir éclairage zone production", "organisation", "elec_plan", "faire", null, false],
  ["Prévoir éclairage zone vente / comptoir", "organisation", "elec_plan", "faire", null, false],
  ["Prévoir éclairage banderole", "organisation", "elec_plan", "faire", null, false],
  ["Préparer les pâtons en amont", "organisation", "cuisine_org", "faire", null, false],
  ["Préparer les garnitures découpées/portionnées en amont", "organisation", "cuisine_org", "faire", null, false],
  ["Préparer le caramel maison (prévoir 10 bibs)", "organisation", "cuisine_org", "faire", null, false],
  ["Préparer le chocolat maison (prévoir 10 bibs)", "organisation", "cuisine_org", "faire", null, false],
  ["Préparer les oignons mijotés / confits", "organisation", "cuisine_org", "faire", null, false],
  ["Vérifier les pliages crêpes et galettes selon recettes et contenants", "organisation", "cuisine_org", "faire", null, false],
  ["Prévoir un brumisateur pour clients et/ou staff (optionnel)", "organisation", "cuisine_org", "reflechir", null, false],
  ["Prévoir scotch et marqueurs pour étiqueter les seaux (pâtons / crêpes / galettes)", "organisation", "cuisine_org", "acheter", null, true],
  ["Créer une fiche de poste par poste (crêpier, galettier, plancha, caisse, plonge)", "organisation", "cuisine_org", "preparer", null, false],
  ["Afficher les procédures sur le stand (zone production)", "organisation", "cuisine_org", "preparer", null, false],
  ["Définir le circuit de nettoyage de fin de soirée", "organisation", "cuisine_org", "faire", null, false],
  ["Si plongeur girafe loué : l'intégrer au circuit plonge", "organisation", "cuisine_org", "reflechir", null, false],
  ["Étudier la location d'un plongeur girafe", "organisation", "cuisine_org", "reflechir", null, false],
  ["Préparer les pâtes à galettes (quantité J+1)", "organisation", "veille", "faire", "mag", false],
  ["Préparer les pâtons sarrasin (galettes sèches stock)", "organisation", "veille", "faire", "mag", false],
  ["Préparer les pâtes à crêpes (quantité J+1)", "organisation", "veille", "faire", "mag", false],
  ["Préparer les oignons confits", "organisation", "veille", "faire", "mag", false],
  ["Portionner / conditionner les garnitures (jambon, emmental, feta, courgettes)", "organisation", "veille", "faire", "mag", false],
  ["Préparer caramel/chocolat maison si besoin (réassort)", "organisation", "veille", "faire", "mag", false],
  ["Stocker les pâtes et pâtons au froid (chambre froide / saladette)", "organisation", "veille", "faire", "mag", false],
  ["Vérifier les stocks par produit et déclencher réassort si besoin", "organisation", "veille", "faire", null, false],
  ["Effectuer le réassort matières premières fraîches (avant 16h30)", "organisation", "veille", "faire", null, false],
  ["Transport (Vito + remorque, chargement validé à la maison)", "organisation", "montage_site", "faire", "both", false],
  ["Montage rapide sur site selon test préalable", "organisation", "montage_site", "faire", "both", false],
  ["Installation plan électrique + éclairage + banderole", "organisation", "montage_site", "faire", null, false],
  ["Réassort avant 16h30 chaque jour", "organisation", "montage_site", "faire", null, false],
  ["Pause équipe 17h30-18h15", "organisation", "montage_site", "faire", null, false],
  ["État des lieux avec Dylan Le Grel — récupération caution (fin du festival)", "organisation", "montage_site", "faire", "sly", false],
  ["Don des 30 galettes à Musicalarue", "organisation", "montage_site", "faire", null, false],
  ["Commande finale matières premières fraîches", "organisation", "finitions", "faire", null, false],
  ["Vérifier caisse / fond de caisse (150-200 €)", "organisation", "finitions", "faire", null, false],
  ["Vérifier branchements téléphone / SumUp, recharger SumUp", "organisation", "finitions", "faire", null, false],
  ["Réserver la chambre froide", "organisation", "idees", "faire", "both", false],
  ["Appeler la Dînette pour confirmer le prêt de 2 billigs", "organisation", "idees", "faire", null, false],
  ["Réserver les 2 billigs supplémentaires à louer", "organisation", "idees", "faire", null, false],
  ["Vérifier le statut de la commande de vaisselle compostable (Fiest'Embal, avant le 12/06)", "organisation", "idees", "faire", null, false],
  ["Faire le point complet sur les ingrédients à acheter", "organisation", "idees", "faire", null, false],
  ["Acheter dès maintenant tout ce qui se conserve (farine, sucre, sel, épices, gaz…)", "organisation", "idees", "acheter", null, false],
];
function seedKorriganTasks(themeId, orderStart) {
  const today = todayISODate();
  return KORRIGAN_RAW_ITEMS.map(([text, chapter, subcat, status, assignee, bring], idx) => {
    const noteParts = [`${KORRIGAN_CHAPTER_LABELS[chapter]} · ${KORRIGAN_SUBCAT_LABELS[subcat]}`];
    if (assignee) noteParts.push(`Assigné : ${KORRIGAN_ASSIGNEE_LABELS[assignee]}`);
    if (bring) noteParts.push("À amener au festival");
    const done = status === "ok";
    return {
      id: "tk-" + uid(),
      themeId,
      title: text,
      kind: "task",
      duration: "indeterminee",
      time: null,
      allDay: false,
      inToday: false,
      done,
      cancelled: false,
      order: orderStart + idx + 1,
      urgency: korriganInferUrgency(text, subcat),
      recurrence: null,
      postponedTo: null,
      dueDate: null,
      startDate: null,
      endDate: null,
      notes: noteParts.join(" · "),
      lastDoneDate: null,
      completedAt: done ? `${today}T12:00:00.000Z` : null,
    };
  });
}

const EQUIPMENT_STATUS_ORDER = ["a_trouver", "pret", "ok"];
const EQUIPMENT_STATUS_LABELS = { a_trouver: "À trouver", pret: "Prêt", ok: "Ok" };
const EQUIPMENT_STATUS_COLORS = { a_trouver: "#E11D48", pret: "#F5C84C", ok: "#7DD3AE" };
// Checklists : une entrée est un OBJET (matériel) ou une TÂCHE (action).
// Objet : À trouver (rouge) → Prêt (orange) → Ok (vert, vérifié au chargement).
// Tâche : À faire → Fait. (+ urgence pour les tâches)
const OBJET_STATUS_ORDER = ["a_trouver", "pret", "ok"];
const OBJET_STATUS_LABELS = { a_trouver: "À trouver", pret: "Prêt", ok: "Ok" };
const OBJET_STATUS_COLORS = { a_trouver: "#E11D48", pret: "#F59E0B", ok: "#22C55E" };
const TACHE_STATUS_ORDER = ["a_faire", "fait"];
const TACHE_STATUS_LABELS = { a_faire: "À faire", fait: "Fait" };
const TACHE_STATUS_COLORS = { a_faire: "#F5C84C", fait: "#22C55E" };

function seedEquipmentRubriques() {
  const subcats = [...new Set(KORRIGAN_RAW_ITEMS.filter(([, , , , , bring]) => bring).map(([, , subcat]) => subcat))];
  return subcats.map((sc) => ({ id: "rub-" + sc, label: KORRIGAN_SUBCAT_LABELS[sc] || sc }));
}
function seedEquipmentChecklist() {
  return KORRIGAN_RAW_ITEMS
    .filter(([, , , , , bring]) => bring)
    .map(([text, , subcat]) => ({
      id: "eq-" + uid(),
      title: text,
      rubriqueId: "rub-" + subcat,
      status: "a_trouver",
    }));
}

// --- Défis du Jour ---
// --- Quiz ---
// Points gagnés : +5 à chaque bonne réponse (montant fixe). -5 à chaque mauvaise réponse
// (jamais en dessous de 0). Bonus de +10 toutes les 10 bonnes réponses.
function quizPointsForLevel(levelIndex) {
  return 5;
}
function quizBonusForCount(correctCount) {
  return (correctCount > 0 && correctCount % 10 === 0) ? 10 : 0;
}

// Incrémenter à CHAQUE modification du contenu des questions ci-dessous (ajout, retrait,
// correction de texte) — c'est ce qui déclenche la resynchronisation chez les utilisateurs
// existants (voir la migration "v_quiz" plus bas). Sans ce bump, les changements de contenu
// n'apparaîtraient jamais dans une appli déjà installée.
const QUIZ_LIBRARY_VERSION = 4;
const QUIZ_LIBRARY = [
  {
    id: "quiz-plantes", name: "Plantes & bienfaits", emoji: "🌿",
    questions: [
      { id: "pl1", type: "qcm", q: "Quelle plante est traditionnellement utilisée pour favoriser le sommeil et la relaxation ?", options: ["Valériane", "Ortie", "Ginseng", "Menthe poivrée"], correct: 0, explain: "Utilisée traditionnellement en tisane du soir." },
      { id: "pl2", type: "vf", q: "La camomille est traditionnellement utilisée pour apaiser les troubles digestifs légers.", correct: true, explain: "Une plante très courante en infusion digestive." },
      { id: "pl3", type: "qcm", q: "Le thym est surtout reconnu pour ses propriétés…", options: ["Antiseptiques et expectorantes", "Diurétiques puissantes", "Anticoagulantes", "Hallucinogènes"], correct: 0, explain: "Le thym est riche en thymol, un composé antiseptique." },
      { id: "pl4", type: "vf", q: "L'ortie est riche en fer et en minéraux.", correct: true, explain: "Elle pousse spontanément et se cuisine aussi comme un légume." },
      { id: "pl5", type: "qcm", q: "Quelle plante est souvent surnommée \"l'aspirine végétale\" pour ses propriétés anti-inflammatoires ?", options: ["Reine-des-prés", "Basilic", "Persil", "Coriandre"], correct: 0, explain: "Elle contient des dérivés proches de l'acide salicylique." },
      { id: "pl6", type: "vf", q: "Le gingembre est traditionnellement utilisé contre les nausées.", correct: true, explain: "Souvent utilisé en tisane contre le mal des transports." },
      { id: "pl7", type: "qcm", q: "Le romarin est traditionnellement associé à la stimulation de…", options: ["La mémoire et la concentration", "Le sommeil profond", "La pousse des cheveux uniquement", "Rien de particulier"], correct: 0, explain: "Une plante aromatique associée à la clarté d'esprit." },
      { id: "pl8", type: "vf", q: "La lavande est reconnue pour ses vertus relaxantes, souvent utilisée en aromathérapie.", correct: true, explain: "Son parfum est l'un des plus utilisés en aromathérapie." },
      { id: "pl9", type: "qcm", q: "Quelle partie du pissenlit est traditionnellement utilisée pour ses vertus dépuratives ?", options: ["La racine", "Seulement la fleur", "Seulement la tige", "Aucune partie"], correct: 0, explain: "Toute la plante est comestible, racine comprise." },
      { id: "pl10", type: "vf", q: "Le curcuma contient de la curcumine, reconnue pour ses propriétés anti-inflammatoires.", correct: true, explain: "Le curcuma est aussi une épice culinaire courante." },
      { id: "pl11", type: "qcm", q: "Quelle plante est traditionnellement utilisée pour soulager les maux de tête et les tensions ?", options: ["Menthe poivrée", "Ortie", "Fenouil", "Aneth"], correct: 0, explain: "Son huile essentielle est très concentrée en menthol." },
      { id: "pl12", type: "vf", q: "Toutes les plantes \"naturelles\" sont sans danger, quelle que soit la dose.", correct: false, explain: "Le bon dosage et le bon usage restent essentiels, même pour une plante." },
      { id: "pl13", type: "qcm", q: "Le fenouil est traditionnellement utilisé pour faciliter…", options: ["La digestion", "La coagulation sanguine", "La croissance osseuse", "Rien de spécifique"], correct: 0, explain: "Ses graines sont aussi utilisées en cuisine." },
      { id: "pl14", type: "vf", q: "L'échinacée est traditionnellement utilisée pour soutenir les défenses immunitaires.", correct: true, explain: "Une plante souvent recommandée en période de fatigue saisonnière." },
      { id: "pl15", type: "qcm", q: "Quelle plante grimpante est réputée pour ses vertus apaisantes sur l'anxiété légère, en tisane ?", options: ["Passiflore", "Lierre", "Vigne vierge", "Chèvrefeuille"], correct: 0, explain: "Une liane grimpante aux jolies fleurs particulières." },
      { id: "pl16", type: "vf", q: "Le tilleul est traditionnellement utilisé en infusion pour ses vertus calmantes.", correct: true, explain: "Le tilleul est l'une des tisanes du soir les plus classiques." },
      { id: "pl17", type: "qcm", q: "En plus d'être culinaire, le basilic est traditionnellement associé à des propriétés…", options: ["Digestives et apaisantes", "Anticoagulantes puissantes", "Hallucinogènes", "Aucune propriété"], correct: 0, explain: "Le basilic est aussi une plante culinaire très répandue." },
      { id: "pl18", type: "vf", q: "Le persil est uniquement décoratif et n'a aucune vertu nutritionnelle.", correct: false, explain: "Riche en vitamine C, il se mange aussi en persillade." },
      { id: "lav2", type: "vf", q: "Le linalol est le principal composant reconnu pour les propriétés apaisantes de la lavande.", correct: true, explain: "Le linalol contribue à l'effet relaxant caractéristique de la lavande." },
      { id: "lav3", type: "qcm", q: "Dans l'Antiquité, la lavande était notamment utilisée par…", options: ["Les Égyptiens (embaumement) et les Romains (parfumer les bains)", "Uniquement les Gaulois", "Uniquement les Chinois", "Personne avant le Moyen Âge"], correct: 0, explain: "Un usage qui remonte à plusieurs millénaires." },
      { id: "lav4", type: "vf", q: "La lavande est traditionnellement utilisée pour calmer les spasmes digestifs et les ballonnements.", correct: true, explain: "Utilisée traditionnellement en tisane après le repas." },
      { id: "lav5", type: "qcm", q: "La lavande aspic (Lavandula latifolia) tiendrait son nom de…", options: ["Un serpent (l'aspic)", "Une région de France", "Son inventeur", "Sa couleur"], correct: 0, explain: "Un nom qui évoque la morsure, en lien avec ses usages anciens." },
      { id: "lav6", type: "vf", q: "La lavande aspic et la lavande vraie (officinale) sont exactement la même plante.", correct: false, explain: "Deux espèces distinctes de lavande, aux usages parfois différents." },
      { id: "lav7", type: "qcm", q: "Aujourd'hui, quel pays est le premier producteur mondial de lavande, devant la France ?", options: ["La Bulgarie", "L'Espagne", "L'Italie", "Le Maroc"], correct: 0, explain: "Un pays devenu leader de cette production ces dernières décennies." },
      { id: "lav8", type: "vf", q: "La lavande est traditionnellement utilisée comme répulsif naturel contre les moustiques et les mites.", correct: true, explain: "Son parfum est peu apprécié de nombreux insectes." },
      { id: "lav10", type: "vf", q: "La lavande est déconseillée sans avis médical chez la femme enceinte ou allaitante, et chez les jeunes enfants.", correct: true, explain: "Par précaution, mieux vaut demander un avis médical dans ces cas." },
      { id: "lav13", type: "qcm", q: "D'où la lavande est-elle originaire ?", options: ["Le bassin méditerranéen", "L'Amazonie", "La Sibérie", "Le Sahara"], correct: 0, explain: "Elle pousse naturellement dans les régions au climat sec et ensoleillé." },
      { id: "lav14", type: "qcm", q: "Quelle partie de la lavande est utilisée pour préparer les tisanes ?", options: ["Les fleurs", "Les racines", "L'écorce", "Les graines"], correct: 0, explain: "Les fleurs séchées sont utilisées en infusion." },
      { id: "herb2", type: "vf", q: "La France serait aujourd'hui le seul pays européen à ne pas reconnaître officiellement le métier d'herboriste en dehors du parcours de pharmacien.", correct: true, explain: "Une situation régulièrement débattue en France." },
      { id: "herb3", type: "qcm", q: "Quelle différence peut-on faire entre herboristerie et phytothérapie ?", options: ["L'herboristerie est l'art de choisir, récolter, préparer et vendre les plantes ; la phytothérapie est leur usage thérapeutique", "Ce sont des synonymes stricts", "La phytothérapie serait plus ancienne que l'herboristerie", "Il n'y aurait aucune différence"], correct: 0, explain: "Deux mots proches mais qui désignent des activités différentes." },
      { id: "herb5", type: "vf", q: "Aujourd'hui, plusieurs dizaines de plantes médicinales sont autorisées à la vente libre en France, en dehors des pharmacies.", correct: true, explain: "Une liste encadrée qui évolue au fil du temps." },
      { id: "herb6", type: "qcm", q: "Quelle molécule, précurseur chimique de l'aspirine, a été extraite du saule blanc au 19e siècle ?", options: ["L'acide salicylique", "La pénicilline", "La morphine", "La caféine"], correct: 0, explain: "Une découverte qui a mené au développement de l'aspirine moderne." },
      { id: "herb7", type: "qcm", q: "Quelles sont les 3 méthodes classiques de préparation d'une plante en tisane ?", options: ["Infusion, décoction, macération", "Distillation, filtration, évaporation", "Cuisson, friture, fermentation", "Séchage, congélation, mixage"], correct: 0, explain: "Trois techniques classiques selon la partie de plante utilisée." },
      { id: "herb8", type: "vf", q: "L'infusion consiste à verser de l'eau bouillante sur la plante et à laisser reposer, tandis que la décoction consiste à faire bouillir la plante directement dans l'eau.", correct: true, explain: "La décoction convient mieux aux parties dures (racines, écorces)." },
      { id: "herb13", type: "qcm", q: "Comment nomme-t-on la médecine douce qui utilise les plantes pour prévenir ou traiter certains troubles ?", options: ["La phytothérapie", "La physiothérapie", "La psychothérapie", "La cryothérapie"], correct: 0, explain: "Un terme à ne pas confondre avec la physiothérapie." },
      { id: "herb14", type: "qcm", q: "Qu'appelle-t-on une \"tisane\" au sens large ?", options: ["Une préparation de plante(s) dans de l'eau, chaude ou froide, pour en extraire les principes actifs", "Uniquement une boisson à base de thé", "Un remède obligatoirement sucré", "Une préparation uniquement à base de fleurs"], correct: 0, explain: "Le principe reste le même, chaude ou froide." },
      { id: "herb15", type: "vf", q: "La naturopathie est une discipline plus large qui peut inclure la phytothérapie parmi ses outils, aux côtés de la nutrition ou des massages.", correct: true, explain: "Une approche globale qui combine plusieurs pratiques naturelles." },
      { id: "pl19", type: "qcm", q: "Le sureau noir est traditionnellement utilisé, en tisane de fleurs, pour…", options: ["Accompagner les états grippaux et les refroidissements", "Stimuler l'appétit", "Calmer les brûlures d'estomac", "Aucun usage traditionnel connu"], correct: 0, explain: "Les fleurs de sureau sont classiques en tisane hivernale." },
      { id: "pl20", type: "vf", q: "L'aubépine est traditionnellement associée au soutien du système cardiovasculaire léger et à l'apaisement nerveux.", correct: true, explain: "Une plante souvent citée en phytothérapie du cœur et du stress." },
      { id: "pl21", type: "qcm", q: "Le millepertuis est traditionnellement connu pour son usage sur…", options: ["Les coups de blues passagers", "Les fractures osseuses", "L'hypertension sévère", "Aucun usage traditionnel"], correct: 0, explain: "Attention toutefois, il interagit avec de nombreux médicaments." },
      { id: "pl22", type: "vf", q: "Le millepertuis peut réduire l'efficacité de certains médicaments, dont la pilule contraceptive.", correct: true, explain: "Une interaction bien documentée, à connaître avant d'en consommer." },
      { id: "pl23", type: "qcm", q: "La mélisse est traditionnellement utilisée pour…", options: ["Apaiser le stress léger et faciliter l'endormissement", "Stimuler l'énergie physique", "Traiter les brûlures cutanées", "Blanchir les dents"], correct: 0, explain: "Une plante calmante, souvent associée à la tisane du soir." },
      { id: "pl25", type: "qcm", q: "La consoude est une plante traditionnellement utilisée, en usage externe, pour…", options: ["Favoriser la cicatrisation cutanée", "Blanchir la peau", "Repousser les moustiques", "Colorer les tissus"], correct: 0, explain: "Elle est surtout connue en cataplasme ou pommade." },
      { id: "pl26", type: "vf", q: "La consoude est aujourd'hui déconseillée en usage interne prolongé en raison de composés potentiellement toxiques pour le foie.", correct: true, explain: "Les alcaloïdes pyrrolizidiniques qu'elle contient justifient cette prudence." },
      { id: "pl27", type: "qcm", q: "Quelle huile essentielle est traditionnellement associée au ravintsara pour assainir l'air en période de grippe ?", options: ["Eucalyptus radié", "Lavande vraie", "Menthe poivrée", "Genièvre"], correct: 0, explain: "Les deux sont réputées pour leur action antivirale en diffusion." },
      { id: "pl28", type: "vf", q: "Les fleurs de sureau noir sont traditionnellement utilisées pour faire baisser la fièvre en favorisant la transpiration.", correct: true, explain: "Une propriété diaphorétique classique en phytothérapie hivernale." },
      { id: "pl29", type: "qcm", q: "La reine-des-prés contient un composé dont dérive un médicament très célèbre. Lequel ?", options: ["L'aspirine", "La morphine", "La pénicilline", "Le paracétamol"], correct: 0, explain: "Son acide salicylique naturel est à l'origine de ce rapprochement." },
      { id: "pl30", type: "vf", q: "Le thym doit notamment son action antiseptique et expectorante au thymol contenu dans son huile essentielle.", correct: true, explain: "Un composé aromatique très étudié pour ses effets sur les voies respiratoires." },
      { id: "pl31", type: "qcm", q: "Traditionnellement, le bouillon blanc est surtout utilisé en tisane pour…", options: ["Calmer la toux sèche et douloureuse", "Stimuler l'appétit", "Faire baisser la tension", "Aucun usage traditionnel connu"], correct: 0, explain: "Ses mucilages adoucissent les muqueuses irritées." },
      { id: "pl32", type: "vf", q: "L'ortie fraîche est riche en fer, en chlorophylle et en minéraux, ce qui en ferait un aliment tonique reconnu au printemps.", correct: true, explain: "Elle est parfois surnommée aliment revitalisant de saison." },
      { id: "pl34", type: "vf", q: "Toutes les parties de l'ortie (feuilles, tige, racines, graines) seraient traditionnellement utilisées.", correct: true, explain: "Une plante entièrement exploitée, rare pour une 'mauvaise herbe'." },
      { id: "pl35", type: "qcm", q: "L'ortie est traditionnellement reconnue comme une plante…", options: ["Diurétique et reminéralisante", "Sédative puissante", "Anesthésiante locale", "Sans propriété particulière"], correct: 0, explain: "Elle est riche en fer, silicium et autres minéraux." },
      { id: "pl36", type: "vf", q: "Le purin d'ortie, utilisé au jardin, est aujourd'hui inscrit dans la liste européenne des substances de base autorisées.", correct: true, explain: "Une reconnaissance obtenue après plusieurs années de démarches." },
      { id: "pl37", type: "qcm", q: "Chez les jeunes enfants (à partir de 6 ans), l'échinacée est traditionnellement dosée en fonction de…", options: ["Leur poids", "Leur âge uniquement", "La saison", "Aucun ajustement n'est nécessaire"], correct: 0, explain: "Un dosage pédiatrique proportionnel, comme souvent en phytothérapie infantile." },
      { id: "pl38", type: "vf", q: "L'échinacée est déconseillée en cas de maladie auto-immune ou de prise d'immunosuppresseurs.", correct: true, explain: "Son action stimulante sur l'immunité peut interagir avec ces traitements." },
      { id: "pl39", type: "qcm", q: "Quelle céréale Hildegarde de Bingen surnommait-elle \"reine des céréales\" ?", options: ["L'épeautre", "Le blé", "Le seigle", "L'avoine"], correct: 0, explain: "Elle la disait de nature chaude, donnant bonne chair et esprit joyeux." },
      { id: "pl40", type: "vf", q: "Selon la tradition hildegardienne, les grains d'épeautre gagnent à tremper environ 12h dans l'eau froide avant cuisson.", correct: true, explain: "Un trempage qui facilite la cuisson et la digestion du grain." },
      { id: "pl41", type: "qcm", q: "Que recommandait Hildegarde de Bingen de mâcher à jeun le matin pour la digestion et l'haleine ?", options: ["Des graines de fenouil", "Des pétales de rose", "De l'écorce de chêne", "Des feuilles de laurier"], correct: 0, explain: "Un geste simple attribué à ses conseils de bien-être quotidien." },
      { id: "pl42", type: "qcm", q: "Quelle racine, proche du gingembre, Hildegarde utilisait-elle contre la fièvre et pour la digestion ?", options: ["Le galanga", "Le curcuma", "La réglisse", "La bardane"], correct: 0, explain: "Une épice moins connue aujourd'hui, mais proche du gingembre." },
      { id: "pl43", type: "qcm", q: "Que conseillait Hildegarde de croquer après avoir mangé de l'ail cru, pour en atténuer l'odeur ?", options: ["Des grains de café, d'anis ou de cumin", "Une pomme entière", "Du miel pur", "Rien, l'odeur devait rester"], correct: 0, explain: "Elle recommandait l'ail cru, suivi de ces graines pour rafraîchir l'haleine." },
      { id: "pl44", type: "qcm", q: "Traditionnellement séchée et consommée par les populations vivant autour du lac Tchad, quelle micro-algue est aujourd'hui popularisée comme complément alimentaire ?", options: ["La spiruline", "Le moringa", "La chlorella", "La spatuline"], correct: 0, explain: "Elle y est traditionnellement récoltée depuis des siècles, sous le nom local de \"dihé\"." },
      { id: "pl45", type: "vf", q: "La spiruline est riche en fer et en protéines végétales, ce qui en fait un aliment d'appoint apprécié des régimes végétariens.", correct: true, explain: "Elle apporte aussi plusieurs acides aminés essentiels." },
      { id: "pl46", type: "qcm", q: "La propolis, récoltée par les abeilles, est traditionnellement reconnue pour ses propriétés…", options: ["Antiseptiques et cicatrisantes", "Anesthésiantes puissantes", "Laxatives", "Aucune propriété reconnue"], correct: 0, explain: "Les abeilles l'utilisent elles-mêmes pour assainir la ruche." },
      { id: "pl47", type: "vf", q: "Grâce à sa faible teneur en eau et son pH acide, le miel pur se conserve pratiquement indéfiniment sans se périmer.", correct: true, explain: "Des pots de miel millénaires ont même été retrouvés encore comestibles." },
      { id: "pl48", type: "qcm", q: "La sauge officinale est traditionnellement utilisée en tisane pour…", options: ["Réguler la transpiration excessive et les bouffées de chaleur", "Stimuler l'appétit uniquement", "Calmer la toux sèche", "Aucun usage traditionnel connu"], correct: 0, explain: "Elle est souvent proposée en accompagnement de la ménopause." },
      { id: "pl49", type: "vf", q: "La sauge officinale, riche en thuyone, est déconseillée en usage prolongé pendant la grossesse.", correct: true, explain: "La thuyone peut être neurotoxique à haute dose." },
      { id: "pl50", type: "qcm", q: "La verveine odorante (verveine citronnée) est surtout appréciée en tisane pour ses vertus…", options: ["Digestives et apaisantes", "Stimulantes et excitantes", "Anesthésiantes", "Diurétiques puissantes"], correct: 0, explain: "Une infusion classique après le repas, appréciée pour son parfum citronné." },
      { id: "pl51", type: "qcm", q: "La cannelle est traditionnellement associée à un effet favorable sur…", options: ["La régulation de la glycémie", "La coagulation sanguine", "La vision nocturne", "Aucun effet traditionnel connu"], correct: 0, explain: "Un usage traditionnel étudié, à ne pas substituer à un traitement médical." },
      { id: "pl52", type: "vf", q: "La cannelle de Cassia (la plus courante) contient davantage de coumarine que la cannelle de Ceylan, ce qui limite les quantités recommandées.", correct: true, explain: "La cannelle de Ceylan, dite \"vraie cannelle\", en contient beaucoup moins." },
      { id: "pl53", type: "qcm", q: "Le clou de girofle est traditionnellement utilisé, mâché ou en application locale, pour…", options: ["Apaiser une douleur dentaire", "Faire baisser la fièvre", "Stimuler la pousse des cheveux", "Aucun usage traditionnel connu"], correct: 0, explain: "Il contient de l'eugénol, aux propriétés antalgiques locales." },
      { id: "pl54", type: "qcm", q: "La cardamome, épice très utilisée dans le chai indien, est traditionnellement reconnue pour faciliter…", options: ["La digestion", "La cicatrisation des plaies", "La circulation sanguine", "Aucun usage traditionnel connu"], correct: 0, explain: "Elle accompagne souvent les repas riches pour aider à digérer." },
      { id: "pl55", type: "qcm", q: "Le safran, épice la plus chère au monde, provient de…", options: ["Les stigmates séchés de la fleur de crocus", "Les racines d'un arbuste tropical", "Les graines d'un poivrier", "Les pétales de rose"], correct: 0, explain: "Chaque fleur ne donne que 3 fins stigmates, d'où son prix élevé." },
      { id: "pl56", type: "vf", q: "Il faut environ 150 fleurs de crocus pour obtenir seulement 1 gramme de safran.", correct: true, explain: "Une récolte entièrement manuelle qui explique la rareté de l'épice." },
      { id: "pl59", type: "vf", q: "Le moringa, surnommé \"arbre miracle\", a des feuilles particulièrement riches en vitamines et minéraux.", correct: true, explain: "Il est parfois utilisé pour lutter contre la malnutrition dans certaines régions." },
      { id: "pl60", type: "qcm", q: "Le gel d'aloe vera est traditionnellement appliqué en usage externe pour…", options: ["Apaiser les coups de soleil légers", "Stimuler l'appétit", "Faire baisser la fièvre", "Aucun usage traditionnel connu"], correct: 0, explain: "Son effet rafraîchissant et apaisant sur la peau est largement reconnu." },
      { id: "pl62", type: "qcm", q: "Le calendula (souci officinal) est traditionnellement utilisé en usage externe pour…", options: ["Apaiser et aider à cicatriser la peau", "Stimuler la digestion", "Calmer la toux", "Aucun usage traditionnel connu"], correct: 0, explain: "On le retrouve souvent dans les crèmes et baumes pour peaux sensibles." },
      { id: "pl67", type: "qcm", q: "La racine de valériane est traditionnellement utilisée en tisane du soir pour favoriser…", options: ["L'endormissement", "La concentration", "La digestion des graisses", "Aucun usage traditionnel connu"], correct: 0, explain: "Une des plantes les plus classiques pour accompagner le coucher." },
      { id: "pl68", type: "vf", q: "La réglisse, en consommation excessive et prolongée, est déconseillée en cas d'hypertension.", correct: true, explain: "Elle peut favoriser la rétention d'eau et l'élévation de la tension artérielle." },
      { id: "pl69", type: "qcm", q: "Les graines de fenugrec sont traditionnellement utilisées pour…", options: ["Stimuler l'appétit", "Calmer la toux", "Réduire la fièvre", "Aucun usage traditionnel connu"], correct: 0, explain: "Elles sont également utilisées en cuisine, notamment indienne." },
      { id: "pl70", type: "vf", q: "L'estragon fait partie des \"fines herbes\" traditionnelles de la cuisine française, aux côtés du persil, du cerfeuil et de la ciboulette.", correct: true, explain: "Il est notamment associé au poulet et aux sauces au vinaigre." },
      { id: "pl71", type: "qcm", q: "En cuisine, la feuille de laurier se retire généralement…", options: ["Avant de servir le plat", "Elle se mange toujours crue", "Elle se consomme en dessert", "Elle ne s'utilise jamais en cuisine"], correct: 0, explain: "Elle parfume la cuisson mais n'est pas censée être mangée telle quelle." },
      { id: "pl72", type: "qcm", q: "La badiane (anis étoilé) est traditionnellement utilisée en infusion pour faciliter…", options: ["La digestion", "La cicatrisation", "La vision nocturne", "Aucun usage traditionnel connu"], correct: 0, explain: "Elle parfume aussi certaines liqueurs et plats mijotés." },
      { id: "pl73", type: "vf", q: "Il existe une badiane du Japon toxique, à ne pas confondre avec la badiane de Chine utilisée en cuisine et en tisane.", correct: true, explain: "Des cas d'intoxication ont été rapportés en cas de confusion entre les deux." },
      { id: "pl74", type: "qcm", q: "L'origan doit une grande partie de son action antibactérienne à…", options: ["Le carvacrol", "La curcumine", "L'eugénol", "La thuyone"], correct: 0, explain: "Un composé aromatique aussi présent dans la marjolaine." },
      { id: "pl75", type: "qcm", q: "Le cumin est traditionnellement utilisé, en cuisine comme en tisane, pour faciliter…", options: ["La digestion", "L'endormissement", "La circulation sanguine", "Aucun usage traditionnel connu"], correct: 0, explain: "Une épice courante dans de nombreuses cuisines du monde." },
      { id: "pl77", type: "qcm", q: "En phytothérapie, la camomille allemande (matricaire) est traditionnellement plutôt associée à…", options: ["Un usage digestif et anti-inflammatoire", "Un usage exclusivement cosmétique", "Un usage anesthésiant fort", "Aucun usage traditionnel connu"], correct: 0, explain: "La camomille romaine est, elle, plutôt réputée pour son effet calmant nerveux." },
      { id: "pl78", type: "vf", q: "La ciboulette perd une grande partie de sa saveur si on la fait cuire longtemps : elle s'ajoute donc en fin de cuisson.", correct: true, explain: "C'est pourquoi on la ciselle fraîche, juste avant de servir." },
      { id: "pl79", type: "qcm", q: "Le cerfeuil, une des \"fines herbes\" françaises, est traditionnellement associé à un goût…", options: ["Légèrement anisé", "Très piquant", "Amer et poivré", "Sucré comme la réglisse"], correct: 0, explain: "Un parfum délicat, plus discret que le persil ou l'estragon." },
      { id: "pl80", type: "qcm", q: "Le paprika, épice obtenue à partir de piments séchés et moulus, est traditionnellement associé à la cuisine…", options: ["Hongroise et espagnole", "Japonaise", "Scandinave", "Aucune cuisine en particulier"], correct: 0, explain: "Il peut être doux ou fumé selon la variété de piment et le séchage." },
      { id: "pl81", type: "qcm", q: "La badiane, le clou de girofle et la cannelle sont des épices que l'on retrouve fréquemment ensemble dans…", options: ["Le pain d'épices et les vins chauds d'hiver", "Les salades d'été", "Les sorbets aux fruits rouges", "Aucun usage culinaire courant"], correct: 0, explain: "Ce trio d'épices \"chaudes\" est classique des recettes hivernales." },
      { id: "pl82", type: "vf", q: "Le persil contient, à poids égal, davantage de vitamine C que certains agrumes.", correct: true, explain: "Il reste toutefois consommé en petite quantité, ce qui limite son apport réel." },
      { id: "pl84", type: "qcm", q: "D'après les recherches historiques les plus récentes, le chapitre de la Physica consacré aux champignons (\"De Fungis\")…", options: ["Aurait probablement été ajouté après la mort de Hildegarde, par un copiste", "Figure à l'identique dans absolument tous les manuscrits connus", "Aurait été écrit en tout premier, avant tous les autres chapitres", "Ne parlerait pas réellement de champignons malgré son titre"], correct: 0, explain: "Plusieurs indices (numérotation, changement de main, absence dans l'édition imprimée de 1533) suggèrent un ajout tardif." },
      { id: "pl85", type: "vf", q: "Selon l'état actuel de la recherche historique, le chapitre sur les champignons de la Physica aurait été écrit par Hildegarde elle-même, sans le moindre doute possible.", correct: false, explain: "Plusieurs indices suggèrent au contraire qu'il s'agirait d'un ajout tardif, par un copiste postérieur à sa mort." },
      { id: "pl86", type: "qcm", q: "Selon Hildegarde, pour conserver ses vertus, l'ail doit être consommé…", options: ["Cru, sous peine de perdre ses propriétés", "Toujours cuit longuement", "Uniquement séché puis moulu", "Jamais seul, toujours mélangé à du miel"], correct: 0, explain: "Elle précise qu'autrement, il perd ses propriétés \"comme un vin éventé\"." },
      { id: "pl87", type: "qcm", q: "Dans le pavot, quelle partie de la plante Hildegarde jugeait-elle responsable de l'effet calmant favorisant le sommeil ?", options: ["La graine", "La racine", "La tige", "La fleur entière"], correct: 0, explain: "Une observation assez fine pour l'époque, puisque c'est effectivement la graine qui est concernée." },
      { id: "pl88", type: "vf", q: "D'après Hildegarde, appliquer de la vulnéraire ou de la consoude sur une plaie causée par le fer guérit toujours la blessure en profondeur, sans aucun risque.", correct: false, explain: "Elle met justement en garde : ces plantes referment vite la peau en surface, ce qui peut repousser le mal à l'intérieur si celui-ci n'a pas été traité au préalable." },
      { id: "pl89", type: "qcm", q: "Plusieurs épices aujourd'hui perçues comme exotiques (galanga, cannelle, girofle...) que mentionne Hildegarde étaient en réalité…", options: ["Déjà disponibles sur certains marchés d'Europe occidentale dès le haut Moyen Âge", "Totalement inconnues en Europe avant elle", "Réservées exclusivement à la cour impériale", "Cultivées localement dans le jardin de son monastère"], correct: 0, explain: "Des sources dès le IXe siècle attestent leur présence sur des marchés comme celui de Cambrai." },
      { id: "pl90", type: "vf", q: "Le plan du monastère de Saint-Gall (vers 820) distinguait déjà un jardin potager (l'hortus) et un jardin de plantes médicinales (l'herbularius), séparés l'un de l'autre.", correct: true, explain: "Un modèle de jardin monastique apparemment encore d'actualité trois siècles plus tard, à l'époque de Hildegarde." },
      { id: "pl91", type: "qcm", q: "Dès le début du XXe siècle, certains commentateurs ont surnommé Hildegarde de Bingen…", options: ["La \"première naturaliste\" (et \"femme-médecin\") allemande", "La \"reine des alchimistes\"", "L'\"inventrice de la pharmacie\" moderne", "La \"mère de la botanique\" universelle"], correct: 0, explain: "Un titre honorifique donné dès 1927, bien avant la vague actuelle de redécouverte enthousiaste." },
      { id: "pl92", type: "vf", q: "Toutes les plantes toxiques mentionnées par Hildegarde (ciguë, belladone, jusquiame...) sont, selon elle, à proscrire dans n'importe quelle préparation, même en usage externe.", correct: false, explain: "Elle recommande par exemple la ciguë en compresse externe contre les douleurs consécutives à un coup, tout en déconseillant fermement son usage interne." },
      { id: "pl93", type: "qcm", q: "Certains chapitres du \"livre des plantes\" de la Physica ne traitent en réalité pas de plantes, mais de…", options: ["Miel, sucre, lait, beurre, sel, œufs...", "Minéraux et pierres précieuses", "Instruments de cuisine", "Animaux de la ferme"], correct: 0, explain: "Une dizaine de chapitres \"intrus\" traitent de ce type de sujets, ce qui complique le décompte réel des plantes décrites." },
    ],


  },
  {
    id: "quiz-neuro", name: "Neurosciences", emoji: "🧠",
    questions: [
      { id: "nr1", type: "qcm", q: "Combien de neurones compte environ le cerveau humain adulte ?", options: ["86 milliards", "1 milliard", "500 millions", "1000 milliards"], correct: 0, explain: "Un chiffre souvent cité, bien loin des idées reçues plus modestes." },
      { id: "nr2", type: "vf", q: "Nous n'utilisons que 10% de notre cerveau.", correct: false, explain: "Neuromythe : l'imagerie cérébrale montre une activité répartie dans tout le cerveau." },
      { id: "nr3", type: "qcm", q: "Quelle structure est principalement associée à la mémoire ?", options: ["Hippocampe", "Cervelet", "Bulbe rachidien", "Thalamus"], correct: 0, explain: "L'hippocampe est central pour former de nouveaux souvenirs." },
      { id: "nr4", type: "vf", q: "Le cerveau humain pèse environ 1,3 à 1,4 kg en moyenne.", correct: true, explain: "Un poids qui varie peu d'un adulte à l'autre." },
      { id: "nr5", type: "qcm", q: "Quel neurotransmetteur est souvent associé au plaisir et à la récompense ?", options: ["Dopamine", "Sérotonine", "GABA", "Acétylcholine"], correct: 0, explain: "La dopamine est le neurotransmetteur clé du circuit de la récompense." },
      { id: "nr6", type: "vf", q: "Les neurones peuvent se régénérer dans certaines régions du cerveau (neurogenèse).", correct: true, explain: "La neurogenèse adulte existe notamment dans l'hippocampe." },
      { id: "nr7", type: "qcm", q: "Quel est le rôle principal du cervelet ?", options: ["Coordination des mouvements", "Vision", "Langage", "Digestion"], correct: 0, explain: "Le cervelet ajuste précision et équilibre des mouvements." },
      { id: "nr8", type: "vf", q: "Le sommeil ne sert à rien pour la mémorisation.", correct: false, explain: "Le sommeil, surtout profond et paradoxal, consolide la mémoire." },
      { id: "nr9", type: "qcm", q: "Comment s'appelle la gaine qui accélère la transmission le long des axones ?", options: ["Myéline", "Synapse", "Dendrite", "Axone"], correct: 0, explain: "La myéline isole l'axone et accélère la conduction nerveuse." },
      { id: "nr10", type: "vf", q: "Le stress chronique peut réduire le volume de l'hippocampe.", correct: true, explain: "Un excès prolongé de cortisol peut abîmer les neurones de l'hippocampe." },
      { id: "nr13", type: "qcm", q: "Quelle structure joue un rôle clé dans la gestion de la peur et des émotions ?", options: ["Amygdale", "Hippocampe", "Cortex visuel", "Thalamus"], correct: 0, explain: "L'amygdale détecte la menace et déclenche la peur." },
      { id: "nr14", type: "vf", q: "Le cerveau consomme environ 20% de l'énergie totale du corps au repos.", correct: true, explain: "Un organe gourmand en énergie malgré sa petite taille." },
      { id: "nr16", type: "vf", q: "L'exercice physique régulier favorise la naissance de nouveaux neurones dans l'hippocampe.", correct: true, explain: "L'exercice stimule le facteur BDNF, favorable aux nouveaux neurones." },
      { id: "nr17", type: "qcm", q: "Quel est le nom de la jonction entre deux neurones où se transmet l'information ?", options: ["Synapse", "Ganglion", "Nœud de Ranvier", "Cortex"], correct: 0, explain: "C'est à la synapse que l'information passe d'un neurone à l'autre." },
      { id: "nr18", type: "vf", q: "Les deux hémisphères du cerveau sont totalement indépendants et ne communiquent jamais.", correct: false, explain: "Le corps calleux relie et fait communiquer les deux hémisphères." },
      { id: "bias1", type: "qcm", q: "Le \"biais de confirmation\" désigne la tendance à…", options: ["Rechercher et privilégier les informations qui confirment ce qu'on croit déjà", "Toujours changer d'avis face à un nouvel argument", "Oublier systématiquement ses opinions", "Ne jamais avoir d'opinion tranchée"], correct: 0, explain: "On retient plus facilement ce qui va dans notre sens." },
      { id: "bias2", type: "vf", q: "Le \"biais de cohérence\" désigne le fait qu'une fois qu'on a évalué quelqu'un, on a tendance à maintenir cette évaluation même si le contexte change.", correct: true, explain: "Une première impression peut rester figée malgré un contexte différent." },
      { id: "bias3", type: "qcm", q: "Le \"biais de contraste\" fait qu'un prix ou une chose parait…", options: ["Différent selon ce qui a été présenté juste avant", "Toujours identique quel que soit le contexte", "Plus cher le matin", "Sans effet sur le jugement"], correct: 0, explain: "Un même prix parait différent selon la référence proposée juste avant." },
      { id: "bias4", type: "qcm", q: "Le \"biais de réciprocité\" décrit la tendance à…", options: ["Vouloir rendre une faveur ou un service qu'on a reçu", "Refuser systématiquement toute aide", "Oublier qui nous a aidés", "Toujours demander avant de donner"], correct: 0, explain: "On se sent poussé à rendre ce qu'on a reçu." },
      { id: "bias8", type: "vf", q: "Le \"biais social\" (ou preuve sociale) pousse à adopter un comportement d'autant plus facilement qu'on voit beaucoup d'autres personnes l'adopter.", correct: true, explain: "Voir les autres agir pareil rassure et pousse à suivre." },
      { id: "bias9", type: "qcm", q: "Le \"biais de disponibilité\" fait qu'on surestime la fréquence d'un évènement…", options: ["Quand des exemples nous viennent facilement à l'esprit", "Quand on n'y a jamais pensé", "Uniquement s'il est écrit dans un livre", "Jamais, ce biais n'affecte pas les probabilités perçues"], correct: 0, explain: "Ce qui est facile à se rappeler parait plus fréquent qu'il ne l'est." },
      { id: "bias11", type: "vf", q: "Un biais cognitif est un raccourci de pensée qui peut mener à un jugement systématiquement faussé, sans qu'on en ait forcément conscience.", correct: true, explain: "Un raccourci de pensée, souvent automatique et inconscient." },
      { id: "bias19", type: "vf", q: "Être conscient de l'existence d'un biais suffit toujours à s'en protéger complètement.", correct: false, explain: "Connaître un biais aide, mais ne suffit pas toujours à l'éviter." },
      { id: "bmo1", type: "qcm", q: "Quel pourcentage de notre masse corporelle représente le cerveau ?", options: ["3 à 4%", "10%", "15%", "25%"], correct: 0, explain: "Un organe compact mais très gourmand en énergie." },
      { id: "bmo2", type: "qcm", q: "Le mythe \"cerveau droit créatif / cerveau gauche rationnel\" a été…", options: ["Démenti scientifiquement peu après sa création", "Confirmé par l'imagerie cérébrale", "Jamais étudié", "Prouvé récemment"], correct: 0, explain: "L'idée a été vite abandonnée par la communauté scientifique." },
      { id: "bmo5", type: "vf", q: "Les femmes ont tendance à être plus sensibles à l'ocytocine, les hommes à la sérotonine.", correct: true, explain: "Une différence de sensibilité hormonale entre les sexes souvent évoquée." },
      { id: "bmo6", type: "vf", q: "Nous percevons environ 11 millions de bits d'information par seconde.", correct: true, explain: "Un flux énorme d'informations sensorielles à chaque instant." },
      { id: "bmo7", type: "qcm", q: "Avec combien d'unités d'information notre cerveau construirait-il sa représentation consciente de l'environnement ?", options: ["Environ 2000", "400 milliards", "11 millions", "40"], correct: 0, explain: "Un tri massif : de millions de bits à une poignée d'unités conscientes." },
      { id: "bmo9", type: "qcm", q: "Quelle proportion de nos décisions serait prise de manière inconsciente, avant même d'en avoir conscience ?", options: ["Environ 99,74%", "Environ 50%", "Environ 10%", "0%"], correct: 0, explain: "L'essentiel du traitement se ferait hors de la conscience." },
      { id: "bmo13", type: "qcm", q: "Quel serait le rôle principal du système limbique face à une information perçue ?", options: ["Lui affecter une valeur (\"bon pour moi ou pas\")", "Stocker les souvenirs à long terme", "Contrôler la respiration", "Gérer l'équilibre"], correct: 0, explain: "Le système limbique évalue si une information est favorable ou non." },
      { id: "bmo14", type: "qcm", q: "Quelle structure déclencherait la production de noradrénaline et de cortisol face à un \"danger\" perçu ?", options: ["L'amygdale", "Le cervelet", "Le lobe frontal", "L'hypophyse"], correct: 0, explain: "L'amygdale active la réponse d'alerte face à un danger perçu." },
      { id: "bmo16", type: "qcm", q: "Face à un danger perçu, quelles sont les 3 réponses instinctives les plus classiquement décrites ?", options: ["Fuir, combattre ou se figer", "Rire, pleurer ou crier", "Dormir, manger ou courir", "Parler, écrire ou dessiner"], correct: 0, explain: "Ce triptyque est souvent résumé par l'acronyme anglais FFF (Fly, Fight, Freeze)." },
      { id: "bmo17", type: "qcm", q: "Parmi les émotions \"positives\" associées chacune à un neurotransmetteur, laquelle correspond à la dopamine ?", options: ["La joie", "L'amour", "La fierté", "L'apaisement"], correct: 0, explain: "La dopamine est associée au plaisir et à la motivation." },
      { id: "bmo20", type: "vf", q: "L'ocytocine est décrite comme l'hormone de la confiance et du lien social.", correct: true, explain: "Elle favoriserait la confiance et le lien social." },
      { id: "bmo21", type: "qcm", q: "Quelle activité favoriserait particulièrement la production d'endorphines ?", options: ["Une activité physique de plus de 20 minutes", "Regarder la télévision", "Boire du café", "Consulter ses emails"], correct: 0, explain: "Le mouvement soutenu libérerait des endorphines apaisantes." },
      { id: "bmo42", type: "qcm", q: "La sérotonine serait décrite comme le neurotransmetteur…", options: ["De l'ego et de la reconnaissance", "De la douleur physique", "Du sommeil profond", "De la digestion"], correct: 0, explain: "Elle serait liée à l'estime de soi et à la reconnaissance." },
      { id: "bmo47", type: "qcm", q: "L'\"effet Benjamin Franklin\" décrit le fait que…", options: ["Demander de l'aide à quelqu'un peut le rendre plus favorable envers nous", "Rendre service rend toujours méfiant", "Refuser d'aider renforce la sympathie", "Il n'y aurait aucun effet mesurable"], correct: 0, explain: "Rendre service créerait un attachement positif envers la personne aidée." },
      { id: "bmo56", type: "qcm", q: "Quelle serait la différence entre estime de soi et confiance en soi ?", options: ["L'estime concerne la valeur perçue, la confiance les moyens de l'exprimer", "Ce sont deux termes strictement identiques", "La confiance en soi précéderait toujours l'estime de soi", "Il n'y aurait aucun rapport entre les deux notions"], correct: 0, explain: "L'estime concerne la valeur perçue, la confiance les moyens de l'exprimer." },
      { id: "neu1", type: "vf", q: "Le cerveau serait capable de se réorganiser et de créer de nouvelles connexions tout au long de la vie.", correct: true, explain: "C'est le principe de la neuroplasticité, plus marquée dans l'enfance mais jamais totalement absente." },
      { id: "neu2", type: "qcm", q: "Quelle zone du cerveau joue un rôle central dans la planification et la prise de décision ?", options: ["Le cortex préfrontal", "Le cervelet", "Le bulbe rachidien", "L'hypophyse"], correct: 0, explain: "C'est une région associée aux fonctions dites \"exécutives\"." },
      { id: "neu3", type: "qcm", q: "L'aire de Broca est principalement associée à…", options: ["La production du langage", "La vision", "L'équilibre", "La digestion"], correct: 0, explain: "Une lésion de cette zone peut entraîner des difficultés à produire des phrases." },
      { id: "neu4", type: "qcm", q: "L'aire de Wernicke est principalement associée à…", options: ["La compréhension du langage", "La mémoire à long terme", "Le contrôle moteur", "L'odorat"], correct: 0, explain: "Une lésion ici peut permettre de parler couramment mais avec un sens altéré." },
      { id: "neu5", type: "vf", q: "Les \"neurones miroirs\" s'activeraient aussi bien quand on agit que quand on observe quelqu'un d'autre faire la même action.", correct: true, explain: "Un mécanisme proposé pour expliquer en partie l'empathie et l'imitation." },
      { id: "neu6", type: "qcm", q: "Quelle structure est particulièrement associée au circuit de la récompense, avec la dopamine ?", options: ["Le noyau accumbens", "Le cervelet", "L'hypophyse", "Le thalamus"], correct: 0, explain: "Une structure clé du circuit dopaminergique de la motivation." },
      { id: "neu7", type: "qcm", q: "Quel est le principal neurotransmetteur inhibiteur, associé à un effet calmant ?", options: ["Le GABA", "Le glutamate", "La dopamine", "L'adrénaline"], correct: 0, explain: "Le GABA freine l'activité neuronale, à l'inverse du glutamate qui l'excite." },
      { id: "neu8", type: "qcm", q: "L'acétylcholine joue notamment un rôle dans…", options: ["La mémoire et la contraction musculaire", "La digestion uniquement", "La vision des couleurs", "La régulation de la température"], correct: 0, explain: "Un neurotransmetteur central aussi bien dans le cerveau qu'au niveau des muscles." },
      { id: "neu9", type: "qcm", q: "C'est surtout pendant quelle phase du sommeil que surviennent la plupart des rêves ?", options: ["Le sommeil paradoxal", "Le sommeil lent léger", "Le sommeil lent profond", "L'endormissement"], correct: 0, explain: "Le sommeil paradoxal se reconnaît à une activité cérébrale proche de l'éveil." },
      { id: "neu10", type: "vf", q: "La mélatonine, hormone favorisant le sommeil, est sécrétée en réponse à l'obscurité.", correct: true, explain: "La lumière, notamment celle des écrans le soir, en freine la sécrétion." },
      { id: "neu11", type: "qcm", q: "Le \"rythme circadien\" désigne…", options: ["Notre horloge biologique interne, cyclique sur environ 24h", "Le rythme cardiaque au repos", "La fréquence respiratoire moyenne", "Le cycle de digestion"], correct: 0, explain: "Une horloge interne qui régule sommeil, température et hormones." },
      { id: "neu12", type: "vf", q: "La barrière hémato-encéphalique protège le cerveau en filtrant certaines substances présentes dans le sang.", correct: true, explain: "Un filtre protecteur qui laisse passer certaines molécules et en bloque d'autres." },
      { id: "neu13", type: "vf", q: "Les cellules gliales, qui soutiennent et nourrissent les neurones, seraient au moins aussi nombreuses qu'eux dans le cerveau.", correct: true, explain: "Longtemps sous-estimé, leur rôle est aujourd'hui reconnu comme essentiel." },
      { id: "neu14", type: "qcm", q: "Le long d'un axone bien myélinisé, l'influx nerveux peut circuler jusqu'à environ…", options: ["100 mètres par seconde", "1 mètre par seconde", "1000 mètres par seconde", "1 centimètre par seconde"], correct: 0, explain: "La myéline accélère considérablement la vitesse de transmission." },
      { id: "neu15", type: "vf", q: "L'effet placebo peut produire des améliorations mesurables, et pas seulement une impression subjective.", correct: true, explain: "Des changements physiologiques réels ont été observés, liés à l'attente du soulagement." },
      { id: "neu16", type: "vf", q: "Il existerait une communication bidirectionnelle entre l'intestin et le cerveau, pouvant influencer l'humeur.", correct: true, explain: "C'est ce qu'on appelle l'axe intestin-cerveau, un domaine de recherche actif." },
      { id: "neu17", type: "vf", q: "Espacer les révisions dans le temps serait plus efficace pour mémoriser que de tout réviser d'un coup.", correct: true, explain: "C'est le principe de la répétition espacée, bien documenté en psychologie de l'apprentissage." },
      { id: "neu18", type: "qcm", q: "Le \"biais de négativité\" désigne la tendance à…", options: ["Accorder plus de poids aux informations négatives qu'aux positives", "Toujours voir le bon côté des choses", "Ignorer systématiquement les mauvaises nouvelles", "Ne jamais ressentir d'émotions négatives"], correct: 0, explain: "Une info négative marquerait davantage la mémoire qu'une info positive équivalente." },
      { id: "neu19", type: "qcm", q: "L'\"effet de simple exposition\" désigne le fait que…", options: ["Plus on est exposé à un stimulus, plus on tend à l'apprécier", "La première exposition est toujours la plus appréciée", "L'exposition répétée entraîne toujours du rejet", "Aucun effet n'est lié à la répétition"], correct: 0, explain: "La familiarité tendrait à générer de la préférence, même inconsciemment." },
      { id: "neu20", type: "qcm", q: "L'\"effet Dunning-Kruger\" décrit la tendance de certaines personnes peu compétentes dans un domaine à…", options: ["Surestimer leur propre compétence", "Sous-estimer systématiquement leur compétence", "Toujours demander de l'aide", "Ne jamais se prononcer"], correct: 0, explain: "Un manque de compétence peut aussi limiter la capacité à évaluer ce manque." },
      { id: "neu21", type: "qcm", q: "L'\"effet de halo\" désigne le fait qu'une qualité perçue positivement chez quelqu'un…", options: ["Influence favorablement le jugement porté sur ses autres qualités", "N'a aucune influence sur le reste du jugement", "Rend systématiquement méfiant", "Ne concerne que l'apparence physique"], correct: 0, explain: "Une bonne première impression \"déteint\" souvent sur le jugement global." },
      { id: "neu22", type: "qcm", q: "La \"dissonance cognitive\" désigne le malaise ressenti quand…", options: ["Nos actions entrent en contradiction avec nos croyances", "On prend une décision facile et cohérente", "On n'a aucune opinion sur un sujet", "On change d'avis sans raison"], correct: 0, explain: "Ce malaise pousserait souvent à ajuster ses croyances plutôt que ses actes déjà posés." },
      { id: "neu23", type: "qcm", q: "Le \"biais d'ancrage\" désigne le fait que…", options: ["La première information reçue influence excessivement le jugement qui suit", "Seule la dernière information compte", "Aucune information initiale n'a d'influence", "Le jugement est toujours parfaitement neutre"], correct: 0, explain: "Un premier chiffre ou une première impression sert souvent de référence, même arbitraire." },
      { id: "neu24", type: "vf", q: "Le \"multitâche\" ne serait pas un vrai traitement simultané, mais une alternance rapide entre tâches, coûteuse en efficacité.", correct: true, explain: "Le cerveau basculerait d'une tâche à l'autre plutôt que de les traiter en parallèle." },
      { id: "neu25", type: "vf", q: "Une pratique régulière de la méditation serait associée à des changements mesurables dans certaines zones du cerveau.", correct: true, explain: "Des études évoquent des changements au niveau du cortex préfrontal et de l'amygdale." },
      { id: "neu26", type: "vf", q: "L'ocytocine serait aussi libérée lors de contacts physiques affectueux comme les câlins.", correct: true, explain: "Elle est associée au lien social et à l'attachement, pas seulement à la confiance." },
      { id: "neu27", type: "vf", q: "Le taux de cortisol serait naturellement plus élevé le matin au réveil que le soir.", correct: true, explain: "C'est ce qu'on appelle la réponse du cortisol au réveil, qui aide à démarrer la journée." },
      { id: "neu28", type: "qcm", q: "Contrairement au stress chronique, un stress aigu et bref pourrait…", options: ["Améliorer temporairement la concentration", "Toujours nuire à la mémoire", "N'avoir strictement aucun effet", "Réduire durablement l'immunité"], correct: 0, explain: "À dose modérée et ponctuelle, le stress peut mobiliser l'attention." },
      { id: "neu29", type: "qcm", q: "L'état de \"flow\" décrit…", options: ["Une absorption totale dans une activité, avec perte de la notion du temps", "Un état de somnolence profonde", "Une distraction constante", "Un état d'ennui prolongé"], correct: 0, explain: "Un concept popularisé par le psychologue Mihaly Csikszentmihalyi." },
      { id: "neu30", type: "vf", q: "Le cortex préfrontal continuerait de se développer jusqu'à environ 25 ans.", correct: true, explain: "Cela expliquerait en partie une prise de risque plus marquée à l'adolescence." },
      { id: "neu31", type: "qcm", q: "Chez la plupart des droitiers, le langage est traité de façon prédominante par…", options: ["L'hémisphère gauche", "L'hémisphère droit", "Les deux hémisphères de façon parfaitement égale", "Aucun des deux, uniquement le cervelet"], correct: 0, explain: "Une vraie asymétrie fonctionnelle, à ne pas confondre avec le mythe \"cerveau créatif / rationnel\"." },
      { id: "neu32", type: "qcm", q: "Selon la loi de Yerkes-Dodson, la performance serait généralement meilleure…", options: ["À un niveau de stress modéré", "Avec un stress toujours le plus faible possible", "Avec un stress toujours le plus élevé possible", "Indépendamment du niveau de stress"], correct: 0, explain: "Trop peu de pression endort la motivation, trop de pression la sature." },
      { id: "neu33", type: "vf", q: "Pratiquer régulièrement la gratitude serait associé à des effets positifs mesurés sur le bien-être.", correct: true, explain: "Plusieurs études en psychologie positive vont dans ce sens." },
      { id: "neu34", type: "qcm", q: "Le \"système nerveux autonome\" se divise en deux branches complémentaires : le sympathique et…", options: ["Le parasympathique", "Le somatique", "Le périphérique", "Le central"], correct: 0, explain: "Le sympathique mobilise (alerte), le parasympathique apaise (repos et digestion)." },
      { id: "neu35", type: "vf", q: "Le nombre de connexions synaptiques serait à son maximum durant la petite enfance, avant un \"élagage\" progressif des moins utilisées.", correct: true, explain: "Ce phénomène, l'élagage synaptique, affine les circuits en fonction de l'expérience." },
      { id: "neu36", type: "qcm", q: "\"DOSE\" est un moyen mnémotechnique désignant les 4 grandes molécules du bien-être. Que signifie cet acronyme ?", options: ["Dopamine, Ocytocine, Sérotonine, Endorphine", "Douleur, Oxygène, Stress, Énergie", "Digestion, Œstrogène, Sommeil, Émotion", "Dépression, Obésité, Stress, Épuisement"], correct: 0, explain: "Quatre neurochimiques souvent associés aux mécanismes de motivation et de bien-être." },
      { id: "neu37", type: "qcm", q: "\"NORACORT\" est un moyen mnémotechnique qui désigne la réaction de stress, à partir de deux hormones. Lesquelles ?", options: ["Noradrénaline et cortisol", "Norépinéphrine et insuline", "Noradrénaline et mélatonine", "Cortisol et ocytocine"], correct: 0, explain: "Ces deux hormones sont au cœur de la réponse physiologique au stress." },
      { id: "neu38", type: "qcm", q: "Parmi les déclencheurs de la réponse de stress (NORACORT), on trouve notamment…", options: ["Le sentiment de perte de contrôle", "L'écoute active d'un proche", "La résolution d'un problème", "Le partage d'une ressource"], correct: 0, explain: "Perdre le sentiment de contrôle sur une situation est un déclencheur de stress classique." },
      { id: "neu39", type: "vf", q: "Parmi les déclencheurs de la réponse de stress, on retrouve les \"3 I\" : incohérence, incertitude et imprévisibilité.", correct: true, explain: "Trois facteurs qui, en rompant nos repères habituels, activent la réponse de stress." },
      { id: "neu40", type: "qcm", q: "Dans ce cadre, \"l'effort\" ressenti face à une tâche serait défini comme le rapport entre…", options: ["Les ressources disponibles et les ressources à fournir", "Le temps disponible et le temps nécessaire", "La motivation et la fatigue", "Le salaire et le nombre d'heures travaillées"], correct: 0, explain: "Plus l'écart entre ce qu'on a et ce qu'il faudrait fournir est grand, plus l'effort perçu est important." },
      { id: "neu41", type: "qcm", q: "L'\"aversivité à la perte\" désigne la tendance à…", options: ["Ressentir la perte de façon plus intense que le gain équivalent", "Rechercher activement les pertes", "Être totalement indifférent aux pertes", "Préférer perdre plutôt que gagner"], correct: 0, explain: "Une perte est généralement vécue de façon plus marquante qu'un gain de même ampleur." },
      { id: "neu42", type: "qcm", q: "La dopamine serait notamment produite en réaction à…", options: ["La récompense liée à l'atteinte d'un objectif", "Le contact physique rassurant", "Le fait d'être écouté activement", "La pratique d'une activité sportive douce"], correct: 0, explain: "Atteindre un objectif qu'on s'était fixé est un déclencheur classique de production de dopamine." },
      { id: "neu43", type: "qcm", q: "Parmi les déclencheurs de dopamine, on trouve la nouveauté et…", options: ["Le plaisir coupable", "Le partage de ressources", "L'écoute active", "Le rire partagé"], correct: 0, explain: "Un petit plaisir qu'on s'accorde, même en le sachant discutable, peut activer ce circuit." },
      { id: "neu44", type: "vf", q: "Éviter une situation aversive peut, en soi, déclencher une production de dopamine.", correct: true, explain: "Le simple fait de réussir à éviter un désagrément peut être vécu comme gratifiant." },
      { id: "neu45", type: "qcm", q: "L'ocytocine serait notamment libérée quand on a le sentiment de…", options: ["Faire partie d'un groupe", "Avoir atteint un objectif difficile", "Avoir évité un danger", "Avoir pris une décision seul"], correct: 0, explain: "Le sentiment d'appartenance à un groupe est un déclencheur classique de production d'ocytocine." },
      { id: "neu46", type: "vf", q: "Le contact physique favoriserait la production d'ocytocine, sauf s'il s'accompagne d'une rupture de cohérence.", correct: true, explain: "Un contact qui contredit ce qu'on attendait de la situation peut au contraire devenir source de stress." },
      { id: "neu47", type: "qcm", q: "\"Agir à plusieurs comme d'un seul\" (par exemple dans un travail d'équipe synchronisé) illustrerait un déclencheur…", options: ["D'ocytocine", "De cortisol", "D'adrénaline uniquement", "Aucun déclencheur particulier"], correct: 0, explain: "La coopération et l'action collective coordonnée sont associées à la production d'ocytocine." },
      { id: "neu48", type: "qcm", q: "Les endorphines seraient notamment libérées après…", options: ["Une pratique sportive", "Une décision purement administrative", "La lecture d'un contrat", "Un calcul mental simple"], correct: 0, explain: "L'activité physique est l'un des déclencheurs les plus connus de la libération d'endorphines." },
      { id: "neu49", type: "vf", q: "Une forte activation du système nerveux autonome sympathique (réaction de stress) pourrait être suivie d'une libération d'endorphines.", correct: true, explain: "Une sorte de \"retour au calme\" chimique après une activation intense du système de stress." },
      { id: "neu50", type: "qcm", q: "Rires et pleurs partagent un point commun neurochimique : ils seraient tous deux associés à une libération…", options: ["D'endorphines", "D'adrénaline uniquement", "D'insuline", "D'histamine"], correct: 0, explain: "Deux expressions émotionnelles très différentes, mais reliées au même mécanisme de libération d'endorphines." },
      { id: "neu51", type: "qcm", q: "La production de sérotonine serait liée à la reconnaissance. Laquelle de ces formes N'EN fait PAS partie ?", options: ["La reconnaissance anonyme et non attribuée", "La reconnaissance officielle", "La reconnaissance officieuse déclarative", "La reconnaissance officieuse non déclarative"], correct: 0, explain: "Les 3 formes retenues supposent toutes qu'on sache d'où vient la reconnaissance — contrairement à une reconnaissance anonyme." },
      { id: "neu52", type: "qcm", q: "Parmi les formes de revendication associées à la sérotonine, on trouve \"la déclaration\", \"le faire\" et…", options: ["La possession", "L'oubli", "Le refus", "L'attente"], correct: 0, explain: "Trois façons différentes de faire valoir sa valeur ou son statut : dire, agir, ou posséder." },
      { id: "neu53", type: "vf", q: "La production de sérotonine ne serait liée qu'à une reconnaissance strictement officielle, jamais informelle.", correct: false, explain: "Deux des trois formes retenues sont au contraire officieuses (déclarative ou non déclarative), pas seulement officielle." },
    ],
  },
  {
    id: "quiz-cnv", name: "Communication (CNV)", emoji: "🦒",
    questions: [
      { id: "cnv1", type: "qcm", q: "Les 4 étapes de la Communication Non Violente (Marshall Rosenberg) sont, dans l'ordre :", options: ["Observation, sentiment, besoin, demande", "Écoute, reproche, excuse, pardon", "Jugement, émotion, solution, accord", "Fait, opinion, conseil, décision"], correct: 0, explain: "Le processus OSBD : Observation, Sentiment, Besoin, Demande. 🧠 Mnémo : « On S'Bouge Doucement »." },
      { id: "cnv2", type: "qcm", q: "Laquelle de ces phrases est une OBSERVATION pure (sans jugement) ?", options: ["Hier, tu es rentré à 23 h.", "Tu rentres toujours trop tard.", "Tu te fiches de moi.", "Tu es irresponsable."], correct: 0, explain: "Une observation se filmerait avec une caméra : un fait daté, sans « toujours », sans interprétation. 🧠 Mnémo : « Si la caméra ne le voit pas, ce n'est pas une observation »." },
      { id: "cnv3", type: "vf", q: "« Tu ne m'écoutes jamais » est une observation.", correct: false, explain: "« Jamais » est une généralisation : c'est un jugement déguisé. Observer, ce serait : « Hier soir, pendant que je parlais, tu regardais ton téléphone »." },
      { id: "cnv4", type: "qcm", q: "Pour transformer « Tu es désordonné » en observation, on dirait plutôt :", options: ["« Il y a trois tasses et deux pulls sur la table du salon. »", "« Tu es vraiment bordélique. »", "« Tu pourrais faire un effort. »", "« Tu fais exprès de tout laisser traîner. »"], correct: 0, explain: "On décrit ce qu'on voit, pas ce qu'on pense de la personne." },
      { id: "cnv5", type: "vf", q: "Dire « tu es toujours en retard » ou « tu es en retard » est sans risque, car c'est un simple constat.", correct: false, explain: "« Toujours » et « être en retard » (étiquette) évaluent la personne. Observer : « Ce soir, tu es arrivé à 20 h 30 pour un rendez-vous à 20 h »." },
      { id: "cnv6", type: "qcm", q: "Laquelle de ces phrases exprime un vrai SENTIMENT ?", options: ["Je me sens triste.", "Je me sens incompris.", "Je me sens rejeté.", "Je me sens manipulé."], correct: 0, explain: "« Incompris », « rejeté », « manipulé » contiennent une accusation sur l'autre : ce sont des faux sentiments. « Triste » décrit seulement ce qui se passe en moi." },
      { id: "cnv7", type: "vf", q: "« Je me sens abandonné » est un sentiment au sens de la CNV.", correct: false, explain: "« Abandonné » suppose que quelqu'un m'a abandonné : c'est une interprétation de son acte. Le vrai sentiment dessous peut être la tristesse, la peur, la solitude." },
      { id: "cnv8", type: "qcm", q: "Quelle formulation exprime un sentiment sans accuser ?", options: ["« Je suis inquiet. »", "« Je me sens trahi. »", "« Je me sens ignoré. »", "« Je me sens utilisé. »"], correct: 0, explain: "Astuce : si on peut remplacer « je me sens » par « je pense que tu… », ce n'est pas un sentiment. 🧠 Mnémo : « Je me sens + adjectif sur MOI »." },
      { id: "cnv9", type: "vf", q: "Dans la CNV, mes sentiments sont causés par les actes de l'autre.", correct: false, explain: "Le comportement de l'autre est un STIMULUS ; la cause, c'est mon besoin satisfait ou non. Cela permet d'assumer ses émotions sans accuser." },
      { id: "cnv10", type: "qcm", q: "Selon la CNV, quelle est la cause profonde d'un sentiment de colère ?", options: ["Un besoin non satisfait", "Le comportement de l'autre", "Un mauvais caractère", "Un manque de maîtrise de soi"], correct: 0, explain: "Derrière chaque sentiment, il y a un besoin comblé (joie) ou non comblé (colère, tristesse...). 🧠 Mnémo : « Sous l'émotion, le besoin »." },
      { id: "cnv11", type: "qcm", q: "Lequel de ces éléments est un BESOIN (et non une stratégie) ?", options: ["Le repos", "Que tu ranges la cuisine", "Partir en week-end", "Que tu me rappelles"], correct: 0, explain: "Un besoin est universel et ne dépend d'aucune personne, lieu ou moment. Ranger, partir, rappeler = stratégies pour y répondre." },
      { id: "cnv12", type: "vf", q: "« J'ai besoin que tu m'aides à la vaisselle » exprime un besoin au sens de la CNV.", correct: false, explain: "C'est une stratégie : elle mentionne une personne et une action. Le besoin sous-jacent peut être le soutien, la coopération ou le repos." },
      { id: "cnv13", type: "qcm", q: "Pourquoi distinguer besoin et stratégie ?", options: ["Un besoin peut être satisfait de mille façons, une stratégie est souvent source de conflit", "Parce que les stratégies sont toujours mauvaises", "Parce que les besoins sont secrets", "Parce que les besoins ne s'expriment pas"], correct: 0, explain: "On peut s'accorder sur les besoins même quand on se dispute sur les stratégies. 🧠 Mnémo : « Besoin = pourquoi, stratégie = comment »." },
      { id: "cnv14", type: "qcm", q: "« J'ai besoin de calme » : que peut-on dire de cette phrase ?", options: ["C'est un vrai besoin, universel", "C'est une stratégie", "C'est une exigence", "C'est un jugement"], correct: 0, explain: "Le calme (comme le repos, la sécurité, la reconnaissance, l'autonomie) est un besoin universel que chacun partage." },
      { id: "cnv15", type: "qcm", q: "Laquelle de ces phrases est une DEMANDE de la CNV ?", options: ["« Peux-tu me dire ce que tu as compris de ce que je viens de dire ? »", "« Sois plus attentif. »", "« Arrête de m'interrompre ! »", "« Fais un effort un jour. »"], correct: 0, explain: "Une demande est concrète, positive (ce que je veux, pas ce que je ne veux pas), réalisable, au présent. 🧠 Mnémo : « Concret, positif, possible, maintenant »." },
      { id: "cnv16", type: "vf", q: "Une bonne demande formule ce que l'on veut, pas ce que l'on ne veut pas.", correct: true, explain: "« Arrête de crier » dit ce qu'on ne veut pas ; « Peux-tu parler plus doucement ? » dit ce qu'on veut." },
      { id: "cnv17", type: "qcm", q: "Comment reconnaît-on une EXIGENCE déguisée en demande ?", options: ["Quand un « non » provoque reproche, culpabilisation ou punition", "Quand elle est polie", "Quand elle est courte", "Quand elle est écrite"], correct: 0, explain: "Si l'autre craint de dire non, c'est une exigence. Une vraie demande accepte un refus et écoute le besoin derrière. 🧠 Mnémo : « Demande = non possible »." },
      { id: "cnv18", type: "qcm", q: "Laquelle de ces demandes est la plus claire ?", options: ["« Peux-tu éteindre la télé à 22 h ce soir ? »", "« Sois plus respectueux. »", "« Respecte-moi un peu. »", "« Ce serait bien que tu penses à moi. »"], correct: 0, explain: "Précise, datée et faisable. « Sois plus respectueux » est un vœu vague, pas une action observable." },
      { id: "cnv19", type: "vf", q: "Après avoir exprimé une demande, on peut aussi demander à l'autre de reformuler ce qu'il a compris.", correct: true, explain: "C'est une « demande de connexion » : vérifier que le message est passé avant de passer à l'action." },
      { id: "cnv20", type: "qcm", q: "Quel est le principe de l'empathie en CNV ?", options: ["Écouter les sentiments et besoins de l'autre, sans conseiller ni analyser", "Donner des conseils pour résoudre son problème", "Lui dire que ça pourrait être pire", "Lui raconter une expérience similaire"], correct: 0, explain: "L'empathie est une présence : on accueille, sans rien ajouter. 🧠 Mnémo : « Écouter pour entendre, pas pour répondre »." },
      { id: "cnv21", type: "qcm", q: "Magali dit : « J'ai eu une journée horrible ». Laquelle de ces réponses est empathique ?", options: ["« Tu t'es senti(e) épuisé(e) et tu aurais voulu de la tranquillité ? »", "« Moi, j'ai eu pire hier. »", "« Tu devrais prendre un bain chaud. »", "« Ce n'est pas si grave. »"], correct: 0, explain: "Reformuler sentiment + besoin. Les autres sont des réflexes non empathiques : comparer, conseiller, minimiser." },
      { id: "cnv22", type: "vf", q: "Conseiller (« À ta place, je ferais ça ») est une façon d'être empathique.", correct: false, explain: "Conseiller, consoler, minimiser, enquêter, expliquer... font partie des réflexes qui coupent l'empathie. Écouter d'abord, conseiller seulement si on te le demande." },
      { id: "cnv23", type: "qcm", q: "Parmi ces réponses, laquelle COUPE l'empathie ?", options: ["« Ne t'en fais pas, ça va s'arranger. »", "« Tu te sens découragé ? »", "« Tu as besoin de soutien ? »", "« Veux-tu m'en dire plus ? »"], correct: 0, explain: "Consoler trop vite empêche la personne de se sentir entendue. Les autres réponses accueillent ce qu'elle vit." },
      { id: "cnv24", type: "vf", q: "Se taire et rester présent peut être une forme d'empathie.", correct: true, explain: "L'empathie n'est pas une technique verbale : c'est la qualité de présence. Parfois un silence attentif vaut mieux que mille reformulations." },
      { id: "cnv25", type: "qcm", q: "Dans l'image de Rosenberg, que représentent la girafe et le chacal ?", options: ["La girafe : langage du cœur (CNV) ; le chacal : langage du jugement", "La girafe : la colère ; le chacal : la joie", "La girafe : le travail ; le chacal : le repos", "La girafe : les hommes ; le chacal : les femmes"], correct: 0, explain: "La girafe a le plus grand cœur des animaux terrestres ; le chacal juge, reproche, critique. Il y a un chacal en chacun de nous : on ne le chasse pas, on l'écoute." },
      { id: "cnv26", type: "vf", q: "Le chacal intérieur est un ennemi qu'il faut faire taire.", correct: false, explain: "Même le chacal exprime un besoin non satisfait. On l'écoute avec bienveillance pour traduire son jugement en besoin (auto-empathie)." },
      { id: "cnv27", type: "qcm", q: "Face à un reproche reçu, que propose la CNV en premier ?", options: ["Se demander quels besoins se cachent derrière", "Se justifier tout de suite", "Contre-attaquer", "Quitter la pièce"], correct: 0, explain: "Entendre le besoin derrière le reproche désamorce la tension. Quatre options existent : se blâmer, blâmer l'autre, écouter ses propres sentiments/besoins, écouter ceux de l'autre." },
      { id: "cnv28", type: "qcm", q: "Quelle est la différence entre « me blâmer » et « m'auto-empathiser » ?", options: ["Me blâmer = « je suis nul » ; auto-empathie = « je suis triste, j'avais besoin de bien faire »", "Aucune différence", "L'auto-empathie consiste à se trouver des excuses", "Me blâmer est plus honnête"], correct: 0, explain: "L'auto-empathie reconnaît ses sentiments et besoins sans se condamner : on peut regretter un acte sans se juger comme personne." },
      { id: "cnv29", type: "qcm", q: "Pour Rosenberg, la colère est avant tout :", options: ["Un signal qu'un besoin n'est pas satisfait, alimenté par une pensée de reproche", "Un défaut de caractère", "Une preuve que l'autre a tort", "Un sentiment à réprimer"], correct: 0, explain: "La colère naît des pensées « il/elle devrait… ». Derrière : un besoin. Marche à suivre : 1) stop, 2) respirer, 3) identifier la pensée, 4) relier au besoin, 5) exprimer en OSBD. 🧠 Mnémo : « Colère = besoin qui crie »." },
      { id: "cnv30", type: "qcm", q: "En CNV, un remerciement authentique contient :", options: ["Ce que l'autre a fait, ce que je ressens et le besoin comblé", "Un compliment sur la personne", "Un « bravo » général", "Une demande cachée"], correct: 0, explain: "« Quand tu as préparé le dîner (action), j'étais soulagé (sentiment) : j'avais besoin de repos (besoin) ». Pas un jugement positif, mais un partage de ce que l'acte a rendu possible." },
      { id: "cnv31", type: "vf", q: "Dire « tu es génial » est de la gratitude au sens de la CNV.", correct: false, explain: "C'est un jugement positif, une étiquette sur la personne. La gratitude CNV décrit l'acte précis, l'émotion et le besoin comblé." },
      { id: "cnv32", type: "qcm", q: "Parmi ces expressions, laquelle est un « langage aliénant » (qui nie la responsabilité) ?", options: ["« Je suis obligé de le faire. »", "« J'ai choisi de le faire parce que… »", "« J'ai envie de… »", "« Je préfère… »"], correct: 0, explain: "« Je dois », « il faut », « je suis obligé » masquent le choix. Remplacer par « je choisis de… parce que j'ai besoin de… ». 🧠 Mnémo : « Remplace « il faut » par « je choisis » »." },
      { id: "cnv33", type: "vf", q: "Le mot « devoir » (« tu dois », « il faut ») est un des langages qui nient la liberté de choix.", correct: true, explain: "Il existe aussi la comparaison, les jugements moralisants, le déni de responsabilité (« c'est la faute à… ») et les exigences." },
      { id: "cnv34", type: "qcm", q: "« Il m'a fait enrager » est un exemple de :", options: ["Déni de responsabilité", "Observation", "Demande", "Besoin"], correct: 0, explain: "Je rends l'autre responsable de ma colère. En CNV : « Quand il a dit cela, j'ai ressenti de la colère car j'avais besoin de respect »." },
      { id: "cnv35", type: "qcm", q: "Quand la CNV autorise-t-elle la force ?", options: ["Quand elle est protectrice (éviter un danger), sans intention de punir", "Quand l'autre a tort", "Quand on a déjà tout essayé", "Jamais, en aucun cas"], correct: 0, explain: "La force protectrice empêche un dommage (arracher un enfant à la route) ; la force punitive vise à faire souffrir pour « apprendre une leçon »." },
      { id: "cnv36", type: "vf", q: "Punir un enfant le fait agir par désir sincère de contribuer à la vie de la famille.", correct: false, explain: "La punition amène l'obéissance par peur ou culpabilité. Rosenberg préfère que chacun agisse « par compassion », non par crainte de la sanction ni espoir de récompense." },
      { id: "cnv37", type: "qcm", q: "En situation de conflit, que recommande Rosenberg avant de chercher une solution ?", options: ["Que chacun exprime ses besoins et entende ceux de l'autre", "Désigner un coupable", "Trouver un compromis rapide", "Faire appel à un arbitre"], correct: 0, explain: "On dissout le conflit en se reliant d'abord aux besoins de chacun ; les solutions surgissent ensuite. 🧠 Mnémo : « Besoins d'abord, stratégies ensuite »." },
      { id: "cnv38", type: "qcm", q: "Un compromis où chacun cède à contre-cœur est :", options: ["Insatisfaisant en CNV : on cherche une solution qui répond aux besoins de tous", "L'objectif ultime", "Toujours préférable", "Une victoire"], correct: 0, explain: "La CNV cherche une solution où les besoins de chacun sont honorés, pas un partage de la frustration." },
      { id: "cnv39", type: "qcm", q: "Pour accueillir un « non » de l'autre, en CNV, on :", options: ["Entend le besoin que ce « non » protège", "Insiste jusqu'à ce qu'il cède", "Le prend comme un rejet personnel", "Fait la tête"], correct: 0, explain: "Derrière un « non » il y a un « oui » à un autre besoin. L'entendre ouvre la recherche d'une autre stratégie. 🧠 Mnémo : « Tout non cache un oui »." },
      { id: "cnv40", type: "vf", q: "Dire « non » de façon claire et bienveillante est compatible avec la CNV.", correct: true, explain: "Dire non, c'est dire oui à un autre besoin. On peut refuser tout en exprimant de l'empathie pour la demande reçue : « Je voudrais t'aider mais j'ai besoin de repos ce soir »." },
    ],
  },

];


const DEFAULT_GIG_ROLES = ["DJ", "Musicien", "Technicien"];

const CHECKLIST_EMOJIS = ["📋","🎪","🧳","🛒","🎒","🧰","🍳","🎸","🏕️","📦","🧼","🎁",
  "🥞","💿","🎧","🎛️","🎤","🎨","📸","🧴","👕","🧦","🔧","🔌","🪑","🧹","🚗","✈️","🏠","🌱",
  "🎯","📚","💡","🗝️","🧯","🩺"];

const DEFI_LIBRARY = [
  { id: "d-parole", text: "Être impeccable dans ma parole" },
  { id: "d-perso", text: "Ne rien prendre personnellement" },
  { id: "d-suppos", text: "Ne pas faire de suppositions" },
  { id: "d-mieux", text: "Faire de mon mieux aujourd'hui" },
  { id: "d-sourire", text: "Sourire à un inconnu" },
  { id: "d-ecoute", text: "Être pleinement à l'écoute" },
  { id: "d-merci", text: "Dire merci 3 fois sincèrement" },
  { id: "d-present", text: "Rester présent dans chaque échange" },
  { id: "d-phone", text: "Poser le téléphone pendant un repas" },
  { id: "d-respire", text: "Respirer avant de répondre" },
  { id: "d-gentil", text: "Dire une chose gentille à quelqu'un" },
  { id: "d-plainte", text: "Ne pas me plaindre pendant 1h" },
  { id: "d-accueil", text: "Accueillir ce qui est, sans résistance" },
  { id: "d-amour", text: "Agir depuis l'amour plutôt que la peur" },
  { id: "d-gratitude", text: "Trouver 3 raisons d'être reconnaissant" },
  { id: "d-lacher", text: "Lâcher une pensée qui m'alourdit" },
];
// 4 picked by default each morning (by day index to be stable across refresh)
function hashStr(s) {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return hash;
}
function defaultDefiIds(dateISO) {
  let hash = 0;
  for (let i = 0; i < dateISO.length; i++) hash = (hash * 31 + dateISO.charCodeAt(i)) >>> 0;
  const ids = DEFI_LIBRARY.map((d) => d.id);
  const picked = [];
  for (let i = 0; i < 4; i++) {
    picked.push(ids[(hash + i * 7) % ids.length]);
  }
  // deduplicate
  return [...new Set(picked)].slice(0, 4);
}

const defaultData = () => {
  return {
    themes: [
      { id: "th-musique", name: "Musique", color: "#8B5CF6" },
      { id: "th-korrigan", name: "Korrigan", color: "#E879F9" },
      { id: "th-cercle", name: "Cercle de la Paix", color: "#818CF8" },
      { id: "th-perso", name: "Perso", color: "#A78BFA" },
    ],
    tasks: [],
    equipment: [],
    equipmentRubriques: [],
    checklists: [],
    defiLibrary: DEFI_LIBRARY.map((d) => ({ ...d })),
    dailyDefi: null, // { date, selectedIds, checks: {id: count}, review }
    quizzes: QUIZ_LIBRARY.map((t) => ({ ...t, questions: t.questions.map((q) => ({ ...q })) })),
    quizSeenLog: {},
    quizDaily: null,
    settings: { soundEnabled: true, sound: { ...SOUND_DEFAULT_SETTINGS } },
  };
};

function formatTotal(minutes) {
  if (minutes === 0) return "0h00";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

// Saints du calendrier français (civil/catholique), indexés par [mois-1][jour-1]
const SAINTS = [
  ["Marie","Basile","Geneviève","Odilon","Édouard","Melchior","Raymond","Lucien","Alix","Guillaume","Paulin","Tatiana","Yvette","Nina","Rémi","Marcel","Roseline","Prisca","Marius","Sébastien","Agnès","Vincent","Barnard","François de Sales","Conversion de Paul","Timothée","Angèle","Thomas d'Aquin","Gildas","Martine","Marcelle"],
  ["Ella","Présentation","Blaise","Véronique","Agathe","Gaston","Eugénie","Jacqueline","Apolline","Arnaud","N-D de Lourdes","Félix","Béatrice","Valentin","Claude","Julienne","Alexis","Bernadette","Gabin","Aimée","Damien","Isabelle","Lazare","Modeste","Roméo","Nestor","Honorine","Romain","Auguste","—"],
  ["Aubin","Charles le Bon","Guénolé","Casimir","Olive","Colette","Félicité","Jean de Dieu","Françoise","Vivien","Rosine","Justine","Rodrigue","Mathilde","Louise","Bénédicte","Patrick","Cyrille","Joseph","Herbert","Clémence","Léa","Victorien","Chloé","Annonciation","Larissa","Habib","Gontran","Gwladys","Amédée","Benjamin"],
  ["Hugues","Sandrine","Richard","Isidore","Irène","Marcellin","J-B de la Salle","Julie","Gautier","Fulbert","Stanislas","Jules","Ida","Maxime","Paterne","Benoît-Joseph","Anicet","Parfait","Emma","Odette","Anselme","Alexandre","Georges","Fidèle","Marc","Alida","Zita","Valérie","Catherine de Sienne","Robert","—"],
  ["Joseph ouvrier","Boris","Philippe","Sylvain","Judith","Prudence","Gisèle","Victoire","Pacôme","Solange","Estelle","Achille","Rolande","Matthias","Denise","Honoré","Pascal","Éric","Yves","Bernardin","Constantin","Émile","Didier","Donatien","Sophie","Bérenger","Augustin de Cantorbéry","Germain","Aymar","Ferdinand","Visitation"],
  ["Justin","Blandine","Kévin","Clotilde","Igor","Norbert","Gilbert","Médard","Diane","Landry","Barnabé","Guy","Antoine de Padoue","Élisée","Germaine","J-F Régis","Hervé","Léonce","Romuald","Silvère","Rodolphe","Alban","Audrey","Jean-Baptiste","Prosper","Anthelme","Fernand","Irénée","Pierre & Paul","Martial","—"],
  ["Thierry","Martinien","Thomas","Florent","Antoine","Mariette","Raoul","Thibaut","Amandine","Ulrich","Benoît","Olivier","Henri","Fête Nationale","Donald","N-D du Carmel","Charlotte","Frédéric","Arsène","Marina","Victor","Marie-Madeleine","Brigitte","Christine","Jacques","Anne & Joachim","Nathalie","Samson","Marthe","Juliette","Ignace de Loyola"],
  ["Alphonse","Julien Eymard","Lydie","Jean-Marie Vianney","Abel","Transfiguration","Gaétan","Dominique","Amour","Laurent","Claire","Clarisse","Hippolyte","Evrard","Assomption","Armel","Hyacinthe","Hélène","Jean-Eudes","Bernard","Christophe","Fabrice","Rose de Lima","Barthélemy","Louis","Natacha","Monique","Augustin","Sabine","Fiacre","Aristide"],
  ["Gilles","Ingrid","Grégoire","Rosalie","Raïssa","Bertrand","Reine","Adrien","Alain","Inès","Adelphe","Apollinaire","Aimé","Sainte-Croix","Roland","Edith","Renaud","Nadège","Émilie","Davy","Matthieu","Maurice","Constance","Thècle","Hermann","Côme & Damien","Vincentième","Venceslas","Michel","Jérôme","—"],
  ["Thérèse","Léger","Gérard","François d'Assise","Flora","Bruno","Serge","Pélagie","Denis","Ghislain","Firmin","Wilfrid","Géraud","Juste","Thérèse d'Avila","Edwige","Baudouin","Luc","René","Adeline","Céline","Élodie","Jean de Capistran","Florentin","Crépin","Dimitri","Émeline","Simon","Narcisse","Bienheureuse","Quentin"],
  ["Toussaint","Défunts","Hubert","Charles","Sylvie","Bertille","Carine","Geoffrey","Théodore","Léon","Armistice / Martin","Christian","Brice","Sidoine","Albert","Marguerite","Élisabeth","Aude","Tanguy","Edmond","Présentation","Cécile","Clément","Flora","Catherine","Delphine","Sévrin","Jacques de la Marche","Saturnin","André","—"],
  ["Florence","Viviane","François-Xavier","Barbara","Gérald","Nicolas","Ambroise","Immaculée Conception","Pierre Fourier","Romaric","Daniel","Jeanne de Chantal","Lucie","Odile","Ninon","Alice","Gaël","Gatien","Urbain","Abraham","Pierre Canisius","Françoise-Xavière","Armand","Adèle","Noël","Étienne","Jean","Innocents","David","Roger","Sylvestre"],
];
// Prénoms féminins fréquents du calendrier → "Ste", sinon "St".
// Les entrées spéciales (fêtes, N-D…) ne prennent pas de préfixe.
const SAINTES_FEM = new Set([
  "Marie","Geneviève","Odile","Alix","Tatiana","Yvette","Nina","Roseline","Prisca","Agnès","Martine","Marcelle",
  "Ella","Véronique","Agathe","Eugénie","Jacqueline","Apolline","Béatrice","Julienne","Bernadette","Aimée","Isabelle","Honorine",
  "Olive","Colette","Félicité","Françoise","Rosine","Justine","Mathilde","Louise","Bénédicte","Clémence","Léa","Chloé","Larissa","Gwladys",
  "Alice","Ida","Irène","Anastasie","Rita","Zita","Sandrine","Prudence","Gisèle","Sophie","Solange","Estelle","Judith","Clotilde","Blandine",
  "Diane","Aline","Gaëlle","Élise","Léonie","Marina","Fabiola","Blanche","Elsa","Édith","Delphine","Adèle","Emma","Clarisse","Julie","Anne",
  "Rosalie","Ingrid","Nadège","Bertille","Inès","Marguerite","Mélanie","Reine","Rosine","Nadia","Solène","Aude","Émilie","Ghislaine","Thérèse",
  "Justine","Pélagie","Édwige","Adeline","Céline","Geneviève","Aurélie","Léonard","Bénigne","Élisabeth","Cécile","Flora","Catherine","Delphine",
  "Barbara","Ninon","Fabienne","Lucie","Odile","Ninette","Gaby","Florence","Alice","Nina","Léa","Séverine","Elfriede","Adèle","Sabine"
]);
function saintDuJour(date) {
  const d = date || new Date();
  const m = d.getMonth();
  const j = d.getDate() - 1;
  const name = SAINTS[m]?.[j];
  if (!name || name === "—") return null;
  // Entrées spéciales sans préfixe
  if (/^(N-D|Notre|Présentation|Conversion|Annonciation|Assomption|Toussaint|Nativité|Épiphanie|Ascension|Pentecôte|Rameaux|Immaculée|Sacré)/i.test(name)) return name;
  const first = name.split(" ")[0];
  const prefix = SAINTES_FEM.has(first) || /(e|a|ette|ine|elle)$/.test(first) ? "Ste" : "St";
  return `${prefix} ${name}`;
}

// ── Système de points ────────────────────────────────────────────────────────

const MEDAL_LEVELS = [
  { label: "Bronze",    emoji: "🥉", min: 0,    color: "#CD7F32" },
  { label: "Argent",    emoji: "🥈", min: 100,  color: "#A0A0A0" },
  { label: "Or",        emoji: "🥇", min: 300,  color: "#FFD700" },
  { label: "Améthyste", emoji: "💜", min: 700,  color: "#9F5BE8" },
  { label: "Légende",   emoji: "🌈", min: 1500, color: "#FF6B9E" },
];
function medalFor(totalPoints) {
  return [...MEDAL_LEVELS].reverse().find((m) => totalPoints >= m.min) || MEDAL_LEVELS[0];
}

// ── Système de niveaux (paliers de points totaux, noms thématiques dragon) ──
const LEVEL_TIERS = [
  { level: 1, min: 0,    name: "Œuf de Dragon",  reward: "Éclosion" },
  { level: 2, min: 250,  name: "Draconnet",      reward: "Curieux" },
  { level: 3, min: 500,  name: "Jeune Drake",    reward: "Aventurier" },
  { level: 4, min: 750,  name: "Drake Motivé",   reward: "Explorateur" },
  { level: 5, min: 1000, name: "Dragon Éveillé", reward: "Gardien" },
  { level: 6, min: 1500, name: "Dragon Ancien",  reward: "Sage" },
  { level: 7, min: 2200, name: "Dragon Céleste", reward: "Légende" },
  { level: 8, min: 3000, name: "Dragon Cosmique",reward: "Mythe" },
];
function levelFor(totalPoints) {
  const pts = totalPoints || 0;
  const current = [...LEVEL_TIERS].reverse().find((t) => pts >= t.min) || LEVEL_TIERS[0];
  const next = LEVEL_TIERS.find((t) => t.min > pts) || null;
  const prevMin = current.min;
  const nextMin = next ? next.min : current.min;
  const span = nextMin - prevMin || 1;
  const progressInLevel = next ? Math.round(((pts - prevMin) / span) * 100) : 100;
  const ptsToNext = next ? next.min - pts : 0;
  return { ...current, next, progressInLevel, ptsToNext, nextName: next?.name, nextReward: next?.reward, nextMin };
}

function pointsForTask(task) {
  if (task.done === false) return 0;
  // Points personnalisés prioritaires
  if (typeof task.points === "number") return task.points;
  // Sinon : tâche brève = 5 pts, sinon 10 pts par tranche de 15 min
  const dur = typeof task.duration === "number" ? task.duration : 15;
  if (dur <= 1) return 5; // brève
  return Math.max(5, Math.ceil(dur / 15) * 10);
}
function pointsForRitual() { return 5; }
function pointsForDefi(count) { return Math.min(count, 5) <= 1 ? 5 : Math.min(count, 5) <= 3 ? 10 : 15; }

function todayLabel() {
  const d = new Date();
  const s = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- date helpers (date-only, YYYY-MM-DD strings, always LOCAL calendar date) ---
function localISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function todayISODate() {
  // La "journée" logique commence à 3h du matin, pas à minuit : entre 00h00 et 02h59,
  // on considère qu'on est encore "hier" (évite une remise à zéro prématurée en pleine nuit).
  const d = new Date();
  d.setHours(d.getHours() - 3);
  return localISODate(d);
}
// Nombre de jours entiers écoulés depuis une date ISO (ou un timestamp ISO complet).
function daysSinceISO(iso) {
  const d = new Date(iso.length > 10 ? iso : iso + "T00:00:00");
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISODate(d);
}
function isoShift(iso, delta) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return localISODate(d);
}
// Une série reste "vivante" tant qu'au moins 8 des 10 derniers jours sont actifs —
// plus tolérant qu'une suite strictement consécutive (un jour manqué ne casse pas tout).
function tolerantStreakLength(isActiveFn, uptoISO) {
  let length = 0;
  let cursor = uptoISO;
  while (isActiveFn(cursor)) {
    length++;
    let activeInWindow = 0;
    for (let i = 0; i < 10; i++) { if (isActiveFn(isoShift(cursor, -i))) activeInWindow++; }
    if (activeInWindow < 8) break;
    cursor = isoShift(cursor, -1);
  }
  return length;
}
function addMonthsISO(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return localISODate(d);
}
function addDaysFromISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localISODate(d);
}
function addMonthsFromISO(iso, months) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return localISODate(d);
}
function formatDateFr(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function nextRecurrenceDate(recurrence) {
  if (recurrence === "daily") return addDaysISO(1);
  if (recurrence === "weekly") return addDaysISO(7);
  if (recurrence === "monthly") return addMonthsISO(1);
  return null;
}
function durationLabel(duration) {
  if (duration === null) return "brève";
  if (duration === "indeterminee" || duration === 0) return "Brève";
  return `${duration} min`;
}
function relativeDateLabel(iso) {
  const today = todayISODate();
  if (iso === today) return "aujourd'hui";
  if (iso === addDaysISO(1)) return "demain";
  return formatDateFr(iso);
}
function agendaDateHeader(iso) {
  const today = todayISODate();
  if (iso < today) return "En retard";
  if (iso === today) return "Aujourd'hui";
  if (iso === addDaysISO(1)) return "Demain";
  const d = new Date(iso + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
function agendaAnchorDate(t) {
  return t.dueDate || t.startDate || t.postponedTo || null;
}
// Unlike agendaAnchorDate (a single sort/group key), this checks whether a
// task is "active" on a given day — true for every day within a multi-day
// event's start→end span, not just its first day.
function taskCoversDate(t, iso) {
  if (t.dueDate === iso) return true;
  if (t.startDate) {
    const end = t.endDate || t.startDate;
    if (t.startDate <= iso && iso <= end) return true;
  }
  if (t.postponedTo === iso) return true;
  return false;
}
const RECURRENCE_LABELS = { daily: "Quotidienne", weekly: "Hebdomadaire", monthly: "Mensuelle" };

// ══════════════════════════════════════════════════════════════════
// PROFIL & ENVIRONNEMENTS — phrases contextuelles selon le choix
// ══════════════════════════════════════════════════════════════════
const ENVIRONMENTS = [
  { id: "motivation",   label: "Motivation",      emoji: "⚡" },
  { id: "nature",       label: "Nature",           emoji: "🌿" },
  { id: "spiritualite", label: "Spiritualité",     emoji: "🕊️" },
  { id: "invisible",    label: "Monde invisible",  emoji: "✨" },
  { id: "philosophie",  label: "Philosophie",      emoji: "📖" },
  { id: "douceur",      label: "Douceur",          emoji: "🤍" },
  { id: "toutes",       label: "Toutes",           emoji: "🎲" },
];

const PHRASES_BY_ENV = {
  motivation: [
    "Un pas aujourd'hui vaut mieux que dix demain.",
    "La constance bat l'intensité.",
    "Commence, même petit. Surtout petit.",
    "Ce que tu répètes devient ce que tu es.",
    "L'élan naît du mouvement, pas de l'attente.",
    "Chaque case cochée est une promesse tenue.",
    "Tu n'as pas besoin d'être prêt, juste de commencer.",
    "Le progrès aime les journées ordinaires.",
    "Fais-le mal plutôt que pas du tout.",
    "Ta discipline d'aujourd'hui est ta liberté de demain.",
  ],
  nature: [
    "L'arbre ne se presse pas, et pourtant tout s'accomplit.",
    "Chaque saison a sa raison d'être.",
    "La graine ne voit pas la fleur, elle pousse quand même.",
    "Le fleuve creuse la roche par sa constance, pas sa force.",
    "Rien dans la nature ne fleurit toute l'année.",
    "Prends le rythme des saisons, pas celui des horloges.",
    "Ce qui pousse lentement pousse profond.",
    "Le vent ne demande pas la permission de tourner.",
    "Après l'hiver, toujours le printemps.",
    "La forêt pousse dans le silence.",
  ],
  spiritualite: [
    "Le calme n'est pas l'absence de tempête, mais la paix en son cœur.",
    "Ce que tu cherches te cherche aussi.",
    "Le silence est une réponse.",
    "Sois présent, c'est le seul endroit où la vie existe.",
    "Lâcher prise n'est pas abandonner, c'est faire confiance.",
    "La gratitude transforme ce que l'on a en assez.",
    "Chaque respiration est un recommencement.",
    "Ce qui vient à toi est à ta mesure.",
    "L'âme n'a pas de calendrier.",
    "Fais de ta journée une prière en mouvement.",
  ],
  invisible: [
    "Les coïncidences sont des clins d'œil du destin.",
    "Ce que tu ne vois pas travaille pour toi.",
    "Écoute les signes, ils parlent bas.",
    "L'intuition sait avant que tu comprennes.",
    "Il y a plus de choses au ciel et sur la terre...",
    "Le monde répond à ce que tu émets.",
    "Ta vibration attire ta réalité.",
    "Ce qui se ressemble s'assemble, même l'invisible.",
    "Les portes s'ouvrent pour ceux qui frappent.",
    "Fais confiance au timing de l'univers.",
    // Esprit éveil / sortir de la matrice
    "Tu n'es pas le personnage : tu es celui qui l'observe.",
    "Derrière le voile du quotidien veille une part immense de toi.",
    "Sortir de la matrice commence par cesser d'y croire.",
    "Ton âme voyage plus loin que ton regard.",
    "Ce que l'on t'a appris à voir cache ce qui est vraiment là.",
    "Le corps est un habit ; la conscience, le voyageur.",
    "Rien ne se perd, tout se transforme et se souvient.",
    "Le silence intérieur est une porte, pas un vide.",
    "Tu es relié à tout ce qui vit, même à ce qui ne se voit pas.",
    "Réveille-toi doucement du rêve qu'on a rêvé pour toi.",
    "La peur est un mur peint sur une porte ouverte.",
    "Ce qui t'appelle en silence connaît déjà le chemin.",
  ],
  philosophie: [
    "Connais-toi toi-même. — Socrate",
    "Ce n'est pas parce que c'est difficile qu'on n'ose pas. — Sénèque",
    "Nous souffrons plus en imagination qu'en réalité. — Sénèque",
    "Ce qui dépend de toi, fais-le. Le reste, accepte-le. — Épictète",
    "L'obstacle est le chemin. — inspiré de Marc Aurèle",
    "Vivre, c'est choisir. Et choisir, c'est renoncer. — André Gide",
    "La vie non examinée ne vaut pas la peine d'être vécue. — Socrate",
    "Deviens ce que tu es. — Pindare",
    "Le bonheur n'est pas un but, mais une manière de voyager.",
    "Il faut imaginer Sisyphe heureux. — Camus",
    "Tant que tu vis, apprends à vivre. — Sénèque",
    "La vie, si l'on sait en user, est longue. — Sénèque",
    "Il n'y a pas de vent favorable pour celui qui ne sait où aller. — Sénèque",
    "Ce ne sont pas les choses qui nous troublent, mais l'opinion que nous en avons. — Épictète",
    "Tu as le pouvoir sur ton esprit, non sur les événements extérieurs. — Marc Aurèle",
    "L'homme sage est celui qui ne s'afflige pas des choses qu'il n'a pas et qui se réjouit de celles qu'il a. — Épictète",
    "Hier j'étais intelligent, je voulais changer le monde. Aujourd'hui je suis sage, je me change moi-même. — Rumi",
    "La blessure est l'endroit par où la lumière pénètre en toi. — Rumi",
    "Ne sois pas triste : tout ce que tu perds revient sous une autre forme. — Rumi",
    "Que la beauté de ce que tu aimes soit ce que tu fais. — Rumi",
    "Hier, c'est du passé. Demain, c'est un mystère. Aujourd'hui est un cadeau. — Rumi",
    "Notre plus grande gloire n'est pas de ne jamais tomber, mais de nous relever à chaque chute. — Confucius",
    "Peu importe la vitesse à laquelle tu vas, du moment que tu ne t'arrêtes pas. — Confucius",
    "Choisis un travail que tu aimes et tu n'auras pas à travailler un seul jour de ta vie. — Confucius",
  ],
  douceur: [
    "Sois aussi doux avec toi qu'avec les autres.",
    "Tu fais de ton mieux, et c'est déjà beaucoup.",
    "Se reposer fait partie du travail.",
    "Une journée moyenne est une journée réussie.",
    "Tu n'as pas à tout porter aujourd'hui.",
    "Le repos n'est pas une récompense, c'est un besoin.",
    "Va à ton rythme, il est le bon.",
    "Ce qui compte n'est pas la vitesse, mais la direction.",
    "Prendre soin de soi n'est pas un luxe, c'est le socle.",
    "Moins de pression, plus de clarté.",
  ],
};

function dailyPhrase(envId) {
  const list = envId === "toutes"
    ? Object.values(PHRASES_BY_ENV).flat()
    : (PHRASES_BY_ENV[envId] || PHRASES_BY_ENV.douceur);
  const day = todayISODate();
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

// Salutation selon l'heure, le prénom et le sexe
// Petits surnoms sympathiques, tirés au hasard chaque jour
const NICKNAMES = {
  h: ["beau gosse", "champion", "belle âme", "grand cœur", "capitaine", "chef", "l'artiste",
      "crack", "maestro", "beau brun", "guerrier du quotidien", "roi de la journée",
      "âme vaillante", "vieux briscard", "phénomène", "légende vivante"],
  f: ["joli cœur", "belle âme", "championne", "grand cœur", "capitaine", "cheffe", "l'artiste",
      "crack", "maestra", "beauté", "guerrière du quotidien", "reine de la journée",
      "âme vaillante", "merveille", "phénomène", "légende vivante"],
  a: ["joli cœur", "belle âme", "champion·ne", "grand cœur", "capitaine", "chef·fe", "l'artiste",
      "crack", "maestro", "guerrier·ère du quotidien", "âme vaillante", "phénomène",
      "légende vivante", "étoile filante", "belle personne", "force tranquille"],
};

function nicknameOfDay(gender) {
  const list = NICKNAMES[gender] || NICKNAMES.a;
  const day = todayISODate();
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 37 + day.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

function greeting(name, gender) {
  const h = new Date().getHours();
  const day = todayISODate();
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 17 + day.charCodeAt(i)) >>> 0;
  // Un jour sur deux : le prénom. L'autre : un petit surnom.
  const usePrenom = !name ? false : (hash % 2 === 0);
  const who = usePrenom ? name : nicknameOfDay(gender);
  const n = who ? ` ${who}` : "";
  if (h < 5) return `Douce nuit${n}`;
  if (h < 12) return `Bonjour${n}`;
  if (h < 18) return `Bon après-midi${n}`;
  return `Bonsoir${n}`;
}

function TaskBadges({ t, theme, showTheme = true }) {
  const today = todayISODate();
  const isEvent = t.kind === "event" || t.kind === "prestation";
  const overdue = !isEvent && t.dueDate && t.dueDate < today && !t.done;
  const isPast = isEvent && t.dueDate && t.dueDate < today;
  const dueSoonToday = t.dueDate === today && !t.done;
  const isMultiDay = t.endDate && t.endDate !== t.startDate;
  const notYetStarted = t.startDate && t.startDate > today;
  return (
    <>
      {t.cancelled && (
        <span className="text-[10px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "#3A3A3A", color: "#B8B4C2" }}>
          <Ban size={10} /> Annulé
        </span>
      )}
      {t.followUpCreated && t.done && (
        <span className="text-[10px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "#38BDF822", color: "#38BDF8" }}>
          <Repeat size={10} /> À refaire
        </span>
      )}
      {!t.cancelled && (t.kind === "event" || t.kind === "prestation") && t.eventStatus === "option" && (
        <span className="text-[10px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: "#F59E0B33", color: "#F59E0B" }}>
          🕓 Option
        </span>
      )}
      {showTheme && theme && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: theme.color + "33", color: theme.color }}>
          {theme.name}
        </span>
      )}
      {!t.allDay && t.time && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: C.textDim }}>
          <Clock size={10} /> {t.time}
        </span>
      )}
      {t.allDay && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: C.accentLight }}>
          <CalendarDays size={10} /> toute la journée
        </span>
      )}
      {isMultiDay && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: C.accentLight }}>
          <CalendarDays size={10} /> {relativeDateLabel(t.startDate)} → {relativeDateLabel(t.endDate)}
        </span>
      )}
      {t.recurrence && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: C.textDim }}>
          <Repeat size={10} /> {RECURRENCE_LABELS[t.recurrence]}
        </span>
      )}
      {t.postponedTo && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: C.textDim }}>
          <CalendarClock size={10} /> reporté au {relativeDateLabel(t.postponedTo)}
        </span>
      )}
      {notYetStarted && !isMultiDay && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: C.accentLight }}>
          <CalendarDays size={10} /> à partir du {relativeDateLabel(t.startDate)}
        </span>
      )}
      {t.dueDate && (
        <span className="text-[10px] flex items-center gap-1" style={{ color: overdue ? C.danger : isPast ? C.textGhost : dueSoonToday ? C.accentGlow : C.textDim }}>
          <Flag size={10} /> {overdue ? "en retard · " : isPast ? "passé · " : ""}échéance {relativeDateLabel(t.dueDate)}
        </span>
      )}
      {!t.allDay && !isEvent && <span className="text-[10px]" style={{ color: C.textDim }}>{durationLabel(t.duration)}</span>}
      {t.notes && t.notes.trim() && (
        <span className="text-[10px] flex items-center" style={{ color: C.textDim }} aria-label="Contient des détails">
          <StickyNote size={11} />
        </span>
      )}
    </>
  );
}

// --- sound: short synthesized reward chimes, no external files ---
const SOUND_LEVELS = { off: 0, quiet: 0.35, normal: 0.65, present: 1.0 };
const SOUND_DEFAULT_SETTINGS = {
  level: "quiet",
  tasks: true,
  routines: true,
  defis: true,
  rewards: true,
  ui: false,
};
function useSoundSystem(profile, settingsFromData) {
  const ctxRef = useRef(null);
  const settings = { ...SOUND_DEFAULT_SETTINGS, ...(settingsFromData || {}) };
  const vol = SOUND_LEVELS[settings.level] ?? 0.35;

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume().catch(() => {});
    return ctxRef.current;
  }, []);

  const playNote = useCallback((ctx, freq, start, dur, gain, type = "sine", decay = 0.85) => {
    try {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain * vol, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur * decay);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(start); osc.stop(start + dur + 0.04);
    } catch (e) {}
  }, [vol]);

  const isMag = profile === "mag";

  // ── Task complete ────────────────────────────────────────────────
  const taskComplete = useCallback(() => {
    if (!settings.tasks || vol === 0) return;
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    if (isMag) {
      // Cristalline ascendante — fleur qui s'ouvre
      playNote(ctx, 880, t, 0.30, 0.07, "sine");
      playNote(ctx, 1318.5, t + 0.12, 0.45, 0.055, "sine");
      playNote(ctx, 1760, t + 0.28, 0.55, 0.04, "sine");
    } else {
      // Ping synthétique électronique — étoile qui s'allume
      playNote(ctx, 660, t, 0.15, 0.07, "sine");
      playNote(ctx, 990, t + 0.10, 0.30, 0.055, "sine");
    }
  }, [settings.tasks, vol, isMag, getCtx, playNote]);

  // ── Routine / bien-être ─────────────────────────────────────────
  const routineComplete = useCallback(() => {
    if (!settings.routines || vol === 0) return;
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    if (isMag) {
      // Goutte de rosée — doux et bref
      playNote(ctx, 1046.5, t, 0.25, 0.05, "sine");
      playNote(ctx, 1396.9, t + 0.10, 0.32, 0.035, "sine");
    } else {
      // Signal de renforcement discret
      playNote(ctx, 523.25, t, 0.12, 0.05, "sine");
      playNote(ctx, 783.99, t + 0.08, 0.20, 0.04, "sine");
    }
  }, [settings.routines, vol, isMag, getCtx, playNote]);

  // ── Défi accompli ────────────────────────────────────────────────
  const defiComplete = useCallback((level = 1) => {
    if (!settings.defis || vol === 0) return;
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    const lvl = Math.min(level, 5);
    if (isMag) {
      // Deux notes féérique ascendantes, plus riches selon le niveau
      const base = [880, 1046.5, 1174.66, 1318.5, 1568][lvl - 1];
      playNote(ctx, base * 0.75, t, 0.20, 0.06, "sine");
      playNote(ctx, base, t + 0.15, 0.35 + lvl * 0.04, 0.07, "sine");
      if (lvl >= 3) playNote(ctx, base * 1.33, t + 0.33, 0.40, 0.05, "sine");
      if (lvl >= 5) playNote(ctx, base * 2, t + 0.52, 0.50, 0.04, "sine");
    } else {
      // Progression d'impulsions synthétiques
      const base = [440, 523.25, 659.25, 783.99, 987.77][lvl - 1];
      playNote(ctx, base, t, 0.15, 0.065, "sine");
      playNote(ctx, base * 1.5, t + 0.12, 0.25 + lvl * 0.035, 0.065, "sine");
      if (lvl >= 3) playNote(ctx, base * 2, t + 0.26, 0.35, 0.05, "triangle");
      if (lvl >= 5) playNote(ctx, base * 3, t + 0.40, 0.45, 0.04, "sine");
    }
  }, [settings.defis, vol, isMag, getCtx, playNote]);

  // ── Grande réussite (toutes tâches / journée / 100%) ────────────
  const bigSuccess = useCallback(() => {
    if (!settings.rewards || vol === 0) return;
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    if (isMag) {
      // Shimmer montant — jardin en floraison
      [523.25, 659.25, 783.99, 1046.5, 1318.5, 1760].forEach((f, i) => {
        playNote(ctx, f, t + i * 0.11, 0.55 - i * 0.04, 0.055 - i * 0.004, "sine");
      });
    } else {
      // Whoosh électronique + montée
      [330, 440, 587.33, 783.99, 1046.5].forEach((f, i) => {
        playNote(ctx, f, t + i * 0.09, 0.45 - i * 0.04, 0.06, "sine");
      });
    }
  }, [settings.rewards, vol, isMag, getCtx, playNote]);

  // ── UI click (désactivé par défaut) ────────────────────────────
  const uiClick = useCallback(() => {
    if (!settings.ui || vol === 0) return;
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    playNote(ctx, isMag ? 1046.5 : 660, t, 0.08, 0.025, "sine");
  }, [settings.ui, vol, isMag, getCtx, playNote]);

  // ── Badge / médaille ────────────────────────────────────────────
  const badgeUp = useCallback(() => {
    if (!settings.rewards || vol === 0) return;
    const ctx = getCtx(); if (!ctx) return;
    const t = ctx.currentTime;
    if (isMag) {
      playNote(ctx, 659.25, t, 0.20, 0.07, "sine");
      playNote(ctx, 830.61, t + 0.18, 0.22, 0.07, "sine");
      playNote(ctx, 987.77, t + 0.36, 0.35, 0.08, "sine");
    } else {
      playNote(ctx, 440, t, 0.15, 0.07, "sine");
      playNote(ctx, 660, t + 0.14, 0.18, 0.07, "sine");
      playNote(ctx, 880, t + 0.28, 0.30, 0.08, "triangle");
    }
  }, [settings.rewards, vol, isMag, getCtx, playNote]);

  return { taskComplete, routineComplete, defiComplete, bigSuccess, uiClick, badgeUp, settings };
}


function constellationMood(percent) {
  if (percent >= 100) return "Toutes les étoiles brillent";
  if (percent >= 50) return "Le ciel s'éclaircit";
  if (percent > 0) return "Une étoile s'allume";
  return "Les étoiles attendent";
}

function starPolygonPoints(cx, cy, outerR, innerR) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + r * Math.cos(angle)},${cy - r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

const AMBIENT_SPARKLES = [
  { x: 14, y: 18, dur: 3.2, delay: 0 },
  { x: 148, y: 12, dur: 2.6, delay: 0.6 },
  { x: 8, y: 60, dur: 3.6, delay: 1.1 },
  { x: 152, y: 55, dur: 2.9, delay: 0.3 },
  { x: 80, y: 6, dur: 4.1, delay: 1.8 },
  { x: 28, y: 40, dur: 2.8, delay: 0.9 },
  { x: 170, y: 32, dur: 3.3, delay: 0.2 },
  { x: 60, y: 80, dur: 3.8, delay: 1.4 },
  { x: 130, y: 75, dur: 2.7, delay: 0.7 },
  { x: 100, y: 88, dur: 3.5, delay: 2.1 },
];
const STAR_SPOTS = [
  { x: 20, y: 46, r: 7.5 }, { x: 40, y: 26, r: 7 }, { x: 62, y: 14, r: 8 },
  { x: 86, y: 10, r: 7.5 }, { x: 110, y: 16, r: 7 }, { x: 132, y: 28, r: 8 },
  { x: 152, y: 42, r: 7 }, { x: 162, y: 62, r: 7.5 }, { x: 148, y: 78, r: 7 },
  { x: 128, y: 86, r: 8 },
];

function TreasureChestIcon({ open, size = 18, color = "#F59E0B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {open ? (
        <>
          <rect x="3" y="12" width="18" height="8" rx="1.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
          <path d="M3 12 L5 6 H19 L21 12" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill="none" />
          <path d="M4 6 Q12 -1 20 6" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="12" cy="14.5" r="1.4" fill={color} />
        </>
      ) : (
        <>
          <rect x="3" y="10" width="18" height="9" rx="1.5" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" />
          <path d="M3 10 Q12 5 21 10" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <rect x="10.5" y="12" width="3" height="3.5" rx="0.6" fill={color} />
        </>
      )}
    </svg>
  );
}

function ConstellationGauge({ percent }) {
  const lit = Math.round(Math.max(0, Math.min(100, percent)) / 10);
  const complete = percent >= 100;
  const [starKey, setStarKey] = useState(0);

  useEffect(() => {
    if (!complete) return;
    setStarKey((k) => k + 1);
    const id = setInterval(() => setStarKey((k) => k + 1), 9000);
    return () => clearInterval(id);
  }, [complete]);

  const starPath = useMemo(() => {
    if (!complete) return null;
    const startX = 10 + Math.random() * 180;
    const endX = 10 + Math.random() * 180;
    const midX = (startX + endX) / 2 + (Math.random() - 0.5) * 70;
    const midY = 10 + Math.random() * 30;
    return `M${startX.toFixed(1)},-6 Q${midX.toFixed(1)},${midY.toFixed(1)} ${endX.toFixed(1)},96`;
  }, [complete, starKey]);

  return (
    <div className="flex flex-col items-center w-full">
      <svg viewBox="0 0 200 95" className="gentle-breathe" style={{ width: "100%", maxWidth: 190, height: 95, overflow: "visible" }}>
        {AMBIENT_SPARKLES.map((s, i) => (
          <circle key={`sparkle-${i}`} cx={s.x} cy={s.y} r={1} fill="#EDE6FF">
            <animate attributeName="opacity" values="0.12;0.55;0.12" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
            <animate attributeName="r" values="0.8;1.4;0.8" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
        {STAR_SPOTS.map((s, i) => {
          const isLit = i < lit;
          return (
            <polygon
              key={i}
              points={starPolygonPoints(s.x, s.y, isLit ? s.r : s.r * 0.62, (isLit ? s.r : s.r * 0.62) * 0.42)}
              fill={isLit ? "#F5C84C" : C.borderStrong}
              className={isLit ? "star-twinkle" : ""}
              style={{
                filter: isLit ? "drop-shadow(0 0 6px rgba(245,200,76,0.85))" : "none",
                transition: "all 0.4s ease",
                animationDelay: isLit ? `${(i * 0.31) % 2.2}s` : undefined,
              }}
            />
          );
        })}
        {complete && starPath && (
          <g key={starKey} opacity="0">
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.75;1" dur="1.6s" repeatCount="1" fill="freeze" />
            <line x1="-9" y1="0" x2="0" y2="0" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round">
              <animateMotion path={starPath} dur="1.6s" repeatCount="1" rotate="auto" fill="freeze" />
            </line>
            <circle r="1.8" fill="#FFFFFF" style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.9))" }}>
              <animateMotion path={starPath} dur="1.6s" repeatCount="1" fill="freeze" />
            </circle>
          </g>
        )}
      </svg>
    </div>
  );
}


// ── Guide des symboles Sly ───────────────────────────────────────────────────
const SLY_SYMBOL_LEGEND = [
  { symbol: "✨", label: "Points", desc: "Tu gagnes des points en cochant des tâches, en notant ton énergie et en relevant des défis. Touche les points de l'accueil pour voir le détail." },
  { symbol: "%", label: "Ma journée", desc: "Ta progression du jour. Touche la carte pour ouvrir les statistiques." },
  { symbol: "🏃 Actions", label: "Carte Actions", desc: "Tes tâches du jour et l'accès à toutes tes tâches." },
  { symbol: "🌿 Énergie", label: "Carte Énergie", desc: "Sommeil, hydratation, nutrition, activité, silence et poids — chaque dimension notée rapporte des points." },
  { symbol: "📅 Agenda", label: "Carte Agenda", desc: "Tes événements et tâches datées, en liste ou en calendrier." },
  { symbol: "🎯 Défis", label: "Carte Défis", desc: "Tes petits défis du jour. +5 pts même sans défi si tu renseignes la carte." },
  { symbol: "⚡", label: "Série", desc: "Nombre de jours consécutifs où tu as été actif. Ton record est gardé." },
  { symbol: "🗓️ balise", label: "Événement", desc: "Un événement est un repère daté : pas de case à cocher, il n'est jamais « en retard »." },
  { symbol: "Focus ⏱", label: "Mode Focus", desc: "Lance un minuteur sur une tâche ou une activité pour rester concentré." },
  { symbol: "À trouver / En cours / Prêt", label: "Statut checklist", desc: "Dans une checklist, touche le badge d'un objet pour faire tourner son statut." },
  { symbol: "🔍", label: "Recherche", desc: "Cherche dans tes tâches, événements et carnets de notes." },
  { symbol: "💾", label: "Sauvegarder / Restaurer", desc: "Dans les Réglages : sauvegarde toutes tes données dans un fichier, ou restaure-les." },
  { symbol: "🎨", label: "Ambiance", desc: "Trois univers visuels au choix dans les Réglages : Neutre, Cosmos, Jardin." },
];
// ── Navigation basse avec icônes ─────────────────────────────────────────────
const BOTTOM_TABS = [
  { id: "today",      label: "Accueil",    Icon: Home },
  { id: "agenda",     label: "Agenda",     Icon: CalendarDays },
  { id: "priorities", label: "Tâches",     Icon: ListChecks },
  { id: "resources",  label: "Mes carnets", Icon: BookOpen },
  { id: "__more__",   label: "Plus",       Icon: MoreHorizontal },
];
const MORE_TABS = [
  { id: "equipment", label: "Checklist",  Icon: Check },
  { id: "settings",  label: "Réglages",   Icon: Settings },
  { id: "history",   label: "Historique", Icon: BarChart2 },
  { id: "themes",    label: "Dossiers",     Icon: Settings2 },
];

const HOME_TABS = ["today", "priorities", "equipment", "resources"];

function BottomNav({ tab, onTabChange, onFAB }) {
  const isHome = HOME_TABS.includes(tab);
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40"
      style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
      <div className="max-w-md mx-auto flex items-center px-2">
        {[
          { id: "today",    label: "Accueil",      Icon: Home },
          { id: "agenda",   label: "Agenda",        Icon: CalendarDays },
        ].map(({ id, label, Icon }) => {
          const active = id === "today" ? isHome : tab === id;
          return (
            <button key={id} onClick={() => onTabChange(id)}
              className="flex-1 flex flex-col items-center py-2.5 gap-0.5"
              style={{ color: active ? C.accent : C.textGhost }}>
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
        {/* FAB central */}
        <button onClick={onFAB} className="mx-3 -mt-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg fab-glow shrink-0"
          style={{ background: `linear-gradient(135deg, ${C.accent}, #A855F7)`, color: "white" }}>
          <Plus size={26} />
        </button>
        {[
          { id: "equipment",  label: "Checklists", Icon: ListChecks },
          { id: "resources",  label: "Carnets",    Icon: BookOpen },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => onTabChange(id)}
            className="flex-1 flex flex-col items-center py-2.5 gap-0.5"
            style={{ color: tab === id ? C.accent : C.textGhost }}>
            <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.8} />
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
      <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
    </div>
  );
}

function TopSubTabs({ tab, onTabChange }) {
  return (
    <div className="flex overflow-x-auto gap-1 px-5" style={{ borderBottom: `1px solid ${C.border}` }}>
      {[
        { id: "today",     label: "Aujourd'hui" },
        { id: "priorities",label: "Tâches" },
        { id: "equipment", label: "Checklist" },
        { id: "resources", label: "Mes carnets" },
      ].map(({ id, label }) => (
        <button key={id} onClick={() => onTabChange(id)}
          className="text-sm font-semibold pb-2.5 pt-2 px-1 whitespace-nowrap shrink-0"
          style={{
            borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`,
            color: tab === id ? C.text : C.textGhost,
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function MoreSheet({ tab, onTabChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(11,8,16,0.7)" }} onClick={onClose}>
      <div className="w-full max-w-md mx-auto rounded-t-2xl p-6 space-y-2"
        style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}
        onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: C.textGhost }}>Navigation</div>
        {MORE_TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { onTabChange(id); onClose(); }}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold text-left"
            style={{ background: tab === id ? C.accent + "22" : C.surfaceRaised, color: tab === id ? C.accentLight : C.text, border: `1px solid ${tab === id ? C.accent + "55" : C.border}` }}>
            <Icon size={18} style={{ color: tab === id ? C.accent : C.textDim }} />
            {label}
          </button>
        ))}
        <button onClick={onClose} className="w-full py-3 rounded-xl text-sm mt-2"
          style={{ color: C.textGhost, border: `1px solid ${C.border}` }}>Fermer</button>
      </div>
    </div>
  );
}

// ── 3 cartes résumé en haut de l'écran Accueil ───────────────────────────────
const URGENCY_COLORS = { 3: "#EF4444", 2: "#F59E0B", 1: "#22C55E" };


// ══════════════════════════════════════════════════════════════════
// DRAGON COMPANION — 5 états selon la progression (0-100%)
// ══════════════════════════════════════════════════════════════════
function DragonCompanion({ percent }) {
  const p = Math.round(percent);
  const state = p === 0 ? 0 : p <= 20 ? 1 : p <= 50 ? 2 : p <= 80 ? 3 : p < 100 ? 4 : 5;
  const cfg = [
    { size: 44, opacity: 0.22, glow: "none", label: null, animate: false },
    { size: 48, opacity: 0.50, glow: "drop-shadow(0 0 8px #7C3AED66)", label: "S'éveille doucement...", animate: false },
    { size: 56, opacity: 0.65, glow: "drop-shadow(0 0 12px #7C3AED88)", label: "Relève la tête", animate: false },
    { size: 64, opacity: 0.80, glow: "drop-shadow(0 0 16px #8B5CF6AA)", label: "S'éveille", animate: false },
    { size: 72, opacity: 0.92, glow: "drop-shadow(0 0 22px #A78BFA)", label: "Prend son envol", animate: false },
    { size: 78, opacity: 1.0,  glow: "drop-shadow(0 0 28px #C4B5FD) drop-shadow(0 0 52px #8B5CF680)", label: "✨ Rayonne", animate: true },
  ][state];
  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div className="relative flex items-center justify-center">
        {state > 0 && (
          <div className="absolute rounded-full pointer-events-none"
            style={{ width: cfg.size * 1.9, height: cfg.size * 1.9,
              background: `radial-gradient(circle, #8B5CF6${(state * 9).toString(16).padStart(2,'0')} 0%, transparent 70%)`,
              filter: "blur(12px)" }} />
        )}
        <span className={cfg.animate ? "gentle-breathe" : ""}
          style={{ fontSize: cfg.size, opacity: cfg.opacity, filter: cfg.glow, lineHeight: 1,
            transition: "font-size 0.6s ease, opacity 0.6s ease, filter 0.6s ease", display: "block" }}>
          🐉
        </span>
      </div>
      {cfg.label && (
        <div className="text-[10px] italic text-center" style={{ color: "#9F7AEA", maxWidth: 88 }}>{cfg.label}</div>
      )}
    </div>
  );
}

function computeGlobalProgress(tasksDone, tasksTotal, ritualsDone, ritualsTotal, defiDone, defiTotal, defiAcknowledged, quizAddressed, agendaDone = 0, agendaTotal = 0) {
  // Les défis ET le quiz comptent toujours dans le total — sauf validation explicite de
  // l'utilisateur ("Pas de défi/quiz pour moi aujourd'hui"), qui vaut alors comme complet.
  // Sans quoi, ne pas y avoir touché ne devrait jamais suffire, en silence, à atteindre 100%.
  const dw = 2;
  const qw = 2;
  const total = tasksTotal + ritualsTotal + dw + qw + agendaTotal;
  if (total === 0) return { pct: 0 };
  const dp = defiTotal > 0 ? (defiDone >= defiTotal ? 2 : defiDone > 0 ? 1 : 0) : (defiAcknowledged ? 2 : 0);
  const qp = quizAddressed ? 2 : 0;
  return { pct: Math.round(((tasksDone + ritualsDone + dp + qp + agendaDone) / total) * 100) };
}

function CircularProgress({ pct, tasksDone, tasksTotal, ritualsDone, ritualsTotal, defiDone, defiTotal }) {
  const r = 52, circ = 2 * Math.PI * r;
  const dash = circ * (Math.min(100, pct) / 100);
  const isComplete = pct >= 100;
  const ringColor = isComplete ? "#22C55E" : pct >= 50 ? C.accent : "#6D28D9";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: 130, height: 130 }}>
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="#1D162A" strokeWidth="10"/>
          <circle cx="65" cy="65" r={r} fill="none" stroke={ringColor} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 65 65)"
            style={{ transition: "stroke-dasharray 0.8s ease, stroke 0.4s" }}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-black leading-none font-mono-num"
            style={{ color: isComplete ? "#22C55E" : C.text }}>{pct}%</div>
          <div className="text-[10px] mt-1 text-center leading-tight" style={{ color: C.textGhost }}>
            de ta journée<br/>accomplie
          </div>
        </div>
      </div>
      <div className="text-[10px] text-center leading-relaxed" style={{ color: C.textGhost }}>
        {tasksTotal > 0 && <div>{tasksDone}/{tasksTotal} tâches</div>}
        {ritualsTotal > 0 && <div>{ritualsDone}/{ritualsTotal} rituels</div>}
        {defiTotal > 0 && <div>{defiDone}/{defiTotal} défi</div>}
      </div>
    </div>
  );
}



function PointsDetailModal({ data, tasks, themes, onClose }) {
  const today = todayISODate();
  const wbIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const wellnessLog = data.wellnessLog || {};
  const physActivities = data.physActivities || [];
  const espritItems = data.espritItems || [];
  const dayLog = wellnessLog[today] || {};
  const dailyPoints = data.dailyPoints || {};
  const totalToday = dailyPoints[today] || 0;

  // Tâches faites aujourd'hui (hors bien-être) avec leurs points
  const doneTasks = tasks.filter((t) => !wbIds.has(t.themeId) && t.kind !== "event" && t.done && t.completedAt?.startsWith(today));
  const tasksPts = doneTasks.reduce((s, t) => s + pointsForTask(t), 0);

  // Énergie : chaque clé _pts_ porte le montant
  const energieLines = Object.keys(dayLog)
    .filter((k) => k.startsWith("_pts_"))
    .map((k) => {
      const dimId = k.replace("_pts_", "");
      const dim = ENERGIE_DIMS.find((d) => d.id === dimId);
      return { label: dim ? `${dim.emoji} ${dim.label}` : dimId, pts: dayLog[k] || 0 };
    })
    .filter((l) => l.pts > 0);
  const energiePts = energieLines.reduce((s, l) => s + l.pts, 0);

  const autres = Math.max(0, totalToday - tasksPts - energiePts);

  const Section = ({ title, lines, sum, color }) => (
    lines.length > 0 ? (
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.textGhost }}>{title}</span>
          <span className="text-xs font-bold" style={{ color }}>+{sum} pts</span>
        </div>
        <div className="rounded-xl px-3 py-2 space-y-1" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="flex-1 min-w-0 truncate" style={{ color: C.textDim }}>{l.label}</span>
              <span className="text-xs font-semibold shrink-0" style={{ color: C.textFaint }}>+{l.pts}</span>
            </div>
          ))}
        </div>
      </div>
    ) : null
  );

  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4" style={{ zIndex: 90, background: "rgba(11,8,16,0.9)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl p-5 space-y-4" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: C.textGhost }}>Points d'aujourd'hui</div>
          <div className="font-black" style={{ fontSize: 40, color: "#FFD700" }}>{totalToday}</div>
        </div>

        {totalToday === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: C.textDim }}>Rien encore aujourd'hui — coche une tâche ou note ton énergie pour gagner tes premiers points ✨</p>
        ) : (
          <div className="space-y-3">
            <Section title="✓ Tâches faites" color={C.accentLight}
              lines={doneTasks.map((t) => ({ label: t.title, pts: pointsForTask(t) }))} sum={tasksPts} />
            <Section title="🌿 Énergie" color="#34D399" lines={energieLines} sum={energiePts} />
            {autres > 0 && (
              <Section title="⭐ Défis & autres" color="#F59E0B" lines={[{ label: "Défis, poids, rituels…", pts: autres }]} sum={autres} />
            )}
          </div>
        )}

        <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-bold" style={{ background: C.accent, color: C.bg }}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function TodayDashboard({
  greeting, regularTodayTasks, regularDoneCount, regularPercent,
  wellbeingDoneCount, wellbeingTotalCount,
  dailyDefi, defiLibrary, wbCounts, streakDays, streakRecord, quizDaily,
  themes, todayTasks, pulseId, totalPoints, dailyPoints,
  onToggleDone, onRemove, onMove, onEdit, onStartFocus, onCheckDefi,
  onMarkDone, onCancelTask, onAddToToday, onDeleteTask,
  onGoAgenda, onGoTasks, onGoChecklist, onGoResources, onGoSettings, onGoRituels, onGoDefi, onGoStats, onGoWellness, onOpenProgress,
  hasSelfCareTask, onAddSelfCare, totalMinutes, eventsToday, eventsList,
  wellnessToday, onLogWellness, onOpenNotifs, profile, weightLogs, onShowPointsDetail, onGoCoffre, coffreBalance,
  yesManActive, yesManValidated, onValidateYesMan, allTasks,
}) {
  const today = todayISODate();
  // Rafraîchit le composant chaque minute, pour que le clignotement "après 18h" se
  // déclenche même si rien d'autre ne provoque de re-rendu.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const isEveningUrgent = new Date().getHours() >= 18;
  const wellbeingIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const defiChecks = dailyDefi?.date === today ? (dailyDefi.checks || {}) : {};
  const defiSelected = (dailyDefi?.date === today ? dailyDefi.selectedIds || [] : []).map((id) => defiLibrary.find((d) => d.id === id)).filter(Boolean);
  const defiDoneCount = defiSelected.filter((d) => (defiChecks[d.id] || 0) > 0).length;
  const defiTotal = defiSelected.length;
  const defiPresence = dailyDefi?.date === today && dailyDefi?.presence;
  // La carte Défis clignote en permanence si aucun défi n'est prévu ET "pas de défi" pas encore noté
  const defiBlink = defiTotal === 0 && !defiPresence;
  const undatedTodayTasks = regularTodayTasks.filter((t) => !t.dueDate && !t.startDate);
  const datedTodayTasks = regularTodayTasks.filter((t) => t.dueDate || t.startDate);
  // Chantiers : tâches filantes sur plusieurs jours, actives tant qu'elles ne sont pas
  // marquées "Terminé" (t.done). Une case "Fait aujourd'hui" (chantierLastCheckIn) compte
  // dans les compteurs du jour sans jamais clore le chantier lui-même.
  const activeChantiers = (allTasks || []).filter((t) => t.kind === "chantier" && !t.cancelled && !t.done);
  // "Pas aujourd'hui" retire le chantier du compte du jour (mais il reste actif pour demain).
  const chantiersForToday = activeChantiers.filter((t) => t.chantierSkippedDate !== today);
  const chantiersCheckedToday = chantiersForToday.filter((t) => t.chantierLastCheckIn === today).length;
  const tasksDone = datedTodayTasks.filter((t) => t.done).length + chantiersCheckedToday;
  const tasksTotal = datedTodayTasks.length + chantiersForToday.length;
  const tasksLeft = tasksTotal - tasksDone;
  const undatedCount = undatedTodayTasks.length;
  // Nombre de dimensions Énergie renseignées aujourd'hui (4 dimensions + poids = 5)
  const energieNoted = (() => {
    const wt = wellnessToday || {};
    const dimKeys = ["_pts_hydratation", "_pts_nutrition", "_pts_activite", "_pts_esprit"];
    let n = dimKeys.filter((k) => wt[k]).length;
    const weighedToday = (weightLogs || []).some((w) => w.date === today);
    if (weighedToday || wt._peseeSkipped) n += 1;
    return n;
  })();
  const ENERGIE_TOTAL = 5;
  const quizAddressed = quizDaily?.date === today && (quizDaily.played || quizDaily.dismissed);
  const nbEvents = eventsToday || 0;
  // Événements pas encore passés (selon l'heure courante)
  const nowHM = (() => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })();
  const eventsLeft = (eventsList || []).filter((e) => !e.time || e.time >= nowHM).length;
  // Pour la jauge générale : ce qui compte, c'est que l'événement soit validé (coché ou
  // automatiquement passé), pas seulement qu'il soit "dans le passé" par l'heure — sinon,
  // un événement qu'on valide en avance ne permettrait jamais d'atteindre 100 %.
  const eventsDoneCount = (eventsList || []).filter((e) => e.done).length;
  const { pct: globalPct } = computeGlobalProgress(tasksDone, tasksTotal, energieNoted, ENERGIE_TOTAL, defiDoneCount, defiTotal, defiPresence, quizAddressed, eventsDoneCount, nbEvents);
  const todayPts = dailyPoints?.[today] || 0;
  // Commentaire fun et contextuel selon les points du jour
  const pointsComment = (() => {
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterdayPts = dailyPoints?.[yd.toISOString().slice(0, 10)] || 0;
    if (todayPts === 0) return "La journée commence — à toi de jouer ! 🚀";
    if (yesterdayPts > 0 && todayPts > yesterdayPts) return `⚡ Tu fais mieux qu'hier (${yesterdayPts} pts) !`;
    if (globalPct >= 100) return "Journée bouclée à 100 % — chapeau ! 🎉";
    if (todayPts >= 50) return "Belle récolte, tu es lancé ! 💪";
    if (todayPts >= 25) return "Bon rythme, continue comme ça 👏";
    return "Premiers points engrangés ✨";
  })();
  const lvl = levelFor(totalPoints || 0);

  // Étoiles de la journée (sur 5, basé sur le % global)
  const stars = Math.round((globalPct / 100) * 5);
  // Points possibles restants par catégorie
  const tasksPtsPossible = regularTodayTasks.filter((t) => !t.done && !t.cancelled).reduce((s, t) => s + pointsForTask({ ...t, done: true }), 0);
  const ritualsPtsPossible = (wellbeingTotalCount - wellbeingDoneCount) * pointsForRitual();
  const defisPtsPossible = (defiTotal - defiDoneCount) * 10;
  const actionsLeft = tasksLeft + (wellbeingTotalCount - wellbeingDoneCount) + (defiTotal - defiDoneCount);

  // Semaine (série)
  const weekDays = ["L","M","M","J","V","S","D"];
  const todayDow = (new Date().getDay() + 6) % 7; // 0 = lundi

  // Grande carte colorée (Missions / Rituels / Événements / Défis)
  const BigCard = ({ onClick, accent, bgFrom, Icon, title, subtitle, count, done, total, ptsPossible, footer, extraNote }) => {
    const showCheck = total != null && (total === 0 || done >= total);
    const shouldBlink = isEveningUrgent && total != null && !showCheck;
    const allDone100 = globalPct >= 100; // clignotement synchronisé des 5 cartes, piloté par la jauge générale
    return (
    <button onClick={onClick}
      className={`rounded-3xl p-4 flex flex-col active:scale-[0.98] transition-transform text-left relative overflow-hidden ${allDone100 ? "td-card-100" : ""}`}
      style={{ background: `linear-gradient(150deg, ${accent}1F, ${C.surface})`, border: `1px solid ${allDone100 ? "#FACC15" : accent + "44"}`, minHeight: 168, "--glow-100": accent + "88" }}>
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-2xl flex items-center justify-center" style={{ width: 52, height: 52, background: accent + "26" }}>
          <Icon size={26} style={{ color: accent }} strokeWidth={2} />
        </div>
        <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
          {shouldBlink && (
            <div className="td-urgent-disc" style={{ position: "absolute", inset: -3, borderRadius: "50%", background: "#FFE600", "--urgent-glow": "#FFE60099" }} />
          )}
          <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: "absolute" }}>
            <circle cx="22" cy="22" r="19" fill="none" stroke={accent + "33"} strokeWidth="3.5" />
            <circle cx="22" cy="22" r="19" fill="none" stroke={accent} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 19}
              strokeDashoffset={2 * Math.PI * 19 * (1 - (total > 0 ? done / total : 1))}
              transform="rotate(-90 22 22)"
              style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
          </svg>
          <span className="font-black relative" style={{ color: accent, fontSize: 16 }}>{count}</span>
        </div>
      </div>
      <div className="font-black uppercase tracking-wide leading-tight" style={{ fontSize: 17, color: C.text }}>{title}</div>
      <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{subtitle}</div>
      <div className="mt-auto pt-3">
        {(total != null || extraNote) && (
          <div className="mb-1.5 flex items-center gap-2 flex-wrap">
            {total != null && <span className="text-xs font-bold" style={{ color: C.text }}>{done} / {total}</span>}
            {extraNote && <span className="text-[11px] font-semibold" style={{ color: C.textFaint }}>{extraNote}</span>}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold" style={{ color: accent }}>{footer}</span>
          <ChevronRight size={18} style={{ color: accent }} />
        </div>
      </div>
    </button>
    );
  };

  return (
    <div className="px-4 pt-4 pb-6 space-y-3.5">

      {/* ── Bannière Yes man ── */}
      {yesManActive && (
        <button
          onClick={!yesManValidated ? onValidateYesMan : undefined}
          className="w-full rounded-2xl px-4 py-3.5 text-center active:scale-[0.98] transition-transform"
          style={{ background: "#DC2626", border: "2px solid #7F1D1D" }}
        >
          <div className="font-black text-lg leading-tight" style={{ color: "#FFFFFF" }}>
            🎯 AUJOURD'HUI, C'EST OUI !
          </div>
          <div className="text-xs font-semibold mt-1" style={{ color: "#FFFFFF" }}>
            {yesManValidated ? "✅ Défi relevé — +300 points" : "Touche ici pour valider ton défi (+300 pts)"}
          </div>
        </button>
      )}

      {/* ── En-tête : salutation ── */}
      <div>
        <h1 className="font-bold leading-tight flex items-center gap-2" style={{ fontSize: 26, color: C.text }}>
          {greeting} <span style={{ fontSize: 22 }}>👋</span>
        </h1>
        <div className="text-xs mt-0.5" style={{ color: C.textDim }}>
          {todayLabel()}{saintDuJour(new Date()) ? ` · ${saintDuJour(new Date())}` : ""}{isFullMoon(todayISODate()) ? " · 🌕 Pleine lune" : ""}
        </div>
        <p className="text-xs italic mt-1.5" style={{ color: C.textGhost }}>{dailyPhrase(profile?.environment)}</p>
      </div>

      {/* ── Progression du jour + points ── */}
      <div className={`w-full rounded-3xl p-4 ${globalPct >= 100 ? "td-card-100" : ""}`}
        style={{ background: `linear-gradient(150deg, ${C.surfaceRaised}, ${C.surface})`, border: `1px solid ${globalPct >= 100 ? "#FACC15" : C.border}`, "--glow-100": "#FACC1588" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.textGhost }}>Ma journée</div>
            <button onClick={() => onOpenProgress && onOpenProgress()} title="Ma progression" className="active:scale-90 transition-transform">
              <span style={{ fontSize: 15, lineHeight: 1 }}>🏆</span>
            </button>
          </div>
          <button onClick={onGoStats} className="flex items-baseline gap-1 active:scale-[0.99] transition-transform">
            <span className="font-black leading-none" style={{ fontSize: 32, color: globalPct >= 100 ? "#22C55E" : C.text }}>{globalPct}</span>
            <span className="text-lg font-bold" style={{ color: C.textDim }}>%</span>
          </button>
        </div>
        <button onClick={onGoStats} className="w-full text-left active:scale-[0.99] transition-transform">
          <div className="rounded-full overflow-hidden" style={{ height: 10, background: C.bg }}>
            <div className="h-full rounded-full" style={{
              width: `${Math.min(100, globalPct)}%`,
              background: globalPct >= 100 ? "linear-gradient(90deg,#22C55E,#4ade80)" : `linear-gradient(90deg, var(--user-accent, #8B5CF6), #A855F7)`,
              transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)"
            }} />
          </div>
        </button>
        {/* Points du jour + commentaire — cliquable pour le détail */}
        <button onClick={() => onShowPointsDetail && onShowPointsDetail()}
          className="w-full flex items-center gap-3 mt-3 pt-3 active:scale-[0.99] transition-transform" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="font-black leading-none" style={{ fontSize: 26, color: "#FFD700" }}>{todayPts}</span>
            <span className="text-xs font-bold" style={{ color: "#FFD700AA" }}>pts</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-xs font-semibold leading-snug" style={{ color: C.textDim }}>{pointsComment}</div>
            <div className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: C.textGhost }}>{totalPoints || 0} pts au total · voir le détail <ChevronRight size={10} /></div>
          </div>
          {/* Coffre à récompenses — badge compact, cliquable indépendamment */}
          <div onClick={(e) => { e.stopPropagation(); onGoCoffre && onGoCoffre(); }}
            className="flex flex-col items-center justify-center rounded-xl px-2.5 py-1.5 shrink-0 active:scale-95 transition-transform"
            style={{ background: "#F59E0B1F", border: `1px solid #F59E0B55` }}>
            <TreasureChestIcon open={(coffreBalance || 0) > 0} size={18} />
            <span className="text-[10px] font-bold mt-0.5" style={{ color: "#F59E0B" }}>{coffreBalance || 0}</span>
          </div>
        </button>
      </div>

      {/* ── Grille 2×2 des grandes cartes ── */}
      <div className="grid grid-cols-2 gap-3">
        <BigCard onClick={onGoTasks} accent={profile?.accentColor || "#A855F7"} bgFrom="#1E1240" Icon={ListChecks}
          title="Actions" subtitle="Tâches à accomplir" count={tasksLeft}
          done={tasksDone} total={tasksTotal} extraNote={undatedCount > 0 ? `· ${undatedCount} non datée${undatedCount > 1 ? "s" : ""}` : null}
          footer={tasksPtsPossible > 0 ? `+${tasksPtsPossible} pts possibles` : "Tout est fait ✓"} />
        <BigCard onClick={onGoRituels} accent="#22C55E" bgFrom="#0F2A1A" Icon={Leaf}
          title="Énergie" subtitle="Prends soin de toi" count={ENERGIE_TOTAL - energieNoted}
          done={energieNoted} total={ENERGIE_TOTAL}
          footer={streakDays > 0 ? `⚡ ${streakDays} jour${streakDays > 1 ? "s" : ""} d'affilée` : `${energieNoted}/${ENERGIE_TOTAL} notés`} />
        <BigCard onClick={onGoAgenda} accent="#38BDF8" bgFrom="#0C2136" Icon={CalendarDays}
          title="Agenda" subtitle="Du jour" count={eventsLeft}
          done={nbEvents - eventsLeft} total={nbEvents}
          footer={nbEvents === 0 ? "Rien de prévu" : eventsLeft === 0 ? "Tous passés ✓" : `Encore ${eventsLeft} !`} />
        <BigCard onClick={onGoDefi} accent="#F59E0B" bgFrom="#2E1E00" Icon={Target}
          title="Défis" subtitle="Défis & quiz du jour"
          count={2 - ((defiPresence || (defiTotal > 0 && defiDoneCount >= defiTotal) ? 1 : 0) + (quizAddressed ? 1 : 0))}
          done={(defiPresence || (defiTotal > 0 && defiDoneCount >= defiTotal) ? 1 : 0) + (quizAddressed ? 1 : 0)} total={2}
          footer={
            !quizAddressed && (defiPresence || (defiTotal > 0 && defiDoneCount >= defiTotal))
              ? "Encore le quiz du jour !"
              : quizAddressed && !(defiPresence || (defiTotal > 0 && defiDoneCount >= defiTotal))
              ? (defisPtsPossible > 0 ? `+${defisPtsPossible} pts possibles` : "Encore un défi à noter !")
              : (defiPresence || (defiTotal > 0 && defiDoneCount >= defiTotal)) && quizAddressed
              ? "Tout est fait ✓"
              : (defisPtsPossible > 0 ? `+${defisPtsPossible} pts possibles` : "Choisir un défi ou le quiz")
          } />
      </div>
    </div>
  );
}

function UrgencyDot({ urgency, size = 8 }) {
  const color = URGENCY_COLORS[urgency] || URGENCY_COLORS[2];
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

// ── Modifications de TodayView : ajouter le point d'urgence ─────────────────

function UpdateBanner({ onUpdate, onDismiss }) {
  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-between px-4 py-3 rounded-xl shadow-lg"
      style={{ background: C.surfaceRaised, border: `1px solid ${C.accent}88` }}>
      <div>
        <div className="text-sm font-semibold" style={{ color: C.text }}>Nouvelle version disponible</div>
        <div className="text-xs" style={{ color: C.textGhost }}>Rechargez pour profiter des dernières améliorations.</div>
      </div>
      <div className="flex gap-2 shrink-0 ml-3">
        <button onClick={onDismiss} className="text-xs px-2 py-1.5 rounded-md" style={{ color: C.textGhost, border: `1px solid ${C.borderStrong}` }}>Plus tard</button>
        <button onClick={onUpdate} className="text-xs font-bold px-3 py-1.5 rounded-md" style={{ background: C.accent, color: C.bg }}>Recharger</button>
      </div>
    </div>
  );
}

// ④ Bilan du soir
const BILAN_MSGS = [
  "Le mouvement juste n'est pas toujours le plus spectaculaire. Tu as avancé.",
  "Une journée bien menée. Ce que tu as semé aujourd'hui pousse demain.",
  "Chaque tâche cochée est une promesse tenue à toi-même.",
  "Rares sont les journées parfaites. Les tiennes valent mieux : elles sont vraies.",
  "Le cerveau a bien travaillé aujourd'hui. Laisse-le se reposer.",
];
function BilanSoirModal({ tasks, themes, dailyPoints, totalPoints, dailyDefi, defiLibrary, onClose }) {
  const today = todayISODate();
  const wbIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const doneTasks = tasks.filter((t) => !wbIds.has(t.themeId) && t.done && t.completedAt?.startsWith(today));
  const doneRituals = tasks.filter((t) => wbIds.has(t.themeId) && t.done && t.completedAt?.startsWith(today));
  const defiChecks = dailyDefi?.date === today ? Object.values(dailyDefi.checks || {}).reduce((s, c) => s + (c > 0 ? 1 : 0), 0) : 0;
  const defiTotal = dailyDefi?.date === today ? (dailyDefi.selectedIds || []).length : 0;
  const pts = dailyPoints?.[today] || 0;
  const medal = medalFor(totalPoints || 0);
  const msgIdx = (new Date().getDate() + doneTasks.length) % BILAN_MSGS.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(11,8,16,0.9)" }}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}>
        <div className="text-center">
          <div className="text-3xl mb-2">🌙</div>
          <div className="text-lg font-bold" style={{ color: C.text }}>Bilan de ta journée</div>
          <div className="text-xs mt-1" style={{ color: C.textGhost }}>{todayLabel()}</div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Tâches", value: doneTasks.length, icon: "✓" },
            { label: "Rituels", value: doneRituals.length, icon: "🌙" },
            { label: "Défis", value: `${defiChecks}/${defiTotal}`, icon: "🏆" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl py-3 text-center" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 18 }}>{item.icon}</div>
              <div className="text-xl font-black font-mono-num mt-1" style={{ color: C.text }}>{item.value}</div>
              <div className="text-[10px] uppercase tracking-wide" style={{ color: C.textGhost }}>{item.label}</div>
            </div>
          ))}
        </div>

        {pts > 0 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: C.accent + "18", border: `1px solid ${C.accent}55` }}>
            <span style={{ fontSize: 28 }}>{medal.emoji}</span>
            <div>
              <div className="text-sm font-bold" style={{ color: medal.color }}>+{pts} points aujourd'hui</div>
              <div className="text-xs" style={{ color: C.textDim }}>{totalPoints} pts au total · {medal.label}</div>
            </div>
          </div>
        )}

        <div className="rounded-xl px-4 py-3" style={{ background: C.surfaceRaised }}>
          <p className="font-display italic text-sm leading-snug" style={{ color: C.textDim }}>{BILAN_MSGS[msgIdx]}</p>
        </div>

        <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold"
          style={{ background: C.accent, color: C.bg }}>
          Bonne nuit ✨
        </button>
      </div>
    </div>
  );
}

function SlyInfoModal({ onClose }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 20 }}>ℹ️</span>
        <h3 className="text-base font-bold" style={{ color: C.text }}>Guide des symboles</h3>
      </div>
      <div className="space-y-2.5 max-h-[60vh] overflow-y-auto">
        {SLY_SYMBOL_LEGEND.map((item, i) => (
          <div key={i} className="flex gap-3 items-start">
            <span className="text-base shrink-0 w-10 text-center font-bold leading-tight" style={{ color: C.accentLight }}>{item.symbol}</span>
            <div>
              <div className="text-xs font-semibold" style={{ color: C.text }}>{item.label}</div>
              <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-semibold mt-2"
        style={{ background: C.accent, color: C.bg }}>
        Compris ✓
      </button>
    </div>
  );
}

// ── Écran de verrouillage : schéma à points à relier ──
function LockScreen({ mode, expected, onUnlock, onSet, onCancel }) {
  const [path, setPath] = useState([]);
  const [firstPattern, setFirstPattern] = useState(null);
  const [error, setError] = useState("");
  const [drawing, setDrawing] = useState(false);
  const gridRef = useRef(null);
  const [step, setStep] = useState(mode === "set" ? "draw1" : "unlock");

  const N = 3;
  const dots = Array.from({ length: N * N }, (_, i) => i);

  const pointFromEvent = (e) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const touch = e.touches ? e.touches[0] : e;
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const cell = rect.width / N;
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    if (col < 0 || col >= N || row < 0 || row >= N) return null;
    const idx = row * N + col;
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell / 2;
    const dist = Math.hypot(x - cx, y - cy);
    if (dist > cell * 0.42) return null;
    return idx;
  };

  const start = (e) => { setError(""); setDrawing(true); const p = pointFromEvent(e); setPath(p != null ? [p] : []); };
  const move = (e) => {
    if (!drawing) return;
    if (e.preventDefault) e.preventDefault();
    const p = pointFromEvent(e);
    if (p != null && !path.includes(p)) setPath([...path, p]);
  };
  const end = () => {
    if (!drawing) return;
    setDrawing(false);
    if (path.length < 3) { setError("Trop court — relie au moins 3 points."); setPath([]); return; }
    const code = path.join("-");
    if (mode === "unlock") {
      if (code === expected) onUnlock();
      else { setError("Schéma incorrect."); setPath([]); }
    } else {
      if (step === "draw1") { setFirstPattern(code); setStep("draw2"); setPath([]); }
      else {
        if (code === firstPattern) onSet(code);
        else { setError("Les deux schémas diffèrent. Recommence."); setStep("draw1"); setFirstPattern(null); setPath([]); }
      }
    }
  };

  const cellPct = (i) => ({ left: `${(i % N) * (100 / N) + (100 / N) / 2}%`, top: `${Math.floor(i / N) * (100 / N) + (100 / N) / 2}%` });

  const title = mode === "unlock" ? "Déverrouille l'appli"
    : step === "draw1" ? "Dessine ton schéma" : "Confirme ton schéma";

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }} className="flex flex-col items-center justify-center px-8">
      <div style={{ fontSize: 40, marginBottom: 8 }}>💚</div>
      <h2 className="text-lg font-bold mb-1" style={{ color: C.text }}>{title}</h2>
      <p className="text-xs mb-8 text-center" style={{ color: C.textGhost }}>
        {mode === "unlock" ? "Relie les points comme tu les as définis." : "Relie au moins 3 points."}
      </p>

      <div ref={gridRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ position: "relative", width: 260, height: 260, touchAction: "none" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          {path.slice(1).map((p, i) => {
            const a = cellPct(path[i]); const b = cellPct(p);
            return <line key={i} x1={a.left} y1={a.top} x2={b.left} y2={b.top} stroke={C.accent} strokeWidth="4" strokeLinecap="round" style={{ opacity: 0.8 }} />;
          })}
        </svg>
        {dots.map((i) => {
          const active = path.includes(i);
          const pos = cellPct(i);
          return (
            <div key={i} style={{ position: "absolute", left: pos.left, top: pos.top, transform: "translate(-50%,-50%)" }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%",
                background: active ? C.accent : "transparent",
                border: `2px solid ${active ? C.accent : C.borderStrong}`,
                transition: "all 0.15s" }} />
            </div>
          );
        })}
      </div>

      {error && <p className="text-xs mt-5" style={{ color: C.danger }}>{error}</p>}

      {mode !== "unlock" && (
        <button onClick={onCancel} className="mt-8 text-sm" style={{ color: C.textDim }}>Annuler</button>
      )}
    </div>
  );
}

function SlyTodo() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");
  const [openTheme, setOpenTheme] = useState(null);
  const [modal, setModal] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorDetail, setSaveErrorDetail] = useState("");
  const [pulseId, setPulseId] = useState(null);
  const [gemReward, setGemReward] = useState(null);
  const [showRituels, setShowRituels] = useState(false);
  const [showEnergie, setShowEnergie] = useState(false);
  const [showPointsDetail, setShowPointsDetail] = useState(false);
  const [showCoffre, setShowCoffre] = useState(false);
  const [openChecklistId, setOpenChecklistId] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [showSetLock, setShowSetLock] = useState(false);
  const [missionFilter, setMissionFilter] = useState(null);
  const [urgencyFilter, setUrgencyFilter] = useState(null);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [settingsSnapshot, setSettingsSnapshot] = useState(null);
  const [activeReminders, setActiveReminders] = useState([]);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const sound = useSoundSystem("sly", data?.settings?.sound);
  // Déstructuré ici (tôt), avant tout useEffect référençant ces champs dans ses
  // dépendances — sinon, TDZ ("Cannot access before initialization") si un
  // useEffect plus haut lit une valeur bare (ex. settings?.x) avant ce point.
  const { settings, equipment, equipmentRubriques, checklists, defiLibrary, dailyDefi, dailyPoints, totalPoints, streakDays, streakRecord, streakLastDate, books, wellnessLog, profile, notebooks, weightLogs, physActivities, espritItems, quizzes, quizSeenLog, quizDaily } = data || {};

  // Ces useMemo doivent être AVANT tout early return (règle des hooks React).
  // Quand data est null (chargement), on renvoie des tableaux vides.
  const tasks = useMemo(() => data?.tasks || [], [data]);
  const themes = useMemo(() => data?.themes || [], [data]);
  const todayTasks = useMemo(() => tasks.filter((t) => t.inToday).sort((a, b) => a.order - b.order), [tasks]);
  const wellbeingThemeIds = useMemo(() => new Set(themes.filter((th) => th.wellbeing).map((th) => th.id)), [themes]);
  const regularTodayTasks = useMemo(() => todayTasks.filter((t) => !wellbeingThemeIds.has(t.themeId) && !t.cancelled && t.kind !== "event" && t.kind !== "prestation"), [todayTasks, wellbeingThemeIds]);

  const pendingRef = useRef(null);
  const savingRef = useRef(false);
  const debounceRef = useRef(null);
  const fileInputRef = useRef(null);
  const [importMessage, setImportMessage] = useState(null);
  const [undoStack, setUndoStack] = useState(null); // { task, timeout }
  const [focusTask, setFocusTask] = useState(null); // task en mode focus
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showDefiMorning, setShowDefiMorning] = useState(false);
  const [showDefiReview, setShowDefiReview] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showBilanSoir, setShowBilanSoir] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const attemptSave = useCallback((attempt = 0) => {
    if (savingRef.current) return; // a write is already in flight; it will pick up the latest pendingRef when done
    if (!window.storage || typeof window.storage.set !== "function") {
      setSaveError(true);
      setSaveErrorDetail("stockage indisponible");
      return;
    }
    const payload = pendingRef.current;
    if (payload == null) return;
    savingRef.current = true;
    const call = attempt === 0
      ? window.storage.set(STORAGE_KEY, JSON.stringify(payload), false)
      : window.storage.set(STORAGE_KEY, JSON.stringify(payload)); // fallback: omit shared param on retry, in case that path is what's failing
    call
      .then((ok) => {
        savingRef.current = false;
        if (!ok) throw new Error("résultat vide");
        setSaveError(false);
        setSaveErrorDetail("");
        // if newer edits arrived while this write was in flight, save those too
        if (pendingRef.current !== payload) attemptSave(0);
      })
      .catch((e) => {
        savingRef.current = false;
        if (attempt < 2) {
          setTimeout(() => attemptSave(attempt + 1), 700 * (attempt + 1));
        } else {
          setSaveError(true);
          setSaveErrorDetail(e && e.message ? String(e.message).slice(0, 80) : "erreur inconnue");
        }
      });
  }, []);

  const persist = useCallback((next) => {
    setData((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      pendingRef.current = resolved;
      return resolved;
    });
    setSaveError(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => attemptSave(0), 300);
  }, [attemptSave]);

  const retrySave = () => attemptSave(0);

  // Passive background retry: if the write keeps failing (e.g. a transient
  // platform hiccup rather than something wrong with our data), keep trying
  // quietly every 20s instead of leaving the person stuck.
  useEffect(() => {
    if (!saveError) return;
    const id = setInterval(() => attemptSave(0), 20000);
    return () => clearInterval(id);
  }, [saveError, attemptSave]);

  // Event reminders — the day before, and one hour before. This only works
  // while the app is open (checked on load, then every minute): there is no
  // server here to deliver a real push notification while the app is closed.
  useEffect(() => {
    const fireReminder = (t, type) => {
      setActiveReminders((prev) =>
        prev.some((r) => r.id === t.id + "-" + type) ? prev : [...prev, { id: t.id + "-" + type, title: t.title, type }]
      );
      if (data?.settings?.soundEnabled !== false) {
        try { chime.done(); } catch (e) {}
      }
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(type === "eve" ? `Demain : ${t.title}` : `Dans l'heure : ${t.title}`, {
            body: type === "eve" ? "Cet événement est prévu demain." : "Cet événement commence dans moins d'une heure.",
          });
        } catch (e) {}
      }
    };

    const checkReminders = () => {
      if (!data) return;
      const today = todayISODate();
      const tomorrow = addDaysISO(1);
      const now = Date.now();
      let changed = false;
      const nextTasks = data.tasks.map((t) => {
        if (t.kind !== "event" || t.done || t.cancelled || !t.startDate) return t;
        let patch = null;
        if (t.startDate === tomorrow && !t.notifiedEve && new Date().getHours() >= 9) {
          fireReminder(t, "eve");
          patch = { notifiedEve: true };
        }
        if (t.startDate === today && t.time && !t.notifiedHour) {
          const eventTime = new Date(`${t.startDate}T${t.time}:00`).getTime();
          const diffMin = (eventTime - now) / 60000;
          if (diffMin <= 60 && diffMin >= 0) {
            fireReminder(t, "hour");
            patch = { ...(patch || {}), notifiedHour: true };
          }
        }
        if (patch) { changed = true; return { ...t, ...patch }; }
        return t;
      });
      if (changed) persist({ ...data, tasks: nextTasks });
    };

    checkReminders();
    const id = setInterval(checkReminders, 60000);
    return () => clearInterval(id);
  }, [data, persist]);

  // ③ Détection mise à jour service worker — propose un rechargement discret
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      const check = () => { if (reg.waiting) setShowUpdateBanner(true); };
      check();
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => { if (sw.state === "installed" && navigator.serviceWorker.controller) setShowUpdateBanner(true); });
      });
    });
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });
  }, []);

  // ④ Bilan du soir — déclenche à 20h si pas encore montré aujourd'hui
  useEffect(() => {
    if (!data) return;
    const h = new Date().getHours();
    if (h < 20) return;
    const today = todayISODate();
    const shownToday = data?.settings?.bilanShownDate === today;
    const hasDoneToday = tasks.some((t) => t.done && t.completedAt?.startsWith(today));
    if (!shownToday && hasDoneToday) setShowBilanSoir(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data]);

  // La fenêtre des défis ne s'ouvre plus automatiquement au démarrage
  // (accessible via la carte Défis de l'accueil).

  // ⑤ Yes man — tire au sort un jour du mois (une fois par mois, quand activé)
  useEffect(() => {
    if (!data) return;
    if (!settings?.yesManEnabled) return;
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    if (settings.yesManMonth === curMonth && settings.yesManDay) return;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const randomDay = 1 + Math.floor(Math.random() * daysInMonth);
    const iso = `${curMonth}-${String(randomDay).padStart(2, "0")}`;
    persist((prev) => ({ ...prev, settings: { ...prev.settings, yesManMonth: curMonth, yesManDay: iso } }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!data, settings?.yesManEnabled, settings?.yesManMonth]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setIsInstalled(true));
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);



  const applyMigrations = useCallback((parsedInput) => {
    // Toujours partir avec des valeurs par défaut pour les champs ajoutés
    // après la création initiale du compte — évite les crashes si un champ
    // manque dans des données sauvegardées avant son introduction.
    let parsed = {
      settings: { soundEnabled: true, sound: { ...SOUND_DEFAULT_SETTINGS } }, equipment: [], equipmentRubriques: [],
      defiLibrary: DEFI_LIBRARY.map((d) => ({ ...d })), dailyDefi: null, defiSettings: { mode: 'manual', count: 4 },
      quizzes: QUIZ_LIBRARY.map((t) => ({ ...t, questions: t.questions.map((q) => ({ ...q })) })),
      quizSeenLog: {}, quizDaily: null,
      dailyPoints: {}, totalPoints: 0,
      streakDays: 0, streakRecord: 0, streakLastDate: null, books: [], wellnessLog: {}, weightLogs: [], physActivities: DEFAULT_ACTIVITIES, espritItems: [], activityStreaks: {},
      coffreRewards: DEFAULT_REWARDS, coffreSpent: 0, coffreHistory: [],
      notebooks: [
        { id: "nb-recettes", name: "Recettes", emoji: "🍲", notes: [] },
        { id: "nb-livres", name: "Livres", emoji: "📚", notes: [] },
      ],
      profile: { name: "Sly", gender: "h", environment: "motivation", accentColor: "#8B5CF6", targetWeight: null, appTheme: "neutre" },
      ...parsedInput
    };
    const today = todayISODate();
    let changed = false;

    // Retrait du concept "bien-être" : on supprime le thème wellbeing et ses tâches.
    if (parsed.themes.some((th) => th.wellbeing)) {
      const wbIds = new Set(parsed.themes.filter((th) => th.wellbeing).map((th) => th.id));
      parsed = {
        ...parsed,
        themes: parsed.themes.filter((th) => !th.wellbeing),
        tasks: parsed.tasks.filter((t) => !wbIds.has(t.themeId)),
      };
      changed = true;
    }

    // v1 → v2 : (obsolète) Le concept "bien-être" a été retiré de l'app.
    // La migration ne ré-ajoute plus le thème bien-être.
    if (false) {
      const wellTheme = seedWellbeingTheme();
      const maxOrder = parsed.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
      parsed = {
        ...parsed,
        themes: [...parsed.themes, wellTheme],
        tasks: [...parsed.tasks, ...seedWellbeingTasks(wellTheme.id, maxOrder)],
      };
      changed = true;
    }

    // v2 → v3 : Renommage interne "Musique perso" → "Musique".
    // Correction d'un label de thème trop long introduit au démarrage.
    if (parsed.themes.some((th) => th.id === "th-musique" && th.name === "Musique perso")) {
      parsed = {
        ...parsed,
        themes: parsed.themes.map((th) => (th.id === "th-musique" && th.name === "Musique perso" ? { ...th, name: "Musique" } : th)),
      };
      changed = true;
    }

    // v3 → v4 : Import des tâches Korrigan / Musicalarue.
    // Importe une seule fois les ~254 tâches de préparation festival.
    // Le flag korriganChecklistImported évite la duplication lors de rechargements.
    if (!parsed.settings.korriganChecklistImported) {
      const korriganTheme = parsed.themes.find((th) => th.id === "th-korrigan");
      if (korriganTheme) {
        const maxOrder = parsed.tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
        parsed = {
          ...parsed,
          tasks: [...parsed.tasks, ...seedKorriganTasks(korriganTheme.id, maxOrder)],
          settings: { ...parsed.settings, korriganChecklistImported: true },
        };
        changed = true;
      }
    }

    // v4 → v5 : Ajout des rubriques de checklist équipement.
    // Les rubriques (catégories) ont été introduites après le système d'items plats.
    if (!parsed.equipmentRubriques || parsed.equipmentRubriques.length === 0) {
      parsed = { ...parsed, equipmentRubriques: seedEquipmentRubriques() };
      changed = true;
    }

    // v5 → v6 : Checklist équipement initiale pré-remplie.
    // Importée une seule fois, le flag empêche la duplication.
    if (!parsed.settings.equipmentChecklistImported) {
      parsed = {
        ...parsed,
        equipment: [...(parsed.equipment || []), ...seedEquipmentChecklist()],
        settings: { ...parsed.settings, equipmentChecklistImported: true },
      };
      changed = true;
    }

    // v6 → v7 : Migration des items d'équipement sans rubriqueId.
    // Anciens items créés avant le système de rubriques : on leur attribue
    // un rubriqueId dérivé de leur subcat pour maintenir le tri.
    if ((parsed.equipment || []).some((e) => !e.rubriqueId && e.subcat)) {
      parsed = {
        ...parsed,
        equipment: parsed.equipment.map((e) => (!e.rubriqueId && e.subcat ? { ...e, rubriqueId: "rub-" + e.subcat } : e)),
      };
      changed = true;
    }

    // v7 → v8 : Migration vers le système multi-checklists.
    // L'ancienne checklist unique (equipment + equipmentRubriques) devient
    // la première checklist nommée "Musicalarue". Idempotent via un flag.
    if (!parsed.checklists) parsed = { ...parsed, checklists: [] };
    if (!parsed.settings.checklistsMigrated) {
      const hasEquip = (parsed.equipment || []).length > 0 || (parsed.equipmentRubriques || []).length > 0;
      const alreadyHasMusicalarue = (parsed.checklists || []).some((c) => c.name === "Musicalarue");
      if (hasEquip && !alreadyHasMusicalarue) {
        const musicalarue = {
          id: "cl-" + Math.random().toString(36).slice(2, 9),
          name: "Musicalarue",
          emoji: "🎪",
          isTemplate: false,
          rubriques: parsed.equipmentRubriques || [],
          items: (parsed.equipment || []).map((e) => ({ id: e.id, title: e.title, rubriqueId: e.rubriqueId, status: e.status || "a_trouver" })),
        };
        parsed = { ...parsed, checklists: [...(parsed.checklists || []), musicalarue] };
      }
      parsed = { ...parsed, settings: { ...parsed.settings, checklistsMigrated: true } };
      changed = true;
    }
    // Liste de courses toujours disponible, épinglée en tête de la vue Checklists.
    if (!(parsed.checklists || []).some((c) => c.pinned && c.id === "cl-courses")) {
      const courses = {
        id: "cl-courses",
        name: "Liste de courses",
        emoji: "🛒",
        isTemplate: false,
        pinned: true,
        rubriques: [{ id: "rub-courses-gen", label: "À acheter" }],
        items: [],
      };
      parsed = { ...parsed, checklists: [courses, ...(parsed.checklists || [])] };
      changed = true;
    }


    // mais une passe idempotente à chaque démarrage :
    // - Remet en cours les tâches reportées dont la date est arrivée.
    // - Ajoute automatiquement au jour les tâches dans leur fenêtre startDate/endDate.
    // - Réinitialise les tâches récurrentes (daily/weekly/monthly) après leur cycle.
    // - Marque auto-done les événements passés non cochés.
    // - Normalise urgency (1–3) et ajoute le champ kind si absent (rétro-compat).
    parsed = {
      ...parsed,
      tasks: parsed.tasks.map((t) => {
        if (t.postponedTo && t.postponedTo <= today) {
          changed = true;
          return { ...t, inToday: true, postponedTo: null };
        }
        // Tâche faite un jour PRÉCÉDENT et non récurrente → sort d'aujourd'hui
        // (elle reste retrouvable via son historique / le filtre "Faites").
        if (t.done && !t.recurrence && t.inToday) {
          const doneDay = (t.lastDoneDate) || (t.completedAt ? t.completedAt.slice(0, 10) : null);
          // Si la date de complétion est manquante (données abîmées par un ancien bug),
          // on considère prudemment que c'est une tâche d'un jour passé — sinon elle
          // resterait bloquée dans "aujourd'hui" pour toujours, gonflant la jauge.
          if (!doneDay || doneDay < today) {
            changed = true;
            return { ...t, inToday: false };
          }
        }
        if (!t.inToday && !t.done && t.startDate && t.startDate <= today && today <= (t.endDate || t.startDate)) {
          changed = true;
          return { ...t, inToday: true };
        }
        if (t.recurrence && t.done && t.lastDoneDate && t.lastDoneDate !== today) {
          let dueForReset = false;
          if (t.recurrence === "daily") dueForReset = true;
          else if (t.recurrence === "weekly") dueForReset = today >= addDaysFromISO(t.lastDoneDate, 7);
          else if (t.recurrence === "monthly") dueForReset = today >= addMonthsFromISO(t.lastDoneDate, 1);
          if (dueForReset) {
            changed = true;
            return { ...t, done: false, lastDoneDate: null, inToday: true };
          }
        }
        if ((t.kind === "event" || t.kind === "prestation") && !t.done && !t.cancelled) {
          const windowEnd = t.endDate || t.startDate || t.dueDate;
          if (windowEnd && windowEnd < today) {
            changed = true;
            return { ...t, done: true, completedAt: `${windowEnd}T20:00:00.000Z` };
          }
        }
        if ((t.urgency || 2) > 3) {
          changed = true;
          return { ...t, urgency: 3, kind: t.kind || "task" };
        }
        if (!t.kind) {
          changed = true;
          return { ...t, kind: "task" };
        }
        if (!t.createdAt) {
          changed = true;
          // Recule d'un jour (plutôt que "maintenant") pour que "depuis N jours"
          // soit visible tout de suite, sans attendre 24h après la migration.
          return { ...t, createdAt: new Date(Date.now() - 86400000).toISOString() };
        }
        if (t.cancelled && t.inToday) {
          changed = true;
          return { ...t, inToday: false };
        }
        return t;
      }),
    };

    // v_quiz : Resynchronise le CONTENU des questions avec le code.
    // "quizzes" est une donnée persistée (copiée une seule fois depuis QUIZ_LIBRARY à la
    // création du compte) : sans ce correctif, toute modification des questions dans le code
    // (ajout, suppression, correction) ne s'affichait JAMAIS dans l'appli réelle, aussi
    // longtemps que le champ existait déjà en base — ce qui était le cas depuis longtemps.
    // La progression (quizSeenLog, quizDaily) est conservée : seul le contenu des questions
    // est remplacé par la version actuelle du code.
    if (parsed.settings?.quizLibraryVersion !== QUIZ_LIBRARY_VERSION) {
      parsed = {
        ...parsed,
        quizzes: QUIZ_LIBRARY.map((t) => ({ ...t, questions: t.questions.map((q) => ({ ...q })) })),
        settings: { ...parsed.settings, quizLibraryVersion: QUIZ_LIBRARY_VERSION },
      };
      changed = true;
    }

    return { parsed, changed };
  }, []);

  useEffect(() => {
    (async () => {
      let parsed;
      try {
        const res = await window.storage.get(STORAGE_KEY, false);
        parsed = res && res.value ? JSON.parse(res.value) : defaultData();
      } catch (e) {
        // Storage unavailable (e.g. viewing an unpublished preview) — still
        // seed sensible defaults instead of leaving the app truly empty.
        parsed = defaultData();
      }
      try {
        const { parsed: migrated, changed } = applyMigrations(parsed);
        setData(migrated);
        if (changed) {
          pendingRef.current = migrated;
          setTimeout(() => attemptSave(0), 300);
        }
      } catch (e) {
        setData(parsed);
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptSave, applyMigrations]);

  // Le rollover ci-dessus ne s'exécute qu'au chargement complet de l'app. Si l'app reste
  // ouverte en arrière-plan (PWA sur écran d'accueil) et que minuit passe sans redémarrage,
  // "Aujourd'hui" resterait figé sur les données de la veille. On revérifie donc la date
  // à chaque reprise au premier plan, et périodiquement en secours.
  const lastCheckedDateRef = useRef(todayISODate());
  useEffect(() => {
    const recheckDay = () => {
      const now = todayISODate();
      if (now === lastCheckedDateRef.current) return;
      lastCheckedDateRef.current = now;
      setData((prev) => {
        if (!prev) return prev;
        const { parsed: migrated, changed } = applyMigrations(prev);
        if (changed) {
          pendingRef.current = migrated;
          setTimeout(() => attemptSave(0), 300);
        }
        return migrated;
      });
    };
    const onVisibility = () => { if (!document.hidden) recheckDay(); };
    document.addEventListener("visibilitychange", onVisibility);
    const id = setInterval(recheckDay, 5 * 60 * 1000);
    return () => { document.removeEventListener("visibilitychange", onVisibility); clearInterval(id); };
  }, [applyMigrations, attemptSave]);

  if (loading || !data) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh" }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: C.accent }} size={28} />
      </div>
    );
  }

  // Verrouillage : si un schéma est défini et qu'on n'a pas encore déverrouillé
  const lockPattern = data.settings?.lockPattern || null;
  if (lockPattern && !unlocked) {
    applyTheme(data.profile?.appTheme || "neutre");
    return (
      <div className={`feerique-bg theme-${data.profile?.appTheme || "neutre"}`} style={{ minHeight: "100vh" }}>
        <LockScreen mode="unlock" expected={lockPattern} onUnlock={() => setUnlocked(true)} />
      </div>
    );
  }

  // (settings, equipment, etc. sont déstructurés plus haut, juste après data/loading,
  // pour être disponibles avant tout useEffect qui les référence dans ses dépendances.)
  // Applique le thème choisi (cosmos/jardin) avant tout rendu
  applyTheme(profile?.appTheme || "neutre");
  const wbCounts = {}; // Sly n'utilise pas de compteur wb (système Magali uniquement)
  const soundEnabled = settings?.soundEnabled !== false;

  const totalMinutes = todayTasks.reduce((sum, t) => sum + (!t.cancelled && typeof t.duration === "number" ? t.duration : 0), 0);
  const regularMinutes = regularTodayTasks.reduce((sum, t) => sum + (typeof t.duration === "number" ? t.duration : 0), 0);
  const regularBriefCount = regularTodayTasks.filter((t) => typeof t.duration !== "number").length;
  const regularDoneCount = regularTodayTasks.filter((t) => t.done).length;
  const regularPercent = regularTodayTasks.length ? (regularDoneCount / regularTodayTasks.length) * 100 : 0;
  const overloaded = totalMinutes > SELF_CARE_THRESHOLD_MIN || todayTasks.length > SELF_CARE_THRESHOLD_COUNT;
  const hasSelfCareTask = todayTasks.some((t) => t.selfCare);

  const urgencyMix = URGENCY.map((lvl) => ({
    ...lvl,
    count: regularTodayTasks.filter((t) => !t.done && (t.urgency || 2) === lvl.level).length,
  })).filter((x) => x.count > 0);

  const wellbeingTodayTasks = todayTasks.filter((t) => wellbeingThemeIds.has(t.themeId) && !t.cancelled);
  const wellbeingDoneCount = wellbeingTodayTasks.filter((t) => t.done).length;
  const wellbeingTotalCount = wellbeingTodayTasks.length;
  const wellbeingPercent = wellbeingTotalCount ? (wellbeingDoneCount / wellbeingTotalCount) * 100 : 0;

  const todayISO = todayISODate();
  const overdueReview = tasks.filter((t) => {
    if (t.done || t.cancelled) return false;
    if (t.kind === "event") return false; // un événement est une balise, jamais "en retard"
    const windowEnd = t.endDate || t.startDate;
    return (t.dueDate && t.dueDate < todayISO) || (windowEnd && windowEnd < todayISO);
  });

  const priorityTasks = [...tasks].sort((a, b) => {
    const aInactive = a.done || a.cancelled ? 1 : 0;
    const bInactive = b.done || b.cancelled ? 1 : 0;
    if (aInactive !== bInactive) return aInactive - bInactive;
    const urgencyDiff = (b.urgency || 2) - (a.urgency || 2);
    if (urgencyDiff !== 0) return urgencyDiff;
    const aDate = agendaAnchorDate(a) || "9999-99-99";
    const bDate = agendaAnchorDate(b) || "9999-99-99";
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    return a.order - b.order;
  });

  // Tâches issues des checklists (nature "tache"), présentées dans l'onglet Tâches.
  // Elles restent stockées dans leur checklist ; on les mappe en forme "tâche".
  const checklistTasks = (checklists || []).flatMap((cl) =>
    (cl.items || []).filter((it) => it.nature === "tache").map((it) => ({
      id: "cltask::" + cl.id + "::" + it.id,
      title: it.title,
      kind: "task",
      urgency: it.urgency || 2,
      done: it.status === "fait",
      themeId: null,
      duration: null,
      dueDate: null, startDate: null, endDate: null,
      _cl: { clId: cl.id, itemId: it.id, clName: cl.name, clEmoji: cl.emoji },
    }))
  );

  const addTheme = (name, color) => persist({ ...data, themes: [...themes, { id: "th-" + uid(), name, color }] });

  // ── Coffre à récompenses ──
  // Solde dépensable = total gagné à vie − déjà dépensé. Le total à vie ne bouge jamais.
  const coffreBalance = Math.max(0, (totalPoints || 0) - (data.coffreSpent || 0));
  const addReward = (emoji, name, cost) =>
    persist({ ...data, coffreRewards: [...(data.coffreRewards || []), { id: "rw-" + uid(), emoji: emoji || "🎁", name: name.trim(), cost: Math.max(0, parseInt(cost, 10) || 0) }] });
  const editReward = (id, patch) =>
    persist({ ...data, coffreRewards: (data.coffreRewards || []).map((r) => r.id === id ? { ...r, ...patch } : r) });
  const deleteReward = (id) =>
    persist({ ...data, coffreRewards: (data.coffreRewards || []).filter((r) => r.id !== id) });
  const claimReward = (id) => {
    const r = (data.coffreRewards || []).find((x) => x.id === id);
    if (!r) return;
    if (coffreBalance < r.cost) return; // pas assez de points
    const entry = { id: "clm-" + uid(), rewardId: r.id, emoji: r.emoji, name: r.name, cost: r.cost, date: todayISODate() };
    persist({ ...data, coffreSpent: (data.coffreSpent || 0) + r.cost, coffreHistory: [entry, ...(data.coffreHistory || [])] });
    setGemReward({ points: 0, key: Date.now() });
  };
  const editTheme = (id, name, color) =>
    persist({ ...data, themes: themes.map((t) => (t.id === id ? { ...t, name, color } : t)) });
  const deleteTheme = (id) => {
    persist({ ...data, themes: themes.filter((t) => t.id !== id), tasks: tasks.filter((t) => t.themeId !== id) });
    setOpenTheme(null);
  };

  const addTask = (fields) => {
    const today = todayISODate();
    const windowEnd = fields.endDate || fields.startDate;
    const autoToday = !!(fields.startDate && fields.startDate <= today && today <= windowEnd);
    persist((prev) => {
      const prevTasks = prev.tasks || [];
      const maxOrder = prevTasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
      return {
        ...prev,
        tasks: [
          ...prevTasks,
          {
            id: "tk-" + uid(),
            themeId: fields.themeId,
            title: fields.title,
            kind: fields.kind || "task",
            createdAt: new Date().toISOString(),
            duration: fields.duration,
            time: fields.time || null,
            allDay: !!fields.allDay,
            inToday: autoToday,
            done: false,
            cancelled: false,
            order: maxOrder + 1,
            urgency: fields.urgency || 2,
            recurrence: fields.recurrence || null,
            postponedTo: null,
            dueDate: fields.dueDate || null,
            startDate: fields.startDate || null,
            endDate: fields.endDate || null,
            notes: fields.notes || null,
            gigRole: fields.gigRole || null,
            gigLocation: fields.gigLocation || null,
            gigSchedule: fields.gigSchedule || null,
            checklistId: fields.checklistId || null,
            gigPayment: fields.gigPayment ?? null,
            gigSettled: !!fields.gigSettled,
            eventStatus: fields.eventStatus || null,
            organizer: fields.organizer || null,
            playlists: fields.playlists || null,
          },
        ],
      };
    });
  };
  // Duplique une tâche/événement/prestation à l'identique (nouvel id, non fait, non coché aujourd'hui).
  const duplicateTask = (id) => {
    persist((prev) => {
      const prevTasks = prev.tasks || [];
      const t = prevTasks.find((x) => x.id === id);
      if (!t) return prev;
      const maxOrder = prevTasks.reduce((m, x) => Math.max(m, x.order || 0), 0);
      return { ...prev, tasks: [...prevTasks, { ...t, id: "tk-" + uid(), order: maxOrder + 1, done: false, completedAt: null, inToday: false, cancelled: false }] };
    });
  };

  // "Fait… et à faire encore !" : pour une action réalisée mais pas résolue
  // (ex. un appel passé, mais il faut rappeler). Marque la tâche actuelle comme
  // faite (avec ses points), et recrée une tâche de suivi, sans date, non faite.
  const markDoneWithFollowUp = (id) => {
    const today = todayISODate();
    let ptsGained = 0;
    persist((prev) => {
      const prevTasks = prev.tasks || [];
      const t = prevTasks.find((x) => x.id === id);
      if (!t) return prev;
      const isWb = (prev.themes || []).some((th) => th.wellbeing && th.id === t.themeId);
      const pts = !isWb ? pointsForTask({ ...t, done: true }) : pointsForRitual();
      ptsGained = pts;
      const maxOrder = prevTasks.reduce((m, x) => Math.max(m, x.order || 0), 0);
      const followUp = {
        ...t, id: "tk-" + uid(), order: maxOrder + 1, done: false, completedAt: null,
        inToday: false, cancelled: false, startDate: null, endDate: null, dueDate: null,
        createdAt: new Date().toISOString(),
      };
      const newTasks = prevTasks.map((x) => x.id === id
        ? { ...x, done: true, completedAt: new Date().toISOString(), followUpCreated: true }
        : x
      ).concat(followUp);
      const prevDailyPoints = prev.dailyPoints || {};
      const prevDay = prevDailyPoints[today] || 0;
      return {
        ...prev,
        tasks: newTasks,
        dailyPoints: { ...prevDailyPoints, [today]: Math.max(0, prevDay + pts) },
        totalPoints: Math.max(0, (prev.totalPoints || 0) + pts),
      };
    });
    if (ptsGained > 0) setGemReward({ points: ptsGained, key: Date.now() });
  };

  const editTask = (id, patch) => persist((prev) => ({
    ...prev,
    tasks: prev.tasks.map((t) => {
      if (t.id !== id) return t;
      const merged = { ...t, ...patch };
      // Si la modification touche aux dates (cas du formulaire d'édition classique),
      // on réévalue si la tâche doit rester dans "Aujourd'hui" — sinon un déplacement
      // vers une date future peut la laisser coincée dans la liste du jour.
      if (("startDate" in patch || "dueDate" in patch || "endDate" in patch) && (merged.startDate || merged.dueDate)) {
        const today = todayISODate();
        const windowEnd = merged.endDate || merged.startDate;
        const coversToday = merged.dueDate === today || !!(merged.startDate && merged.startDate <= today && today <= windowEnd);
        merged.inToday = coversToday;
      }
      return merged;
    }),
  }));
  const deleteTask = (id) => {
    const task = tasks.find((t) => t.id === id);
    if (undoStack?.timeout) clearTimeout(undoStack.timeout);
    const timeout = setTimeout(() => { setUndoStack(null); }, 5000);
    setUndoStack({ task, timeout });
    persist({ ...data, tasks: tasks.filter((t) => t.id !== id) });
  };
  const undoDelete = () => {
    if (!undoStack?.task) return;
    clearTimeout(undoStack.timeout);
    persist({ ...data, tasks: [...tasks, undoStack.task] });
    setUndoStack(null);
  };

  const toggleToday = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const isUndated = !t.dueDate && !t.startDate;
    if (isUndated) {
      // Une tâche sans date n'est jamais vraiment "dans aujourd'hui" à l'affichage :
      // ce bouton l'y fait entrer pour de bon, avec une date du jour.
      editTask(id, { inToday: true, startDate: todayISODate() });
      return;
    }
    if (!t.inToday) {
      const maxOrder = tasks.reduce((m, x) => Math.max(m, x.order || 0), 0);
      editTask(id, { inToday: true, order: maxOrder + 1 });
    } else {
      editTask(id, { inToday: false });
    }
  };

  const toggleDone = (id, focusDelta = null) => {
    const today = todayISODate();
    let ptsGained = 0;
    let justCompleted = false;
    let noneLeftAfter = false;
    persist((prev) => {
      const prevTasks = prev.tasks || [];
      const t = prevTasks.find((x) => x.id === id);
      if (!t) return prev;
      const isWb = (prev.themes || []).some((th) => th.wellbeing && th.id === t.themeId);
      const willBeDone = !t.done;
      const patch = { done: willBeDone, completedAt: willBeDone ? new Date().toISOString() : null };
      // Une tâche sans date qu'on vient de faire : on considère qu'elle vient d'être
      // ajoutée à aujourd'hui à l'instant — elle doit compter dans les compteurs du jour.
      if (willBeDone && !t.dueDate && !t.startDate) { patch.startDate = today; patch.inToday = true; }
      // Une tâche datée d'un jour SUIVANT, faite en avance : on la fait "remonter" à
      // aujourd'hui plutôt que de la laisser sous sa date future — sinon elle resterait
      // invisible du jour où elle a réellement été traitée.
      else if (willBeDone && t.kind === "task") {
        const anchor = t.dueDate || t.startDate;
        if (anchor && anchor > today) {
          patch.startDate = today;
          patch.endDate = null;
          if (t.dueDate) patch.dueDate = today;
          patch.inToday = true;
        }
      }
      if (willBeDone && focusDelta !== null) patch.focusDelta = Math.round(focusDelta);
      else if (!willBeDone) patch.focusDelta = null;
      if (t.recurrence) patch.lastDoneDate = willBeDone ? today : null;
      const pts = willBeDone && !isWb ? pointsForTask({ ...t, done: true }) : willBeDone && isWb ? pointsForRitual() : 0;
      const prevDailyPoints = prev.dailyPoints || {};
      const prevDay = prevDailyPoints[today] || 0;
      const newDailyPoints = { ...prevDailyPoints, [today]: Math.max(0, prevDay + (willBeDone ? pts : -pts)) };
      const newTotal = Math.max(0, (prev.totalPoints || 0) + (willBeDone ? pts : -pts));
      const isActive = (iso) => (newDailyPoints[iso] || 0) > 0;
      const newStreak = tolerantStreakLength(isActive, today);
      const newRecord = Math.max(prev.streakRecord || 0, newStreak);
      ptsGained = willBeDone ? pts : 0;
      justCompleted = willBeDone;
      const newTasks = prevTasks.map((x) => x.id === id ? { ...x, ...patch } : x);
      noneLeftAfter = willBeDone && t.inToday && newTasks.filter((x) => x.inToday && !x.done).length === 0;
      return { ...prev, tasks: newTasks, dailyPoints: newDailyPoints, totalPoints: newTotal, streakDays: newStreak, streakRecord: newRecord, streakLastDate: today };
    });
    if (justCompleted && ptsGained > 0) setGemReward({ points: ptsGained, key: Date.now() });
    if (justCompleted && soundEnabled) {
      if (noneLeftAfter) sound.bigSuccess();
      else sound.taskComplete();
      setPulseId(id);
      setTimeout(() => setPulseId(null), 450);
    }
  };

  // Chantier : "Fait aujourd'hui" — coche pour la journée (compte dans les compteurs,
  // gagne des points), mais NE clôt PAS le chantier : ça se décoche tout seul demain.
  // Chantier : un seul état explicite qui avance toujours d'un cran au clic, en boucle :
  // Pas fait aujourd'hui → Fait aujourd'hui → On verra ça demain → Tâche terminée → (retour).
  // Un seul champ (chantierState + chantierStateDate) au lieu de plusieurs indicateurs
  // séparés qui pouvaient se désynchroniser — ici, il n'y a qu'un seul état possible à la fois.
  const advanceChantierState = (id) => {
    const today = todayISODate();
    let ptsGained = 0;
    persist((prev) => {
      const prevTasks = prev.tasks || [];
      const t = prevTasks.find((x) => x.id === id);
      if (!t) return prev;
      const validToday = t.chantierStateDate === today;
      const current = t.done ? "done" : (validToday && t.chantierState === "fait") ? "fait" : (validToday && t.chantierState === "demain") ? "demain" : "none";
      const order = ["none", "fait", "demain", "done"];
      const next = order[(order.indexOf(current) + 1) % order.length];

      let patch = {};
      let delta = 0;
      // Points accordés une seule fois par jour, à l'entrée dans "Fait aujourd'hui" —
      // pas de reprise/remboursement complexe sur les autres transitions.
      const alreadyAwardedToday = t.chantierPtsAwardedDate === today;
      if (next === "fait") {
        patch = { chantierState: "fait", chantierStateDate: today, done: false, completedAt: null };
        if (!alreadyAwardedToday) {
          delta = pointsForTask({ ...t, done: true, duration: t.duration || 15 });
          patch.chantierPtsAwardedDate = today;
        }
      } else if (next === "demain") {
        patch = { chantierState: "demain", chantierStateDate: today, done: false, completedAt: null };
      } else if (next === "done") {
        patch = { done: true, completedAt: new Date().toISOString() };
      } else {
        patch = { chantierState: null, chantierStateDate: null, done: false, completedAt: null };
      }
      ptsGained = delta;

      const newTasks = prevTasks.map((x) => x.id === id ? { ...x, ...patch } : x);
      const prevDailyPoints = prev.dailyPoints || {};
      const prevDay = prevDailyPoints[today] || 0;
      return {
        ...prev,
        tasks: newTasks,
        dailyPoints: delta ? { ...prevDailyPoints, [today]: Math.max(0, prevDay + delta) } : prev.dailyPoints,
        totalPoints: delta ? Math.max(0, (prev.totalPoints || 0) + delta) : prev.totalPoints,
      };
    });
    if (ptsGained > 0) setGemReward({ points: ptsGained, key: Date.now() });
  };

  const setUrgency = (id, level) => editTask(id, { urgency: level });

  const toggleCancelled = (id) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    editTask(id, { cancelled: !t.cancelled });
  };

  const postponeTask = (id, dateISO) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    // On DÉPLACE la tâche à la date indiquée :
    // - si elle avait une date d'échéance, on la met à jour
    // - sinon on cale son startDate (et on garde une trace via postponedTo)
    const patch = { postponedTo: dateISO, inToday: dateISO === todayISODate() };
    if (t.dueDate) patch.dueDate = dateISO;
    else patch.startDate = dateISO;
    // fin cohérente si une fin existait avant le début
    if (t.endDate && t.endDate < dateISO) patch.endDate = dateISO;
    editTask(id, patch);
  };
  // --- Actions groupées (sélection multiple dans la vue Tâches) ---
  const bulkMarkDone = (ids) => { ids.forEach((id) => { const t = tasks.find((x) => x.id === id); if (t && !t.done) toggleDone(id); }); };
  const bulkToggleCancel = (ids) => {
    persist((prev) => ({ ...prev, tasks: prev.tasks.map((t) => ids.includes(t.id) ? { ...t, cancelled: !t.cancelled } : t) }));
  };
  const bulkDelete = (ids) => {
    persist((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => !ids.includes(t.id)) }));
  };
  const bulkPostpone = (ids, dateISO) => {
    ids.forEach((id) => postponeTask(id, dateISO));
  };

  const cycleEquipmentStatus = (id) => {
    const eq = equipment.find((e) => e.id === id);
    if (!eq) return;
    const idx = EQUIPMENT_STATUS_ORDER.indexOf(eq.status);
    const next = EQUIPMENT_STATUS_ORDER[(idx + 1) % EQUIPMENT_STATUS_ORDER.length];
    persist({ ...data, equipment: equipment.map((e) => (e.id === id ? { ...e, status: next } : e)) });
  };

  const addEquipmentItem = (rubriqueId, title) => {
    persist({ ...data, equipment: [...equipment, { id: "eq-" + uid(), title, rubriqueId, status: "a_trouver" }] });
  };
  const editEquipmentItem = (id, patch) => {
    persist({ ...data, equipment: equipment.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
  };
  const deleteEquipmentItem = (id) => {
    persist({ ...data, equipment: equipment.filter((e) => e.id !== id) });
  };
  const addEquipmentRubrique = (label) => {
    persist({ ...data, equipmentRubriques: [...equipmentRubriques, { id: "rub-" + uid(), label }] });
  };
  const renameEquipmentRubrique = (id, label) => {
    persist({ ...data, equipmentRubriques: equipmentRubriques.map((r) => (r.id === id ? { ...r, label } : r)) });
  };
  const deleteEquipmentRubrique = (id) => {
    let rubriques = equipmentRubriques.filter((r) => r.id !== id);
    let fallback = rubriques.find((r) => r.label === "Sans rubrique");
    if (!fallback) {
      fallback = { id: "rub-" + uid(), label: "Sans rubrique" };
      rubriques = [...rubriques, fallback];
    }
    const nextEquipment = equipment.map((e) => (e.rubriqueId === id ? { ...e, rubriqueId: fallback.id } : e));
    persist({ ...data, equipmentRubriques: rubriques, equipment: nextEquipment });
  };

  // ── Système multi-checklists ──
  const updateChecklists = (fn) => persist((prev) => ({ ...prev, checklists: fn(prev.checklists || []) }));
  const addChecklist = (name, emoji, isTemplate) => {
    const cl = { id: "cl-" + uid(), name: name || "Nouvelle liste", emoji: emoji || "📋", isTemplate: !!isTemplate,
      rubriques: [{ id: "rub-" + uid(), label: "Général" }], items: [] };
    updateChecklists((cls) => [...cls, cl]);
    return cl.id;
  };
  const renameChecklist = (clId, name, emoji) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, name: name ?? c.name, emoji: emoji ?? c.emoji } : c));
  const deleteChecklist = (clId) => updateChecklists((cls) => cls.filter((c) => c.id !== clId));
  const toggleChecklistArchived = (clId) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, archived: !c.archived } : c));
  const setChecklistTemplate = (clId, isTemplate) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, isTemplate } : c));
  // Dupliquer une liste/modèle en nouvelle checklist (ou nouveau modèle)
  const duplicateChecklist = (clId, asTemplate) => {
    const src = (checklists || []).find((c) => c.id === clId);
    if (!src) return;
    const rubMap = {};
    const newRubs = src.rubriques.map((r) => { const nid = "rub-" + uid(); rubMap[r.id] = nid; return { id: nid, label: r.label }; });
    const newItems = src.items.map((it) => ({ id: "it-" + uid(), title: it.title, rubriqueId: rubMap[it.rubriqueId] || newRubs[0]?.id, status: "a_trouver" }));
    const copy = { id: "cl-" + uid(), name: src.name + (asTemplate ? " (modèle)" : " (copie)"), emoji: src.emoji, isTemplate: !!asTemplate, rubriques: newRubs, items: newItems };
    updateChecklists((cls) => [...cls, copy]);
  };
  // Fusionner les objets d'un modèle dans une checklist cible existante
  const mergeChecklistInto = (srcId, targetId) => {
    const src = (checklists || []).find((c) => c.id === srcId);
    const target = (checklists || []).find((c) => c.id === targetId);
    if (!src || !target) return;
    const rubMap = {};
    const addedRubs = [];
    src.rubriques.forEach((r) => {
      const existing = target.rubriques.find((tr) => tr.label.toLowerCase() === r.label.toLowerCase());
      if (existing) rubMap[r.id] = existing.id;
      else { const nid = "rub-" + uid(); rubMap[r.id] = nid; addedRubs.push({ id: nid, label: r.label }); }
    });
    const addedItems = src.items.map((it) => ({ id: "it-" + uid(), title: it.title, rubriqueId: rubMap[it.rubriqueId] || target.rubriques[0]?.id, status: "a_trouver" }));
    updateChecklists((cls) => cls.map((c) => c.id === targetId
      ? { ...c, rubriques: [...c.rubriques, ...addedRubs], items: [...c.items, ...addedItems] }
      : c));
  };
  // Items d'une checklist
  const addChecklistItem = (clId, title, rubriqueId, nature, urgency) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, items: [...c.items, {
      id: "it-" + uid(), title, rubriqueId,
      nature: nature || "objet",
      status: nature === "tache" ? "a_faire" : "a_trouver",
      urgency: nature === "tache" ? (urgency || 2) : undefined,
    }] } : c));
  const editChecklistItem = (clId, itemId, patch) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, items: c.items.map((it) => {
      if (it.id !== itemId) return it;
      const merged = { ...it, ...patch };
      // Si la nature change, on remet un statut cohérent
      if (patch.nature && patch.nature !== it.nature) {
        if (patch.nature === "tache") {
          merged.status = TACHE_STATUS_ORDER.includes(merged.status) ? merged.status : "a_faire";
          merged.urgency = merged.urgency || 2;
        } else {
          merged.status = OBJET_STATUS_ORDER.includes(merged.status) ? merged.status : "a_trouver";
          merged.urgency = undefined;
        }
      }
      return merged;
    }) } : c));
  const deleteChecklistItem = (clId, itemId) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, items: c.items.filter((it) => it.id !== itemId) } : c));
  const toggleChecklistItemCancelled = (clId, itemId) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, items: c.items.map((it) =>
      it.id === itemId ? { ...it, cancelled: !it.cancelled } : it) } : c));
  const cycleChecklistItemStatus = (clId, itemId) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, items: c.items.map((it) => {
      if (it.id !== itemId) return it;
      const isTache = it.nature === "tache";
      const order = isTache ? TACHE_STATUS_ORDER : OBJET_STATUS_ORDER;
      // Normaliser un ancien statut éventuel vers le 1er de l'ordre courant
      const cur = order.includes(it.status) ? it.status : order[0];
      const idx = order.indexOf(cur);
      return { ...it, status: order[(idx + 1) % order.length] };
    }) } : c));
  // Cocher/décocher une tâche de checklist depuis l'onglet Tâches
  const setChecklistTaskDone = (clId, itemId, done) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, items: c.items.map((it) =>
      it.id === itemId ? { ...it, status: done ? "fait" : "a_faire" } : it) } : c));
  const addChecklistRubrique = (clId, label) => {
    const nid = "rub-" + uid();
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, rubriques: [...c.rubriques, { id: nid, label }] } : c));
    return nid;
  };
  const renameChecklistRubrique = (clId, rubId, label) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, rubriques: c.rubriques.map((r) => r.id === rubId ? { ...r, label } : r) } : c));
  const deleteChecklistRubrique = (clId, rubId) =>
    updateChecklists((cls) => cls.map((c) => {
      if (c.id !== clId) return c;
      const rubriques = c.rubriques.filter((r) => r.id !== rubId);
      const items = c.items.filter((it) => it.rubriqueId !== rubId);
      return { ...c, rubriques, items };
    }));

  const addSelfCareBreak = () => {
    let perso = themes.find((th) => th.name.toLowerCase().includes("perso"));
    let nextData = data;
    if (!perso) {
      perso = { id: "th-" + uid(), name: "Perso", color: "#A78BFA" };
      nextData = { ...nextData, themes: [...themes, perso] };
    }
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    nextData = {
      ...nextData,
      tasks: [
        ...nextData.tasks,
        { id: "tk-" + uid(), themeId: perso.id, title: "Temps pour moi", duration: 30, time: null, inToday: true, done: false, order: maxOrder + 1, urgency: 2, selfCare: true },
      ],
    };
    persist(nextData);
  };

  const moveToday = (id, dir) => {
    const list = [...todayTasks];
    const idx = list.findIndex((t) => t.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx], b = list[swapIdx];
    persist({
      ...data,
      tasks: tasks.map((t) => {
        if (t.id === a.id) return { ...t, order: b.order };
        if (t.id === b.id) return { ...t, order: a.order };
        return t;
      }),
    });
  };

  const toggleSound = () => persist({ ...data, settings: { ...settings, soundEnabled: !soundEnabled } });

  const saveDailyDefi = (selectedIds) => {
    persist({ ...data, dailyDefi: { date: todayISODate(), selectedIds, checks: {}, review: null } });
    setShowDefiMorning(false);
  };
  const saveDefiSettings = (ds) => {
    persist({ ...data, settings: { ...settings, defi: ds } });
  };
  // ── Gestion de la bibliothèque de défis (créer / modifier / activer / supprimer) ──
  const addDefi = (text) => {
    const d = { id: "d-custom-" + uid(), text: text.trim(), custom: true, active: true };
    persist({ ...data, defiLibrary: [...(defiLibrary || []), d] });
    return d.id;
  };
  const editDefi = (id, text) =>
    persist({ ...data, defiLibrary: (defiLibrary || []).map((d) => d.id === id ? { ...d, text: text.trim() } : d) });
  const deleteDefi = (id) =>
    persist({ ...data, defiLibrary: (defiLibrary || []).filter((d) => d.id !== id) });
  const toggleDefiActive = (id) =>
    persist({ ...data, defiLibrary: (defiLibrary || []).map((d) => d.id === id ? { ...d, active: d.active === false ? true : false } : d) });
  // Ajouter un défi à la sélection du jour (depuis la carte)
  const addDefiToToday = (id) => {
    const t = todayISODate();
    const cur = (dailyDefi && dailyDefi.date === t) ? dailyDefi : { date: t, selectedIds: [], checks: {}, review: null };
    if (cur.selectedIds.includes(id)) return;
    persist({ ...data, dailyDefi: { ...cur, selectedIds: [...cur.selectedIds, id] } });
  };
  // Met à jour la série des défis (clé spéciale). Retourne le bonus de points.
  const bumpDefiStreak = (streaksObj) => {
    const t = todayISODate();
    const yd = addDaysISO(-1);
    const cur = streaksObj["__defi__"] || { count: 0, lastDate: null };
    if (cur.lastDate === t) return { streaks: streaksObj, bonus: 0 }; // déjà compté aujourd'hui
    let newCount;
    if (cur.lastDate === yd) newCount = cur.count + 1;
    else newCount = 1;
    const streaks = { ...streaksObj, "__defi__": { count: newCount, lastDate: t } };
    return { streaks, bonus: (newCount - 1) * 5 };
  };

  // Point de présence : +5 pts même sans défi relevé (une seule fois par jour)
  const markDefiPresence = () => {
    const t = todayISODate();
    const cur = (dailyDefi && dailyDefi.date === t) ? dailyDefi : { date: t, selectedIds: [], checks: {}, review: null };
    if (cur.presence) return; // déjà marqué
    const prevStreak = (data.activityStreaks || {})["__defi__"] || null;
    const { streaks, bonus } = bumpDefiStreak(data.activityStreaks || {});
    const prevDay = (dailyPoints || {})[t] || 0;
    const gain = 5 + bonus;
    persist({
      ...data,
      dailyDefi: { ...cur, presence: true, presenceGain: gain, presenceStreakBefore: prevStreak },
      activityStreaks: streaks,
      dailyPoints: { ...(dailyPoints || {}), [t]: prevDay + gain },
      totalPoints: (totalPoints || 0) + gain,
    });
    setGemReward({ points: gain, key: Date.now() });
  };
  // Annule le marquage "pas de défi aujourd'hui" : reprend exactement les points et la
  // série tels qu'ils étaient juste avant, plutôt que de tenter un recalcul approximatif.
  const unmarkDefiPresence = () => {
    const t = todayISODate();
    if (!dailyDefi || dailyDefi.date !== t || !dailyDefi.presence) return;
    const gain = dailyDefi.presenceGain || 0;
    const restoredStreaks = { ...(data.activityStreaks || {}) };
    if (dailyDefi.presenceStreakBefore) restoredStreaks["__defi__"] = dailyDefi.presenceStreakBefore;
    else delete restoredStreaks["__defi__"];
    const prevDay = (dailyPoints || {})[t] || 0;
    const { presence, presenceGain, presenceStreakBefore, ...rest } = dailyDefi;
    persist({
      ...data,
      dailyDefi: { ...rest, presence: false },
      activityStreaks: restoredStreaks,
      dailyPoints: { ...(dailyPoints || {}), [t]: Math.max(0, prevDay - gain) },
      totalPoints: Math.max(0, (totalPoints || 0) - gain),
    });
  };
  const awardQuizPoints = (points) => {
    if (!points) return;
    const today = todayISODate();
    persist((prev) => {
      const prevDayPts = (prev.dailyPoints || {})[today] || 0;
      return {
        ...prev,
        dailyPoints: { ...(prev.dailyPoints || {}), [today]: prevDayPts + points },
        totalPoints: (prev.totalPoints || 0) + points,
      };
    });
  };
  // Note la date de la dernière bonne réponse à une question — sert à repousser sa
  // réapparition dans les prochaines parties plutôt que de la reposer trop vite.
  const markQuizSeenIds = (ids) => {
    if (!ids || !ids.length) return;
    const today = todayISODate();
    persist((prev) => {
      const log = { ...(prev.quizSeenLog || {}) };
      ids.forEach((id) => { log[id] = today; });
      return { ...prev, quizSeenLog: log };
    });
  };
  // Joue le quiz aujourd'hui = compte pour la jauge du jour, comme les défis.
  const markQuizPlayedToday = () => {
    const today = todayISODate();
    persist((prev) => {
      const cur = (prev.quizDaily && prev.quizDaily.date === today) ? prev.quizDaily : { date: today };
      if (cur.played) return prev;
      return { ...prev, quizDaily: { ...cur, date: today, played: true } };
    });
  };
  // "Pas de quiz pour moi aujourd'hui" — validation explicite, +5 pts, compte pour la jauge.
  const dismissQuizToday = () => {
    const today = todayISODate();
    const cur = (quizDaily && quizDaily.date === today) ? quizDaily : { date: today };
    if (cur.played || cur.dismissed) return;
    const prevDay = (dailyPoints || {})[today] || 0;
    persist({
      ...data,
      quizDaily: { ...cur, dismissed: true },
      dailyPoints: { ...(dailyPoints || {}), [today]: prevDay + 5 },
      totalPoints: (totalPoints || 0) + 5,
    });
    setGemReward({ points: 5, key: Date.now() });
  };
  // Yes man — valide le défi du jour tiré au sort : +300 pts, une seule fois par date.
  const validateYesMan = () => {
    const today = todayISODate();
    if (settings?.yesManValidatedDate === today) return;
    const prevDay = (dailyPoints || {})[today] || 0;
    persist({
      ...data,
      settings: { ...settings, yesManValidatedDate: today },
      dailyPoints: { ...(dailyPoints || {}), [today]: prevDay + 300 },
      totalPoints: (totalPoints || 0) + 300,
    });
    setGemReward({ points: 300, key: Date.now() });
  };
  const logWellness = (key, value) => {
    const t = todayISODate();
    persist((prev) => {
      const prevWellnessLog = prev.wellnessLog || {};
      const dayLog = prevWellnessLog[t] || {};
      // Les clés "_pts_xxx" portent le montant de points de la dimension.
      // On crédite le DELTA par rapport à ce qui a déjà été accordé aujourd'hui
      // (permet de recalculer l'hydratation sans double compter).
      let delta = 0;
      let val = value;
      if (key.startsWith("_pts_")) {
        const already = dayLog[key] || 0;
        const target = typeof value === "number" ? value : 5;
        delta = target - already;
        val = target;
      }
      const newLog = { ...dayLog, [key]: val };
      const newData = { ...prev, wellnessLog: { ...prevWellnessLog, [t]: newLog } };
      if (delta !== 0) {
        const prevDay = (prev.dailyPoints || {})[t] || 0;
        newData.dailyPoints = { ...(prev.dailyPoints || {}), [t]: Math.max(0, prevDay + delta) };
        newData.totalPoints = Math.max(0, (prev.totalPoints || 0) + delta);
      }

      // ── Série hydratation : un jour est validé à partir de 6 verres ──
      if (key === "water") {
        const HYDRA_GOAL = 2;
        const prevWater = dayLog.water || 0;
        const wasReached = prevWater >= HYDRA_GOAL;
        const nowReached = val >= HYDRA_GOAL;
        if (wasReached !== nowReached) {
          const streaks = { ...(prev.activityStreaks || {}) };
          const yd = addDaysISO(-1);
          const cur = streaks["__hydra__"] || { count: 0, lastDate: null };
          let bonus = 0;
          if (nowReached && cur.lastDate !== t) {
            const newCount = cur.lastDate === yd ? cur.count + 1 : 1;
            streaks["__hydra__"] = { count: newCount, lastDate: t };
            bonus = (newCount - 1) * 5;
          } else if (!nowReached && cur.lastDate === t) {
            const back = Math.max(0, cur.count - 1);
            streaks["__hydra__"] = { count: back, lastDate: back > 0 ? yd : null };
            bonus = -(cur.count - 1) * 5;
          }
          newData.activityStreaks = streaks;
          if (bonus !== 0) {
            const pd = (newData.dailyPoints || {})[t] || 0;
            newData.dailyPoints = { ...(newData.dailyPoints || {}), [t]: Math.max(0, pd + bonus) };
            newData.totalPoints = Math.max(0, (newData.totalPoints ?? 0) + bonus);
          }
        }
      }
      if (delta > 0) setGemReward({ points: delta, key: Date.now() });
      return newData;
    });
  };
  // Pesée : marquer "pas de pesée aujourd'hui" — compte comme noté (+5 pts), sans valeur de poids.
  const skipWeighToday = () => logWellness("_peseeSkipped", true);
  // Pesée : +10 pts par 100 g perdus depuis la dernière pesée
  const logWeight = (value, previous) => {
    const t = todayISODate();
    let ptsGained = 0;
    persist((prev) => {
      const prevWeightLogs = prev.weightLogs || [];
      const entry = { date: t, value };
      const newLogs = [...prevWeightLogs.filter((w) => w.date !== t), entry].sort((a, b) => a.date.localeCompare(b.date));
      let pts = 0;
      if (previous != null && value < previous) {
        const grams = Math.round((previous - value) * 1000);
        pts = Math.floor(grams / 100) * 10;
      }
      ptsGained = pts;
      const newData = { ...prev, weightLogs: newLogs };
      if (pts > 0) {
        const prevDay = (prev.dailyPoints || {})[t] || 0;
        newData.dailyPoints = { ...(prev.dailyPoints || {}), [t]: prevDay + pts };
        newData.totalPoints = (prev.totalPoints || 0) + pts;
      }
      return newData;
    });
    if (ptsGained > 0) setGemReward({ points: ptsGained, key: Date.now() });
  };
  // Activité physique / Esprit : cocher un item crédite ses points (incrémentable = cumul)
  const logActivity = (dimId, itemId, pts, delta) => {
    const t = todayISODate();
    let gainedTotal = 0;
    persist((prev) => {
      const prevWellnessLog = prev.wellnessLog || {};
      const dayLog = prevWellnessLog[t] || {};
      const logKey = dimId === "silence" ? "espritLog" : "activities";
      const ptsKey = dimId === "silence" ? "_pts_esprit" : "_pts_activite";
      const itemLog = dayLog[logKey] || {};
      const streaks = { ...(prev.activityStreaks || {}) };
      const yd = addDaysISO(-1);

      const wasActiveToday = (itemLog[itemId] || 0) > 0; // déjà fait aujourd'hui ?
      let gained;
      let newItemLog;
      let willBeActive;

      if (delta === "skip") {
        // "Pas aujourd'hui" : ne compte ni comme fait ni comme série, juste un repère visuel.
        const prevVal = itemLog[itemId] || 0;
        const wasSkipped = prevVal === -1;
        newItemLog = { ...itemLog, [itemId]: wasSkipped ? 0 : -1 };
        gained = wasSkipped ? 0 : -Math.max(0, prevVal) * 0; // rien à rembourser (un item "skip" n'a jamais de points)
        willBeActive = false;
      } else if (delta === "set" || delta === "unset") {
        const prevVal = itemLog[itemId] || 0;
        if (delta === "unset") { gained = -Math.max(0, prevVal); newItemLog = { ...itemLog, [itemId]: 0 }; willBeActive = false; }
        else { gained = pts - Math.max(0, prevVal); newItemLog = { ...itemLog, [itemId]: pts }; willBeActive = true; }
      } else {
        const newCount = Math.max(0, (itemLog[itemId] || 0)) + delta;
        newItemLog = { ...itemLog, [itemId]: newCount };
        gained = pts * (newCount - Math.max(0, itemLog[itemId] || 0));
        willBeActive = newCount > 0;
      }

      // ── Gestion de la série ──
      // On (dé)compte la série uniquement au passage inactif↔actif dans la journée.
      let streakBonus = 0;
      if (!wasActiveToday && willBeActive) {
        // première validation du jour → on incrémente la série
        const cur = streaks[itemId] || { count: 0, lastDate: null };
        let newCount;
        if (cur.lastDate === t) newCount = cur.count;            // déjà compté aujourd'hui (sécurité)
        else if (cur.lastDate === yd) newCount = cur.count + 1;  // continuité
        else newCount = 1;                                        // (re)départ
        streaks[itemId] = { count: newCount, lastDate: t };
        streakBonus = (newCount - 1) * 5; // +5 par jour consécutif au-delà du 1er
      } else if (wasActiveToday && !willBeActive) {
        // on annule la validation du jour → on retire le jour de la série
        const cur = streaks[itemId] || { count: 0, lastDate: null };
        if (cur.lastDate === t) {
          const back = Math.max(0, cur.count - 1);
          streaks[itemId] = { count: back, lastDate: back > 0 ? yd : null };
          streakBonus = -(cur.count - 1) * 5; // on retire le bonus qu'on avait ajouté
        }
      }
      gained += streakBonus;
      gainedTotal = gained;

      const anyActive = Object.values(newItemLog).some((v) => (v || 0) > 0);
      const newLog = { ...dayLog, [logKey]: newItemLog, [ptsKey]: anyActive ? 1 : 0 };
      const prevDay = (prev.dailyPoints || {})[t] || 0;
      return {
        ...prev,
        wellnessLog: { ...prevWellnessLog, [t]: newLog },
        activityStreaks: streaks,
        dailyPoints: { ...(prev.dailyPoints || {}), [t]: Math.max(0, prevDay + gained) },
        totalPoints: Math.max(0, (prev.totalPoints || 0) + gained),
      };
    });
    if (gainedTotal > 0) setGemReward({ points: gainedTotal, key: Date.now() });
  };
  const editActivities = (dimId, action, itemId, payload) => {
    const field = dimId === "silence" ? "espritItems" : "physActivities";
    let list = [...(data[field] || [])];
    if (action === "add") list.push({ id: (dimId === "silence" ? "esp-" : "act-") + uid(), hidden: false, ...payload });
    else if (action === "delete") list = list.filter((a) => a.id !== itemId);
    else if (action === "toggle") list = list.map((a) => a.id === itemId ? { ...a, hidden: !a.hidden } : a);
    persist({ ...data, [field]: list });
  };
  const addNotebook = (name) => {
    const emoji = CARNET_EMOJIS[(notebooks || []).length % CARNET_EMOJIS.length];
    persist({ ...data, notebooks: [...(notebooks || []), { id: "nb-" + uid(), name, emoji, notes: [] }] });
  };
  const renameNotebook = (id, name) =>
    persist({ ...data, notebooks: (notebooks || []).map((n) => n.id === id ? { ...n, name } : n) });
  const deleteNotebook = (id) =>
    persist({ ...data, notebooks: (notebooks || []).filter((n) => n.id !== id) });
  const addNote = (nbId, title) => {
    const noteId = "nt-" + uid();
    persist({ ...data, notebooks: (notebooks || []).map((n) =>
      n.id === nbId ? { ...n, notes: [{ id: noteId, title, body: "" }, ...(n.notes || [])] } : n) });
    return noteId;
  };
  const updateNote = (nbId, noteId, patch) =>
    persist({ ...data, notebooks: (notebooks || []).map((n) =>
      n.id === nbId ? { ...n, notes: (n.notes || []).map((x) => x.id === noteId ? { ...x, ...patch } : x) } : n) });
  const deleteNote = (nbId, noteId) =>
    persist({ ...data, notebooks: (notebooks || []).map((n) =>
      n.id === nbId ? { ...n, notes: (n.notes || []).filter((x) => x.id !== noteId) } : n) });

  const addBook = () => {
    const title = prompt("Titre du livre :");
    if (!title?.trim()) return;
    const author = prompt("Auteur (optionnel) :") || "";
    const nb = { id: "bk-" + uid(), title: title.trim(), author, status: "a_lire", notes: "" };
    persist({ ...data, books: [...(books || []), nb] });
  };
  const toggleBook = (id) => {
    const b = (books || []).find((x) => x.id === id);
    if (!b) return;
    const next = b.status === "a_lire" ? "en_cours" : b.status === "en_cours" ? "lu" : "a_lire";
    persist({ ...data, books: (books || []).map((x) => x.id === id ? { ...x, status: next } : x) });
  };
  const deleteBook = (id) => persist({ ...data, books: (books || []).filter((x) => x.id !== id) });
  const checkDefi = (id, count) => {
    const newChecks = { ...(dailyDefi?.checks || {}), [id]: count };
    const today = todayISODate();
    const ptsD = count > 0 ? pointsForDefi(count) : 0;
    const prevDayD = dailyPoints[today] || 0;
    // Série défis : un défi relevé aujourd'hui valide le jour (bonus une seule fois/jour)
    let streaks = data.activityStreaks || {};
    let bonus = 0;
    const anyDoneToday = Object.values(newChecks).some((c) => (c || 0) > 0);
    if (count > 0 && anyDoneToday) {
      const r = bumpDefiStreak(streaks);
      streaks = r.streaks; bonus = r.bonus;
    }
    persist({ ...data, dailyDefi: { ...dailyDefi, checks: newChecks }, activityStreaks: streaks, dailyPoints: { ...dailyPoints, [today]: Math.max(0, prevDayD + ptsD + bonus) }, totalPoints: Math.max(0, (totalPoints || 0) + ptsD + bonus) });
    if (bonus > 0) setGemReward({ points: bonus, key: Date.now() });
  };
  const saveDefiReview = (result) => {
    persist({ ...data, dailyDefi: { ...dailyDefi, review: result } });
    setShowDefiReview(false);
  };
  const saveDefiLibrary = (lib) => {
    persist({ ...data, defiLibrary: lib });
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tout-doux-sly-${todayISODate()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    persist((prev) => ({ ...prev, settings: { ...prev.settings, lastBackupDate: todayISODate() } }));
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const incoming = JSON.parse(reader.result);
        const { parsed: migrated } = applyMigrations(incoming);
        persist(migrated);
        setImportMessage({ ok: true, text: "Données restaurées avec succès." });
      } catch (e) {
        setImportMessage({ ok: false, text: "Fichier illisible — vérifie que c'est bien un export de cette appli." });
      }
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
  };
  const quickAdd = () => setModal({ type: "addTask", payload: { themeId: themes[0]?.id } });

  // Navigation gérée par BottomNav

  return (
    <div className={`feerique-bg theme-${profile?.appTheme || "neutre"}`} style={{ minHeight: "100vh", color: C.text, position: "relative", "--user-accent": profile?.accentColor || C.accent }}>

      {showSetLock && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div className={`feerique-bg theme-${profile?.appTheme || "neutre"}`} style={{ minHeight: "100vh" }}>
            <LockScreen mode="set"
              onSet={(code) => { persist({ ...data, settings: { ...settings, lockPattern: code } }); setShowSetLock(false); setUnlocked(true); }}
              onCancel={() => setShowSetLock(false)} />
          </div>
        </div>
      )}

      {showUpdateBanner && (
        <UpdateBanner
          onUpdate={() => {
            navigator.serviceWorker.ready.then((reg) => {
              if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
            });
          }}
          onDismiss={() => setShowUpdateBanner(false)}
        />
      )}

      {showBilanSoir && (
        <BilanSoirModal
          tasks={tasks}
          themes={themes}
          dailyPoints={dailyPoints}
          totalPoints={totalPoints}
          dailyDefi={dailyDefi}
          defiLibrary={defiLibrary}
          onClose={() => {
            persist({ ...data, settings: { ...settings, bilanShownDate: todayISODate() } });
            setShowBilanSoir(false);
          }}
        />
      )}

      {gemReward && (
        <GemReward key={gemReward.key} points={gemReward.points} onEnd={() => setGemReward(null)} />
      )}

      {showThemePicker && (
        <ThemePickerModal
          themes={themes} selectedId={missionFilter}
          onSelect={setMissionFilter}
          onAddTheme={(name) => {
            const colors = PRESET_COLORS.map((c) => c.value);
            const nt = { id: "th-" + uid(), name, color: colors[themes.length % colors.length], wellbeing: false };
            persist({ ...data, themes: [...themes, nt] });
          }}
          onClose={() => setShowThemePicker(false)}
        />
      )}

      {showEnergie && (
        <EnergieModal
          wellnessToday={(wellnessLog || {})[todayISODate()] || {}}
          wellnessLog={wellnessLog}
          targetWeight={profile?.targetWeight}
          baseWeight={profile?.baseWeight}
          weightLogs={weightLogs}
          activities={physActivities}
          espritItems={espritItems}
          activityStreaks={data.activityStreaks || {}}
          onLog={logWellness}
          onLogWeight={logWeight}
          onSkipWeigh={skipWeighToday}
          onLogActivity={logActivity}
          onEditActivities={editActivities}
          onStartFocus={(t) => { setShowEnergie(false); setFocusTask(t); }}
          onClose={() => setShowEnergie(false)}
        />
      )}

      {showPointsDetail && (
        <PointsDetailModal data={data} tasks={tasks} themes={themes} onClose={() => setShowPointsDetail(false)} />
      )}

      {showCoffre && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, overflowY: "auto" }} className={`feerique-bg theme-${profile?.appTheme || "neutre"}`}>
          <CoffreView
            balance={coffreBalance}
            rewards={data.coffreRewards || []}
            history={data.coffreHistory || []}
            onAdd={addReward}
            onEdit={editReward}
            onDelete={deleteReward}
            onClaim={claimReward}
            onClose={() => setShowCoffre(false)}
          />
        </div>
      )}

      {showRituels && (
        <RituelsModal
          tasks={tasks} themes={themes}
          streakDays={streakDays || 0} streakRecord={streakRecord || 0}
          onToggleDone={toggleDone}
          onEditPoints={(id, pts) => editTask(id, { points: pts })}
          onClose={() => setShowRituels(false)}
        />
      )}

      {focusTask && (
        <FocusModeOverlay
          task={focusTask}
          onDone={(elapsed, allocated) => {
            const deltaSeconds = elapsed - allocated;
            editTask(focusTask.id, { focusElapsed: null });
            toggleDone(focusTask.id, deltaSeconds);
            setFocusTask(null);
          }}
          onAbandon={(elapsed) => {
            // Save progress so next "Focus" on this task resumes from here
            editTask(focusTask.id, { focusElapsed: elapsed });
            setFocusTask(null);
          }}
        />
      )}

      {showDefiMorning && (
        <DefiMorningModal
          defiLibrary={defiLibrary}
          todayDate={todayISODate()}
          defiSettings={data?.settings?.defi || { mode: "manual", count: 4 }}
          onSave={saveDailyDefi}
          onSkip={() => setShowDefiMorning(false)}
          onSaveLibrary={saveDefiLibrary}
          onSaveSettings={saveDefiSettings}
        />
      )}

      {showDefiReview && (
        <DefiReviewModal
          dailyDefi={dailyDefi}
          defiLibrary={defiLibrary}
          onCheck={checkDefi}
          onAddDefiToday={addDefiToToday}
          onAddDefi={addDefi}
          onEditDefi={editDefi}
          onDeleteDefi={deleteDefi}
          onToggleActive={toggleDefiActive}
          onMarkPresence={markDefiPresence}
          onUnmarkPresence={unmarkDefiPresence}
          defiStreak={(data.activityStreaks || {})["__defi__"]}
          onClose={() => setShowDefiReview(false)}
          quizzes={quizzes}
          quizThemeId={settings?.quizThemeId}
          onSetQuizTheme={(id) => persist({ ...data, settings: { ...settings, quizThemeId: id } })}
          onPlayQuiz={(themeId) => { setShowDefiReview(false); setModal({ type: "quiz", payload: themeId }); }}
          quizAddressedToday={quizDaily?.date === todayISODate() && (quizDaily.played || quizDaily.dismissed)}
          onDismissQuiz={dismissQuizToday}
        />
      )}

      {undoStack && (
        <div className="fixed bottom-24 left-4 right-4 z-40 flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ background: C.surfaceRaised, border: `1px solid ${C.borderStrong}` }}>
          <span className="text-sm" style={{ color: C.text }}>Tâche supprimée</span>
          <button onClick={undoDelete} className="text-sm font-semibold" style={{ color: C.accentLight }}>Annuler</button>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@600&display=swap');
        .font-display { font-family: 'Fraunces', serif; font-feature-settings: 'liga'; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono-num { font-family: 'JetBrains Mono', monospace; }
        .ring-glow { filter: drop-shadow(0 0 10px rgba(192,132,252,0.7)); }
        @keyframes feeriqueDrift {
          0%   { background-position: 0% 0%, 0% 0%, 0% 0%, 0% 0%, 0% 0%; }
          50%  { background-position: 3% 2%, -3% 3%, 2% -2%, -2% -3%, 0% 0%; }
          100% { background-position: -2% 3%, 2% -2%, -3% 2%, 3% 2%, 0% 0%; }
        }
        @keyframes tdTwinkle {
          0% { opacity: 0.18; transform: scale(1); }
          100% { opacity: 0.9; transform: scale(1.06); }
        }
        .feerique-bg {
          background-color: #14161C;
          background-size: 160% 160%, 150% 150%, 140% 140%, 150% 150%, 100% 100%;
          animation: feeriqueDrift 110s ease-in-out infinite alternate;
          background-image:
            radial-gradient(38% 30% at 15% 8%, rgba(120,160,220,0.14), transparent 70%),
            radial-gradient(34% 26% at 85% 14%, rgba(140,120,200,0.10), transparent 70%),
            radial-gradient(40% 32% at 22% 88%, rgba(90,130,180,0.08), transparent 70%),
            radial-gradient(34% 26% at 82% 82%, rgba(110,150,210,0.09), transparent 70%),
            radial-gradient(ellipse at top, #1c2029 0%, #14161C 58%);
        }
        .feerique-bg.theme-cosmos {
          background-color: #0B0810;
          background-size: 160% 160%, 150% 150%, 140% 140%, 150% 150%, 100% 100%;
          background-image:
            radial-gradient(38% 30% at 15% 8%, rgba(196,181,253,0.18), transparent 70%),
            radial-gradient(34% 26% at 88% 14%, rgba(232,121,249,0.13), transparent 70%),
            radial-gradient(42% 34% at 24% 90%, rgba(139,92,246,0.11), transparent 70%),
            radial-gradient(34% 26% at 80% 80%, rgba(196,181,253,0.09), transparent 70%),
            radial-gradient(ellipse at top, #1d1430 0%, #0B0810 58%);
        }
        .feerique-bg.theme-jardin {
          background-color: #F0D2E4;
          background-size: 160% 160%, 150% 150%, 140% 140%, 150% 150%, 100% 100%;
          background-image:
            radial-gradient(38% 30% at 16% 8%, rgba(201,88,156,0.16), transparent 70%),
            radial-gradient(34% 26% at 86% 14%, rgba(232,166,208,0.22), transparent 70%),
            radial-gradient(42% 34% at 24% 90%, rgba(216,140,44,0.09), transparent 70%),
            radial-gradient(34% 26% at 80% 80%, rgba(201,88,156,0.11), transparent 70%),
            radial-gradient(ellipse at top, #FDEBF6 0%, #F0D2E4 60%);
        }
        .feerique-bg.theme-jardin::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.5;
          animation: tdTwinkle 2.2s ease-in-out infinite alternate;
          background-image:
            radial-gradient(1.4px 1.4px at 14% 20%, rgba(176,46,126,0.55), transparent),
            radial-gradient(1px 1px at 34% 66%, rgba(216,140,44,0.4), transparent),
            radial-gradient(1.6px 1.6px at 60% 30%, rgba(201,88,156,0.5), transparent),
            radial-gradient(1px 1px at 78% 54%, rgba(216,140,44,0.35), transparent),
            radial-gradient(1.4px 1.4px at 90% 80%, rgba(176,46,126,0.45), transparent),
            radial-gradient(1px 1px at 8% 84%, rgba(201,88,156,0.35), transparent),
            radial-gradient(1.2px 1.2px at 48% 90%, rgba(216,140,44,0.35), transparent);
          background-repeat: repeat;
          background-size: 340px 340px;
        }
        .feerique-bg.theme-sable {
          background-color: #F6EAD5;
          background-size: 160% 160%, 150% 150%, 140% 140%, 150% 150%, 100% 100%;
          background-image:
            radial-gradient(38% 30% at 16% 8%, rgba(194,104,58,0.13), transparent 70%),
            radial-gradient(34% 26% at 86% 14%, rgba(224,164,124,0.19), transparent 70%),
            radial-gradient(42% 34% at 24% 90%, rgba(216,140,44,0.10), transparent 70%),
            radial-gradient(34% 26% at 80% 80%, rgba(194,104,58,0.09), transparent 70%),
            radial-gradient(ellipse at top, #FDF6EA 0%, #F6EAD5 60%);
        }
        .feerique-bg.theme-sable::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
          animation: tdTwinkle 2.2s ease-in-out infinite alternate;
          background-image:
            radial-gradient(1.4px 1.4px at 14% 20%, rgba(194,104,58,0.5), transparent),
            radial-gradient(1px 1px at 34% 66%, rgba(216,140,44,0.4), transparent),
            radial-gradient(1.6px 1.6px at 60% 30%, rgba(224,164,124,0.5), transparent),
            radial-gradient(1px 1px at 78% 54%, rgba(194,104,58,0.35), transparent),
            radial-gradient(1.4px 1.4px at 90% 80%, rgba(216,140,44,0.4), transparent),
            radial-gradient(1px 1px at 8% 84%, rgba(224,164,124,0.35), transparent),
            radial-gradient(1.2px 1.2px at 48% 90%, rgba(194,104,58,0.3), transparent);
          background-repeat: repeat;
          background-size: 340px 340px;
        }
        .feerique-bg.theme-nature {
          background-color: #E1EEDB;
          background-size: 160% 160%, 150% 150%, 140% 140%, 150% 150%, 100% 100%;
          background-image:
            radial-gradient(38% 30% at 16% 8%, rgba(59,142,78,0.14), transparent 70%),
            radial-gradient(34% 26% at 86% 14%, rgba(127,192,140,0.21), transparent 70%),
            radial-gradient(42% 34% at 24% 90%, rgba(95,174,112,0.12), transparent 70%),
            radial-gradient(34% 26% at 80% 80%, rgba(59,142,78,0.09), transparent 70%),
            radial-gradient(ellipse at top, #F1F8ED 0%, #E1EEDB 60%);
        }
        .feerique-bg.theme-nature::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.4;
          animation: tdTwinkle 2.2s ease-in-out infinite alternate;
          background-image:
            radial-gradient(1.4px 1.4px at 14% 20%, rgba(59,142,78,0.5), transparent),
            radial-gradient(1px 1px at 34% 66%, rgba(127,192,140,0.4), transparent),
            radial-gradient(1.6px 1.6px at 60% 30%, rgba(95,174,112,0.5), transparent),
            radial-gradient(1px 1px at 78% 54%, rgba(59,142,78,0.35), transparent),
            radial-gradient(1.4px 1.4px at 90% 80%, rgba(127,192,140,0.4), transparent),
            radial-gradient(1px 1px at 8% 84%, rgba(95,174,112,0.35), transparent),
            radial-gradient(1.2px 1.2px at 48% 90%, rgba(59,142,78,0.3), transparent);
          background-repeat: repeat;
          background-size: 340px 340px;
        }
        .feerique-bg::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.45;
          animation: tdTwinkle 2.2s ease-in-out infinite alternate;
          background-image:
            radial-gradient(1.4px 1.4px at 12% 18%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1px 1px at 32% 68%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1.6px 1.6px at 58% 28%, rgba(232,187,255,0.5), transparent),
            radial-gradient(1px 1px at 78% 55%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1.4px 1.4px at 90% 82%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1px 1px at 8% 85%, rgba(255,255,255,0.35), transparent),
            radial-gradient(1.2px 1.2px at 48% 90%, rgba(255,255,255,0.4), transparent);
          background-repeat: repeat;
          background-size: 340px 340px;

        }
        @keyframes pulseDone {
          0% { transform: scale(1); }
          40% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes tdUrgentDisc {
          0%, 100% { opacity: 0.25; box-shadow: 0 0 4px 1px var(--urgent-glow, rgba(251,191,36,0.5)); }
          50% { opacity: 0.65; box-shadow: 0 0 16px 6px var(--urgent-glow, rgba(251,191,36,0.5)); }
        }
        .td-urgent-disc {
          animation: tdUrgentDisc 2.6s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes tdCard100 {
          0%, 100% { box-shadow: 0 0 8px 1px var(--glow-100, rgba(250,204,21,0.55)); }
          50% { box-shadow: 0 0 22px 6px var(--glow-100, rgba(250,204,21,0.55)); }
        }
        .td-card-100 {
          animation: tdCard100 1.8s ease-in-out infinite;
        }
        .pulse-done { animation: pulseDone 0.45s ease; }
        @keyframes fabGlow {
          0%, 100% { box-shadow: 0 6px 24px rgba(139,92,246,0.5); }
          50% { box-shadow: 0 6px 30px rgba(232,121,249,0.55); }
        }
        .fab-glow { animation: fabGlow 2.8s ease-in-out infinite; }
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          20% { transform: scale(1.14); }
          35% { transform: scale(0.97); }
          50% { transform: scale(1.09); }
          70% { transform: scale(1); }
        }
        .heartbeat { animation-name: heartbeat; animation-timing-function: ease-in-out; animation-iteration-count: infinite; transform-origin: center; }
        @keyframes floatSparkle {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-38px) scale(1.1); opacity: 0; }
        }
        .float-sparkle { animation: floatSparkle 3.2s ease-in infinite; }
        @keyframes starTwinkle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        .star-twinkle { animation: starTwinkle 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
        @keyframes gentleBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        .gentle-breathe { animation: gentleBreathe 5s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) {
          .star-twinkle, .gentle-breathe, .pulse-done { animation: none !important; }
          * { transition-duration: 0.01ms !important; }
        }
      `}</style>

      <div className="max-w-md mx-auto pb-20 font-body" style={{ position: "relative", zIndex: 1 }}>
        <div className="px-5 pt-6 pb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold flex items-center gap-1.5" style={{ color: C.text }}>
            Tout doux...
            <Sparkles size={16} style={{ color: C.accentGlow }} />
          </h1>
          <div className="flex items-center gap-3">
            {installPrompt && !isInstalled && (
              <button
                onClick={async () => { installPrompt.prompt(); const r = await installPrompt.userChoice; if (r.outcome === "accepted") setIsInstalled(true); setInstallPrompt(null); }}
                className="text-xs font-semibold px-2.5 py-1.5 rounded-md"
                style={{ background: C.accent, color: C.bg }}
                aria-label="Installer l'application"
              >
                Installer
              </button>
            )}
            {saveError && (
              <button onClick={retrySave} aria-label="Sauvegarde en échec, toucher pour réessayer" style={{ color: C.danger }}>
                <CloudOff size={18} />
              </button>
            )}
            <button onClick={() => setModal({ type: "search" })} style={{ color: C.textFaint }} aria-label="Rechercher">
              <Search size={18} />
            </button>
            <button onClick={exportData} title="Sauvegarder mes données maintenant" aria-label="Sauvegarder" style={{ color: C.textFaint, position: "relative" }}>
              <Download size={18} />
              {(() => {
                const last = settings?.lastBackupDate;
                const stale = !last || (new Date(todayISODate()) - new Date(last)) / 86400000 >= 1;
                return stale ? (
                  <span style={{ position: "absolute", top: -2, right: -2, width: 8, height: 8, borderRadius: 999, background: "#F59E0B" }} />
                ) : null;
              })()}
            </button>
            <button onClick={() => setTab("settings")} style={{ color: tab === "settings" ? C.accentLight : C.textFaint }} aria-label="Réglages">
              <Settings size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; }}
            />
          </div>
        </div>

        {importMessage && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: importMessage.ok ? C.surfaceRaised : "#2A1420", border: `1px solid ${importMessage.ok ? C.borderStrong : "#5C1E33"}`, color: importMessage.ok ? C.accentLight : "#FCA5B8" }}>
            {importMessage.text}
          </div>
        )}

        {saveError && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg flex items-center justify-between gap-3" style={{ background: "#2A1420", border: "1px solid #5C1E33" }}>
            <span className="text-xs truncate" style={{ color: "#FCA5B8" }}>
              Sauvegarde impossible{saveErrorDetail ? ` · ${saveErrorDetail}` : ""}
            </span>
            <button onClick={retrySave} className="text-xs font-semibold shrink-0 underline" style={{ color: C.text }}>
              Réessayer
            </button>
          </div>
        )}



        {HOME_TABS.includes(tab) && (
          <>
            {tab === "today" && (
              <TodayDashboard
                greeting={greeting(profile?.name, profile?.gender)}
                profile={profile}
                allTasks={tasks}
                yesManActive={settings?.yesManEnabled && settings?.yesManDay === todayISODate()}
                yesManValidated={settings?.yesManValidatedDate === todayISODate()}
                onValidateYesMan={validateYesMan}
                regularTodayTasks={regularTodayTasks}
                regularDoneCount={regularDoneCount}
                regularPercent={regularPercent}
                wellbeingDoneCount={wellbeingDoneCount}
                wellbeingTotalCount={wellbeingTotalCount}
                wellbeingPercent={wellbeingPercent}
                dailyDefi={dailyDefi}
                defiLibrary={defiLibrary}
                quizDaily={quizDaily}
                wbCounts={wbCounts}
                streakDays={streakDays || 0}
                streakRecord={streakRecord || 0}
                totalPoints={totalPoints || 0}
                dailyPoints={dailyPoints || {}}
                themes={themes}
                todayTasks={todayTasks}
                pulseId={pulseId}
                onToggleDone={toggleDone}
                onRemove={toggleToday}
                onMove={moveToday}
                onEdit={(t) => setModal({ type: "taskActions", payload: t })}
                onStartFocus={(t) => setFocusTask(t)}
                onCheckDefi={checkDefi}
                onMarkDone={toggleDone}
                onCancelTask={toggleCancelled}
                onAddToToday={(id) => { editTask(id, { inToday: true, postponedTo: null, startDate: todayISODate() }); }}
                onDeleteTask={deleteTask}
                onGoAgenda={() => setTab("agenda")}
                onGoTasks={() => setTab("priorities")}
                onGoChecklist={() => setTab("equipment")}
                onGoResources={() => setTab("resources")}
                onGoSettings={() => { setSettingsSnapshot(data); setTab("settings"); }}
                onGoRituels={() => setShowEnergie(true)}
                onGoDefi={() => setShowDefiReview(true)}
                onGoStats={() => setTab("stats")}
                onOpenProgress={() => setModal({ type: "progress" })}
                onGoWellness={() => setTab("priorities")}
                eventsToday={tasks.filter((t) => t.kind === "event" && !t.cancelled && taskCoversDate(t, todayISODate())).length}
                eventsList={tasks.filter((t) => t.kind === "event" && !t.cancelled && taskCoversDate(t, todayISODate())).sort((a,b) => (a.time||"").localeCompare(b.time||""))}
                wellnessToday={(wellnessLog || {})[todayISODate()] || {}}
                weightLogs={weightLogs}
                onLogWellness={logWellness}
                onShowPointsDetail={() => setShowPointsDetail(true)}
                onGoCoffre={() => setShowCoffre(true)}
                coffreBalance={coffreBalance}
                hasSelfCareTask={hasSelfCareTask}
                onAddSelfCare={addSelfCareBreak}
                totalMinutes={totalMinutes}
              />
            )}
            {tab === "priorities" && (
              <>
                <div className="px-5 pt-4 flex items-center gap-2">
                  <button onClick={() => setTab("today")} className="flex items-center gap-1 p-1 -ml-1" style={{ color: C.textDim }}>
                    <ChevronLeft size={20} />
                    <span className="text-sm font-semibold">Retour</span>
                  </button>
                </div>
                {/* Ligne 1 : thème */}
                <div className="px-5 pt-4 flex gap-2">
                  <button onClick={() => setMissionFilter(null)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
                    style={{ background: missionFilter === null ? C.accent : C.surface,
                      color: missionFilter === null ? C.bg : C.textDim,
                      border: `1px solid ${missionFilter === null ? C.accent : C.border}` }}>
                    Tous les dossiers
                  </button>
                  <button onClick={() => setShowThemePicker(true)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                    style={{ background: missionFilter ? (themes.find((th) => th.id === missionFilter)?.color || C.accent) : C.surface,
                      color: missionFilter ? C.bg : C.textDim,
                      border: `1px solid ${missionFilter ? (themes.find((th) => th.id === missionFilter)?.color || C.accent) : C.border}` }}>
                    {missionFilter ? (themes.find((th) => th.id === missionFilter)?.name || "Sélection") : "Sélection"}
                    <ChevronDown size={14} />
                  </button>
                </div>

                <TodayView
                  tasks={(() => {
                    let list = [...tasks, ...checklistTasks];
                    if (missionFilter) list = list.filter((t) => t.themeId === missionFilter);
                    return list;
                  })()}
                  themes={themes}
                  pulseId={pulseId}
                  onToggleDone={(id) => {
                    // Tâche de checklist ?
                    if (typeof id === "string" && id.startsWith("cltask::")) {
                      const [, clId, itemId] = id.split("::");
                      const cl = (checklists || []).find((c) => c.id === clId);
                      const it = cl?.items.find((x) => x.id === itemId);
                      setChecklistTaskDone(clId, itemId, it ? it.status !== "fait" : true);
                    } else {
                      toggleDone(id);
                    }
                  }}
                  onRemove={toggleToday}
                  onAdvanceChantierState={advanceChantierState}
                  onMove={moveToday}
                  onEdit={(t) => { if (t._cl) { setTab("equipment"); setOpenChecklistId(t._cl.clId); } else { setModal({ type: "taskActions", payload: t }); } }}
                  onViewDetails={(t) => setModal({ type: "taskDetail", payload: t })}
                  onGoThemes={() => setTab("themes")}
                  onStartFocus={(t) => setFocusTask(t)}
                  dateMode={true}
                  priorityTaskId={regularTodayTasks.filter((t) => !t.done).sort((a,b) => (b.urgency||2)-(a.urgency||2))[0]?.id}
                  onBulkMarkDone={bulkMarkDone}
                  onBulkToggleCancel={bulkToggleCancel}
                  onBulkPostpone={(ids) => setModal({ type: "bulkPostpone", payload: ids })}
                  onBulkDelete={bulkDelete}
                />
              </>
            )}
            {tab === "equipment" && (() => {
              const openCl = (checklists || []).find((c) => c.id === openChecklistId);
              if (openCl) {
                return (
                  <ChecklistDetailView
                    checklist={openCl}
                    onBack={() => setOpenChecklistId(null)}
                    onCycleStatus={(itemId) => cycleChecklistItemStatus(openCl.id, itemId)}
                    onAddItem={(title, rubId, nature, urgency) => addChecklistItem(openCl.id, title, rubId, nature, urgency)}
                    onEditItem={(itemId, patch) => editChecklistItem(openCl.id, itemId, patch)}
                    onDeleteItem={(itemId) => deleteChecklistItem(openCl.id, itemId)}
                    onToggleCancelled={(itemId) => toggleChecklistItemCancelled(openCl.id, itemId)}
                    onAddRubrique={(label) => addChecklistRubrique(openCl.id, label)}
                    onRenameRubrique={(rubId, label) => renameChecklistRubrique(openCl.id, rubId, label)}
                    onDeleteRubrique={(rubId) => deleteChecklistRubrique(openCl.id, rubId)}
                    onRename={(name) => renameChecklist(openCl.id, name)}
                    onChangeEmoji={(emoji) => renameChecklist(openCl.id, null, emoji)}
                    onDeleteChecklist={() => { if (confirm("Supprimer cette checklist ?")) { deleteChecklist(openCl.id); setOpenChecklistId(null); } }}
                    linkedTasks={tasks.filter((t) => t.checklistId === openCl.id && !t.cancelled)}
                    themes={themes}
                    onCreateLinkedTask={(titleText) => addTask({ title: titleText, themeId: themes[0]?.id, kind: "task", duration: "indeterminee", checklistId: openCl.id })}
                    onEditLinkedTask={(t) => setModal({ type: "taskActions", payload: t })}
                    onToggleLinkedTaskDone={(id) => toggleDone(id)}
                  />
                );
              }
              return (
                <ChecklistsView
                  checklists={checklists}
                  onOpen={(id) => setOpenChecklistId(id)}
                  onAddChecklist={(name, emoji, isTpl) => addChecklist(name, emoji, isTpl)}
                  onRenameChecklist={(id, name) => renameChecklist(id, name)}
                  onTemplateAction={(action, id) => {
                    if (action === "delete") { if (confirm("Supprimer ce modèle ?")) deleteChecklist(id); }
                    else if (action === "toChecklist") { duplicateChecklist(id, false); }
                    else if (action === "duplicateTpl") { duplicateChecklist(id, true); }
                    else if (action === "mergeInto") { setModal({ type: "mergeChecklist", payload: id }); }
                  }}
                  onToggleArchived={toggleChecklistArchived}
                  onDeleteChecklist={deleteChecklist}
                  tasks={tasks}
                />
              );
            })()}
            {tab === "resources" && (
              <CarnetsView
                notebooks={notebooks}
                onAddNotebook={addNotebook}
                onRenameNotebook={renameNotebook}
                onDeleteNotebook={deleteNotebook}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
              />
            )}
          </>
        )}

        {tab === "agenda" && (
          <AgendaView
            tasks={tasks}
            themes={themes}
            onEdit={(t) => setModal({ type: "taskActions", payload: t })}
            onAddOnDate={(dateISO) => setModal({ type: "addTask", payload: { themeId: themes[0]?.id, kind: "event", startDate: dateISO } })}
            onToggleDone={toggleDone}
            onViewDetails={(t) => setModal({ type: "taskDetail", payload: t })}
          />
        )}

        {tab === "history" && <HistoryView tasks={tasks} themes={themes} />}
        {tab === "stats" && <StatsView data={data} tasks={tasks} themes={themes} />}
        {tab === "settings" && (
          <SettingsView
            settings={settings} data={data} persist={persist} themes={themes}
            openTheme={openTheme} setOpenTheme={setOpenTheme}
            onOpenTheme={(th) => { setOpenTheme(th); setTab("themes"); }}
            onAddTheme={() => setModal({ type: "addTheme" })}
            exportData={exportData} fileInputRef={fileInputRef} importData={importData}
            onSetLock={() => setShowSetLock(true)}
            onGoStats={() => setTab("stats")}
            notifPermission={notifPermission}
            onRequestNotif={() => {
              if (typeof Notification === "undefined") return;
              if (Notification.permission === "default") {
                Notification.requestPermission().then((p) => setNotifPermission(p));
              } else {
                setNotifPermission(Notification.permission);
              }
            }}
            onOpenInfo={() => setModal({ type: "info" })}
            onOk={() => setTab("today")}
            onCancel={() => { if (settingsSnapshot) persist(settingsSnapshot); setTab("today"); }}
          />
        )}

        {tab === "themes" && !openTheme && (
          <ThemesList themes={themes} tasks={tasks} onOpen={setOpenTheme} onAddTheme={() => setModal({ type: "addTheme" })} />
        )}

        {tab === "themes" && openTheme && (
          <ThemeDetail
            theme={themes.find((t) => t.id === openTheme)}
            tasks={tasks.filter((t) => t.themeId === openTheme)}
            onBack={() => setOpenTheme(null)}
            onEditTheme={(t) => setModal({ type: "editTheme", payload: t })}
            onDeleteTheme={deleteTheme}
            onAddTask={() => setModal({ type: "addTask", payload: { themeId: openTheme } })}
            onEditTask={(t) => setModal({ type: "taskActions", payload: t })}
            onDeleteTask={deleteTask}
            onToggleToday={toggleToday}
          />
        )}
      </div>

      <BottomNav
        tab={tab}
        onTabChange={(id) => { if (id === "settings") setSettingsSnapshot(data); setTab(id); setOpenTheme(null); }}
        onFAB={quickAdd}
      />

      {modal && (
        <Modal onClose={() => setModal(null)}>
          {modal.type === "gaugeDetail" && (
            <GaugeDetailModal
              kind={modal.payload.kind}
              percent={modal.payload.kind === "moon" ? wellbeingPercent : regularPercent}
              doneCount={modal.payload.kind === "moon" ? wellbeingDoneCount : regularDoneCount}
              totalCount={modal.payload.kind === "moon" ? wellbeingTotalCount : regularTodayTasks.length}
              briefCount={regularBriefCount}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "checklistModel" && (
            <ChecklistModelModal
              rubriques={equipmentRubriques}
              onCancel={() => setModal(null)}
              onApply={(model) => {
                let rubs = [...equipmentRubriques];
                const getOrCreateRub = (label) => {
                  let r = rubs.find((r) => r.label === label);
                  if (!r) { r = { id: "rub-" + uid(), label }; rubs = [...rubs, r]; }
                  return r;
                };
                const newItems = model.items.map((it) => {
                  const rub = getOrCreateRub(it.rub);
                  return { id: "eq-" + uid(), title: it.title, rubriqueId: rub.id, status: "a_trouver" };
                });
                persist({ ...data, equipmentRubriques: rubs, equipment: [...equipment, ...newItems] });
                setModal(null);
              }}
            />
          )}
          {modal.type === "addEquipment" && (
            <EquipmentItemForm
              rubriques={equipmentRubriques}
              onCancel={() => setModal(null)}
              onSave={(title, rubriqueId) => { addEquipmentItem(rubriqueId, title); setModal(null); }}
            />
          )}
          {modal.type === "editEquipment" && (
            <EquipmentItemForm
              initial={modal.payload}
              rubriques={equipmentRubriques}
              onCancel={() => setModal(null)}
              onDelete={() => { deleteEquipmentItem(modal.payload.id); setModal(null); }}
              onSave={(title, rubriqueId) => { editEquipmentItem(modal.payload.id, { title, rubriqueId }); setModal(null); }}
            />
          )}
          {modal.type === "manageRubriques" && (
            <RubriqueManagerModal
              rubriques={equipmentRubriques}
              onRename={renameEquipmentRubrique}
              onDelete={deleteEquipmentRubrique}
              onAdd={addEquipmentRubrique}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "mergeChecklist" && (() => {
            const srcId = modal.payload;
            const targets = (checklists || []).filter((c) => c.id !== srcId);
            return (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>Ajouter les objets du modèle à…</h3>
                {targets.length === 0 ? (
                  <p className="text-sm" style={{ color: C.textGhost }}>Aucune autre checklist. Crée-en une d'abord.</p>
                ) : (
                  <div className="space-y-2">
                    {targets.map((c) => (
                      <button key={c.id} onClick={() => { mergeChecklistInto(srcId, c.id); setModal(null); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                        <span>{c.emoji}</span>
                        <span className="text-sm flex-1" style={{ color: C.text }}>{c.name}{c.isTemplate ? " (modèle)" : ""}</span>
                        <ChevronRight size={14} style={{ color: C.textGhost }} />
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setModal(null)} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>Annuler</button>
              </div>
            );
          })()}
          {modal.type === "info" && <SlyInfoModal onClose={() => setModal(null)} />}
          {modal.type === "search" && (
            <SearchModal
              tasks={tasks}
              themes={themes}
              equipment={equipment}
              equipmentRubriques={equipmentRubriques}
              notebooks={notebooks}
              onOpenTask={(t) => setModal({ type: "taskActions", payload: t })}
              onOpenEquipment={(e) => setModal({ type: "editEquipment", payload: e })}
              onOpenNote={(nbId, noteId) => { setModal(null); setTab("resources"); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "taskActions" && (
            <TaskActionsMenu
              task={tasks.find((x) => x.id === modal.payload.id) || modal.payload}
              onToggleDone={() => { toggleDone(modal.payload.id); setModal(null); }}
              onFollowUp={() => { markDoneWithFollowUp(modal.payload.id); setModal(null); }}
              onPostpone={() => setModal({ type: "postpone", payload: modal.payload })}
              onEdit={() => setModal({ type: "editTask", payload: modal.payload })}
              onDuplicate={() => { duplicateTask(modal.payload.id); setModal(null); }}
              onToggleCancel={() => { toggleCancelled(modal.payload.id); setModal(null); }}
              onDelete={() => {
                const t = tasks.find((x) => x.id === modal.payload.id) || modal.payload;
                if (window.confirm(`Supprimer définitivement "${t.title}" ?\n\nCette action est irréversible.`)) {
                  deleteTask(modal.payload.id);
                  setModal(null);
                }
              }}
              onToggleToday={() => { toggleToday(modal.payload.id); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "taskDetail" && (
            <TaskDetailView
              task={tasks.find((x) => x.id === modal.payload.id) || modal.payload}
              themes={themes}
              checklists={checklists}
              onClose={() => setModal(null)}
              onEdit={() => setModal({ type: "editTask", payload: modal.payload })}
            />
          )}
          {modal.type === "addTheme" && (
            <ThemeForm onCancel={() => setModal(null)} onSave={(name, color) => { addTheme(name, color); setModal(null); }} />
          )}
          {modal.type === "editTheme" && (
            <ThemeForm initial={modal.payload} onCancel={() => setModal(null)} onSave={(name, color) => { editTheme(modal.payload.id, name, color); setModal(null); }} />
          )}
          {modal.type === "progress" && (
            <ProgressModal
              weightLogs={weightLogs}
              dailyPoints={dailyPoints}
              streakDays={streakDays || 0}
              streakRecord={streakRecord || 0}
              targetWeight={profile?.targetWeight}
              onClose={() => setModal(null)}
            />
          )}

          {modal.type === "quiz" && (() => {
            const qzTheme = (quizzes || []).find((q) => q.id === modal.payload) || (quizzes || [])[0];
            if (!qzTheme) return null;
            return (
              <QuizPlayer
                theme={qzTheme}
                onClose={() => setModal(null)}
                onFinish={(pts, correctIds) => { awardQuizPoints(pts); markQuizSeenIds(correctIds); markQuizPlayedToday(); }}
                sound={sound}
                quizSeenLog={quizSeenLog}
              />
            );
          })()}

          {modal.type === "addTask" && (
            <TaskForm
              themes={themes}
              initial={modal.payload}
              checklists={checklists}
              gigRoles={settings?.gigRoles}
              onAddGigRole={(role) => persist({ ...data, settings: { ...settings, gigRoles: [...(settings?.gigRoles || DEFAULT_GIG_ROLES), role] } })}
              onCreateChecklist={(name) => addChecklist(name, "📋", false)}
              onCancel={() => setModal(null)}
              onSave={(fields) => { addTask(fields); setModal(null); }}
            />
          )}
          {modal.type === "editTask" && (
            <TaskForm
              themes={themes}
              initial={modal.payload}
              checklists={checklists}
              gigRoles={settings?.gigRoles}
              onAddGigRole={(role) => persist({ ...data, settings: { ...settings, gigRoles: [...(settings?.gigRoles || DEFAULT_GIG_ROLES), role] } })}
              onCreateChecklist={(name) => addChecklist(name, "📋", false)}
              onCancel={() => setModal(null)}
              onDelete={() => { deleteTask(modal.payload.id); setModal(null); }}
              onSave={(fields) => { editTask(modal.payload.id, fields); setModal(null); }}
            />
          )}
          {modal.type === "postpone" && (
            <PostponeForm
              task={modal.payload}
              onCancel={() => setModal(null)}
              onSave={(dateISO) => { postponeTask(modal.payload.id, dateISO); setModal(null); }}
              onToggleToday={() => { toggleToday(modal.payload.id); setModal(null); }}
            />
          )}
          {modal.type === "bulkPostpone" && (
            <PostponeForm
              task={{ title: `${modal.payload.length} tâche${modal.payload.length > 1 ? "s" : ""}` }}
              onCancel={() => setModal(null)}
              onSave={(dateISO) => { bulkPostpone(modal.payload, dateISO); setModal(null); }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function TimeLoadGauge({ minutes }) {
  const cap = 480; // 8h reference scale
  const fillPct = Math.min(100, (minutes / cap) * 100);
  const color = minutes > SELF_CARE_THRESHOLD_MIN ? "#E11D48" : minutes > 240 ? "#FBBF24" : "#7DD3AE";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: C.textDim }}>Charge du jour</span>
        <span className="font-mono-num" style={{ color }}>{formatTotal(minutes)}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: C.border }}>
        <div className="h-full rounded-full" style={{ width: `${fillPct}%`, background: color, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function UrgencyMixGauge({ mix }) {
  const total = mix.reduce((s, x) => s + x.count, 0);
  if (total === 0) return null;
  return (
    <div>
      <div className="text-xs mb-1.5" style={{ color: C.textDim }}>Urgence des tâches restantes</div>
      <div className="h-2.5 rounded-full overflow-hidden flex" style={{ background: C.border }}>
        {mix.map((x) => (
          <div key={x.level} style={{ width: `${(x.count / total) * 100}%`, background: x.color }} title={x.label} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {mix.map((x) => (
          <span key={x.level} className="text-[10px] flex items-center gap-1" style={{ color: C.textDim }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: x.color }} /> {x.label} · {x.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function moonMood(percent) {
  if (percent >= 100) return "Pleine lune";
  if (percent >= 50) return "Presque pleine";
  if (percent > 0) return "Un croissant se dessine";
  return "La lune sommeille";
}

function WellbeingMoon({ percent, doneCount, totalCount }) {
  const ratio = Math.max(0, Math.min(100, percent)) / 100;
  const size = 60, r = 26, cx = 30, cy = 30;
  const shadowDx = ratio * (r * 2 + 2); // 0 = shadow fully covers moon, full range = shadow fully clear
  const complete = percent >= 100;
  const moonColor = doneCount > 5 ? "#F5A623" : complete ? "#F5D923" : "#F5EFD9";
  const glowRgb = doneCount > 5 ? "245,166,35" : complete ? "245,217,35" : "245,239,217";
  const glowAlpha = 0.15 + ratio * 0.55;
  const glowBlur = 3 + ratio * 10;
  return (
    <div className="flex flex-col items-center text-center gap-1" style={{ flex: "0 0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: "visible" }}>
        <defs>
          <clipPath id="moonClip"><circle cx={cx} cy={cy} r={r} /></clipPath>
        </defs>
        <circle
          cx={cx} cy={cy} r={r}
          fill={moonColor}
          style={{
            filter: `drop-shadow(0 0 ${glowBlur}px rgba(${glowRgb},${glowAlpha}))`,
            transition: "filter 0.6s ease, fill 0.6s ease",
          }}
        />
        <g clipPath="url(#moonClip)">
          <circle cx={cx + shadowDx} cy={cy} r={r} fill={C.surface} style={{ transition: "cx 0.6s ease" }} />
        </g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={1} />
        {complete && (
          <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={moonColor} strokeWidth={0.75} opacity={0.5} />
        )}
      </svg>
    </div>
  );
}

function formatFocusTime(secs) {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60), s = abs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function FocusModeOverlay({ task, onDone, onAbandon }) {
  const allocatedFromTask = typeof task.duration === "number" ? task.duration * 60 : 25 * 60;
  const savedElapsed = task.focusElapsed || 0;
  const [allocated, setAllocated] = useState(allocatedFromTask);
  const [elapsed, setElapsed] = useState(savedElapsed);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);
  const notifTimerRef = useRef(null);

  // ⑤ Notification native planifiée à la fin du timer.
  // Fonctionne même si l'app est en arrière-plan (écran allumé).
  // Si le navigateur suspend strictement l'app (verrou iOS), la notif
  // sera déclenchée au réveil — acceptable comme rappel.
  const scheduleEndNotif = useCallback((secsRemaining) => {
    if (!("Notification" in window) || Notification.permission !== "granted" || secsRemaining <= 0) return;
    clearTimeout(notifTimerRef.current);
    notifTimerRef.current = setTimeout(() => {
      new Notification("⏱ Temps écoulé !", {
        body: `Focus "${task.title}" terminé. Fais le bilan !`,
        icon: "/icons/icon-192.png",
        tag: "focus-end",
        renotify: true,
      });
    }, secsRemaining * 1000);
  }, [task.title]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") scheduleEndNotif(allocated - savedElapsed);
      });
    } else {
      scheduleEndNotif(allocated - savedElapsed);
    }
    return () => clearTimeout(notifTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
      clearTimeout(notifTimerRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  // Gong sonore au moment précis où le temps atteint 0
  const gongPlayedRef = useRef(false);
  useEffect(() => {
    if (elapsed >= allocated && !gongPlayedRef.current) {
      gongPlayedRef.current = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        const ctx = new AC();
        const t = ctx.currentTime;
        // Gong : fréquence grave + harmoniques, longue résonance
        [110, 165, 220, 277].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          const peak = 0.28 / (i + 1);
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(peak, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
          osc.connect(g); g.connect(ctx.destination);
          osc.start(t); osc.stop(t + 3.6);
        });
      } catch (e) {}
    }
    if (elapsed < allocated) gongPlayedRef.current = false;
  }, [elapsed, allocated]);

  const remaining = allocated - elapsed;
  const rawOverrun = elapsed - allocated; // secondes au-delà du temps prévu
  // Tant qu'on n'a pas dépassé +1min, on affiche 0 en vert (période de grâce)
  const inGracePeriod = rawOverrun >= 0 && rawOverrun < 60;
  const isOver = rawOverrun >= 60;
  const overrun = isOver ? rawOverrun : 0;
  const progressPct = Math.min(100, (elapsed / allocated) * 100);

  const adjustTime = (deltaMins) => {
    setAllocated((a) => Math.max(60, a + deltaMins * 60));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: "rgba(11,8,16,0.97)" }}>

      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: C.textGhost }}>Mode Focus</div>
      <div className="text-sm mb-6 text-center font-medium" style={{ color: C.textDim }}>{task.title}</div>

      {/* Progress ring */}
      <div className="relative mb-2">
        <svg width={160} height={160} viewBox="0 0 160 160">
          <circle cx={80} cy={80} r={72} fill="none" stroke={C.borderStrong} strokeWidth={6} />
          <circle cx={80} cy={80} r={72} fill="none"
            stroke={isOver ? C.danger : inGracePeriod ? "#22C55E" : C.accent} strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 72}`}
            strokeDashoffset={`${2 * Math.PI * 72 * (1 - progressPct / 100)}`}
            transform="rotate(-90 80 80)"
            style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.4s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isOver ? (
            <>
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.danger }}>TEMPS DÉPASSÉ</div>
              <div className="text-4xl font-bold font-mono-num" style={{ color: C.danger }}>+{formatFocusTime(overrun)}</div>
            </>
          ) : inGracePeriod ? (
            <>
              <div className="text-4xl font-bold font-mono-num" style={{ color: "#22C55E" }}>0:00</div>
              <div className="text-xs mt-1 font-semibold" style={{ color: "#22C55E" }}>terminé ✓</div>
            </>
          ) : (
            <>
              <div className="text-4xl font-bold font-mono-num" style={{ color: C.text }}>{formatFocusTime(remaining)}</div>
              <div className="text-xs mt-1" style={{ color: C.textGhost }}>restantes</div>
            </>
          )}
        </div>
      </div>

      {/* Adjust duration (only before overrun) */}
      {!isOver && !inGracePeriod && (
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => adjustTime(-5)} className="text-xs px-2.5 py-1.5 rounded-md" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>−5 min</button>
          <span className="text-xs" style={{ color: C.textGhost }}>{Math.round(allocated / 60)} min prévues</span>
          <button onClick={() => adjustTime(5)} className="text-xs px-2.5 py-1.5 rounded-md" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>+5 min</button>
        </div>
      )}
      {isOver && <div className="mb-6" />}

      <div className="flex gap-3">
        <button onClick={() => setRunning((r) => !r)} className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, color: C.text }}>
          {running ? "Pause" : "Reprendre"}
        </button>
        <button onClick={() => onDone(elapsed, allocated)} className="px-5 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: C.accent, color: C.bg }}>
          Terminé ✓
        </button>
      </div>
      <button onClick={() => onAbandon(elapsed)} className="mt-6 text-xs" style={{ color: C.textGhost }}>Abandonner</button>
    </div>
  );
}

function FocusCard({ tasks, themes, onStart }) {
  const wellbeingThemeIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const candidate = tasks.filter((t) => t.inToday && !t.done && !t.cancelled && !wellbeingThemeIds.has(t.themeId))
    .sort((a, b) => {
      const ua = a.urgency || 2, ub = b.urgency || 2;
      if (ua !== ub) return ub - ua;
      if (a.time && b.time) return a.time.localeCompare(b.time);
      return (a.order || 0) - (b.order || 0);
    })[0];
  if (!candidate) return null;
  const theme = themes.find((th) => th.id === candidate.themeId);
  return (
    <div className="rounded-xl px-4 py-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: C.textGhost }}>À faire maintenant</div>
      <div className="flex items-start gap-3">
        {theme && <div className="w-1 rounded-full self-stretch" style={{ background: theme.color }} />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: C.text }}>{candidate.title}</div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {candidate.urgency === 3 && <span className="text-xs px-2 py-0.5 rounded" style={{ background: C.danger + "30", color: C.danger }}>Haute</span>}
            {candidate.duration && typeof candidate.duration === "number" && (
              <span className="text-xs" style={{ color: C.textDim }}>{candidate.duration} min</span>
            )}
          </div>
        </div>
      </div>
      <button onClick={() => onStart(candidate)} className="mt-3 text-xs font-semibold px-4 py-2 rounded-md"
        style={{ background: C.accent, color: C.bg }}>
        Commencer le focus ✦
      </button>
    </div>
  );
}

// ---- Défis du Jour ----
const DEFI_REWARDS = {
  "pas du tout": { emoji: "🌱", title: "Chaque journée est une nouvelle chance", msg: "Sois doux avec toi-même. Demain est un nouveau début.", color: "#9891AE" },
  "un peu": { emoji: "🌿", title: "Tu as semé des graines", msg: "Elles pousseront à leur rythme. L'intention compte.", color: "#7DD3AE" },
  "beaucoup": { emoji: "✨", title: "Belle journée !", msg: "Tu avances à ton rythme et c'est magnifique. Continue.", color: "#C4B5FD" },
  "a la folie": { emoji: "🌟", title: "Tu rayonnes !", msg: "Le monde est meilleur avec toi dedans. Merci d'être là.", color: "#F5C84C" },
};

// Auto-computed global score from individual checks ratio
function defiGlobalLevel(checks, selectedIds) {
  if (!selectedIds || selectedIds.length === 0) return null;
  const done = selectedIds.filter((id) => (checks?.[id] || 0) > 0).length;
  const ratio = done / selectedIds.length;
  if (ratio === 0) return null;
  if (ratio <= 0.25) return "un peu";
  if (ratio <= 0.6) return "beaucoup";
  return "a la folie";
}
const TROPHY_LEVELS = [
  { min: 0, emoji: "🏆", color: "#9891AE" }, // aucun
  { min: 0.01, emoji: "🥉", color: "#CD7F32" }, // bronze
  { min: 0.34, emoji: "🥈", color: "#C0C0C0" }, // argent
  { min: 0.61, emoji: "🥇", color: "#FFD700" }, // or
  { min: 1.01, emoji: "✨", color: "#F5C84C" }, // tout
];
function trophyForRatio(ratio) {
  return [...TROPHY_LEVELS].reverse().find((l) => ratio >= l.min) || TROPHY_LEVELS[0];
}

// ---- VERSION SLY — Messages par niveau (Neuroscience · Dopamine · Habitudes) ----
const SLY_DEFI_MSGS = [
  [ // Niveau 1 — Le cerveau valide 🔬
    "Bien joué. Ton cerveau vient d'enregistrer une petite victoire.",
    "C'est fait. Une connexion neuronale de plus pour la route.",
    "Petit pas effectué. Le cerveau adore ça.",
    "Tu viens de donner une bonne raison à ton système de récompense de se manifester.",
    "Une action terminée, une charge mentale en moins.",
    "Ton futur toi vient de recevoir une petite amélioration.",
    "Le cerveau note : « comportement utile, à refaire ».",
    "Voilà. Simple, efficace, validé par le cortex préfrontal.",
    "Une petite victoire aujourd'hui, une habitude plus solide demain.",
    "Ton cerveau vient de gagner un micro-point d'expérience.",
  ],
  [ // Niveau 2 — Le circuit s'active ⚡
    "Et hop. Une petite dose de satisfaction bien méritée.",
    "Ton circuit de récompense vient de recevoir le mémo : « On avance. »",
    "Tu viens de transformer une intention en comportement. Et ça, c'est puissant.",
    "Le cerveau adore quand les choses passent de « à faire » à « fait ».",
    "La plasticité cérébrale apprécie particulièrement ce genre de journée.",
    "Ton toi de demain vient de gagner quelques points de tranquillité.",
    "Tu viens d'entraîner ton cerveau à faire ce que tu avais décidé de faire.",
    "Pas besoin de motivation héroïque. Juste une action. Et voilà.",
    "Le système fonctionne. L'opérateur aussi.",
    "Une action de plus. Une friction mentale de moins.",
  ],
  [ // Niveau 3 — Le cerveau commence à comprendre 🧠
    "Attention : tu es en train de transformer une action en habitude.",
    "Ton cerveau vient de recevoir un signal très clair : « On est capable de le faire. »",
    "Voilà comment la confiance se construit : une petite preuve après l'autre.",
    "Une tâche terminée. Ton cerveau vient de réduire une boucle ouverte.",
    "Tu viens de convertir de l'énergie mentale en résultat concret. Rentable.",
    "Le cerveau aime les récompenses. Il aime encore plus les progrès visibles.",
    "Chaque répétition rend le chemin un peu plus facile à emprunter.",
    "Tu n'as pas attendu d'être motivé. Tu as commencé. Très bon entraînement.",
    "Le cerveau apprend par répétition. Et aujourd'hui, il apprend que tu avances.",
    "Ton système nerveux peut officiellement cocher : « expérience positive ».",
  ],
  [ // Niveau 4 — Neuroplasticité activée 🚀
    "Ok. Là, ton cerveau commence à prendre des habitudes sérieuses.",
    "Tu viens de renforcer le circuit « intention → action → satisfaction ».",
    "La neuroplasticité vient de faire un petit sourire.",
    "Ce que tu répètes aujourd'hui pourrait devenir plus facile demain. Et ça, c'est plutôt cool.",
    "Tu viens de créer une nouvelle preuve que tu peux compter sur toi.",
    "Ton cerveau vient de mettre à jour ses données : « Sly est capable. »",
    "La dopamine n'a pas fait tout le travail. Tu as quand même dû appuyer sur le bouton.",
    "Objectif atteint. Charge mentale réduite. Système nerveux probablement reconnaissant.",
    "Tu es officiellement en train d'entraîner ton cerveau à préférer l'action à la procrastination.",
    "Ce n'est plus seulement une tâche terminée. C'est une répétition de la personne que tu veux devenir.",
  ],
  [ // Niveau 5 — Mode cerveau augmenté 🧬
    "🧠 Félicitations. Ton cerveau vient de débloquer une nouvelle compétence : finir ce que tu commences.",
    "Le circuit de récompense vient de déposer une demande pour recommencer demain.",
    "Tu viens de faire de la neuroplasticité en conditions réelles. Pas mal.",
    "Aujourd'hui, tu n'as pas simplement coché une case. Tu as entraîné ton cerveau.",
    "Ton futur toi vient officiellement de te remercier. Il avait besoin de ça.",
    "Le cerveau voulait une récompense. Tu lui as donné mieux : une preuve que tu avances.",
    "🧠 Nouvelle donnée enregistrée : « Quand Sly décide quelque chose, il peut vraiment le faire. »",
    "Tu viens de transformer de la volonté en automatisme potentiel. C'est comme ça que les habitudes naissent.",
    "Félicitations. Ton cerveau, ton système nerveux et ta liste de tâches sont exceptionnellement d'accord aujourd'hui.",
    "🚀 Niveau maximal atteint. Le cerveau est content, la charge mentale est plus légère, et franchement… ça commence à devenir une habitude.",
  ],
];

function pickDefiMsg(msgs, count) {
  const level = SLY_DEFI_MSGS[Math.min(count - 1, SLY_DEFI_MSGS.length - 1)];
  // Use count + a stable seed so the message varies on each new click
  const seed = count * 137 + (new Date().getSeconds() * 7);
  return level[seed % level.length];
}

// Victory sound: ascending fanfare that gets more elaborate with each level
function playVictorySound(count) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const t = ctx.currentTime;
    const lvl = Math.min(count, 5);
    const playNote = (freq, start, dur, gain = 0.08) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(start); osc.stop(start + dur + 0.05);
    };
    const scales = [
      [[523, 0, 0.15]], // lvl 1
      [[523, 0, 0.1], [659, 0.1, 0.15]], // lvl 2
      [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.2]], // lvl 3
      [[523, 0, 0.08], [659, 0.08, 0.08], [784, 0.16, 0.08], [1047, 0.24, 0.25]], // lvl 4
      [[523, 0, 0.07], [659, 0.07, 0.07], [784, 0.14, 0.07], [1047, 0.21, 0.07], [1319, 0.28, 0.35, 0.1]], // lvl 5
    ];
    (scales[lvl - 1] || scales[0]).forEach(([f, s, d, g]) => playNote(f, t + s, d, g || 0.08));
  } catch (e) {}
}

// ── Pierre précieuse crescendo — animation à chaque gain de points ──
// La gemme monte en valeur selon le nombre de points gagnés.
const GEM_TIERS = [
  { min: 0,  emoji: "🤍", name: "Quartz",    color: "#E5E7EB" },
  { min: 5,  emoji: "💚", name: "Émeraude",  color: "#34D399" },
  { min: 10, emoji: "💙", name: "Saphir",    color: "#60A5FA" },
  { min: 15, emoji: "💜", name: "Améthyste", color: "#A78BFA" },
  { min: 25, emoji: "❤️", name: "Rubis",     color: "#F87171" },
  { min: 40, emoji: "💎", name: "Diamant",   color: "#67E8F9" },
];
function gemForPoints(pts) {
  return [...GEM_TIERS].reverse().find((g) => pts >= g.min) || GEM_TIERS[0];
}
function GemReward({ points, onEnd }) {
  const gem = gemForPoints(points);
  useEffect(() => {
    const t = setTimeout(onEnd, 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 90 }}>
      <style>{`
        @keyframes gemRise {
          0%   { transform: translateY(30px) scale(0.3); opacity: 0; }
          12%  { transform: translateY(0) scale(1.25); opacity: 1; }
          20%  { transform: translateY(0) scale(1); opacity: 1; }
          82%  { transform: translateY(-6px) scale(1); opacity: 1; }
          100% { transform: translateY(-55px) scale(0.85); opacity: 0; }
        }
        .gem-rise { animation: gemRise 2.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes gemGlow { 0%,100% { filter: drop-shadow(0 0 12px currentColor); } 50% { filter: drop-shadow(0 0 28px currentColor); } }
        .gem-glow { animation: gemGlow 0.7s ease-in-out infinite; }
      `}</style>
      <div className="gem-rise flex flex-col items-center gap-2">
        <span className="gem-glow" style={{ fontSize: 72, lineHeight: 1, color: gem.color }}>{gem.emoji}</span>
        <div className="rounded-full px-3 py-1 font-black text-sm" style={{ background: gem.color + "33", color: gem.color }}>
          +{points} pts · {gem.name}
        </div>
      </div>
    </div>
  );
}

// Star fills screen, then big black text appears on gold — click to close
function StarCelebration({ count, msg, onEnd }) {
  const [textVisible, setTextVisible] = useState(false);

  useEffect(() => {
    playVictorySound(count);
    const t = setTimeout(() => setTextVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center cursor-pointer"
      style={{ zIndex: 100,  background: textVisible ? "rgba(255,216,64,0.97)" : "transparent" }}
      onClick={onEnd}
    >
      <style>{`
        @keyframes starBurst {
          0%   { transform: scale(0.08); opacity: 0.6; }
          55%  { transform: scale(10); opacity: 1; }
          100% { transform: scale(22); opacity: 0; }
        }
        .star-burst { animation: starBurst 0.8s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes textPop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.06); }
          100% { transform: scale(1); opacity: 1; }
        }
        .defi-text-pop { animation: textPop 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>
      {!textVisible && (
        <span className="star-burst" style={{ fontSize: 90, display: "block", lineHeight: 1, pointerEvents: "none" }}>⭐</span>
      )}
      {textVisible && (
        <div className="defi-text-pop flex flex-col items-center gap-5 px-8 text-center">
          <span style={{ fontSize: 64, lineHeight: 1 }}>⭐</span>
          <div className="text-2xl font-black leading-tight" style={{ color: "#000", maxWidth: 320 }}>{msg}</div>
          <div className="text-sm font-semibold mt-2" style={{ color: "#4A3800", opacity: 0.7 }}>Appuie pour continuer</div>
        </div>
      )}
    </div>
  );
}

function DefiMorningModal({ defiLibrary, todayDate, defiSettings, onSave, onSkip, onSaveLibrary, onSaveSettings }) {
  const [mode, setMode] = useState(defiSettings?.mode || "manual"); // "manual" | "random"
  const [count, setCount] = useState(defiSettings?.count || 4);
  const [editLib, setEditLib] = useState(defiLibrary);
  const [newText, setNewText] = useState("");
  const [editMode, setEditMode] = useState(false);

  const randomSelected = useMemo(() => {
    const ids = editLib.map((d) => d.id);
    const hash = Date.now(); // changed daily via defaultDefiIds already
    const picked = [];
    for (let i = 0; i < ids.length && picked.length < count; i++) {
      picked.push(ids[(hashStr(todayDate) + i * 7) % ids.length]);
    }
    return [...new Set(picked)].slice(0, count);
  }, [editLib, count, todayDate]);

  const [selected, setSelected] = useState(() =>
    mode === "random" ? randomSelected : defaultDefiIds(todayDate).filter((id) => editLib.some((d) => d.id === id))
  );

  useEffect(() => {
    if (mode === "random") setSelected(randomSelected);
  }, [mode, randomSelected]);

  const toggle = (id) => {
    if (mode === "random") return; // in random mode, list is fixed
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  };

  const handleSave = () => {
    onSaveLibrary(editLib);
    onSaveSettings({ mode, count });
    onSave(selected);
  };

  const reRandom = () => {
    // pick different ones
    const ids = editLib.map((d) => d.id);
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    setSelected(shuffled.slice(0, count));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(11,8,16,0.88)" }}>
      <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}>
        <div className="text-center">
          <div className="text-2xl mb-1">🏆</div>
          <div className="text-base font-bold" style={{ color: C.text }}>Aujourd'hui, je m'engage à :</div>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2">
          {["manual", "random"].map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className="flex-1 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: mode === m ? C.accent : "transparent", color: mode === m ? C.bg : C.textDim, border: `1px solid ${mode === m ? C.accent : C.borderStrong}` }}>
              {m === "manual" ? "✋ Choisir moi-même" : "🎲 Mode aléatoire"}
            </button>
          ))}
        </div>

        {/* Random mode: count + reshuffle */}
        {mode === "random" && (
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: C.textDim }}>Nombre :</span>
            <div className="flex gap-1">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => setCount(n)}
                  className="w-7 h-7 rounded-md text-xs font-bold"
                  style={{ background: count === n ? C.accent : C.surfaceRaised, color: count === n ? C.bg : C.textDim, border: `1px solid ${count === n ? C.accent : C.borderStrong}` }}>
                  {n}
                </button>
              ))}
            </div>
            <button onClick={reRandom} className="text-xs px-2 py-1 rounded-md ml-auto"
              style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
              🔀 Remélanger
            </button>
          </div>
        )}

        {/* Defi list */}
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {editLib.map((d) => {
            const isSelected = selected.includes(d.id);
            return (
              <div key={d.id} className="flex items-center gap-2">
                <button onClick={() => toggle(d.id)} className="flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                  style={{ background: isSelected ? C.accent + "22" : C.surfaceRaised, border: `1px solid ${isSelected ? C.accent : C.borderStrong}`, opacity: mode === "random" && !isSelected ? 0.4 : 1 }}>
                  <div className="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                    style={{ borderColor: isSelected ? C.accent : C.borderStrong, background: isSelected ? C.accent : "transparent" }}>
                    {isSelected && <Check size={10} color={C.bg} strokeWidth={3} />}
                  </div>
                  <span className="text-sm" style={{ color: C.text }}>{d.text}</span>
                </button>
                {editMode && (
                  <button onClick={() => setEditLib((l) => l.filter((x) => x.id !== d.id))}
                    className="text-xs px-1.5 py-1 rounded shrink-0" style={{ color: C.danger, border: `1px solid ${C.danger}44` }}>✕</button>
                )}
              </div>
            );
          })}
        </div>

        {editMode && (
          <div className="flex gap-2">
            <input value={newText} onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newText.trim()) { setEditLib((l) => [...l, { id: "d-" + uid(), text: newText.trim() }]); setNewText(""); } }}
              placeholder="Nouveau défi... (Entrée pour valider)"
              className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
              style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
            <button disabled={!newText.trim()} onClick={() => { setEditLib((l) => [...l, { id: "d-" + uid(), text: newText.trim() }]); setNewText(""); }}
              className="px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>+</button>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={() => setEditMode((v) => !v)} className="text-xs px-3 py-2 rounded-md"
            style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
            {editMode ? "✓ Fermer" : "✏️ Modifier la liste"}
          </button>
          <div className="flex-1" />
          <button onClick={onSkip} className="text-xs px-3 py-2 rounded-md" style={{ color: C.textGhost }}>Plus tard</button>
          <button onClick={handleSave} disabled={selected.length === 0}
            className="px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
            style={{ background: C.accent, color: C.bg }}>C'est parti !</button>
        </div>
      </div>
    </div>
  );
}

function DefiTrophy({ dailyDefi, defiLibrary, onClick }) {
  const today = todayISODate();
  const isToday = dailyDefi?.date === today;
  const checks = isToday ? (dailyDefi.checks || {}) : {};
  const selectedIds = isToday ? (dailyDefi.selectedIds || []) : [];
  const doneCount = selectedIds.filter((id) => (checks[id] || 0) > 0).length;
  const ratio = selectedIds.length ? doneCount / selectedIds.length : 0;
  const trophy = trophyForRatio(ratio);
  const hasActive = isToday && selectedIds.length > 0;
  return (
    <button onClick={onClick} aria-label="Défis du jour"
      style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: 24, filter: ratio > 0 ? `drop-shadow(0 0 6px ${trophy.color}aa)` : "none" }}
        className={hasActive && ratio === 0 ? "butterfly-ring" : ""}>
        {trophy.emoji}
      </span>
      {hasActive && (
        <span className="absolute -bottom-1 text-[8px] font-bold" style={{ color: trophy.color }}>
          {doneCount}/{selectedIds.length}
        </span>
      )}
    </button>
  );
}

function DefiReviewModal({ dailyDefi, defiLibrary, onCheck, onAddDefiToday, onAddDefi, onEditDefi, onDeleteDefi, onToggleActive, onMarkPresence, onUnmarkPresence, defiStreak, onClose, quizzes, quizThemeId, onSetQuizTheme, onPlayQuiz, quizAddressedToday, onDismissQuiz }) {
  const [celebrate, setCelebrate] = useState(null);
  const [managing, setManaging] = useState(false); // gérer la bibliothèque
  const [picking, setPicking] = useState(false);    // piocher dans la liste
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const today = todayISODate();
  const isToday = dailyDefi?.date === today;
  const selectedIds = isToday ? (dailyDefi.selectedIds || []) : [];
  const checks = isToday ? (dailyDefi.checks || {}) : {};
  const presence = isToday ? !!dailyDefi.presence : false;
  const selected = selectedIds.map((id) => defiLibrary.find((d) => d.id === id)).filter(Boolean);
  const doneCount = selectedIds.filter((id) => (checks[id] || 0) > 0).length;
  const ratio = selectedIds.length ? doneCount / selectedIds.length : 0;
  const trophy = trophyForRatio(ratio);
  const activeLib = (defiLibrary || []).filter((d) => d.active !== false);
  const available = activeLib.filter((d) => !selectedIds.includes(d.id));

  const handleInc = (id) => {
    const next = (checks[id] || 0) + 1;
    onCheck(id, next);
    sound.defiComplete(next);
    setCelebrate({ id, count: next, msg: pickDefiMsg(SLY_DEFI_MSGS, next) });
  };
  const handleDec = (id) => { const c = checks[id] || 0; if (c > 0) onCheck(id, c - 1); };

  return (
    <>
      {celebrate && (
        <StarCelebration key={`${celebrate.id}-${celebrate.count}`} count={celebrate.count} msg={celebrate.msg} onEnd={() => setCelebrate(null)} />
      )}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(11,8,16,0.85)" }} onClick={onClose}>
        <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[88vh] overflow-y-auto" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 32 }}>{trophy.emoji}</span>
            <div className="flex-1">
              <div className="text-base font-bold" style={{ color: C.text }}>Mes défis du jour</div>
              <div className="text-xs" style={{ color: C.textGhost }}>{doneCount}/{selectedIds.length} engagé{doneCount > 1 ? "s" : ""}</div>
            </div>
            {defiStreak && defiStreak.count > 0 && (
              <div className="text-right">
                <div className="text-sm font-black" style={{ color: "#F59E0B" }}>⚡ {defiStreak.count}j</div>
                {defiStreak.count > 1 && <div className="text-[10px] font-semibold" style={{ color: "#F59E0B" }}>+{(defiStreak.count - 1) * 5} bonus</div>}
              </div>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div style={{ height: 6, borderRadius: 999, background: C.borderStrong, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${ratio * 100}%`, background: `linear-gradient(90deg, ${trophy.color}, ${trophy.color}cc)`, borderRadius: 999, transition: "width 0.5s ease" }} />
            </div>
          )}

          {/* Défis sélectionnés du jour */}
          <div className="space-y-2">
            {selected.map((d) => {
              const cnt = checks[d.id] || 0;
              const done = cnt > 0;
              return (
                <div key={d.id} className="flex items-center gap-2 rounded-lg px-3 py-3"
                  style={{ background: done ? C.accent + "22" : C.surfaceRaised, border: `1px solid ${done ? C.accent : C.borderStrong}` }}>
                  <button onClick={() => handleDec(d.id)} disabled={cnt <= 0} className="shrink-0 rounded-full disabled:opacity-25 flex items-center justify-center" style={{ width: 30, height: 30, background: C.borderStrong + "50", color: C.textDim, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>−</button>
                  <div className="flex flex-col items-center shrink-0" style={{ minWidth: 32 }}>
                    <div className="text-lg font-black leading-none" style={{ color: done ? C.accentLight : C.text }}>{cnt}</div>
                    <div className="text-[9px]" style={{ color: C.textGhost }}>fois</div>
                  </div>
                  <button onClick={() => handleInc(d.id)} className="shrink-0 rounded-full flex items-center justify-center" style={{ width: 30, height: 30, background: done ? C.accent + "44" : C.accent, color: done ? C.accentLight : C.bg, fontSize: 20, fontWeight: 700, lineHeight: 1 }}>+</button>
                  <span className="text-sm flex-1 ml-1" style={{ color: C.text }}>{d.text}</span>
                </div>
              );
            })}
            {selected.length === 0 && (
              <p className="text-sm text-center py-3" style={{ color: C.textDim }}>Aucun défi choisi aujourd'hui. Pioche-en un ci-dessous, ou marque juste ta présence.</p>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-2">
            <button onClick={() => { setPicking((v) => !v); setManaging(false); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: picking ? C.accent + "22" : C.accent, color: picking ? C.accent : C.bg }}>
              + Choisir un défi
            </button>
            <button onClick={() => { setManaging((v) => !v); setPicking(false); }} className="px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: managing ? C.accent + "22" : C.surfaceRaised, color: managing ? C.accent : C.textDim, border: `1px solid ${C.border}` }}>
              Gérer
            </button>
          </div>

          {/* Piocher dans la liste proposée */}
          {picking && (
            <div className="rounded-xl p-3 space-y-1.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
              <div className="text-[11px] font-semibold mb-1" style={{ color: C.textDim }}>Défis disponibles</div>
              {available.length === 0 ? (
                <p className="text-xs" style={{ color: C.textGhost }}>Tous tes défis actifs sont déjà choisis.</p>
              ) : available.map((d) => (
                <button key={d.id} onClick={() => onAddDefiToday(d.id)} className="w-full text-left text-sm px-3 py-2 rounded-lg flex items-center gap-2"
                  style={{ background: C.surface, color: C.textDim, border: `1px solid ${C.border}` }}>
                  <Plus size={13} style={{ color: C.accent }} /> {d.text}
                </button>
              ))}
            </div>
          )}

          {/* Gérer la bibliothèque : créer / modifier / activer / supprimer */}
          {managing && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
              <div className="text-[11px] font-semibold" style={{ color: C.textDim }}>Ma bibliothèque de défis</div>
              <div className="flex gap-2">
                <input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Nouveau défi…"
                  onKeyDown={(e) => { if (e.key === "Enter" && newText.trim()) { onAddDefi(newText.trim()); setNewText(""); } }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px dashed ${C.accent}66` }} />
                <button disabled={!newText.trim()} onClick={() => { onAddDefi(newText.trim()); setNewText(""); }} className="px-3 rounded-lg text-sm font-bold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>+</button>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {(defiLibrary || []).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}`, opacity: d.active === false ? 0.5 : 1 }}>
                    {editingId === d.id ? (
                      <>
                        <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} className="flex-1 px-2 py-1 rounded text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.accent}` }} />
                        <button onClick={() => { if (editText.trim()) onEditDefi(d.id, editText.trim()); setEditingId(null); }} className="text-xs font-bold px-2" style={{ color: C.accent }}>OK</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => onToggleActive(d.id)} title={d.active === false ? "Activer" : "Désactiver"} className="shrink-0 w-6 h-6 rounded flex items-center justify-center" style={{ color: d.active === false ? C.textGhost : "#22C55E" }}>
                          {d.active === false ? <Ban size={13} /> : <Check size={13} strokeWidth={3} />}
                        </button>
                        <span className="flex-1 text-sm" style={{ color: C.text }}>{d.text}</span>
                        <button onClick={() => { setEditingId(d.id); setEditText(d.text); }} style={{ color: C.textGhost }}><Pencil size={12} /></button>
                        <button onClick={() => onDeleteDefi(d.id)} style={{ color: C.textGhost }}><Trash2 size={12} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(quizzes || []).length > 0 && (() => {
            const qzTheme = quizzes.find((q) => q.id === quizThemeId) || quizzes[0];
            return (
              <>
                {quizzes.length > 1 && (
                  <div className="flex gap-2 mb-2">
                    {quizzes.map((qz) => (
                      <button key={qz.id} onClick={() => onSetQuizTheme(qz.id)}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
                        style={{
                          background: qz.id === qzTheme.id ? "#F59E0B22" : "transparent",
                          color: qz.id === qzTheme.id ? "#F59E0B" : C.textDim,
                          border: `1px solid ${qz.id === qzTheme.id ? "#F59E0B" : C.borderStrong}`,
                        }}>
                        {qz.emoji} {qz.name}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => onPlayQuiz(qzTheme.id)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                  style={{ background: "#F59E0B1A", border: `1px solid #F59E0B55` }}>
                  <span style={{ fontSize: 22 }}>{qzTheme.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold" style={{ color: "#F59E0B" }}>Quiz — {qzTheme.name}</div>
                    <div className="text-[11px]" style={{ color: C.textGhost }}>+5 pts/bonne réponse, bonus toutes les 10 !</div>
                  </div>
                  <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>▶ Jouer</span>
                </button>
                {!quizAddressedToday ? (
                  <button onClick={onDismissQuiz} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px dashed ${C.accent}66` }}>
                    Pas de quiz pour moi aujourd'hui · +5 pts
                  </button>
                ) : (
                  <div className="w-full py-2 rounded-xl text-sm font-semibold text-center" style={{ background: "#22C55E22", color: "#22C55E" }}>
                    ✓ Quiz du jour noté
                  </div>
                )}
              </>
            );
          })()}

          {/* Marqueur : pas de défi aujourd'hui (arrête le clignotement, +5 pts) */}
          {!presence ? (
            <button onClick={onMarkPresence} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px dashed ${C.accent}66` }}>
              Pas de défi pour moi aujourd'hui · +5 pts
            </button>
          ) : (
            <button onClick={onUnmarkPresence} className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2" style={{ background: "#22C55E22", color: "#22C55E", border: `1px dashed #22C55E66` }}>
              ✓ Noté pour aujourd'hui <span style={{ color: C.textGhost, fontWeight: 500 }}>· annuler</span>
            </button>
          )}

          <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
            Fermer
          </button>
        </div>
      </div>
    </>
  );
}

// ── Dragon SVG (remplace constellation + lune) ───────────────────────────────
// ── Sélecteur de thème pour l'onglet Mes missions ──
function ThemePickerModal({ themes, selectedId, onSelect, onAddTheme, onClose }) {
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 80,  background: "rgba(11,8,16,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-bold italic" style={{ color: C.text }}>Choisir un thème</h3>
          <button onClick={onClose} style={{ color: C.textGhost }}><X size={20} /></button>
        </div>
        <div className="space-y-2">
          {themes.map((th) => (
            <button key={th.id} onClick={() => { onSelect(th.id); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ background: selectedId === th.id ? th.color + "22" : C.surfaceRaised,
                border: `1px solid ${selectedId === th.id ? th.color : C.border}` }}>
              <div className="w-4 h-4 rounded-full shrink-0" style={{ background: th.color }} />
              <span className="text-sm font-semibold flex-1" style={{ color: C.text }}>{th.name}</span>
              {selectedId === th.id && <Check size={16} style={{ color: th.color }} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <button onClick={() => { const n = prompt("Nom du nouveau thème :"); if (n?.trim()) onAddTheme(n.trim()); }}
          className="w-full mt-3 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px dashed ${C.accent}66` }}>
          <Plus size={16} /> Ajouter un dossier
        </button>
        <button onClick={onClose} className="w-full mt-2 py-3 rounded-2xl text-sm"
          style={{ border: `1px solid ${C.border}`, color: C.textGhost }}>Fermer</button>
      </div>
    </div>
  );
}

// ── Fenêtre "Mes rituels" — ouverte depuis la carte d'accueil ──
// ══════════════════════════════════════════════════════════════════
// ÉNERGIE — ressources physiologiques & habitudes quotidiennes
// Philosophie : jamais culpabilisant. Renseigner = gagner des points.
// ══════════════════════════════════════════════════════════════════
const ENERGIE_DIMS = [
  { id: "hydratation", label: "Hydratation",       emoji: "💧", color: "#38BDF8", type: "water" },
  { id: "nutrition",   label: "Nutrition",         emoji: "🥗", color: "#34D399", type: "nutrition" },
  { id: "activite",    label: "Activité physique", emoji: "🏃", color: "#F97316", type: "activities" },
  { id: "silence",     label: "Silence",           emoji: "🧘", color: "#A78BFA", type: "activities" },
];

// Activités physiques par défaut (modifiables) — peuvent porter durée et/ou points
// Récompenses par défaut du coffre (modifiables) — nom + coût en points
const DEFAULT_REWARDS = [
  { id: "rw-1", emoji: "🎬", name: "Une soirée film tranquille", cost: 300 },
  { id: "rw-2", emoji: "🍫", name: "Un petit plaisir gourmand", cost: 150 },
  { id: "rw-3", emoji: "🍽️", name: "Un bon resto", cost: 1500 },
  { id: "rw-4", emoji: "🌴", name: "Un jour off complet", cost: 2000 },
];

const DEFAULT_ACTIVITIES = [
  { id: "act-squat",  name: "Squats x10",      points: 10, minutes: null, incrementable: true,  hidden: false },
  { id: "act-marche", name: "Marche",          points: null, minutes: null, incrementable: false, hidden: false, timeMode: true, lowPts: 20, highPts: 50 },
  { id: "act-pompes", name: "Pompes x10",      points: 10, minutes: null, incrementable: true,  hidden: false },
  { id: "act-etire",  name: "Étirements",      points: 5,  minutes: null, incrementable: false, hidden: false },
  { id: "act-yoga",   name: "Yoga / mobilité", points: 10, minutes: 20,   incrementable: false, hidden: false },
];

// Items « Silence » par défaut (méditation, lecture…) — modifiables
const DEFAULT_ESPRIT = [
  { id: "esp-medit",   name: "Méditation",        points: null, minutes: null, incrementable: false, hidden: false, timeMode: true, lowPts: 50, highPts: 100 },
  { id: "esp-lecture", name: "Lecture",           points: null, minutes: null, incrementable: false, hidden: false, timeMode: true, lowPts: 20, highPts: 50 },
  { id: "esp-resp",    name: "Cohérence cardiaque", points: 20, minutes: 5, incrementable: false, hidden: false },
  { id: "esp-gratit",  name: "Gratitude du jour",  points: 10, minutes: null, incrementable: false, hidden: false },
];

// Nutrition : cases à cocher qui rapportent des points variables
const NUTRITION_ITEMS = [
  { id: "nut-equilibre",  name: "Repas équilibré",     points: 10 },
  { id: "nut-pasequilibre", name: "Repas pas assez équilibré", points: 2 },
  { id: "nut-jeuneint",   name: "Jeûne intermittent",  points: 50 },
  { id: "nut-jeune",      name: "Jeûne",               points: 100 },
  { id: "nut-sanssucre",  name: "Sans sucre",          points: 50 },
];

// Éditeur des activités (créer / modifier / cacher / supprimer) — temps et/ou points
function ActivityEditor({ activities, color, onEdit, suggestions }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("simple"); // "simple" (oui/non) | "duree" (3 paliers)
  const [pts, setPts] = useState("10");        // points pour Oui/Non
  const [lowPts, setLowPts] = useState("20");  // 1 à 30 min
  const [highPts, setHighPts] = useState("50"); // + de 30 min
  const [mins, setMins] = useState("");
  const [incr, setIncr] = useState(false);

  const reset = () => { setName(""); setType("simple"); setPts("10"); setLowPts("20"); setHighPts("50"); setMins(""); setIncr(false); };

  const add = () => {
    if (!name.trim()) return;
    if (type === "duree") {
      onEdit("add", null, { name: name.trim(), timeMode: true, lowPts: parseInt(lowPts, 10) || 20, highPts: parseInt(highPts, 10) || 50, points: null, minutes: null, incrementable: false });
    } else {
      onEdit("add", null, { name: name.trim(), points: parseInt(pts, 10) || 5, minutes: mins ? parseInt(mins, 10) : null, incrementable: incr });
    }
    reset();
  };

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: C.surfaceRaised, border: `1px solid ${C.border}`, opacity: a.hidden ? 0.5 : 1 }}>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.text }}>{a.name}</div>
            <div className="text-[10px]" style={{ color: C.textGhost }}>
              {a.timeMode ? `3 paliers · ${a.lowPts}/${a.highPts} pts` : `+${a.points || 5} pts`}{a.minutes ? ` · ${a.minutes} min` : ""}{a.incrementable && !a.timeMode ? " · incrémentable" : ""}
            </div>
          </div>
          <button onClick={() => onEdit("toggle", a.id)} title={a.hidden ? "Afficher" : "Cacher"}
            className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.surface, color: a.hidden ? C.textGhost : color }}>
            {a.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button onClick={() => onEdit("delete", a.id)} title="Supprimer"
            className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.surface, color: C.danger }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      {suggestions && suggestions.length > 0 && (() => {
        const existingNames = new Set(activities.map((a) => a.name.toLowerCase()));
        const remaining = suggestions.filter((s) => !existingNames.has(s.name.toLowerCase()));
        if (remaining.length === 0) return null;
        return (
          <div>
            <div className="text-[11px] mb-1.5" style={{ color: C.textGhost }}>Suggestions</div>
            <div className="flex flex-wrap gap-1.5">
              {remaining.map((s) => (
                <button key={s.id} onClick={() => onEdit("add", null, { ...s, id: undefined })}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ background: C.surface, color: color, border: `1px dashed ${color}66` }}>
                  + {s.name}
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="rounded-xl p-3 space-y-2" style={{ background: C.surfaceRaised, border: `1px dashed ${color}66` }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle activité (ex. Gainage)"
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />

        {/* Choix du type */}
        <div className="flex gap-2">
          {[["simple", "Oui / Non"], ["duree", "3 durées"]].map(([val, lbl]) => (
            <button key={val} onClick={() => setType(val)} className="flex-1 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: type === val ? color : C.surface, color: type === val ? "#0B0810" : C.textDim, border: `1px solid ${type === val ? color : C.border}` }}>
              {lbl}
            </button>
          ))}
        </div>

        {type === "simple" ? (
          <div className="flex items-center gap-2">
            <input type="number" value={pts} onChange={(e) => setPts(e.target.value)}
              className="w-16 px-2 py-2 rounded-lg text-sm outline-none text-center"
              style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />
            <span className="text-[11px]" style={{ color: C.textGhost }}>pts</span>
            <input type="number" value={mins} onChange={(e) => setMins(e.target.value)} placeholder="min"
              className="w-14 px-2 py-2 rounded-lg text-sm outline-none text-center"
              style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />
            <button onClick={() => setIncr((v) => !v)}
              className="text-[11px] font-bold px-2 py-1.5 rounded-lg flex-1"
              style={{ background: incr ? color + "22" : C.surface, color: incr ? color : C.textGhost, border: `1px solid ${C.border}` }}>
              {incr ? "✓ Plusieurs fois" : "1 fois"}
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="text-[10px]" style={{ color: C.textGhost }}>Points par palier : « Pas aujourd'hui » = 0.</div>
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1" style={{ color: C.textDim }}>-30 min</span>
              <input type="number" value={lowPts} onChange={(e) => setLowPts(e.target.value)}
                className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />
              <span className="text-[11px]" style={{ color: C.textGhost }}>pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1" style={{ color: C.textDim }}>+30 min</span>
              <input type="number" value={highPts} onChange={(e) => setHighPts(e.target.value)}
                className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />
              <span className="text-[11px]" style={{ color: C.textGhost }}>pts</span>
            </div>
          </div>
        )}

        <button onClick={add} className="w-full py-2 rounded-lg text-sm font-bold" style={{ background: color, color: "#0B0810" }}>
          + Ajouter
        </button>
      </div>
    </div>
  );
}

// Jauge de série : montre le nombre de jours consécutifs et le bonus de points.
// Bouteille d'eau illustrée, avec un niveau de remplissage (0 = vide, 1 = pleine).
function WaterBottleIcon({ fillLevel = 0, uid, size = 44 }) {
  const clipId = `bottleClip-${uid}`;
  const bodyTop = 11, bodyBottom = 31; // zone remplissable dans le viewBox
  const fillY = bodyBottom - (bodyBottom - bodyTop) * Math.max(0, Math.min(1, fillLevel));
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 24 34" fill="none">
      <defs>
        <clipPath id={clipId}>
          <path d="M9.5 2h5v3.2l2.3 2.6v21.7a2 2 0 0 1-2 2h-5.6a2 2 0 0 1-2-2V7.8l2.3-2.6V2z" />
        </clipPath>
      </defs>
      {fillLevel > 0 && (
        <rect x="7" y={fillY} width="10" height={bodyBottom - fillY + 2} fill="#38BDF8" clipPath={`url(#${clipId})`} />
      )}
      <path d="M9.5 2h5v3.2l2.3 2.6v21.7a2 2 0 0 1-2 2h-5.6a2 2 0 0 1-2-2V7.8l2.3-2.6V2z"
        stroke="#38BDF8" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="9.5" y="1" width="5" height="2.2" rx="0.6" fill="#38BDF8" />
    </svg>
  );
}

function StreakGauge({ streak, color, max = 10 }) {
  const count = streak?.count || 0;
  if (count <= 0) return null;
  const active = streak?.lastDate === todayISODate() || streak?.lastDate === addDaysISO(-1);
  const filled = Math.min(count, max);
  const bonus = (count - 1) * 5;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[11px] font-bold" style={{ color: active ? color : C.textGhost }}>⚡ {count}j</span>
      <div className="flex-1 flex gap-0.5" style={{ maxWidth: 90 }}>
        {Array.from({ length: max }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < filled ? color : C.border }} />
        ))}
      </div>
      {bonus > 0 && <span className="text-[10px] font-semibold" style={{ color }}>+{bonus} bonus</span>}
    </div>
  );
}

function EnergieModal({ wellnessToday, wellnessLog, targetWeight, baseWeight, weightLogs, activities, espritItems, activityStreaks, onLog,
                        onLogWeight, onSkipWeigh, onLogActivity, onEditActivities, onStartFocus, onClose }) {
  const [openDim, setOpenDim] = useState(null);
  const [tempScale, setTempScale] = useState(null);
  const [tempWeight, setTempWeight] = useState("");
  const [tempMin, setTempMin] = useState("");
  const [tempBed, setTempBed] = useState("");
  const [tempWake, setTempWake] = useState("");
  const [editingActs, setEditingActs] = useState(false);

  const log = wellnessToday || {};
  const water = log.water || 0;
  const alcohol = log.alcohol;  // undefined = non renseigné

  // Liste d'items selon la dimension ouverte (activité physique OU esprit)
  const listForDim = (dimId) => dimId === "silence" ? (espritItems || []) : (activities || []);
  const logKeyForDim = (dimId) => dimId === "silence" ? "espritLog" : "activities";
  const acts = (listForDim(openDim)).filter((a) => !a.hidden);
  const actLog = log[logKeyForDim(openDim)] || {}; // { itemId: count }

  // Fenêtre d'une dimension
  const dim = ENERGIE_DIMS.find((d) => d.id === openDim);

  const dimPtsKey = dim ? (dim.type === "activities" ? (dim.id === "silence" ? "_pts_esprit" : "_pts_activite") : "_pts_" + dim.id) : null;

  const commit = (dimId, value) => {
    onLog(dimId, value);       // stocke la valeur
    onLog("_pts_" + dimId, 5); // +5 pts (une fois par jour, géré en delta)
    setOpenDim(null); setTempScale(null); setTempMin("");
  };

  // ── Sous-fenêtre d'une dimension ──
  if (dim) {
    return (
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ zIndex: 86,  background: "rgba(11,8,16,0.85)" }} onClick={() => setOpenDim(null)}>
        <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5"
          style={{ background: C.surface, border: `${log[dimPtsKey] ? 3 : 1}px solid ${log[dimPtsKey] ? dim.color : C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-1">
            <span style={{ fontSize: 28 }}>{dim.emoji}</span>
            <h3 className="font-display text-xl font-bold italic" style={{ color: C.text }}>{dim.label}</h3>
            {log[dimPtsKey] && <Check size={16} style={{ color: dim.color }} strokeWidth={3} />}
          </div>
          <p className="text-xs mb-5" style={{ color: C.textGhost }}>
            {log[dim.id] != null ? "Déjà noté aujourd'hui — tu peux ajuster." : "Aucune pression : note simplement où tu en es."}
          </p>

          {/* Échelle 3 ou 5 niveaux */}
          {(dim.type === "scale3" || dim.type === "scale5") && (
            <div className="space-y-2">
              {dim.scale.map((lbl, i) => {
                const active = (tempScale ?? log[dim.id]) === i;
                const emojis3 = ["😔", "😐", "😊"];
                const emojis5 = ["😫", "😕", "😐", "🙂", "😄"];
                const em = dim.type === "scale3" ? emojis3[i] : emojis5[i];
                return (
                  <button key={i} onClick={() => setTempScale(i)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.98] transition-transform"
                    style={{ background: active ? dim.color + "22" : C.surfaceRaised,
                      border: `1px solid ${active ? dim.color : C.border}` }}>
                    <span style={{ fontSize: 22 }}>{em}</span>
                    <span className="text-sm font-semibold" style={{ color: active ? dim.color : C.text }}>{lbl}</span>
                  </button>
                );
              })}
              <button onClick={() => commit(dim.id, tempScale ?? log[dim.id] ?? 1)}
                disabled={tempScale == null && log[dim.id] == null}
                className="w-full mt-2 py-3 rounded-2xl text-sm font-bold"
                style={{ background: dim.color, color: "#0B0810", opacity: (tempScale == null && log[dim.id] == null) ? 0.4 : 1 }}>
                Enregistrer · +5 pts
              </button>
            </div>
          )}

          {/* Hydratation : eau + alcool */}
          {dim.type === "water" && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: C.text }}>💧 Eau</span>
                  <span className="text-xs font-bold" style={{ color: "#38BDF8" }}>
                    {water === 0 ? "Pas encore bu" : water === 1 ? "Moins d'1 litre" : water === 2 ? "Plus d'1 litre 🎯" : "2 litres et plus !"}
                  </span>
                </div>
                <button onClick={() => onLog("water", water >= 3 ? 0 : water + 1)}
                  className="w-full flex items-center justify-center gap-5 py-3 rounded-2xl active:scale-95 transition-transform"
                  style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
                  <WaterBottleIcon uid="1" fillLevel={water === 0 ? 0 : water === 1 ? 0.28 : 1} />
                  <WaterBottleIcon uid="2" fillLevel={water >= 3 ? 1 : 0} />
                </button>
                <div className="text-[10px] mt-1.5 text-center" style={{ color: C.textGhost }}>Touche les bouteilles pour avancer d'un cran · série validée à partir d'1 litre 🎯</div>
                {activityStreaks?.["__hydra__"]?.count > 0 && (
                  <StreakGauge streak={activityStreaks["__hydra__"]} color="#38BDF8" />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: C.text }}>🍷 Alcool</span>
                  <span className="text-xs font-bold" style={{ color: alcohol == null ? C.textGhost : alcohol === 0 ? "#22C55E" : "#F59E0B" }}>
                    {alcohol == null ? "À renseigner" : alcohol === 0 ? "Aucun 👏" : `${alcohol} verre${alcohol > 1 ? "s" : ""}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} onClick={() => onLog("alcohol", n)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                      style={{ background: alcohol === n ? (n === 0 ? "#22C55E" : "#F59E0B") : C.surfaceRaised,
                        color: alcohol === n ? "#0B0810" : C.textDim, border: `1px solid ${alcohol === n ? "transparent" : C.border}` }}>
                      {n === 3 ? "3+" : n}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] mt-1.5" style={{ color: C.textGhost }}>0 = 20 pts · 1 = 5 pts · 2 = 2 pts · 3+ = 0 pt</div>
              </div>
              <button onClick={() => {
                  const waterPts = water === 0 ? 0 : water === 1 ? 5 : water === 2 ? 15 : 20; // seuil "fait" = niveau 2 (1L)
                  const alcoholPts = alcohol == null ? 0 : alcohol === 0 ? 20 : alcohol === 1 ? 5 : alcohol === 2 ? 2 : 0;
                  onLog("_pts_hydratation", waterPts + alcoholPts);
                  setOpenDim(null);
                }}
                className="w-full py-3 rounded-2xl text-sm font-bold" style={{ background: "#38BDF8", color: "#0B0810" }}>
                Enregistrer{(() => {
                  const wp = water === 0 ? 0 : water === 1 ? 5 : water === 2 ? 15 : 20;
                  const ap = alcohol == null ? 0 : alcohol === 0 ? 20 : alcohol === 1 ? 5 : alcohol === 2 ? 2 : 0;
                  return wp + ap > 0 ? ` · +${wp + ap} pts` : "";
                })()}
              </button>
            </div>
          )}

          {/* Nutrition : cases à cocher à points variables */}
          {dim.type === "nutrition" && (
            <div className="space-y-2">
              <div className="text-xs mb-1" style={{ color: C.textGhost }}>Coche ce qui s'applique à ta journée.</div>
              {NUTRITION_ITEMS.map((item) => {
                const checked = (log.nutrition || {})[item.id];
                return (
                  <button key={item.id}
                    onClick={() => {
                      const cur = log.nutrition || {};
                      const next = { ...cur, [item.id]: !checked };
                      onLog("nutrition", next);
                      const total = NUTRITION_ITEMS.reduce((s, it) => s + (next[it.id] ? it.points : 0), 0);
                      onLog("_pts_nutrition", total);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left"
                    style={{ background: checked ? dim.color + "1A" : C.surfaceRaised, border: `1px solid ${checked ? dim.color + "77" : C.border}` }}>
                    <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: checked ? dim.color : C.borderStrong, background: checked ? dim.color + "33" : "transparent" }}>
                      {checked && <Check size={13} style={{ color: dim.color }} strokeWidth={3} />}
                    </div>
                    <span className="flex-1 text-sm font-semibold" style={{ color: C.text }}>{item.name}</span>
                    <span className="text-[11px] font-bold" style={{ color: dim.color }}>+{item.points}</span>
                  </button>
                );
              })}
              <button onClick={() => setOpenDim(null)}
                className="w-full mt-2 py-3 rounded-2xl text-sm font-bold" style={{ background: dim.color, color: "#0B0810" }}>
                Terminé
              </button>
            </div>
          )}

          {/* Sommeil : horaires coucher / lever + points si renseigné */}
          {dim.type === "sleep" && (() => {
            const bed = tempBed || log.sleepBed || "";
            const wake = tempWake || log.sleepWake || "";
            const dur = (() => {
              if (!bed || !wake) return null;
              const [bh, bm] = bed.split(":").map(Number);
              const [wh, wm] = wake.split(":").map(Number);
              let mins = (wh * 60 + wm) - (bh * 60 + bm);
              if (mins <= 0) mins += 24 * 60; // passage minuit
              return mins;
            })();
            // Historique 7 derniers jours sur grille 0-24h
            const days = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i));
              const iso = localISODate(d); // date LOCALE (évite le décalage UTC)
              const dl = (wellnessLog || {})[iso] || {};
              return { iso, label: d.toLocaleDateString("fr-FR", { weekday: "narrow" }), bed: dl.sleepBed, wake: dl.sleepWake };
            });
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textDim }}>🌙 Coucher</label>
                    <input type="time" value={bed} onChange={(e) => setTempBed(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textDim }}>☀️ Lever</label>
                    <input type="time" value={wake} onChange={(e) => setTempWake(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                      style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
                  </div>
                </div>
                {dur != null && (
                  <div className="text-center text-sm font-bold" style={{ color: dim.color }}>
                    😴 {Math.floor(dur / 60)} h {dur % 60 > 0 ? `${dur % 60} min` : ""}
                  </div>
                )}

                {/* Historique visuel 0-24h */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.textGhost }}>7 derniers jours</div>
                  <div className="flex items-center gap-1 mb-1" style={{ paddingLeft: 18 }}>
                    {[0, 6, 12, 18, 24].map((h) => (
                      <span key={h} className="text-[8px]" style={{ color: C.textGhost, flex: h === 24 ? "0" : "1" }}>{h}h</span>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {days.map((d) => {
                      let seg = null;
                      if (d.bed && d.wake) {
                        const [bh, bm] = d.bed.split(":").map(Number);
                        const [wh, wm] = d.wake.split(":").map(Number);
                        let start = bh + bm / 60;
                        let end = wh + wm / 60;
                        // On dessine la portion de nuit visible sur 0-24 (simplifié : du coucher à 24 + 0 au lever)
                        seg = { start, end };
                      }
                      return (
                        <div key={d.iso} className="flex items-center gap-1.5">
                          <span className="text-[9px] w-3" style={{ color: d.iso === todayISODate() ? dim.color : C.textGhost }}>{d.label}</span>
                          <div className="flex-1 rounded-full relative overflow-hidden" style={{ height: 12, background: C.surfaceRaised, border: `1px solid ${d.iso === todayISODate() ? dim.color + "55" : "transparent"}` }}>
                            {seg && seg.start >= seg.end && (
                              <>
                                <div style={{ position: "absolute", left: `${(seg.start / 24) * 100}%`, right: 0, top: 0, bottom: 0, background: dim.color, opacity: 0.8 }} />
                                <div style={{ position: "absolute", left: 0, width: `${(seg.end / 24) * 100}%`, top: 0, bottom: 0, background: dim.color, opacity: 0.8 }} />
                              </>
                            )}
                            {seg && seg.start < seg.end && (
                              <div style={{ position: "absolute", left: `${(seg.start / 24) * 100}%`, width: `${((seg.end - seg.start) / 24) * 100}%`, top: 0, bottom: 0, background: dim.color, opacity: 0.8 }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button onClick={() => {
                    if (!bed || !wake) return;
                    onLog("sleepBed", bed); onLog("sleepWake", wake);
                    onLog("_pts_sommeil", 5);
                    setTempBed(""); setTempWake(""); setOpenDim(null);
                  }}
                  disabled={!bed || !wake}
                  className="w-full py-3 rounded-2xl text-sm font-bold"
                  style={{ background: dim.color, color: "#0B0810", opacity: (!bed || !wake) ? 0.4 : 1 }}>
                  Enregistrer · +5 pts
                </button>
              </div>
            );
          })()}

          {/* Activité physique : liste de tâches avec points + focus */}
          {dim.type === "activities" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: C.textGhost }}>Coche ce que tu as fait — les points s'ajoutent.</span>
                <button onClick={() => setEditingActs((v) => !v)} className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: C.surfaceRaised, color: editingActs ? dim.color : C.textDim, border: `1px solid ${C.border}` }}>
                  {editingActs ? "Terminé" : "✎ Gérer"}
                </button>
              </div>

              {!editingActs && acts.map((a) => {
                const count = actLog[a.id] || 0;
                // Mode "2 boutons de durée" (marche, méditation, lecture…)
                if (a.timeMode) {
                  const val = actLog[a.id]; // undefined | 5 (pas auj.) | lowPts | highPts
                  const low = a.lowPts || 20, high = a.highPts || 50;
                  const chosen = val !== undefined && val !== null;
                  return (
                    <div key={a.id} className="px-3 py-2.5 rounded-2xl"
                      style={{ background: chosen ? dim.color + "1A" : C.surfaceRaised, border: `1px solid ${chosen ? dim.color + "77" : C.border}` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold flex-1" style={{ color: C.text }}>{a.name}</span>
                        {chosen ? <span className="text-[11px] font-bold" style={{ color: dim.color }}>+{val} pts</span> : null}
                      </div>
                      <StreakGauge streak={activityStreaks?.[a.id]} color={dim.color} />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => onLogActivity(dim.id, a.id, 5, val === 5 ? "unset" : "set")}
                          className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                          style={{ background: val === 5 ? dim.color : C.surface, color: val === 5 ? "#0B0810" : C.textDim, border: `1px solid ${val === 5 ? dim.color : C.border}` }}>
                          Non
                        </button>
                        {[["-30 min", low], ["+30 min", high]].map(([lbl, pts]) => (
                          <button key={pts}
                            onClick={() => onLogActivity(dim.id, a.id, pts, val === pts ? "unset" : "set")}
                            className="flex-1 py-2 rounded-xl text-[11px] font-bold"
                            style={{ background: val === pts ? dim.color : C.surface, color: val === pts ? "#0B0810" : C.textDim, border: `1px solid ${val === pts ? dim.color : C.border}` }}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2.5 rounded-2xl"
                    style={{ background: count > 0 ? dim.color + "1A" : count === -1 ? C.surfaceRaised : C.surfaceRaised, border: `1px solid ${count > 0 ? dim.color + "77" : count === -1 ? "#F59E0B77" : C.border}` }}>
                    <button onClick={() => onLogActivity(dim.id, a.id, a.points || 5, count > 0 ? -count : 1)} className="flex-1 flex items-center gap-2 text-left">
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: count > 0 ? dim.color : count === -1 ? "#F59E0B" : C.borderStrong, background: count > 0 ? dim.color + "33" : count === -1 ? "#F59E0B22" : "transparent" }}>
                        {count > 0 && <Check size={13} style={{ color: dim.color }} strokeWidth={3} />}
                        {count === -1 && <ChevronsRight size={12} style={{ color: "#F59E0B" }} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: C.text }}>{a.name}</div>
                        <div className="text-[10px]" style={{ color: C.textGhost }}>
                          +{a.points || 5} pts{a.minutes ? ` · ${a.minutes} min` : ""}{count === -1 ? " · pas aujourd'hui" : ""}
                        </div>
                        <StreakGauge streak={activityStreaks?.[a.id]} color={dim.color} />
                      </div>
                    </button>
                    {count > 1 && (
                      <span className="text-sm font-bold px-2 py-1 rounded-lg shrink-0" style={{ background: dim.color + "22", color: dim.color }}>×{count}</span>
                    )}
                    {a.incrementable && count > 0 && (
                      <button onClick={() => onLogActivity(dim.id, a.id, a.points || 5, -1)} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }} title="Une fois de moins">
                        <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 700 }}>−</span>
                      </button>
                    )}
                    {a.incrementable && count > 0 && (
                      <button onClick={() => onLogActivity(dim.id, a.id, a.points || 5, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: dim.color + "22", color: dim.color }} title="Une fois de plus">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    )}
                    {count === 0 && (
                      <button onClick={() => onLogActivity(dim.id, a.id, 0, "skip")} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: C.surfaceRaised, color: "#F59E0B", border: `1px solid ${C.border}` }} title="Pas aujourd'hui">
                        <ChevronsRight size={13} strokeWidth={3} />
                      </button>
                    )}
                    {count === -1 && (
                      <button onClick={() => onLogActivity(dim.id, a.id, 0, "skip")} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "#F59E0B22", color: "#F59E0B", border: `1px solid #F59E0B77` }} title="Annuler">
                        <X size={13} strokeWidth={3} />
                      </button>
                    )}
                    {onStartFocus && count >= 0 && (
                      <button onClick={() => { onStartFocus({ id: a.id, title: a.name, focusMinutes: a.minutes || 25 }); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: C.surfaceRaised, color: C.textGhost, border: `1px solid ${C.border}` }} title="Focus">
                        <Timer size={13} />
                      </button>
                    )}
                  </div>
                );
              })}

              {editingActs && (
                <ActivityEditor activities={listForDim(dim.id)} color={dim.color} onEdit={(action, id, payload) => onEditActivities(dim.id, action, id, payload)}
                  suggestions={dim.id === "silence" ? DEFAULT_ESPRIT : null} />
              )}
            </div>
          )}

          <button onClick={() => setOpenDim(null)} className="w-full mt-2 py-2.5 rounded-2xl text-sm"
            style={{ color: C.textGhost }}>Retour</button>
        </div>
      </div>
    );
  }

  // ── Grille principale ──
  const lastWeight = weightLogs && weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].value : null;
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 85,  background: "rgba(11,8,16,0.85)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[88vh] overflow-y-auto"
        style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-xl font-bold italic flex items-center gap-2" style={{ color: C.text }}>
            <Leaf size={20} style={{ color: "#22C55E" }} /> Mon énergie
          </h3>
          <button onClick={onClose} style={{ color: C.textGhost }}><X size={20} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: C.textGhost }}>Ressources physiologiques & habitudes du jour.</p>

        {/* Poids en avant */}
        <button onClick={() => setOpenDim("__weight__")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-3 active:scale-[0.98] transition-transform"
          style={{ background: `linear-gradient(150deg, ${C.surfaceRaised}, ${C.surface})`, border: `1px solid ${C.accent}44` }}>
          <span style={{ fontSize: 24 }}>⚖️</span>
          <div className="flex-1 text-left">
            <div className="text-sm font-bold" style={{ color: C.text }}>Poids</div>
            <div className="text-xs" style={{ color: C.textGhost }}>
              {lastWeight ? `${lastWeight} kg${targetWeight ? ` · objectif ${targetWeight} kg` : ""}` : "Ajoute ta première pesée"}
            </div>
          </div>
          <ChevronRight size={18} style={{ color: C.textGhost }} />
        </button>

        {/* 6 dimensions */}
        <div className="grid grid-cols-2 gap-2.5">
          {ENERGIE_DIMS.map((d) => {
            const noted = log["_pts_" + d.id];
            return (
              <button key={d.id} onClick={() => { setTempScale(null); setTempMin(""); setOpenDim(d.id); }}
                className="rounded-2xl p-3 flex flex-col gap-1.5 active:scale-95 transition-transform text-left"
                style={{ background: noted ? d.color + "1A" : C.surfaceRaised, border: `1px solid ${noted ? d.color + "77" : C.border}` }}>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 22 }}>{d.emoji}</span>
                  {noted && <Check size={14} style={{ color: d.color }} strokeWidth={3} />}
                </div>
                <div className="text-xs font-bold" style={{ color: C.text }}>{d.label}</div>
              </button>
            );
          })}
        </div>

        <button onClick={onClose} className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: C.accent, color: C.bg }}>Fermer</button>
      </div>

      {/* Sous-fenêtre poids */}
      {openDim === "__weight__" && (() => {
        const today = todayISODate();
        const todayEntry = (weightLogs || []).find((w) => w.date === today);
        const alreadyToday = !!todayEntry;
        const hasBase = baseWeight != null || lastWeight != null;
        // Pour comparer les points : la pesée précédant celle d'aujourd'hui
        const prevWeight = (() => {
          const others = (weightLogs || []).filter((w) => w.date !== today).sort((a, b) => a.date.localeCompare(b.date));
          return others.length > 0 ? others[others.length - 1].value : baseWeight;
        })();
        return (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ zIndex: 87,  background: "rgba(11,8,16,0.9)" }}
          onClick={() => setOpenDim(null)}>
          <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: C.surface, border: `${alreadyToday ? 3 : 1}px solid ${alreadyToday ? "#22C55E" : C.borderStrong}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 24 }}>⚖️</span>
              <h3 className="font-display text-lg font-bold italic" style={{ color: C.text }}>{alreadyToday ? "Modifier ma pesée" : "Ma pesée"}</h3>
              {alreadyToday && <Check size={16} style={{ color: "#22C55E" }} strokeWidth={3} />}
            </div>

            {!hasBase ? (
              <div className="text-sm rounded-2xl p-4 mb-2" style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
                ⚖️ Renseigne d'abord ton <b>poids de base</b> dans les Réglages — il sert de point de départ pour suivre ta progression.
              </div>
            ) : (
              <>
                {alreadyToday
                  ? <div className="text-xs mb-3" style={{ color: C.textGhost }}>Pesée d'aujourd'hui : {todayEntry.value} kg — tu peux la corriger.</div>
                  : (prevWeight != null && <div className="text-xs mb-3" style={{ color: C.textGhost }}>Dernière : {prevWeight} kg{targetWeight ? ` · objectif ${targetWeight} kg` : ""}</div>)}
                <input autoFocus type="number" step="0.1" value={tempWeight} onChange={(e) => setTempWeight(e.target.value)}
                  placeholder={alreadyToday ? String(todayEntry.value) : "ex. 72.5"}
                  className="w-full px-3 py-3 rounded-2xl text-sm outline-none mb-2"
                  style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
                <div className="text-[11px] mb-4" style={{ color: C.textGhost }}>
                  +10 pts par 100 g perdus depuis la dernière pesée 💎
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setTempWeight(""); setOpenDim(null); }} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
                {hasBase ? "Annuler" : "Fermer"}
              </button>
              {hasBase && (
                <button onClick={() => { const v = parseFloat(tempWeight); if (!isNaN(v)) { onLogWeight(v, prevWeight); setTempWeight(""); setOpenDim(null); } }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: C.accent, color: C.bg }}>
                  {alreadyToday ? "Modifier" : "Enregistrer"}
                </button>
              )}
            </div>
            {hasBase && !alreadyToday && (
              <button onClick={() => { onSkipWeigh && onSkipWeigh(); setOpenDim(null); }}
                className="w-full mt-2 py-2.5 rounded-2xl text-xs font-semibold"
                style={{ background: log._peseeSkipped ? C.accent + "22" : "transparent", color: log._peseeSkipped ? C.accent : C.textFaint, border: `1px solid ${log._peseeSkipped ? C.accent : C.border}` }}>
                {log._peseeSkipped ? "✓ Pas de pesée aujourd'hui (noté)" : "Pas de pesée aujourd'hui (+5 pts)"}
              </button>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function RituelsModal({ tasks, themes, streakDays, streakRecord, onToggleDone, onEditPoints, onClose }) {

  const wellbeingIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const rituels = tasks.filter((t) => wellbeingIds.has(t.themeId) && t.inToday && !t.cancelled);
  const done = rituels.filter((t) => t.done).length;
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 80,  background: "rgba(11,8,16,0.8)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-xl font-bold italic" style={{ color: C.text }}>Mes rituels</h3>
          <button onClick={onClose} style={{ color: C.textGhost }}><X size={20} /></button>
        </div>
        <div className="text-xs mb-4" style={{ color: C.textGhost }}>
          {done}/{rituels.length} accomplis
          {streakDays > 0 && <span style={{ color: "#F59E0B" }}> · ⚡ {streakDays} jour{streakDays > 1 ? "s" : ""} d'affilée{streakRecord > streakDays ? ` (record ${streakRecord}j)` : ""}</span>}
        </div>

        <div className="space-y-2">
          {rituels.length === 0 && (
            <div className="text-sm text-center py-8" style={{ color: C.textGhost }}>
              Aucun rituel pour aujourd'hui.
            </div>
          )}
          {rituels.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl"
              style={{ background: C.surfaceRaised, border: `1px solid ${t.done ? "#22C55E44" : C.border}` }}>
              <button onClick={() => onToggleDone(t.id)}
                style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", margin: -4, flexShrink: 0 }}>
                <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                  style={{ borderColor: t.done ? "#22C55E" : C.borderStrong, background: t.done ? "#22C55E22" : "transparent" }}>
                  {t.done && <Check size={13} color="#22C55E" strokeWidth={3} />}
                </div>
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium" style={{ color: t.done ? C.textGhost : C.text, opacity: t.done ? 0.6 : 1 }}>
                  {t.title}
                </div>
              </div>
              <button onClick={() => {
                const v = prompt("Points pour ce rituel :", String(typeof t.points === "number" ? t.points : 10));
                if (v !== null) { const n = parseInt(v, 10); if (!isNaN(n) && n >= 0) onEditPoints(t.id, n); }
              }} className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
                style={{ background: C.accent + "22", color: C.accentLight }}>
                {typeof t.points === "number" ? t.points : 10} pts ✎
              </button>
            </div>
          ))}
        </div>

        <button onClick={onClose} className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold"
          style={{ background: C.accent, color: C.bg }}>Fermer</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// MES CARNETS — hiérarchie : Carnet → Notes
// Ex : "Recettes" contient plusieurs notes, "Livres" aussi, etc.
// ══════════════════════════════════════════════════════════════════
const CARNET_EMOJIS = ["📓","🍲","📚","🌿","🎵","✏️","🧭","💡","🗒️","🎨"];
const NOTE_EMOJIS = ["📝","📖","🌱","🎸","⭐","💡","🔖","🧾","🎯","☕","🏡","🧪","🎁","🗺️","💬","❤️","✅","📌","🔑","🎵","🍳","🌿","🧭","📅","💰","🛒","✈️","🎨","🔧","📞"];

function CarnetsView({ notebooks, onAddNotebook, onRenameNotebook, onDeleteNotebook,
                       onAddNote, onUpdateNote, onDeleteNote }) {
  const [openId, setOpenId] = useState(null);      // carnet ouvert
  const [openNoteId, setOpenNoteId] = useState(null); // note ouverte
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [emojiPickerFor, setEmojiPickerFor] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState("");

  const nbs = notebooks || [];
  const current = nbs.find((n) => n.id === openId) || null;
  const currentNote = current ? (current.notes || []).find((x) => x.id === openNoteId) : null;

  // ── Vue 3 : une note ouverte ──
  if (current && currentNote) {
    const dirty = draft.title !== (currentNote.title || "") || draft.body !== (currentNote.body || "");
    const saveNote = () => { onUpdateNote(current.id, currentNote.id, { title: draft.title, body: draft.body }); };
    const cancelNote = () => { setDraft({ title: currentNote.title || "", body: currentNote.body || "" }); };
    return (
      <div className="px-5 pt-4 pb-6">
        {/* Bannière collante : reste visible au-dessus du clavier quand il y a des modifs */}
        {dirty && (
          <div className="sticky top-0 z-30 -mx-5 px-5 py-2 mb-3 flex items-center gap-2"
            style={{ background: C.surfaceRaised, borderBottom: `1px solid ${C.accent}55` }}>
            <span className="text-xs flex-1" style={{ color: C.accentLight }}>● Modifications non enregistrées</span>
            <button onClick={cancelNote} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.border}`, color: C.textDim }}>Annuler</button>
            <button onClick={saveNote} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.accent, color: C.bg }}>Enregistrer</button>
          </div>
        )}
        <button onClick={() => { if (dirty && !confirm("Cette note n'est pas enregistrée. Quitter sans enregistrer ?")) return; setOpenNoteId(null); }} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: C.accentLight }}>
          <ChevronLeft size={16} /> {current.name}
        </button>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Titre de la note"
          className="w-full text-lg font-bold bg-transparent outline-none mb-3 pb-2"
          style={{ color: C.text, borderBottom: `1px solid ${C.border}` }} />
        <textarea
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder="Écris ici…"
          rows={14}
          className="w-full bg-transparent outline-none text-sm leading-relaxed resize-none"
          style={{ color: C.textDim }} />

        {/* Boutons Enregistrer / Annuler */}
        <div className="flex gap-2 mt-3">
          <button onClick={cancelNote} disabled={!dirty}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
            style={{ border: `1px solid ${C.border}`, color: C.textDim }}>
            Annuler
          </button>
          <button onClick={saveNote} disabled={!dirty}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: C.accent, color: C.bg }}>
            {dirty ? "Enregistrer" : "Enregistré ✓"}
          </button>
        </div>

        <button onClick={() => { if (confirm("Supprimer cette note ?")) { onDeleteNote(current.id, currentNote.id); setOpenNoteId(null); } }}
          className="mt-4 text-xs flex items-center gap-1.5" style={{ color: C.danger }}>
          <Trash2 size={13} /> Supprimer cette note
        </button>
      </div>
    );
  }

  // ── Vue 2 : un carnet ouvert → liste des notes ──
  if (current) {
    const notes = current.notes || [];
    return (
      <div className="px-5 pt-4 pb-6">
        <button onClick={() => setOpenId(null)} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: C.accentLight }}>
          <ChevronLeft size={16} /> Mes carnets
        </button>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold italic flex items-center gap-2" style={{ color: C.text }}>
            <span>{current.emoji}</span> {current.name}
          </h2>
          <button onClick={() => { setRenameDraft(current.name); setRenaming(true); }}
            className="p-2 rounded-xl active:scale-90 transition-transform"
            style={{ color: C.accentLight, background: C.surfaceRaised }}><Pencil size={16} /></button>
        </div>

        <button onClick={() => {
            const id = onAddNote(current.id, "Nouvelle note");
            if (id) { setDraft({ title: "Nouvelle note", body: "" }); setOpenNoteId(id); }
          }}
          className="w-full mb-3 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ background: C.accent, color: C.bg }}>
          <Plus size={16} /> Nouvelle note
        </button>

        <div className="space-y-2">
          {notes.length === 0 && (
            <div className="text-sm text-center py-8" style={{ color: C.textGhost }}>
              Ce carnet est vide. Crée ta première note ↑
            </div>
          )}
          {notes.map((n) => (
            <div key={n.id}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <button onClick={(e) => { e.stopPropagation(); setEmojiPickerFor(n.id); }}
                className="shrink-0 rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                style={{ width: 34, height: 34, background: C.surfaceRaised, fontSize: 18 }}>
                {n.emoji || "📝"}
              </button>
              <div className="flex-1 min-w-0 cursor-pointer"
                onClick={() => { setDraft({ title: n.title || "", body: n.body || "" }); setOpenNoteId(n.id); }}>
                <div className="text-sm font-semibold truncate" style={{ color: C.text }}>{n.title || "Sans titre"}</div>
                {n.body && <div className="text-xs truncate mt-0.5" style={{ color: C.textGhost }}>{n.body.slice(0, 60)}</div>}
              </div>
              <ChevronRight size={15} style={{ color: C.textGhost }} />
            </div>
          ))}
        </div>

        {renaming && (
          <div className="fixed inset-0 flex items-center justify-center p-5" style={{ zIndex: 85,  background: "rgba(11,8,16,0.85)" }}
            onClick={() => setRenaming(false)}>
            <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}
              onClick={(e) => e.stopPropagation()}>
              <div className="text-sm font-bold mb-3" style={{ color: C.text }}>Renommer le carnet</div>
              <input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && renameDraft.trim()) { onRenameNotebook(current.id, renameDraft.trim()); setRenaming(false); } }}
                className="w-full px-3 py-3 rounded-2xl text-sm outline-none mb-4"
                style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
              <div className="flex gap-2">
                <button onClick={() => setRenaming(false)} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>Annuler</button>
                <button onClick={() => { if (renameDraft.trim()) { onRenameNotebook(current.id, renameDraft.trim()); setRenaming(false); } }}
                  className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: C.accent, color: C.bg }}>OK</button>
              </div>
            </div>
          </div>
        )}

        {emojiPickerFor && (
          <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 85,  background: "rgba(11,8,16,0.8)" }}
            onClick={() => setEmojiPickerFor(null)}>
            <div className="w-full max-w-md rounded-t-3xl p-5" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}
              onClick={(e) => e.stopPropagation()}>
              <div className="text-sm font-bold mb-3" style={{ color: C.text }}>Choisir une icône</div>
              <div className="grid grid-cols-8 gap-2">
                {NOTE_EMOJIS.map((em) => (
                  <button key={em}
                    onClick={() => { onUpdateNote(current.id, emojiPickerFor, { emoji: em }); setEmojiPickerFor(null); }}
                    className="rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                    style={{ height: 40, background: C.surfaceRaised, fontSize: 20 }}>
                    {em}
                  </button>
                ))}
              </div>
              <button onClick={() => setEmojiPickerFor(null)} className="w-full mt-4 py-2.5 rounded-xl text-sm"
                style={{ border: `1px solid ${C.border}`, color: C.textGhost }}>Fermer</button>
            </div>
          </div>
        )}

        <button onClick={() => { if (confirm(`Supprimer le carnet « ${current.name} » et toutes ses notes ?`)) { onDeleteNotebook(current.id); setOpenId(null); } }}
          className="mt-6 text-xs flex items-center gap-1.5" style={{ color: C.danger }}>
          <Trash2 size={13} /> Supprimer ce carnet
        </button>
      </div>
    );
  }

  // ── Vue 1 : liste des carnets ──
  return (
    <div className="px-5 pt-4 pb-6">
      <h2 className="font-display text-xl font-bold italic mb-4" style={{ color: C.text }}>Mes carnets</h2>

      <div className="space-y-2.5">
        {nbs.length === 0 && (
          <div className="text-sm text-center py-8" style={{ color: C.textGhost }}>
            Aucun carnet pour l'instant.<br />Crée ton premier recueil ci-dessous.
          </div>
        )}
        {nbs.map((nb) => (
          <button key={nb.id} onClick={() => setOpenId(nb.id)}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-3xl text-left active:scale-[0.98] transition-transform"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="rounded-2xl flex items-center justify-center shrink-0"
              style={{ width: 48, height: 48, background: C.accent + "1F", fontSize: 24 }}>
              {nb.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold" style={{ fontSize: 17, color: C.text }}>{nb.name}</div>
              <div className="text-xs mt-0.5" style={{ color: C.textGhost }}>
                {(nb.notes || []).length} note{(nb.notes || []).length > 1 ? "s" : ""}
              </div>
            </div>
            <ChevronRight size={19} style={{ color: C.textGhost }} />
          </button>
        ))}
      </div>

      <button onClick={() => { setCreateDraft(""); setCreating(true); }}
        className="w-full mt-4 py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px dashed ${C.accent}66` }}>
        <Plus size={16} /> Nouveau carnet
      </button>

      {creating && (
        <div className="fixed inset-0 flex items-center justify-center p-5" style={{ zIndex: 85,  background: "rgba(11,8,16,0.85)" }}
          onClick={() => setCreating(false)}>
          <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold mb-1" style={{ color: C.text }}>Nouveau carnet</div>
            <div className="text-xs mb-3" style={{ color: C.textGhost }}>ex. Recettes, Livres, Cueillette…</div>
            <input autoFocus value={createDraft} onChange={(e) => setCreateDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && createDraft.trim()) { onAddNotebook(createDraft.trim()); setCreating(false); } }}
              placeholder="Nom du carnet"
              className="w-full px-3 py-3 rounded-2xl text-sm outline-none mb-4"
              style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
            <div className="flex gap-2">
              <button onClick={() => setCreating(false)} className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>Annuler</button>
              <button onClick={() => { if (createDraft.trim()) { onAddNotebook(createDraft.trim()); setCreating(false); } }}
                className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ background: C.accent, color: C.bg }}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Onglet Réglages ──────────────────────────────────────────────────────────
// ── Le Coffre : récompenses à s'offrir avec ses points ──
function CoffreView({ balance, rewards, history, onAdd, onEdit, onDelete, onClaim, onClose }) {
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState("🎁");
  const [name, setName] = useState("");
  const [cost, setCost] = useState("300");
  const [editId, setEditId] = useState(null);
  const [showHist, setShowHist] = useState(false);
  const EMOJIS = ["🎁", "🎬", "🍫", "🍽️", "🌴", "🎵", "📀", "🍷", "🎮", "📚", "🛍️", "☕", "🧖", "🚗"];

  const submit = () => { if (!name.trim()) return; onAdd(emoji, name, cost); setName(""); setCost("300"); setEmoji("🎁"); setAdding(false); };

  return (
    <div className="px-5 pt-4 pb-24">
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm mb-4" style={{ color: C.accentLight }}>
        <ChevronLeft size={16} /> Retour
      </button>

      {/* Solde du coffre */}
      <div className="rounded-3xl p-5 mb-5 text-center" style={{ background: `linear-gradient(150deg, #F59E0B22, ${C.surface})`, border: `1px solid #F59E0B55` }}>
        <div className="flex justify-center"><TreasureChestIcon open={balance > 0} size={40} /></div>
        <div className="text-xs uppercase tracking-widest mt-1" style={{ color: C.textGhost }}>Mon coffre</div>
        <div className="font-black mt-1" style={{ fontSize: 34, color: "#F59E0B" }}>{balance}</div>
        <div className="text-xs" style={{ color: C.textDim }}>points à dépenser</div>
      </div>

      {/* Récompenses */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.textGhost }}>Mes récompenses</span>
        <button onClick={() => { setAdding((v) => !v); setEditId(null); }} className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: C.accent + "22", color: C.accentLight }}>
          + Nouvelle
        </button>
      </div>

      {adding && (
        <div className="rounded-2xl p-3 mb-3 space-y-2" style={{ background: C.surface, border: `1px dashed ${C.accent}66` }}>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className="w-8 h-8 rounded-lg text-lg" style={{ background: emoji === e ? C.accent + "33" : C.surfaceRaised, border: `1px solid ${emoji === e ? C.accent : C.border}` }}>{e}</button>
            ))}
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la récompense"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
          <div className="flex items-center gap-2">
            <input type="number" value={cost} onChange={(e) => setCost(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg text-sm outline-none text-center" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
            <span className="text-xs" style={{ color: C.textGhost }}>points</span>
            <button onClick={submit} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: C.accent, color: C.bg }}>Ajouter</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {(rewards || []).map((r) => {
          const affordable = balance >= r.cost;
          if (editId === r.id) {
            return (
              <div key={r.id} className="rounded-2xl p-3 space-y-2" style={{ background: C.surface, border: `1px solid ${C.accent}` }}>
                <input defaultValue={r.name} onChange={(e) => r._n = e.target.value} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
                <div className="flex items-center gap-2">
                  <input type="number" defaultValue={r.cost} onChange={(e) => r._c = e.target.value} className="w-24 px-3 py-2 rounded-lg text-sm outline-none text-center" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
                  <button onClick={() => { onEdit(r.id, { name: (r._n ?? r.name).trim() || r.name, cost: Math.max(0, parseInt(r._c ?? r.cost, 10) || r.cost) }); setEditId(null); }} className="flex-1 py-2 rounded-lg text-sm font-bold" style={{ background: C.accent, color: C.bg }}>OK</button>
                  <button onClick={() => { onDelete(r.id); setEditId(null); }} className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ color: C.danger, border: `1px solid ${C.border}` }}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          }
          return (
            <div key={r.id} className="rounded-2xl p-3 flex items-center gap-3"
              style={{ background: affordable ? "#F59E0B18" : C.surface, border: `1px solid ${affordable ? "#F59E0B77" : C.border}`, boxShadow: affordable ? "0 0 16px #F59E0B22" : "none" }}>
              <span style={{ fontSize: 26 }}>{r.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: C.text }}>{r.name}</div>
                <div className="text-xs font-bold" style={{ color: affordable ? "#F59E0B" : C.textGhost }}>{r.cost} pts{!affordable ? ` · encore ${r.cost - balance}` : ""}</div>
              </div>
              <button onClick={() => setEditId(r.id)} style={{ color: C.textGhost }}><Pencil size={13} /></button>
              <button disabled={!affordable} onClick={() => onClaim(r.id)}
                className="text-xs font-bold px-3 py-2 rounded-xl disabled:opacity-40"
                style={{ background: affordable ? "#F59E0B" : C.surfaceRaised, color: affordable ? "#0B0810" : C.textGhost }}>
                {affordable ? "S'offrir 🎉" : "🔒"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Historique */}
      {(history || []).length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowHist((v) => !v)} className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2" style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
            🎉 Récompenses obtenues ({history.length}) <ChevronDown size={14} style={{ transform: showHist ? "rotate(180deg)" : "none" }} />
          </button>
          {showHist && (
            <div className="space-y-1.5 mt-3">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <span>{h.emoji}</span>
                  <span className="flex-1" style={{ color: C.textDim }}>{h.name}</span>
                  <span className="text-[11px]" style={{ color: C.textGhost }}>−{h.cost} · {h.date.slice(8, 10)}/{h.date.slice(5, 7)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsView({ settings, data, persist, themes, openTheme, setOpenTheme, onOpenTheme, onAddTheme, exportData, fileInputRef, importData, onSetLock, onGoStats, notifPermission, onRequestNotif, onOpenInfo, onOk, onCancel }) {
  const soundSettings = settings?.sound || SOUND_DEFAULT_SETTINGS;
  const prof = data.profile || {};
  const setProfile = (patch) => persist({ ...data, profile: { ...prof, ...patch } });
  return (
    <div className="px-5 pt-5 pb-6 space-y-6">
      <h2 className="font-display text-xl font-bold italic" style={{ color: C.text }}>Réglages</h2>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>💾 Sauvegarde de mes données</div>
        <div className="space-y-2">
          <button onClick={exportData} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.accent + "22", color: C.accent }}>
              <Download size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: C.text }}>Sauvegarder</div>
              <div className="text-[11px]" style={{ color: C.textGhost }}>Télécharge un fichier avec toutes tes données, à garder en lieu sûr.</div>
            </div>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.accent + "22", color: C.accent }}>
              <Upload size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: C.text }}>Restaurer</div>
              <div className="text-[11px]" style={{ color: C.textGhost }}>Recharge tes données depuis un fichier de sauvegarde.</div>
            </div>
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>📊 Stats</div>
        <div className="rounded-xl px-4 py-4 space-y-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between text-sm"><span style={{ color: C.textDim }}>Points totaux</span><span className="font-bold" style={{ color: C.accentLight }}>{data.totalPoints || 0}</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: C.textDim }}>Série actuelle</span><span className="font-bold" style={{ color: "#F59E0B" }}>⚡ {data.streakDays||0} jours</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: C.textDim }}>Record</span><span className="font-bold" style={{ color: "#F59E0B" }}>🏆 {data.streakRecord||0} jours</span></div>
          <button onClick={onGoStats} className="w-full mt-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5"
            style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px solid ${C.border}` }}>
            <BarChart2 size={14} /> Voir l'historique complet
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.textGhost }}>🎯 Yes man</div>
        <div className="text-[11px] mb-3" style={{ color: C.textGhost }}>Un jour tiré au sort chaque mois, où la règle est de dire oui à tout. 300 points si le défi est relevé.</div>
        <button onClick={() => persist({ ...data, settings: { ...settings, yesManEnabled: !settings?.yesManEnabled } })}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
          style={{ background: settings?.yesManEnabled ? "#DC262622" : C.surface, border: `1px solid ${settings?.yesManEnabled ? "#DC2626" : C.border}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: settings?.yesManEnabled ? "#DC262633" : C.surfaceRaised, color: settings?.yesManEnabled ? "#DC2626" : C.textFaint }}>🎯</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.text }}>{settings?.yesManEnabled ? "Yes man activé" : "Activer Yes man"}</div>
            <div className="text-[11px]" style={{ color: C.textGhost }}>{settings?.yesManEnabled ? "Un jour par mois, tiré au sort aléatoirement." : "Désactivé"}</div>
          </div>
          <div className="w-11 h-6 rounded-full flex items-center shrink-0 px-0.5" style={{ background: settings?.yesManEnabled ? "#DC2626" : C.borderStrong, justifyContent: settings?.yesManEnabled ? "flex-end" : "flex-start" }}>
            <div className="w-5 h-5 rounded-full bg-white" />
          </div>
        </button>
      </div>

      {/* ── Quiz : choix du thème (le jeu se lance depuis Défis) ── */}
      {(data.quizzes || []).length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🎓 Thème du quiz</div>
          <div className="space-y-2">
            {data.quizzes.map((qz) => {
              const active = (settings?.quizThemeId || data.quizzes[0]?.id) === qz.id;
              return (
                <button key={qz.id} onClick={() => persist({ ...data, settings: { ...settings, quizThemeId: qz.id } })}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                  style={{ background: active ? C.accent + "1A" : C.surface, border: `1px solid ${active ? C.accent : C.border}` }}>
                  <span style={{ fontSize: 20 }}>{qz.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold" style={{ color: C.text }}>{qz.name}</div>
                    <div className="text-[11px]" style={{ color: C.textGhost }}>{qz.questions.length} questions</div>
                  </div>
                  {active && <Check size={16} style={{ color: C.accent }} />}
                </button>
              );
            })}
          </div>
          <div className="text-[11px] mt-2" style={{ color: C.textGhost }}>Le quiz se joue depuis la carte "Défis" de l'accueil.</div>
        </div>
      )}

      {/* ── Profil ── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>👤 Mon profil</div>
        <div className="rounded-2xl p-4 space-y-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          {/* Prénom */}
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textDim }}>Prénom</label>
            <input type="text" value={prof.name || ""} onChange={(e) => setProfile({ name: e.target.value })}
              placeholder="Ton prénom"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
          </div>
          {/* Sexe */}
          <div>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textDim }}>Genre</label>
            <div className="flex gap-2">
              {[["h", "Homme"], ["f", "Femme"], ["a", "Autre"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setProfile({ gender: id })}
                  className="flex-1 py-2 rounded-xl text-xs font-bold"
                  style={{ background: prof.gender === id ? C.accent : C.surfaceRaised,
                    color: prof.gender === id ? C.bg : C.textDim,
                    border: `1px solid ${prof.gender === id ? C.accent : C.border}` }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          {/* Poids de base + souhaité */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textDim }}>Poids de base (kg)</label>
              <input type="number" step="0.1" value={prof.baseWeight ?? ""}
                onChange={(e) => setProfile({ baseWeight: e.target.value === "" ? null : parseFloat(e.target.value) })}
                placeholder="ex. 78"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
            </div>
            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: C.textDim }}>Poids souhaité (kg)</label>
              <input type="number" step="0.1" value={prof.targetWeight ?? ""}
                onChange={(e) => setProfile({ targetWeight: e.target.value === "" ? null : parseFloat(e.target.value) })}
                placeholder="ex. 72"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Environnement (change les petites phrases) ── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.textGhost }}>🌍 Mon environnement</div>
        <div className="text-[11px] mb-3" style={{ color: C.textGhost }}>Change le style des petites phrases du quotidien.</div>
        <div className="grid grid-cols-2 gap-2">
          {ENVIRONMENTS.map(({ id, label, emoji }) => (
            <button key={id} onClick={() => setProfile({ environment: id })}
              className="flex items-center gap-2 px-3 py-3 rounded-2xl text-sm font-semibold text-left"
              style={{ background: prof.environment === id ? C.accent + "22" : C.surface,
                color: prof.environment === id ? C.accentLight : C.text,
                border: `1px solid ${prof.environment === id ? C.accent : C.border}` }}>
              <span style={{ fontSize: 18 }}>{emoji}</span> {label}
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-2xl px-4 py-3 italic text-sm" style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
          « {dailyPhrase(prof.environment)} »
        </div>
      </div>

      {/* ── Ambiance (thème) ── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.textGhost }}>🎨 Ambiance</div>
        <div className="text-[11px] mb-3" style={{ color: C.textGhost }}>Choisis l'univers visuel de l'appli.</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "neutre", label: "Neutre", emoji: "🌙", desc: "Doux & bleuté", swatch: ["#14161C", "#5B9BD5", "#A9CCE8"] },
            { id: "cosmos", label: "Cosmos", emoji: "🌌", desc: "Sombre & violet", swatch: ["#0B0810", "#8B5CF6", "#C084FC"] },
            { id: "jardin", label: "Jardin enchanté", emoji: "🌸", desc: "Clair & rosé", swatch: ["#FFF8FC", "#C9589C", "#E8A6D0"] },
            { id: "sable", label: "Sable", emoji: "🏜️", desc: "Chaud & terracotta", swatch: ["#FFFDF8", "#C2683A", "#E0A47C"] },
            { id: "nature", label: "Nature", emoji: "🌿", desc: "Frais & feuillage", swatch: ["#F8FCF6", "#3B8E4E", "#7FC08C"] },
          ].map((th) => {
            const active = (prof.appTheme || "neutre") === th.id;
            return (
              <button key={th.id} onClick={() => setProfile({ appTheme: th.id })}
                className="rounded-2xl p-2.5 text-left active:scale-[0.98] transition-transform"
                style={{ background: active ? C.accent + "22" : C.surface, border: `2px solid ${active ? C.accent : C.border}` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 18 }}>{th.emoji}</span>
                  {active && <Check size={14} style={{ color: C.accent }} strokeWidth={3} />}
                </div>
                <div className="text-xs font-bold" style={{ color: C.text }}>{th.label}</div>
                <div className="text-[9px] mb-1.5" style={{ color: C.textGhost }}>{th.desc}</div>
                <div className="flex gap-1">
                  {th.swatch.map((c, i) => (
                    <div key={i} className="rounded-full" style={{ width: 13, height: 13, background: c, border: `1px solid ${C.border}` }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Couleur d'accent ── */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🎨 Couleur d'accent</div>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map(({ name, value }) => (
            <button key={value} onClick={() => setProfile({ accentColor: value })}
              className="rounded-full flex items-center justify-center"
              style={{ width: 42, height: 42, background: value,
                border: prof.accentColor === value ? `3px solid ${C.text}` : `2px solid ${C.border}` }}
              title={name}>
              {prof.accentColor === value && <Check size={16} color="#fff" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🔊 Son</div>
        <div className="rounded-xl p-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex gap-2">
            {[["off","🔇 Off"],["quiet","🔈 Discret"],["normal","🔉 Normal"],["present","🔊 Fort"]].map(([lvl,lbl]) => (
              <button key={lvl} onClick={() => {
                const ns = { ...soundSettings, level: lvl };
                persist({ ...data, settings: { ...settings, sound: ns } });
              }} className="flex-1 py-2 rounded-lg text-[10px] font-bold"
                style={{ background: soundSettings.level === lvl ? C.accent : C.surfaceRaised,
                  color: soundSettings.level === lvl ? C.bg : C.textDim,
                  border: `1px solid ${soundSettings.level === lvl ? C.accent : C.border}` }}>{lbl}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🔔 Notifications</div>
        <button onClick={onRequestNotif} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.accent + "22", color: C.accent }}>
            {notifPermission === "granted" ? <Bell size={18} /> : <BellOff size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.text }}>{notifPermission === "granted" ? "Notifications activées" : "Activer les notifications"}</div>
          </div>
        </button>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🔒 Verrouillage</div>
        {data.settings?.lockPattern ? (
          <div className="space-y-2">
            <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.textDim }}>
              <Check size={15} style={{ color: "#22C55E" }} /> Schéma à points activé
            </div>
            <button onClick={() => { if (confirm("Retirer le verrouillage ?")) persist({ ...data, settings: { ...settings, lockPattern: null } }); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${C.border}`, color: C.danger }}>
              Retirer le verrouillage
            </button>
            <button onClick={onSetLock}
              className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${C.border}`, color: C.textDim }}>
              Modifier le schéma
            </button>
          </div>
        ) : (
          <button onClick={onSetLock} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.accent + "22", color: C.accent }}>🔒</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: C.text }}>Protéger par un schéma</div>
              <div className="text-[11px]" style={{ color: C.textGhost }}>Un schéma à points à relier sera demandé à l'ouverture.</div>
            </div>
          </button>
        )}
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🎨 Dossiers</div>
        <div className="space-y-2">
          {themes.map((th) => (
            <div key={th.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="w-4 h-4 rounded-full shrink-0" style={{ background: th.color }}/>
              <span className="text-sm flex-1" style={{ color: C.text }}>{th.name}</span>
              <button onClick={() => onOpenTheme(th)} className="text-xs" style={{ color: C.textGhost }}>Modifier</button>
            </div>
          ))}
          <button onClick={onAddTheme} className="w-full py-3 rounded-xl text-sm font-semibold" style={{ border: `1px dashed ${C.borderStrong}`, color: C.textGhost }}>
            + Nouvelle rubrique
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>ℹ️ Informations</div>
        <button onClick={onOpenInfo} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.surfaceRaised, color: C.textFaint }}>
            <Info size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: C.text }}>Guide des symboles</div>
          </div>
        </button>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🚪 Quitter</div>
        <button onClick={() => {
          try { window.close(); } catch (e) {}
          setTimeout(() => {
            alert("Si l'appli ne s'est pas fermée (certains navigateurs l'empêchent), utilise le bouton retour ou l'accueil de ton téléphone.");
          }, 300);
        }}
          className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ border: `1px solid ${C.border}`, color: C.danger }}>
          Fermer l'appli
        </button>
      </div>

      {/* ── Boutons OK / Annuler ── */}
      <div className="flex gap-3 pt-2">
        <button onClick={() => { if (onCancel) onCancel(); }}
          className="flex-1 py-3 rounded-2xl text-sm font-semibold active:scale-95 transition-transform"
          style={{ background: C.surface, color: C.textDim, border: `1px solid ${C.border}` }}>
          Annuler
        </button>
        <button onClick={() => { if (onOk) onOk(); }}
          className="flex-1 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
          style={{ background: C.accent, color: C.bg }}>
          OK
        </button>
      </div>

      <div className="text-center text-[11px] pt-2 pb-4" style={{ color: C.textGhost }}>
        Version {APP_VERSION}
      </div>
    </div>
  );
}

function OverviewView({
  greeting, dateLabel, percent, doneCount, totalCount, totalMinutes, briefCount,
  overloaded, hasSelfCareTask, onAddSelfCare, urgencyMix, onQuickAdd,
  wellbeingDoneCount, wellbeingTotalCount, wellbeingPercent,
  overdueReview, onMarkDone, onCancelTask, onOpenTask, onOpenGaugeDetail,
  activeReminders, onDismissReminder, todayTasks, themes, onStartFocus,
  onAddToToday, onDeleteTask,
  streakDays, streakRecord,
}) {
  return (
    <div className="px-5 pt-5 space-y-4">
      <div>
        <div className="font-display text-2xl font-semibold italic" style={{ color: C.text }}>{greeting}</div>
        <div className="flex items-center gap-2 text-sm mt-0.5" style={{ color: C.textDim }}>
          <Calendar size={14} /> {dateLabel}
          {saintDuJour(new Date()) && (
            <span style={{ color: C.textGhost }}>· {saintDuJour(new Date())}</span>
          )}
        </div>
        <div className="font-display italic mt-1" style={{ fontSize: "0.8rem", color: C.textGhost }}>
          {dailyPhrase()}
        </div>
      </div>

      {activeReminders.length > 0 && (
        <div className="space-y-2">
          {activeReminders.map((r) => (
            <div key={r.id} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "#2A2313", border: "1px solid #5C4E1E" }}>
              <Bell size={16} style={{ color: "#F5C84C" }} className="shrink-0" />
              <div className="flex-1 min-w-0 text-sm" style={{ color: C.text }}>
                <span className="font-semibold">{r.type === "eve" ? "Demain : " : "Bientôt : "}</span>{r.title}
              </div>
              <button onClick={() => onDismissReminder(r.id)} className="shrink-0" style={{ color: C.textDim }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {overdueReview.length > 0 && (
        <div className="rounded-xl px-4 py-4" style={{ background: C.surfaceRaised, border: `1px solid ${C.accent}55` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.text }}>
            ⚠️ {overdueReview.length} tâche{overdueReview.length > 1 ? "s" : ""} à vérifier
          </div>
          <div className="text-xs mb-3" style={{ color: C.textDim }}>
            Ces tâches étaient prévues avant aujourd'hui. Que faire ?
          </div>
          <div className="space-y-2">
            {overdueReview.map((t) => (
              <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div className="px-3 py-2 text-sm font-medium" style={{ color: C.text }} onClick={() => onOpenTask(t)}>
                  {t.title}
                </div>
                <div className="flex border-t" style={{ borderColor: C.border }}>
                  <button onClick={() => onMarkDone(t.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold"
                    style={{ color: "#4ade80", borderRight: `1px solid ${C.border}` }}>
                    <Check size={12} /> Fait
                  </button>
                  <button onClick={() => onAddToToday(t.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold"
                    style={{ color: C.accentLight, borderRight: `1px solid ${C.border}` }}>
                    <CalendarDays size={12} /> À faire
                  </button>
                  <button onClick={() => onDeleteTask(t.id)}
                    className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold"
                    style={{ color: C.danger }}>
                    <Trash2 size={12} /> Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalCount === 0 && wellbeingTotalCount === 0 && (
        <div className="rounded-xl px-4 py-5 text-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="text-sm font-semibold mb-1" style={{ color: C.text }}>C'est vide pour l'instant</div>
          <div className="text-xs mb-4" style={{ color: C.textDim }}>
            Touche le bouton violet en bas à droite pour créer ta première tâche, ou passe par l'onglet Thèmes pour organiser tes rubriques.
          </div>
          <button
            onClick={onQuickAdd}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md"
            style={{ background: C.accent, color: C.bg }}
          >
            <Plus size={16} /> Créer une tâche
          </button>
        </div>
      )}

      <div className="rounded-xl px-4 py-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-4">
          <CircularProgress percent={percent} doneCount={doneCount} totalCount={totalCount} />
          <div className="flex-1 flex flex-col gap-3">
            <DragonSVG />
            {streakDays > 0 && <StreakBadge days={streakDays} record={streakRecord} />}
          </div>
        </div>
      </div>

    </div>
  );
}

// Affiche les personnes associées à une tâche ; appui sur un nom → menu Appeler/SMS/WhatsApp
function ContactChips({ contacts }) {
  const [menuFor, setMenuFor] = useState(null);
  if (!contacts || contacts.length === 0) return null;
  const clean = (tel) => (tel || "").replace(/[^+0-9]/g, "");
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {contacts.map((c) => (
        <div key={c.tel} className="relative">
          <button onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.tel ? null : c.tel); }}
            className="text-[11px] font-semibold px-2 py-1 rounded-full inline-flex items-center gap-1"
            style={{ background: C.accent + "18", color: C.accentLight }}>
            👤 {c.name}
          </button>
          {menuFor === c.tel && (
            <div className="absolute z-30 mt-1 left-0 rounded-xl overflow-hidden shadow-lg" style={{ background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, minWidth: 150 }}>
              <a href={`tel:${clean(c.tel)}`} onClick={(e) => e.stopPropagation()} className="block px-4 py-2.5 text-sm" style={{ color: C.text }}>📞 Appeler</a>
              <a href={`sms:${clean(c.tel)}`} onClick={(e) => e.stopPropagation()} className="block px-4 py-2.5 text-sm" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>✉️ SMS</a>
              <a href={`https://wa.me/${clean(c.tel).replace(/^\+/, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block px-4 py-2.5 text-sm" style={{ color: C.text, borderTop: `1px solid ${C.border}` }}>💬 WhatsApp</a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TodayView({ tasks, themes, pulseId, onToggleDone, onRemove, onMove, onEdit, onViewDetails, onGoThemes, onStartFocus, dateMode, priorityTaskId, onBulkMarkDone, onBulkToggleCancel, onBulkPostpone, onBulkDelete, onAdvanceChantierState }) {
  const [showNext, setShowNext] = useState(false);
  const [showToday, setShowToday] = useState(true);
  const [showAsap, setShowAsap] = useState(true);
  const [showChantiers, setShowChantiers] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleSelected = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); setShowBulkMenu(false); };
  const onOpenBulkMenu = () => setShowBulkMenu(true);
  const events = tasks.filter((t) => t.kind === "event" || t.kind === "prestation");
  const regularTasks = tasks.filter((t) => t.kind !== "event" && t.kind !== "prestation" && t.kind !== "chantier");

  const renderRow = (t, i, list) => {
    const theme = themes.find((th) => th.id === t.themeId);
    const isWellbeing = theme?.wellbeing;
    const isEvent = t.kind === "event" || t.kind === "prestation";
    const flagColor = t.kind === "prestation" ? "#8B5CF6" : "#F59E0B";
    const canFocus = !t.done && !t.cancelled && !isEvent;
    const isSelected = selectedIds.has(t.id);
    return (
      <div
        key={t.id}
        onClick={() => selectMode && !t._cl ? toggleSelected(t.id) : undefined}
        className={`rounded-lg px-3 py-3 flex items-center gap-3 ${pulseId === t.id ? "pulse-done" : ""}`}
        style={{ background: isSelected ? C.accent + "1A" : isEvent ? (theme?.color || C.accent) + "12" : isWellbeing ? theme.color + "14" : C.surface, border: `1px solid ${isSelected ? C.accent : isEvent ? (theme?.color || C.accent) + "40" : isWellbeing ? theme.color + "40" : C.border}` }}
      >
        {selectMode && !t._cl ? (
          <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: isSelected ? C.accent : "transparent", border: `1.5px solid ${isSelected ? C.accent : C.borderStrong}` }}>
            {isSelected && <Check size={14} color={C.bg} strokeWidth={3} />}
          </span>
        ) : isEvent ? (
          <button onClick={() => onEdit(t)} className="shrink-0" aria-label="Ouvrir les actions" title="Ouvrir les actions">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: t.done ? "#22C55E" : (theme?.color || C.accent) + "22" }}>
              {t.done ? <Check size={14} color="#0B0810" strokeWidth={3} /> : <CalendarDays size={14} style={{ color: theme?.color || C.accent }} />}
            </div>
          </button>
        ) : (
          <button onClick={() => onEdit(t)} className="shrink-0" aria-label="Ouvrir les actions" title="Ouvrir les actions">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: t.cancelled ? C.borderStrong : t.done ? C.accent : C.borderStrong, background: t.cancelled ? C.surfaceRaised : t.done ? C.accent : "transparent" }}
            >
              {t.done && <Check size={13} color={C.bg} strokeWidth={3} />}
              {t.cancelled && <X size={13} color={C.textGhost} strokeWidth={3} />}
            </div>
          </button>
        )}

        <div className="flex-1 min-w-0" onClick={(e) => {
          if (selectMode) {
            if (isSelected) { e.stopPropagation(); onOpenBulkMenu(); }
            // sinon (pas encore sélectionnée) : le clic remonte au conteneur, qui la sélectionne.
          } else {
            onEdit(t);
          }
        }}>
          <div className="flex items-center gap-2 mb-0.5">
            {!t.done && !t.cancelled && !isWellbeing && (
              isEvent ? <Flag size={12} fill={flagColor} style={{ color: flagColor, flexShrink: 0 }} /> : <UrgencyDot urgency={t.urgency || 2} />
            )}
            <div
              className="text-base leading-snug font-medium flex-1 min-w-0 line-clamp-2"
              style={{
                color: t.done ? "#5C9977" : t.cancelled ? C.textGhost : C.text,
                textDecoration: (t.done || t.cancelled) ? "line-through" : "none",
              }}
            >
              {t.title}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TaskBadges t={t} theme={theme} showTheme={!isWellbeing} />
            {!isEvent && !t.dueDate && !t.startDate && (() => {
              const days = t.createdAt ? daysSinceISO(t.createdAt) : 0;
              return (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: C.textFaint + "22", color: C.textFaint }}>
                  🗓️ Sans date{days >= 1 ? ` · depuis ${days} j` : ""}
                </span>
              );
            })()}
            {t._cl && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1" style={{ background: C.accent + "18", color: C.accentLight }}>
                {t._cl.clEmoji} {t._cl.clName}
              </span>
            )}
            {t.focusDelta != null && (
              <span className="text-[10px] font-semibold" style={{ color: t.focusDelta <= 0 ? "#4ade80" : C.danger }}>
                {t.focusDelta > 0 ? `+${Math.round(t.focusDelta / 60)} min` : `−${Math.round(Math.abs(t.focusDelta) / 60)} min`}
              </span>
            )}
          </div>
          {t.contacts && t.contacts.length > 0 && <ContactChips contacts={t.contacts} />}
        </div>

        {canFocus && !t._cl && (
          <button
            onClick={() => onStartFocus(t)}
            className="text-[10px] font-bold px-2 py-1 rounded shrink-0"
            style={{ background: C.accent + "22", color: t.focusElapsed ? "#FFD166" : C.accentLight, border: `1px solid ${t.focusElapsed ? "#FFD166" : C.accent + "55"}` }}
            aria-label={t.focusElapsed ? "Reprendre le focus" : "Mode Focus"}
          >
            {t.focusElapsed ? "▶ Focus" : "Focus"}
          </button>
        )}

        {!t._cl && (
          <button onClick={() => onViewDetails(t)} className="shrink-0 p-1" style={{ color: C.textFaint }} aria-label="Voir les détails" title="Voir les détails">
            <Eye size={15} />
          </button>
        )}

        {!t._cl && !isEvent && (
          <div className="flex flex-col items-center shrink-0">
            <button onClick={() => onMove(t.id, -1)} disabled={i === 0} className="disabled:opacity-20 p-0.5" style={{ color: C.textDim }}>
              <ChevronUp size={16} />
            </button>
            <button onClick={() => onMove(t.id, 1)} disabled={i === list.length - 1} className="disabled:opacity-20 p-0.5" style={{ color: C.textDim }}>
              <ChevronDown size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  // Regroupe les items par date (dueDate ou startDate) pour le mode "datées"
  const anchorOf = (t) => t.dueDate || t.startDate || null;
  const todayISO = todayISODate();

  return (
    <div className="px-5 pt-5" style={{ paddingBottom: selectMode && selectedIds.size > 0 ? 90 : 0 }}>
      {tasks.length > 0 && (
        <div className="flex items-center justify-end mb-3">
          <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: selectMode ? C.accent : "transparent", color: selectMode ? C.bg : C.textDim, border: `1px solid ${selectMode ? C.accent : C.borderStrong}` }}>
            {selectMode ? "Annuler la sélection" : "Sélection multiple"}
          </button>
        </div>
      )}
      {tasks.length === 0 && (
        <div className="text-center py-12" style={{ color: C.textDim }}>
          <p className="mb-4 text-sm">Rien de prévu pour l'instant.</p>
          <button onClick={onGoThemes} className="text-sm font-semibold px-4 py-2 rounded-md" style={{ background: C.accent, color: C.bg }}>
            Choisir des tâches
          </button>
        </div>
      )}

      {dateMode && tasks.length > 0 ? (() => {
        const dayTasks = regularTasks.filter((t) => taskCoversDate(t, todayISO) || (t.inToday && anchorOf(t) && !t.cancelled))
          .sort((a, b) => (b.urgency || 2) - (a.urgency || 2));
        const dayEvents = events.filter((t) => taskCoversDate(t, todayISO));
        const futureItems = tasks.filter((t) => { const a = anchorOf(t); return a && a > todayISO && !taskCoversDate(t, todayISO) && !t.inToday; })
          .sort((a, b) => (anchorOf(a) || "").localeCompare(anchorOf(b) || ""));
        const groups = {};
        futureItems.forEach((t) => { const a = anchorOf(t); (groups[a] = groups[a] || []).push(t); });
        const groupDates = Object.keys(groups).sort();
        // Tâches sans aucune date, quel que soit leur statut "inToday" — triées par urgence décroissante.
        const undated = tasks.filter((t) => t.kind !== "chantier" && !anchorOf(t) && !taskCoversDate(t, todayISO))
          .sort((a, b) => (b.urgency || 2) - (a.urgency || 2));
        const chantiers = tasks.filter((t) => t.kind === "chantier" && !t.cancelled && (!t.done || (t.completedAt || "").slice(0, 10) === todayISO))
          .sort((a, b) => (b.urgency || 2) - (a.urgency || 2) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
        const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); };

        return (
          <>
            <button onClick={() => setShowToday((v) => !v)} className="w-full flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: C.accentLight }}>📅 Tâches du jour</span>
              <ChevronDown size={16} style={{ color: C.accentLight, transform: showToday ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
            {showToday && (
              dayTasks.length === 0 && dayEvents.length === 0 ? (
                <p className="text-sm mb-4" style={{ color: C.textGhost }}>Aucune tâche datée aujourd'hui.</p>
              ) : (
                <div className="space-y-2 mb-2">
                  {dayTasks.map((t, i) => renderRow(t, i, dayTasks))}
                  {dayEvents.map((t, i) => renderRow(t, i, dayEvents))}
                </div>
              )
            )}

            {chantiers.length > 0 && (
              <div className="mt-6">
                <button onClick={() => setShowChantiers((v) => !v)} className="w-full flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#38BDF8" }}>🧭 Tâches au long cours ({chantiers.length})</span>
                  <ChevronDown size={16} style={{ color: "#38BDF8", transform: showChantiers ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {showChantiers && (
                  <div className="space-y-2">
                    {chantiers.map((t) => {
                      const validToday = t.chantierStateDate === todayISO;
                      const current = t.done ? "done" : (validToday && t.chantierState === "fait") ? "fait" : (validToday && t.chantierState === "demain") ? "demain" : "none";
                      const finishedToday = current === "done";
                      const theme = themes.find((th) => th.id === t.themeId);
                      const circleColor = current === "done" ? "#C4B5FD" : current === "demain" ? "#F59E0B" : current === "fait" ? "#22C55E" : C.borderStrong;
                      const circleBg = current === "done" ? "#C4B5FD" : current === "demain" ? "#F59E0B" : current === "fait" ? "#22C55E" : "transparent";
                      const stateText = current === "done" ? "Tâche enfin terminée ! Bravo !" : current === "demain" ? "On verra plutôt ça demain !" : current === "fait" ? "OK pour aujourd'hui... à suivre !" : null;
                      return (
                        <div key={t.id} className="rounded-lg px-3 py-3 flex items-center gap-3" style={{ background: "#38BDF814", border: `1px solid #38BDF840`, opacity: finishedToday ? 0.6 : 1 }}>
                          <button onClick={() => onAdvanceChantierState(t.id)}
                            aria-label={stateText || "Pas fait aujourd'hui"}
                            title={stateText || "Pas fait aujourd'hui"}
                            className="shrink-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center border-2" style={{ borderColor: circleColor, background: circleBg }}>
                              {current === "done" && <CheckCheck size={15} color="#0B0810" strokeWidth={3} />}
                              {current === "demain" && <ChevronsRight size={14} color="#0B0810" strokeWidth={3} />}
                              {current === "fait" && <Check size={14} color="#0B0810" strokeWidth={3} />}
                            </div>
                          </button>
                          <div className="flex-1 min-w-0" onClick={() => onEdit(t)}>
                            <div className="flex items-center gap-2 mb-1">
                              {!finishedToday && <UrgencyDot urgency={t.urgency || 2} />}
                              <span className="text-sm font-medium flex-1 line-clamp-2" style={{ color: finishedToday ? C.textGhost : C.text, textDecoration: finishedToday ? "line-through" : "none" }}>{t.title}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {stateText && (
                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: circleBg, color: "#0B0810" }}>{stateText}</span>
                              )}
                              {theme && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: theme.color + "22", color: theme.color }}>{theme.name}</span>}
                              {t.dueDate && !finishedToday && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: C.surfaceRaised, color: C.textDim }}>
                                  jusqu'au {fmtDate(t.dueDate)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button onClick={() => onViewDetails(t)} className="shrink-0 p-1" style={{ color: C.textFaint }} aria-label="Voir les détails" title="Voir les détails">
                            <Eye size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {undated.length > 0 && (
              <div className="mt-6">
                <button onClick={() => setShowAsap((v) => !v)} className="w-full flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.textFaint }}>⏳ À faire dès que possible ! ({undated.length})</span>
                  <ChevronDown size={16} style={{ color: C.textFaint, transform: showAsap ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {showAsap && (
                  <div className="space-y-2">
                    {undated.map((t, i) => renderRow(t, i, undated))}
                  </div>
                )}
              </div>
            )}

            {groupDates.length > 0 && (
              <div className="mt-4">
                <button onClick={() => setShowNext((v) => !v)} className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-3"
                  style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px solid ${C.accent}55` }}>
                  {showNext ? "Masquer" : "Jours suivants"} ({futureItems.length}) <ChevronDown size={14} style={{ transform: showNext ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {showNext && groupDates.map((iso) => {
                  const its = groups[iso];
                  const tks = its.filter((t) => t.kind !== "event");
                  const evs = its.filter((t) => t.kind === "event");
                  return (
                    <div key={iso} className="mb-4">
                      <div className="text-xs font-bold capitalize mb-2 px-2 py-1 rounded-md inline-block" style={{ color: C.bg, background: C.accentLight }}>{fmtDate(iso)}</div>
                      <div className="space-y-2">
                        {tks.map((t, i) => renderRow(t, i, tks))}
                        {evs.map((t, i) => renderRow(t, i, evs))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {(() => {
              // Tâches faites récemment (7 derniers jours), pour les retrouver facilement
              const doneRecent = tasks.filter((t) => {
                if (!t.done || t.cancelled || t.kind === "event") return false;
                const day = t.lastDoneDate || (t.completedAt ? t.completedAt.slice(0, 10) : null);
                return day && day >= addDaysISO(-7) && day <= todayISO;
              }).sort((a, b) => {
                const da = a.lastDoneDate || (a.completedAt || "").slice(0, 10);
                const db = b.lastDoneDate || (b.completedAt || "").slice(0, 10);
                return db.localeCompare(da);
              });
              if (doneRecent.length === 0) return null;
              return (
                <div className="mt-6">
                  <button onClick={() => setShowDone((v) => !v)} className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: C.surfaceRaised, color: "#22C55E", border: `1px solid #22C55E44` }}>
                    ✓ Faites récemment ({doneRecent.length}) <ChevronDown size={14} style={{ transform: showDone ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                  </button>
                  {showDone && (
                    <div className="space-y-2 mt-3">
                      {doneRecent.map((t, i) => renderRow(t, i, doneRecent))}
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        );
      })() : (
        <>
          {events.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C.accentLight }}>
                <CalendarDays size={13} /> Événements
              </div>
              <div className="space-y-2">
                {events.map((t, i) => renderRow(t, i, events))}
              </div>
            </div>
          )}

          {regularTasks.length > 0 && (() => {
            const sorted = [...regularTasks].sort((a, b) => (b.urgency || 2) - (a.urgency || 2));
            return (
              <div className="space-y-2">
                {sorted.map((t, i) => renderRow(t, i, sorted))}
              </div>
            );
          })()}
        </>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 py-3" style={{ background: C.surface, borderTop: `1px solid ${C.borderStrong}` }}>
          <div className="max-w-md mx-auto flex items-center gap-2">
            <span className="text-xs font-bold shrink-0" style={{ color: C.textDim }}>{selectedIds.size}</span>
            <button onClick={() => { onBulkMarkDone([...selectedIds]); exitSelectMode(); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: "#22C55E" }}>
              <Check size={18} /><span className="text-[10px] font-semibold">Fait</span>
            </button>
            <button onClick={() => { onBulkToggleCancel([...selectedIds]); exitSelectMode(); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: C.textDim }}>
              <Ban size={18} /><span className="text-[10px] font-semibold">Annuler</span>
            </button>
            <button onClick={() => { onBulkPostpone([...selectedIds]); exitSelectMode(); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: C.accentLight }}>
              <CalendarClock size={18} /><span className="text-[10px] font-semibold">Reporter</span>
            </button>
            <button onClick={() => { if (confirm(`Supprimer ${selectedIds.size} tâche(s) ?`)) { onBulkDelete([...selectedIds]); exitSelectMode(); } }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: C.danger }}>
              <Trash2 size={18} /><span className="text-[10px] font-semibold">Suppr.</span>
            </button>
          </div>
        </div>
      )}

      {showBulkMenu && selectedIds.size > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: "rgba(11,8,16,0.85)" }} onClick={() => setShowBulkMenu(false)}>
          <div className="w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>
              {selectedIds.size} tâche{selectedIds.size > 1 ? "s" : ""} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => { onBulkMarkDone([...selectedIds]); exitSelectMode(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
                style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
                <Check size={17} style={{ color: "#22C55E" }} /> Marquer comme fait
              </button>
              <button onClick={() => { setShowBulkMenu(false); onBulkPostpone([...selectedIds]); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
                style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
                <CalendarClock size={17} style={{ color: C.accentLight }} /> Reporter
              </button>
              <button onClick={() => { onBulkToggleCancel([...selectedIds]); exitSelectMode(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
                style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
                <Ban size={17} style={{ color: C.textDim }} /> Annuler
              </button>
              <button onClick={() => { if (window.confirm(`Supprimer ${selectedIds.size} tâche(s) ?`)) { onBulkDelete([...selectedIds]); exitSelectMode(); } }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
                style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
                <Trash2 size={17} style={{ color: C.danger }} /> Supprimer
              </button>
            </div>
            <button onClick={() => setShowBulkMenu(false)} className="w-full mt-3 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MonthCalendar({ tasks, themes, monthDate, onPrevMonth, onNextMonth, selectedDate, onSelectDate }) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = todayISODate();

  const wellbeingThemeIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const itemsOn = (iso) => tasks.filter((t) => !t.done && !t.cancelled && (t.kind !== "task" || t.dueDate || (t.startDate && t.endDate)) && (t.startDate || t.dueDate) && !wellbeingThemeIds.has(t.themeId) && taskCoversDate(t, iso));

  const monthLabel = monthDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-xl px-3 py-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={onPrevMonth} style={{ color: C.textDim }} aria-label="Mois précédent">
          <ChevronLeft size={18} />
        </button>
        <div className="text-sm font-semibold capitalize font-display" style={{ color: C.text }}>{monthLabel}</div>
        <button onClick={onNextMonth} style={{ color: C.textDim }} aria-label="Mois suivant">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-1" style={{ color: C.textFaint }}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, idx) => {
          if (d === null) return <div key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isToday = iso === todayISO;
          const dayItems = itemsOn(iso);
          const hasItems = dayItems.length > 0;
          const overdue = iso < todayISO && hasItems;
          const isSelected = selectedDate === iso;
          const fullMoon = isFullMoon(iso);
          return (
            <button
              key={idx}
              onClick={() => onSelectDate(iso)}
              className="aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 text-xs relative"
              style={{
                background: isSelected ? C.accent + "35" : "transparent",
                border: `1px solid ${isToday ? C.accent : "transparent"}`,
                color: C.text,
              }}
            >
              {fullMoon ? (
                <span style={{ fontSize: 20, lineHeight: 1 }} title={`Pleine lune · ${d}`}>🌕</span>
              ) : (
                <span>{d}</span>
              )}
              {hasItems && <span className="w-1.5 h-1.5 rounded-full" style={{ background: overdue ? C.danger : "#F5C84C" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ tasks, themes, onEdit, onAddOnDate, onToggleDone, onViewDetails }) {
  const [viewMode, setViewMode] = useState("list");
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState(todayISODate());
  const [showTasks, setShowTasks] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const [showPrestations, setShowPrestations] = useState(true);
  const [showPast, setShowPast] = useState(false);

  const wellbeingThemeIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const matchesKind = (t) => (t.kind === "prestation" ? showPrestations : t.kind === "event" ? showEvents : showTasks);

  const renderItemRow = (t) => {
    const theme = themes.find((th) => th.id === t.themeId);
    const overdue = t.kind !== "event" && t.kind !== "prestation" && t.dueDate && t.dueDate < todayISODate() && !t.done;
    const isCancelled = !!t.cancelled;
    const isDoneEvent = t.kind !== "task" && t.done;
    return (
      <div
        key={t.id}
        onClick={() => onEdit(t)}
        className="rounded-lg px-3 py-3 mb-2 flex items-center gap-3 relative"
        style={{ background: C.surface, border: `1px solid ${overdue && !isCancelled ? "#5C1E33" : C.border}`, opacity: isCancelled ? 0.55 : isDoneEvent ? 0.6 : 1 }}
      >
        {!isCancelled && (t.kind === "event" || t.kind === "prestation") && (
          <button onClick={(e) => { e.stopPropagation(); onToggleDone(t.id); }} className="shrink-0" aria-label={isDoneEvent ? "Marquer non fait" : "Valider"} title={isDoneEvent ? "Marquer non fait" : "Valider"}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: isDoneEvent ? "#22C55E" : (t.kind === "prestation" ? "#8B5CF6" : "#F59E0B") + "22" }}>
              {isDoneEvent ? <Check size={14} color="#0B0810" strokeWidth={3} /> : <Flag size={13} style={{ color: t.kind === "prestation" ? "#8B5CF6" : "#F59E0B" }} fill={t.kind === "prestation" ? "#8B5CF6" : "#F59E0B"} />}
            </div>
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-base font-medium leading-snug line-clamp-2" style={{ color: C.text, textDecoration: (isCancelled || isDoneEvent) ? "line-through" : "none" }}>
            {t.title}{isCancelled && <span className="text-xs font-semibold ml-2" style={{ color: C.textGhost }}>Annulé</span>}
            {!isCancelled && isDoneEvent && <span className="text-xs font-semibold ml-2" style={{ color: "#22C55E" }}>✓ Fait</span>}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TaskBadges t={t} theme={theme} />
          </div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onViewDetails(t); }} className="shrink-0 p-1" style={{ color: C.textFaint }} aria-label="Voir les détails" title="Voir les détails">
          <Eye size={15} />
        </button>
      </div>
    );
  };

  const items = tasks
    .filter((t) => (t.kind === "task" ? !t.done : true) && !t.cancelled && (t.kind !== "task" || t.dueDate || (t.startDate && t.endDate)) && (t.startDate || t.dueDate) && !wellbeingThemeIds.has(t.themeId) && t.showInAgenda !== false && matchesKind(t))
    .flatMap((t) => {
      // Étale les événements/prestations multi-jours sur CHAQUE jour couvert
      // (pas seulement leur date de début) — un dueDate reste, lui, ponctuel.
      if (t.startDate && t.endDate && t.endDate > t.startDate) {
        const days = [];
        let cur = t.startDate;
        while (cur <= t.endDate) {
          days.push({ t, anchor: cur });
          cur = isoShift(cur, 1);
        }
        return days;
      }
      const anchor = agendaAnchorDate(t);
      return anchor ? [{ t, anchor }] : [];
    })
    .sort((a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : (a.t.time || "").localeCompare(b.t.time || "")));

  // Regroupe les items par jour (anchor), pour un encadré spécial "aujourd'hui"
  // et un trait bien marqué entre chaque jour.
  const groups = [];
  items.forEach(({ t, anchor }) => {
    let g = groups[groups.length - 1];
    if (!g || g.anchor !== anchor) {
      g = { anchor, header: agendaDateHeader(anchor), items: [] };
      groups.push(g);
    }
    g.items.push(t);
  });
  groups.forEach((g) => {
    if (g.header === "En retard" && g.items.every((t) => t.kind !== "task")) {
      const d = new Date(g.anchor + "T00:00:00");
      const weekday = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
      g.header = `${weekday} · Passé`;
    }
  });
  const today = todayISODate();
  const splitIdx = groups.findIndex((g) => g.anchor >= today);
  const cutoff = splitIdx === -1 ? groups.length : splitIdx;
  const pastGroups = groups.slice(0, cutoff);
  const visibleGroups = showPast ? groups : groups.slice(cutoff);
  const nodes = visibleGroups.map((g, idx) => {
    const isToday = g.anchor === today;
    const isOverdue = g.header === "En retard";
    return (
      <div key={`g-${g.anchor}`} style={{ marginTop: idx === 0 ? 0 : 22, paddingTop: idx === 0 ? 0 : 18, borderTop: idx === 0 ? "none" : `2px solid ${C.borderStrong}` }}>
        <div
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: isOverdue ? C.danger : isToday ? C.accent : C.textFaint }}
        >
          {g.header}
        </div>
        <div
          style={isToday ? { background: C.accent + "14", border: `1px solid ${C.accent}55`, borderRadius: 14, padding: 10 } : {}}
        >
          {g.items.map((t) => renderItemRow(t))}
        </div>
      </div>
    );
  });

  const selectedDayItems = tasks.filter(
    (t) => !t.done && !t.cancelled && (t.kind !== "task" || t.dueDate || (t.startDate && t.endDate)) && (t.startDate || t.dueDate) && !wellbeingThemeIds.has(t.themeId) && taskCoversDate(t, selectedDate) && matchesKind(t)
  );

  return (
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.textFaint }}>
          {viewMode === "list" ? "Vue liste" : "Vue mois"}
        </div>
        <div className="flex items-center gap-2">
          {onAddOnDate && (
            <button
              onClick={() => onAddOnDate(viewMode === "calendar" ? selectedDate : todayISODate())}
              className="w-8 h-8 rounded-md flex items-center justify-center"
              style={{ background: C.accent, color: C.bg }}
              title={viewMode === "calendar" ? "Ajouter sur ce jour" : "Ajouter"}
            >
              <Plus size={16} />
            </button>
          )}
          <button
            onClick={() => setViewMode((v) => (v === "list" ? "calendar" : "list"))}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: viewMode === "calendar" ? C.accent : "transparent", color: viewMode === "calendar" ? C.bg : C.textDim, border: `1px solid ${viewMode === "calendar" ? C.accent : C.borderStrong}` }}
          >
            <CalendarRange size={14} /> {viewMode === "list" ? "Voir le mois" : "Voir la liste"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setShowTasks((v) => !v)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: showTasks ? C.accent : "transparent", color: showTasks ? C.bg : C.textDim, border: `1px solid ${showTasks ? C.accent : C.borderStrong}` }}>
          Tâches
        </button>
        <button onClick={() => setShowEvents((v) => !v)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5"
          style={{ background: showEvents ? "#F59E0B" : "transparent", color: showEvents ? "#0B0810" : C.textDim, border: `1px solid ${showEvents ? "#F59E0B" : C.borderStrong}` }}>
          <Flag size={12} fill={showEvents ? "#0B0810" : "none"} /> Événements
        </button>
        <button onClick={() => setShowPrestations((v) => !v)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5"
          style={{ background: showPrestations ? "#8B5CF6" : "transparent", color: showPrestations ? "#FFFFFF" : C.textDim, border: `1px solid ${showPrestations ? "#8B5CF6" : C.borderStrong}` }}>
          <Flag size={12} fill={showPrestations ? "#FFFFFF" : "none"} /> Prestations
        </button>
      </div>

      {viewMode === "calendar" ? (
        <>
          <MonthCalendar
            tasks={tasks}
            themes={themes}
            monthDate={monthDate}
            onPrevMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            onNextMonth={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>
            {agendaDateHeader(selectedDate)}
          </div>
          {selectedDayItems.length === 0 && (
            <p className="text-sm py-4 text-center" style={{ color: C.textDim }}>Rien de prévu ce jour-là.</p>
          )}
          {selectedDayItems.map(renderItemRow)}
        </>
      ) : (
        <>
          {items.length === 0 && (
            <p className="text-sm py-8 text-center" style={{ color: C.textDim }}>
              Aucun événement à venir. Crée une tâche de type "Événement" avec une date pour la voir ici.
            </p>
          )}
          {pastGroups.length > 0 && (
            <button onClick={() => setShowPast((v) => !v)}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 mb-4"
              style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
              {showPast ? "Masquer les événements passés" : `Voir les événements passés (${pastGroups.reduce((s, g) => s + g.items.length, 0)})`}
              <ChevronDown size={14} style={{ transform: showPast ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
            </button>
          )}
          {nodes}
        </>
      )}
    </div>
  );
}

function PrioritiesView({ tasks, themes, onToggleToday, onEdit, onBulkMarkDone, onBulkToggleCancel, onBulkPostpone, onBulkDelete }) {
  const [filterTheme, setFilterTheme] = useState("all");
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [sortMode, setSortMode] = useState("urgency"); // "urgency" | "date"
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const toggleSelected = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  const wellbeingThemeIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  let filtered = tasks.filter((t) => {
    if (filterTheme !== "all" && t.themeId !== filterTheme) return false;
    if (filterUrgency !== "all" && (t.urgency || 2) !== filterUrgency) return false;
    return true;
  });
  if (sortMode === "date") {
    filtered = [...filtered].sort((a, b) => {
      const aInactive = a.done || a.cancelled ? 1 : 0;
      const bInactive = b.done || b.cancelled ? 1 : 0;
      if (aInactive !== bInactive) return aInactive - bInactive;
      const aDate = agendaAnchorDate(a) || "9999-99-99";
      const bDate = agendaAnchorDate(b) || "9999-99-99";
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;
      return a.order - b.order;
    });
  }
  const regularTasks = filtered.filter((t) => !wellbeingThemeIds.has(t.themeId));
  const wellbeingTasks = filtered.filter((t) => wellbeingThemeIds.has(t.themeId));

  const renderRow = (t) => {
    const theme = themes.find((th) => th.id === t.themeId);
    const urgencyColor = URGENCY.find((u) => u.level === (t.urgency || 2))?.color || C.textDim;
    const inactive = t.done || t.cancelled;
    const hasDate = t.dueDate || t.startDate || t.postponedTo;
    const isSelected = selectedIds.has(t.id);
    return (
      <div
        key={t.id}
        onClick={() => selectMode ? toggleSelected(t.id) : onEdit(t)}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
        style={{ background: isSelected ? C.accent + "1A" : C.surface, border: `1px solid ${isSelected ? C.accent : C.border}` }}
      >
        {selectMode && (
          <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: isSelected ? C.accent : "transparent", border: `1.5px solid ${isSelected ? C.accent : C.borderStrong}` }}>
            {isSelected && <Check size={13} color={C.bg} />}
          </span>
        )}
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: theme?.color || C.borderStrong }} />
        <span
          className="flex-1 min-w-0 text-sm"
          style={{
            color: inactive ? C.textGhost : C.text,
            textDecoration: inactive ? "line-through" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {t.title}
        </span>
        <span className="flex items-center gap-1.5 shrink-0" style={{ color: C.textDim }}>
          {t.notes && t.notes.trim() && <StickyNote size={12} />}
          {t.recurrence && <Repeat size={12} />}
          {t.kind === "event" && <CalendarDays size={12} />}
          {hasDate && t.kind !== "event" && <Flag size={12} />}
          {!inactive && <span className="w-2 h-2 rounded-full" style={{ background: urgencyColor }} />}
        </span>
        {!selectMode && (
          <button onClick={(e) => { e.stopPropagation(); onToggleToday(t.id); }} className="shrink-0">
            {t.inToday ? <Star size={16} fill={C.accent} color={C.accent} /> : <StarOff size={16} color={C.textDim} />}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="px-5 pt-5" style={{ paddingBottom: selectMode && selectedIds.size > 0 ? 90 : 0 }}>
      <div className="flex items-center justify-end mb-2">
        <button onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: selectMode ? C.accent : "transparent", color: selectMode ? C.bg : C.textDim, border: `1px solid ${selectMode ? C.accent : C.borderStrong}` }}>
          {selectMode ? "Annuler la sélection" : "Sélectionner"}
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 mb-2" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setFilterTheme("all")}
          className="text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
          style={{ background: filterTheme === "all" ? C.accent : "transparent", color: filterTheme === "all" ? C.bg : C.textDim, border: `1px solid ${filterTheme === "all" ? C.accent : C.borderStrong}` }}
        >
          Tous les thèmes
        </button>
        {themes.map((th) => (
          <button
            key={th.id}
            onClick={() => setFilterTheme(th.id)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ background: filterTheme === th.id ? th.color : "transparent", color: filterTheme === th.id ? C.bg : C.textDim, border: `1px solid ${filterTheme === th.id ? th.color : C.borderStrong}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: filterTheme === th.id ? C.bg : th.color }} />
            {th.name}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilterUrgency("all")}
          className="flex-1 text-xs font-semibold py-1.5 rounded-md"
          style={{ background: filterUrgency === "all" ? C.accent : "transparent", color: filterUrgency === "all" ? C.bg : C.textDim, border: `1px solid ${filterUrgency === "all" ? C.accent : C.borderStrong}` }}
        >
          Toute urgence
        </button>
        {URGENCY.map((lvl) => (
          <button
            key={lvl.level}
            onClick={() => setFilterUrgency(lvl.level)}
            className="flex-1 text-xs font-semibold py-1.5 rounded-md"
            style={{ background: filterUrgency === lvl.level ? lvl.color : "transparent", color: filterUrgency === lvl.level ? C.bg : C.textDim, border: `1px solid ${filterUrgency === lvl.level ? lvl.color : C.borderStrong}` }}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs" style={{ color: C.textFaint }}>Trier par</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSortMode("urgency")}
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: sortMode === "urgency" ? C.accent : "transparent", color: sortMode === "urgency" ? C.bg : C.textDim, border: `1px solid ${sortMode === "urgency" ? C.accent : C.borderStrong}` }}
          >
            Urgence
          </button>
          <button
            onClick={() => setSortMode("date")}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: sortMode === "date" ? C.accent : "transparent", color: sortMode === "date" ? C.bg : C.textDim, border: `1px solid ${sortMode === "date" ? C.accent : C.borderStrong}` }}
          >
            <Flag size={12} /> Échéance
          </button>
        </div>
      </div>

      {filtered.length === 0 && <p className="text-sm py-8 text-center" style={{ color: C.textDim }}>Aucune tâche ne correspond à ce filtre.</p>}

      {regularTasks.length > 0 && (
        <div className="space-y-2">{regularTasks.map(renderRow)}</div>
      )}

      {wellbeingTasks.length > 0 && (
        <div className={regularTasks.length > 0 ? "mt-6" : ""}>
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#7DD3AE" }}>
            <Leaf size={13} /> Bien-être · récurrentes
          </div>
          <div className="space-y-2">{wellbeingTasks.map(renderRow)}</div>
        </div>
      )}

      {selectMode && selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-3 py-3" style={{ background: C.surface, borderTop: `1px solid ${C.borderStrong}` }}>
          <div className="max-w-md mx-auto flex items-center gap-2">
            <span className="text-xs font-bold shrink-0" style={{ color: C.textDim }}>{selectedIds.size}</span>
            <button onClick={() => { onBulkMarkDone([...selectedIds]); exitSelectMode(); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: "#22C55E" }}>
              <Check size={18} /><span className="text-[10px] font-semibold">Fait</span>
            </button>
            <button onClick={() => { onBulkToggleCancel([...selectedIds]); exitSelectMode(); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: C.textDim }}>
              <Ban size={18} /><span className="text-[10px] font-semibold">Annuler</span>
            </button>
            <button onClick={() => { onBulkPostpone([...selectedIds]); exitSelectMode(); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: C.accentLight }}>
              <CalendarClock size={18} /><span className="text-[10px] font-semibold">Reporter</span>
            </button>
            <button onClick={() => { if (confirm(`Supprimer ${selectedIds.size} tâche(s) ?`)) { onBulkDelete([...selectedIds]); exitSelectMode(); } }}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg" style={{ color: C.danger }}>
              <Trash2 size={18} /><span className="text-[10px] font-semibold">Suppr.</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function historyDayHeader(iso) {
  const today = todayISODate();
  if (iso === today) return "Aujourd'hui";
  if (iso === addDaysISO(-1)) return "Hier";
  const d = new Date(iso + "T00:00:00");
  const label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function HistoryRow({ t, theme }) {
  const time = t.completedAt ? new Date(t.completedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
  const hasDelta = t.focusDelta != null && typeof t.duration === "number";
  const deltaLabel = hasDelta
    ? (t.focusDelta > 0
        ? `+${Math.round(t.focusDelta / 60)} min`
        : `−${Math.round(Math.abs(t.focusDelta) / 60)} min`)
    : null;
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 mb-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <Check size={14} style={{ color: C.accent }} />
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: theme?.color || C.borderStrong }} />
      <span className="flex-1 min-w-0 text-sm" style={{ color: C.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {t.title}
      </span>
      {deltaLabel && (
        <span className="text-[10px] font-semibold shrink-0" style={{ color: t.focusDelta > 0 ? C.danger : "#4ade80" }}>
          {deltaLabel}
        </span>
      )}
      {t.kind === "event" && <CalendarDays size={12} style={{ color: C.textGhost }} />}
      {time && <span className="text-[10px]" style={{ color: C.textGhost }}>{time}</span>}
    </div>
  );
}

function StatsView({ data, tasks, themes }) {
  const today = todayISODate();
  const dailyPoints = data.dailyPoints || {};
  const wellnessLog = data.wellnessLog || {};
  const physActivities = data.physActivities || [];
  const espritItems = data.espritItems || [];
  const [tab, setTab] = useState("points"); // points | activites | taches

  // 14 derniers jours pour le graphe
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = localISODate(d);
    return { date: iso, pts: dailyPoints[iso] || 0, label: d.toLocaleDateString("fr-FR", { weekday: "short" }).slice(0, 2) };
  }).reverse();
  const maxPts = Math.max(...last14.map((d) => d.pts), 1);

  // Historique universel des points : tous les jours enregistrés, du + récent au + ancien
  const allDays = Object.keys(dailyPoints).filter((d) => (dailyPoints[d] || 0) > 0).sort((a, b) => b.localeCompare(a));
  const totalAll = Object.values(dailyPoints).reduce((s, v) => s + (v || 0), 0);

  // Historique des activités physiques : parcourt wellnessLog[date].activities
  const actName = (id) => (physActivities.find((a) => a.id === id) || espritItems.find((a) => a.id === id) || {}).name || id;
  const actDays = Object.keys(wellnessLog)
    .filter((d) => { const l = wellnessLog[d]; return l && ((l.activities && Object.keys(l.activities).some((k) => l.activities[k])) || (l.espritLog && Object.keys(l.espritLog).some((k) => l.espritLog[k]))); })
    .sort((a, b) => b.localeCompare(a));

  return (
    <div className="px-5 pt-5 pb-6 space-y-5">
      <h2 className="font-display text-xl font-bold italic" style={{ color: C.text }}>Statistiques</h2>

      {/* Cartes récap (sans médaille) */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Points totaux", value: `${data.totalPoints || 0}`, color: C.accentLight },
          { label: "Série", value: `⚡ ${data.streakDays || 0}j`, color: "#F59E0B" },
          { label: "Record", value: `🏆 ${data.streakRecord || 0}j`, color: "#F59E0B" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl px-3 py-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: C.textGhost }}>{label}</div>
            <div className="text-sm font-black" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Graphe 14 jours */}
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>Points — 14 derniers jours</div>
        <div className="rounded-2xl px-4 py-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-end gap-1" style={{ height: 90 }}>
            {last14.map(({ date, pts, label }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 justify-end">
                {pts > 0 && <div className="text-[8px] font-bold" style={{ color: C.accentLight }}>{pts}</div>}
                <div className="w-full rounded-t-sm" style={{
                  height: `${Math.round((pts / maxPts) * 60) + 3}px`,
                  background: date === today ? C.accent : C.borderStrong,
                  minHeight: 3, transition: "height 0.4s ease"
                }}/>
                <div className="text-[8px] font-semibold" style={{ color: C.textGhost }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onglets d'historique */}
      <div className="flex gap-2">
        {[["points", "Points"], ["activites", "Activités"], ["taches", "Tâches"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 py-2 rounded-xl text-xs font-bold"
            style={{ background: tab === id ? C.accent : C.surface, color: tab === id ? C.bg : C.textDim, border: `1px solid ${tab === id ? C.accent : C.border}` }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Historique universel des points */}
      {tab === "points" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: C.textGhost }}>Historique des points</div>
            <div className="text-xs font-bold" style={{ color: C.accentLight }}>{totalAll} pts cumulés</div>
          </div>
          {allDays.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: C.textDim }}>Aucun point enregistré pour l'instant.</p>
          ) : (
            <div className="space-y-1.5">
              {allDays.map((d) => (
                <div key={d} className="flex items-center justify-between px-4 py-2.5 rounded-xl" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                  <span className="text-sm" style={{ color: d === today ? C.accentLight : C.textDim }}>
                    {d === today ? "Aujourd'hui" : historyDayHeader(d)}
                  </span>
                  <span className="text-sm font-black" style={{ color: "#FFD700" }}>{dailyPoints[d]} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historique des activités physiques */}
      {tab === "activites" && (
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>Historique des activités</div>
          {actDays.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: C.textDim }}>Aucune activité enregistrée.</p>
          ) : (
            <div className="space-y-3">
              {actDays.map((d) => {
                const l = wellnessLog[d];
                const entries = [];
                if (l.activities) Object.keys(l.activities).forEach((k) => { if (l.activities[k]) entries.push({ name: actName(k), val: l.activities[k], icon: "🏃" }); });
                if (l.espritLog) Object.keys(l.espritLog).forEach((k) => { if (l.espritLog[k]) entries.push({ name: actName(k), val: l.espritLog[k], icon: "🧘" }); });
                if (entries.length === 0) return null;
                return (
                  <div key={d}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: C.textFaint }}>
                      {d === today ? "Aujourd'hui" : historyDayHeader(d)}
                    </div>
                    <div className="rounded-xl px-4 py-2.5 space-y-1.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                      {entries.map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span>{e.icon}</span>
                          <span className="flex-1" style={{ color: C.textDim }}>{e.name}</span>
                          <span className="text-xs font-bold" style={{ color: C.accentLight }}>
                            {typeof e.val === "number" && e.val > 5 ? `${e.val} pts` : `×${e.val}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Historique des tâches */}
      {tab === "taches" && (
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.textGhost }}>Historique des tâches</div>
          <HistoryView tasks={tasks} themes={themes} />
        </div>
      )}
    </div>
  );
}

function HistoryView({ tasks, themes }) {
  const done = tasks.filter((t) => t.done);
  const withDate = done.filter((t) => t.completedAt);
  const withoutDate = done.filter((t) => !t.completedAt);
  const sorted = [...withDate].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

  let lastDay = null;
  const nodes = [];
  sorted.forEach((t, idx) => {
    const day = t.completedAt.slice(0, 10);
    if (day !== lastDay) {
      nodes.push(
        <div key={`h-${day}`} className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint, marginTop: idx === 0 ? 0 : 20 }}>
          {historyDayHeader(day)}
        </div>
      );
      lastDay = day;
    }
    nodes.push(<HistoryRow key={t.id} t={t} theme={themes.find((th) => th.id === t.themeId)} />);
  });

  return (
    <div className="px-5 pt-5">
      {done.length === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: C.textDim }}>Rien de terminé pour l'instant.</p>
      )}
      {nodes}
      {withoutDate.length > 0 && (
        <div style={{ marginTop: sorted.length > 0 ? 20 : 0 }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>Date inconnue</div>
          {withoutDate.map((t) => <HistoryRow key={t.id} t={t} theme={themes.find((th) => th.id === t.themeId)} />)}
        </div>
      )}
    </div>
  );
}

// Modèles de checklists pré-remplies pour les événements DJ
const CHECKLIST_MODELS = [
  {
    name: "🎧 DJ Set",
    items: [
      { rub: "Matériel", title: "DDJ-400 + câbles USB" },
      { rub: "Matériel", title: "Casque DJ" },
      { rub: "Matériel", title: "Adaptateurs RCA / XLR" },
      { rub: "Matériel", title: "Disque dur avec bibliothèque" },
      { rub: "Matériel", title: "Ordi + chargeur" },
      { rub: "Logistique", title: "Djay Pro / Serato à jour" },
      { rub: "Logistique", title: "Playlist vérifiée" },
      { rub: "Logistique", title: "Heure d'arrivée confirmée" },
      { rub: "Logistique", title: "Contact organisateur" },
      { rub: "Logistique", title: "Retour transport prévu" },
    ],
  },
  {
    name: "🔊 Installation son",
    items: [
      { rub: "Câblage", title: "Câbles XLR (2×)" },
      { rub: "Câblage", title: "Câbles RCA" },
      { rub: "Câblage", title: "Multiprise + rallonge" },
      { rub: "Câblage", title: "Adaptateurs jack" },
      { rub: "Matériel", title: "Enceintes actives" },
      { rub: "Matériel", title: "Mixette / Interface audio" },
      { rub: "Matériel", title: "Micro (si besoin)" },
      { rub: "Vérification", title: "Test son avant public" },
      { rub: "Vérification", title: "Volume de retour" },
      { rub: "Vérification", title: "Latence vérifiée" },
    ],
  },
  {
    name: "🎪 Événement complet",
    items: [
      { rub: "Admin", title: "Contrat signé" },
      { rub: "Admin", title: "Acompte reçu" },
      { rub: "Admin", title: "Itinéraire imprimé" },
      { rub: "Matériel", title: "Tout le matériel chargé" },
      { rub: "Matériel", title: "Matériel de secours" },
      { rub: "Logistique", title: "Heure de montage confirmée" },
      { rub: "Logistique", title: "Heure de fin confirmée" },
      { rub: "Logistique", title: "Hébergement si nuit" },
      { rub: "Sur place", title: "Rencontre orga" },
      { rub: "Sur place", title: "Solde encaissé" },
    ],
  },
];

function ChecklistModelModal({ onApply, onCancel, onAddItem, onAddRubrique, rubriques }) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>Charger un modèle</h3>
      <div className="flex gap-2 flex-wrap">
        {CHECKLIST_MODELS.map((m, i) => (
          <button key={i} onClick={() => setSelected(i)}
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: i === selected ? C.accent : "transparent", color: i === selected ? C.bg : C.textDim, border: `1px solid ${i === selected ? C.accent : C.borderStrong}` }}>
            {m.name}
          </button>
        ))}
      </div>
      <div className="text-xs space-y-1 max-h-48 overflow-y-auto" style={{ color: C.textDim }}>
        {CHECKLIST_MODELS[selected].items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <span style={{ color: C.accentLight }}>{it.rub}</span>
            <span>— {it.title}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>Annuler</button>
        <button onClick={() => onApply(CHECKLIST_MODELS[selected])} className="flex-1 py-2 rounded-md text-sm font-semibold" style={{ background: C.accent, color: C.bg }}>
          Charger
        </button>
      </div>
    </div>
  );
}

// Liste des checklists + modèles ; ouverture au clic ; actions sur modèles
// Barre proportionnelle : segments colorés selon l'état des items.
// Objets : À trouver (rouge) / Prêt (orange) / Ok (vert). Tâches : À faire (rouge) / Fait (vert).
function StateBar({ items, height = 5 }) {
  const active = items.filter((it) => !it.cancelled);
  const total = active.length;
  if (!total) return null;
  let rouge = 0, orange = 0, vert = 0;
  active.forEach((it) => {
    if (it.nature === "tache") {
      if (it.status === "fait") vert++; else rouge++;
    } else {
      if (it.status === "ok") vert++;
      else if (it.status === "pret") orange++;
      else rouge++;
    }
  });
  const seg = (n, color) => n > 0 ? <div style={{ width: `${(n / total) * 100}%`, background: color, height: "100%" }} /> : null;
  return (
    <div style={{ height, background: C.bg, display: "flex", overflow: "hidden", transition: "all 0.4s ease" }}>
      {seg(vert, "#22C55E")}
      {seg(orange, "#F59E0B")}
      {seg(rouge, "#E11D48")}
    </div>
  );
}

function ChecklistsView({ checklists, onOpen, onAddChecklist, onRenameChecklist, onTemplateAction, onToggleArchived, onDeleteChecklist, tasks }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [asTemplate, setAsTemplate] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // id du modèle OU checklist dont le menu est ouvert
  const [showArchives, setShowArchives] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const lists = (checklists || []).filter((c) => !c.isTemplate && !c.archived)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const archivedLists = (checklists || []).filter((c) => !c.isTemplate && c.archived);
  const templates = (checklists || []).filter((c) => c.isTemplate);

  const progress = (c) => {
    const active = c.items.filter((i) => !i.cancelled);
    const total = active.length;
    const ok = active.filter((i) => i.nature === "tache" ? i.status === "fait" : i.status === "ok").length;
    return { total, ok, pct: total ? Math.round((ok / total) * 100) : 0 };
  };

  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  const Card = ({ c, isTpl }) => {
    const { total, ok, pct } = progress(c);
    const isRenaming = renamingId === c.id;
    const linkedTask = !isTpl ? (tasks || []).find((t) => t.checklistId === c.id && !t.cancelled) : null;
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="w-full flex items-center gap-2 px-4 py-3">
          <span style={{ fontSize: 24 }}>{c.emoji}</span>
          {isRenaming ? (
            <input autoFocus value={renameVal} onChange={(e) => setRenameVal(e.target.value)}
              onBlur={() => { if (renameVal.trim()) onRenameChecklist(c.id, renameVal.trim()); setRenamingId(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { if (renameVal.trim()) onRenameChecklist(c.id, renameVal.trim()); setRenamingId(null); } }}
              className="flex-1 px-2 py-1 rounded-lg text-sm font-bold outline-none" style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.accent}` }} />
          ) : (
            <button onClick={() => isTpl ? setMenuFor(menuFor === c.id ? null : c.id) : onOpen(c.id)} className="flex-1 min-w-0 text-left active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" style={{ color: C.text }}>{c.name}</span>
                {isTpl && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: C.accent + "22", color: C.accent }}>MODÈLE</span>}
              </div>
              <div className="text-[11px]" style={{ color: C.textGhost }}>{total} objet{total > 1 ? "s" : ""}{!isTpl && total > 0 ? ` · ${ok}/${total} prêts` : ""}</div>
              {linkedTask && (
                <div className="text-[11px] flex items-center gap-1 mt-0.5" style={{ color: C.accentLight }}>
                  🔗 <Flag size={10} fill={linkedTask.kind === "prestation" ? "#8B5CF6" : "#F59E0B"} style={{ color: linkedTask.kind === "prestation" ? "#8B5CF6" : "#F59E0B" }} /> {linkedTask.title}
                </div>
              )}
            </button>
          )}
          {!isTpl && total > 0 && !isRenaming && (
            <div className="shrink-0 text-xs font-black" style={{ color: pct === 100 ? "#22C55E" : C.accentLight }}>{pct}%</div>
          )}
          {!isRenaming && (
            <button onClick={() => { setRenameVal(c.name); setRenamingId(c.id); }} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: C.textGhost, border: `1px solid ${C.border}` }} title="Renommer">
              <Pencil size={13} />
            </button>
          )}
          {!isTpl && !isRenaming && <ChevronRight size={16} style={{ color: C.textGhost }} onClick={() => onOpen(c.id)} />}
          {!isTpl && !isRenaming && (
            <button onClick={() => setMenuFor(menuFor === c.id ? null : c.id)} className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: C.textGhost }} title="Plus d'options">
              <MoreVertical size={15} />
            </button>
          )}
        </div>
        {!isTpl && menuFor === c.id && (
          <div className="px-3 pb-3 pt-1 space-y-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => { setMenuFor(null); onToggleArchived(c.id); }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg" style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
              📦 Archiver
            </button>
            <button onClick={() => { if (confirm(`Supprimer "${c.name}" définitivement ?`)) { setMenuFor(null); onDeleteChecklist(c.id); } }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg" style={{ background: C.surfaceRaised, color: C.danger, border: `1px solid ${C.border}` }}>
              Supprimer
            </button>
          </div>
        )}
        {!isTpl && total > 0 && (
          <StateBar items={c.items} height={5} />
        )}
        {isTpl && menuFor === c.id && (
          <div className="px-3 pb-3 pt-1 space-y-1.5" style={{ borderTop: `1px solid ${C.border}` }}>
            {[
              ["Modifier le modèle", () => onOpen(c.id)],
              ["Créer une checklist à partir de ce modèle", () => onTemplateAction("toChecklist", c.id)],
              ["Ajouter à une checklist existante", () => onTemplateAction("mergeInto", c.id)],
              ["Dupliquer en modèle", () => onTemplateAction("duplicateTpl", c.id)],
              ["Supprimer", () => onTemplateAction("delete", c.id)],
            ].map(([label, fn], i) => (
              <button key={i} onClick={() => { setMenuFor(null); fn(); }}
                className="w-full text-left text-sm px-3 py-2 rounded-lg"
                style={{ background: C.surfaceRaised, color: label === "Supprimer" ? C.danger : C.textDim, border: `1px solid ${C.border}` }}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-5 pt-5 pb-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold italic" style={{ color: C.text }}>Mes checklists</h2>
        <button onClick={() => setCreating((v) => !v)} className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          style={{ background: C.accent, color: C.bg }}>
          <Plus size={14} /> Nouvelle
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: C.surface, border: `1px dashed ${C.accent}66` }}>
          <div className="flex gap-2">
            <div className="grid grid-cols-6 gap-1 flex-1">
              {CHECKLIST_EMOJIS.map((em) => (
                <button key={em} onClick={() => setNewEmoji(em)} className="aspect-square rounded-lg text-lg flex items-center justify-center"
                  style={{ background: newEmoji === em ? C.accent + "33" : C.surfaceRaised, border: `1px solid ${newEmoji === em ? C.accent : C.border}` }}>{em}</button>
              ))}
            </div>
          </div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom de la checklist"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
          <button onClick={() => setAsTemplate((v) => !v)} className="w-full text-xs font-semibold py-2 rounded-lg"
            style={{ background: asTemplate ? C.accent + "22" : C.surfaceRaised, color: asTemplate ? C.accent : C.textGhost, border: `1px solid ${C.border}` }}>
            {asTemplate ? "✓ C'est un modèle réutilisable" : "Checklist normale"}
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setCreating(false); setNewName(""); }} className="flex-1 py-2 rounded-xl text-sm" style={{ border: `1px solid ${C.border}`, color: C.textDim }}>Annuler</button>
            <button disabled={!newName.trim()} onClick={() => { const id = onAddChecklist(newName.trim(), newEmoji, asTemplate); setCreating(false); setNewName(""); setAsTemplate(false); if (id && !asTemplate) onOpen(id); }}
              className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>Créer</button>
          </div>
        </div>
      )}

      {lists.length === 0 && templates.length === 0 && !creating && (
        <p className="text-sm text-center py-8" style={{ color: C.textDim }}>Aucune checklist pour l'instant. Touche « Nouvelle » pour en créer une (liste de courses, valise, matériel…).</p>
      )}

      {lists.length > 0 && (
        <div className="space-y-2">
          {lists.map((c) => <Card key={c.id} c={c} isTpl={false} />)}
        </div>
      )}

      {templates.length > 0 && (
        <div>
          <button onClick={() => setShowTemplates((v) => !v)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textGhost }}>
            {showTemplates ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Modèles ({templates.length})
          </button>
          {showTemplates && (
            <div className="space-y-2">
              {templates.map((c) => <Card key={c.id} c={c} isTpl={true} />)}
            </div>
          )}
        </div>
      )}

      {archivedLists.length > 0 && (
        <div>
          <button onClick={() => setShowArchives((v) => !v)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textGhost }}>
            {showArchives ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 📦 Archives ({archivedLists.length})
          </button>
          {showArchives && (
            <div className="space-y-2">
              {archivedLists.map((c) => (
                <div key={c.id} className="rounded-2xl overflow-hidden flex items-center gap-2 px-4 py-3" style={{ background: C.surface, border: `1px solid ${C.border}`, opacity: 0.7 }}>
                  <span style={{ fontSize: 22 }}>{c.emoji}</span>
                  <span className="flex-1 text-sm font-semibold" style={{ color: C.textDim }}>{c.name}</span>
                  <button onClick={() => onToggleArchived(c.id)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.accent + "22", color: C.accentLight }}>
                    Restaurer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Détail d'une checklist ouverte : objets par rubrique, ajout avec choix/création de rubrique
// Petit champ pour ajouter une rubrique dans le gestionnaire
function NewRubriqueInline({ onAdd }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-2 pt-1">
      <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="+ Nouvelle rubrique"
        onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
        className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px dashed ${C.accent}66` }} />
      <button disabled={!val.trim()} onClick={() => { onAdd(val.trim()); setVal(""); }}
        className="px-3 rounded-lg text-sm font-bold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>+</button>
    </div>
  );
}

function ChecklistDetailView({ checklist, onBack, onCycleStatus, onAddItem, onEditItem, onDeleteItem, onToggleCancelled, onAddRubrique, onRenameRubrique, onDeleteRubrique, onRename, onDeleteChecklist, onChangeEmoji, linkedTasks, themes, onCreateLinkedTask, onEditLinkedTask, onToggleLinkedTaskDone }) {
  const [newLinkedTitle, setNewLinkedTitle] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sortMode, setSortMode] = useState("rubrique"); // "rubrique" | "status"
  const [itemTitle, setItemTitle] = useState("");
  const [rubChoice, setRubChoice] = useState(checklist.rubriques[0]?.id || "__new__");
  const [newRubLabel, setNewRubLabel] = useState("");
  const [newNature, setNewNature] = useState("objet"); // "objet" | "tache"
  const [newUrgency, setNewUrgency] = useState(2);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(checklist.name);
  const [editingItemId, setEditingItemId] = useState(null); // objet en cours d'édition
  const [editItemTitle, setEditItemTitle] = useState("");
  const [editItemRub, setEditItemRub] = useState("");
  const [editItemNature, setEditItemNature] = useState("objet");
  const [editItemUrgency, setEditItemUrgency] = useState(2);
  const [managingRubs, setManagingRubs] = useState(false);

  // "Terminé" = objet Prêt OU tâche Faite
  const isDone = (it) => it.nature === "tache" ? it.status === "fait" : it.status === "ok";
  const total = checklist.items.filter((it) => !it.cancelled).length;
  const ok = checklist.items.filter((it) => !it.cancelled && isDone(it)).length;
  const pct = total ? Math.round((ok / total) * 100) : 0;
  const rubLabel = (id) => checklist.rubriques.find((r) => r.id === id)?.label || "Sans rubrique";

  const submitItem = () => {
    if (!itemTitle.trim()) return;
    let rid = rubChoice;
    if (rubChoice === "__new__") {
      if (!newRubLabel.trim()) return;
      rid = onAddRubrique(newRubLabel.trim());
    }
    onAddItem(itemTitle.trim(), rid, newNature, newUrgency);
    setItemTitle(""); setNewRubLabel(""); setRubChoice(rid);
  };

  const startEditItem = (it) => {
    setEditingItemId(it.id); setEditItemTitle(it.title); setEditItemRub(it.rubriqueId);
    setEditItemNature(it.nature || "objet"); setEditItemUrgency(it.urgency || 2);
  };
  const saveEditItem = () => {
    if (editItemTitle.trim()) {
      const patch = { title: editItemTitle.trim(), rubriqueId: editItemRub, nature: editItemNature };
      // Ajuste le statut si on change de nature
      if (editItemNature === "tache") { patch.urgency = editItemUrgency; if (!TACHE_STATUS_ORDER.includes(undefined)) {} }
      onEditItem(editingItemId, patch);
    }
    setEditingItemId(null);
  };

  return (
    <div className="px-5 pt-5 pb-6">
      <button onClick={onBack} className="text-sm mb-3 flex items-center gap-1" style={{ color: C.textDim }}>
        <ChevronLeft size={16} /> Mes checklists
      </button>

      <div className="flex items-center gap-2 mb-3 relative">
        <button onClick={() => setShowEmojiPicker((v) => !v)} style={{ fontSize: 26, lineHeight: 1 }} title="Changer l'icône">{checklist.emoji}</button>
        {showEmojiPicker && (
          <div className="absolute top-full left-0 mt-1 z-20 grid grid-cols-6 gap-1.5 p-2.5 rounded-xl" style={{ background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, width: 260 }}>
            {CHECKLIST_EMOJIS.map((em) => (
              <button key={em} onClick={() => { onChangeEmoji(em); setShowEmojiPicker(false); }} className="text-xl" style={{ opacity: checklist.emoji === em ? 1 : 0.6 }}>
                {em}
              </button>
            ))}
          </div>
        )}
        {editingName ? (
          <input autoFocus value={nameVal} onChange={(e) => setNameVal(e.target.value)}
            onBlur={() => { onRename(nameVal.trim() || checklist.name); setEditingName(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onRename(nameVal.trim() || checklist.name); setEditingName(false); } }}
            className="flex-1 px-2 py-1 rounded-lg text-lg font-bold outline-none" style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.accent}` }} />
        ) : (
          <h2 className="flex-1 font-display text-xl font-bold italic" style={{ color: C.text }}>
            {checklist.name}{checklist.isTemplate ? " (modèle)" : ""}
          </h2>
        )}
        {!editingName && (
          <button onClick={() => { setNameVal(checklist.name); setEditingName(true); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: C.textDim, border: `1px solid ${C.border}` }} title="Renommer">
            <Pencil size={14} />
          </button>
        )}
        <button onClick={() => { setAdding((v) => !v); setManagingRubs(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: adding ? C.accent : "transparent", color: adding ? C.bg : C.accent, border: `1px solid ${C.accent}` }} title="Ajouter un élément">
          <Plus size={16} />
        </button>
        <button onClick={() => { setManagingRubs((v) => !v); setAdding(false); }} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: managingRubs ? C.accent + "22" : "transparent", color: managingRubs ? C.accent : C.textDim, border: `1px solid ${C.border}` }} title="Gérer les rubriques">
          <Settings2 size={14} />
        </button>
        <button onClick={onDeleteChecklist} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: C.danger, border: `1px solid ${C.border}` }}>
          <Trash2 size={15} />
        </button>
      </div>

      {total > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1"><span style={{ color: C.textDim }}>{ok} / {total} prêts</span><span style={{ color: C.accentLight }}>{pct}%</span></div>
          <div style={{ borderRadius: 999, overflow: "hidden" }}>
            <StateBar items={checklist.items} height={7} />
          </div>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs" style={{ color: C.textFaint }}>Trier par</span>
          <button onClick={() => setSortMode((m) => m === "rubrique" ? "status" : "rubrique")}
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: C.accent, color: C.bg, border: `1px solid ${C.accent}` }}>
            {sortMode === "rubrique" ? "Rubrique" : "État"}
          </button>
        </div>
      )}

      {managingRubs && (
        <div className="rounded-2xl p-4 mb-4 space-y-2" style={{ background: C.surface, border: `1px dashed ${C.accent}66` }}>
          <div className="text-[11px] font-semibold mb-1" style={{ color: C.textDim }}>Rubriques de la checklist</div>
          {checklist.rubriques.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <input defaultValue={r.label} onBlur={(e) => { if (e.target.value.trim() && e.target.value !== r.label) onRenameRubrique(r.id, e.target.value.trim()); }}
                className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }} />
              <button onClick={() => { if (confirm(`Supprimer la rubrique "${r.label}" et ses objets ?`)) onDeleteRubrique(r.id); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: C.danger, border: `1px solid ${C.border}` }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <NewRubriqueInline onAdd={(label) => onAddRubrique(label)} />
        </div>
      )}

      {adding && (
        <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: C.surface, border: `1px dashed ${C.accent}66` }}>
          {/* Nature : Objet ou Tâche */}
          <div className="flex gap-2">
            {[["objet", "🔧 Objet"], ["tache", "✓ Tâche"]].map(([val, lbl]) => (
              <button key={val} onClick={() => setNewNature(val)} className="flex-1 py-2 rounded-xl text-sm font-bold"
                style={{ background: newNature === val ? C.accent : C.surfaceRaised, color: newNature === val ? C.bg : C.textDim, border: `1px solid ${newNature === val ? C.accent : C.border}` }}>
                {lbl}
              </button>
            ))}
          </div>
          <input autoFocus value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} placeholder={newNature === "tache" ? "Nom de la tâche (ex. imprimer la RC pro)" : "Nom de l'objet (ex. marteau)"}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
          {newNature === "tache" && (
            <div>
              <div className="text-[11px] font-semibold mb-1.5" style={{ color: C.textDim }}>Urgence</div>
              <div className="flex gap-2">
                {URGENCY.map((u) => (
                  <button key={u.level} onClick={() => setNewUrgency(u.level)} className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ background: newUrgency === u.level ? u.color : C.surfaceRaised, color: newUrgency === u.level ? "#0B0810" : C.textDim, border: `1px solid ${newUrgency === u.level ? u.color : C.border}` }}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="text-[11px] font-semibold mb-1.5" style={{ color: C.textDim }}>Rubrique</div>
            <select value={rubChoice} onChange={(e) => setRubChoice(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }}>
              {checklist.rubriques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              <option value="__new__">+ Nouvelle rubrique…</option>
            </select>
            {rubChoice === "__new__" && (
              <input autoFocus value={newRubLabel} onChange={(e) => setNewRubLabel(e.target.value)} placeholder="Nom de la nouvelle rubrique"
                className="w-full mt-2 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.accent}66` }} />
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setAdding(false); setItemTitle(""); }} className="flex-1 py-2 rounded-xl text-sm" style={{ border: `1px solid ${C.border}`, color: C.textDim }}>Fermer</button>
            <button disabled={!itemTitle.trim() || (rubChoice === "__new__" && !newRubLabel.trim())} onClick={submitItem} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>Valider</button>
          </div>
        </div>
      )}

      {total === 0 && !adding && (
        <p className="text-sm text-center py-6" style={{ color: C.textDim }}>Liste vide. Ajoute ton premier objet.</p>
      )}

      {(() => {
        // Ligne d'objet réutilisable
        const statusColors = (it) => it.nature === "tache" ? TACHE_STATUS_COLORS : OBJET_STATUS_COLORS;
        const statusLabels = (it) => it.nature === "tache" ? TACHE_STATUS_LABELS : OBJET_STATUS_LABELS;
        const itDone = (it) => it.nature === "tache" ? it.status === "fait" : (it.status === "ok");
        const normStatus = (it) => {
          const labels = statusLabels(it);
          return labels[it.status] ? it.status : (it.nature === "tache" ? "a_faire" : "a_trouver");
        };
        const Row = (it) => (
          editingItemId === it.id ? (
            <div key={it.id} className="rounded-lg px-3 py-2.5 space-y-2" style={{ background: C.surface, border: `1px solid ${C.accent}` }}>
              <div className="flex gap-2">
                {[["objet", "🔧 Objet"], ["tache", "✓ Tâche"]].map(([val, lbl]) => (
                  <button key={val} onClick={() => setEditItemNature(val)} className="flex-1 py-1.5 rounded-lg text-xs font-bold"
                    style={{ background: editItemNature === val ? C.accent : C.surfaceRaised, color: editItemNature === val ? C.bg : C.textDim, border: `1px solid ${editItemNature === val ? C.accent : C.border}` }}>
                    {lbl}
                  </button>
                ))}
              </div>
              <input autoFocus value={editItemTitle} onChange={(e) => setEditItemTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }} />
              {editItemNature === "tache" && (
                <div className="flex gap-2">
                  {URGENCY.map((u) => (
                    <button key={u.level} onClick={() => setEditItemUrgency(u.level)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold"
                      style={{ background: editItemUrgency === u.level ? u.color : C.surfaceRaised, color: editItemUrgency === u.level ? "#0B0810" : C.textDim, border: `1px solid ${editItemUrgency === u.level ? u.color : C.border}` }}>
                      {u.label}
                    </button>
                  ))}
                </div>
              )}
              <select value={editItemRub} onChange={(e) => setEditItemRub(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.borderStrong}` }}>
                {checklist.rubriques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={() => setEditingItemId(null)} className="flex-1 py-1.5 rounded-lg text-xs" style={{ border: `1px solid ${C.border}`, color: C.textDim }}>Annuler</button>
                <button onClick={saveEditItem} className="flex-1 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.accent, color: C.bg }}>Enregistrer</button>
              </div>
            </div>
          ) : (
            <div key={it.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: C.surface, border: `1px solid ${C.border}`, opacity: it.cancelled ? 0.55 : 1 }}>
              {it.nature === "tache" && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: (URGENCY.find((u) => u.level === (it.urgency || 2)) || {}).color }} title="Tâche" />}
              <span className="flex-1 text-sm" style={{ color: (itDone(it) || it.cancelled) ? C.textGhost : C.text, textDecoration: (itDone(it) || it.cancelled) ? "line-through" : "none" }}>{it.title}</span>
              {!it.cancelled && (
                <button onClick={() => onCycleStatus(it.id)} className="text-xs font-semibold px-3 py-1.5 rounded-md shrink-0"
                  style={{ background: statusColors(it)[normStatus(it)], color: C.bg }}>
                  {statusLabels(it)[normStatus(it)]}
                </button>
              )}
              {it.cancelled && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md shrink-0" style={{ background: C.surfaceRaised, color: C.textFaint, border: `1px solid ${C.borderStrong}` }}>
                  Non nécessaire
                </span>
              )}
              <button onClick={() => onToggleCancelled(it.id)} className="shrink-0 p-1" style={{ color: it.cancelled ? C.accentLight : C.textGhost }} title={it.cancelled ? "Réactiver" : "Marquer non nécessaire"}>
                <Ban size={13} />
              </button>
              <button onClick={() => startEditItem(it)} className="shrink-0 p-1" style={{ color: C.textGhost }}><Pencil size={13} /></button>
              <button onClick={() => { if (confirm(`Supprimer "${it.title}" ?`)) onDeleteItem(it.id); }} className="shrink-0 p-1" style={{ color: C.textGhost }}><Trash2 size={14} /></button>
            </div>
          )
        );

        // ── Tri par ÉTAT (un groupe par statut réel, pas juste fait/à faire) ──
        if (sortMode === "status") {
          const buckets = [
            { key: "a_trouver", label: "À trouver", color: OBJET_STATUS_COLORS.a_trouver, test: (it) => it.nature !== "tache" && normStatus(it) === "a_trouver" },
            { key: "a_faire", label: "À faire", color: TACHE_STATUS_COLORS.a_faire, test: (it) => it.nature === "tache" && normStatus(it) === "a_faire" },
            { key: "pret", label: "Prêt", color: OBJET_STATUS_COLORS.pret, test: (it) => it.nature !== "tache" && normStatus(it) === "pret" },
            { key: "done", label: "Fait / Ok", color: "#22C55E", test: (it) => itDone(it) },
          ];
          return buckets.map((b, i) => {
            const items = checklist.items.filter((it) => !it.cancelled && b.test(it)).sort((a, bb) => a.title.localeCompare(bb.title, "fr", { sensitivity: "base" }));
            if (items.length === 0) return null;
            return (
              <div key={b.key} className="mb-4" style={{ marginTop: i === 0 ? 0 : undefined }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: b.color }}>
                  {b.label} · {items.length}
                </div>
                <div className="space-y-2">{items.map(Row)}</div>
              </div>
            );
          });
        }

        // ── Tri par RUBRIQUE (défaut) ──
        const rubIds = new Set(checklist.rubriques.map((r) => r.id));
        const orphans = checklist.items.filter((it) => !rubIds.has(it.rubriqueId));
        return (
          <>
            {checklist.rubriques.map((rub) => {
              const items = checklist.items.filter((it) => it.rubriqueId === rub.id);
              if (items.length === 0) return null;
              return (
                <div key={rub.id} className="mb-4">
                  <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>{rub.label}</div>
                  <div className="space-y-2">{items.map(Row)}</div>
                </div>
              );
            })}
            {orphans.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>Autres</div>
                <div className="space-y-2">{orphans.map(Row)}</div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function EquipmentView({ equipment, rubriques, onCycleStatus, onOpenItem, onAddItem, onManageRubriques, onLoadModel }) {
  const [sortMode, setSortMode] = useState("rubrique"); // "rubrique" | "status"
  const total = equipment.length;
  const okCount = equipment.filter((e) => e.status === "ok").length;
  const pct = total ? (okCount / total) * 100 : 0;
  const rubriqueLabel = (id) => rubriques.find((r) => r.id === id)?.label || "Sans rubrique";

  const renderRow = (e) => (
    <div key={e.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
      <span
        className="flex-1 text-sm"
        onClick={() => onOpenItem(e)}
        style={{ color: e.status === "ok" ? C.textGhost : C.text, textDecoration: e.status === "ok" ? "line-through" : "none" }}
      >
        {e.title}
      </span>
      <button
        onClick={() => onCycleStatus(e.id)}
        className="text-xs font-semibold px-3 py-1.5 rounded-md shrink-0"
        style={{ background: EQUIPMENT_STATUS_COLORS[e.status], color: C.bg }}
      >
        {EQUIPMENT_STATUS_LABELS[e.status]}
      </button>
    </div>
  );

  let body;
  if (sortMode === "status") {
    body = EQUIPMENT_STATUS_ORDER.map((st, i) => {
      const items = equipment.filter((e) => e.status === st).sort((a, b) => a.title.localeCompare(b.title, "fr", { sensitivity: "base" }));
      if (items.length === 0) return null;
      return (
        <div key={st} style={{ marginTop: i === 0 ? 0 : 20 }}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: EQUIPMENT_STATUS_COLORS[st] }}>
            {EQUIPMENT_STATUS_LABELS[st]} · {items.length}
          </div>
          <div className="space-y-2">{items.map(renderRow)}</div>
        </div>
      );
    });
  } else {
    let lastKey = null;
    const nodes = [];
    equipment.forEach((e, idx) => {
      const key = e.rubriqueId;
      if (key !== lastKey) {
        nodes.push(
          <div key={`h-${key}-${idx}`} className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint, marginTop: idx === 0 ? 0 : 20 }}>
            {rubriqueLabel(key)}
          </div>
        );
        lastKey = key;
      }
      nodes.push(renderRow(e));
    });
    body = <>{nodes}</>;
  }

  return (
    <div className="px-5 pt-5">
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span style={{ color: C.textDim }}>Checklist Musicalarue</span>
          <span className="font-mono-num" style={{ color: "#7DD3AE" }}>{okCount} / {total}</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: C.border, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#7DD3AE", borderRadius: 999, transition: "width 0.4s ease" }} />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <button onClick={onAddItem} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md" style={{ background: C.accent, color: C.bg }}>
          <Plus size={14} /> Objet
        </button>
        <button onClick={onLoadModel} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-md" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
          Modèle ✦
        </button>
        <button onClick={onManageRubriques} className="flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-2.5 rounded-md" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
          <Pencil size={13} />
        </button>
      </div>

      {/* ── Tâches liées : de vraies tâches (modifiables, avec détails), rattachées à cette checklist ── */}
      <div className="mb-4">
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textGhost }}>📋 Tâches liées</div>
        {linkedTasks.length > 0 && (
          <div className="space-y-2 mb-2">
            {linkedTasks.map((t) => {
              const theme = (themes || []).find((th) => th.id === t.themeId);
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
                  <button onClick={() => onToggleLinkedTaskDone(t.id)} className="shrink-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center border-2" style={{ borderColor: t.done ? C.accent : C.borderStrong, background: t.done ? C.accent : "transparent" }}>
                      {t.done && <Check size={11} color={C.bg} strokeWidth={3} />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0 text-sm" style={{ color: C.text, textDecoration: t.done ? "line-through" : "none" }} onClick={() => onEditLinkedTask(t)}>
                    {t.title}
                    {theme && <span className="text-[10px] font-semibold ml-2 px-1.5 py-0.5 rounded" style={{ background: theme.color + "22", color: theme.color }}>{theme.name}</span>}
                  </div>
                  <button onClick={() => onEditLinkedTask(t)} className="shrink-0 p-1" style={{ color: C.textFaint }} aria-label="Modifier">
                    <Pencil size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newLinkedTitle} onChange={(e) => setNewLinkedTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newLinkedTitle.trim()) { onCreateLinkedTask(newLinkedTitle.trim()); setNewLinkedTitle(""); } }}
            placeholder="Nouvelle tâche liée…" className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
          <button onClick={() => { if (newLinkedTitle.trim()) { onCreateLinkedTask(newLinkedTitle.trim()); setNewLinkedTitle(""); } }}
            className="px-3 rounded-md text-sm font-bold shrink-0" style={{ background: C.accent, color: C.bg }}>+</button>
        </div>
        <div className="text-[11px] mt-1.5" style={{ color: C.textGhost }}>
          Une tâche liée est une vraie tâche : modifiable, avec date, urgence et détails, comme les autres.
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs" style={{ color: C.textFaint }}>Trier par</span>
        <button
          onClick={() => setSortMode((m) => m === "rubrique" ? "status" : "rubrique")}
          className="text-xs font-semibold px-3 py-1.5 rounded-md"
          style={{ background: C.accent, color: C.bg, border: `1px solid ${C.accent}` }}
        >
          {sortMode === "rubrique" ? "Rubrique" : "État"}
        </button>
      </div>
      {body}
    </div>
  );
}

function EquipmentItemForm({ initial, rubriques, onSave, onDelete, onCancel }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [rubriqueId, setRubriqueId] = useState(initial?.rubriqueId || rubriques[0]?.id);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>{initial?.id ? "Modifier l'objet" : "Nouvel objet"}</h3>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nom de l'objet"
        className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
      <div>
        <div className="text-xs mb-2" style={{ color: C.textDim }}>Rubrique</div>
        <select value={rubriqueId} onChange={(e) => setRubriqueId(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
          {rubriques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button onClick={onDelete} className="py-2 px-3 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.danger }}>
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>Annuler</button>
        <button disabled={!title.trim()} onClick={() => onSave(title.trim(), rubriqueId)} className="flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}

function SearchModal({ tasks, themes, equipment, equipmentRubriques, notebooks, onOpenTask, onOpenEquipment, onOpenNote, onClose }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const matchingTasks = q
    ? tasks.filter((t) => t.title.toLowerCase().includes(q) || (t.notes || "").toLowerCase().includes(q))
    : [];
  const matchingEquip = q ? equipment.filter((e) => e.title.toLowerCase().includes(q)) : [];
  // Notes des carnets : on cherche dans le titre et le corps
  const matchingNotes = q
    ? (notebooks || []).flatMap((nb) =>
        (nb.notes || [])
          .filter((n) => (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q))
          .map((n) => ({ note: n, nb }))
      )
    : [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>Rechercher</h3>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tâches, événements, carnets..."
        className="w-full rounded-md px-3 py-2 text-sm outline-none"
        style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
      />
      {q && (
        <div className="space-y-4" style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {matchingTasks.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>
                Tâches & événements ({matchingTasks.length})
              </div>
              <div className="space-y-2">
                {matchingTasks.map((t) => {
                  const theme = themes.find((th) => th.id === t.themeId);
                  return (
                    <div
                      key={t.id}
                      onClick={() => onOpenTask(t)}
                      className="rounded-lg px-3 py-2.5"
                      style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    >
                      <div className="text-sm" style={{ color: (t.done || t.cancelled) ? C.textGhost : C.text, textDecoration: (t.done || t.cancelled) ? "line-through" : "none" }}>
                        {t.title}
                      </div>
                      {theme && (
                        <div className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: theme.color + "33", color: theme.color }}>
                          {theme.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {matchingNotes.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>
                Mes carnets ({matchingNotes.length})
              </div>
              <div className="space-y-2">
                {matchingNotes.map(({ note, nb }) => (
                  <div key={note.id}
                    onClick={() => { if (onOpenNote) onOpenNote(nb.id, note.id); }}
                    className="rounded-lg px-3 py-2.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-2">
                      <span>{note.emoji || "📝"}</span>
                      <div className="text-sm flex-1" style={{ color: C.text }}>{note.title || "Sans titre"}</div>
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.textGhost }}>{nb.emoji} {nb.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {matchingEquip.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.textFaint }}>
                Checklist Musicalarue ({matchingEquip.length})
              </div>
              <div className="space-y-2">
                {matchingEquip.map((e) => {
                  const rub = equipmentRubriques.find((r) => r.id === e.rubriqueId);
                  return (
                    <div
                      key={e.id}
                      onClick={() => onOpenEquipment(e)}
                      className="rounded-lg px-3 py-2.5"
                      style={{ background: C.surface, border: `1px solid ${C.border}` }}
                    >
                      <div className="text-sm" style={{ color: e.status === "ok" ? C.textGhost : C.text, textDecoration: e.status === "ok" ? "line-through" : "none" }}>
                        {e.title}
                      </div>
                      {rub && <div className="text-xs mt-1" style={{ color: C.textDim }}>{rub.label}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {matchingTasks.length === 0 && matchingEquip.length === 0 && matchingNotes.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: C.textDim }}>Aucun résultat.</p>
          )}
        </div>
      )}
      <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Fermer
      </button>
    </div>
  );
}

function RubriqueManagerModal({ rubriques, onRename, onDelete, onAdd, onClose }) {
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>Rubriques</h3>
      <div className="space-y-2">
        {rubriques.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            {editingId === r.id ? (
              <>
                <input
                  autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
                />
                <button onClick={() => { onRename(r.id, editValue.trim() || r.label); setEditingId(null); }} className="p-2" style={{ color: C.accent }}>
                  <Check size={18} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm" style={{ color: C.text }}>{r.label}</span>
                <button onClick={() => { setEditingId(r.id); setEditValue(r.label); }} className="p-2" style={{ color: C.textDim }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => onDelete(r.id)} className="p-2" style={{ color: C.danger }}>
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Nouvelle rubrique"
          className="flex-1 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        />
        <button
          onClick={() => { if (newLabel.trim()) { onAdd(newLabel.trim()); setNewLabel(""); } }}
          className="px-4 rounded-md text-sm font-semibold" style={{ background: C.accent, color: C.bg }}
        >
          Ajouter
        </button>
      </div>
      <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Fermer
      </button>
    </div>
  );
}

function ThemesList({ themes, tasks, onOpen, onAddTheme }) {
  return (
    <div className="px-5 pt-5 space-y-2">
      {themes.map((th) => {
        const count = tasks.filter((t) => t.themeId === th.id).length;
        return (
          <button key={th.id} onClick={() => onOpen(th.id)} className="w-full rounded-lg px-4 py-4 flex items-center justify-between text-left" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: th.color }} />
              <span className="text-base font-semibold" style={{ color: C.text }}>{th.name}</span>
            </div>
            <span className="text-xs" style={{ color: C.textDim }}>{count} tâche{count !== 1 ? "s" : ""}</span>
          </button>
        );
      })}
      <button onClick={onAddTheme} className="w-full rounded-lg px-4 py-4 flex items-center justify-center gap-2 border border-dashed text-sm" style={{ borderColor: C.borderStrong, color: C.textDim }}>
        <Plus size={16} /> Nouveau dossier
      </button>
    </div>
  );
}

function ThemeDetail({ theme, tasks, onBack, onEditTheme, onDeleteTheme, onAddTask, onEditTask, onDeleteTask, onToggleToday }) {
  if (!theme) return null;
  return (
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="text-sm" style={{ color: C.textDim }}>← Dossiers</button>
        <div className="flex gap-3">
          <button onClick={() => onEditTheme(theme)} style={{ color: C.textDim }}><Pencil size={16} /></button>
          <button onClick={() => onDeleteTheme(theme.id)} style={{ color: C.textDim }}><Trash2 size={16} /></button>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <div className="w-3 h-3 rounded-full" style={{ background: theme.color }} />
        <h2 className="font-display text-xl font-semibold" style={{ color: C.text }}>{theme.name}</h2>
      </div>

      <div className="space-y-2 mb-4">
        {tasks.length === 0 && <p className="text-sm py-6 text-center" style={{ color: C.textDim }}>Aucune tâche pour ce thème.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="rounded-lg px-3 py-3 flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div className="flex-1 min-w-0" onClick={() => onEditTask(t)}>
              <div className="text-base font-medium" style={{ color: (t.done || t.cancelled) ? C.textGhost : C.text, textDecoration: (t.done || t.cancelled) ? "line-through" : "none" }}>{t.title}</div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <TaskBadges t={t} theme={theme} showTheme={false} />
              </div>
            </div>
            <button onClick={() => onToggleToday(t.id)} className="shrink-0 p-1">
              {t.inToday ? <Star size={18} fill={C.accent} color={C.accent} /> : <StarOff size={18} color={C.textDim} />}
            </button>
            <button onClick={() => onDeleteTask(t.id)} className="shrink-0 p-1" style={{ color: C.textDim }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <button onClick={onAddTask} className="w-full rounded-lg px-4 py-3 flex items-center justify-center gap-2 font-semibold text-sm" style={{ background: theme.color, color: C.bg }}>
        <Plus size={16} /> Ajouter une tâche
      </button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto overscroll-contain"
        style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ThemeForm({ initial, onCancel, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [color, setColor] = useState(initial?.color || PRESET_COLORS[0].value);
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>{initial ? "Modifier le dossier" : "Nouveau dossier"}</h3>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du thème"
        className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
      <div className="flex gap-2 flex-wrap">
        {PRESET_COLORS.map((c) => (
          <button key={c.value} onClick={() => setColor(c.value)} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: c.value, outline: color === c.value ? `2px solid ${C.text}` : "none", outlineOffset: 2 }}>
            {color === c.value && <Check size={14} color={C.bg} strokeWidth={3} />}
          </button>
        ))}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>Annuler</button>
        <button disabled={!name.trim()} onClick={() => onSave(name.trim(), color)} className="flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>Enregistrer</button>
      </div>
    </div>
  );
}

// Duration picker: short press = ±15 min, long press (≥400ms) = ±1 min per repeat.
// A long-press fires repeatedly every 150ms while the finger stays down.
// Smart step: the increment adapts to where you are in the range so that
// small durations feel precise and big ones don't need a hundred taps.
//   < 5 min   → ±1 min
//   5–14 min  → ±5 min
//   15–119 min → ±15 min (default range)
//   120–239 min → ±30 min
//   ≥ 240 min → ±60 min
function durationStep(value, dir) {
  if (dir > 0) {
    if (value < 5) return 1;
    if (value < 15) return 5;
    if (value < 120) return 15;
    if (value < 240) return 30;
    return 60;
  } else {
    if (value <= 1) return 0;
    if (value <= 5) return 1;
    if (value <= 15) return 5;
    if (value <= 120) return 15;
    if (value <= 240) return 30;
    return 60;
  }
}

function DurationPicker({ value, onChange }) {
  const longPressRef = useRef(null);
  const repeatRef = useRef(null);

  const applyStep = (dir) => {
    onChange((v) => {
      const step = durationStep(v, dir);
      return Math.max(1, v + dir * step);
    });
  };

  const startPress = (dir) => {
    applyStep(dir);
    longPressRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => applyStep(dir), 130);
    }, 420);
  };

  const endPress = () => {
    clearTimeout(longPressRef.current);
    clearInterval(repeatRef.current);
  };

  const hours = Math.floor(value / 60);
  const mins = value % 60;
  const label = hours > 0
    ? `${hours}h${mins > 0 ? String(mins).padStart(2, "0") : "00"}`
    : `${value} min`;

  const stepLabel = value < 5 ? "±1 min" : value < 15 ? "±5 min" : value < 120 ? "±15 min" : value < 240 ? "±30 min" : "±1h";

  const btnStyle = {
    width: 48, height: 48, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    background: C.surfaceRaised, border: `1px solid ${C.borderStrong}`, color: C.text,
    fontSize: 24, fontWeight: 700, cursor: "pointer", userSelect: "none",
    WebkitUserSelect: "none", touchAction: "none",
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <button style={btnStyle}
        onPointerDown={() => startPress(-1)} onPointerUp={endPress} onPointerLeave={endPress}
        aria-label="Diminuer la durée">−</button>
      <div className="flex-1 text-center">
        <div className="text-2xl font-bold font-mono-num" style={{ color: C.text }}>{label}</div>
        <div className="text-[10px] mt-0.5" style={{ color: C.textGhost }}>{stepLabel} · maintenir pour affiner</div>
      </div>
      <button style={btnStyle}
        onPointerDown={() => startPress(1)} onPointerUp={endPress} onPointerLeave={endPress}
        aria-label="Augmenter la durée">+</button>
    </div>
  );
}

const QUIZ_PRAISE = ["Excellent ! 🎉", "Bravo ! 🙌", "Tu assures ! 💪", "Impressionnant ! ✨", "Bien joué ! 🌟", "Génial ! ⚡", "Quel talent ! 👏", "Pile dans le mille ! 🎯"];

// Identifie la "forme" d'une question (son amorce), pour éviter que plusieurs
// questions à la formulation quasi-identique ne se suivent dans une partie.
function quizQuestionShape(q) {
  if (/^Dans certaines traditions ésotériques/.test(q.q)) return "esoterique";
  if (/^À quelle famille botanique appartient/.test(q.q)) return "famille_directe";
  if (/^Laquelle de ces plantes appartient/.test(q.q)) return "famille_inverse";
  if (q.type === "vf" && /famille botanique/.test(q.q)) return "vf_famille";
  if (q.type === "vf") return "vf_autre";
  return "qcm_general";
}
// Identifie le SUJET d'une question à partir de mots-clés présents dans son texte
// (ex. "spiruline", "biais de confirmation"...) — c'est ce qui évite qu'un même
// sujet ne revienne en boucle. Se rabat sur le préfixe de l'id si aucun mot-clé ne matche.
const QUIZ_TOPIC_KEYWORDS = [
  "observation", "sentiment", "besoin", "demande", "empathie", "girafe", "chacal", "exigence", "stratégie", "colère", "compromis", "langage aliénant",
  "spiruline", "propolis", "miel", "sauge", "verveine", "cannelle", "girofle", "cardamome", "safran",
  "ginkgo", "ginseng", "moringa", "aloe vera", "argile", "calendula", "souci", "arnica", "chardon-marie",
  "chardon marie", "prêle", "bardane", "valériane", "réglisse", "fenugrec", "estragon", "laurier",
  "badiane", "origan", "cumin", "ciboulette", "cerfeuil", "paprika", "camomille", "ortie", "gingembre",
  "romarin", "tilleul", "curcuma", "pissenlit", "fenouil", "échinacée", "passiflore", "basilic", "persil",
  "sureau", "aubépine", "millepertuis", "mélisse", "anis", "consoude", "ravintsara", "reine-des-prés",
  "bouillon blanc", "épeautre", "hildegarde", "lavande", "menthe", "thym", "ail",
  "dopamine", "ocytocine", "cortisol", "sérotonine", "gaba", "acétylcholine", "mélatonine", "sommeil",
  "hippocampe", "amygdale", "cervelet", "hémisphère", "neurone", "synapse", "neurogenèse", "biais",
  "cortex préfrontal", "broca", "wernicke", "yerkes-dodson", "dunning-kruger", "ikea", "franklin",
  "placebo", "méditation", "gratitude", "stress", "flow", "circadien", "gliale", "axone", "myéline",
];
function quizQuestionTopic(q) {
  const text = (q.q + " " + (q.explain || "")).toLowerCase();
  for (const kw of QUIZ_TOPIC_KEYWORDS) {
    if (text.includes(kw)) return kw;
  }
  return q.id.replace(/[0-9]+$/, "");
}
// Réorganise en évitant, dans l'ordre de préférence, de répéter le même SUJET puis la
// même FORME juste après — sans changer l'ordre relatif au sein d'un même sujet.
function declusterQuiz(list) {
  const topicBuckets = {};
  list.forEach((q) => { const k = quizQuestionTopic(q); (topicBuckets[k] = topicBuckets[k] || []).push(q); });
  const topics = Object.keys(topicBuckets);
  const result = [];
  let lastTopic = null;
  let lastShape = null;
  while (result.length < list.length) {
    const candidates = topics.filter((t) => topicBuckets[t].length > 0);
    if (candidates.length === 0) break;
    let pool = candidates.filter((t) => t !== lastTopic);
    if (pool.length === 0) pool = candidates;
    const pick = pool.find((t) => quizQuestionShape(topicBuckets[t][0]) !== lastShape) || pool[0];
    const q = topicBuckets[pick].shift();
    result.push(q);
    lastTopic = pick;
    lastShape = quizQuestionShape(q);
  }
  return result;
}

function QuizPlayer({ theme, onClose, onFinish, sound, quizSeenLog }) {
  const [order, setOrder] = useState(() => {
    const seenLog = quizSeenLog || {};
    // Priorité aux questions jamais vues, puis aux plus anciennement revues —
    // évite qu'une question tout juste réussie ne retombe trop vite.
    const scored = theme.questions.map((q) => ({
      q,
      score: seenLog[q.id] ? new Date(seenLog[q.id]).getTime() : 0,
      rand: Math.random(),
    }));
    scored.sort((a, b) => (a.score - b.score) || (a.rand - b.rand));
    // Empêche plusieurs questions à la formulation/sujet quasi-identique de se suivre.
    const deduped = declusterQuiz(scored.map(({ q }) => q));
    // Mélange aussi l'ordre des choix de chaque QCM (sinon la bonne réponse
    // reste toujours à la même place, ce qui rend le quiz trivial à deviner).
    return deduped.map((q) => {
      if (q.type !== "qcm") return q;
      const correctText = q.options[q.correct];
      const shuffled = [...q.options];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return { ...q, options: shuffled, correct: shuffled.indexOf(correctText) };
    });
  });
  const [level, setLevel] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [correctIds, setCorrectIds] = useState([]);
  const [banked, setBanked] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [praise, setPraise] = useState(QUIZ_PRAISE[0]);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const maxLevel = order.length;
  const question = order[level];
  const pointsAtStake = quizPointsForLevel(level);
  const nextPoints = quizPointsForLevel(level + 1);
  const wasCorrect = selected !== null && (question.type === "vf" ? selected === question.correct : selected === question.correct);

  const submitAnswer = (ans) => {
    if (revealed) return;
    setSelected(ans);
    setRevealed(true);
    const correct = question.type === "vf" ? ans === question.correct : ans === question.correct;
    if (correct) {
      const newCount = correctCount + 1;
      const bonus = quizBonusForCount(newCount);
      setCorrectCount(newCount);
      setCorrectIds((ids) => [...ids, question.id]);
      setLastGain(pointsAtStake + bonus);
      setBanked((b) => b + pointsAtStake + bonus);
      setPraise(QUIZ_PRAISE[Math.floor(Math.random() * QUIZ_PRAISE.length)]);
      if (sound) { if (bonus > 0) sound.bigSuccess(); else sound.taskComplete(); }
    } else {
      // Une mauvaise réponse coûte des points mais n'arrête plus la partie —
      // jamais en dessous de 0, on ne repasse jamais "dans le rouge".
      setBanked((b) => Math.max(0, b - 5));
    }
  };

  const finish = () => setGameOver(true);
  const goNext = () => {
    if (level + 1 >= maxLevel) { finish(); return; }
    setLevel((l) => l + 1);
    setSelected(null);
    setRevealed(false);
  };
  // Remet la question ratée un peu plus loin dans la partie (pas tout de suite) —
  // mieux pour vérifier une vraie mémorisation qu'une répétition immédiate. Le palier
  // (et ses points en jeu) ne change pas : on retente juste avec une autre question.
  const requeueMissed = () => {
    setOrder((prev) => {
      const arr = [...prev];
      const missed = arr[level];
      arr.splice(level, 1);
      const insertAt = Math.min(arr.length, level + 5);
      arr.splice(insertAt, 0, missed);
      return arr;
    });
    setSelected(null);
    setRevealed(false);
  };

  if (gameOver) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8 text-center" style={{ background: C.bg }}>
        <div style={{ fontSize: 44 }}>{theme.emoji}</div>
        <h2 className="font-display text-2xl font-bold italic mt-3 mb-1" style={{ color: C.text }}>Quiz terminé</h2>
        <p className="text-sm mb-6" style={{ color: C.textDim }}>{theme.name}</p>
        <div className="text-5xl font-black mb-2" style={{ color: C.points }}>{banked}</div>
        <p className="text-sm mb-8" style={{ color: C.textDim }}>points gagnés</p>
        <button onClick={() => { onFinish(banked, correctIds); onClose(); }} className="px-8 py-3 rounded-xl font-bold" style={{ background: C.accent, color: C.onAccent }}>
          Fermer
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: C.bg }}>
      <style>{`
        @keyframes quizRevealPop { 0% { transform: scale(0.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .quiz-reveal-pop { animation: quizRevealPop 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
        @keyframes quizEmojiPop { 0% { transform: scale(0) rotate(-15deg); } 60% { transform: scale(1.3) rotate(8deg); } 100% { transform: scale(1) rotate(0deg); } }
        .quiz-emoji-pop { animation: quizEmojiPop 0.4s cubic-bezier(0.22,1,0.36,1) forwards; display: inline-block; }
      `}</style>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <button onClick={() => { if (confirm(`Quitter le quiz ? Tu gardes ${banked} points.`)) { onFinish(banked, correctIds); onClose(); } }} className="text-sm font-semibold px-2 py-1" style={{ color: C.textDim }}>
          Quitter
        </button>
        <span className="text-sm font-bold" style={{ color: C.text }}>{theme.emoji} {theme.name}</span>
        <span className="text-sm font-bold" style={{ color: C.points }}>{banked} pts</span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: C.textGhost }}>
          Question {level + 1} / {maxLevel}
        </div>
        <div className="text-sm font-bold mb-5" style={{ color: C.points }}>+{pointsAtStake} points en jeu</div>

        <div className="text-lg font-semibold leading-snug mb-6" style={{ color: C.text }}>{question.q}</div>

        {question.type === "qcm" ? (
          <div className="space-y-2.5">
            {question.options.map((opt, i) => {
              const isCorrectOpt = i === question.correct;
              const isSelectedOpt = i === selected;
              let style = { background: C.surface, border: `1px solid ${C.border}`, color: C.text };
              if (revealed) {
                if (isCorrectOpt) style = { background: "#22C55E22", border: "1px solid #22C55E", color: "#22C55E" };
                else if (isSelectedOpt) style = { background: "#E11D4822", border: "1px solid #E11D48", color: "#E11D48" };
              }
              return (
                <button key={i} onClick={() => submitAnswer(i)} disabled={revealed} className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium" style={style}>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex gap-3">
            {[true, false].map((val) => {
              const label = val ? "Vrai" : "Faux";
              const isCorrectOpt = val === question.correct;
              const isSelectedOpt = val === selected;
              let style = { background: C.surface, border: `1px solid ${C.border}`, color: C.text };
              if (revealed) {
                if (isCorrectOpt) style = { background: "#22C55E22", border: "1px solid #22C55E", color: "#22C55E" };
                else if (isSelectedOpt) style = { background: "#E11D4822", border: "1px solid #E11D48", color: "#E11D48" };
              }
              return (
                <button key={label} onClick={() => submitAnswer(val)} disabled={revealed} className="flex-1 text-center py-4 rounded-xl text-base font-bold" style={style}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {revealed && (
          <div className="mt-6 rounded-xl p-4 quiz-reveal-pop" style={{ background: C.surface, border: `1px solid ${wasCorrect ? "#22C55E" : C.border}` }}>
            {wasCorrect ? (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="quiz-emoji-pop" style={{ fontSize: 30, lineHeight: 1 }}>🎉</span>
                  <div>
                    <div className="text-base font-black" style={{ color: "#22C55E" }}>{praise}</div>
                    <div className="text-sm font-bold" style={{ color: "#22C55E" }}>+{lastGain} points</div>
                  </div>
                </div>
                {lastGain > pointsAtStake && (
                  <div className="text-xs font-semibold mb-2 mt-1" style={{ color: C.points }}>🎁 Bonus de série : +{lastGain - pointsAtStake} ({correctCount} bonnes réponses) !</div>
                )}
                {question.explain && (
                  <div className="text-xs mt-2 mb-3 pt-2" style={{ borderTop: `1px solid ${C.border}`, color: C.textDim }}>💡 {question.explain}</div>
                )}
                <div className="flex gap-2">
                  {level + 1 < maxLevel && (
                    <button onClick={goNext} className="flex-1 py-2.5 rounded-lg text-sm font-bold" style={{ background: C.accent, color: C.onAccent }}>
                      Continuer — {nextPoints} pts en jeu
                    </button>
                  )}
                  <button onClick={finish} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
                    M'arrêter là
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-bold mb-1" style={{ color: "#E11D48" }}>✗ Pas tout à fait — -5 points</div>
                <div className="text-xs mb-2" style={{ color: C.textDim }}>Il te reste {banked} points. Cette question reviendra un peu plus tard.</div>
                {question.explain && (
                  <div className="text-xs mb-3 pt-2" style={{ borderTop: `1px solid ${C.border}`, color: C.textDim }}>💡 {question.explain}</div>
                )}
                <div className="flex gap-2">
                  <button onClick={requeueMissed} className="flex-1 py-2.5 rounded-lg text-sm font-bold" style={{ background: C.accent, color: C.onAccent }}>
                    Continuer — {pointsAtStake} pts en jeu
                  </button>
                  <button onClick={finish} className="flex-1 py-2.5 rounded-lg text-sm font-semibold" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
                    Voir le résultat
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskForm({ themes, initial, onCancel, onSave, onDelete, checklists, gigRoles, onAddGigRole, onCreateChecklist }) {
  const isNew = !initial?.id;
  const [title, setTitle] = useState(initial?.title || "");
  const initialMode = !("duration" in (initial || {}))
    ? "unknown"
    : initial.duration === null
    ? "brief"
    : initial.duration === "indeterminee"
    ? "unknown"
    : "fixed";
  const [durationMode, setDurationMode] = useState(initialMode);
  const [duration, setDuration] = useState(typeof initial?.duration === "number" ? initial.duration : 15);
  const [time, setTime] = useState(initial?.time || "");
  const [themeId, setThemeId] = useState(initial?.themeId || themes[0]?.id);
  const [urgency, setUrgency] = useState(initial?.urgency || 2);
  const [recurrence, setRecurrence] = useState(initial?.recurrence || null);
  const [startDate, setStartDate] = useState(initial?.startDate || "");
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [allDay, setAllDay] = useState(!!initial?.allDay);
  const [showEndDate, setShowEndDate] = useState(!!initial?.endDate);
  const [showDurationDetail, setShowDurationDetail] = useState(false);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [kind, setKind] = useState(initial?.kind || "task");
  // Points : null = auto (selon durée), sinon valeur personnalisée
  const [customPoints, setCustomPoints] = useState(typeof initial?.points === "number" ? initial.points : null);
  // Contacts associés : [{ name, tel }]
  const [contacts, setContacts] = useState(Array.isArray(initial?.contacts) ? initial.contacts : []);
  const [manualName, setManualName] = useState("");
  const [manualTel, setManualTel] = useState("");
  const contactsSupported = typeof navigator !== "undefined" && navigator.contacts && navigator.contacts.select;

  const pickContact = async () => {
    try {
      const props = ["name", "tel"];
      const selected = await navigator.contacts.select(props, { multiple: true });
      const mapped = (selected || []).map((c) => ({
        name: (c.name && c.name[0]) || (c.tel && c.tel[0]) || "Contact",
        tel: (c.tel && c.tel[0]) || "",
      })).filter((c) => c.tel);
      if (mapped.length) {
        // Évite les doublons par numéro
        const existing = new Set(contacts.map((c) => c.tel));
        setContacts([...contacts, ...mapped.filter((c) => !existing.has(c.tel))]);
      }
    } catch (e) { /* annulé par l'utilisateur ou non supporté */ }
  };
  const removeContact = (tel) => setContacts(contacts.filter((c) => c.tel !== tel));

  const finalDuration = durationMode === "brief" ? 1 : duration;
  // Points auto selon la durée (aperçu), sauf si personnalisés
  const autoPoints = pointsForTask({ done: true, duration: finalDuration });
  const displayPoints = customPoints != null ? customPoints : autoPoints;

  const RECURRENCE_OPTIONS = [
    { value: null, label: "Non" },
    { value: "daily", label: "Jour" },
    { value: "weekly", label: "Sem." },
    { value: "monthly", label: "Mois" },
  ];

  // Afficher dans l'agenda ? (par défaut : oui si l'item a une date/heure)
  const [showInAgenda, setShowInAgenda] = useState(initial?.showInAgenda !== false);
  // Statut Option / Confirmé — pour événements et prestations uniquement.
  const [eventStatus, setEventStatus] = useState(initial?.eventStatus || "confirme");
  // Organisateur et playlists — pour événements et prestations.
  const [organizer, setOrganizer] = useState(initial?.organizer || null);
  const [playlists, setPlaylists] = useState(Array.isArray(initial?.playlists) ? initial.playlists : []);
  const [newPlaylist, setNewPlaylist] = useState("");
  const addPlaylist = () => {
    const v = newPlaylist.trim();
    if (v && !playlists.includes(v)) setPlaylists([...playlists, v]);
    setNewPlaylist("");
  };
  const removePlaylist = (v) => setPlaylists(playlists.filter((p) => p !== v));

  // --- Fiche "Prestation" (rôle, lieu, déroulé horaire, listes, cachet) ---
  const [gigRole, setGigRole] = useState(initial?.gigRole || (gigRoles || DEFAULT_GIG_ROLES)[0]);
  const [gigAddress, setGigAddress] = useState(initial?.gigLocation?.address || "");
  const [gigCity, setGigCity] = useState(initial?.gigLocation?.city || "");
  const [gigZip, setGigZip] = useState(initial?.gigLocation?.zip || "");
  const [gigSchedule, setGigSchedule] = useState(Array.isArray(initial?.gigSchedule) ? initial.gigSchedule : []);
  const [checklistId, setChecklistId] = useState(initial?.checklistId || null);
  const [gigPayment, setGigPayment] = useState(typeof initial?.gigPayment === "number" ? String(initial.gigPayment) : "");
  const [gigSettled, setGigSettled] = useState(!!initial?.gigSettled);
  const [gigNoteOpenId, setGigNoteOpenId] = useState(null);

  const addGigScheduleLine = () => {
    setGigSchedule((list) => [...list, { id: "sc-" + uid(), time: "", label: "", son: "?", lumiere: "?", video: "?", note: "" }]);
  };
  const updateGigScheduleLine = (id, patch) => setGigSchedule((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeGigScheduleLine = (id) => setGigSchedule((list) => list.filter((l) => l.id !== id));

  const handleSave = () => {
    onSave({
      title: title.trim(),
      kind,
      duration: finalDuration,
      time,
      themeId,
      urgency: (kind === "task" || kind === "chantier") ? urgency : null,
      recurrence,
      startDate: startDate || null,
      endDate: endDate || null,
      dueDate: dueDate || null,
      allDay,
      points: customPoints != null ? customPoints : null,
      contacts: contacts.length ? contacts : null,
      showInAgenda: showInAgenda,
      notes: notes.trim() || null,
      gigRole: kind === "prestation" ? gigRole : null,
      gigLocation: kind === "prestation" ? { address: gigAddress.trim(), city: gigCity.trim(), zip: gigZip.trim() } : null,
      gigSchedule: kind === "prestation" ? gigSchedule : null,
      checklistId: (kind === "event" || kind === "prestation" || kind === "chantier" || kind === "task") ? checklistId : null,
      gigPayment: kind === "prestation" && gigPayment !== "" ? Number(gigPayment) : null,
      gigSettled: kind === "prestation" ? gigSettled : false,
      eventStatus: (kind === "event" || kind === "prestation") ? eventStatus : null,
      organizer: (kind === "event" || kind === "prestation") ? organizer : null,
      playlists: (kind === "event" || kind === "prestation") && playlists.length ? playlists : null,
    });
  };

  const KIND_LABELS = { task: "tâche", event: "événement", prestation: "prestation", chantier: "tâche au long cours" };
  const kindLabel = KIND_LABELS[kind] || "tâche";
  const KIND_CYCLE = ["task", "event", "prestation", "chantier"];
  const KIND_META = {
    task:       { label: "📋 Tâche",       bg: C.accent,   fg: C.bg },
    event:      { label: "🚩 Événement",   bg: "#F59E0B",  fg: "#0B0810" },
    prestation: { label: "🚩 Prestation",  bg: "#8B5CF6",  fg: "#FFFFFF" },
    chantier:   { label: "🧭 Long cours",   bg: "#38BDF8",  fg: "#0B0810" },
  };
  const kindMeta = KIND_META[kind] || KIND_META.task;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setKind(KIND_CYCLE[(KIND_CYCLE.indexOf(kind) + 1) % KIND_CYCLE.length])}
          className="py-2 px-4 rounded-md text-sm font-semibold"
          style={{ background: kindMeta.bg, color: kindMeta.fg, border: `1px solid ${kindMeta.bg}` }}>
          {kindMeta.label}
        </button>
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)}
          className="flex-1 rounded-md px-2 py-2 text-xs outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
          {themes.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}
        </select>
      </div>

      {(kind === "event" || kind === "prestation") && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setEventStatus("option")}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold"
            style={{ background: eventStatus === "option" ? "#F59E0B" : "transparent", color: eventStatus === "option" ? "#0B0810" : C.textDim, border: `1px solid ${eventStatus === "option" ? "#F59E0B" : C.borderStrong}` }}>
            🕓 Option
          </button>
          <button type="button" onClick={() => setEventStatus("confirme")}
            className="flex-1 py-1.5 rounded-md text-xs font-semibold"
            style={{ background: eventStatus === "confirme" ? "#22C55E" : "transparent", color: eventStatus === "confirme" ? "#0B0810" : C.textDim, border: `1px solid ${eventStatus === "confirme" ? "#22C55E" : C.borderStrong}` }}>
            ✓ Confirmé
          </button>
        </div>
      )}

      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Désignation"
        className="w-full rounded-md px-3 py-2 text-base outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />

      {kind === "prestation" && (
        <div className="space-y-4 rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <div className="text-xs shrink-0" style={{ color: C.textDim }}>Rôle</div>
            <input list="gig-roles-list" value={gigRole} onChange={(e) => setGigRole(e.target.value)}
              onBlur={() => { const v = gigRole.trim(); if (v && !(gigRoles || DEFAULT_GIG_ROLES).includes(v) && onAddGigRole) onAddGigRole(v); }}
              placeholder="DJ, Musicien, Technicien..."
              className="flex-1 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
            <datalist id="gig-roles-list">
              {(gigRoles || DEFAULT_GIG_ROLES).map((val) => <option key={val} value={val} />)}
            </datalist>
          </div>

          <div>
            <div className="text-xs mb-2" style={{ color: C.textDim }}>Lieu</div>
            <input value={gigAddress} onChange={(e) => setGigAddress(e.target.value)} placeholder="Adresse"
              className="w-full rounded-md px-3 py-2 text-sm outline-none mb-2" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
            <div className="flex gap-2">
              <input value={gigCity} onChange={(e) => setGigCity(e.target.value)} placeholder="Ville"
                className="flex-1 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
              <input value={gigZip} onChange={(e) => setGigZip(e.target.value)} placeholder="Code postal"
                className="w-28 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs" style={{ color: C.textDim }}>Horaires</div>
              <button type="button" onClick={addGigScheduleLine} className="text-xs font-semibold px-2 py-1 rounded-md" style={{ background: C.accent, color: C.bg }}>+ Ajouter</button>
            </div>
            <div className="space-y-2">
              {gigSchedule.map((line) => (
                <div key={line.id} className="rounded-md p-2" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <input value={line.time} onChange={(e) => updateGigScheduleLine(line.id, { time: e.target.value })} placeholder="14h"
                      className="w-16 rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
                    <input value={line.label} onChange={(e) => updateGigScheduleLine(line.id, { label: e.target.value })} placeholder="Arrivée sur place"
                      className="flex-1 rounded-md px-2 py-1.5 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
                    <button type="button" onClick={() => setGigNoteOpenId(gigNoteOpenId === line.id ? null : line.id)}
                      style={{ color: line.note ? C.accentLight : C.textGhost }} title="Note">
                      <StickyNote size={15} />
                    </button>
                    <button type="button" onClick={() => removeGigScheduleLine(line.id)} style={{ color: C.textGhost }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {[["son", "Son"], ["lumiere", "Lumière"], ["video", "Vidéo"]].map(([key, label]) => {
                      const val = line[key] || "?"; // "oui" | "non" | "?"
                      const cycle = () => {
                        const next = val === "?" ? "oui" : val === "oui" ? "non" : "?";
                        updateGigScheduleLine(line.id, { [key]: next });
                      };
                      const colors = val === "oui" ? { bg: "#22C55E22", fg: "#22C55E", bd: "#22C55E" }
                        : val === "non" ? { bg: "#E1184822", fg: "#E11848", bd: "#E11848" }
                        : { bg: C.bg, fg: C.textGhost, bd: C.borderStrong };
                      return (
                        <button key={key} type="button" onClick={cycle}
                          className="flex-1 py-1.5 rounded-md font-semibold"
                          style={{ background: colors.bg, color: colors.fg, border: `1px solid ${colors.bd}` }}>
                          {label} · {val === "oui" ? "Oui" : val === "non" ? "Non" : "?"}
                        </button>
                      );
                    })}
                  </div>
                  {gigNoteOpenId === line.id && (
                    <input value={line.note} onChange={(e) => updateGigScheduleLine(line.id, { note: e.target.value })} placeholder="Note (ex: pas de prise à proximité)"
                      className="w-full mt-1.5 rounded-md px-2 py-1.5 text-xs outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
                  )}
                </div>
              ))}
              {gigSchedule.length === 0 && <div className="text-xs italic" style={{ color: C.textGhost }}>Aucune ligne pour l'instant.</div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input value={gigPayment} onChange={(e) => setGigPayment(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Règlement (€)" inputMode="numeric"
              className="flex-1 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
            <label className="flex items-center gap-1.5 text-xs shrink-0" style={{ color: C.textDim }}>
              <input type="checkbox" checked={gigSettled} onChange={(e) => setGigSettled(e.target.checked)} className="w-3.5 h-3.5" />
              Payé
            </label>
          </div>
        </div>
      )}

      {kind !== "chantier" && (
      <div className="rounded-xl p-3 space-y-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
          {(() => {
            const today = todayISODate();
            const tomorrow = addDaysISO(1);
            const state = startDate === "" ? "none" : startDate === today ? "today" : startDate === tomorrow ? "tomorrow" : "dated";
            const META = {
              none:     { label: "Pas de date", next: today },
              today:    { label: "Aujourd'hui",  next: tomorrow },
              tomorrow: { label: "Demain",       next: "" },
              dated:    { label: "Daté",         next: "" },
            };
            const m = META[state];
            return (
              <button type="button" onClick={() => setStartDate(m.next)}
                className="px-3 py-2 rounded-md text-xs font-semibold shrink-0"
                style={{
                  background: state === "none" ? "transparent" : C.accent,
                  color: state === "none" ? C.textDim : C.bg,
                  border: `1px solid ${state === "none" ? C.borderStrong : C.accent}`,
                }}>
                {m.label}
              </button>
            );
          })()}
          {!showEndDate && (
            <button type="button" onClick={() => setShowEndDate(true)} title="Ajouter une date de fin"
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
              <Plus size={16} />
            </button>
          )}
        </div>
        {showEndDate && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: C.textDim }}>Date de fin</span>
              <button type="button" onClick={() => { setShowEndDate(false); setEndDate(""); }} className="text-[11px] font-semibold" style={{ color: C.textGhost }}>
                ✕ Retirer
              </button>
            </div>
            <input type="date" value={endDate} min={startDate || undefined}
              onChange={(e) => { setEndDate(e.target.value); if (e.target.value && kind === "task") setKind("event"); }}
              className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.accent}`, color: C.text }} />
          </div>
        )}

        <label className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setAllDay((v) => !v)}>
          <div
            className="w-9 h-5 rounded-full flex items-center px-0.5 shrink-0"
            style={{ background: allDay ? C.accent : C.borderStrong, justifyContent: allDay ? "flex-end" : "flex-start", transition: "all 0.2s ease" }}
          >
            <div className="w-4 h-4 rounded-full" style={{ background: C.text }} />
          </div>
          <span className="text-sm" style={{ color: C.text }}>Toute la journée</span>
        </label>

        {!allDay && (
          <div className="flex items-center gap-2">
            <span className="text-xs shrink-0" style={{ color: C.textDim }}>Durée</span>
            <button type="button" onClick={() => setDurationMode(durationMode === "brief" ? "fixed" : "brief")}
              className="px-3 py-1.5 rounded-md text-xs font-semibold shrink-0"
              style={{ background: durationMode === "brief" ? C.accent : "transparent", color: durationMode === "brief" ? C.bg : C.textDim, border: `1px solid ${durationMode === "brief" ? C.accent : C.borderStrong}` }}>
              Brève
            </button>
            {durationMode !== "brief" && (
              <button type="button" onClick={() => setShowDurationDetail((v) => !v)}
                className="flex-1 px-3 py-1.5 rounded-md text-xs font-semibold text-left"
                style={{ background: "transparent", color: C.text, border: `1px solid ${C.borderStrong}` }}>
                {duration} min {showDurationDetail ? "▲" : "▼"}
              </button>
            )}
          </div>
        )}
        {!allDay && durationMode !== "brief" && showDurationDetail && (
          <DurationPicker value={duration} onChange={setDuration} />
        )}
      </div>
      )}


      {kind === "task" && (
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs shrink-0" style={{ color: C.textDim }}>✨ Points</span>
            <button onClick={() => setCustomPoints((p) => Math.max(0, (p ?? autoPoints) - 5))}
              className="w-8 h-8 rounded-lg text-lg font-bold flex items-center justify-center shrink-0"
              style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }}>−</button>
            <div className="flex-1 text-center py-1.5 rounded-lg font-black" style={{ background: C.surfaceRaised, color: C.accent, border: `1px solid ${C.border}`, fontSize: 15 }}>
              {displayPoints}{customPoints == null ? " (auto)" : ""}
            </div>
            <button onClick={() => setCustomPoints((p) => (p ?? autoPoints) + 5)}
              className="w-8 h-8 rounded-lg text-lg font-bold flex items-center justify-center shrink-0"
              style={{ background: C.surfaceRaised, color: C.text, border: `1px solid ${C.border}` }}>+</button>
            {customPoints != null && (
              <button onClick={() => setCustomPoints(null)}
                className="px-2 py-1.5 rounded-lg text-[11px] font-semibold shrink-0"
                style={{ background: "transparent", color: C.textGhost, border: `1px solid ${C.border}` }}>
                Auto
              </button>
            )}
          </div>
        </div>
      )}

      <div className={(kind === "task" || kind === "chantier") ? "grid grid-cols-2 gap-3" : ""}>
        {(kind === "task" || kind === "chantier") && (
          <div>
            <div className="text-xs mb-1.5" style={{ color: C.textDim }}>Urgence</div>
            <div className="flex gap-1">
              {URGENCY.map((lvl) => (
                <button key={lvl.level} onClick={() => setUrgency(lvl.level)} className="flex-1 text-[10px] font-semibold py-1.5 rounded-md"
                  style={{ background: urgency === lvl.level ? lvl.color : "transparent", color: urgency === lvl.level ? C.bg : C.textDim, border: `1px solid ${urgency === lvl.level ? lvl.color : C.borderStrong}` }}>
                  {lvl.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {kind === "task" && (
        <div>
          <div className="text-xs mb-1.5" style={{ color: C.textDim }}>Répéter</div>
          <div className="flex gap-1">
            {RECURRENCE_OPTIONS.map((opt) => (
              <button key={opt.label} onClick={() => setRecurrence(opt.value)} className="flex-1 py-1.5 rounded-md text-[10px] font-semibold"
                style={{ background: recurrence === opt.value ? C.accent : "transparent", color: recurrence === opt.value ? C.bg : C.textDim, border: `1px solid ${recurrence === opt.value ? C.accent : C.borderStrong}` }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )}
      </div>

      {(kind === "task" || kind === "chantier") && (
        <div>
          <div className="text-xs mb-1.5" style={{ color: C.textDim }}>{kind === "chantier" ? "Échéance" : "Échéance (optionnel)"}</div>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
        </div>
      )}

      {!allDay && (
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <div className="text-xs mb-1.5" style={{ color: C.textDim }}>Heure (optionnel)</div>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none pb-2" onClick={() => setShowInAgenda((v) => !v)}>
            <div className="w-9 h-5 rounded-full flex items-center px-0.5 shrink-0"
              style={{ background: showInAgenda ? C.accent : C.borderStrong, justifyContent: showInAgenda ? "flex-end" : "flex-start", transition: "all 0.2s" }}>
              <div className="w-4 h-4 rounded-full" style={{ background: C.text }} />
            </div>
            <span className="text-xs" style={{ color: C.textDim }}>Dans l'agenda</span>
          </label>
        </div>
      )}

      {/* Contacts associés (masqué pour l'instant — pas encore utile au quotidien) */}
      {contacts.length > 0 && (
      <div>
        <div className="text-xs mb-2 flex items-center gap-1.5" style={{ color: C.textDim }}>
          👤 Personnes concernées
        </div>
        {contacts.length > 0 && (
          <div className="space-y-1.5 mb-2">
            {contacts.map((c) => (
              <div key={c.tel || c.name} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <span className="flex-1 text-sm" style={{ color: C.text }}>{c.name}</span>
                <span className="text-[11px]" style={{ color: C.textGhost }}>{c.tel}</span>
                <button onClick={() => removeContact(c.tel)} style={{ color: C.textGhost }}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <button onClick={pickContact} className="w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
          style={{ background: C.surface, color: C.accentLight, border: `1px dashed ${C.accent}66` }}>
          <Plus size={14} /> Associer un contact
        </button>
        {!contactsSupported && (
          <div className="text-[10px] mt-1.5" style={{ color: C.textGhost }}>
            Le choix depuis le répertoire ne marche que sur Android + Chrome, sur la version hébergée (https). Sinon, tu peux saisir un nom ci-dessous.
          </div>
        )}
        {!contactsSupported && (
          <div className="flex gap-1.5 mt-1.5">
            <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Nom"
              className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }} />
            <input value={manualTel} onChange={(e) => setManualTel(e.target.value)} placeholder="Tél."
              className="w-28 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: C.bg, color: C.text, border: `1px solid ${C.border}` }} />
            <button onClick={() => { if (manualName.trim()) { setContacts([...contacts, { name: manualName.trim(), tel: manualTel.trim() }]); setManualName(""); setManualTel(""); } }}
              className="px-3 rounded-lg text-sm font-bold" style={{ background: C.accent, color: C.bg }}>+</button>
          </div>
        )}
      </div>
      )}

      {(kind === "event" || kind === "prestation") && (
        <div className="rounded-xl p-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
          <div className="text-xs mb-2" style={{ color: C.textDim }}>Organisateur <span style={{ color: C.textGhost }}>(client, contact...)</span></div>
          <input value={organizer || ""} onChange={(e) => setOrganizer(e.target.value || null)} placeholder="Ex : Julie & Marc, Mairie de Sore..."
            className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
        </div>
      )}

      {(kind === "event" || kind === "prestation" || kind === "chantier" || kind === "task") && (
        <div className="rounded-xl p-3" style={{ background: C.surfaceRaised, border: `1px solid ${C.border}` }}>
          <div className="text-xs mb-2" style={{ color: C.textDim }}>Checklist liée</div>
          <div className="flex gap-2">
            <select value={checklistId || ""} onChange={(e) => setChecklistId(e.target.value || null)}
              className="flex-1 min-w-0 rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
              <option value="">Aucune</option>
              {(checklists || []).map((cl) => <option key={cl.id} value={cl.id}>{cl.emoji ? cl.emoji + " " : ""}{cl.name}</option>)}
            </select>
            <button type="button" onClick={() => {
              const nm = (typeof window !== "undefined" ? window.prompt("Nom de la nouvelle checklist :", title || "") : "")?.trim();
              if (nm && onCreateChecklist) { const newId = onCreateChecklist(nm); if (newId) setChecklistId(newId); }
            }} className="px-3 rounded-md text-xs font-semibold shrink-0" style={{ border: `1px dashed ${C.borderStrong}`, color: C.textGhost }}>
              + Créer
            </button>
          </div>
        </div>
      )}

      <div>
        <div className="text-xs mb-2" style={{ color: C.textDim }}>Détails (optionnel)</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Lieu, lien, note..."
          className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        />
      </div>

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <button onClick={onDelete} className="py-2 px-3 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.danger }}>
            <Trash2 size={16} />
          </button>
        )}
        <button onClick={onCancel} className="flex-1 py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>Annuler</button>
        <button disabled={!title.trim()} onClick={handleSave}
          className="flex-1 py-2 rounded-md text-sm font-semibold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>
          Valider
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 🏆 Progression — courbe de poids, constance, points, record de série
// ══════════════════════════════════════════════════════════════════
function ProgressModal({ weightLogs, dailyPoints, streakDays, streakRecord, targetWeight, onClose }) {
  const today = todayISODate();
  const dp = dailyPoints || {};

  // --- Calendrier de constance : 30 derniers jours ---
  const days30 = [];
  for (let i = 29; i >= 0; i--) days30.push(isoShift(today, -i));
  const maxPts = Math.max(1, ...days30.map((d) => dp[d] || 0));

  // --- Points des 14 derniers jours (barres) ---
  const days14 = days30.slice(-14);
  const maxPts14 = Math.max(1, ...days14.map((d) => dp[d] || 0));

  // --- Courbe de poids (derniers relevés, max 20 points) ---
  const sortedWeights = [...(weightLogs || [])].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-20);
  const weightVals = sortedWeights.map((w) => w.weight);
  const wMin = weightVals.length ? Math.min(...weightVals, targetWeight || Infinity) - 0.5 : 0;
  const wMax = weightVals.length ? Math.max(...weightVals, targetWeight || -Infinity) + 0.5 : 1;
  const wRange = Math.max(0.5, wMax - wMin);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl p-5 space-y-6 max-h-[85vh] overflow-y-auto" style={{ background: C.bg, border: `1px solid ${C.border}` }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold italic flex items-center gap-2" style={{ color: C.text }}>🏆 Ma progression</h3>
          <button onClick={onClose} style={{ color: C.textGhost }}><X size={20} /></button>
        </div>

        {/* Record de série */}
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "#F59E0B1A", border: `1px solid #F59E0B55` }}>
          <span style={{ fontSize: 34 }}>⚡</span>
          <div>
            <div className="text-2xl font-black" style={{ color: "#F59E0B" }}>{streakDays || 0} <span className="text-sm font-semibold">jour{(streakDays || 0) > 1 ? "s" : ""} d'affilée</span></div>
            <div className="text-xs" style={{ color: C.textGhost }}>Record : {streakRecord || 0} jour{(streakRecord || 0) > 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Calendrier de constance (30 jours) */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>Constance — 30 derniers jours</div>
          <div className="grid grid-cols-10 gap-1.5">
            {days30.map((d) => {
              const pts = dp[d] || 0;
              const intensity = pts / maxPts;
              const isToday = d === today;
              return (
                <div key={d} title={`${d} · ${pts} pts`}
                  className="aspect-square rounded-md"
                  style={{
                    background: pts > 0 ? `${C.accent}${Math.round(25 + intensity * 200).toString(16).padStart(2, "0")}` : C.surfaceRaised,
                    border: isToday ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                  }} />
              );
            })}
          </div>
        </div>

        {/* Points des 14 derniers jours (barres) */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>Points — 14 derniers jours</div>
          <div className="flex items-end gap-1.5" style={{ height: 90 }}>
            {days14.map((d) => {
              const pts = dp[d] || 0;
              const h = Math.max(3, (pts / maxPts14) * 100);
              const isToday = d === today;
              return (
                <div key={d} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d} · ${pts} pts`}>
                  <div className="w-full rounded-t-md" style={{ height: `${h}%`, background: isToday ? C.points : C.accent, opacity: isToday ? 1 : 0.7 }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Courbe de poids */}
        {sortedWeights.length >= 2 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>Poids</div>
            <svg viewBox="0 0 300 100" className="w-full" style={{ height: 100 }}>
              {targetWeight && (
                <line x1="0" y1={100 - ((targetWeight - wMin) / wRange) * 100} x2="300" y2={100 - ((targetWeight - wMin) / wRange) * 100}
                  stroke={C.textGhost} strokeWidth="1" strokeDasharray="4,4" />
              )}
              <polyline
                fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                points={sortedWeights.map((w, i) => {
                  const x = (i / (sortedWeights.length - 1)) * 300;
                  const y = 100 - ((w.weight - wMin) / wRange) * 100;
                  return `${x},${y}`;
                }).join(" ")}
              />
              {sortedWeights.map((w, i) => {
                const x = (i / (sortedWeights.length - 1)) * 300;
                const y = 100 - ((w.weight - wMin) / wRange) * 100;
                return <circle key={w.date} cx={x} cy={y} r="3" fill={C.accent} />;
              })}
            </svg>
            <div className="flex items-center justify-between text-[11px] mt-1" style={{ color: C.textGhost }}>
              <span>{sortedWeights[0].date}</span>
              <span className="font-bold" style={{ color: C.text }}>{sortedWeights[sortedWeights.length - 1].weight} kg</span>
              <span>{sortedWeights[sortedWeights.length - 1].date}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GaugeDetailModal({ kind, percent, doneCount, totalCount, briefCount, onClose }) {
  const isMoon = kind === "moon";
  return (
    <div className="space-y-4 text-center">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>{isMoon ? "Bien-être du jour" : "Tâches du jour"}</h3>
      <div className="flex justify-center py-2">
        {isMoon ? (
          <div style={{ transform: "scale(1.6)" }}><WellbeingMoon percent={percent} doneCount={doneCount} totalCount={totalCount} /></div>
        ) : (
          <ConstellationGauge percent={percent} />
        )}
      </div>
      <div>
        <div className="text-base font-semibold" style={{ color: C.text }}>
          {totalCount === 0 ? "Rien à faire encore" : `${doneCount} / ${totalCount} ${isMoon ? "habitudes accomplies" : "tâches faites"}`}
        </div>
        {!isMoon && briefCount > 0 && (
          <div className="text-xs mt-1" style={{ color: C.textDim }}>{briefCount} sans durée fixe</div>
        )}
        <div className="font-display italic text-sm mt-2" style={{ color: percent >= 100 ? C.points : C.accentLight }}>
          {isMoon ? moonMood(percent) : constellationMood(percent)}
        </div>
      </div>
      <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Fermer
      </button>
    </div>
  );
}

function TaskDetailView({ task, themes, checklists, onClose, onEdit }) {
  const theme = themes.find((th) => th.id === task.themeId);
  const linkedChecklist = (checklists || []).find((c) => c.id === task.checklistId);
  const KIND_LABELS = { task: "📋 Tâche", event: "🚩 Événement", prestation: "🚩 Prestation", chantier: "🧭 Tâche au long cours" };
  const Row = ({ label, children }) => (
    <div className="flex items-start justify-between gap-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
      <span className="text-xs shrink-0" style={{ color: C.textFaint }}>{label}</span>
      <span className="text-sm text-right" style={{ color: C.text }}>{children}</span>
    </div>
  );
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-bold" style={{ color: C.text }}>{task.title}</h3>
        <button onClick={onClose} className="shrink-0 p-1" style={{ color: C.textDim }} aria-label="Fermer"><X size={18} /></button>
      </div>
      <Row label="Type">{KIND_LABELS[task.kind] || "📋 Tâche"}</Row>
      {theme && <Row label="Rubrique"><span style={{ color: theme.color }}>{theme.name}</span></Row>}
      {(task.startDate || task.dueDate) ? (
        <Row label={task.kind === "task" ? "Échéance" : "Date"}>{formatDateFr(task.dueDate || task.startDate)}{task.endDate ? ` → ${formatDateFr(task.endDate)}` : ""}</Row>
      ) : (
        <Row label="Date"><span style={{ color: C.textGhost }}>Sans date</span></Row>
      )}
      {task.time && <Row label="Heure">{task.time}</Row>}
      {task.kind === "task" && <Row label="Urgence"><UrgencyDot urgency={task.urgency || 2} size={10} /> {URGENCY.find(u => u.level === (task.urgency || 2))?.label}</Row>}
      {task.recurrence && <Row label="Répétition">{RECURRENCE_LABELS[task.recurrence] || task.recurrence}</Row>}
      {task.kind === "prestation" && task.gigRole && <Row label="Rôle">{task.gigRole}</Row>}
      {task.organizer && <Row label="Organisateur">{task.organizer}</Row>}
      {linkedChecklist && <Row label="Checklist liée">{linkedChecklist.emoji} {linkedChecklist.name}</Row>}
      <Row label="Statut">
        {task.cancelled ? "Annulé" : task.done ? "✓ Fait" : "À faire"}
      </Row>
      {task.notes && task.notes.trim() && (
        <div className="pt-3">
          <div className="text-xs mb-1.5" style={{ color: C.textFaint }}>Notes</div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: C.textDim }}>{task.notes}</p>
        </div>
      )}
      <div className="flex gap-2 pt-4">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.surfaceRaised, color: C.textDim, border: `1px solid ${C.border}` }}>
          Fermer
        </button>
        <button onClick={onEdit} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: C.accent, color: C.bg }}>
          Modifier
        </button>
      </div>
    </div>
  );
}

function TaskActionsMenu({ task, onToggleDone, onFollowUp, onPostpone, onEdit, onDuplicate, onToggleCancel, onDelete, onToggleToday, onClose }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold leading-snug" style={{ color: C.text }}>{task.title}</div>
        {task.notes && task.notes.trim() && (
          <p className="text-xs leading-relaxed mt-1.5 whitespace-pre-wrap" style={{ color: C.textDim }}>{task.notes}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={onToggleDone}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          <Check size={17} style={{ color: C.accent }} />
          {task.done ? "Marquer comme non fait" : "Marquer comme fait"}
        </button>
        {!task.done && (
          <button
            onClick={onFollowUp}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
            style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
          >
            <Repeat size={17} style={{ color: C.accentLight }} />
            Fait… et à faire encore !
          </button>
        )}
        <button
          onClick={onPostpone}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          <CalendarClock size={17} style={{ color: C.accentLight }} />
          Reporter
        </button>
        <button
          onClick={onEdit}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          <Pencil size={17} style={{ color: C.textDim }} />
          Modifier
        </button>
        <button
          onClick={onDuplicate}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          <Copy size={17} style={{ color: C.textDim }} />
          Dupliquer
        </button>
        {task.kind === "task" ? (
          <button
            onClick={onDelete}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
            style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
          >
            <Trash2 size={17} style={{ color: C.danger }} />
            Supprimer la tâche
          </button>
        ) : (
          <button
            onClick={onToggleCancel}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
            style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
          >
            <Ban size={17} style={{ color: C.danger }} />
            {task.cancelled ? "Réactiver" : "Annuler"}
          </button>
        )}
      </div>
      <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Fermer
      </button>
    </div>
  );
}

function PostponeForm({ task, onCancel, onSave, onToggleToday }) {
  const [customDate, setCustomDate] = useState("");
  const options = [
    { label: "Demain", date: addDaysISO(1) },
    { label: "Dans 2 jours", date: addDaysISO(2) },
    { label: "Dans une semaine", date: addDaysISO(7) },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>Reporter « {task.title} »</h3>
      <div className="flex flex-col gap-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => onSave(opt.date)}
            className="w-full text-left px-3 py-2.5 rounded-md text-sm font-medium"
            style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
          >
            {opt.label} <span style={{ color: C.textGhost }}>· {formatDateFr(opt.date)}</span>
          </button>
        ))}
      </div>
      <div>
        <div className="text-xs mb-2" style={{ color: C.textDim }}>Le...</div>
        <div className="flex gap-2">
          <input
            type="date"
            value={customDate}
            min={todayISODate()}
            onChange={(e) => setCustomDate(e.target.value)}
            className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
            style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
          />
          <button
            disabled={!customDate}
            onClick={() => onSave(customDate)}
            className="px-3 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
            style={{ background: C.accent, color: C.bg }}
          >
            Reporter
          </button>
        </div>
      </div>
      {onToggleToday && (
        <button onClick={onToggleToday} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
          <span className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0" style={{ borderColor: task.inToday ? C.accent : C.borderStrong, background: task.inToday ? C.accent : "transparent" }}>
            {task.inToday && <Check size={12} color={C.bg} strokeWidth={3} />}
          </span>
          Retirer d'aujourd'hui
        </button>
      )}
      <button onClick={onCancel} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Annuler
      </button>
    </div>
  );
}

export default SlyTodo;
