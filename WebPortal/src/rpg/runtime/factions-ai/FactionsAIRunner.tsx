// WebPortal/src/rpg/runtime/factions-ai/FactionsAIRunner.tsx
// Composant React INVISIBLE (return null) : tient l'IA des factions et applique ses
// transitions via setRelation. Monté en map orbitale uniquement (là où la guerre
// produit des pertes). Au démontage, restaure les trêves actives à `enemy` pour
// éviter que la matrice globale conserve un état temporaire.
import { useEffect } from "react";
import { eventBus } from "../core/EventBus";
import { FactionsAI, type FactionTransition } from "./factionsAI";
import { relation, setRelation } from "../../factions/factions";
import { worldEntities } from "../core/worldEntities";

const TICK_INTERVAL_MS = 1000;

export function FactionsAIRunner() {
  useEffect(() => {
    const ai = new FactionsAI();
    const apply = (transitions: FactionTransition[]): void => {
      for (const t of transitions) setRelation(t.a, t.b, t.relation);
    };

    // Pertes de vaisseaux → règle de trêve d'épuisement
    const offDestroyed = eventBus.on("ship:destroyed", ({ faction }) => {
      ai.onShipDestroyed(faction, Date.now());
    });

    // Frappes de combat → règle d'alliance défensive (bug-fix v2 :
    // sans ce subscriber, onCombatHit n'était jamais appelée en prod).
    // On résout le targetId vers la faction victime via worldEntities (O(1) Map).
    const offHit = eventBus.on("combat:hit", ({ targetId, attackerFaction }) => {
      if (!attackerFaction) return;
      const victim = worldEntities.get(targetId);
      if (!victim?.faction) return;
      ai.onCombatHit(victim.faction, attackerFaction, Date.now());
    });

    const iv = setInterval(() => {
      apply(ai.tick(Date.now(), relation));
    }, TICK_INTERVAL_MS);

    return () => {
      offDestroyed();
      offHit();
      clearInterval(iv);
      // Restaure trêves + alliances actives à leur état initial avant
      // de perdre la mémoire interne du Runner.
      apply(ai.dispose());
    };
  }, []);

  return null;
}
