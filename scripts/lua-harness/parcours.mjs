// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : ? ligne(s) attendue(s) ici, 77 connue(s)]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// parcourus, y compris celui qui compte le plus : le `DELETE ... AND compte_id`
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]
// [TROU — ligne jamais lue dans les transcriptions]

    function base:Execute(sql, ...)
        local a = { ... }
        self.requetes[#self.requetes + 1] = { sql = sql, args = a }

        if (sql:find("INSERT INTO personnages", 1, true)) then
            -- ⚠ L'ORDRE SUIT CELUI DU MODULE, colonne par colonne. Ajouter une
            -- colonne a l'INSERT sans la refleter ici decale TOUT ce qui suit :
            -- la tenue atterrit dans la colonne couleurs, et seul un test
            -- d'aller-retour le revele. C'est exactement ce qui s'est produit en
            -- ajoutant lore_id en 6e position.
            --
            -- (Pas d'accent grave dans ce commentaire : il vit dans un template
            -- literal JS, un seul backtick le terminerait.)
            self.lignes[#self.lignes + 1] = {
                id = a[1], compte_id = a[2], nom = a[3], class_id = a[4], genre = a[5],
                lore_id = a[6], corps = a[7], niveau = a[8], tenue = a[9],
                garde_robe = a[10], morphs = a[11], credits = a[12],
                couleurs = a[13], cree_le = a[14],
            }
            return 1
        end

        if (sql:find("DELETE FROM personnages", 1, true)) then
            -- Reproduit fidèlement le WHERE du module : id ET compte_id.
            -- Ignorer le second rendrait le test de suppression croisée vert à tort.
            for i, l in ipairs(self.lignes) do
                if (l.id == a[1] and l.compte_id == a[2]) then
                    table.remove(self.lignes, i)
                    return 1
                end
            end
            return 0
        end

        if (sql:find("UPDATE personnages SET morphs", 1, true)) then
            for _, l in ipairs(self.lignes) do
                if (l.id == a[2] and l.compte_id == a[3]) then
                    l.morphs = a[1]
                    return 1
                end
            end
            return 0
        end

        if (sql:find("UPDATE personnages SET garde_robe", 1, true)) then
            -- Meme WHERE que le module : id ET compte_id. L'ignorer rendrait vert
            -- le test qui verifie qu'un joueur ne rhabille pas le perso d'un autre.
            for _, l in ipairs(self.lignes) do
                if (l.id == a[3] and l.compte_id == a[4]) then
                    l.garde_robe = a[1]
                    l.credits = a[2]
                    return 1
                end
            end
            return 0
        end

        if (sql:find("UPDATE personnages SET tenue", 1, true)) then
            for _, l in ipairs(self.lignes) do
                if (l.id == a[2] and l.compte_id == a[3]) then
                    l.tenue = a[1]
                    return 1
                end
            end
            return 0
        end

        return 0
    end

    function base:Select(sql, ...)
        local a = { ... }
        self.requetes[#self.requetes + 1] = { sql = sql, args = a }

        local trouve = {}
// [ANCIENNE VERSION ↑]
// [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]
// [MODIFICATIONS NON REPLACÉES — 5 modification(s) faite(s) à ce fichier n'ont pas pu y être reportées (texte d'origine introuvable ou ambigu) : voir EDITS_NON_APPLIQUES]