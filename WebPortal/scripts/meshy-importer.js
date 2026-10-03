const fs = require('fs');
const path = require('path');

/**
 * Meshy-Importer Tool
 * Logic:
 * 1. Scan the configured Meshy output directory.
 * 2. Identify new .png assets.
 * 3. Copy/Move to public/assets/maps/YYYY-MM-DD/.
 * 4. Update maps-manifest.json.
 */

const CONFIG = {
  meshyOutputDir: path.join('c:', 'Users', 'aniss', 'OneDrive', 'Bureau', 'launcher_2', 'meshy_outputs'),
  targetDir: path.join(__dirname, '..', 'public', 'assets', 'maps'),
  manifestPath: path.join(__dirname, '..', 'public', 'assets', 'maps', 'manifest.json')
};

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getTimestamp() {
  return new Date().toISOString().split('T')[0];
}

async function runImporter() {
  console.log('🚀 Starting Meshy Importer...');
  
  if (!fs.existsSync(CONFIG.meshyOutputDir)) {
    console.error(`❌ Error: Meshy output directory not found at ${CONFIG.meshyOutputDir}`);
    return;
  }

  ensureDirectory(CONFIG.targetDir);
  const dateFolder = getTimestamp();
  const finalDest = path.join(CONFIG.targetDir, dateFolder);
  ensureDirectory(finalDest);

  const files = fs.readdirSync(CONFIG.meshyOutputDir);
  const mapFiles = files.filter(f => f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.jpg'));

  console.log(`🔍 Found ${mapFiles.length} potential assets.`);

  let manifest = { maps: [] };
  if (fs.existsSync(CONFIG.manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(CONFIG.manifestPath, 'utf8'));
  }

  mapFiles.forEach((file, index) => {
    const safeName = `map_${Date.now()}_${index}.png`;
    const sourcePath = path.join(CONFIG.meshyOutputDir, file);
    const destPath = path.join(finalDest, safeName);

    // Copy file
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Imported: ${file} -> ${dateFolder}/${safeName}`);

    // Update Manifest
    manifest.maps.push({
      id: safeName.replace('.png', ''),
      originalName: file,
      path: `assets/maps/${dateFolder}/${safeName}`,
      date: dateFolder,
      importedAt: new Date().toISOString()
    });
  });

  // Save Manifest
  fs.writeFileSync(CONFIG.manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\n🎉 Import Complete! Manifest updated at ${CONFIG.manifestPath}`);
}

runImporter().catch(err => {
  console.error('💥 Critical Error:', err);
});
