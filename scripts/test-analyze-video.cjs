const fs = require('fs');
const { analyzeHtml } = require('../src/shared/parser.ts');

const videoRef = fs.readFileSync('LP Reference-video Campaign Details Background.txt', 'utf8');
const analysis = analyzeHtml(videoRef, 'test_video');

console.log('Video reference detected assets count:', analysis.assets.length);
analysis.assets.forEach(a => {
  console.log(` - [${a.device}] ${a.label} (${a.type}): ${a.currentUrl.substring(0, 70)}`);
});
console.log('Forms detected:', analysis.forms.length);
