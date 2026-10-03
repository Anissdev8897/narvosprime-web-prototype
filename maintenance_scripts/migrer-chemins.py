# ══════════════════════════════════════════════════════════════════════════════
# migrer-chemins.py — E:\narvosprime-web-prototype → E:\narvosprime-web-prototype
# Migration des références texte du projet (19/09/2026).
# Préserve les fins de ligne, remplace les DEUX variantes de slash, et rend le
# rapport des fichiers modifiés + ceux qu'il n'a pas pu lire (à vérifier).
# ══════════════════════════════════════════════════════════════════════════════
import os, sys

RACINE = r"E:\narvosprime-web-prototype"
EXCLUS_DIRS = {".git", "node_modules", ".hermes", "archive", "asset_decompile", "sauvegardes", "scratch", "logs"}
EXTS = (".lua", ".mjs", ".js", ".ts", ".py", ".sh", ".bat", ".ps1", ".json", ".toml",
        ".md", ".txt", ".cfg", ".ini", ".yaml", ".yml", ".cs", ".uproject", ".uplugin",
        ".sln", ".csproj", ".reg", ".editorconfig", ".gitignore", ".npmrc", ".html", ".css")

ANCIEN_SLASH = "E:/narvosprime-web-prototype"
ANCIEN_BS    = "E:\\narvosprime-web-prototype"
NOUV_SLASH   = "E:/narvosprime-web-prototype"
NOUV_BS      = "E:\\narvosprime-web-prototype"

modifies, illisibles = [], []

for racine, dossiers, fichiers in os.walk(RACINE):
    dossiers[:] = [d for d in dossiers if d not in EXCLUS_DIRS]
    for f in fichiers:
        if not f.lower().endswith(EXTS):
            continue
        p = os.path.join(racine, f)
        try:
            with open(p, encoding="utf-8") as fh:
                contenu = fh.read()
        except UnicodeDecodeError:
            # Probablement UTF-16/ANSI (fichiers Unreal). À vérifier à part.
            with open(p, "rb") as fh:
                brut = fh.read()
            if b"mes_projet" in brut:
                illisibles.append(p)
            continue
        except OSError:
            continue

        if ANCIEN_SLASH not in contenu and ANCIEN_BS not in contenu:
            continue

        nouveau = contenu.replace(ANCIEN_SLASH, NOUV_SLASH).replace(ANCIEN_BS, NOUV_BS)
        with open(p, "w", encoding="utf-8", newline="") as fh:
            fh.write(nouveau)
        modifies.append(p)

print(f"fichiers migres : {len(modifies)}")
print(f"fichiers ILLISIBLES (binaires/UTF-16) contenant mes_projet : {len(illisibles)}")
for p in modifies:
    print("  M", p[len(RACINE):])
for p in illisibles:
    print("  !", p[len(RACINE):])