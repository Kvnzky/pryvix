const fs = require('fs');

const staticRef = fs.readFileSync('LP Reference-static Campaign Details Background.txt', 'utf8');
const videoRef = fs.readFileSync('LP Reference-video Campaign Details Background.txt', 'utf8');

function findTagBlock(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return 'NOT FOUND: ' + marker;
  // let's grab 1500 chars from idx
  return html.substring(idx - 50, idx + 1800);
}

console.log('=== STATIC HTML HERO SLIDER ===');
console.log(findTagBlock(staticRef, '<div class="hero-bg-slider">'));

console.log('=== VIDEO HTML HERO SLIDER ===');
console.log(findTagBlock(videoRef, '<div class="hero-bg-slider">'));

console.log('=== STATIC CSS CAMPAIGN DETAILS (mobile media query too) ===');
const sMobileBgIdx = staticRef.indexOf('.campaign-details-section', staticRef.indexOf('@media'));
console.log(staticRef.substring(sMobileBgIdx - 50, sMobileBgIdx + 300));

console.log('=== VIDEO CSS CAMPAIGN DETAILS ===');
const vCampCss = videoRef.indexOf('.campaign-details-section');
console.log(videoRef.substring(vCampCss - 50, vCampCss + 400));

console.log('\n--- ALL OCCURRENCES OF campaign-details-section in STATIC ---');
let pos = 0;
while ((pos = staticRef.indexOf('campaign-details-section', pos)) !== -1) {
  console.log(`[Pos ${pos}]`);
  console.log(staticRef.substring(pos - 20, pos + 250));
  pos += 'campaign-details-section'.length;
}

console.log('\n--- ALL OCCURRENCES OF campaign-details-section in VIDEO ---');
pos = 0;
while ((pos = videoRef.indexOf('campaign-details-section', pos)) !== -1) {
  console.log(`[Pos ${pos}]`);
  console.log(videoRef.substring(pos - 20, pos + 250));
  pos += 'campaign-details-section'.length;
}
