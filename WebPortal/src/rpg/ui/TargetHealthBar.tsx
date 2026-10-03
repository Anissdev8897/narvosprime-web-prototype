// ui/TargetHealthBar.tsx — Barre de vie de la cible ennemie (haut-centre).
//
// Lit la cible courante depuis targetingStore (singleton hors-React, pont
// via useSyncExternalStore). Affiche le nom, le niveau, la barre HP avec
// dégradé vert→jaune→rouge + "barre fantôme" qui matérialise les dégâts
// subis (retard visuel de 600 ms sur les HP réels).

import { useRef, useEffect } from "react";
import { useCurrentTarget } from "../runtime/targeting/targetingStore";
import styles from "./TargetHealthBar.module.css";

/** Dégradé de la barre HP selon le pourcentage restant. */
function hpGradient(pct: number): string {
  if (pct > 60) return "linear-gradient(90deg, #22c55e, #4ade80)";
  if (pct > 30) return "linear-gradient(90deg, #eab308, #facc15)";
  return "linear-gradient(90deg, #dc2626, #f87171)";
}

export function TargetHealthBar() {
  const target = useCurrentTarget();

  // --- Barre fantôme : suit les HP avec un délai pour visualiser les dégâts ---
  const ghostRef = useRef(100);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevIdRef = useRef<string | null>(null);

  const hpPct = target ? target.hpFraction * 100 : 0;

  useEffect(() => {
    if (!target) {
      ghostRef.current = 100;
      return;
    }

    // Nouvelle cible → reset immédiat de la barre fantôme
    if (target.id !== prevIdRef.current) {
      ghostRef.current = hpPct;
      prevIdRef.current = target.id;
      return;
    }

    // Dégâts reçus → la barre fantôme reste 600 ms avant de rattraper
    if (hpPct < ghostRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        ghostRef.current = hpPct;
      }, 600);
    } else {
      // Heal ou pas de changement → synchro immédiate
      ghostRef.current = hpPct;
    }
  }, [target, hpPct]);

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => { clearTimeout(timerRef.current); };
  }, []);

  const isVisible = !!target;
  const currentHp = target ? Math.round(target.hpFraction * target.maxHp) : 0;

  return (
    <div
      className={`${styles.wrapper} ${isVisible ? styles.visible : styles.hidden} ${isVisible ? styles.enterAnim : ""}`}
    >
      <div className={styles.panel}>
        {target && (
          <>
            <div className={styles.header}>
              <span className={styles.name}>{target.label}</span>
              <span className={styles.level}>NIV {target.level}</span>
            </div>

            <div className={styles.barLabel}>
              <span>HP</span>
              <span>{currentHp} / {target.maxHp}</span>
            </div>

            <div className={styles.barTrack}>
              <div
                className={styles.barGhost}
                style={{ width: `${ghostRef.current}%` }}
              />
              <div
                className={styles.barFill}
                style={{
                  width: `${hpPct}%`,
                  background: hpGradient(hpPct),
                }}
              />
              <div className={styles.barSegments} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
