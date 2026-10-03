import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

async function initDatabase() {
    console.log('🔄 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - DATABASE INITIALIZER');
    console.log('═══════════════════════════════════════════════════════════\n');

    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
        console.error('❌ ERREUR: DATABASE_URL n\'est pas définie dans le fichier .env');
        console.log('   Veuillez configurer votre connexion MySQL (ex: mysql://root:@localhost:3306/worldnevaros)');
        process.exit(1);
    }

    console.log(`📡 Configuration trouvée: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`); // Masquer mot de passe

    let connection;
    try {
        // 1. Parsing de l'URL pour séparer serveur et base de données
        let dbName = 'worldnevaros';
        let rootUrl = dbUrl;

        try {
            const dbUrlObj = new URL(dbUrl);
            const pathName = dbUrlObj.pathname.substring(1); // Enlever le '/'
            if (pathName) dbName = pathName;

            // Reconstruire l'URL sans la base de données pour la connexion root
            dbUrlObj.pathname = '/';
            rootUrl = dbUrlObj.toString();
        } catch (e) {
            console.warn("⚠️ Impossible de parser l'URL de base de données, tentative de connexion directe...");
        }

        console.log(`📡 Connexion au serveur MySQL (pour vérifier la base '${dbName}')...`);

        // Connexion au serveur racine (sans sélectionner de DB spécifique si possible)
        connection = await mysql.createConnection(rootUrl);

        // 2. Création de la base de données si elle n'existe pas
        console.log(`🔨 Vérification/Création de la base de données...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        console.log(`✅ Base de données '${dbName}' validée.`);

        // Fermer la connexion racine
        await connection.end();

        // 3. Connexion à la base de données cible avec support multi-statements
        // On modifie l'URL d'origine pour s'assurer qu'elle pointe bien vers la bonne DB si ce n'était pas le cas
        // Mais si dbUrl était déjà correcte, on l'utilise.
        // On ajoute le flag multipleStatements si nécessaire, mais createConnection(config) est mieux.

        // On va parser à nouveau pour construire l'objet config
        // Note: mysql2 gère mal multipleStatements dans l'URL string parfois, mieux vaut passer un objet config si possible
        // Mais pour simplifier, on réutilise l'URL et on espère que la DB est bien ciblée.
        // Si l'URL d'origine avait la DB, c'est bon. Sinon on doit la rajouter.

        const targetUrlObj = new URL(dbUrl);
        if (targetUrlObj.pathname === '/' || targetUrlObj.pathname === '') {
            targetUrlObj.pathname = `/${dbName}`;
        }

        console.log(`🚀 Connexion à ${dbName} pour exécution du script...`);

        connection = await mysql.createConnection({
            uri: targetUrlObj.toString(),
            multipleStatements: true
        });

        // 4. Lecture et exécution du script SQL
        const sqlPath = path.join(__dirname, 'init_worldnevaros.sql');
        console.log(`📄 Lecture du script SQL : ${sqlPath}`);

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`Le fichier SQL est introuvable: ${sqlPath}`);
        }

        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('⚡ Exécution des requêtes SQL...');
        await connection.query(sqlContent);

        console.log('\n✅ SUCCÈS : Base de données initialisée !');
        console.log('   - Tables créées (users, characters, scenes...)');
        console.log('   - Données de test insérées');
        console.log('   - Utilisateurs créés: "admin" (mdp: admin123), "testplayer" (mdp: nevaros)');

    } catch (error) {
        console.error('\n❌ ÉCHEC DE L\'INITIALISATION :');
        console.error('   ' + error.message);
        console.error('\n   Vérifiez que votre serveur MySQL est bien lancé (WAMP/XAMPP/Docker) et que les identifiants dans .env sont corrects.');
    } finally {
        if (connection && typeof connection.end === 'function') {
            await connection.end();
        }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
}

initDatabase();
