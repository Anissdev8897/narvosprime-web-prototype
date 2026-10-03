# Caméra et HUD — validation du 14 septembre 2026

## Modifications

Dans `WebPortal/Server/nanos_world/packages/narvos-map-proto/Client/Index.lua` :
- Molette : lire le troisième argument de `MouseScroll(mouse_x, mouse_y, delta)` ; les coordonnées du curseur ne deviennent plus une distance de zoom.
- Zoom de jeu : utiliser MouseScroll et préserver la molette des menus ; retirer les touches MouseScrollUp/Down refusées par le client 1.154.
- Rotation de création : utiliser MouseMove(delta_x, delta_y) au lieu des événements MouseMoveX/Y dépréciés.
- HUD : le créer masqué, le masquer pendant la création et l'afficher lorsque la session passe en jeu, y compris sans page de création préalable.

## Preuves

Commande depuis la racine globale : `node scripts/lua-harness/tout.mjs`.
Résultat exécuté par Astra : 93 harnais, 10647 assertions réussies, 0 échec déclaré, 0 harnais rouge, code de sortie 0.
Journal : `.hermes/ASTRA_camera_hud_tests_2026-09-14.log`.
Le nouveau harnais `scripts/lua-harness/camera-entrees.mjs` exécute les callbacks réels avec les arguments documentés ; 25 assertions.

Sauvegarde du fichier initial : `.hermes/sauvegardes/astra-validation-2026-09-14/Client-Index.avant-camera-hud.lua`.
Sauvegarde SQLite effectuée par sqlite3.backup avant rechargement : `narvos_comptes.avant-rechargement.db` dans le même dossier.

Après confirmation de l'utilisateur et déconnexion du client, le serveur local a été redémarré (PID 27744). Démarrage réussi à 22:06:52, connexion Steam à 22:06:54 ; reconnexion du joueur observée à 22:07:39. Journal : `.hermes/ASTRA_serveur_camera_hud_2026-09-14.log`.

La validation visuelle du zoom et du HUD après rechargement reste à faire. Aucun résultat automatisé ne prouve le rendu en jeu. Aucun cook exécuté.

## Références officielles

- https://docs.nanos-world.com/docs/scripting-reference/static-classes/input
- https://docs.nanos-world.com/docs/scripting-reference/classes/webui

## Suite demandée

L'utilisateur signale des choix absents ou incorrects dans Meta Customization System et propose d'ouvrir Unreal avec son plugin. Projet NanosWorldADK.uproject lancé dans UE 5.7 ; UnrealMCPServer déjà activé.
Constat en lecture seule du générateur : 148/148 options cuites, 16 curseurs de corps, **0 de visage**. Le générateur ne trouve pas le manifeste facultatif metacustom-curseurs-visage.json. L'interface affiche explicitement « en cours de branchement » pour cette section. Examiner les graphes d'origine et les instances d'animation avant de créer les contrôles manquants.