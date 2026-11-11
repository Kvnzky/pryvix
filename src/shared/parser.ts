import {
  ImageAsset,
  GHLForm,
  ComponentSection,
  DeviceTarget,
  AssetType,
  AssetStatus,
  BackgroundMode,
  BackgroundConfig,
} from './types';
import {
  DEFAULT_STATIC_DESKTOP_IMAGE,
  DEFAULT_STATIC_MOBILE_IMAGE,
  DEFAULT_VIDEO_DESKTOP_URL,
  DEFAULT_VIDEO_MOBILE_URL,
} from './referenceTemplates';

/**
 * Helper to compute 1-based line number from index in string
 */
export function getLineNumber(content: string, index: number): number {
  if (index < 0 || index > content.length) return 1;
  return content.substring(0, index).split('\n').length;
}

/**
 * Extract image extension/filetype
 */
export function extractFileType(url: string): string {
  if (!url) return 'IMAGE';
  const trimmed = url.trim();
  if (trimmed.startsWith('#')) return 'HEX';
  try {
    const cleanUrl = trimmed.split('?')[0].split('#')[0];
    const ext = cleanUrl.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif'].includes(ext)) {
      return ext.toUpperCase();
    }
  } catch (e) {
    // fallback
  }
  return 'IMAGE';
}

/**
 * Validate image URL format and protocol (or Hex color)
 */
export function checkUrlStatus(url: string): { status: AssetStatus; message?: string } {
  if (!url || !url.trim()) {
    return { status: 'invalid', message: 'Value is empty' };
  }
  const trimmed = url.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) {
    return { status: 'valid', message: `Solid Hex Color (${trimmed})` };
  }
  if (trimmed.startsWith('file://') || /^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return {
      status: 'unhosted_local',
      message: 'Local file path - will not work online unless hosted or embedded',
    };
  }
  if (trimmed.startsWith('data:image/')) {
    return { status: 'valid', message: 'Embedded Data URL' };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { status: 'invalid', message: 'Missing HTTP/HTTPS protocol' };
  }
  try {
    new URL(trimmed);
    return { status: 'valid', message: 'Valid HTTPS/HTTP URL' };
  } catch {
    return { status: 'invalid', message: 'Malformed URL format' };
  }
}

/**
 * Validate video URL format and protocol (accepts MP4, WEBM, MOV, M4V)
 */
export function checkVideoUrlStatus(url: string): { status: AssetStatus; message?: string } {
  if (!url || !url.trim()) {
    return { status: 'invalid', message: 'Video URL is empty' };
  }
  const trimmed = url.trim();
  if (trimmed.startsWith('file://') || /^[a-zA-Z]:[\\/]/.test(trimmed) || (trimmed.startsWith('/') && !trimmed.startsWith('//'))) {
    return {
      status: 'unhosted_local',
      message: 'Local file path - will not work online unless hosted',
    };
  }
  if (trimmed.startsWith('data:video/')) {
    return { status: 'valid', message: 'Embedded Video Data URL' };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { status: 'invalid', message: 'Missing HTTP/HTTPS protocol' };
  }
  try {
    const parsed = new URL(trimmed);
    const pathname = parsed.pathname.toLowerCase();
    const isStandardExt = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'].some(ext => pathname.endsWith(ext));
    if (parsed.protocol === 'http:') {
      return { status: 'unverified', message: 'Warning: HTTP URL used. Secure HTTPS is recommended.' };
    }
    if (!isStandardExt && !parsed.hostname.includes('filesafe.space') && !parsed.hostname.includes('cdn')) {
      return { status: 'unverified', message: 'Video URL without standard extension (.mp4, .webm, .mov, .m4v)' };
    }
    return { status: 'valid', message: 'Valid Video URL' };
  } catch {
    return { status: 'invalid', message: 'Malformed URL format' };
  }
}

/**
 * Main HTML Parsing & Analysis Result
 */
export interface ParseAnalysisResult {
  assets: ImageAsset[];
  forms: GHLForm[];
  sections: ComponentSection[];
  stats: {
    totalImages: number;
    desktopImages: number;
    mobileImages: number;
    totalForms: number;
  };
}

/**
 * Analyze HTML Document
 */
export function analyzeHtml(html: string, projectId: string): ParseAnalysisResult {
  const assets: ImageAsset[] = [];
  const forms: GHLForm[] = [];
  const sections: ComponentSection[] = [];
  let unclassifiedIndex = 1;

  // Track sections
  const sectionMap = new Map<string, ComponentSection>();

  function getOrCreateSection(id: string, name: string, type: ComponentSection['type']): ComponentSection {
    if (!sectionMap.has(id)) {
      const sec: ComponentSection = {
        id,
        name,
        type,
        assetIds: [],
        formIds: [],
        headings: [],
        links: [],
      };
      sectionMap.set(id, sec);
      sections.push(sec);
    }
    return sectionMap.get(id)!;
  }

  // 1. Analyze CSS Background Images in <style>
  const styleTagRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch: RegExpExecArray | null;

  while ((styleMatch = styleTagRegex.exec(html)) !== null) {
    const styleContent = styleMatch[1];
    const styleStartIndex = styleMatch.index + styleMatch[0].indexOf(styleContent);

    // Look for background/background-image with url(...)
    // Handle @media queries too
    const cssRuleRegex = /([^{}]+)\{([^{}]+)\}/g;
    let ruleMatch: RegExpExecArray | null;

    // Split media queries vs standard rules
    const mediaBlockRegex = /@media[^{]+\{([\s\S]+?\})\s*\}/g;
    let mediaMatch: RegExpExecArray | null;

    // Check media queries first
    while ((mediaMatch = mediaBlockRegex.exec(styleContent)) !== null) {
      const mediaHeader = mediaMatch[0].split('{')[0];
      const innerContent = mediaMatch[1];
      const isMobileMedia = /max-width\s*:\s*(991|768|600|480)px/i.test(mediaHeader);

      let innerRuleMatch: RegExpExecArray | null;
      const innerRuleRegex = /([^{}]+)\{([^{}]+)\}/g;
      while ((innerRuleMatch = innerRuleRegex.exec(innerContent)) !== null) {
        const selector = innerRuleMatch[1].trim();
        const body = innerRuleMatch[2];
        const urlMatch = /background(?:-image)?\s*:\s*[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(body);
        const colorMatch = /(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3,8})/i.exec(body);

        const rawUrl = urlMatch ? urlMatch[1].trim() : (colorMatch && /campaign-details|hero|form-col/i.test(selector) ? colorMatch[1].trim() : '');

        if (rawUrl && !rawUrl.startsWith('data:font') && !rawUrl.endsWith('.woff') && !rawUrl.endsWith('.ttf')) {
          const matchTarget = urlMatch ? urlMatch[0] : (colorMatch ? colorMatch[0] : '');
          const matchOffset = styleStartIndex + mediaMatch.index + mediaMatch[0].indexOf(innerRuleMatch[0]) + (matchTarget ? innerRuleMatch[0].indexOf(matchTarget) : 0);
          const line = getLineNumber(html, matchOffset);

          let label = rawUrl.startsWith('#') ? 'CSS Background Color' : 'CSS Background Image';
          let role: ImageAsset['role'] = 'unclassified';
          let section = getOrCreateSection('css_styles', 'Styles & Backgrounds', 'other');

          if (/form-col/i.test(selector)) {
            label = isMobileMedia ? 'Form Background – Mobile' : 'Form Background Image';
            role = 'form_bg';
            section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');
          } else if (/campaign-details/i.test(selector)) {
            label = isMobileMedia ? 'Campaign Details Background – Mobile' : 'Campaign Details Background – Desktop';
            role = 'campaign_bg';
            section = getOrCreateSection('sec_campaign', 'Campaign Details Section', 'campaign_details');
          } else if (/hero/i.test(selector)) {
            label = isMobileMedia ? 'Hero Background – Mobile' : 'Hero Background – Desktop';
            role = 'hero_bg';
            section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');
          }

          const device: DeviceTarget = isMobileMedia ? 'mobile' : 'desktop';
          const { status, message } = checkUrlStatus(rawUrl);

          const asset: ImageAsset = {
            id: `asset_css_${assets.length + 1}`,
            projectId,
            sectionId: section.id,
            sectionName: section.name,
            label,
            originalLabel: label,
            role,
            device,
            type: 'css_background',
            currentUrl: rawUrl,
            originalUrl: rawUrl,
            selectorOrLocation: `CSS: ${selector} (line ${line})`,
            htmlLineNumber: line,
            fileType: extractFileType(rawUrl),
            status,
            statusMessage: message,
          };

          assets.push(asset);
          section.assetIds.push(asset.id);
        }
      }
    }

    // Now standard rules outside or generally in style
    while ((ruleMatch = cssRuleRegex.exec(styleContent)) !== null) {
      const selector = ruleMatch[1].trim();
      if (selector.startsWith('@')) continue; // Skip @media itself

      const body = ruleMatch[2];
      const urlMatch = /background(?:-image)?\s*:\s*[^;]*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(body);
      const colorMatch = /(?:background-color|background)\s*:\s*(#[0-9a-fA-F]{3,8})/i.exec(body);
      const rawUrl = urlMatch ? urlMatch[1].trim() : (colorMatch && /campaign-details|hero|form-col/i.test(selector) ? colorMatch[1].trim() : '');

      if (rawUrl) {
        // Avoid duplicates if already found in media
        if (!assets.some(a => a.currentUrl === rawUrl && a.type === 'css_background')) {
          const matchTarget = urlMatch ? urlMatch[0] : (colorMatch ? colorMatch[0] : '');
          const matchOffset = styleStartIndex + ruleMatch.index + (matchTarget ? ruleMatch[0].indexOf(matchTarget) : 0);
          const line = getLineNumber(html, matchOffset);

          let label = rawUrl.startsWith('#') ? 'CSS Background Color' : 'CSS Background Image';
          let role: ImageAsset['role'] = 'unclassified';
          let section = getOrCreateSection('css_styles', 'Styles & Backgrounds', 'other');

          if (/form-col/i.test(selector)) {
            label = 'Form Background Image';
            role = 'form_bg';
            section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');
          } else if (/campaign-details/i.test(selector)) {
            label = 'Campaign Details Background – Desktop';
            role = 'campaign_bg';
            section = getOrCreateSection('sec_campaign', 'Campaign Details Section', 'campaign_details');
          } else if (/hero/i.test(selector)) {
            label = 'Hero Background – Desktop';
            role = 'hero_bg';
            section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');
          }

          const { status, message } = checkUrlStatus(rawUrl);

          const asset: ImageAsset = {
            id: `asset_css_${assets.length + 1}`,
            projectId,
            sectionId: section.id,
            sectionName: section.name,
            label,
            originalLabel: label,
            role,
            device: 'desktop',
            type: 'css_background',
            currentUrl: rawUrl,
            originalUrl: rawUrl,
            selectorOrLocation: `CSS: ${selector} (line ${line})`,
            htmlLineNumber: line,
            fileType: extractFileType(rawUrl),
            status,
            statusMessage: message,
          };

          assets.push(asset);
          section.assetIds.push(asset.id);
        }
      }
    }
  }

  // 2. Analyze HTML Elements: <picture>, <source>, <img>, inline styles
  // We scan the HTML sequentially to preserve structure and detect surrounding comments & containers

  // Let's find picture blocks first to group desktop + mobile picture sources cleanly
  const pictureRegex = /<picture\b([^>]*)>([\s\S]*?)<\/picture>/gi;
  let picMatch: RegExpExecArray | null;

  while ((picMatch = pictureRegex.exec(html)) !== null) {
    const picAttrs = picMatch[1];
    const picContent = picMatch[2];
    const picStartPos = picMatch.index;

    // Detect preceding comment within 200 chars
    const prePicContext = html.substring(Math.max(0, picStartPos - 300), picStartPos);
    const commentMatch = /<!--\s*([^-]+?)\s*-->\s*$/i.exec(prePicContext.trim());
    const nearbyComment = commentMatch ? commentMatch[1].trim() : '';

    // Determine picture purpose based on picture attributes, contents, and surrounding context
    let picRole: ImageAsset['role'] = 'unclassified';
    let baseLabel = 'Picture';
    let section = getOrCreateSection('sec_misc', 'Other Components', 'other');

    if (/popup/i.test(picAttrs) || /popup/i.test(picContent) || /popupOverlay/i.test(prePicContext)) {
      picRole = 'popup';
      baseLabel = 'Popup Banner';
      section = getOrCreateSection('sec_popup', 'Popup Section', 'popup');
    } else if (/hero-brand/i.test(picAttrs) || /hero-brand/i.test(picContent) || /Branding/i.test(nearbyComment)) {
      picRole = 'hero_brand';
      baseLabel = 'Hero Branding';
      section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');
    } else if (/campaign-details/i.test(picAttrs) || /campaign-details/i.test(picContent) || /Campaign Details/i.test(nearbyComment) || /Campaign Details/i.test(prePicContext)) {
      picRole = 'campaign_graphic';
      baseLabel = 'Campaign Details Graphic';
      section = getOrCreateSection('sec_campaign', 'Campaign Details Section', 'campaign_details');
    } else if (/prize-banner/i.test(picAttrs) || /prize-banner/i.test(picContent) || /Prize Banner/i.test(nearbyComment) || /prize-banner/i.test(prePicContext)) {
      picRole = 'prize_banner';
      baseLabel = 'Prize Banner';
      section = getOrCreateSection('sec_prize', 'Prize Banner Section', 'prize');
    }

    const componentGroupId = `comp_pic_${picStartPos}`;

    // Scan <source> inside <picture>
    const sourceRegex = /<source\b([^>]*)>/gi;
    let srcMatch: RegExpExecArray | null;
    while ((srcMatch = sourceRegex.exec(picContent)) !== null) {
      const sourceAttrs = srcMatch[1];
      const srcsetMatch = /srcset\s*=\s*["']([^"']+)["']/i.exec(sourceAttrs);
      const mediaMatch = /media\s*=\s*["']([^"']+)["']/i.exec(sourceAttrs);

      if (srcsetMatch) {
        const rawUrl = srcsetMatch[1].trim();
        const media = mediaMatch ? mediaMatch[1] : '';
        const isMobileOrTablet = /max-width/i.test(media);
        const device: DeviceTarget = isMobileOrTablet ? (/768/.test(media) ? 'mobile' : 'tablet') : 'desktop';

        const sourceOffset = picStartPos + picMatch[0].indexOf(srcMatch[0]);
        const line = getLineNumber(html, sourceOffset);

        const deviceName = device === 'mobile' ? 'Mobile' : device === 'tablet' ? 'Tablet/Mobile' : 'Desktop';
        const label = `${baseLabel} – ${deviceName}`;
        const { status, message } = checkUrlStatus(rawUrl);

        const asset: ImageAsset = {
          id: `asset_pic_src_${assets.length + 1}`,
          projectId,
          sectionId: section.id,
          sectionName: section.name,
          label,
          originalLabel: label,
          role: picRole,
          device,
          type: 'picture_source',
          currentUrl: rawUrl,
          originalUrl: rawUrl,
          selectorOrLocation: `<source media="${media}"> in <picture> (line ${line})`,
          htmlLineNumber: line,
          fileType: extractFileType(rawUrl),
          status,
          statusMessage: message,
          parentComponentId: componentGroupId,
        };

        assets.push(asset);
        section.assetIds.push(asset.id);
      }
    }

    // Scan <img> inside <picture>
    const imgInsidePicRegex = /<img\b([^>]*)>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgInsidePicRegex.exec(picContent)) !== null) {
      const imgAttrs = imgMatch[1];
      const srcAttrMatch = /src\s*=\s*["']([^"']+)["']/i.exec(imgAttrs);
      const altAttrMatch = /alt\s*=\s*["']([^"']*)["']/i.exec(imgAttrs);

      if (srcAttrMatch) {
        const rawUrl = srcAttrMatch[1].trim();
        const alt = altAttrMatch ? altAttrMatch[1] : '';
        const imgOffset = picStartPos + picMatch[0].indexOf(imgMatch[0]);
        const line = getLineNumber(html, imgOffset);

        const label = `${baseLabel} – Desktop`;
        const { status, message } = checkUrlStatus(rawUrl);

        const asset: ImageAsset = {
          id: `asset_pic_img_${assets.length + 1}`,
          projectId,
          sectionId: section.id,
          sectionName: section.name,
          label,
          originalLabel: label,
          role: picRole,
          device: 'desktop',
          type: 'html_img',
          currentUrl: rawUrl,
          originalUrl: rawUrl,
          altText: alt,
          selectorOrLocation: `<img> in <picture> (line ${line})`,
          htmlLineNumber: line,
          fileType: extractFileType(rawUrl),
          status,
          statusMessage: message,
          parentComponentId: componentGroupId,
        };

        assets.push(asset);
        section.assetIds.push(asset.id);
      }
    }
  }

  // 3. Scan Inline Background Images (e.g. hero-slide background slider)
  const inlineBgRegex = /<([a-z0-9]+)\b([^>]*style\s*=\s*["'][^"']*background(?:-image)?\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)[^"']*["'][^>]*)>/gi;
  let inlineBgMatch: RegExpExecArray | null;

  while ((inlineBgMatch = inlineBgRegex.exec(html)) !== null) {
    const tagName = inlineBgMatch[1];
    const attrs = inlineBgMatch[2];
    const rawUrl = inlineBgMatch[3].trim();
    const tagOffset = inlineBgMatch.index;
    const line = getLineNumber(html, tagOffset);

    // Skip if already tracked
    if (assets.some(a => a.currentUrl === rawUrl && a.htmlLineNumber === line)) continue;

    let device: DeviceTarget = 'desktop';
    let label = 'Background Image';
    let role: ImageAsset['role'] = 'hero_bg';
    let section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');

    if (/desktop-slide/i.test(attrs)) {
      device = 'desktop';
      label = 'Hero Background – Desktop';
    } else if (/mobile-slide/i.test(attrs)) {
      device = 'mobile';
      label = 'Hero Background – Mobile';
    } else {
      label = `Inline Background (${tagName})`;
    }

    const { status, message } = checkUrlStatus(rawUrl);

    const asset: ImageAsset = {
      id: `asset_inline_${assets.length + 1}`,
      projectId,
      sectionId: section.id,
      sectionName: section.name,
      label,
      originalLabel: label,
      role,
      device,
      type: 'inline_style_bg',
      currentUrl: rawUrl,
      originalUrl: rawUrl,
      selectorOrLocation: `<${tagName} class="..."> inline style (line ${line})`,
      htmlLineNumber: line,
      fileType: extractFileType(rawUrl),
      status,
      statusMessage: message,
    };

    assets.push(asset);
    section.assetIds.push(asset.id);
  }

  // 4. Scan Standalone <img> Tags (outside <picture>)
  const standaloneImgRegex = /<img\b([^>]*)>/gi;
  let stImgMatch: RegExpExecArray | null;

  while ((stImgMatch = standaloneImgRegex.exec(html)) !== null) {
    const imgAttrs = stImgMatch[1];
    const srcAttrMatch = /src\s*=\s*["']([^"']+)["']/i.exec(imgAttrs);
    const altAttrMatch = /alt\s*=\s*["']([^"']*)["']/i.exec(imgAttrs);
    const idAttrMatch = /id\s*=\s*["']([^"']*)["']/i.exec(imgAttrs);
    const classAttrMatch = /class\s*=\s*["']([^"']*)["']/i.exec(imgAttrs);

    if (!srcAttrMatch) continue;

    const rawUrl = srcAttrMatch[1].trim();
    const line = getLineNumber(html, stImgMatch.index);

    // If already added via <picture>, skip
    if (assets.some(a => a.currentUrl === rawUrl && a.type === 'html_img' && Math.abs((a.htmlLineNumber || 0) - line) <= 1)) {
      continue;
    }

    const alt = altAttrMatch ? altAttrMatch[1] : '';
    const imgId = idAttrMatch ? idAttrMatch[1] : '';
    const imgClass = classAttrMatch ? classAttrMatch[1] : '';

    // Check surrounding context for buttons, logos, icons, scroll-to-top
    const preContext = html.substring(Math.max(0, stImgMatch.index - 250), stImgMatch.index);

    let label = '';
    let role: ImageAsset['role'] = 'unclassified';
    let section = getOrCreateSection('sec_misc', 'Other Components', 'other');
    let device: DeviceTarget = 'universal';

    if (/scrollToTopBtn/i.test(preContext) || /scroll-to-top/i.test(preContext) || /scroll to top/i.test(alt)) {
      label = 'Scroll to Top Icon';
      role = 'icon';
      section = getOrCreateSection('sec_floating', 'Floating Elements', 'floating');
    } else if (/read-more-btn/i.test(preContext) || /read-more/i.test(preContext) || /read more/i.test(alt) || /terms and conditions/i.test(alt)) {
      label = 'Read More Button';
      role = 'button';
      section = getOrCreateSection('sec_campaign', 'Campaign Details Section', 'campaign_details');
    } else if (/logo/i.test(imgClass) || /logo/i.test(preContext)) {
      label = 'Logo Image';
      role = 'logo';
      section = getOrCreateSection('sec_hero', 'Hero Section', 'hero');
    } else {
      label = alt ? alt : `Unclassified Image ${String(unclassifiedIndex++).padStart(2, '0')}`;
      role = 'unclassified';
    }

    const { status, message } = checkUrlStatus(rawUrl);

    const asset: ImageAsset = {
      id: `asset_img_${assets.length + 1}`,
      projectId,
      sectionId: section.id,
      sectionName: section.name,
      label,
      originalLabel: label,
      role,
      device,
      type: 'html_img',
      currentUrl: rawUrl,
      originalUrl: rawUrl,
      altText: alt,
      selectorOrLocation: `<img${imgId ? ` id="${imgId}"` : ''}${imgClass ? ` class="${imgClass}"` : ''}> (line ${line})`,
      htmlLineNumber: line,
      fileType: extractFileType(rawUrl),
      status,
      statusMessage: message,
    };

    assets.push(asset);
    section.assetIds.push(asset.id);
  }

  // 4b. Scan <video> and <source type="video/..."> elements
  const videoRegex = /<video\b([^>]*)>([\s\S]*?)<\/video>/gi;
  let vidMatch: RegExpExecArray | null;

  while ((vidMatch = videoRegex.exec(html)) !== null) {
    const vidAttrs = vidMatch[1];
    const vidBody = vidMatch[2];
    const vidOffset = vidMatch.index;
    const line = getLineNumber(html, vidOffset);

    // Look for <source src="..."> or direct src="..."
    let vidUrl = '';
    const srcTagMatch = /<source\b[^>]*src\s*=\s*["']([^"']+)["']/i.exec(vidBody);
    if (srcTagMatch) {
      vidUrl = srcTagMatch[1].trim();
    } else {
      const srcAttrMatch = /src\s*=\s*["']([^"']+)["']/i.exec(vidAttrs);
      if (srcAttrMatch) {
        vidUrl = srcAttrMatch[1].trim();
      }
    }

    if (!vidUrl) continue;

    // Check surrounding context for device targeting
    const preContext = html.substring(Math.max(0, vidOffset - 400), vidOffset);
    let device: DeviceTarget = 'desktop';
    let label = 'Hero Background Video – Desktop';

    if (/slider-mobile|d-md-none|d-block\.d-md-none/i.test(preContext) || /mobile/i.test(vidAttrs)) {
      device = 'mobile';
      label = 'Hero Background Video – Mobile';
    } else if (/d-none\.d-md-block|hero-section/i.test(preContext)) {
      device = 'desktop';
      label = 'Hero Background Video – Desktop';
    }

    const { status, message } = checkVideoUrlStatus(vidUrl);
    const heroSection = getOrCreateSection('sec_hero', 'Hero Section', 'hero');

    const asset: ImageAsset = {
      id: `asset_vid_${assets.length + 1}`,
      projectId,
      sectionId: heroSection.id,
      sectionName: heroSection.name,
      label,
      originalLabel: label,
      role: 'hero_bg',
      device,
      type: 'html_video',
      currentUrl: vidUrl,
      originalUrl: vidUrl,
      selectorOrLocation: `<video> inside ${device === 'mobile' ? '.slider-mobile' : '.hero-section'} (line ${line})`,
      htmlLineNumber: line,
      fileType: extractFileType(vidUrl) === 'IMAGE' ? 'MP4' : extractFileType(vidUrl),
      status,
      statusMessage: message,
    };

    assets.push(asset);
    heroSection.assetIds.push(asset.id);
  }

  // 5. Scan GoHighLevel Forms & Iframes
  const iframeRegex = /<iframe\b([^>]*)>([\s\S]*?)<\/iframe>/gi;
  let iframeMatch: RegExpExecArray | null;

  while ((iframeMatch = iframeRegex.exec(html)) !== null) {
    const attrs = iframeMatch[1];
    const iframeOffset = iframeMatch.index;
    const line = getLineNumber(html, iframeOffset);

    // Detect if this is a GHL Form iframe
    const isGHL =
      /link\.megarewards\.au\/widget\/form/i.test(attrs) ||
      /widget\/form\//i.test(attrs) ||
      /data-form-id/i.test(attrs) ||
      /data-layout-iframe-id/i.test(attrs);

    if (!isGHL) continue;

    const idMatch = /id\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const srcMatch = /src\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const formIdMatch = /data-form-id\s*=\s*["']([^"']+)["']/i.exec(attrs) || /widget\/form\/([a-zA-Z0-9_-]+)/i.exec(attrs);
    const formNameMatch = /data-form-name\s*=\s*["']([^"']+)["']/i.exec(attrs) || /title\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const heightMatch = /data-height\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const cookieConsentMatch = /data-cookie-consent\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const cookieProviderMatch = /data-cookie-consent-provider\s*=\s*["']([^"']+)["']/i.exec(attrs);

    const iframeId = idMatch ? idMatch[1] : `iframe-${forms.length + 1}`;
    const formId = formIdMatch ? formIdMatch[1] : '';
    const rawFormName = formNameMatch ? formNameMatch[1].trim() : '';
    // Clean any redundant (Desktop) or (Mobile) suffixes
    const cleanedFormName = rawFormName.replace(/\s*\((?:Desktop|Mobile)\)/gi, '').trim();
    // A form name is recognizable if non-empty and not generic placeholder
    const isRecognizable = cleanedFormName.length > 0 && !/^(gohighlevel\s*form|form|untitled(\s*form)?)$/i.test(cleanedFormName);
    const formName = isRecognizable ? cleanedFormName : '';
    const iframeUrl = srcMatch ? srcMatch[1] : '';
    const height = heightMatch ? heightMatch[1] : '1465';

    // Check if desktop or mobile instance
    const isMobileForm = /mobile/i.test(iframeId) || /mobileFormSection/i.test(html.substring(Math.max(0, iframeOffset - 300), iframeOffset));
    const deviceTarget: DeviceTarget = isMobileForm ? 'mobile' : 'desktop';

    // Scan nearby scripts for tokens and cookies
    const surroundingScriptContext = html.substring(Math.max(0, iframeOffset - 1200), Math.min(html.length, iframeOffset + 1200));

    const hasLoginToken = /login_token|megaLoginToken|mega_test_registration/i.test(surroundingScriptContext);
    const hasEventId = /event_id|megaEventId/i.test(surroundingScriptContext);

    // Check for custom values in full html (e.g. var formClosed = "{{custom_values...}}")
    const formClosedVarMatch = /var\s+formClosed\s*=\s*["']([^"']+)["']/i.exec(html);
    const customClosingVal = formClosedVarMatch
      ? formClosedVarMatch[1].trim()
      : (/\{\{custom_values\.[a-zA-Z0-9_.-]+\}\}/i.exec(html)?.[0] || undefined);

    // Embed script URL
    const embedScriptMatch = /<script\s+src\s*=\s*["']([^"']*form_embed\.js)["']\s*><\/script>/i.exec(surroundingScriptContext);
    const embedScriptUrl = embedScriptMatch ? embedScriptMatch[1] : 'https://link.megarewards.au/js/form_embed.js';

    // Section for form
    const formSection = getOrCreateSection(
      isMobileForm ? 'sec_mobile_form' : 'sec_hero_form',
      isMobileForm ? 'Mobile Form Section' : 'Desktop Hero Form',
      'form'
    );

    const ghlForm: GHLForm = {
      id: `ghl_form_${forms.length + 1}`,
      projectId,
      formId,
      iframeId,
      formName,
      iframeUrl,
      height,
      width: '100%',
      borderRadius: '1px',
      cookieConsent: cookieConsentMatch ? cookieConsentMatch[1] === 'true' : true,
      cookieConsentProvider: cookieProviderMatch ? cookieProviderMatch[1] : 'auto',
      embedScriptUrl,
      deviceTarget,
      lineNumber: line,
      customScripts: {
        hasLoginToken,
        hasEventId: !isMobileForm && hasEventId, // In reference, desktop has event_id, mobile only login_token
        closingCustomValue: customClosingVal,
        rawScripts: [],
      },
    };

    forms.push(ghlForm);
    formSection.formIds.push(ghlForm.id);
  }

  // 6. Scan PDF links & Read More links for sections
  const linkRegex = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let linkMatch: RegExpExecArray | null;
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const linkAttrs = linkMatch[1];
    const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(linkAttrs);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (href.endsWith('.pdf') || /terms/i.test(href) || /rules/i.test(href)) {
        const line = getLineNumber(html, linkMatch.index);
        const sec = getOrCreateSection('sec_campaign', 'Campaign Details Section', 'campaign_details');
        sec.links.push({
          text: 'Terms & Conditions PDF',
          href,
          selector: 'a.read-more-btn',
          line,
        });
      }
    }
  }

  // Compute stats
  const desktopImages = assets.filter(a => a.device === 'desktop').length;
  const mobileImages = assets.filter(a => a.device === 'mobile' || a.device === 'tablet').length;

  return {
    assets,
    forms,
    sections,
    stats: {
      totalImages: assets.length,
      desktopImages,
      mobileImages,
      totalForms: forms.length,
    },
  };
}

/**
 * SOURCE-PRESERVING REPLACEMENT FUNCTIONS
 * These functions safely update only the intended URLs or attributes without destroying indentation or scripts.
 */

export function replaceImageUrlInHtml(html: string, asset: ImageAsset, newUrl: string): string {
  if (!newUrl || newUrl === asset.currentUrl) return html;

  const oldUrl = asset.currentUrl.trim();
  const target = newUrl.trim();
  const isNewColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(target);
  const isOldColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(oldUrl);
  const isNewVideo =
    ['.mp4', '.webm', '.mov', '.m4v'].some(ext => target.toLowerCase().includes(ext)) ||
    target.startsWith('data:video/');

  // 1. Handling Video on Hero Background
  const isHeroBg = asset.role === 'hero_bg' || /hero background/i.test(asset.label);
  const isMobile = asset.device === 'mobile' || /mobile/i.test(asset.label);

  if (isHeroBg && isNewVideo) {
    const currentMode = detectBackgroundModeInHtml(html);
    const existingConfig = extractBackgroundConfig(html);
    if (currentMode === 'static') {
      const updatedConfig: BackgroundConfig = {
        ...existingConfig,
        mode: 'video',
        video: {
          desktopVideo: isMobile ? existingConfig.video.desktopVideo : target,
          mobileVideo: isMobile ? target : existingConfig.video.mobileVideo,
        },
      };
      return applyBackgroundModeToHtml(html, 'video', updatedConfig);
    } else {
      return updateVideoUrlsInHtml(
        html,
        isMobile ? undefined : target,
        isMobile ? target : undefined
      );
    }
  }

  // 2. If current asset is a video element
  if (asset.type === 'html_video') {
    if (isNewVideo) {
      const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sourceRegex = new RegExp(`(<source\\b[^>]*src\\s*=\\s*["'])${escapedOld}(["'])`, 'g');
      if (sourceRegex.test(html)) {
        return html.replace(sourceRegex, `$1${target}$2`);
      }
      const videoSrcRegex = new RegExp(`(<video\\b[^>]*src\\s*=\\s*["'])${escapedOld}(["'])`, 'g');
      if (videoSrcRegex.test(html)) {
        return html.replace(videoSrcRegex, `$1${target}$2`);
      }
      return html.replace(oldUrl, target);
    } else {
      // Switching from video to static slide with image or color
      const existingConfig = extractBackgroundConfig(html);
      const updatedConfig: BackgroundConfig = {
        ...existingConfig,
        mode: 'static',
      };
      const switched = applyBackgroundModeToHtml(html, 'static', updatedConfig);
      const slideClass = isMobile ? 'mobile-slide' : 'desktop-slide';
      const slideRegex = new RegExp(
        `(<div\\s+class=["'][^"']*${slideClass}[^"']*["'][^>]*style=["'][^"']*url\\(\\s*['"]?)[^'")]+(['"]?\\s*\\))`,
        'i'
      );
      if (slideRegex.test(switched)) {
        return switched.replace(slideRegex, `$1${target}$2`);
      }
      return switched;
    }
  }

  if (asset.type === 'css_background') {
    const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (isNewColor) {
      if (isOldColor) {
        // Replace existing color declaration
        const colorRegex = new RegExp(`((?:background-color|background)\\s*:[^;]*)${escapedOld}`, 'gi');
        return html.replace(colorRegex, `$1${target}`);
      } else {
        // Replace background-image: url('oldUrl') with background-color: #HEX; background-image: none;
        const bgImgRegex = new RegExp(`background(?:-image)?\\s*:[^;]*url\\(\\s*['"]?${escapedOld}['"]?\\s*\\);?`, 'gi');
        return html.replace(bgImgRegex, `background-color: ${target}; background-image: none;`);
      }
    } else {
      // target is an image URL
      if (isOldColor) {
        const colorWithNoneRegex = new RegExp(`(?:background-color\\s*:\\s*${escapedOld};?\\s*(?:background-image\\s*:\\s*none;?)?|background\\s*:\\s*${escapedOld};?)`, 'gi');
        return html.replace(colorWithNoneRegex, `background-image: url('${target}');`);
      } else {
        const regex = new RegExp(`(background(?:-image)?\\s*:[^;]*url\\(\\s*['"]?)${escapedOld}(['"]?\\s*\\))`, 'g');
        return html.replace(regex, `$1${target}$2`);
      }
    }
  }

  if (asset.type === 'inline_style_bg') {
    const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (isNewColor) {
      if (isOldColor) {
        const colorRegex = new RegExp(`((?:background-color|background)\\s*:[^;]*)${escapedOld}`, 'gi');
        return html.replace(colorRegex, `$1${target}`);
      } else {
        const bgImgRegex = new RegExp(`background(?:-image)?\\s*:\\s*url\\(\\s*['"]?${escapedOld}['"]?\\s*\\);?`, 'gi');
        return html.replace(bgImgRegex, `background-color: ${target}; background-image: none;`);
      }
    } else {
      if (isOldColor) {
        const colorWithNoneRegex = new RegExp(`(?:background-color\\s*:\\s*${escapedOld};?\\s*(?:background-image\\s*:\\s*none;?)?|background\\s*:\\s*${escapedOld};?)`, 'gi');
        return html.replace(colorWithNoneRegex, `background-image: url('${target}');`);
      } else {
        const regex = new RegExp(`(style\\s*=\\s*["'][^"']*url\\(\\s*['"]?)${escapedOld}(['"]?\\s*\\))`, 'g');
        return html.replace(regex, `$1${target}$2`);
      }
    }
  }

  if (asset.type === 'picture_source') {
    const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(<source\\b[^>]*srcset\\s*=\\s*["'])${escapedOld}(["'])`, 'g');
    return html.replace(regex, `$1${target}$2`);
  }

  if (asset.type === 'html_img') {
    const escapedOld = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(<img\\b[^>]*src\\s*=\\s*["'])${escapedOld}(["'])`, 'g');
    return html.replace(regex, `$1${target}$2`);
  }

  // Fallback direct exact replacement if single instance
  return html.replace(oldUrl, target);
}

/**
 * Update Image Alt Text safely
 */
export function replaceImageAltInHtml(html: string, asset: ImageAsset, newAlt: string): string {
  if (asset.type !== 'html_img') return html;
  const escapedUrl = asset.currentUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match the specific <img> tag with this src
  const imgTagRegex = new RegExp(`(<img\\b[^>]*src\\s*=\\s*["']${escapedUrl}["'][^>]*)>`, 'i');
  const match = imgTagRegex.exec(html);

  if (!match) return html;

  let updatedTag = match[1];
  if (/alt\s*=\s*["'][^"']*["']/i.test(updatedTag)) {
    updatedTag = updatedTag.replace(/alt\s*=\s*["'][^"']*["']/i, `alt="${newAlt}"`);
  } else {
    updatedTag = `${updatedTag} alt="${newAlt}"`;
  }

  return html.replace(match[0], `${updatedTag}>`);
}

/**
 * Resolves one shared form title from project property, desktop form, or mobile form
 */
export function resolveSharedFormTitle(
  projectFormTitle?: string,
  forms?: GHLForm[]
): string {
  if (projectFormTitle && projectFormTitle.trim()) {
    return projectFormTitle.trim();
  }
  if (forms && forms.length > 0) {
    const desktopForm = forms.find(f => f.deviceTarget === 'desktop');
    const mobileForm = forms.find(f => f.deviceTarget === 'mobile');
    const desktopName = desktopForm?.formName?.trim() || '';
    const mobileName = mobileForm?.formName?.trim() || '';

    const cleanDesktop = desktopName.replace(/\s*\((?:Desktop|Mobile)\)/gi, '').trim();
    const cleanMobile = mobileName.replace(/\s*\((?:Desktop|Mobile)\)/gi, '').trim();

    if (cleanDesktop && !/^(gohighlevel\s*form|form|untitled(\s*form)?)$/i.test(cleanDesktop)) {
      return cleanDesktop;
    }
    if (cleanMobile && !/^(gohighlevel\s*form|form|untitled(\s*form)?)$/i.test(cleanMobile)) {
      return cleanMobile;
    }
  }
  return '';
}

/**
 * Safely update the shared form title across all GoHighLevel iframes in the HTML
 */
export function updateSharedFormTitleInHtml(html: string, newTitle: string): string {
  const trimmed = newTitle.trim();
  const ghlIframeRegex = /(<iframe\b[^>]*data-form-id\s*=\s*["'][^"']+["'][^>]*)>/gi;
  return html.replace(ghlIframeRegex, (_match, tagPrefix) => {
    let tag = tagPrefix;
    if (/data-form-name\s*=\s*["'][^"']*["']/i.test(tag)) {
      tag = tag.replace(/data-form-name\s*=\s*["'][^"']*["']/i, `data-form-name="${trimmed}"`);
    } else if (trimmed) {
      tag = `${tag} data-form-name="${trimmed}"`;
    }
    if (/title\s*=\s*["'][^"']*["']/i.test(tag)) {
      tag = tag.replace(/title\s*=\s*["'][^"']*["']/i, `title="${trimmed}"`);
    } else if (trimmed) {
      tag = `${tag} title="${trimmed}"`;
    }
    return `${tag}>`;
  });
}

/**
 * Safely update GoHighLevel Form parameters across iframe & scripts
 */
export function updateGHLFormInHtml(
  html: string,
  targetForm: GHLForm,
  updates: {
    formId?: string;
    formName?: string;
    height?: string | number;
    iframeUrl?: string;
    closingCustomValue?: string;
  }
): string {
  let updatedHtml = html;
  const oldFormId = targetForm.formId;
  const oldIframeId = targetForm.iframeId;

  // 1. If formId is changing, update data-form-id, src URL, and script URLs
  if (updates.formId && updates.formId !== oldFormId) {
    const newFormId = updates.formId;
    const escapedOldFormId = oldFormId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Update in iframe attributes
    const formIdAttrRegex = new RegExp(`(data-form-id\\s*=\\s*["'])${escapedOldFormId}(["'])`, 'g');
    updatedHtml = updatedHtml.replace(formIdAttrRegex, `$1${newFormId}$2`);

    // Update in iframe id if it contains formId
    const iframeIdRegex = new RegExp(`(id\\s*=\\s*["'][^"']*)${escapedOldFormId}([^"']*["'])`, 'g');
    updatedHtml = updatedHtml.replace(iframeIdRegex, `$1${newFormId}$2`);

    // Update in data-layout-iframe-id
    const layoutIframeRegex = new RegExp(`(data-layout-iframe-id\\s*=\\s*["'][^"']*)${escapedOldFormId}([^"']*["'])`, 'g');
    updatedHtml = updatedHtml.replace(layoutIframeRegex, `$1${newFormId}$2`);

    // Update in script getElementById references
    const getElemRegex = new RegExp(`(getElementById\\(\\s*['"][^'"]*)${escapedOldFormId}([^'"]*['"]\\s*\\))`, 'g');
    updatedHtml = updatedHtml.replace(getElemRegex, `$1${newFormId}$2`);

    // Update in widget/form/{id} URLs across iframe src and script URL constructors
    const widgetUrlRegex = new RegExp(`(widget/form/)${escapedOldFormId}`, 'g');
    updatedHtml = updatedHtml.replace(widgetUrlRegex, `$1${newFormId}`);
  }

  // 2. If formName is changing
  if (updates.formName !== undefined) {
    const newName = updates.formName.trim();
    const oldName = (targetForm.formName || '').replace(/\s*\((?:Desktop|Mobile)\)/gi, '').trim();

    if (oldName && oldName !== newName) {
      const escapedOldName = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const formNameAttrRegex = new RegExp(`(data-form-name\\s*=\\s*["'])${escapedOldName}(["'])`, 'g');
      updatedHtml = updatedHtml.replace(formNameAttrRegex, `$1${newName}$2`);
      const titleRegex = new RegExp(`(title\\s*=\\s*["'])${escapedOldName}(["'])`, 'g');
      updatedHtml = updatedHtml.replace(titleRegex, `$1${newName}$2`);
    } else {
      // If oldName was empty or unrecognised, or user clears/sets form name, update all GHL iframes cleanly
      const ghlIframeRegex = /(<iframe\b[^>]*data-form-id\s*=\s*["'][^"']+["'][^>]*)>/gi;
      updatedHtml = updatedHtml.replace(ghlIframeRegex, (_match, tagPrefix) => {
        let tag = tagPrefix;
        if (/data-form-name\s*=\s*["'][^"']*["']/i.test(tag)) {
          tag = tag.replace(/data-form-name\s*=\s*["'][^"']*["']/i, `data-form-name="${newName}"`);
        } else if (newName) {
          tag = `${tag} data-form-name="${newName}"`;
        }
        if (/title\s*=\s*["'][^"']*["']/i.test(tag)) {
          tag = tag.replace(/title\s*=\s*["'][^"']*["']/i, `title="${newName}"`);
        } else if (newName) {
          tag = `${tag} title="${newName}"`;
        }
        return `${tag}>`;
      });
    }
  }

  // 3. If height is changing
  if (updates.height) {
    const escapedIframeId = oldIframeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const heightAttrRegex = new RegExp(`(<iframe\\b[^>]*id\\s*=\\s*["']${escapedIframeId}["'][^>]*data-height\\s*=\\s*["'])[^"']+(["'])`, 'i');
    updatedHtml = updatedHtml.replace(heightAttrRegex, `$1${updates.height}$2`);
  }

  // 4. If closingCustomValue is changing
  if (updates.closingCustomValue !== undefined) {
    const newClosing = updates.closingCustomValue.trim();
    const oldClosing = targetForm.customScripts?.closingCustomValue;

    if (oldClosing && oldClosing !== newClosing) {
      const escapedOld = oldClosing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const closingRegex = new RegExp(escapedOld, 'g');
      updatedHtml = updatedHtml.replace(closingRegex, newClosing);
    } else if (newClosing) {
      // Replace in var formClosed = "...";
      const varFormClosedRegex = /(var\s+formClosed\s*=\s*["'])([^"']*)(["'])/gi;
      if (varFormClosedRegex.test(updatedHtml)) {
        updatedHtml = updatedHtml.replace(varFormClosedRegex, `$1${newClosing}$3`);
      } else {
        const customValRegex = /\{\{custom_values\.[a-zA-Z0-9_.-]+\}\}/gi;
        updatedHtml = updatedHtml.replace(customValRegex, newClosing);
      }
    }
  }

  return updatedHtml;
}

/**
 * Sanitize project name for filesystem safe names
 */
export function sanitizeProjectNameForFilename(name: string): string {
  if (!name || !name.trim()) return 'landing-page';
  return name
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Injects or updates Project Name comment in the HTML source code
 */
export function injectProjectHeaderComment(
  html: string,
  projectName: string,
  updatedAt: string = new Date().toISOString()
): string {
  const comment = `<!-- Project Name: ${projectName.trim()} | Generated by Landing Page Studio | ${updatedAt} -->\n`;
  const existingCommentRegex = /<!--\s*Project Name:[\s\S]*?-->\n?/i;

  if (existingCommentRegex.test(html)) {
    return html.replace(existingCommentRegex, comment);
  }

  // Insert after <!DOCTYPE html> or at top of file
  if (/^<!DOCTYPE\s+html[^>]*>/i.test(html.trim())) {
    return html.replace(/(<!DOCTYPE\s+html[^>]*>\s*)/i, `$1${comment}`);
  }

  return comment + html;
}

/**
 * Optionally sync the <title> tag with the current project name
 */
export function syncTitleTagWithProjectName(html: string, projectName: string): string {
  if (!projectName || !projectName.trim()) return html;
  const cleanName = projectName.trim();
  const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;

  if (titleRegex.test(html)) {
    return html.replace(titleRegex, `<title>${cleanName}</title>`);
  }

  // If head exists, inject title inside head
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1\n  <title>${cleanName}</title>`);
  }

  return html;
}

/**
 * Detect current background mode in HTML
 */
export function detectBackgroundModeInHtml(html: string): BackgroundMode {
  if (!html) return 'static';
  const heroSliderMatch = /<div\s+class=["'][^"']*hero-bg-slider[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\s+class=["'][^"']*hero-overlay/i.exec(html);
  if (heroSliderMatch && /<video\b/i.test(heroSliderMatch[1])) {
    return 'video';
  }
  if (/<div\s+class=["'][^"']*hero-wrapper[^"']*["'][\s\S]*?<video\b/i.test(html)) {
    return 'video';
  }
  return 'static';
}

/**
 * Extract background configuration from HTML or fall back to defaults
 */
export function extractBackgroundConfig(
  html: string,
  existingConfig?: BackgroundConfig
): BackgroundConfig {
  let desktopImage = existingConfig?.static?.desktopImage || DEFAULT_STATIC_DESKTOP_IMAGE;
  let mobileImage = existingConfig?.static?.mobileImage || DEFAULT_STATIC_MOBILE_IMAGE;
  let desktopVideo = existingConfig?.video?.desktopVideo || DEFAULT_VIDEO_DESKTOP_URL;
  let mobileVideo = existingConfig?.video?.mobileVideo || DEFAULT_VIDEO_MOBILE_URL;

  // 1. Detect Desktop Campaign Details Image / Hex from CSS
  const desktopCssMatch = /\.campaign-details-section\s*\{[^}]*?background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(html);
  if (desktopCssMatch && desktopCssMatch[1]) {
    desktopImage = desktopCssMatch[1].trim();
  } else {
    const desktopColorMatch = /\.campaign-details-section\s*\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i.exec(html);
    if (desktopColorMatch && desktopColorMatch[1] && desktopColorMatch[1] !== '#050505') {
      desktopImage = desktopColorMatch[1].trim();
    }
  }

  // 2. Detect Mobile Campaign Details Image / Hex from CSS @media 768
  const mobileCssMatch = /@media[^{]+\([^)]*max-width:\s*76[78]px[^)]*\)\s*\{[\s\S]*?\.campaign-details-section\s*\{[^}]*?background-image\s*:\s*url\(\s*['"]?([^'")]+)['"]?\s*\)/i.exec(html);
  if (mobileCssMatch && mobileCssMatch[1]) {
    mobileImage = mobileCssMatch[1].trim();
  }

  // 3. Detect Desktop Video URL
  const deskVidMatch =
    /<div\s+class=["'][^"']*hero-section[\s\S]*?<video[\s\S]*?<source\s+src=["']([^"']+)["']/i.exec(html) ||
    /<div\s+class=["'][^"']*hero-section[\s\S]*?<video[^>]*src=["']([^"']+)["']/i.exec(html);
  if (deskVidMatch && deskVidMatch[1]) {
    desktopVideo = deskVidMatch[1].trim();
  }

  // 4. Detect Mobile Video URL
  const mobVidMatch =
    /<div\s+class=["'][^"']*slider-mobile[\s\S]*?<video[\s\S]*?<source\s+src=["']([^"']+)["']/i.exec(html) ||
    /<div\s+class=["'][^"']*slider-mobile[\s\S]*?<video[^>]*src=["']([^"']+)["']/i.exec(html);
  if (mobVidMatch && mobVidMatch[1]) {
    mobileVideo = mobVidMatch[1].trim();
  }

  const mode = detectBackgroundModeInHtml(html);

  return {
    mode,
    static: {
      desktopImage,
      mobileImage,
    },
    video: {
      desktopVideo,
      mobileVideo,
    },
    referenceFiles: {
      static: 'LP Reference-static Campaign Details Background.txt',
      video: 'LP Reference-video Campaign Details Background.txt',
    },
  };
}

/**
 * Update video URLs in HTML
 */
export function updateVideoUrlsInHtml(
  html: string,
  desktopUrl?: string,
  mobileUrl?: string
): string {
  let updated = html;

  if (desktopUrl && desktopUrl.trim()) {
    const cleanDesk = desktopUrl.trim();
    const desktopSourceRegex = /(<div\s+class=["'][^"']*hero-section[\s\S]*?<video[\s\S]*?<source\s+src=["'])[^"']+(["'])/i;
    if (desktopSourceRegex.test(updated)) {
      updated = updated.replace(desktopSourceRegex, `$1${cleanDesk}$2`);
    } else {
      const desktopDirectVidRegex = /(<div\s+class=["'][^"']*hero-section[\s\S]*?<video\b[^>]*src=["'])[^"']+(["'])/i;
      if (desktopDirectVidRegex.test(updated)) {
        updated = updated.replace(desktopDirectVidRegex, `$1${cleanDesk}$2`);
      }
    }
  }

  if (mobileUrl && mobileUrl.trim()) {
    const cleanMob = mobileUrl.trim();
    const mobileSourceRegex = /(<div\s+class=["'][^"']*slider-mobile[\s\S]*?<video[\s\S]*?<source\s+src=["'])[^"']+(["'])/i;
    if (mobileSourceRegex.test(updated)) {
      updated = updated.replace(mobileSourceRegex, `$1${cleanMob}$2`);
    } else {
      const mobileDirectVidRegex = /(<div\s+class=["'][^"']*slider-mobile[\s\S]*?<video\b[^>]*src=["'])[^"']+(["'])/i;
      if (mobileDirectVidRegex.test(updated)) {
        updated = updated.replace(mobileDirectVidRegex, `$1${cleanMob}$2`);
      }
    }
  }

  return updated;
}

/**
 * Update Campaign Details Background URLs or Hex color in HTML
 */
export function updateStaticCampaignDetailsUrlsInHtml(
  html: string,
  desktopVal?: string,
  mobileVal?: string
): string {
  let updated = html;

  if (desktopVal !== undefined && desktopVal.trim()) {
    const cleanDesk = desktopVal.trim();
    const isDeskColor = cleanDesk.startsWith('#');
    const newDeskDecl = isDeskColor
      ? `background-color: ${cleanDesk}; background-image: none;`
      : `background-image: url('${cleanDesk}'); background-size: 100% 100%;`;

    // Replace desktop .campaign-details-section background
    const deskSectionRegex = /(\.campaign-details-section\s*\{[^}]*?)(background-image\s*:[^;]+;\s*background-size\s*:[^;]+;|background-image\s*:[^;]+;|background-color\s*:[^;]+;\s*background-image\s*:\s*none;|background-color\s*:\s*#050505;)/i;
    if (deskSectionRegex.test(updated)) {
      updated = updated.replace(deskSectionRegex, `$1${newDeskDecl}`);
    }
  }

  if (mobileVal !== undefined && mobileVal.trim()) {
    const cleanMob = mobileVal.trim();
    const isMobColor = cleanMob.startsWith('#');
    const newMobDecl = isMobColor
      ? `background-color: ${cleanMob}; background-image: none;`
      : `background-image: url('${cleanMob}');`;

    const mobileMediaRegex = /(@media[^{]+\([^)]*max-width:\s*76[78]px[^)]*\)\s*\{[\s\S]*?\.campaign-details-section\s*\{)([^}]*?)(\})/i;
    if (mobileMediaRegex.test(updated)) {
      updated = updated.replace(mobileMediaRegex, (match, prefix, content, suffix) => {
        const cleaned = content.replace(/(background-image\s*:[^;]+;|background-color\s*:[^;]+;\s*background-image\s*:\s*none;)/gi, '').trim();
        return `${prefix}\n                ${newMobDecl}\n                ${cleaned ? cleaned + '\n            ' : ''}${suffix}`;
      });
    }
  }

  return updated;
}

/**
 * Apply selected background mode to HTML (Option B strict implementation)
 */
export function applyBackgroundModeToHtml(
  html: string,
  targetMode: BackgroundMode,
  config: BackgroundConfig
): string {
  let updated = html;
  const currentMode = detectBackgroundModeInHtml(updated);

  const heroSliderRegex = /(<div\s+class=["'][^"']*hero-bg-slider[^"']*["'][^>]*>)[\s\S]*?(<\/div>\s*<div\s+class=["'][^"']*hero-overlay)/i;
  const mobileSectionRegex = /(\/\*\s*Campaign Details Section\s*\(mobile background\)\s*\*\/[\s\S]*?\.campaign-details-section\s*\{)([\s\S]*?)(\})/;

  if (targetMode === 'video') {
    const videoInnerSnippet = `
              <div class="hero-section d-none d-md-block">
                  <div class="slider">
                      <div>
                          <video autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; display: block;">
                              <source src="${config.video.desktopVideo || DEFAULT_VIDEO_DESKTOP_URL}" type="video/mp4">
                          </video>
                      </div>
                  </div>
              </div>

              <div class="slider-mobile d-block d-md-none">
                  <div>
                      <video autoplay loop muted playsinline style="width: 100%; height: 100%; object-fit: cover; display: block;">
                          <source src="${config.video.mobileVideo || DEFAULT_VIDEO_MOBILE_URL}" type="video/mp4">
                      </video>
                  </div>
              </div>
          `;

    if (heroSliderRegex.test(updated)) {
      updated = updated.replace(heroSliderRegex, `$1${videoInnerSnippet}\n          $2`);
    }

    // Campaign details section in video mode: solid dark background
    updated = updated.replace(
      /(\.campaign-details-section\s*\{[^}]*?)background-image\s*:[^;]+;\s*(?:background-size\s*:[^;]+;)?/i,
      '$1background-color: #050505;'
    );

    // Comment out mobile campaign details background image if present
    if (mobileSectionRegex.test(updated)) {
      updated = updated.replace(mobileSectionRegex, '$1\n                /* .campaign-details-section video mode */\n            $3');
    }

    // Ensure CSS rule for hero-bg-slider video exists
    if (!updated.includes('.hero-bg-slider video')) {
      const videoStyleSnippet = `
        .hero-bg-slider video {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 100% !important;
            height: 100% !important;
            min-width: 100% !important;
            min-height: 100% !important;
            object-fit: cover !important;
            object-position: center !important;
            transform: translate(-50%, -50%);
            display: block !important;
        }
      `;
      updated = updated.replace(/(\.hero-bg-slider\s*\{[^}]*\})/i, `$1\n${videoStyleSnippet}`);
    }
  } else {
    // targetMode === 'static'
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

    if (heroSliderRegex.test(updated)) {
      updated = updated.replace(heroSliderRegex, `$1${staticInnerSnippet}\n        $2`);
    }

    // Restore desktop campaign details background
    const deskVal = config.static.desktopImage || DEFAULT_STATIC_DESKTOP_IMAGE;
    const isDeskColor = deskVal.startsWith('#');
    const deskDecl = isDeskColor
      ? `background-color: ${deskVal};`
      : `background-image: url('${deskVal}');\n            background-size: 100% 100%;`;

    updated = updated.replace(
      /(\.campaign-details-section\s*\{[^}]*?)background-color\s*:[^;]+;/i,
      `$1${deskDecl}`
    );

    // Restore mobile campaign details background
    const mobVal = config.static.mobileImage || DEFAULT_STATIC_MOBILE_IMAGE;
    const isMobColor = mobVal.startsWith('#');
    const mobDecl = isMobColor
      ? `background-color: ${mobVal};`
      : `background-image: url('${mobVal}');`;

    if (updated.includes('/* .campaign-details-section video mode */')) {
      updated = updated.replace(
        '/* .campaign-details-section video mode */',
        mobDecl
      );
    } else if (mobileSectionRegex.test(updated)) {
      updated = updated.replace(mobileSectionRegex, `$1\n                ${mobDecl}\n            $3`);
    }
  }

  return updated;
}
