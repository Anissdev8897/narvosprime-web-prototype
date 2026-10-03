// runtime/AmmoHud.tsx — compteur de munitions + chargeur (archer/guerrier spatial).
import { useAmmo } from "../combat/ammoStore";
import { useArchetype } from "../archetypes/archetypeStore";
import { ARCHETYPES } from "../archetypes/archetypeCatalog";
import { useMagazine } from "../weapons/magazineStore";

export function AmmoHud() {
  const ammo = useAmmo();
  const mag = useMagazine();
  const arch = useArchetype();
  const wt = arch ? ARCHETYPES[arch].weaponType : null;
  if (wt !== "bow" && wt !== "gun") return null;

  const reserve = wt === "bow" ? ammo.arrows : ammo.cells;
  const icon = wt === "bow" ? "🏹" : "🔋";
  const low = reserve <= 5;
  const showMag = wt === "gun";

  return (
    <div style={{
      position: "fixed", bottom: 92, right: 18, zIndex: 60, font: "14px monospace",
      background: "rgba(8,12,20,0.82)", color: low ? "#ff6a6a" : "#cfe3ff", padding: "6px 12px",
      borderRadius: 8, border: `1px solid ${low ? "#ff6a6a66" : "#3a5a8a55"}`, pointerEvents: "none",
      display: "flex", gap: 10, alignItems: "center",
    }}>
      {showMag && (
        <span style={{ color: mag.isReloading ? "#fbbf24" : mag.current <= 3 ? "#ff6a6a" : "#cfe3ff" }}>
          {mag.isReloading ? "⟳" : `${mag.current}/${mag.max}`}
        </span>
      )}
      <span>{icon} {reserve}{reserve === 0 ? " — vide !" : ""}</span>
    </div>
  );
}
