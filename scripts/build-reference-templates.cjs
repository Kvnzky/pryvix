const fs = require('fs');
const path = require('path');

const staticPathRoot = path.join(__dirname, '../LP Reference-static Campaign Details Background.txt');
const videoPathRoot = path.join(__dirname, '../LP Reference-video Campaign Details Background.txt');
const staticPathRes = path.join(__dirname, '../resources/landing-page-references/LP Reference-static Campaign Details Background.txt');
const videoPathRes = path.join(__dirname, '../resources/landing-page-references/LP Reference-video Campaign Details Background.txt');

const staticRef = fs.readFileSync(fs.existsSync(staticPathRoot) ? staticPathRoot : staticPathRes, 'utf8');
const videoRef = fs.readFileSync(fs.existsSync(videoPathRoot) ? videoPathRoot : videoPathRes, 'utf8');

if (fs.existsSync(staticPathRoot) && fs.existsSync(path.dirname(staticPathRes))) {
  fs.writeFileSync(staticPathRes, staticRef, 'utf8');
}
if (fs.existsSync(videoPathRoot) && fs.existsSync(path.dirname(videoPathRes))) {
  fs.writeFileSync(videoPathRes, videoRef, 'utf8');
}

const outputTs = `// Auto-generated bundled reference templates for Landing Page Studio
export const DEFAULT_STATIC_DESKTOP_IMAGE = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed050a9c8e9c411eddfb17.jpg';
export const DEFAULT_STATIC_MOBILE_IMAGE = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed050ed15674a4827add83.jpg';

export const DEFAULT_VIDEO_DESKTOP_URL = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6ad8414d436f78fefbd3a498.mp4';
export const DEFAULT_VIDEO_MOBILE_URL = 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6ad84151cd7225ed3726570d.mp4';

export const BUNDLED_STATIC_REFERENCE_HTML = ${JSON.stringify(staticRef)};

export const BUNDLED_VIDEO_REFERENCE_HTML = ${JSON.stringify(videoRef)};
`;

fs.writeFileSync(path.join(__dirname, '../src/shared/referenceTemplates.ts'), outputTs, 'utf8');
console.log('Successfully generated src/shared/referenceTemplates.ts');
