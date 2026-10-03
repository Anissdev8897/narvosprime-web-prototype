import os
import sys
import time
import requests
import re
from pathlib import Path

# CONFIGURATION
# La clé Meshy vient de l'environnement (MESHY_API_KEY), jamais du source.
API_KEY = os.environ.get("MESHY_API_KEY", "")
if not API_KEY:
    sys.exit("MESHY_API_KEY absente de l'environnement.")
PROMPTS_FILE = r"d:\mes_projet\narvosprime-web-prototype\Client\public\textures\prompts.txt"
OUTPUT_BASE_DIR = r"d:\mes_projet\narvosprime-web-prototype\Client\public\textures\model3D"
MESHY_API_V2 = "https://api.meshy.ai/openapi/v2"
MESHY_API_V1 = "https://api.meshy.ai/openapi/v1"

def meshy_request(method, endpoint, payload=None):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Correctly build URL: base + "openapi/" + endpoint (e.g. "v2/text-to-3d")
    # If endpoint already contains full path after openapi, use it.
    base_url = "https://api.meshy.ai/openapi"
    url = f"{base_url}/{endpoint}"
    
    try:
        if method == "POST":
            response = requests.post(url, headers=headers, json=payload, timeout=30)
        else:
            response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 402:
            print("\nERROR API: 402 Payment Required. Verifiez vos credits Meshy.")
            return None
            
        if not response.ok:
            print(f"\nERROR API ({endpoint}): {response.status_code} - {response.text}")
            return None

        return response.json()
    except Exception as e:
        print(f"\nERROR API ({endpoint}): {str(e)}")
        return None

def poll_task(endpoint, task_id, check_interval=15):
    status = "PENDING"
    result_data = None
    
    print(f"   Task: {task_id} ", end="", flush=True)
    while status not in ["SUCCEEDED", "FAILED"]:
        time.sleep(check_interval)
        data = meshy_request("GET", f"{endpoint}/{task_id}")
        if not data: return None
        
        status = data.get("status")
        progress = data.get("progress", 0)
        print(f"\r   STATUS ({endpoint.split('/')[-1]}): {status} ({progress}%)", end="", flush=True)

        if status == "SUCCEEDED":
            result_data = data
        elif status == "FAILED":
            error_msg = data.get("task_error", {}).get("message", "Erreur inconnue")
            print(f"\nERROR: Task {task_id} echouee: {error_msg}")
            return None
            
    print(f"\n   DONE!")
    return result_data

def generate_preview(prompt):
    print(f"   --- Etape 1: Generation du Mesh (Preview) ---")
    payload = {
        "prompt": prompt,
        "mode": "preview",
        "art_style": "realistic", 
        "ai_model": "meshy-4",    
    }
    resp = meshy_request("POST", "v2/text-to-3d", payload)
    if not resp: return None
    return poll_task("v2/text-to-3d", resp.get("result"))

def generate_textured(preview_task_id):
    print(f"   --- Etape 2: Raffinement & Textures (Refine) ---")
    payload = {
        "preview_task_id": preview_task_id,
        "mode": "refine"
    }
    resp = meshy_request("POST", "v2/text-to-3d", payload)
    if not resp: return None
    return poll_task("v2/text-to-3d", resp.get("result"))

def rig_model(input_task_id):
    print(f"   --- Etape 3: Auto-Rigging (Squelette) ---")
    payload = { "input_task_id": input_task_id }
    resp = meshy_request("POST", "v1/rigging", payload)
    if not resp: return None
    return poll_task("v1/rigging", resp.get("result"))

def animate_model(rig_task_id, action_id):
    print(f"   --- Etape 4: Animation: {action_id} ---")
    payload = {
        "rig_task_id": rig_task_id,
        "action_id": action_id
    }
    # Correct endpoint is plural: animations
    resp = meshy_request("POST", "v1/animations", payload)
    if not resp: return None
    return poll_task("v1/animations", resp.get("result"))

def download_file(url, dest):
    try:
        if not url: return False
        response = requests.get(url, stream=True, timeout=60)
        response.raise_for_status()
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"   SAUVEGARDE: {dest}")
        return True
    except Exception as e:
        print(f"   ECHEC TÉLÉCHARGEMENT: {str(e)}")
        return False

def parse_prompts():
    if not os.path.exists(PROMPTS_FILE): return {}
    try:
        with open(PROMPTS_FILE, 'r', encoding='utf-8') as f: lines = f.readlines()
    except UnicodeDecodeError:
        with open(PROMPTS_FILE, 'r', encoding='cp1252') as f: lines = f.readlines()

    prompts_3d = {}
    current_id = None
    for line in lines:
        line = line.strip()
        if not line: continue
        header_match = re.search(r'^\[3D_(HUMAN|ALIEN|MONSTER|PROP|WEAPON|VEHICLE)_([\w_]+)\]', line)
        if header_match:
            category = header_match.group(1).lower()
            orig_id = header_match.group(2).lower()
            race = "human"
            if category in ["human", "alien"]: race = category
            else:
                alien_keywords = ["canopy", "flux", "mycelium", "parasite", "pressure", "venom", "fungaria"]
                if any(k in orig_id for k in alien_keywords): race = "alien"
            
            cat_map = {"human": "player_personnage", "alien": "player_personnage", "monster": "monstre", "prop": "prop", "weapon": "arme", "vehicle": "vehicule"}
            sub_dir = cat_map.get(category, "misc")
            if "pnj" in orig_id: sub_dir = "personnage_pnj"
            
            current_id = f"{category}_{orig_id}"
            prompts_3d[current_id] = {"race": race, "id": orig_id, "sub_dir": sub_dir, "prompt": "", "is_player": category in ["human", "alien"] and "pnj" not in orig_id}
            continue
        if current_id and not line.startswith('='):
            if not prompts_3d[current_id]["prompt"]: prompts_3d[current_id]["prompt"] = line
            else: prompts_3d[current_id]["prompt"] += " " + line
    return prompts_3d

def main():
    print("NARVOS PRIME - GENERATEUR 3D ULTIME (PRODUCTIONS GAME-READY)\n")
    print("Ce script gere : Mesh -> Textures -> Rigging -> Animations (Idle, Walk, Sprint)")
    
    is_all = "--all" in sys.argv
    is_animate = "--animate" in sys.argv
    target_id = None
    if "--class" in sys.argv:
        idx = sys.argv.index("--class")
        if idx + 1 < len(sys.argv): target_id = sys.argv[idx + 1]

    prompts = parse_prompts()
    if not prompts: return
    available_ids = sorted(prompts.keys())
    
    targets = []
    if is_all: targets = available_ids
    elif target_id:
        if target_id in prompts: targets = [target_id]
        else:
            for k in prompts:
                if target_id.lower() in k.lower(): targets.append(k)
            if not targets: 
                print(f"ID '{target_id}' non trouve.")
                return
    else:
        print("Usage: python generate3DAssets.py --all [--animate]  OU  python generate3DAssets.py --class <id> [--animate]")
        print("\nIDs 3D disponibles:")
        for k in available_ids:
            print(f" - {k}")
        return

    print(f"PLAN: {len(targets)} assets a generer (Animations: {is_animate})\n")

    for full_id in targets:
        item = prompts[full_id]
        race, id_name, sub_dir, base_prompt, is_player = item["race"], item["id"], item["sub_dir"], item["prompt"], item["is_player"]
        genders = ["male", "female"] if is_player else ["default"]
        
        for gender in genders:
            final_id = f"{id_name}_{gender}" if gender != "default" else id_name
            final_prompt = f"{gender} " + base_prompt if gender != "default" else base_prompt
            
            print(f"\n>>> [ASSET] {final_id} ({race}/{sub_dir})")
            
            # 1. Preview (Mesh)
            preview_result = generate_preview(final_prompt)
            if not preview_result: continue
            preview_task_id = preview_result.get("id")
            
            # 2. Refine (Textures)
            textured_result = generate_textured(preview_task_id)
            if not textured_result: continue
            textured_task_id = textured_result.get("id")
            
            # Download textured GLB
            final_glb_url = textured_result.get("model_urls", {}).get("glb")
            base_dest = os.path.join(OUTPUT_BASE_DIR, race, sub_dir, final_id if is_player else "", f"{final_id}.glb")
            download_file(final_glb_url, base_dest)
            
            # 3. Animations (Rigging required)
            if is_animate:
                rig_result = rig_model(textured_task_id)
                if rig_result:
                    rig_task_id = rig_result.get("id")
                    
                    # Animations requested: idle, walk, sprint
                    actions = ["idle", "walk", "sprint"]
                    for action in actions:
                        anim_result = animate_model(rig_task_id, action)
                        if anim_result:
                            anim_url = anim_result.get("model_urls", {}).get("glb")
                            anim_dest = os.path.join(OUTPUT_BASE_DIR, race, sub_dir, final_id if is_player else "", f"{final_id}_{action}.glb")
                            download_file(anim_url, anim_dest)

            time.sleep(2)

    print("\nFIN DE LA PRODUCTION.")

if __name__ == "__main__":
    main()
