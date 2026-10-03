
import json
import random

def generate_monster_db(biome, count=5):
    """
    Génère une base de données de monstres équilibrée pour le moteur Narvos.
    """
    monsters = []
    prefixes = ["Alpha", "Corrompu", "Guerrier", "Éclaireur", "Vénérable"]
    
    for i in range(count):
        level = random.randint(1, 10)
        hp = 100 + (level * 20)
        armor = level * 2
        
        m = {
            "id": f"mob_{biome.lower()}_{i}",
            "name": f"{random.choice(prefixes)} {biome}",
            "biome": biome,
            "hp": hp,
            "maxHp": hp,
            "armor": armor,
            "speed": 0.05 + (random.random() * 0.05),
            "level": level,
            "stats": {
                "hp": hp,
                "maxHp": hp,
                "ap": 6,
                "mp": 3,
                "armor": armor
            }
        }
        monsters.append(m)
        
    return monsters

if __name__ == "__main__":
    db = {
        "STATION": generate_monster_db("STATION"),
        "FUNGARIA": generate_monster_db("FUNGARIA"),
        "AQUARYS": generate_monster_db("AQUARYS"),
        "DESERTICA": generate_monster_db("DESERTICA")
    }
    
    with open("public/data/monsters_gen.json", "w", encoding="utf-8") as f:
        json.dump(db, f, indent=4, ensure_ascii=False)
        
    print("✅ Base de données des monstres générée via Python pour le moteur Narvos.")
