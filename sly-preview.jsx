import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Clock, Check, X, Pencil,
  Star, StarOff, Calendar, Loader2, Volume2, VolumeX, Coffee, Sparkles,
  CalendarClock, Repeat, Flag, CalendarDays, Leaf, CloudOff, StickyNote,
  ChevronLeft, ChevronRight, CalendarRange, Heart, Ban, Bell, BellOff, Search,
  Download, Upload, Home, MoreHorizontal, Target, Zap, ListChecks,
  BarChart2, Settings2, BookOpen, Settings, Flame, Eye, EyeOff, Timer
} from "lucide-react";

if (typeof window !== "undefined" && !window.storage) {
  const __mem = {}; let __ls = null;
  try { __ls = window.localStorage; window.localStorage.setItem("__t","1"); window.localStorage.removeItem("__t"); } catch (e) { __ls = null; }
  window.storage = { get: async (k)=>{const v=__ls?__ls.getItem(k):__mem[k];return v!=null?{key:k,value:v}:null;}, set: async (k,v)=>{if(__ls)__ls.setItem(k,v);else __mem[k]=v;return true;}, delete: async (k)=>{if(__ls)__ls.removeItem(k);else delete __mem[k];return true;}, list: async ()=>({keys:[]}) };
}

const STORAGE_KEY = "sly-todo-data";
const APP_VERSION = "2026.07.29-06";

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
    onAccent: "#0E1014",
  },
  cosmos: {
    bg: "#0B0810", surface: "#1A1424", surfaceRaised: "#211934",
    border: "#3D3150", borderStrong: "#4A3F5C",
    text: "#FFFFFF", textDim: "#E4E0F0", textFaint: "#B8B2CC", textGhost: "#9089A0",
    accent: "#8B5CF6", accentLight: "#C4B5FD", accentGlow: "#C084FC", danger: "#E11D48",
    onAccent: "#0B0810",
  },
  jardin: {
    bg: "#FAEDF5", surface: "#FFF8FC", surfaceRaised: "#FDEFF7",
    border: "#F0D3E4", borderStrong: "#E6BCD5",
    text: "#3B1E2E", textDim: "#5C3348", textFaint: "#8A5C74", textGhost: "#B08199",
    accent: "#C9589C", accentLight: "#E8A6D0", accentGlow: "#D97BB4", danger: "#D6336C",
    onAccent: "#FFFFFF",
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
  return localISODate(new Date());
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISODate(d);
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
  { id: "motivation",   label: "Motivation",      emoji: "🔥" },
  { id: "nature",       label: "Nature",           emoji: "🌿" },
  { id: "spiritualite", label: "Spiritualité",     emoji: "🕊️" },
  { id: "invisible",    label: "Monde invisible",  emoji: "✨" },
  { id: "philosophie",  label: "Philosophie",      emoji: "📖" },
  { id: "douceur",      label: "Douceur",          emoji: "🤍" },
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
    "Nous souffrons plus en imagination qu'en réalité.",
    "Ce qui dépend de toi, fais-le. Le reste, accepte-le.",
    "L'obstacle est le chemin.",
    "Vivre, c'est choisir. Et choisir, c'est renoncer.",
    "La vie non examinée ne vaut pas la peine d'être vécue.",
    "Deviens ce que tu es.",
    "Le bonheur n'est pas un but, mais une manière de voyager.",
    "Il faut imaginer Sisyphe heureux. — Camus",
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
  const list = PHRASES_BY_ENV[envId] || PHRASES_BY_ENV.douceur;
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
  const isEvent = t.kind === "event";
  const overdue = !isEvent && t.dueDate && t.dueDate < today && !t.done;
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
        <span className="text-[10px] flex items-center gap-1" style={{ color: overdue ? C.danger : dueSoonToday ? C.accentGlow : C.textDim }}>
          <Flag size={10} /> {overdue ? "en retard · " : ""}échéance {relativeDateLabel(t.dueDate)}
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
  { symbol: "🌿 Énergie", label: "Carte Énergie", desc: "Sommeil, hydratation, nutrition, activité, silence, humeur et poids — chaque dimension notée rapporte des points." },
  { symbol: "📅 Agenda", label: "Carte Agenda", desc: "Tes événements et tâches datées, en liste ou en calendrier." },
  { symbol: "🎯 Défis", label: "Carte Défis", desc: "Tes petits défis du jour. +5 pts même sans défi si tu renseignes la carte." },
  { symbol: "🔥", label: "Série", desc: "Nombre de jours consécutifs où tu as été actif. Ton record est gardé." },
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
          { id: "priorities", label: "Tâches",      Icon: ListChecks },
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
          { id: "stats",    label: "Stats",          Icon: BarChart2 },
          { id: "settings", label: "Réglages",        Icon: Settings },
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

function computeGlobalProgress(tasksDone, tasksTotal, ritualsDone, ritualsTotal, defiDone, defiTotal) {
  const dw = defiTotal > 0 ? 2 : 0;
  const total = tasksTotal + ritualsTotal + dw;
  if (total === 0) return { pct: 0 };
  const dp = defiTotal > 0 ? (defiDone >= defiTotal ? 2 : defiDone > 0 ? 1 : 0) : 0;
  return { pct: Math.round(((tasksDone + ritualsDone + dp) / total) * 100) };
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
  dailyDefi, defiLibrary, wbCounts, streakDays, streakRecord,
  themes, todayTasks, pulseId, totalPoints, dailyPoints,
  onToggleDone, onRemove, onMove, onEdit, onStartFocus, onCheckDefi,
  onMarkDone, onCancelTask, onAddToToday, onDeleteTask,
  onGoAgenda, onGoTasks, onGoChecklist, onGoResources, onGoSettings, onGoRituels, onGoDefi, onGoStats, onGoWellness,
  hasSelfCareTask, onAddSelfCare, totalMinutes, eventsToday, eventsList,
  wellnessToday, onLogWellness, onOpenNotifs, profile, weightLogs, onShowPointsDetail, onGoCoffre, coffreBalance,
}) {
  const today = todayISODate();
  const wellbeingIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));
  const defiChecks = dailyDefi?.date === today ? (dailyDefi.checks || {}) : {};
  const defiSelected = (dailyDefi?.date === today ? dailyDefi.selectedIds || [] : []).map((id) => defiLibrary.find((d) => d.id === id)).filter(Boolean);
  const defiDoneCount = defiSelected.filter((d) => (defiChecks[d.id] || 0) > 0).length;
  const defiTotal = defiSelected.length;
  const defiPresence = dailyDefi?.date === today && dailyDefi?.presence;
  // La carte Défis clignote en permanence si aucun défi n'est prévu ET "pas de défi" pas encore noté
  const defiBlink = defiTotal === 0 && !defiPresence;
  const tasksDone = regularTodayTasks.filter((t) => t.done).length;
  const tasksTotal = regularTodayTasks.filter((t) => !t.cancelled).length;
  const tasksLeft = tasksTotal - tasksDone;
  const { pct: globalPct } = computeGlobalProgress(tasksDone, tasksTotal, wellbeingDoneCount, wellbeingTotalCount, defiDoneCount, defiTotal);
  const nbEvents = eventsToday || 0;
  // Nombre de dimensions Énergie renseignées aujourd'hui (8 dimensions + poids = 9)
  const energieNoted = (() => {
    const wt = wellnessToday || {};
    let n = Object.keys(wt).filter((k) => k.startsWith("_pts_")).length;
    const today = todayISODate();
    if ((weightLogs || []).some((w) => w.date === today)) n += 1;
    return n;
  })();
  // Événements pas encore passés (selon l'heure courante)
  const nowHM = (() => { const d = new Date(); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; })();
  const eventsLeft = (eventsList || []).filter((e) => !e.time || e.time >= nowHM).length;
  const todayPts = dailyPoints?.[today] || 0;
  // Commentaire fun et contextuel selon les points du jour
  const pointsComment = (() => {
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const yesterdayPts = dailyPoints?.[yd.toISOString().slice(0, 10)] || 0;
    if (todayPts === 0) return "La journée commence — à toi de jouer ! 🚀";
    if (yesterdayPts > 0 && todayPts > yesterdayPts) return `🔥 Tu fais mieux qu'hier (${yesterdayPts} pts) !`;
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
  const BigCard = ({ onClick, accent, bgFrom, Icon, title, subtitle, count, done, total, ptsPossible, footer, blink }) => {
    // Clignote en orange si non complété passé 18h (ou clignotement forcé, ex. défis)
    const nowH = new Date().getHours();
    const incomplete = total != null ? (done < total) : true;
    const shouldBlink = blink === true || (blink !== false && incomplete && nowH >= 18);
    const ringColor = shouldBlink ? "#F59E0B" : accent;
    return (
    <button onClick={onClick}
      className="rounded-3xl p-4 flex flex-col active:scale-[0.98] transition-transform text-left"
      style={{ background: `linear-gradient(150deg, ${accent}1F, ${C.surface})`, border: `1px solid ${accent}44`, minHeight: 168 }}>
      <div className="flex items-start justify-between mb-3">
        <div className="rounded-2xl flex items-center justify-center" style={{ width: 52, height: 52, background: accent + "26" }}>
          <Icon size={26} style={{ color: accent }} strokeWidth={2} />
        </div>
        <div className="relative flex items-center justify-center" style={{ width: 44, height: 44 }}>
          {shouldBlink && (
            <div style={{ position: "absolute", width: 38, height: 38, borderRadius: "50%", background: "#F59E0B", animation: "tdBlink 1.1s ease-in-out infinite" }} />
          )}
          <svg width="44" height="44" viewBox="0 0 44 44" style={{ position: "absolute" }}>
            <circle cx="22" cy="22" r="19" fill="none" stroke={accent + "33"} strokeWidth="3.5" />
            <circle cx="22" cy="22" r="19" fill="none" stroke={ringColor} strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 19}
              strokeDashoffset={2 * Math.PI * 19 * (1 - (total > 0 ? done / total : 0))}
              transform="rotate(-90 22 22)"
              style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
          </svg>
          <span className="font-black relative" style={{ color: shouldBlink ? "#0B0810" : accent, fontSize: 16 }}>{count}</span>
        </div>
      </div>
      <div className="font-black uppercase tracking-wide leading-tight" style={{ fontSize: 17, color: C.text }}>{title}</div>
      <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{subtitle}</div>
      <div className="mt-auto pt-3">
        {total != null && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 7, background: C.bg }}>
              <div className="h-full rounded-full" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%`, background: accent, transition: "width 0.5s" }} />
            </div>
            <span className="text-xs font-bold" style={{ color: C.text }}>{done} / {total}</span>
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
      <div className="w-full rounded-3xl p-4"
        style={{ background: `linear-gradient(150deg, ${C.surfaceRaised}, ${C.surface})`, border: `1px solid ${C.border}` }}>
        <button onClick={onGoStats} className="w-full text-left active:scale-[0.99] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.textGhost }}>Ma journée</div>
            <div className="flex items-baseline gap-1">
              <span className="font-black leading-none" style={{ fontSize: 32, color: globalPct >= 100 ? "#22C55E" : C.text }}>{globalPct}</span>
              <span className="text-lg font-bold" style={{ color: C.textDim }}>%</span>
            </div>
          </div>
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
        </button>
        {/* Accès au Coffre à récompenses */}
        <button onClick={() => onGoCoffre && onGoCoffre()}
          className="w-full flex items-center gap-3 mt-3 pt-3 active:scale-[0.99] transition-transform" style={{ borderTop: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 22 }}>🧰</span>
          <div className="flex-1 text-left">
            <div className="text-xs font-bold" style={{ color: "#F59E0B" }}>Mon coffre · {coffreBalance || 0} pts à dépenser</div>
            <div className="text-[10px]" style={{ color: C.textGhost }}>Offre-toi une récompense</div>
          </div>
          <ChevronRight size={16} style={{ color: "#F59E0B" }} />
        </button>
      </div>

      {/* ── Grille 2×2 des grandes cartes ── */}
      <div className="grid grid-cols-2 gap-3">
        <BigCard onClick={onGoTasks} accent={profile?.accentColor || "#A855F7"} bgFrom="#1E1240" Icon={ListChecks}
          title="Actions" subtitle="Tâches à accomplir" count={tasksLeft}
          done={tasksDone} total={tasksTotal}
          footer={tasksPtsPossible > 0 ? `+${tasksPtsPossible} pts possibles` : "Tout est fait ✓"} />
        <BigCard onClick={onGoRituels} accent="#22C55E" bgFrom="#0F2A1A" Icon={Leaf}
          title="Énergie" subtitle="Prends soin de toi" count={energieNoted}
          done={energieNoted} total={7}
          footer={streakDays > 0 ? `🔥 ${streakDays} jour${streakDays > 1 ? "s" : ""} d'affilée` : `${energieNoted}/7 notés`} />
        <BigCard onClick={onGoAgenda} accent="#38BDF8" bgFrom="#0C2136" Icon={CalendarDays}
          title="Agenda" subtitle="Du jour" count={eventsLeft}
          done={nbEvents - eventsLeft} total={nbEvents}
          footer={nbEvents === 0 ? "Rien de prévu" : eventsLeft === 0 ? "Tous passés ✓" : `Encore ${eventsLeft} !`} />
        <BigCard onClick={onGoDefi} accent="#F59E0B" bgFrom="#2E1E00" Icon={Target}
          title="Défis" subtitle="Relève le challenge" count={defiTotal - defiDoneCount}
          done={defiDoneCount} total={defiTotal} blink={defiBlink || undefined}
          footer={defisPtsPossible > 0 ? `+${defisPtsPossible} pts possibles` : defiTotal === 0 ? "Choisir un défi" : "Relevé 🎉"} />
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

  // Ces useMemo doivent être AVANT tout early return (règle des hooks React).
  // Quand data est null (chargement), on renvoie des tableaux vides.
  const tasks = useMemo(() => data?.tasks || [], [data]);
  const themes = useMemo(() => data?.themes || [], [data]);
  const todayTasks = useMemo(() => tasks.filter((t) => t.inToday).sort((a, b) => a.order - b.order), [tasks]);
  const wellbeingThemeIds = useMemo(() => new Set(themes.filter((th) => th.wellbeing).map((th) => th.id)), [themes]);
  const regularTodayTasks = useMemo(() => todayTasks.filter((t) => !wellbeingThemeIds.has(t.themeId) && !t.cancelled), [todayTasks, wellbeingThemeIds]);

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
    setData(next);
    pendingRef.current = next;
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
        if (t.startDate === tomorrow && !t.notifiedEve) {
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
      dailyPoints: {}, totalPoints: 0,
      streakDays: 0, streakRecord: 0, streakLastDate: null, books: [], wellnessLog: {}, weightLogs: [], physActivities: DEFAULT_ACTIVITIES, espritItems: DEFAULT_ESPRIT, activityStreaks: {},
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
        if (t.done && !t.recurrence && t.inToday && t.kind !== "event") {
          const doneDay = (t.lastDoneDate) || (t.completedAt ? t.completedAt.slice(0, 10) : null);
          if (doneDay && doneDay < today) {
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
        if (t.kind === "event" && !t.done && !t.cancelled) {
          const windowEnd = t.endDate || t.startDate;
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
        return t;
      }),
    };
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

  const { settings, equipment, equipmentRubriques, checklists, defiLibrary, dailyDefi, dailyPoints, totalPoints, streakDays, streakRecord, streakLastDate, books, wellnessLog, profile, notebooks, weightLogs, physActivities, espritItems } = data;
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
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.order || 0), 0);
    const today = todayISODate();
    const windowEnd = fields.endDate || fields.startDate;
    const autoToday = !!(fields.startDate && fields.startDate <= today && today <= windowEnd);
    persist({
      ...data,
      tasks: [
        ...tasks,
        {
          id: "tk-" + uid(),
          themeId: fields.themeId,
          title: fields.title,
          kind: fields.kind || "task",
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
        },
      ],
    });
  };

  const editTask = (id, patch) => persist({ ...data, tasks: tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
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
    if (!t.inToday) {
      const maxOrder = tasks.reduce((m, x) => Math.max(m, x.order || 0), 0);
      editTask(id, { inToday: true, order: maxOrder + 1 });
    } else {
      editTask(id, { inToday: false });
    }
  };

  const toggleDone = (id, focusDelta = null) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    const isWb = wellbeingThemeIds.has(t.themeId);
    const willBeDone = !t.done;
    const patch = { done: willBeDone, completedAt: willBeDone ? new Date().toISOString() : null };
    if (willBeDone && focusDelta !== null) patch.focusDelta = Math.round(focusDelta);
    else if (!willBeDone) patch.focusDelta = null;
    if (t.recurrence) patch.lastDoneDate = willBeDone ? todayISODate() : null;
    const today = todayISODate();
    const pts = willBeDone && !isWb ? pointsForTask({ ...t, done: true }) : willBeDone && isWb ? pointsForRitual() : 0;
    const prevDay = dailyPoints[today] || 0;
    const newDailyPoints = { ...dailyPoints, [today]: Math.max(0, prevDay + (willBeDone ? pts : -pts)) };
    const newTotal = Math.max(0, (totalPoints || 0) + (willBeDone ? pts : -pts));
    // Streak : se met à jour quand la première tâche est cochée dans la journée
    let newStreak = streakDays || 0;
    let newRecord = streakRecord || 0;
    let newStreakDate = streakLastDate;
    if (willBeDone && streakLastDate !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().slice(0, 10);
      newStreak = (streakLastDate === yd) ? newStreak + 1 : 1;
      newRecord = Math.max(newRecord, newStreak);
      newStreakDate = today;
    }
    persist({ ...data, tasks: tasks.map((x) => x.id === id ? { ...x, ...patch } : x), dailyPoints: newDailyPoints, totalPoints: newTotal, streakDays: newStreak, streakRecord: newRecord, streakLastDate: newStreakDate });
    if (willBeDone && pts > 0) setGemReward({ points: pts, key: Date.now() });
    if (willBeDone && soundEnabled) {
      const stillTodo = todayTasks.filter((x) => x.id !== id && !x.done).length;
      if (stillTodo === 0 && t.inToday) sound.bigSuccess();
      else sound.taskComplete();
      setPulseId(id);
      setTimeout(() => setPulseId(null), 450);
    }
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
  const updateChecklists = (fn) => persist({ ...data, checklists: fn(checklists || []) });
  const addChecklist = (name, emoji, isTemplate) => {
    const cl = { id: "cl-" + uid(), name: name || "Nouvelle liste", emoji: emoji || "📋", isTemplate: !!isTemplate,
      rubriques: [{ id: "rub-" + uid(), label: "Général" }], items: [] };
    updateChecklists((cls) => [...cls, cl]);
    return cl.id;
  };
  const renameChecklist = (clId, name, emoji) =>
    updateChecklists((cls) => cls.map((c) => c.id === clId ? { ...c, name: name ?? c.name, emoji: emoji ?? c.emoji } : c));
  const deleteChecklist = (clId) => updateChecklists((cls) => cls.filter((c) => c.id !== clId));
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
    const { streaks, bonus } = bumpDefiStreak(data.activityStreaks || {});
    const prevDay = (dailyPoints || {})[t] || 0;
    const gain = 5 + bonus;
    persist({
      ...data,
      dailyDefi: { ...cur, presence: true },
      activityStreaks: streaks,
      dailyPoints: { ...(dailyPoints || {}), [t]: prevDay + gain },
      totalPoints: (totalPoints || 0) + gain,
    });
    setGemReward({ points: gain, key: Date.now() });
  };
  const logWellness = (key, value) => {
    const t = todayISODate();
    const dayLog = (wellnessLog || {})[t] || {};
    // Les clés "_pts_xxx" portent le montant de points de la dimension.
    // On crédite le DELTA par rapport à ce qui a déjà été accordé aujourd'hui
    // (permet de recalculer l'hydratation sans double compter).
    let delta = 0;
    if (key.startsWith("_pts_")) {
      const already = dayLog[key] || 0;
      const target = typeof value === "number" ? value : 5;
      delta = target - already;
      value = target;
    }
    const newLog = { ...dayLog, [key]: value };
    const newData = { ...data, wellnessLog: { ...(wellnessLog || {}), [t]: newLog } };
    if (delta !== 0) {
      const prevDay = (dailyPoints || {})[t] || 0;
      newData.dailyPoints = { ...(dailyPoints || {}), [t]: Math.max(0, prevDay + delta) };
      newData.totalPoints = Math.max(0, (totalPoints || 0) + delta);
    }

    // ── Série hydratation : un jour est validé à partir de 6 verres ──
    if (key === "water") {
      const HYDRA_GOAL = 6;
      const prevWater = dayLog.water || 0;
      const wasReached = prevWater >= HYDRA_GOAL;
      const nowReached = value >= HYDRA_GOAL;
      if (wasReached !== nowReached) {
        const streaks = { ...(newData.activityStreaks || data.activityStreaks || {}) };
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
          const pd = (newData.dailyPoints || dailyPoints || {})[t] || 0;
          newData.dailyPoints = { ...(newData.dailyPoints || dailyPoints || {}), [t]: Math.max(0, pd + bonus) };
          newData.totalPoints = Math.max(0, (newData.totalPoints ?? totalPoints ?? 0) + bonus);
        }
      }
    }

    persist(newData);
    if (delta > 0) setGemReward({ points: delta, key: Date.now() });
  };
  // Pesée : +10 pts par 100 g perdus depuis la dernière pesée
  const logWeight = (value, previous) => {
    const t = todayISODate();
    const entry = { date: t, value };
    const newLogs = [...(weightLogs || []).filter((w) => w.date !== t), entry].sort((a, b) => a.date.localeCompare(b.date));
    let pts = 0;
    if (previous != null && value < previous) {
      const grams = Math.round((previous - value) * 1000);
      pts = Math.floor(grams / 100) * 10;
    }
    const newData = { ...data, weightLogs: newLogs };
    if (pts > 0) {
      const prevDay = (dailyPoints || {})[t] || 0;
      newData.dailyPoints = { ...(dailyPoints || {}), [t]: prevDay + pts };
      newData.totalPoints = (totalPoints || 0) + pts;
    }
    persist(newData);
    if (pts > 0) setGemReward({ points: pts, key: Date.now() });
  };
  // Activité physique / Esprit : cocher un item crédite ses points (incrémentable = cumul)
  const logActivity = (dimId, itemId, pts, delta) => {
    const t = todayISODate();
    const dayLog = (wellnessLog || {})[t] || {};
    const logKey = dimId === "silence" ? "espritLog" : "activities";
    const ptsKey = dimId === "silence" ? "_pts_esprit" : "_pts_activite";
    const itemLog = dayLog[logKey] || {};
    const streaks = { ...(data.activityStreaks || {}) };
    const yd = addDaysISO(-1);

    const wasActiveToday = (itemLog[itemId] || 0) > 0; // déjà fait aujourd'hui ?
    let gained;
    let newItemLog;
    let willBeActive;

    if (delta === "set" || delta === "unset") {
      const prevVal = itemLog[itemId] || 0;
      if (delta === "unset") { gained = -prevVal; newItemLog = { ...itemLog, [itemId]: 0 }; willBeActive = false; }
      else { gained = pts - prevVal; newItemLog = { ...itemLog, [itemId]: pts }; willBeActive = true; }
    } else {
      const newCount = (itemLog[itemId] || 0) + delta;
      newItemLog = { ...itemLog, [itemId]: newCount };
      gained = pts * delta;
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

    const newLog = { ...dayLog, [logKey]: newItemLog, [ptsKey]: 1 };
    const prevDay = (dailyPoints || {})[t] || 0;
    persist({
      ...data,
      wellnessLog: { ...(wellnessLog || {}), [t]: newLog },
      activityStreaks: streaks,
      dailyPoints: { ...(dailyPoints || {}), [t]: Math.max(0, prevDay + gained) },
      totalPoints: Math.max(0, (totalPoints || 0) + gained),
    });
    if (gained > 0) setGemReward({ points: gained, key: Date.now() });
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
          defiStreak={(data.activityStreaks || {})["__defi__"]}
          onClose={() => setShowDefiReview(false)}
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
        .feerique-bg {
          background-color: #14161C;
          background-image:
            radial-gradient(circle at 18% 6%, rgba(120,160,220,0.10), transparent 32%),
            radial-gradient(ellipse at top, #1c2029 0%, #14161C 58%);
        }
        .feerique-bg.theme-cosmos {
          background-color: #0B0810;
          background-image:
            radial-gradient(circle at 18% 6%, rgba(196,181,253,0.14), transparent 32%),
            radial-gradient(circle at 88% 12%, rgba(232,121,249,0.10), transparent 38%),
            radial-gradient(ellipse at top, #1d1430 0%, #0B0810 58%);
        }
        .feerique-bg.theme-jardin {
          background-color: #FAEDF5;
          background-image:
            radial-gradient(circle at 18% 6%, rgba(201,88,156,0.10), transparent 34%),
            radial-gradient(circle at 88% 12%, rgba(232,166,208,0.14), transparent 40%),
            radial-gradient(ellipse at top, #FFF4FA 0%, #FAEDF5 60%);
        }
        .feerique-bg.theme-jardin::before { display: none; }
        .feerique-bg::before {
          content: "";
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          opacity: 0.45;
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
        @keyframes tdBlink {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.85; }
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
            <button onClick={() => setModal({ type: "info" })} style={{ color: C.textFaint }} aria-label="Guide des symboles" className="p-1.5">
              <span style={{ fontSize: 17, lineHeight: 1 }}>ℹ️</span>
            </button>
            <button
              onClick={() => {
                if (typeof Notification === "undefined") return;
                if (Notification.permission === "default") {
                  Notification.requestPermission().then((p) => setNotifPermission(p));
                } else {
                  setNotifPermission(Notification.permission);
                }
              }}
              title={notifPermission === "granted" ? "Notifications activées" : "Activer les notifications"}
              style={{ color: notifPermission === "granted" ? C.accentLight : C.textFaint }}
            >
              {notifPermission === "granted" ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; }}
            />
            <button onClick={toggleSound} style={{ color: soundEnabled ? C.accentLight : C.textFaint }}>
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
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
            <TopSubTabs tab={tab} onTabChange={(id) => { setTab(id); setOpenTheme(null); }}/>
            {tab === "today" && (
              <TodayDashboard
                greeting={greeting(profile?.name, profile?.gender)}
                profile={profile}
                regularTodayTasks={regularTodayTasks}
                regularDoneCount={regularDoneCount}
                regularPercent={regularPercent}
                wellbeingDoneCount={wellbeingDoneCount}
                wellbeingTotalCount={wellbeingTotalCount}
                wellbeingPercent={wellbeingPercent}
                dailyDefi={dailyDefi}
                defiLibrary={defiLibrary}
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

                {/* Ligne 2 : urgence */}
                <div className="px-5 pt-2 flex gap-2">
                  <button onClick={() => setUrgencyFilter(null)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-bold active:scale-95 transition-transform"
                    style={{ background: urgencyFilter === null ? C.accent : C.surface,
                      color: urgencyFilter === null ? C.bg : C.textDim,
                      border: `1px solid ${urgencyFilter === null ? C.accent : C.border}` }}>
                    Toutes urgences
                  </button>
                  <button onClick={() => setUrgencyFilter((u) => u === null ? 3 : u === 3 ? 2 : u === 2 ? 1 : null)}
                    className="flex-1 py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ background: urgencyFilter ? URGENCY_COLORS[urgencyFilter] : C.surface,
                      color: urgencyFilter ? "#0B0810" : C.textDim,
                      border: `1px solid ${urgencyFilter ? URGENCY_COLORS[urgencyFilter] : C.border}` }}>
                    {urgencyFilter === null ? "Choisir…" : urgencyFilter === 3 ? "🔴 Urgent" : urgencyFilter === 2 ? "🟠 Normal" : "🟢 Tranquille"}
                  </button>
                </div>

                {/* Ligne 3 : par date — un seul bouton qui cycle */}
                <div className="px-5 pt-2">
                  {(() => {
                    const opts = {
                      all:     { label: "📋 Toutes les tâches",  col: C.accent },
                      datees:  { label: "📅 Tâches datées",      col: "#F59E0B" },
                      undated: { label: "🗓️ Tâches non datées",  col: "#A78BFA" },
                    };
                    const order = ["all", "datees", "undated"];
                    const cur = opts[scopeFilter] || opts.all;
                    return (
                      <button onClick={() => setScopeFilter((s) => order[(order.indexOf(s) + 1) % order.length])}
                        className="w-full py-2.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        style={{ background: cur.col, color: "#0B0810", border: `1px solid ${cur.col}` }}>
                        {cur.label} <ChevronDown size={14} />
                      </button>
                    );
                  })()}
                </div>

                <TodayView
                  tasks={(() => {
                    // Les tâches de checklist n'ont pas de date → visibles en "non datées" et "toutes"
                    const base = scopeFilter === "datees" ? tasks : [...tasks, ...checklistTasks];
                    let list;
                    if (scopeFilter === "datees") {
                      list = base.filter((t) => !t.cancelled && (t.dueDate || t.startDate));
                    } else if (scopeFilter === "undated") {
                      list = base.filter((t) => !t.cancelled && !t.dueDate && !t.startDate);
                    } else {
                      list = base.filter((t) => !t.cancelled);
                    }
                    if (missionFilter) list = list.filter((t) => t.themeId === missionFilter);
                    if (urgencyFilter) list = list.filter((t) => (t.urgency || 2) === urgencyFilter);
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
                  onMove={moveToday}
                  onEdit={(t) => { if (t._cl) { setTab("equipment"); setOpenChecklistId(t._cl.clId); } else { setModal({ type: "taskActions", payload: t }); } }}
                  onGoThemes={() => setTab("themes")}
                  onStartFocus={(t) => setFocusTask(t)}
                  dateMode={scopeFilter === "datees" || scopeFilter === "all"}
                  priorityTaskId={regularTodayTasks.filter((t) => !t.done).sort((a,b) => (b.urgency||2)-(a.urgency||2))[0]?.id}
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
                    onAddRubrique={(label) => addChecklistRubrique(openCl.id, label)}
                    onRenameRubrique={(rubId, label) => renameChecklistRubrique(openCl.id, rubId, label)}
                    onDeleteRubrique={(rubId) => deleteChecklistRubrique(openCl.id, rubId)}
                    onRename={(name) => renameChecklist(openCl.id, name)}
                    onDeleteChecklist={() => { if (confirm("Supprimer cette checklist ?")) { deleteChecklist(openCl.id); setOpenChecklistId(null); } }}
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
          />
        )}

        {tab === "history" && <HistoryView tasks={tasks} themes={themes} />}
        {tab === "stats" && <StatsView data={data} tasks={tasks} themes={themes} />}
        {tab === "settings" && (
          <SettingsView
            settings={settings} data={data} persist={persist} themes={themes}
            openTheme={openTheme} setOpenTheme={setOpenTheme}
            exportData={exportData} fileInputRef={fileInputRef} importData={importData}
            onSetLock={() => setShowSetLock(true)}
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
              onPostpone={() => setModal({ type: "postpone", payload: modal.payload })}
              onEdit={() => setModal({ type: "editTask", payload: modal.payload })}
              onToggleCancel={() => { toggleCancelled(modal.payload.id); setModal(null); }}
              onToggleToday={() => { toggleToday(modal.payload.id); setModal(null); }}
              onClose={() => setModal(null)}
            />
          )}
          {modal.type === "addTheme" && (
            <ThemeForm onCancel={() => setModal(null)} onSave={(name, color) => { addTheme(name, color); setModal(null); }} />
          )}
          {modal.type === "editTheme" && (
            <ThemeForm initial={modal.payload} onCancel={() => setModal(null)} onSave={(name, color) => { editTheme(modal.payload.id, name, color); setModal(null); }} />
          )}
          {modal.type === "addTask" && (
            <TaskForm
              themes={themes}
              initial={{ themeId: modal.payload.themeId }}
              onCancel={() => setModal(null)}
              onSave={(fields) => { addTask(fields); setModal(null); }}
            />
          )}
          {modal.type === "editTask" && (
            <TaskForm
              themes={themes}
              initial={modal.payload}
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

function DefiReviewModal({ dailyDefi, defiLibrary, onCheck, onAddDefiToday, onAddDefi, onEditDefi, onDeleteDefi, onToggleActive, onMarkPresence, defiStreak, onClose }) {
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
                <div className="text-sm font-black" style={{ color: "#F59E0B" }}>🔥 {defiStreak.count}j</div>
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

          {/* Marqueur : pas de défi aujourd'hui (arrête le clignotement, +5 pts) */}
          {!presence ? (
            <button onClick={onMarkPresence} className="w-full py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.surfaceRaised, color: C.accentLight, border: `1px dashed ${C.accent}66` }}>
              Pas de défi pour moi aujourd'hui · +5 pts
            </button>
          ) : (
            <div className="w-full py-2 rounded-xl text-sm font-semibold text-center" style={{ background: "#22C55E22", color: "#22C55E" }}>
              ✓ Noté pour aujourd'hui
            </div>
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
  { id: "sommeil",     label: "Sommeil",           emoji: "😴", color: "#818CF8", type: "sleep" },
  { id: "hydratation", label: "Hydratation",       emoji: "💧", color: "#38BDF8", type: "water" },
  { id: "nutrition",   label: "Nutrition",         emoji: "🥗", color: "#34D399", type: "nutrition" },
  { id: "activite",    label: "Activité physique", emoji: "🏃", color: "#F97316", type: "activities" },
  { id: "silence",     label: "Silence",           emoji: "🧘", color: "#A78BFA", type: "activities" },
  { id: "humeur",      label: "Humeur",            emoji: "😊", color: "#F472B6", type: "scale3",
    scale: ["Maussade", "Neutre", "Radieux"] },
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
  { id: "nut-jeuneint",   name: "Jeûne intermittent",  points: 50 },
  { id: "nut-jeune",      name: "Jeûne",               points: 100 },
  { id: "nut-sanssucre",  name: "Sans sucre",          points: 50 },
];

// Éditeur des activités (créer / modifier / cacher / supprimer) — temps et/ou points
function ActivityEditor({ activities, color, onEdit }) {
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
              <span className="text-xs flex-1" style={{ color: C.textDim }}>1 à 30 min</span>
              <input type="number" value={lowPts} onChange={(e) => setLowPts(e.target.value)}
                className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none text-center"
                style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}` }} />
              <span className="text-[11px]" style={{ color: C.textGhost }}>pts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs flex-1" style={{ color: C.textDim }}>+ de 30 min</span>
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
function StreakGauge({ streak, color, max = 10 }) {
  const count = streak?.count || 0;
  if (count <= 0) return null;
  const active = streak?.lastDate === todayISODate() || streak?.lastDate === addDaysISO(-1);
  const filled = Math.min(count, max);
  const bonus = (count - 1) * 5;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <span className="text-[11px] font-bold" style={{ color: active ? color : C.textGhost }}>🔥 {count}j</span>
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
                        onLogWeight, onLogActivity, onEditActivities, onStartFocus, onClose }) {
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
          style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3 mb-1">
            <span style={{ fontSize: 28 }}>{dim.emoji}</span>
            <h3 className="font-display text-xl font-bold italic" style={{ color: C.text }}>{dim.label}</h3>
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
                  <span className="text-xs font-bold" style={{ color: "#38BDF8" }}>{water}/8 verres</span>
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <button key={i} onClick={() => onLog("water", i + 1 === water ? i : i + 1)}
                      className="flex-1 rounded-lg active:scale-90 transition-transform relative"
                      style={{ height: 32, background: i < water ? "#38BDF8" : C.surfaceRaised, border: `1px solid ${i < water ? "#38BDF8" : (i === 5 ? "#38BDF8aa" : C.border)}` }}>
                      {i === 5 && <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#38BDF8" }}>🎯</span>}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] mt-1.5" style={{ color: C.textGhost }}>Série validée à partir de 6 verres 🎯</div>
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
                  const waterPts = Math.round((Math.min(water, 8) / 8) * 20); // 8 verres = 20 pts
                  const alcoholPts = alcohol == null ? 0 : alcohol === 0 ? 20 : alcohol === 1 ? 5 : alcohol === 2 ? 2 : 0;
                  onLog("_pts_hydratation", waterPts + alcoholPts);
                  setOpenDim(null);
                }}
                className="w-full py-3 rounded-2xl text-sm font-bold" style={{ background: "#38BDF8", color: "#0B0810" }}>
                Enregistrer{(() => {
                  const wp = Math.round((Math.min(water, 8) / 8) * 20);
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
                          Pas aujourd'hui
                        </button>
                        {[["1 à 30 min", low], ["+ de 30 min", high]].map(([lbl, pts]) => (
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
                    style={{ background: count > 0 ? dim.color + "1A" : C.surfaceRaised, border: `1px solid ${count > 0 ? dim.color + "77" : C.border}` }}>
                    <button onClick={() => onLogActivity(dim.id, a.id, a.points || 5, count > 0 ? -count : 1)} className="flex-1 flex items-center gap-2 text-left">
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: count > 0 ? dim.color : C.borderStrong, background: count > 0 ? dim.color + "33" : "transparent" }}>
                        {count > 0 && <Check size={13} style={{ color: dim.color }} strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold" style={{ color: C.text }}>{a.name}</div>
                        <div className="text-[10px]" style={{ color: C.textGhost }}>
                          +{a.points || 5} pts{a.minutes ? ` · ${a.minutes} min` : ""}{count > 1 ? ` · ×${count}` : ""}{a.incrementable ? " · appuie sur + pour répéter" : ""}
                        </div>
                        <StreakGauge streak={activityStreaks?.[a.id]} color={dim.color} />
                      </div>
                    </button>
                    {a.incrementable && count > 0 && (
                      <button onClick={() => onLogActivity(dim.id, a.id, a.points || 5, 1)} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: dim.color + "22", color: dim.color }} title="Une fois de plus">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    )}
                    {onStartFocus && (
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
                <ActivityEditor activities={listForDim(dim.id)} color={dim.color} onEdit={(action, id, payload) => onEditActivities(dim.id, action, id, payload)} />
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
          <div className="w-full max-w-sm rounded-3xl p-5" style={{ background: C.surface, border: `1px solid ${C.borderStrong}` }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <span style={{ fontSize: 24 }}>⚖️</span>
              <h3 className="font-display text-lg font-bold italic" style={{ color: C.text }}>{alreadyToday ? "Modifier ma pesée" : "Ma pesée"}</h3>
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
          {streakDays > 0 && <span style={{ color: "#F59E0B" }}> · 🔥 {streakDays} jour{streakDays > 1 ? "s" : ""} d'affilée{streakRecord > streakDays ? ` (record ${streakRecord}j)` : ""}</span>}
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
        <div style={{ fontSize: 40 }}>🧰</div>
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

function SettingsView({ settings, data, persist, themes, openTheme, setOpenTheme, exportData, fileInputRef, importData, onSetLock, onOk, onCancel }) {
  const soundSettings = settings?.sound || SOUND_DEFAULT_SETTINGS;
  const prof = data.profile || {};
  const setProfile = (patch) => persist({ ...data, profile: { ...prof, ...patch } });
  return (
    <div className="px-5 pt-5 pb-6 space-y-6">
      <h2 className="font-display text-xl font-bold italic" style={{ color: C.text }}>Réglages</h2>

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
            { id: "jardin", label: "Jardin", emoji: "🌸", desc: "Clair & rosé", swatch: ["#FFF8FC", "#C9589C", "#E8A6D0"] },
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
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>🎨 Dossiers</div>
        <div className="space-y-2">
          {themes.map((th) => (
            <div key={th.id} className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              <div className="w-4 h-4 rounded-full shrink-0" style={{ background: th.color }}/>
              <span className="text-sm flex-1" style={{ color: C.text }}>{th.name}</span>
              <button onClick={() => setOpenTheme(th)} className="text-xs" style={{ color: C.textGhost }}>Modifier</button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.textGhost }}>📊 Stats</div>
        <div className="rounded-xl px-4 py-4 space-y-2" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex justify-between text-sm"><span style={{ color: C.textDim }}>Points totaux</span><span className="font-bold" style={{ color: C.accentLight }}>{data.totalPoints || 0}</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: C.textDim }}>Série actuelle</span><span className="font-bold" style={{ color: "#F59E0B" }}>🔥 {data.streakDays||0} jours</span></div>
          <div className="flex justify-between text-sm"><span style={{ color: C.textDim }}>Record</span><span className="font-bold" style={{ color: "#F59E0B" }}>🏆 {data.streakRecord||0} jours</span></div>
        </div>
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

function TodayView({ tasks, themes, pulseId, onToggleDone, onRemove, onMove, onEdit, onGoThemes, onStartFocus, dateMode, priorityTaskId }) {
  const [showNext, setShowNext] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const events = tasks.filter((t) => t.kind === "event");
  const regularTasks = tasks.filter((t) => t.kind !== "event");

  const renderRow = (t, i, list) => {
    const theme = themes.find((th) => th.id === t.themeId);
    const isWellbeing = theme?.wellbeing;
    const isEvent = t.kind === "event";
    const canFocus = !t.done && !t.cancelled && !isEvent;
    return (
      <div
        key={t.id}
        className={`rounded-lg px-3 py-3 flex items-center gap-3 ${pulseId === t.id ? "pulse-done" : ""}`}
        style={{ background: isEvent ? (theme?.color || C.accent) + "12" : isWellbeing ? theme.color + "14" : C.surface, border: `1px solid ${isEvent ? (theme?.color || C.accent) + "40" : isWellbeing ? theme.color + "40" : C.border}` }}
      >
        {isEvent ? (
          <div className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: (theme?.color || C.accent) + "22" }}>
            <CalendarDays size={14} style={{ color: theme?.color || C.accent }} />
          </div>
        ) : (
          <button onClick={() => onToggleDone(t.id)} className="shrink-0">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center border-2"
              style={{ borderColor: t.done ? C.accent : C.borderStrong, background: t.done ? C.accent : "transparent" }}
            >
              {t.done && <Check size={13} color={C.bg} strokeWidth={3} />}
            </div>
          </button>
        )}

        <div className="flex-1 min-w-0" onClick={() => onEdit(t)}>
          <div className="flex items-center gap-2 mb-0.5">
            {!t.done && !t.cancelled && !isWellbeing && (
              <UrgencyDot urgency={t.urgency || 2} />
            )}
            <div className="text-base leading-snug font-medium flex-1 min-w-0" style={{ color: (t.done || t.cancelled) ? C.textGhost : C.text, textDecoration: (t.done || t.cancelled) ? "line-through" : "none" }}>
              {t.title}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TaskBadges t={t} theme={theme} showTheme={!isWellbeing} />
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

        {!t._cl && (
          <button onClick={() => onRemove(t.id)} className="shrink-0 p-1" style={{ color: C.textDim }} aria-label="Retirer d'aujourd'hui">
            <X size={16} />
          </button>
        )}
      </div>
    );
  };

  // Regroupe les items par date (dueDate ou startDate) pour le mode "datées"
  const anchorOf = (t) => t.dueDate || t.startDate || null;
  const todayISO = todayISODate();

  return (
    <div className="px-5 pt-5">
      {tasks.length === 0 && (
        <div className="text-center py-12" style={{ color: C.textDim }}>
          <p className="mb-4 text-sm">Rien de prévu pour l'instant.</p>
          <button onClick={onGoThemes} className="text-sm font-semibold px-4 py-2 rounded-md" style={{ background: C.accent, color: C.bg }}>
            Choisir des tâches
          </button>
        </div>
      )}

      {dateMode && tasks.length > 0 ? (() => {
        const dayTasks = regularTasks.filter((t) => taskCoversDate(t, todayISO) || t.inToday)
          .sort((a, b) => (b.urgency || 2) - (a.urgency || 2));
        const dayEvents = events.filter((t) => taskCoversDate(t, todayISO));
        const futureItems = tasks.filter((t) => { const a = anchorOf(t); return a && a > todayISO && !taskCoversDate(t, todayISO) && !t.inToday; })
          .sort((a, b) => (anchorOf(a) || "").localeCompare(anchorOf(b) || ""));
        const groups = {};
        futureItems.forEach((t) => { const a = anchorOf(t); (groups[a] = groups[a] || []).push(t); });
        const groupDates = Object.keys(groups).sort();
        // Tâches non datées (uniquement affichées en mode "toutes")
        const undated = tasks.filter((t) => !anchorOf(t) && !taskCoversDate(t, todayISO) && !t.inToday);
        const fmtDate = (iso) => { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }); };

        return (
          <>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.accentLight }}>
              📅 Tâches du jour
            </div>
            {dayTasks.length === 0 && dayEvents.length === 0 ? (
              <p className="text-sm mb-4" style={{ color: C.textGhost }}>Aucune tâche datée aujourd'hui.</p>
            ) : (
              <div className="space-y-2 mb-2">
                {dayTasks.map((t, i) => renderRow(t, i, dayTasks))}
                {dayEvents.map((t, i) => renderRow(t, i, dayEvents))}
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

            {undated.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: C.textFaint }}>
                  🗓️ Sans date
                </div>
                <div className="space-y-2">
                  {undated.map((t, i) => renderRow(t, i, undated))}
                </div>
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
  const itemsOn = (iso) => tasks.filter((t) => !t.done && !t.cancelled && (t.kind === "event" || t.dueDate || (t.startDate && t.endDate)) && (t.startDate || t.dueDate) && !wellbeingThemeIds.has(t.themeId) && taskCoversDate(t, iso));

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
              {fullMoon && <span style={{ position: "absolute", top: 1, right: 2, fontSize: 9 }} title="Pleine lune">🌕</span>}
              <span>{d}</span>
              {hasItems && <span className="w-1.5 h-1.5 rounded-full" style={{ background: overdue ? C.danger : "#F5C84C" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ tasks, themes, onEdit }) {
  const [viewMode, setViewMode] = useState("list");
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState(todayISODate());

  const wellbeingThemeIds = new Set(themes.filter((th) => th.wellbeing).map((th) => th.id));

  const renderItemRow = (t) => {
    const theme = themes.find((th) => th.id === t.themeId);
    const overdue = t.dueDate && t.dueDate < todayISODate() && !t.done;
    return (
      <div
        key={t.id}
        onClick={() => onEdit(t)}
        className="rounded-lg px-3 py-3 mb-2"
        style={{ background: C.surface, border: `1px solid ${overdue ? "#5C1E33" : C.border}` }}
      >
        <div className="text-base font-medium leading-snug" style={{ color: C.text }}>{t.title}</div>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <TaskBadges t={t} theme={theme} />
        </div>
      </div>
    );
  };

  const items = tasks
    .filter((t) => !t.done && !t.cancelled && (t.kind === "event" || t.dueDate || (t.startDate && t.endDate)) && (t.startDate || t.dueDate) && !wellbeingThemeIds.has(t.themeId) && t.showInAgenda !== false)
    .map((t) => ({ t, anchor: agendaAnchorDate(t) }))
    .filter((x) => x.anchor)
    .sort((a, b) => (a.anchor < b.anchor ? -1 : a.anchor > b.anchor ? 1 : (a.t.time || "").localeCompare(b.t.time || "")));

  let lastHeader = null;
  const nodes = [];
  items.forEach(({ t, anchor }, idx) => {
    const header = agendaDateHeader(anchor);
    const isOverdue = header === "En retard";
    if (header !== lastHeader) {
      nodes.push(
        <div
          key={`h-${header}-${idx}`}
          className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: isOverdue ? C.danger : C.textFaint, marginTop: idx === 0 ? 0 : 20 }}
        >
          {header}
        </div>
      );
      lastHeader = header;
    }
    nodes.push(renderItemRow(t));
  });

  const selectedDayItems = tasks.filter(
    (t) => !t.done && !t.cancelled && (t.kind === "event" || t.dueDate || (t.startDate && t.endDate)) && (t.startDate || t.dueDate) && !wellbeingThemeIds.has(t.themeId) && taskCoversDate(t, selectedDate)
  );

  return (
    <div className="px-5 pt-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.textFaint }}>
          {viewMode === "list" ? "Vue liste" : "Vue mois"}
        </div>
        <button
          onClick={() => setViewMode((v) => (v === "list" ? "calendar" : "list"))}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
          style={{ background: viewMode === "calendar" ? C.accent : "transparent", color: viewMode === "calendar" ? C.bg : C.textDim, border: `1px solid ${viewMode === "calendar" ? C.accent : C.borderStrong}` }}
        >
          <CalendarRange size={14} /> {viewMode === "list" ? "Voir le mois" : "Voir la liste"}
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
          {nodes}
        </>
      )}
    </div>
  );
}

function PrioritiesView({ tasks, themes, onToggleToday, onEdit }) {
  const [filterTheme, setFilterTheme] = useState("all");
  const [filterUrgency, setFilterUrgency] = useState("all");
  const [sortMode, setSortMode] = useState("urgency"); // "urgency" | "date"

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
    return (
      <div
        key={t.id}
        onClick={() => onEdit(t)}
        className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
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
        <button onClick={(e) => { e.stopPropagation(); onToggleToday(t.id); }} className="shrink-0">
          {t.inToday ? <Star size={16} fill={C.accent} color={C.accent} /> : <StarOff size={16} color={C.textDim} />}
        </button>
      </div>
    );
  };

  return (
    <div className="px-5 pt-5">
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
          { label: "Série", value: `🔥 ${data.streakDays || 0}j`, color: "#F59E0B" },
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
  const total = items.length;
  if (!total) return null;
  let rouge = 0, orange = 0, vert = 0;
  items.forEach((it) => {
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

function ChecklistsView({ checklists, onOpen, onAddChecklist, onRenameChecklist, onTemplateAction }) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [asTemplate, setAsTemplate] = useState(false);
  const [menuFor, setMenuFor] = useState(null); // id du modèle dont le menu est ouvert

  const lists = (checklists || []).filter((c) => !c.isTemplate);
  const templates = (checklists || []).filter((c) => c.isTemplate);

  const progress = (c) => {
    const total = c.items.length;
    const ok = c.items.filter((i) => i.status === "ok").length;
    return { total, ok, pct: total ? Math.round((ok / total) * 100) : 0 };
  };

  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  const Card = ({ c, isTpl }) => {
    const { total, ok, pct } = progress(c);
    const isRenaming = renamingId === c.id;
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
        </div>
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
              {["📋","🎪","🧳","🛒","🎒","🧰","🍳","🎸","🏕️","📦","🧼","🎁"].map((em) => (
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
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.textGhost }}>Modèles</div>
          <div className="space-y-2">
            {templates.map((c) => <Card key={c.id} c={c} isTpl={true} />)}
          </div>
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

function ChecklistDetailView({ checklist, onBack, onCycleStatus, onAddItem, onEditItem, onDeleteItem, onAddRubrique, onRenameRubrique, onDeleteRubrique, onRename, onDeleteChecklist }) {
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
  const total = checklist.items.length;
  const ok = checklist.items.filter(isDone).length;
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

      <div className="flex items-center gap-2 mb-3">
        <span style={{ fontSize: 26 }}>{checklist.emoji}</span>
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
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: C.textFaint }}>Trier par</span>
          <div className="flex gap-2">
            {[["rubrique", "Rubrique"], ["status", "État"]].map(([mode, lbl]) => (
              <button key={mode} onClick={() => setSortMode(mode)}
                className="text-xs font-semibold px-3 py-1.5 rounded-md"
                style={{ background: sortMode === mode ? C.accent : "transparent", color: sortMode === mode ? C.bg : C.textDim, border: `1px solid ${sortMode === mode ? C.accent : C.borderStrong}` }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => { setAdding((v) => !v); setManagingRubs(false); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5" style={{ background: C.accent, color: C.bg }}>
          <Plus size={16} /> Ajouter
        </button>
        <button onClick={() => { setManagingRubs((v) => !v); setAdding(false); }} className="px-3 py-2.5 rounded-xl text-sm font-semibold" style={{ background: managingRubs ? C.accent + "22" : C.surface, color: managingRubs ? C.accent : C.textDim, border: `1px solid ${C.border}` }} title="Gérer les rubriques">
          Rubriques
        </button>
      </div>

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
            <button disabled={!itemTitle.trim() || (rubChoice === "__new__" && !newRubLabel.trim())} onClick={submitItem} className="flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-40" style={{ background: C.accent, color: C.bg }}>Ajouter</button>
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
            <div key={it.id} className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
              {it.nature === "tache" && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: (URGENCY.find((u) => u.level === (it.urgency || 2)) || {}).color }} title="Tâche" />}
              <span className="flex-1 text-sm" style={{ color: itDone(it) ? C.textGhost : C.text, textDecoration: itDone(it) ? "line-through" : "none" }}>{it.title}</span>
              <button onClick={() => onCycleStatus(it.id)} className="text-xs font-semibold px-3 py-1.5 rounded-md shrink-0"
                style={{ background: statusColors(it)[normStatus(it)], color: C.bg }}>
                {statusLabels(it)[normStatus(it)]}
              </button>
              <button onClick={() => startEditItem(it)} className="shrink-0" style={{ color: C.textGhost }}><Pencil size={13} /></button>
              <button onClick={() => onDeleteItem(it.id)} className="shrink-0" style={{ color: C.textGhost }}><Trash2 size={14} /></button>
            </div>
          )
        );

        // ── Tri par ÉTAT (regroupe fait/prêt vs à faire/à trouver) ──
        if (sortMode === "status") {
          const buckets = [
            { key: "todo", label: "À faire / À trouver", color: "#E11D48", test: (it) => !itDone(it) },
            { key: "done", label: "Fait / Prêt", color: "#7DD3AE", test: (it) => itDone(it) },
          ];
          return buckets.map((b, i) => {
            const items = checklist.items.filter(b.test).sort((a, bb) => a.title.localeCompare(bb.title, "fr", { sensitivity: "base" }));
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
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs" style={{ color: C.textFaint }}>Trier par</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSortMode("rubrique")}
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: sortMode === "rubrique" ? C.accent : "transparent", color: sortMode === "rubrique" ? C.bg : C.textDim, border: `1px solid ${sortMode === "rubrique" ? C.accent : C.borderStrong}` }}
          >
            Rubrique
          </button>
          <button
            onClick={() => setSortMode("status")}
            className="text-xs font-semibold px-3 py-1.5 rounded-md"
            style={{ background: sortMode === "status" ? C.accent : "transparent", color: sortMode === "status" ? C.bg : C.textDim, border: `1px solid ${sortMode === "status" ? C.accent : C.borderStrong}` }}
          >
            État
          </button>
        </div>
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

function TaskForm({ themes, initial, onCancel, onSave, onDelete }) {
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
  const [startDate, setStartDate] = useState(initial?.startDate || (isNew ? todayISODate() : ""));
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [allDay, setAllDay] = useState(!!initial?.allDay);
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

  const handleSave = () => {
    onSave({
      title: title.trim(),
      kind,
      duration: finalDuration,
      time,
      themeId,
      urgency,
      recurrence,
      startDate: startDate || null,
      endDate: endDate || null,
      dueDate: dueDate || null,
      allDay,
      points: customPoints != null ? customPoints : null,
      contacts: contacts.length ? contacts : null,
      showInAgenda: showInAgenda,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold" style={{ color: C.textDim }}>{initial?.id ? "Modifier la tâche" : "Nouvelle tâche"}</h3>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setKind("task")}
          className="flex-1 py-2 rounded-md text-sm font-semibold"
          style={{ background: kind === "task" ? C.accent : "transparent", color: kind === "task" ? C.bg : C.textDim, border: `1px solid ${kind === "task" ? C.accent : C.borderStrong}` }}
        >
          Tâche
        </button>
        <button
          type="button"
          onClick={() => setKind("event")}
          className="flex-1 py-2 rounded-md text-sm font-semibold"
          style={{ background: kind === "event" ? C.accent : "transparent", color: kind === "event" ? C.bg : C.textDim, border: `1px solid ${kind === "event" ? C.accent : C.borderStrong}` }}
        >
          Événement
        </button>
      </div>
      <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre de la tâche"
        className="w-full rounded-md px-3 py-2 text-base outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />

      <div>
        <div className="text-xs mb-2" style={{ color: C.textDim }}>Catégorie</div>
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm outline-none" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}>
          {themes.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs mb-2" style={{ color: C.textDim }}>{kind === "event" ? "Date de début" : "À partir de"}</div>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-md px-3 py-2 text-sm outline-none mb-1.5" style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }} />
          <div className="flex gap-1.5">
            <button
              onClick={() => setStartDate(todayISODate())}
              className="flex-1 text-[11px] font-semibold py-1 rounded-md"
              style={{
                background: startDate === todayISODate() ? C.accent : "transparent",
                color: startDate === todayISODate() ? C.bg : C.textDim,
                border: `1px solid ${startDate === todayISODate() ? C.accent : C.borderStrong}`,
              }}
            >
              Aujourd'hui
            </button>
            <button
              onClick={() => setStartDate(addDaysISO(1))}
              className="flex-1 text-[11px] font-semibold py-1 rounded-md"
              style={{
                background: startDate === addDaysISO(1) ? C.accent : "transparent",
                color: startDate === addDaysISO(1) ? C.bg : C.textDim,
                border: `1px solid ${startDate === addDaysISO(1) ? C.accent : C.borderStrong}`,
              }}
            >
              Demain
            </button>
          </div>
        </div>
        <div>
          <div className="text-xs mb-2" style={{ color: C.textDim }}>Date de fin <span style={{ color: C.textGhost }}>(facultatif)</span></div>
          <input type="date" value={endDate} min={startDate || undefined}
            onChange={(e) => { setEndDate(e.target.value); if (e.target.value && kind === "task") setKind("event"); }}
            className="w-full rounded-md px-3 py-2 text-sm outline-none mb-1.5" style={{ background: C.bg, border: `1px solid ${endDate ? C.accent : C.borderStrong}`, color: C.text }} />
          {endDate ? (
            <button onClick={() => setEndDate("")} className="w-full text-[11px] font-semibold py-1 rounded-md"
              style={{ background: "transparent", color: C.textDim, border: `1px solid ${C.borderStrong}` }}>
              ✕ Sur un seul jour
            </button>
          ) : (
            <div className="text-[11px] py-1" style={{ color: C.textGhost }}>
              {kind === "event" ? "Laisse vide si l'événement dure un jour" : "Pour étaler sur plusieurs jours"}
            </div>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => setAllDay((v) => !v)}>
        <div
          className="w-9 h-5 rounded-full flex items-center px-0.5 shrink-0"
          style={{ background: allDay ? C.accent : C.borderStrong, justifyContent: allDay ? "flex-end" : "flex-start", transition: "all 0.2s ease" }}
        >
          <div className="w-4 h-4 rounded-full" style={{ background: C.text }} />
        </div>
        <span className="text-sm" style={{ color: C.text }}>Toute la journée (pas d'heure précise)</span>
      </label>

      {!allDay && (
        <div>
          <div className="text-xs mb-2" style={{ color: C.textDim }}>Durée</div>
          {/* Brève (1 min) ou durée choisie via le picker */}
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setDurationMode(durationMode === "brief" ? "fixed" : "brief")}
              className="px-3 py-1.5 rounded-md text-xs font-semibold shrink-0"
              style={{ background: durationMode === "brief" ? C.accent : "transparent", color: durationMode === "brief" ? C.bg : C.textDim, border: `1px solid ${durationMode === "brief" ? C.accent : C.borderStrong}` }}>
              Brève (1 min)
            </button>
          </div>
          {durationMode !== "brief" && (
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

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      {kind === "task" && (
        <div>
          <div className="text-xs mb-1.5" style={{ color: C.textDim }}>Échéance (optionnel)</div>
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

      {/* Contacts associés (Android + Chrome uniquement) */}
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
        <div className="font-display italic text-sm mt-2" style={{ color: percent >= 100 ? (isMoon ? (doneCount > 5 ? "#F5A623" : "#F5D923") : "#F5C84C") : C.accentLight }}>
          {isMoon ? moonMood(percent) : constellationMood(percent)}
        </div>
      </div>
      <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Fermer
      </button>
    </div>
  );
}

function TaskActionsMenu({ task, onToggleDone, onPostpone, onEdit, onToggleCancel, onToggleToday, onClose }) {
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
          onClick={onToggleToday}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          {task.inToday ? <StarOff size={17} style={{ color: C.textDim }} /> : <Star size={17} style={{ color: C.accent }} />}
          {task.inToday ? "Retirer d'aujourd'hui" : "À faire aujourd'hui"}
        </button>
        <button
          onClick={onToggleDone}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          <Check size={17} style={{ color: C.accent }} />
          {task.done ? "Marquer comme non fait" : "Marquer comme fait"}
        </button>
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
          onClick={onToggleCancel}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-left"
          style={{ background: C.bg, border: `1px solid ${C.borderStrong}`, color: C.text }}
        >
          <Ban size={17} style={{ color: C.danger }} />
          {task.cancelled ? "Réactiver" : "Annuler la tâche"}
        </button>
      </div>
      <button onClick={onClose} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Fermer
      </button>
    </div>
  );
}

function PostponeForm({ task, onCancel, onSave }) {
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
      <button onClick={onCancel} className="w-full py-2 rounded-md text-sm" style={{ border: `1px solid ${C.borderStrong}`, color: C.textDim }}>
        Annuler
      </button>
    </div>
  );
}

export default SlyTodo;
