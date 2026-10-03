-- Assemblages vérifiés dans l'ADK le 15/09/2026. Les IDs restent indépendants
-- des clés Assets.toml, qui ne seront connues qu'après cook et génération.
-- Un Blueprint visible n'est pas un véhicule nanos pilotable : aucune entrée
-- n'est proposée au spawn avant validation de son contrôleur et de sa livraison.
local Vaisseaux = {
    { id = "sp1_fighter", label = "Chasseur GB4", categorie = "vaisseau", disponible = false,
      statut = "Pilotage indisponible", blueprint = "/Game/Narvos/SpaceShips_Vol1/Blueprints/BP_GB4_Fighter" },
    { id = "sp1_supercarrier", label = "Porte-vaisseaux GB4", categorie = "vaisseau", disponible = false,
      statut = "Pilotage indisponible", blueprint = "/Game/Narvos/SpaceShips_Vol1/Blueprints/BP_GB4_SuperCarrier" },
    { id = "sp1_frigate", label = "Frégate GB5", categorie = "vaisseau", disponible = false,
      statut = "Pilotage indisponible", blueprint = "/Game/Narvos/SpaceShips_Vol1/Blueprints/BP_GB5_NukeFrigate" },
    { id = "sp1_dreadnought", label = "Dreadnought GB6", categorie = "vaisseau", disponible = false,
      statut = "Pilotage indisponible", blueprint = "/Game/Narvos/SpaceShips_Vol1/Blueprints/BP_GB6_Dreadnought" },
    { id = "sp1_commander", label = "Vaisseau de commandement GB7", categorie = "vaisseau", disponible = false,
      statut = "Pilotage indisponible", blueprint = "/Game/Narvos/SpaceShips_Vol1/Blueprints/BP_GB7_CommanderShip" },
}
return Vaisseaux
