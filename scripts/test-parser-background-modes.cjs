const fs = require('fs');
const {
  DEFAULT_STATIC_DESKTOP_IMAGE,
  DEFAULT_STATIC_MOBILE_IMAGE,
  DEFAULT_VIDEO_DESKTOP_URL,
  DEFAULT_VIDEO_MOBILE_URL,
  BUNDLED_STATIC_REFERENCE_HTML,
  BUNDLED_VIDEO_REFERENCE_HTML,
} = require('../src/shared/referenceTemplates.ts');

console.log('Static length:', BUNDLED_STATIC_REFERENCE_HTML.length);
console.log('Video length:', BUNDLED_VIDEO_REFERENCE_HTML.length);
console.log('Default static desktop:', DEFAULT_STATIC_DESKTOP_IMAGE);
console.log('Default video desktop:', DEFAULT_VIDEO_DESKTOP_URL);
