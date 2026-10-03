-- Catalogue des PNJ places depuis le jeu avec `/exporter pnj`.
--
-- Le fichier est volontairement vide au depart. Server/Export.lua le remplace
-- par des points en coordonnees locales, avec le niveau choisi pour chaque PNJ.
-- Shared/Index.lua le charge au demarrage suivant et Server/Index.lua le fusionne
-- avec le peuplement de demonstration deja present.

local Peuplement = {}

Peuplement.MONDE = nil
Peuplement.LISTE = {}

return Peuplement
