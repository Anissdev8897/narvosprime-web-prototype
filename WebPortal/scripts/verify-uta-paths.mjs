// Vérifie que chaque chemin déclaré dans le catalogue UTA existe réellement.
// Un chemin absent ne lève pas d'erreur au runtime : Vite renvoie index.html en
// 200 (fallback SPA), le GLB est illisible, et le clip disparaît en silence.
import { existsSync } from "node:fs";

const UTA = "public/models/animations/uta_locomotion";
const PFX = "AnimSeq_Traversal_Movement";
const DIRS = ["Forward", "ForwardLeft", "ForwardRight", "Left", "Right", "Back", "BackLeft", "BackRight"];
const TRAVERSAL = [
  "Jump_InPlace_PreJump", "Jump_InPlace_Jump", "Jump_InPlace_Loop",
  "Jump_InPlace_PreLanding", "Jump_InPlace_Landing",
  "Jump_InPlace_to_Wall_Climb_4Limbs_HoldIdle",
];

const paths = [];
for (const gait of ["Walk", "Run"]) for (const d of DIRS) paths.push(`${UTA}/${PFX}_${gait}_${d}.glb`);
paths.push(`${UTA}/${PFX}_Sprint.glb`, `${UTA}/${PFX}_Idle.glb`);
for (const t of TRAVERSAL) paths.push(`${UTA}/${PFX}_${t}.glb`);

const missing = paths.filter((p) => !existsSync(p));
console.log(`${paths.length - missing.length}/${paths.length} chemins UTA existent`);
if (missing.length) {
  console.log("MANQUANTS :");
  for (const m of missing) console.log("  " + m);
  process.exit(1);
}
