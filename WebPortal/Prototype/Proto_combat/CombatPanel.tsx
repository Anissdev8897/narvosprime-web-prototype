/**
 * Proto_combat/CombatPanel.tsx — Panneau de réglage du banc d'essai.
 *
 * Étape 2 du brief (liste des clips, déclenchement au clic, fondu en direct) et
 * partie visible de l'étape 4 (état de la machine + les six valeurs de
 * docs/COMBAT_MECANIQUES.md §12).
 *
 * Le panneau ne contient AUCUNE règle de combat : il lit un instantané et écrit
 * dans les réglages. Toute la logique est dans `combat/combatMachine.ts`, testée
 * sans DOM — c'est ce qui rend ce fichier jetable et la machine promouvable.
 */
import { useMemo, useState } from "react";

import { Bascule, Curseur, Jauge, ProtoPanel, Section, BOUTON_PLAT } from "../_shared/ProtoPanel";
import {
  validerCatalogue,
  type AttackDef,
  type AttackId,
  type ReglagesCombat,
} from "./combat/combatCatalog";
import type { CombatPhase } from "./combat/combatMachine";

export interface InstantaneCombat {
  phase: CombatPhase;
  attaque: AttackId | null;
  rang: number;
  fenetre: boolean;
  tampon: boolean;
  endurance: number;
  avancementMs: number;
  enCharge: boolean;
  chargePrete: boolean;
  chargeMs: number;
  pvMannequin: number;
  pvMax: number;
  /** Progression du chargement des clips — un banc muet doit dire pourquoi. */
  chargesClips: number;
  totalClips: number;
  echecsClips: readonly string[];
}

export interface CombatPanelProps {
  instantane: InstantaneCombat;
  /** Objet de réglages LIVE, muté en place (convention `gameSettings` du jeu). */
  reglages: ReglagesCombat;
  catalogue: Record<AttackId, AttackDef>;
  onCatalogue: (c: Record<AttackId, AttackDef>) => void;
  /** Noms des clips réellement présents sur le GLB chargé. */
  clips: readonly string[];
  clipJoue: string | null;
  onJouerClip: (nom: string) => void;
  onArreterClip: () => void;
  fonduSec: number;
  onFondu: (v: number) => void;
  journal: readonly string[];
  onReinitialiser: () => void;
}

const COULEUR_PHASE: Record<CombatPhase, string> = {
  neutre: "#5d6b8a",
  anticipation: "#ffd166",
  actif: "#ff5d5d",
  recuperation: "#4f9dff",
  hitstun: "#c46bff",
  garde_brisee: "#ff8a3d",
};

export function CombatPanel(props: CombatPanelProps) {
  const { instantane: s, reglages, catalogue } = props;
  // Compteur de rendu : les réglages sont mutés EN PLACE (pas de nouvel objet),
  // donc React ne peut pas les diffusser tout seul. Un compteur explicite est
  // plus honnête qu'un clone à chaque frappe, qui casserait les références live.
  const [, forcer] = useState(0);
  const majReglage = <K extends keyof ReglagesCombat>(cle: K, valeur: ReglagesCombat[K]) => {
    reglages[cle] = valeur;
    forcer((n) => n + 1);
  };

  const [attaqueEditee, setAttaqueEditee] = useState<AttackId>("punch1");
  const [filtreClip, setFiltreClip] = useState("");

  const erreurs = useMemo(() => validerCatalogue(catalogue), [catalogue]);
  const clipsFiltres = useMemo(() => {
    const f = filtreClip.trim().toLowerCase();
    return f ? props.clips.filter((c) => c.toLowerCase().includes(f)) : props.clips;
  }, [props.clips, filtreClip]);

  const def = catalogue[attaqueEditee];
  const majDef = (champ: keyof AttackDef, valeur: number) => {
    props.onCatalogue({ ...catalogue, [attaqueEditee]: { ...def, [champ]: valeur } });
  };

  return (
    <ProtoPanel titre="BANC DE COMBAT">
      <Section titre="Commandes">
        <ul style={{ margin: 0, paddingLeft: 16, color: "#9fb4dd" }}>
          <li><b style={{ color: "#dbe3f4" }}>A</b> / clic gauche — attaquer (<b style={{ color: "#dbe3f4" }}>maintenir</b> = charger)</li>
          <li><b style={{ color: "#dbe3f4" }}>E</b> (maintenu) — garder</li>
          <li><b style={{ color: "#dbe3f4" }}>H</b> — le mannequin frappe de face</li>
          <li><b style={{ color: "#dbe3f4" }}>B</b> — le mannequin frappe dans le dos</li>
          <li><b style={{ color: "#dbe3f4" }}>R</b> — tout réinitialiser</li>
        </ul>
      </Section>

      <Section titre="État">
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 6 }}>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 3,
              background: COULEUR_PHASE[s.phase],
              color: "#0a0c16",
              fontWeight: 700,
            }}
          >
            {s.phase}
          </span>
          <span style={{ color: "#9fb4dd" }}>
            {s.attaque ?? "—"} {s.avancementMs >= 0 ? `· ${Math.round(s.avancementMs)} ms` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <Voyant actif={s.fenetre} label="fenêtre" couleur="#7fd1a8" />
          <Voyant actif={s.tampon} label="tampon" couleur="#ffd166" />
          <span style={{ color: "#9fb4dd" }}>rang {s.rang}</span>
        </div>
        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <Voyant actif={s.enCharge} label="charge" couleur="#ff8a3d" />
          <Voyant actif={s.chargePrete} label="prête" couleur="#ffd166" />
          <span style={{ color: "#9fb4dd" }}>
            {s.chargeMs >= 0 ? `${Math.round(s.chargeMs)} ms` : "—"}
          </span>
        </div>
        <Jauge label="Endurance" valeur={s.endurance} max={reglages.enduranceMax} couleur="#4f9dff" />
        <Jauge label="PV mannequin" valeur={s.pvMannequin} max={s.pvMax} couleur="#ff7a7a" />
        <button onClick={props.onReinitialiser} style={{ ...BOUTON_PLAT, color: "#ff8a8a", marginTop: 4 }}>
          ⟲ réinitialiser (R)
        </button>
      </Section>

      <Section titre={`Coup — ${def.label}`}>
        <select
          value={attaqueEditee}
          onChange={(e) => setAttaqueEditee(e.target.value as AttackId)}
          style={CHAMP}
        >
          {Object.values(catalogue).map((a) => (
            <option key={a.id} value={a.id}>{a.id} — {a.label}</option>
          ))}
        </select>
        <Curseur label="anticipation" valeur={def.startupMs} min={40} max={500} pas={5} unite=" ms"
          onChange={(v) => majDef("startupMs", v)} />
        <Curseur label="actif" valeur={def.activeMs} min={20} max={300} pas={5} unite=" ms"
          onChange={(v) => majDef("activeMs", v)} />
        <Curseur label="récupération" valeur={def.recoveryMs} min={60} max={900} pas={10} unite=" ms"
          onChange={(v) => majDef("recoveryMs", v)} />
        <Curseur label="fenêtre — ouverture" valeur={def.windowOpenMs} min={0} max={900} pas={5} unite=" ms"
          onChange={(v) => majDef("windowOpenMs", v)} />
        <Curseur label="fenêtre — fermeture" valeur={def.windowCloseMs} min={0} max={1200} pas={5} unite=" ms"
          onChange={(v) => majDef("windowCloseMs", v)} />
        <Curseur label="dégâts" valeur={def.damage} min={1} max={60} pas={1}
          onChange={(v) => majDef("damage", v)} />
        <Curseur label="endurance" valeur={def.staminaCost} min={0} max={60} pas={1}
          onChange={(v) => majDef("staminaCost", v)} />
        <Curseur label="portée" valeur={def.rangeM} min={0.5} max={4} pas={0.1} unite=" m"
          onChange={(v) => majDef("rangeM", v)} />

        {erreurs.length > 0 && (
          <ul style={{ margin: "6px 0 0", paddingLeft: 16, color: "#ff8a8a" }}>
            {erreurs.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </Section>

      <Section titre="Réglages globaux">
        <Curseur label="tampon (péremption)" valeur={reglages.bufferTtlMs} min={0} max={600} pas={10} unite=" ms"
          onChange={(v) => majReglage("bufferTtlMs", v)} />
        <Curseur label="hitstun" valeur={reglages.hitstunMs} min={0} max={1200} pas={20} unite=" ms"
          onChange={(v) => majReglage("hitstunMs", v)} />
        <Curseur label="cône de garde" valeur={reglages.coneGardeDeg} min={20} max={360} pas={5} unite="°"
          onChange={(v) => majReglage("coneGardeDeg", v)} />
        <Curseur label="dégâts passant la garde" valeur={Math.round(reglages.gardePassthrough * 100)} min={0} max={100} pas={5} unite=" %"
          onChange={(v) => majReglage("gardePassthrough", v / 100)} />
        <Curseur label="endurance / coup gardé" valeur={reglages.gardeCoutEndurance} min={0} max={60} pas={1}
          onChange={(v) => majReglage("gardeCoutEndurance", v)} />
        <Curseur label="seuil de charge" valeur={reglages.chargeSeuilMs} min={100} max={1500} pas={10} unite=" ms"
          onChange={(v) => majReglage("chargeSeuilMs", v)} />
        <Curseur label="endurance / s en charge" valeur={reglages.chargeCoutParSec} min={0} max={60} pas={1}
          onChange={(v) => majReglage("chargeCoutParSec", v)} />
        <Bascule label="tamponner dès l'anticipation" valeur={reglages.tamponDesAnticipation}
          onChange={(v) => majReglage("tamponDesAnticipation", v)} />
        <Bascule label="ignorer la fenêtre (réglage)" valeur={reglages.ignorerFenetre}
          onChange={(v) => majReglage("ignorerFenetre", v)} />
      </Section>

      <Section titre={`Clips du rig (${props.clips.length})`} defautOuvert={false}>
        {props.clips.length === 0 && s.totalClips > 0 && (
          <div style={{ marginBottom: 6, color: "#ffd166" }}>
            chargement {s.chargesClips} / {s.totalClips}…
          </div>
        )}
        {s.echecsClips.length > 0 && (
          <div style={{ marginBottom: 6, color: "#ff8a8a" }}>
            {s.echecsClips.length} fichier(s) en échec — voir la console
          </div>
        )}
        <input
          value={filtreClip}
          onChange={(e) => setFiltreClip(e.target.value)}
          placeholder="filtrer… (punch, walk, climb)"
          style={CHAMP}
        />
        <Curseur label="fondu" valeur={props.fonduSec} min={0} max={1} pas={0.02} unite=" s"
          onChange={props.onFondu} />
        <button onClick={props.onArreterClip} style={{ ...BOUTON_PLAT, color: "#ff8a8a", marginBottom: 6 }}>
          ■ stop (retour idle)
        </button>
        <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #232b45", borderRadius: 3 }}>
          {clipsFiltres.map((nom) => (
            <button
              key={nom}
              onClick={() => props.onJouerClip(nom)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "3px 6px",
                background: props.clipJoue === nom ? "#1d2740" : "transparent",
                border: "none",
                borderBottom: "1px solid #1a2038",
                color: props.clipJoue === nom ? "#7fd1a8" : "#c3cee6",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              {nom}
            </button>
          ))}
          {clipsFiltres.length === 0 && (
            <div style={{ padding: 8, color: "#7f8db0" }}>aucun clip — le GLB n'en porte pas</div>
          )}
        </div>
      </Section>

      <Section titre="Journal" defautOuvert={false}>
        <div style={{ maxHeight: 180, overflowY: "auto", color: "#9fb4dd" }}>
          {props.journal.length === 0 && <span style={{ color: "#7f8db0" }}>—</span>}
          {props.journal.map((l, i) => (
            <div key={`${i}-${l}`} style={{ whiteSpace: "pre-wrap" }}>{l}</div>
          ))}
        </div>
      </Section>
    </ProtoPanel>
  );
}

function Voyant({ actif, label, couleur }: { actif: boolean; label: string; couleur: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 4, color: actif ? couleur : "#4a5570" }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: actif ? couleur : "#2b3350",
          boxShadow: actif ? `0 0 6px ${couleur}` : "none",
        }}
      />
      {label}
    </span>
  );
}

const CHAMP: React.CSSProperties = {
  width: "100%",
  marginBottom: 8,
  padding: "4px 6px",
  background: "#141a2e",
  border: "1px solid #2b3350",
  borderRadius: 3,
  color: "#dbe3f4",
  font: "inherit",
};
