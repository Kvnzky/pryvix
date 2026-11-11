const asar = require('@electron/asar');
const fs = require('fs');
const path = require('path');

async function main() {
  const asarPath = path.join(__dirname, '../release/win-unpacked/resources/app.asar');
  const tempDir = path.join(__dirname, '../temp-asar-unpack');
  const distDir = path.join(__dirname, '../dist');
  const distElectronDir = path.join(__dirname, '../dist-electron');

  console.log('1. Extracting app.asar to temporary directory...');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  asar.extractAll(asarPath, tempDir);

  console.log('2. Updating dist/ in unpacked folder...');
  fs.cpSync(distDir, path.join(tempDir, 'dist'), { recursive: true, force: true });

  console.log('3. Updating dist-electron/ in unpacked folder...');
  fs.cpSync(distElectronDir, path.join(tempDir, 'dist-electron'), { recursive: true, force: true });

  const brandAssetsDir = path.join(__dirname, '../pryvix-brand-assets');
  if (fs.existsSync(brandAssetsDir)) {
    console.log('3b. Updating pryvix-brand-assets/ in unpacked folder...');
    fs.cpSync(brandAssetsDir, path.join(tempDir, 'pryvix-brand-assets'), { recursive: true, force: true });
  }

  console.log('4. Repacking app.asar...');
  await asar.createPackage(tempDir, asarPath);

  console.log('5. Cleaning up temp directory...');
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('SUCCESS: release/win-unpacked/resources/app.asar successfully updated with latest build!');
}

main().catch(err => {
  console.error('Error updating app.asar:', err);
  process.exit(1);
});
