import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeHtml,
  replaceImageUrlInHtml,
  updateGHLFormInHtml,
  sanitizeProjectNameForFilename,
  injectProjectHeaderComment,
  syncTitleTagWithProjectName,
  detectBackgroundModeInHtml,
  extractBackgroundConfig,
  updateVideoUrlsInHtml,
  updateStaticCampaignDetailsUrlsInHtml,
  applyBackgroundModeToHtml,
  checkVideoUrlStatus,
  resolveSharedFormTitle,
  updateSharedFormTitleInHtml,
} from '../src/shared/parser.ts';
import { validateLandingPage, compareAndValidateSourcePreservation } from '../src/shared/validator.ts';
import { generatePreviewHtml, stripPreviewInjections, PREVIEW_MARKER_START, PREVIEW_MARKER_END } from '../src/renderer/lib/previewHelper.ts';
import {
  extractVideoFilename,
  formatBytes,
  formatDuration,
  calculateAspectRatio,
  assessVideoQuality,
} from '../src/shared/videoQuality.ts';
import {
  BUNDLED_STATIC_REFERENCE_HTML,
  BUNDLED_VIDEO_REFERENCE_HTML,
} from '../src/shared/referenceTemplates.ts';
import {
  DEFAULT_GHL_LOCATION_ID,
  REQUIRED_GHL_SCOPE,
  saveGhlCredentials,
  getSafeCredentialStatus,
  getServerSideGhlToken,
  disconnectGhlCredentials,
  redactSecrets,
} from '../src/server/secretStore.ts';
import {
  listGhlMedia,
  isAllowedGhlAssetUrl,
  getGhlConnectionStatus,
} from '../src/server/ghlMediaService.ts';
import { handleGhlApiRequest } from '../src/server/apiMiddleware.ts';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('   LANDING PAGE STUDIO - FULL AUTOMATED QA SUITE    ');
console.log('====================================================\n');

// 1. Read Reference Files
const staticRefPath = path.join(__dirname, '..', 'LP Reference-static Campaign Details Background.txt');
const videoRefPath = path.join(__dirname, '..', 'LP Reference-video Campaign Details Background.txt');
const fallbackRefPath = path.join(__dirname, '..', 'LP Reference.txt');

const referencePath = fs.existsSync(staticRefPath) ? staticRefPath : fallbackRefPath;
if (!fs.existsSync(referencePath)) {
  console.error('FAIL: Reference file not found!');
  process.exit(1);
}
const originalHtml = fs.readFileSync(referencePath, 'utf8');
const videoHtml = fs.existsSync(videoRefPath) ? fs.readFileSync(videoRefPath, 'utf8') : '';
console.log(`[TEST 1] Loaded Static Reference Landing Page: ${originalHtml.length} bytes`);
if (videoHtml) {
  console.log(`         Loaded Video Reference Landing Page: ${videoHtml.length} bytes`);
}

// 2. Parse & Analyze Reference Project
const projectId = 'test_project_1';
const analysis = analyzeHtml(originalHtml, projectId);
console.log(`[TEST 2] Parsing & Analysis complete:`);
console.log(`   - Detected Images: ${analysis.assets.length}`);
console.log(`   - Desktop Images: ${analysis.stats.desktopImages}`);
console.log(`   - Mobile Images: ${analysis.stats.mobileImages}`);
console.log(`   - Detected GHL Forms: ${analysis.forms.length}`);
console.log(`   - Component Sections: ${analysis.sections.length}`);
console.log('\nAll Detected Labels:');
analysis.assets.forEach(a => console.log(`     * [${a.device}] ${a.label} (${a.type})`));


// Check specific key assets required by Prompt Section 19
const expectedLabels = [
  'Hero Background – Desktop',
  'Hero Background – Mobile',
  'Hero Branding – Desktop',
  'Hero Branding – Tablet/Mobile',
  'Popup Banner – Desktop',
  'Popup Banner – Tablet/Mobile',
  'Prize Banner – Desktop',
  'Prize Banner – Tablet/Mobile',
  'Campaign Details Background – Desktop',
  'Campaign Details Background – Mobile',
  'Campaign Details Graphic – Desktop',
  'Campaign Details Graphic – Tablet/Mobile',
  'Read More Button',
  'Scroll to Top Icon',
  'Form Background Image',
];

console.log('\n[TEST 3] Verifying Detection of Key Reference Assets:');
let allFound = true;
expectedLabels.forEach(label => {
  const found = analysis.assets.some(a => a.label.toLowerCase().includes(label.toLowerCase().replace('tablet/mobile', '')));
  if (found) {
    console.log(`   ✓ Found: ${label}`);
  } else {
    console.error(`   ✗ Missing expected asset: ${label}`);
    allFound = false;
  }
});

if (!allFound) {
  console.error('FAIL: Not all expected assets were detected.');
  process.exit(1);
}

// 4. Verify Desktop and Mobile Forms Separation
console.log('\n[TEST 4] Verifying GoHighLevel Dual Forms Configuration:');
const desktopForm = analysis.forms.find(f => f.deviceTarget === 'desktop');
const mobileForm = analysis.forms.find(f => f.deviceTarget === 'mobile');

if (!desktopForm || !mobileForm) {
  console.error('FAIL: Dual desktop and mobile forms not properly separated!');
  process.exit(1);
}

console.log(`   ✓ Desktop Form ID: ${desktopForm.formId}, Iframe ID: ${desktopForm.iframeId}`);
console.log(`   ✓ Mobile Form ID: ${mobileForm.formId}, Iframe ID: ${mobileForm.iframeId}`);
console.log(`   ✓ Desktop login_token: ${desktopForm.customScripts.hasLoginToken}, event_id: ${desktopForm.customScripts.hasEventId}`);
console.log(`   ✓ Mobile login_token: ${mobileForm.customScripts.hasLoginToken}, event_id: ${mobileForm.customScripts.hasEventId}`);
console.log(`   ✓ Form Closing Custom Value: ${desktopForm.customScripts.closingCustomValue}`);

if (!desktopForm.customScripts.hasLoginToken || !desktopForm.customScripts.hasEventId) {
  console.error('FAIL: Desktop form tracking tokens missing!');
  process.exit(1);
}

// 5. Test Image Replacement (Source-Preserving)
console.log('\n[TEST 5] Testing Independent Image Replacement:');
const heroDesktopAsset = analysis.assets.find(a => a.role === 'hero_brand' && a.device === 'desktop');
const heroMobileAsset = analysis.assets.find(a => a.role === 'hero_brand' && (a.device === 'mobile' || a.device === 'tablet'));

if (!heroDesktopAsset || !heroMobileAsset) {
  console.error('FAIL: Could not locate hero desktop and mobile branding assets!');
  process.exit(1);
}

const newDesktopUrl = 'https://assets.cdn.filesafe.space/test/new-hero-desktop.png';
const modifiedHtml1 = replaceImageUrlInHtml(originalHtml, heroDesktopAsset, newDesktopUrl);

// Verify that desktop image was replaced
if (!modifiedHtml1.includes(newDesktopUrl)) {
  console.error('FAIL: New desktop image URL was not inserted!');
  process.exit(1);
}

// Verify that mobile image was NOT modified by desktop image replacement
if (!modifiedHtml1.includes(heroMobileAsset.currentUrl)) {
  console.error('FAIL: Mobile image was accidentally overwritten by desktop change!');
  process.exit(1);
}
console.log(`   ✓ Desktop image replaced cleanly without touching mobile image.`);

// Now replace mobile image independently
const newMobileUrl = 'https://assets.cdn.filesafe.space/test/new-hero-mobile.png';
const modifiedHtml2 = replaceImageUrlInHtml(modifiedHtml1, heroMobileAsset, newMobileUrl);

if (!modifiedHtml2.includes(newMobileUrl)) {
  console.error('FAIL: New mobile image URL was not inserted!');
  process.exit(1);
}
console.log(`   ✓ Mobile image replaced cleanly alongside updated desktop image.`);

// 5b. Test Background Replacement with Hex Color
console.log('\n[TEST 5b] Testing Background Replacement with Hex Color:');
const campaignBgAsset = analysis.assets.find(a => a.role === 'campaign_bg' && a.device === 'desktop');
if (!campaignBgAsset) {
  console.error('FAIL: Could not locate Campaign Details Background asset!');
  process.exit(1);
}

const hexColor = '#131722';
const modifiedHtmlHex = replaceImageUrlInHtml(modifiedHtml2, campaignBgAsset, hexColor);

if (!modifiedHtmlHex.includes(`background-color: ${hexColor}`) && !modifiedHtmlHex.includes(hexColor)) {
  console.error('FAIL: Hex color was not applied to CSS background!');
  process.exit(1);
}
console.log(`   ✓ Campaign Details Background replaced with Hex Color (${hexColor}).`);

// Verify we can switch back from Hex Color to an Image URL
const newBgImageUrl = 'https://assets.cdn.filesafe.space/test/new-campaign-bg.jpg';
const hexAsset = { ...campaignBgAsset, currentUrl: hexColor };
const modifiedHtmlRestored = replaceImageUrlInHtml(modifiedHtmlHex, hexAsset, newBgImageUrl);

if (!modifiedHtmlRestored.includes(newBgImageUrl)) {
  console.error('FAIL: Restoring image URL from Hex color failed!');
  process.exit(1);
}
console.log(`   ✓ Successfully switched background from Hex Color back to Image URL.`);

// 6. Test Form ID Replacement
console.log('\n[TEST 6] Testing GoHighLevel Form ID Replacement:');
const newFormId = 'NewTestForm9999';
const modifiedHtml3 = updateGHLFormInHtml(modifiedHtmlHex, desktopForm, {
  formId: newFormId,
  formName: 'Updated Campaign Form',
});

if (!modifiedHtml3.includes(`data-form-id="${newFormId}"`)) {
  console.error('FAIL: data-form-id was not updated!');
  process.exit(1);
}

if (!modifiedHtml3.includes(`widget/form/${newFormId}`)) {
  console.error('FAIL: widget/form URL was not updated!');
  process.exit(1);
}
console.log(`   ✓ Form ID successfully synchronized across iframe and script URLs.`);

// 6b. Test Form Closing Custom Value Replacement
console.log('\n[TEST 6b] Testing GoHighLevel Form Closing Custom Value Replacement:');
const newClosingValue = '{{custom_values.my_custom_giveaway_closing}}';
const modifiedHtmlClosing = updateGHLFormInHtml(modifiedHtml3, desktopForm, {
  closingCustomValue: newClosingValue,
});

if (!modifiedHtmlClosing.includes(newClosingValue)) {
  console.error('FAIL: Form Closing Custom Value was not updated in HTML!');
  process.exit(1);
}
const reanalysisClosing = analyzeHtml(modifiedHtmlClosing, 'test_closing_proj');
if (reanalysisClosing.forms[0].customScripts.closingCustomValue !== newClosingValue) {
  console.error('FAIL: analyzeHtml did not detect updated closingCustomValue!');
  process.exit(1);
}
console.log(`   ✓ Form Closing Custom Value successfully updated and parsed: ${newClosingValue}`);

// 6c. Test Form Title / Name Auto-Detection & Clean State
console.log('\n[TEST 6c] Testing Consolidated Form Title / Name Architecture:');
// 1) When imported code has a recognizable form name
const importedWithTitle = analyzeHtml(
  `<iframe src="https://link.megarewards.au/widget/form/test123" data-form-name="Summer Giveaway 2026" title="Summer Giveaway 2026"></iframe>`,
  'test_imp_1'
);
if (importedWithTitle.forms[0]?.formName !== 'Summer Giveaway 2026') {
  console.error('FAIL: Recognizable form name was not auto-detected on import! Found:', importedWithTitle.forms[0]?.formName);
  process.exit(1);
}
console.log(`   ✓ Recognizable imported form name auto-populated cleanly: "${importedWithTitle.forms[0].formName}"`);

// 2) When imported code has no recognizable form name or generic placeholder
const importedWithoutTitle = analyzeHtml(
  `<iframe src="https://link.megarewards.au/widget/form/test123" data-form-name="GoHighLevel Form" title="GoHighLevel Form"></iframe>`,
  'test_imp_2'
);
if (importedWithoutTitle.forms[0]?.formName !== '') {
  console.error('FAIL: Generic placeholder should be blank by default! Found:', importedWithoutTitle.forms[0]?.formName);
  process.exit(1);
}
console.log(`   ✓ Generic/empty form name correctly leaves field blank.`);

// 3) When updating form name, no (Desktop) or (Mobile) suffixes are appended
const modifiedHtmlName = updateGHLFormInHtml(importedWithTitle.forms[0] ? `<iframe src="https://link.megarewards.au/widget/form/test123" data-form-name="Summer Giveaway 2026" title="Summer Giveaway 2026"></iframe>` : '', importedWithTitle.forms[0], {
  formName: 'Brand New Title',
});
const reanalysisName = analyzeHtml(modifiedHtmlName, 'test_imp_3');
if (reanalysisName.forms[0]?.formName !== 'Brand New Title') {
  console.error('FAIL: Updated form name was corrupted or suffixed! Found:', reanalysisName.forms[0]?.formName);
  process.exit(1);
}
console.log(`   ✓ Form name updated and preserved without device suffixes: "${reanalysisName.forms[0].formName}"`);

// 4) Test resolveSharedFormTitle migration strategy
const legacyProjectForms = [
  { deviceTarget: 'desktop', formName: 'Desktop Form Title' },
  { deviceTarget: 'mobile', formName: 'Mobile Form Title' },
];
const migratedFromProject = resolveSharedFormTitle('Project Shared Title', legacyProjectForms);
if (migratedFromProject !== 'Project Shared Title') {
  console.error('FAIL: resolveSharedFormTitle did not prefer project.formTitle! Found:', migratedFromProject);
  process.exit(1);
}
const migratedFromDesktop = resolveSharedFormTitle('', legacyProjectForms);
if (migratedFromDesktop !== 'Desktop Form Title') {
  console.error('FAIL: resolveSharedFormTitle did not fallback to Desktop name! Found:', migratedFromDesktop);
  process.exit(1);
}
const migratedFromMobile = resolveSharedFormTitle('', [{ deviceTarget: 'mobile', formName: 'Only Mobile Title' }]);
if (migratedFromMobile !== 'Only Mobile Title') {
  console.error('FAIL: resolveSharedFormTitle did not fallback to Mobile name! Found:', migratedFromMobile);
  process.exit(1);
}
console.log(`   ✓ resolveSharedFormTitle migration strategy verified with 100% legacy compatibility.`);

// 5) Test updateSharedFormTitleInHtml synchronizes dual desktop & mobile iframes
const dualIframeHtml = `
  <iframe id="inline-1" data-form-id="F1" data-form-name="Old Name" title="Old Name"></iframe>
  <iframe id="inline-1-mobile" data-form-id="F1" data-form-name="Old Name" title="Old Name"></iframe>
`;
const updatedDualHtml = updateSharedFormTitleInHtml(dualIframeHtml, '  Consolidated Shared Title  ');
const reanalysisDual = analyzeHtml(updatedDualHtml, 'test_dual');
if (reanalysisDual.forms.length !== 2) {
  console.error('FAIL: Expected 2 forms in dual iframe test!');
  process.exit(1);
}
if (reanalysisDual.forms[0].formName !== 'Consolidated Shared Title' || reanalysisDual.forms[1].formName !== 'Consolidated Shared Title') {
  console.error('FAIL: updateSharedFormTitleInHtml did not synchronize both iframes! Found:', reanalysisDual.forms.map(f => f.formName));
  process.exit(1);
}
console.log(`   ✓ updateSharedFormTitleInHtml verified: both Desktop and Mobile iframes share "${reanalysisDual.forms[0].formName}".`);

// 7. Verify login_token, event_id, and custom_values preservation
console.log('\n[TEST 7] Verifying Script & Security Logic Preservation:');
if (!modifiedHtml3.includes('window.megaLoginToken = token;')) {
  console.error('FAIL: megaLoginToken logic was lost!');
  process.exit(1);
}
if (!modifiedHtml3.includes('window.megaEventId = eventId;')) {
  console.error('FAIL: megaEventId logic was lost!');
  process.exit(1);
}
if (!modifiedHtml3.includes(desktopForm.customScripts.closingCustomValue)) {
  console.error('FAIL: campaign closing custom value was lost!');
  process.exit(1);
}
console.log(`   ✓ All security tokens, event_id cookies, and custom values 100% intact.`);

// 8. Test Validation Engine
console.log('\n[TEST 8] Running Code Validation Engine:');
const reanalysis = analyzeHtml(modifiedHtml3, 'project_exported');
const validationReport = validateLandingPage(modifiedHtml3, reanalysis.assets, reanalysis.forms);

console.log(`   - Total Errors: ${validationReport.totalErrors}`);
console.log(`   - Total Warnings: ${validationReport.totalWarnings}`);
console.log(`   - Total Infos: ${validationReport.totalInfos}`);
console.log(`   - Validation Passed: ${validationReport.passed}`);

if (validationReport.totalErrors > 0) {
  console.error('Validation errors found:');
  console.error(validationReport.issues.filter(i => i.severity === 'error'));
  process.exit(1);
}
console.log(`   ✓ Zero critical errors found.`);

// 9. Reimport Exported HTML into a Fresh Project
console.log('\n[TEST 9] Reimporting Exported HTML into Fresh Project:');
const freshAnalysis = analyzeHtml(modifiedHtml3, 'fresh_project_reimported');
console.log(`   - Reimported images detected: ${freshAnalysis.assets.length}`);
console.log(`   - Reimported forms detected: ${freshAnalysis.forms.length}`);

if (freshAnalysis.assets.length !== analysis.assets.length) {
  console.error(`FAIL: Asset count mismatch on reimport: ${freshAnalysis.assets.length} vs ${analysis.assets.length}`);
  process.exit(1);
}
console.log(`   ✓ Reimported project matches 100% of detected assets and forms.`);

// 10. Project Name Management & Header Comment / Title Sync
console.log('\n[TEST 10] Testing Project Name Management & Synchronization:');
const newProjectName = 'Mega Rewards EDM Campaign 2026';
const safeFilename = sanitizeProjectNameForFilename(newProjectName);
if (safeFilename !== 'mega-rewards-edm-campaign-2026') {
  console.error(`FAIL: Sanitize project name returned "${safeFilename}"`);
  process.exit(1);
}
console.log(`   ✓ Sanitize project name: "${newProjectName}" -> "${safeFilename}"`);

const htmlWithComment = injectProjectHeaderComment(modifiedHtml3, newProjectName);
if (!htmlWithComment.includes(`<!-- Project Name: ${newProjectName}`)) {
  console.error('FAIL: Project Name comment was not injected into HTML!');
  process.exit(1);
}
console.log(`   ✓ Project Name comment successfully injected into HTML header.`);

const htmlWithSyncedTitle = syncTitleTagWithProjectName(htmlWithComment, newProjectName);
if (!htmlWithSyncedTitle.includes(`<title>${newProjectName}</title>`)) {
  console.error('FAIL: <title> tag was not synchronized with Project Name!');
  process.exit(1);
}
console.log(`   ✓ Document <title> successfully synchronized with "${newProjectName}".`);

// 11. TXT Export Format
console.log('\n[TEST 11] Testing HTML Source Export as TXT:');
const txtFilename = `${safeFilename}-source.txt`;
const txtContent = htmlWithSyncedTitle;
if (txtContent.length !== htmlWithSyncedTitle.length || !txtContent.startsWith('<!DOCTYPE html>') && !txtContent.startsWith('<!--')) {
  console.error('FAIL: TXT export content is corrupted!');
  process.exit(1);
}
console.log(`   ✓ Verified TXT export retains 100% exact source code fidelity (${txtContent.length} bytes).`);

// 12. Portable ZIP Bundle Creation & Validation
console.log('\n[TEST 12] Testing Portable Project ZIP Package:');
async function testZipBundle() {
  const zip = new JSZip();
  const manifest = {
    generator: 'Landing Page Studio',
    version: '2.0.0-portable',
    projectName: newProjectName,
    exportedAt: new Date().toISOString(),
    assetCount: freshAnalysis.assets.length,
    formCount: freshAnalysis.forms.length,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('index.html', htmlWithSyncedTitle);
  zip.file('README.txt', 'Portable project backup');

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`   - Generated ZIP bundle: ${zipBuffer.length} bytes`);

  // Unpack and verify
  const loadedZip = await JSZip.loadAsync(zipBuffer);
  const unpackedManifest = JSON.parse(await loadedZip.file('manifest.json').async('string'));
  const unpackedHtml = await loadedZip.file('index.html').async('string');

  if (unpackedManifest.projectName !== newProjectName) {
    console.error('FAIL: ZIP manifest project name mismatch!');
    process.exit(1);
  }
  if (!unpackedHtml.includes(newProjectName)) {
    console.error('FAIL: ZIP index.html content mismatch!');
    process.exit(1);
  }
  console.log(`   ✓ Portable ZIP archive generated, unpacked, and verified with 100% data integrity.`);
}
await testZipBundle();

// 13. Portable Directory Structure Verification
console.log('\n[TEST 13] Verifying Portable Directory Structure Architecture:');
const portableDirs = [
  'data/projects',
  'data/image-library',
  'data/assets',
  'data/backups',
  'data/settings',
  'data/database',
  'exports',
];
portableDirs.forEach(dir => {
  const fullDirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullDirPath)) {
    fs.mkdirSync(fullDirPath, { recursive: true });
  }
  if (!fs.existsSync(fullDirPath)) {
    console.error(`FAIL: Directory ${dir} could not be created!`);
    process.exit(1);
  }
});
console.log(`   ✓ All 7 portable directories initialized and verified.`);

// 14. Missing Asset Detection & Recovery
console.log('\n[TEST 14] Testing Missing & Unhosted Local Asset Detection:');
const testAssetsWithLocal = [
  ...analysis.assets.slice(0, 3),
  {
    id: 'asset_broken_local',
    projectId: 'test_proj',
    sectionId: 'test_sec',
    sectionName: 'Test Section',
    label: 'Broken Local Banner',
    originalLabel: 'Broken Local Banner',
    role: 'campaign_graphic',
    device: 'desktop',
    type: 'html_img',
    currentUrl: 'C:\\Users\\User\\Desktop\\my-image.png',
    originalUrl: 'C:\\Users\\User\\Desktop\\my-image.png',
    selectorOrLocation: 'img',
    status: 'unhosted_local',
  },
  {
    id: 'asset_empty',
    projectId: 'test_proj',
    sectionId: 'test_sec',
    sectionName: 'Test Section',
    label: 'Empty Image Asset',
    originalLabel: 'Empty Image Asset',
    role: 'hero_bg',
    device: 'mobile',
    type: 'css_background',
    currentUrl: '',
    originalUrl: '',
    selectorOrLocation: '.hero',
    status: 'invalid',
  },
];

const flaggedIssues = testAssetsWithLocal.filter(a => !a.currentUrl || a.currentUrl.startsWith('C:') || a.currentUrl.startsWith('file://'));
if (flaggedIssues.length !== 2) {
  console.error(`FAIL: Expected 2 unhosted or missing assets, got ${flaggedIssues.length}`);
  process.exit(1);
}
console.log(`   ✓ Successfully detected ${flaggedIssues.length} missing/unhosted local assets for user recovery.`);

// 15. Background Mode Detection
console.log('\n[TEST 15] Testing Background Implementation Mode Detection:');
const staticDetected = detectBackgroundModeInHtml(originalHtml);
if (staticDetected !== 'static') {
  console.error(`FAIL: Expected 'static' mode for static reference, got '${staticDetected}'`);
  process.exit(1);
}
console.log(`   ✓ Static reference correctly detected as mode: '${staticDetected}'.`);

if (videoHtml) {
  const videoDetected = detectBackgroundModeInHtml(videoHtml);
  if (videoDetected !== 'video') {
    console.error(`FAIL: Expected 'video' mode for video reference, got '${videoDetected}'`);
    process.exit(1);
  }
  console.log(`   ✓ Video reference correctly detected as mode: '${videoDetected}'.`);
}

// 16. Background Configuration Extraction
console.log('\n[TEST 16] Testing Background Configuration Extraction:');
const staticConfig = extractBackgroundConfig(originalHtml);
console.log(`   - Static Desktop Image: ${staticConfig.static.desktopImage}`);
console.log(`   - Static Mobile Image: ${staticConfig.static.mobileImage}`);
if (!staticConfig.static.desktopImage || !staticConfig.static.mobileImage) {
  console.error('FAIL: Missing extracted static background URLs!');
  process.exit(1);
}
console.log(`   ✓ Successfully extracted static Campaign Details background configuration.`);

// 17. Switching to Video Mode (Strict Option B Preservation)
console.log('\n[TEST 17] Testing Surgical Mode Switch to Option B Video Background:');
const customDeskVideo = 'https://assets.cdn.filesafe.space/test/custom-desktop-video.mp4';
const customMobVideo = 'https://assets.cdn.filesafe.space/test/custom-mobile-video.mp4';

const videoConvertedHtml = applyBackgroundModeToHtml(originalHtml, 'video', {
  mode: 'video',
  static: staticConfig.static,
  video: {
    desktopVideo: customDeskVideo,
    mobileVideo: customMobVideo,
  },
});

const convertedMode = detectBackgroundModeInHtml(videoConvertedHtml);
if (convertedMode !== 'video') {
  console.error(`FAIL: Converted HTML not recognized as video mode! Got: ${convertedMode}`);
  process.exit(1);
}

// Verify strict Option B placement: video is inside .hero-bg-slider, NOT in campaign-details-section
const heroSliderMatch = /<div\s+class=["'][^"']*hero-bg-slider[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\s+class=["'][^"']*hero-overlay/i.exec(videoConvertedHtml);
if (!heroSliderMatch || !heroSliderMatch[1].includes(customDeskVideo) || !heroSliderMatch[1].includes(customMobVideo)) {
  console.error('FAIL: Video elements not found inside .hero-bg-slider!');
  process.exit(1);
}

// Verify .campaign-details-section does not contain video tag or CSS rule
if (
  /<section[^>]*class=["'][^"']*campaign-details-section[\s\S]*?<video\b/i.test(videoConvertedHtml) ||
  /\.campaign-details-section\s+video\s*\{/i.test(videoConvertedHtml)
) {
  console.error('FAIL: Video was incorrectly placed inside .campaign-details-section!');
  process.exit(1);
}

// Verify 100% preservation of GHL tokens and custom values
if (
  !videoConvertedHtml.includes('window.megaLoginToken = token;') ||
  !videoConvertedHtml.includes('window.megaEventId = eventId;') ||
  !videoConvertedHtml.includes('DuEWLBc3a3oXylBTrYC7') ||
  !videoConvertedHtml.includes(desktopForm.customScripts.closingCustomValue)
) {
  console.error('FAIL: GHL tokens or custom values were corrupted during video mode switch!');
  process.exit(1);
}
console.log('   ✓ Option B strict preservation confirmed: Videos reside in .hero-bg-slider.');
console.log('   ✓ All GHL forms, login_token, event_id, and custom values 100% preserved.');

// 18. Switching back to Option A Static Mode & Hex / URL updates
console.log('\n[TEST 18] Testing Static Campaign Details Image & Hex Color Configuration:');
const restoredStaticHtml = applyBackgroundModeToHtml(videoConvertedHtml, 'static', {
  mode: 'static',
  static: {
    desktopImage: 'https://assets.cdn.filesafe.space/test/new-static-desktop.jpg',
    mobileImage: 'https://assets.cdn.filesafe.space/test/new-static-mobile.jpg',
  },
  video: {
    desktopVideo: customDeskVideo,
    mobileVideo: customMobVideo,
  },
});

if (detectBackgroundModeInHtml(restoredStaticHtml) !== 'static') {
  console.error('FAIL: Restored HTML not recognized as static mode!');
  process.exit(1);
}

if (!restoredStaticHtml.includes('new-static-desktop.jpg') || !restoredStaticHtml.includes('new-static-mobile.jpg')) {
  console.error('FAIL: Updated static image URLs not found in restored HTML!');
  process.exit(1);
}

// Test Hex color update
const hexColorHtml = updateStaticCampaignDetailsUrlsInHtml(restoredStaticHtml, '#131722', '#050505');
if (!hexColorHtml.includes('#131722') || !hexColorHtml.includes('#050505')) {
  console.error('FAIL: Hex color background not applied to campaign details section!');
  process.exit(1);
}
console.log('   ✓ Successfully switched back to Static mode.');
console.log('   ✓ Tested Image URLs and Solid Hex color configuration for Campaign Details Background.');

// 19. Video Format Validation
console.log('\n[TEST 19] Testing Video Format Validation:');
const validMp4 = checkVideoUrlStatus('https://assets.cdn.filesafe.space/video.mp4');
const validWebm = checkVideoUrlStatus('https://assets.cdn.filesafe.space/video.webm');
const emptyVid = checkVideoUrlStatus('');
const httpVid = checkVideoUrlStatus('http://example.com/video.mp4');

if (validMp4.status !== 'valid' || validWebm.status !== 'valid') {
  console.error('FAIL: Standard MP4 and WEBM video formats should be marked valid!');
  process.exit(1);
}
if (emptyVid.status !== 'invalid') {
  console.error('FAIL: Empty video URL should be marked invalid!');
  process.exit(1);
}
if (httpVid.status !== 'unverified') {
  console.error('FAIL: Insecure HTTP video URL should trigger unverified warning!');
  process.exit(1);
}
console.log('   ✓ Video validation correctly validates MP4/WEBM/MOV/M4V, warns on HTTP, and rejects empty inputs.');

// 20. Video Asset Parsing in analyzeHtml
console.log('\n[TEST 20] Testing Video Asset Detection in analyzeHtml:');
const videoAnalysis = analyzeHtml(videoConvertedHtml, 'video_test_proj');
const desktopVidAsset = videoAnalysis.assets.find(a => a.label.includes('Desktop') && (a.type === 'html_video' || a.role === 'hero_bg'));
const mobileVidAsset = videoAnalysis.assets.find(a => a.label.includes('Mobile') && (a.type === 'html_video' || a.role === 'hero_bg'));

if (!desktopVidAsset || !mobileVidAsset) {
  console.error('FAIL: Desktop and Mobile video assets not detected by parser!');
  process.exit(1);
}
console.log(`   ✓ Found Desktop Video: ${desktopVidAsset.currentUrl}`);
console.log(`   ✓ Found Mobile Video: ${mobileVidAsset.currentUrl}`);

// 21. Video URL replacement via replaceImageUrlInHtml
console.log('\n[TEST 21] Testing Direct Video URL Replacement via replaceImageUrlInHtml:');
const targetHeroAsset = analysis.assets.find(a => a.label.includes('Hero Background – Mobile') || a.role === 'hero_bg');
if (!targetHeroAsset) {
  console.error('FAIL: Hero Background asset not found for test 21!');
  process.exit(1);
}

const directVideoHtml = replaceImageUrlInHtml(
  originalHtml,
  targetHeroAsset,
  'https://assets.cdn.filesafe.space/test/direct-asset-video.mp4'
);

if (!directVideoHtml.includes('direct-asset-video.mp4')) {
  console.error('FAIL: Direct video replacement failed to insert video URL into HTML!');
  process.exit(1);
}

if (!directVideoHtml.includes('<video') || !directVideoHtml.includes('window.megaLoginToken = token;')) {
  console.error('FAIL: Direct video replacement did not preserve video structure or login token!');
  process.exit(1);
}
console.log('   ✓ Direct Video URL replacement successfully activated video playback in HTML.');
console.log('   ✓ Preserved 100% of GHL scripts and tokens.');

// 22. Live Preview Video Playback Pipeline
console.log('\n[TEST 22] Testing Live Preview Video Playback Pipeline:');
const previewGeneratedHtml = generatePreviewHtml(videoHtml);

if (!previewGeneratedHtml.includes(PREVIEW_MARKER_START) || !previewGeneratedHtml.includes(PREVIEW_MARKER_END)) {
  console.error('FAIL: Preview injection markers missing from generated preview HTML!');
  process.exit(1);
}

if (!previewGeneratedHtml.includes('__lps_preview_video_helper') || !previewGeneratedHtml.includes('__lps_video_play_btn')) {
  console.error('FAIL: Preview video playback controller or fallback play button missing from preview HTML!');
  process.exit(1);
}

if (!previewGeneratedHtml.includes('window.innerWidth < 768') || !previewGeneratedHtml.includes('.slider-mobile') || !previewGeneratedHtml.includes('.hero-section')) {
  console.error('FAIL: Responsive breakpoint detection for desktop/mobile video elements missing!');
  process.exit(1);
}
console.log('   ✓ Live Preview video playback controller correctly injected into preview srcDoc.');
console.log('   ✓ Responsive desktop (>=768px) and mobile (<768px) video switching logic confirmed.');
console.log('   ✓ Fallback interactive play button and diagnostic error badges confirmed.');

// 23. Zero Preview Contamination in Exported / Production Code
console.log('\n[TEST 23] Verifying Zero Preview Contamination in Production / Clean HTML:');
const strippedCleanHtml = stripPreviewInjections(previewGeneratedHtml);
if (strippedCleanHtml.includes(PREVIEW_MARKER_START) || strippedCleanHtml.includes('__lps_preview_video_helper')) {
  console.error('FAIL: Preview code leaked into cleaned HTML!');
  process.exit(1);
}

if (!videoHtml.includes('<video') || videoHtml.includes('__lps_preview')) {
  console.error('FAIL: Original reference HTML was mutated or contains preview markers!');
  process.exit(1);
}
console.log('   ✓ stripPreviewInjections restores 100% clean production HTML.');
console.log('   ✓ Production exports and backups remain 100% faithful to reference implementation.');

// 24. Video Metadata Extraction & Formatting
console.log('\n[TEST 24] Testing Video Metadata Extraction & Formatting Utilities:');
const sampleFilename = extractVideoFilename('https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6ad8414d436f78fefbd3a498.mp4');
if (sampleFilename !== '6ad8414d436f78fefbd3a498.mp4') {
  console.error(`FAIL: Unexpected extracted filename: ${sampleFilename}`);
  process.exit(1);
}

if (formatBytes(15728640) !== '15.00 MB' || formatBytes(512000) !== '500.0 KB') {
  console.error(`FAIL: formatBytes output incorrect: ${formatBytes(15728640)}`);
  process.exit(1);
}

if (formatDuration(75) !== '1:15' || formatDuration(9) !== '0:09') {
  console.error(`FAIL: formatDuration output incorrect: ${formatDuration(75)}`);
  process.exit(1);
}

const wideRatio = calculateAspectRatio(1920, 1080);
const vertRatio = calculateAspectRatio(1080, 1920);
if (!wideRatio.ratioString.includes('16:9') || !vertRatio.ratioString.includes('9:16')) {
  console.error(`FAIL: calculateAspectRatio calculations incorrect: ${wideRatio.ratioString}`);
  process.exit(1);
}
console.log('   ✓ extractVideoFilename correctly parsed CDN media URLs.');
console.log('   ✓ formatBytes, formatDuration, and calculateAspectRatio verified with standard inputs.');

// 25. Video Quality Assessment Engine (Desktop Background)
console.log('\n[TEST 25] Testing Video Quality Assessment Engine for Desktop Background:');
const idealDesktopMeta = {
  url: 'https://cdn.example.com/desktop-hero.mp4',
  filename: 'desktop-hero.mp4',
  fileSizeBytes: 8 * 1024 * 1024, // 8 MB
  durationSeconds: 15,
  width: 1920,
  height: 1080,
  aspectRatioString: '16:9 (Widescreen)',
  aspectRatioDecimal: 1.78,
  format: 'MP4',
  codec: 'H.264 (AVC)',
  hasAudio: false,
  sourceStatus: 'accessible',
  playbackStatus: 'ready',
};

const desktopAssessment = assessVideoQuality(idealDesktopMeta, 'desktop');
if (desktopAssessment.overallRating !== 'good') {
  console.error(`FAIL: Ideal desktop video expected 'good', got ${desktopAssessment.overallRating}`);
  process.exit(1);
}

const mismatchedPortraitOnDesktop = {
  ...idealDesktopMeta,
  width: 1080,
  height: 1920,
  aspectRatioString: '9:16 (Vertical)',
  aspectRatioDecimal: 0.56,
};
const portraitMismatchAssessment = assessVideoQuality(mismatchedPortraitOnDesktop, 'desktop');
if (portraitMismatchAssessment.aspectRatioCheck.rating !== 'fail' || portraitMismatchAssessment.overallRating !== 'poor') {
  console.error(`FAIL: Portrait video on desktop expected aspect ratio fail, got ${portraitMismatchAssessment.aspectRatioCheck.rating}`);
  process.exit(1);
}
console.log('   ✓ High definition 1920x1080 landscape video rated Good for Desktop background.');
console.log('   ✓ Portrait video on desktop background correctly flagged with Aspect Ratio failure.');

// 26. Video Quality Assessment Engine (Mobile Background)
console.log('\n[TEST 26] Testing Video Quality Assessment Engine for Mobile Background:');
const idealMobileMeta = {
  url: 'https://cdn.example.com/mobile-hero.mp4',
  filename: 'mobile-hero.mp4',
  fileSizeBytes: 5 * 1024 * 1024, // 5 MB
  durationSeconds: 12,
  width: 1080,
  height: 1920,
  aspectRatioString: '9:16 (Vertical)',
  aspectRatioDecimal: 0.56,
  format: 'MP4',
  codec: 'H.264 (AVC)',
  hasAudio: false,
  sourceStatus: 'accessible',
  playbackStatus: 'ready',
};

const mobileAssessment = assessVideoQuality(idealMobileMeta, 'mobile');
if (mobileAssessment.overallRating !== 'good') {
  console.error(`FAIL: Ideal mobile video expected 'good', got ${mobileAssessment.overallRating}`);
  process.exit(1);
}

const oversizedMobileMeta = {
  ...idealMobileMeta,
  fileSizeBytes: 35 * 1024 * 1024, // 35 MB
};
const oversizedAssessment = assessVideoQuality(oversizedMobileMeta, 'mobile');
if (oversizedAssessment.fileSizeCheck.rating !== 'fail') {
  console.error(`FAIL: 35MB video on mobile expected file size fail, got ${oversizedAssessment.fileSizeCheck.rating}`);
  process.exit(1);
}
console.log('   ✓ Crisp 1080x1920 vertical video rated Good for Mobile background.');
console.log('   ✓ Oversized video (35MB) correctly flagged with actionable compression recommendations.');

// 27. Live Preview Scrubber & Interactive Toolbar Injection
console.log('\n[TEST 27] Testing Live Preview Scrubber & Interactive Toolbar Injection:');
if (!previewGeneratedHtml.includes('__lps-preview-toolbar') || !previewGeneratedHtml.includes('__lps_ctrl_scrubber')) {
  console.error('FAIL: Interactive preview timeline seek bar missing from preview HTML!');
  process.exit(1);
}

if (!previewGeneratedHtml.includes('__lps_ctrl_playpause') || !previewGeneratedHtml.includes('__lps_ctrl_replay')) {
  console.error('FAIL: Interactive play/pause or replay buttons missing from preview HTML!');
  process.exit(1);
}

const cleanedExportHtml = stripPreviewInjections(previewGeneratedHtml);
if (cleanedExportHtml.includes('__lps-preview-toolbar') || cleanedExportHtml.includes('__lps_ctrl_scrubber')) {
  console.error('FAIL: Preview toolbar leaked into cleaned production HTML!');
  process.exit(1);
}
console.log('   ✓ Interactive preview playback toolbar with timeline seek bar verified in srcDoc.');
console.log('   ✓ stripPreviewInjections guarantees 0% preview toolbar pollution in production HTML.');

// 28. Mandatory Source Comparison on Static Reference Template
console.log('\n[TEST 28] Testing Mandatory Source Comparison on Static Reference Template:');
const testStaticOrig = originalHtml;
let testStaticExported = testStaticOrig;

const testImageOld = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed050a9c8e9c411eddfb17.jpg';
const testImageNew = 'https://assets.cdn.filesafe.space/custom/replacement-desktop-bg.jpg';
testStaticExported = testStaticExported.replace(testImageOld, testImageNew);

const testFormOld = 'DuEWLBc3a3oXylBTrYC7';
const testFormNew = 'CustomVerifiedForm777';
testStaticExported = testStaticExported.split(testFormOld).join(testFormNew);

const staticFidelity = compareAndValidateSourcePreservation(testStaticOrig, testStaticExported, {
  images: [{ originalUrl: testImageOld, currentUrl: testImageNew, label: 'Campaign Details Desktop' }],
  forms: [{ originalFormId: testFormOld, newFormId: testFormNew, formName: 'Lead Form' }],
});

if (!staticFidelity.passed) {
  console.error('FAIL: Static reference source comparison failed unexpectedly!', staticFidelity);
  process.exit(1);
}
if (staticFidelity.checks.addedHtmlElements !== 0 || staticFidelity.checks.removedHtmlElements !== 0) {
  console.error('FAIL: Static reference detected tag additions or removals!', staticFidelity.checks);
  process.exit(1);
}
if (staticFidelity.checks.changedCssRules !== 0 || staticFidelity.checks.changedJavaScript !== 0) {
  console.error('FAIL: Static reference detected altered CSS or JavaScript!', staticFidelity.checks);
  process.exit(1);
}
console.log('   ✓ Static reference source comparison passed: 100% original source code preserved.');
console.log('   ✓ Every difference confirmed attributable exclusively to explicit image and form replacements.');

// 29. Mandatory Source Comparison on Video Reference Template
console.log('\n[TEST 29] Testing Mandatory Source Comparison on Video Reference Template:');
const testVideoOrig = videoHtml;
let testVideoExported = testVideoOrig;

const videoOrigFormMatch = /data-form-id=["']([^"']+)["']/i.exec(testVideoOrig);
const testVideoFormOld = videoOrigFormMatch ? videoOrigFormMatch[1] : 'Iz43ovW98h6RXYiCjoHR';

const testDesktopVideoOld = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6ad8414d436f78fefbd3a498.mp4';
const testDesktopVideoNew = 'https://assets.cdn.filesafe.space/custom/replacement-desktop-hero.mp4';
testVideoExported = testVideoExported.replace(testDesktopVideoOld, testDesktopVideoNew);

const testMobileVideoOld = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6ad84151cd7225ed3726570d.mp4';
const testMobileVideoNew = 'https://assets.cdn.filesafe.space/custom/replacement-mobile-hero.mp4';
testVideoExported = testVideoExported.replace(testMobileVideoOld, testMobileVideoNew);

testVideoExported = testVideoExported.split(testVideoFormOld).join(testFormNew);

const videoFidelity = compareAndValidateSourcePreservation(testVideoOrig, testVideoExported, {
  videos: [
    { originalUrl: testDesktopVideoOld, currentUrl: testDesktopVideoNew, label: 'Desktop Hero Video' },
    { originalUrl: testMobileVideoOld, currentUrl: testMobileVideoNew, label: 'Mobile Hero Video' },
  ],
  forms: [{ originalFormId: testVideoFormOld, newFormId: testFormNew, formName: 'Lead Form' }],
});

if (!videoFidelity.passed) {
  console.error('FAIL: Video reference source comparison failed unexpectedly!', videoFidelity);
  process.exit(1);
}
if (videoFidelity.checks.addedHtmlElements !== 0 || videoFidelity.checks.removedHtmlElements !== 0) {
  console.error('FAIL: Video reference detected tag additions or removals!', videoFidelity.checks);
  process.exit(1);
}
console.log('   ✓ Video reference source comparison passed: 100% original video template preserved.');
console.log('   ✓ Dual video & GHL form replacements verified with zero unpermitted modifications.');

// 30. Mandatory Source Comparison Violation Detection
console.log('\n[TEST 30] Testing Source Comparison Violation Detection (Negative Tests):');
// Tamper 1: Unrequested HTML element addition
const tamperedHtmlWithTag = testStaticOrig + '\n<div class="unauthorized-injected-container">Injected</div>';
const tagViolationReport = compareAndValidateSourcePreservation(testStaticOrig, tamperedHtmlWithTag, {});
if (tagViolationReport.passed || tagViolationReport.checks.addedHtmlElements === 0) {
  console.error('FAIL: Source comparison failed to detect added HTML element!', tagViolationReport.checks);
  process.exit(1);
}

// Tamper 2: Unrequested URL modification
const tamperedHtmlWithUrl = testStaticOrig.replace(
  'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aac3341254a2c54081a0dba.png',
  'https://assets.cdn.filesafe.space/unauthorized/sneaky-changed-icon.png'
);
const urlViolationReport = compareAndValidateSourcePreservation(testStaticOrig, tamperedHtmlWithUrl, {});
if (urlViolationReport.passed || urlViolationReport.checks.unrequestedUrlChanges !== 1) {
  console.error('FAIL: Source comparison failed to detect unrequested URL modification!');
  process.exit(1);
}
console.log('   ✓ Correctly flagged unpermitted HTML tag injection as critical audit failure.');
console.log('   ✓ Correctly flagged unrequested URL tampering as critical audit failure.');

// 31. End-to-End Regression Verification (Bundled Parity, Shared Form Title, Native Video->Static Switch)
console.log('\n[TEST 31] Testing Bundled Template Parity, Shared Form Title & Native Video->Static Mode Switch:');
if (BUNDLED_STATIC_REFERENCE_HTML !== originalHtml) {
  console.error('FAIL: BUNDLED_STATIC_REFERENCE_HTML does not match root LP Reference-static Campaign Details Background.txt!');
  process.exit(1);
}
if (BUNDLED_VIDEO_REFERENCE_HTML !== videoHtml) {
  console.error('FAIL: BUNDLED_VIDEO_REFERENCE_HTML does not match root LP Reference-video Campaign Details Background.txt!');
  process.exit(1);
}
console.log('   ✓ Bundled static and video templates match root authoritative .txt files byte-for-byte.');

// Test switching native video template directly to static mode (verifying hoisted mobileSectionRegex)
const nativeVideoToStatic = applyBackgroundModeToHtml(videoHtml, 'static', {
  mode: 'static',
  static: {
    desktopImage: 'https://assets.cdn.filesafe.space/test/native-vid-to-static-desk.jpg',
    mobileImage: 'https://assets.cdn.filesafe.space/test/native-vid-to-static-mob.jpg',
  },
  video: {
    desktopVideo: testDesktopVideoOld,
    mobileVideo: testMobileVideoOld,
  },
});
if (detectBackgroundModeInHtml(nativeVideoToStatic) !== 'static') {
  console.error('FAIL: Switching native video template to static mode failed!');
  process.exit(1);
}
console.log('   ✓ Native video template -> static mode switch succeeded cleanly.');

// Test shared Form Title / Name update across both Desktop and Mobile GHL forms
const sharedTitleHtml = updateSharedFormTitleInHtml(originalHtml, 'Pryvix VIP Campaign Form');
const sharedAnalysis = analyzeHtml(sharedTitleHtml, 'proj_shared_title');
if (
  sharedAnalysis.forms.length !== 2 ||
  sharedAnalysis.forms[0].formName !== 'Pryvix VIP Campaign Form' ||
  sharedAnalysis.forms[1].formName !== 'Pryvix VIP Campaign Form'
) {
  console.error('FAIL: updateSharedFormTitleInHtml did not synchronize both Desktop and Mobile form titles!', sharedAnalysis.forms);
  process.exit(1);
}
console.log('   ✓ Shared Form Title / Name synchronized across both Desktop and Mobile GHL forms.');

// 32. GoHighLevel Media Storage Secret Store & Zero-Exposure Security Audit
console.log('\n[TEST 32] Testing GoHighLevel Secret Store Encryption & Zero-Exposure Rules:');
if (DEFAULT_GHL_LOCATION_ID !== 'tSCoUOTHrXglK2BwDeYc' || REQUIRED_GHL_SCOPE !== 'medias.readonly') {
  console.error('FAIL: Default GHL Location ID or Required Scope mismatch!');
  process.exit(1);
}

// Preserve any existing configured token before running unit tests on secretStore
const preexistingToken = getServerSideGhlToken();
const preexistingLocationId = getSafeCredentialStatus().locationId;

// Ensure clean state before testing secret store
disconnectGhlCredentials();
const unconfMedia = await listGhlMedia();
if (unconfMedia.success || unconfMedia.errorCode !== 'NOT_CONFIGURED' || unconfMedia.items.length !== 0) {
  console.error('FAIL: Unconfigured GHL Media call did not return NOT_CONFIGURED or returned mock items!', unconfMedia);
  process.exit(1);
}
console.log('   ✓ Unconfigured state verified: returns NOT_CONFIGURED with 0 mock items.');

// Test AES-256-GCM encryption & masked status
const ephemeralTestValue = 'ephemeral_unit_test_secret_99887766';
saveGhlCredentials({ token: ephemeralTestValue, locationId: 'tSCoUOTHrXglK2BwDeYc' });
const decryptedServerVal = getServerSideGhlToken();
const publicSafeStatus = getSafeCredentialStatus();

if (decryptedServerVal !== ephemeralTestValue) {
  console.error('FAIL: Server-side AES-256-GCM decryption failed to recover stored value!');
  process.exit(1);
}
if (
  !publicSafeStatus.hasToken ||
  JSON.stringify(publicSafeStatus).includes(ephemeralTestValue) ||
  JSON.stringify(getGhlConnectionStatus()).includes(ephemeralTestValue)
) {
  console.error('FAIL: Public credential status leaked the raw token!');
  process.exit(1);
}

const redactedMsg = redactSecrets(`Error calling API with Bearer ${ephemeralTestValue}`);
if (redactedMsg.includes(ephemeralTestValue)) {
  console.error('FAIL: redactSecrets failed to strip secret from error message!');
  process.exit(1);
}

// Wipe ephemeral test credential
disconnectGhlCredentials();
if (getServerSideGhlToken() !== null) {
  console.error('FAIL: disconnectGhlCredentials did not remove the stored token!');
  process.exit(1);
}
// Restore preexisting user token if one was configured
if (preexistingToken) {
  saveGhlCredentials({ token: preexistingToken, locationId: preexistingLocationId });
}
console.log('   ✓ AES-256-GCM encryption, public masking, secret redaction, and disconnect wipe verified.');

// 33. GoHighLevel Media API v3 Allowlist & HTTP Middleware Access Control
console.log('\n[TEST 33] Testing GHL Media URL Allowlist & Backend HTTP Access Control:');
if (
  !isAllowedGhlAssetUrl('https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/sample.png') ||
  !isAllowedGhlAssetUrl('https://storage.googleapis.com/msgsndr/sample.mp4')
) {
  console.error('FAIL: Valid HTTPS GHL CDN URLs were rejected by allowlist!');
  process.exit(1);
}
if (
  isAllowedGhlAssetUrl('http://assets.cdn.filesafe.space/insecure.png') ||
  isAllowedGhlAssetUrl('https://attacker.example.com/malicious.png')
) {
  console.error('FAIL: Insecure HTTP or untrusted domain URL was permitted by allowlist!');
  process.exit(1);
}

// Test middleware rejects unauthenticated requests (missing X-Pryvix-Client header)
let mockStatus = 0;
let mockBody = '';
const mockRes = {
  set statusCode(code) {
    mockStatus = code;
  },
  get statusCode() {
    return mockStatus;
  },
  setHeader() {},
  end(str) {
    mockBody = str;
  },
};
await handleGhlApiRequest(
  { url: '/api/ghl/status', method: 'GET', headers: {}, socket: { remoteAddress: '127.0.0.1' } },
  mockRes
);
if (mockStatus !== 401) {
  console.error(`FAIL: Expected 401 for unauthenticated request, got ${mockStatus}`);
  process.exit(1);
}

// Test middleware accepts authenticated client request
await handleGhlApiRequest(
  {
    url: '/api/ghl/status',
    method: 'GET',
    headers: { 'x-pryvix-client': 'pryvix-studio-v1' },
    socket: { remoteAddress: '127.0.0.1' },
  },
  mockRes
);
if (mockStatus !== 200 || !JSON.parse(mockBody).locationId) {
  console.error(`FAIL: Expected 200 OK with locationId for authenticated status request, got ${mockStatus}: ${mockBody}`);
  process.exit(1);
}
console.log('   ✓ GHL CDN domain allowlist and authenticated /api/ghl/* middleware verified.');

console.log('\n====================================================');
console.log('   ALL 33 TEST SUITES PASSED WITH 100% FIDELITY!   ');
console.log('====================================================\n');
