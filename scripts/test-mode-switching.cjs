const fs = require('fs');

const staticRef = fs.readFileSync('LP Reference-static Campaign Details Background.txt', 'utf8');
const videoRef = fs.readFileSync('LP Reference-video Campaign Details Background.txt', 'utf8');

const heroSliderRegex = /(<div\s+class=["']hero-bg-slider["'][^>]*>)[\s\S]*?(<\/div>\s*<div\s+class=["']hero-overlay["']>)/i;

const videoInnerSnippet = `
              <div class="hero-section d-none d-md-block">
                  <div class="slider">
                      <div>
                          <video autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; display: block;">
                              <source src="CUSTOM_DESKTOP_VIDEO.mp4" type="video/mp4">
                          </video>
                      </div>
                  </div>
              </div>

              <div class="slider-mobile d-block d-md-none">
                  <div>
                      <video autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; display: block;">
                          <source src="CUSTOM_MOBILE_VIDEO.mp4" type="video/mp4">
                      </video>
                  </div>
              </div>
          `;

const staticInnerSnippet = `
            <!-- Desktop Slides -->
            <div class="hero-slide desktop-slide active"
                style="background-image: url('https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed144bfb31f444f25c3867.jpg');">
            </div>

            <!-- Mobile Slides -->
            <div class="hero-slide mobile-slide active"
                style="background-image: url('https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed1e7042ff25478ce192ae.jpg');">
            </div>
        `;

// 1. Convert staticRef to Video Mode
let toVideo = staticRef.replace(heroSliderRegex, `$1${videoInnerSnippet}\n          $2`);

// Update campaign details in CSS to solid background
toVideo = toVideo.replace(
  /(\.campaign-details-section\s*\{[^}]*?)background-image\s*:[^;]+;/i,
  '$1background-color: #050505;'
);

// Remove mobile background-image if in media query
toVideo = toVideo.replace(
  /(@media[^{]+\{[^}]*?)(\.campaign-details-section\s*\{[^}]*background-image\s*:[^;]+;\s*\})/i,
  '$1/* .campaign-details-section video mode */'
);

console.log('--- TEST 1: static -> video ---');
console.log('Has video tag?', toVideo.includes('CUSTOM_DESKTOP_VIDEO.mp4'));
console.log('Has mobile video tag?', toVideo.includes('CUSTOM_MOBILE_VIDEO.mp4'));
console.log('Campaign details has background-color #050505?', toVideo.includes('background-color: #050505;'));
console.log('Login token preserved?', toVideo.includes('window.megaLoginToken = token;'));
console.log('Event id preserved?', toVideo.includes('window.megaEventId = eventId;'));
console.log('Form custom values preserved?', toVideo.includes('{{custom_values.gtagaming_gift_cards_form_closing}}'));

// 2. Convert toVideo back to Static Mode
let toStatic = toVideo.replace(heroSliderRegex, `$1${staticInnerSnippet}\n        $2`);

// Restore campaign details desktop background
toStatic = toStatic.replace(
  /(\.campaign-details-section\s*\{[^}]*?)background-color\s*:[^;]+;/i,
  "$1background-image: url('https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed050a9c8e9c411eddfb17.jpg');\n            background-size: 100% 100%;"
);

// Restore mobile campaign details background
if (toStatic.includes('/* .campaign-details-section video mode */')) {
  toStatic = toStatic.replace(
    '/* .campaign-details-section video mode */',
    `.campaign-details-section {
                background-image: url('https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed050ed15674a4827add83.jpg');
            }`
  );
}

console.log('\n--- TEST 2: video -> static ---');
console.log('Has static slides?', toStatic.includes('hero-slide desktop-slide active'));
console.log('Has static desktop campaign details image?', toStatic.includes('6aed050a9c8e9c411eddfb17.jpg'));
console.log('Has static mobile campaign details image?', toStatic.includes('6aed050ed15674a4827add83.jpg'));
console.log('No video left?', !toStatic.includes('<video'));
console.log('Login token preserved?', toStatic.includes('window.megaLoginToken = token;'));
console.log('Event id preserved?', toStatic.includes('window.megaEventId = eventId;'));
