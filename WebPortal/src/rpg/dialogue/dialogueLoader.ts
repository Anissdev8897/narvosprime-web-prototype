// ══════════════════════════════════════════════════════════════════════════════
// dialogue/dialogueLoader.ts — Chargeur de dialogues (YAML / TS)
//
// Supporte deux modes :
//   1. Définition directe en TS (comme questCatalog)
//   2. Parsing YAML via un mini-parseur intégré (sans dépendance npm)
//
// Les fichiers YAML sont placés dans src/rpg/dialogue/data/*.yaml et importés
// via leur contenu texte brut (ou chargés à runtime via fetch).
// ══════════════════════════════════════════════════════════════════════════════

import type {
  DialogueDef,
  DialogueNode,
  DialogueChoice,
  DialogueCondition,
  DialogueAction,
} from "./types";

// ── Mini parseur YAML (pour notre format dialogue uniquement) ────────────────
// Support : strings, nombres, booléens, tableaux, objets imbriqués.
// Pas de support YAML complet — juste ce qu'il faut pour les dialogues.

function parseYamlValue(value: string): string | number | boolean {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  // nombre
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed.length > 0) return num;
  // string
  return trimmed.replace(/^["']|["']$/g, "");
}

function parseYamlArray(line: string, lines: string[], i: number): [unknown[], number] {
  const arr: unknown[] = [];
  // Format inline: [a, b, c]
  const inline = line.match(/^-\s*\[(.*)\]$/);
  if (inline) {
    arr.push(
      ...inline[1].split(",").map((s) => parseYamlValue(s.trim()))
    );
    return [arr, i];
  }
  // Format multi-lignes
  const baseIndent = line.search(/\S/);
  arr.push(parseYamlValue(line.replace(/^-\s*/, "")));
  i++;
  while (i < lines.length) {
    const l = lines[i];
    const indent = l.search(/\S/);
    if (indent <= baseIndent && !l.trimStart().startsWith("-")) break;
    if (l.trimStart().startsWith("-")) {
      arr.push(parseYamlValue(l.trimStart().replace(/^-\s*/, "")));
    }
    i++;
  }
  return [arr, i - 1];
}

function parseYamlObject(lines: string[], start: number): [Record<string, unknown>, number] {
  const obj: Record<string, unknown> = {};
  let i = start;
  const baseIndent = lines[start]?.search(/\S/) ?? 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    const indent = line.search(/\S/);
    if (indent < baseIndent) break;
    if (indent === baseIndent || line.trim().startsWith("-")) break;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    let rawValue = line.slice(colonIdx + 1).trim();

    if (rawValue === "" || rawValue === "|") {
      // Valeur multiligne ou objet
      const childIndent = baseIndent + 2;
      const childLines: string[] = [];
      i++;
      while (i < lines.length) {
        const cl = lines[i];
        if (!cl.trim() || cl.trim().startsWith("#")) { i++; continue; }
        if (cl.search(/\S/) <= baseIndent) break;
        childLines.push(cl);
        i++;
      }

      if (childLines.length > 0) {
        const first = childLines[0].trimStart();
        if (first.startsWith("-")) {
          // Tableau
          const arr: unknown[] = [];
          for (const cl of childLines) {
            const trimmed = cl.trimStart();
            if (trimmed.startsWith("- ")) {
              const val = trimmed.replace(/^-\s*/, "");
              // Could be inline object
              if (val.includes(":")) {
                const [subObj] = parseYamlObject(
                  childLines,
                  childLines.indexOf(cl)
                );
                arr.push(subObj);
              } else {
                arr.push(parseYamlValue(val));
              }
            }
          }
          obj[key] = arr;
        } else {
          const [subObj] = parseYamlObject(childLines, 0);
          obj[key] = subObj;
        }
      }
      continue;
    } else if (rawValue.startsWith("[")) {
      // Inline array
      const arrStr = rawValue.slice(1, -1);
      obj[key] = arrStr.split(",").map((s) => parseYamlValue(s.trim()));
    } else if (rawValue.startsWith('"') || rawValue.startsWith("'")) {
      obj[key] = rawValue.slice(1, -1);
    } else {
      obj[key] = parseYamlValue(rawValue);
    }
    i++;
  }

  return [obj, i];
}

export function parseYamlDialogue(yamlText: string): DialogueDef[] {
  const lines = yamlText.split("\n").map((l) => l.replace(/\r$/, ""));
  const defs: DialogueDef[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#") || line.trim().startsWith("---")) {
      i++;
      continue;
    }

    // Top-level key: dialogues: or ---
    if (line.trim().startsWith("dialogues:") || line.trim().startsWith("---")) {
      i++;
      continue;
    }

    // Each dialogue starts with "- id: ..."
    if (line.trimStart().startsWith("- id:")) {
      const [parsed] = parseDialogueYamlEntry(lines, i);
      if (parsed) defs.push(parsed as DialogueDef);
      // Find the end of this entry
      const base = line.search(/\S/);
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim() || l.trim().startsWith("#")) { i++; continue; }
        if (l.search(/\S/) <= base && l.trimStart().startsWith("-")) break;
        if (l.search(/\S/) < base) break;
        i++;
      }
      continue;
    }
    i++;
  }

  return defs;
}

function parseDialogueYamlEntry(
  lines: string[],
  start: number
): [Partial<DialogueDef> | null, number] {
  const def: Partial<DialogueDef> = {};
  let i = start;
  const baseIndent = lines[start]?.search(/\S/) ?? 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    const indent = line.search(/\S/);
    if (indent < baseIndent) break;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    switch (key) {
      case "id": def.id = value; break;
      case "title": def.title = value.replace(/^["']|["']$/g, ""); break;
      case "npcFolder": def.npcFolder = value; break;
      case "npcName": def.npcName = value.replace(/^["']|["']$/g, ""); break;
      case "startNode": def.startNode = value; break;
      case "tags": {
        if (value.startsWith("[")) {
          def.tags = value.slice(1, -1).split(",").map((s) => s.trim());
        }
        break;
      }
      case "nodes": {
        // Collect child lines
        const childIndent = indent + 2;
        const childLines: string[] = [];
        i++;
        while (i < lines.length) {
          const cl = lines[i];
          if (!cl.trim() || cl.trim().startsWith("#")) { i++; continue; }
          if (cl.search(/\S/) < childIndent) break;
          childLines.push(cl);
          i++;
        }
        def.nodes = parseNodes(childLines);
        continue;
      }
    }
    i++;
  }

  return [def as DialogueDef, i];
}

function parseNodes(lines: string[]): DialogueNode[] {
  const nodes: DialogueNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    if (line.trimStart().startsWith("- id:")) {
      const node: Partial<DialogueNode> = {};
      const baseIndent = line.search(/\S/);
      node.id = line.split(":")[1]?.trim() ?? "";
      i++;

      while (i < lines.length) {
        const cl = lines[i];
        if (!cl.trim() || cl.trim().startsWith("#")) { i++; continue; }
        const indent = cl.search(/\S/);
        if (indent <= baseIndent) break;

        const colonIdx = cl.indexOf(":");
        if (colonIdx === -1) { i++; continue; }
        const key = cl.slice(0, colonIdx).trim();
        const val = cl.slice(colonIdx + 1).trim();

        if (key === "text") {
          // Multiline or single
          if (val === "" || val === "|") {
            const textLines: string[] = [];
            i++;
            const textIndent = baseIndent + 4;
            while (i < lines.length) {
              const tl = lines[i];
              if (!tl.trim()) { textLines.push(""); i++; continue; }
              if (tl.search(/\S/) < textIndent) break;
              textLines.push(tl.trimStart());
              i++;
            }
            node.text = textLines.join("\n");
            continue;
          } else {
            node.text = val.replace(/^["']|["']$/g, "");
          }
        } else if (key === "speaker") {
          node.speaker = val.replace(/^["']|["']$/g, "");
        } else if (key === "portrait") {
          node.portrait = val;
        } else if (key === "choices") {
          const childLines: string[] = [];
          i++;
          const childIndent = baseIndent + 4;
          while (i < lines.length) {
            const sl = lines[i];
            if (!sl.trim() || sl.trim().startsWith("#")) { i++; continue; }
            if (sl.search(/\S/) < childIndent) break;
            childLines.push(sl);
            i++;
          }
          node.choices = parseChoices(childLines);
          continue;
        } else if (key === "conditions") {
          node.conditions = parseConditions(cl, lines, i);
          i++;
          continue;
        } else if (key === "onEnter" || key === "onExit") {
          const childLines: string[] = [];
          i++;
          const childIndent = baseIndent + 4;
          while (i < lines.length) {
            const al = lines[i];
            if (!al.trim() || al.trim().startsWith("#")) { i++; continue; }
            if (al.search(/\S/) < childIndent) break;
            childLines.push(al);
            i++;
          }
          const arr: DialogueAction[] = parseActions(childLines);
          if (key === "onEnter") node.onEnter = arr;
          else node.onExit = arr;
          continue;
        }
        i++;
      }

      if (node.id && node.text !== undefined) {
        nodes.push(node as DialogueNode);
      }
    } else {
      i++;
    }
  }

  return nodes;
}

function parseChoices(lines: string[]): DialogueChoice[] {
  const choices: DialogueChoice[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }
    if (line.trimStart().startsWith("- id:")) {
      // New choice entry
      const baseIndent = line.search(/\S/);
      const choice: Partial<DialogueChoice> = {};
      // Store id but we mainly use text/nextNode
      choice.text = "";
      choice.nextNode = "";
      i++;

      while (i < lines.length) {
        const cl = lines[i];
        if (!cl.trim() || cl.trim().startsWith("#")) { i++; continue; }
        const indent = cl.search(/\S/);
        if (indent <= baseIndent) break;

        const colonIdx = cl.indexOf(":");
        if (colonIdx === -1) { i++; continue; }
        const key = cl.slice(0, colonIdx).trim();
        const val = cl.slice(colonIdx + 1).trim();

        if (key === "text") {
          choice.text = val.replace(/^["']|["']$/g, "");
        } else if (key === "nextNode") {
          choice.nextNode = val;
        } else if (key === "conditions") {
          choice.conditions = parseConditions(cl, lines, i);
          i++;
          continue;
        } else if (key === "onSelect") {
          const childLines: string[] = [];
          i++;
          const childIndent = baseIndent + 6;
          while (i < lines.length) {
            const al = lines[i];
            if (!al.trim() || al.trim().startsWith("#")) { i++; continue; }
            if (al.search(/\S/) < childIndent) break;
            childLines.push(al);
            i++;
          }
          choice.onSelect = parseActions(childLines);
          continue;
        }
        i++;
      }

      if (choice.text && choice.nextNode) {
        choices.push(choice as DialogueChoice);
      }
    } else if (line.trimStart().startsWith("- text:")) {
      // Inline format: - text: "..."  nextNode: "..."
      const textMatch = line.match(/text:\s*["']?(.*?)["']?\s*(?:nextNode|$)/);
      // Actually simpler: parse inline
      const parts = line.trimStart().replace(/^- /, "").split(/\s+(?=\w+:)"/);
      // Let's use a simpler approach for inline
      const textVal = line.match(/text:\s*"([^"]+)"/) || line.match(/text:\s*'([^']+)'/);
      const nextVal = line.match(/nextNode:\s*(\S+)/);
      if (textVal && nextVal) {
        choices.push({
          text: textVal[1],
          nextNode: nextVal[1],
        });
      }
      i++;
    } else {
      i++;
    }
  }

  return choices;
}

function parseConditions(
  firstLine: string,
  lines: string[],
  start: number
): DialogueCondition[] {
  const conds: DialogueCondition[] = [];
  const inline = firstLine.match(/conditions:\s*\[(.*)\]/);
  if (inline) {
    // Inline as array of objects — skip for simplicity
    return conds;
  }

  let i = start + 1;
  const baseIndent = (lines[start]?.search(/\S/) ?? 0) + 2;

  while (i < lines.length) {
    const cl = lines[i];
    if (!cl.trim() || cl.trim().startsWith("#")) { i++; continue; }
    const indent = cl.search(/\S/);
    if (indent < baseIndent) break;

    if (cl.trimStart().startsWith("- type:")) {
      const cond: Partial<DialogueCondition> = { type: "flag", params: {} };
      const cBase = cl.search(/\S/);
      const typeMatch = cl.match(/type:\s*(\S+)/);
      cond.type = (typeMatch?.[1] ?? "flag") as DialogueCondition["type"];
      i++;

      while (i < lines.length) {
        const pl = lines[i];
        if (!pl.trim() || pl.trim().startsWith("#")) { i++; continue; }
        const pIndent = pl.search(/\S/);
        if (pIndent <= cBase) break;

        const colonIdx = pl.indexOf(":");
        if (colonIdx === -1) { i++; continue; }
        const pk = pl.slice(0, colonIdx).trim();
        const pv = pl.slice(colonIdx + 1).trim();
        if (pk !== "type") {
          cond.params![pk] = parseYamlValue(pv);
        }
        i++;
      }
      conds.push(cond as DialogueCondition);
    } else {
      i++;
    }
  }

  return conds;
}

function parseActions(lines: string[]): DialogueAction[] {
  const actions: DialogueAction[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) { i++; continue; }

    if (line.trimStart().startsWith("- type:")) {
      const action: Partial<DialogueAction> = { type: "nop", params: {} };
      const base = line.search(/\S/);
      const typeMatch = line.match(/type:\s*(\S+)/);
      action.type = (typeMatch?.[1] ?? "nop") as DialogueAction["type"];
      i++;

      while (i < lines.length) {
        const pl = lines[i];
        if (!pl.trim() || pl.trim().startsWith("#")) { i++; continue; }
        const pIndent = pl.search(/\S/);
        if (pIndent <= base) break;

        const colonIdx = pl.indexOf(":");
        if (colonIdx === -1) { i++; continue; }
        const pk = pl.slice(0, colonIdx).trim();
        const pv = pl.slice(colonIdx + 1).trim();
        if (pk !== "type") {
          action.params![pk] = parseYamlValue(pv);
        }
        i++;
      }
      actions.push(action as DialogueAction);
    } else {
      i++;
    }
  }

  return actions;
}

// ── Dialogue Catalog (équivalent TS du YAML) ────────────────────────────────
// Charge les dialogues depuis les définitions TS ou YAML parsé.
// Suit le pattern questCatalog.ts.

/**
 * Charge des dialogues depuis une chaîne YAML.
 */
export function loadDialoguesFromYaml(yamlText: string): DialogueDef[] {
  return parseYamlDialogue(yamlText);
}

export const DIALOGUE_CATALOG: DialogueDef[] = [];
