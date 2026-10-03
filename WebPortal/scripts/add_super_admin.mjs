import mysql from 'mysql2/promise';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

function hashPassword(password) {
    // Générer un sel aléatoire de 16 octets
    const salt = crypto.randomBytes(16).toString('hex');
    // Hachage PBKDF2 : algo standard robuste (sha512, 1000 itérations)
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    // Format de stockage: salt:hash
    return `${salt}:${hash}`;
}

async function addSuperAdmin() {
    console.log('👑 AJOUT SUPER_ADMIN SÉCURISÉ: Aniss81');

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('❌ ERREUR: DATABASE_URL manquante.');
        process.exit(1);
    }

    let connection;
    try {
        connection = await mysql.createConnection(dbUrl);
        console.log('✅ Connecté à la base de données.');

        // 1. Mettre à jour la structure de la table pour autoriser 'SUPER_ADMIN'
        try {
            await connection.query(`
                ALTER TABLE users 
                MODIFY COLUMN role ENUM('USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN') DEFAULT 'USER'
            `);
        } catch (e) {
            // Ignorer si déjà fait
        }

        // 2. Insérer ou mettre à jour l'utilisateur (AVEC HASH)
        const username = 'Aniss81';
        const rawPassword = 'krimlosss900S';
        const passwordHash = hashPassword(rawPassword);
        const role = 'SUPER_ADMIN';

        console.log(`👤 Création/Mise à jour de l'utilisateur ${username}...`);
        console.log(`🔒 Mot de passe hashé (PBKDF2-SHA512)`);

        await connection.query(`
            INSERT INTO users (username, password_hash, role, last_login)
            VALUES (?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                password_hash = VALUES(password_hash),
                role = VALUES(role),
                last_login = NOW()
        `, [username, passwordHash, role]);

        console.log(`✅ SUCCÈS : L'utilisateur ${username} est maintenant SUPER_ADMIN avec un mot de passe sécurisé.`);

    } catch (error) {
        console.error('❌ ERREUR :', error.message);
    } finally {
        if (connection) await connection.end();
    }
}

addSuperAdmin();
