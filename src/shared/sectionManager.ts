import {
  ComponentSection,
  ReadMoreButtonConfig,
  ReadMoreSectionConfig,
  SupportedSectionType,
} from './types';

export const DEFAULT_READ_MORE_CONFIG: ReadMoreSectionConfig = {
  desktop: {
    enabled: true,
    text: 'Read Full Terms and Conditions',
    url: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed130542ff25478ce0a40c.pdf',
    openInNewTab: true,
    backgroundColor: '#2563eb',
    textColor: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    width: 'auto',
    padding: '12px 28px',
    borderRadius: '8px',
    alignment: 'center',
    marginTop: '30px',
    marginBottom: '20px',
    hoverBackgroundColor: '#1d4ed8',
    hoverTextColor: '#ffffff',
  },
  mobile: {
    enabled: true,
    text: 'Read Full Terms and Conditions',
    url: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed130542ff25478ce0a40c.pdf',
    openInNewTab: true,
    backgroundColor: '#2563eb',
    textColor: '#ffffff',
    fontSize: '13px',
    fontWeight: '600',
    width: '90%',
    padding: '12px 20px',
    borderRadius: '8px',
    alignment: 'center',
    marginTop: '24px',
    marginBottom: '16px',
    hoverBackgroundColor: '#1d4ed8',
    hoverTextColor: '#ffffff',
  },
};

export interface SectionDefinition {
  id: string;
  name: string;
  type: SupportedSectionType;
  description: string;
  isAddable: boolean;
  isDeletable: boolean;
  findBoundary: (html: string) => { start: number; end: number; outerHtml: string; isHidden: boolean } | null;
}

/**
 * Validates whether a destination URL is a valid web URL.
 */
export function isValidDestinationUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Helper to match an element from opening tag to its balanced closing tag.
 */
function findBalancedTagBoundary(
  html: string,
  startRegex: RegExp,
  tagName: string
): { start: number; end: number; outerHtml: string; isHidden: boolean } | null {
  const match = startRegex.exec(html);
  if (!match) return null;

  const start = match.index;
  const openTag = match[0];
  const isHidden =
    /data-pryvix-section-hidden="true"/i.test(openTag) ||
    /style\s*=\s*["'][^"']*display\s*:\s*none\s*!important/i.test(openTag);

  const lowerTag = tagName.toLowerCase();
  const searchRegex = new RegExp(`<\/?${lowerTag}\\b[^>]*>`, 'gi');
  searchRegex.lastIndex = start + openTag.length;

  let depth = 1;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = searchRegex.exec(html)) !== null) {
    const tagText = tagMatch[0].toLowerCase();
    if (tagText.startsWith(`</${lowerTag}`)) {
      depth--;
      if (depth === 0) {
        const end = searchRegex.lastIndex;
        return {
          start,
          end,
          outerHtml: html.substring(start, end),
          isHidden,
        };
      }
    } else if (!tagText.endsWith('/>')) {
      depth++;
    }
  }

  return null;
}

export const SUPPORTED_SECTIONS_REGISTRY: SectionDefinition[] = [
  {
    id: 'sec_popup',
    name: 'Popup Banner Section',
    type: 'popup',
    description: 'Popup overlay banner displayed when loading the page or triggering promotion.',
    isAddable: false,
    isDeletable: false,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<div\b[^>]*class\s*=\s*["'][^"']*\bpopup-overlay\b[^"']*["'][^>]*>/i,
        'div'
      );
    },
  },
  {
    id: 'sec_hero',
    name: 'Hero Section',
    type: 'hero',
    description: 'Main landing page header with background slider, campaign branding, and primary form.',
    isAddable: false,
    isDeletable: false,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<div\b[^>]*class\s*=\s*["'][^"']*\bhero-wrapper\b[^"']*["'][^>]*>/i,
        'div'
      );
    },
  },
  {
    id: 'sec_mobile_form',
    name: 'Mobile-Only Form Section',
    type: 'mobile_form',
    description: 'Separated GoHighLevel registration form optimized specifically for mobile viewports.',
    isAddable: false,
    isDeletable: false,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<div\b[^>]*class\s*=\s*["'][^"']*\bmobile-form-section\b[^"']*["'][^>]*>/i,
        'div'
      );
    },
  },
  {
    id: 'sec_prize',
    name: 'Prize Banner Section',
    type: 'prize',
    description: 'Prize showcase banner presenting giveaway incentives and reward graphics.',
    isAddable: false,
    isDeletable: false,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<section\b[^>]*class\s*=\s*["'][^"']*\bprize-banner-section\b[^"']*["'][^>]*>/i,
        'section'
      );
    },
  },
  {
    id: 'sec_campaign',
    name: 'Campaign Details Section',
    type: 'campaign_details',
    description: 'Campaign rules, giveaway dates, terms graphics, and scroll to top button.',
    isAddable: false,
    isDeletable: false,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-details-section\b[^"']*["'][^>]*>/i,
        'section'
      );
    },
  },
  {
    id: 'sec_read_more',
    name: 'Read More Button',
    type: 'read_more_button',
    description: 'Dedicated responsive button with independent Desktop and Mobile design and destination URLs.',
    isAddable: true,
    isDeletable: false,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<div\b[^>]*class\s*=\s*["'][^"']*\bread-more-wrapper\b[^"']*["'][^>]*>/i,
        'div'
      );
    },
  },
  {
    id: 'sec_additional_content',
    name: 'Additional Content Section',
    type: 'additional_content',
    description: 'Predefined modular content container for campaign announcements and partner highlights.',
    isAddable: true,
    isDeletable: true,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<section\b[^>]*class\s*=\s*["'][^"']*\badditional-content-section\b[^"']*["'][^>]*>/i,
        'section'
      );
    },
  },
  {
    id: 'sec_campaign_info',
    name: 'Campaign Information Section',
    type: 'campaign_info',
    description: 'Predefined structured card layout for entry deadlines and legal eligibility specifications.',
    isAddable: true,
    isDeletable: true,
    findBoundary: (html: string) => {
      return findBalancedTagBoundary(
        html,
        /<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-info-section\b[^"']*["'][^>]*>/i,
        'section'
      );
    },
  },
];

/**
 * Detects all supported sections in the HTML document and their visibility status.
 */
export function detectSectionsInHtml(
  html: string,
  existingSections: ComponentSection[] = []
): ComponentSection[] {
  const result: ComponentSection[] = [];
  const existingMap = new Map(existingSections.map(s => [s.id, s]));

  SUPPORTED_SECTIONS_REGISTRY.forEach((def, index) => {
    const boundary = def.findBoundary(html);
    if (boundary) {
      const prev = existingMap.get(def.id);
      result.push({
        id: def.id,
        name: def.name,
        type: def.type,
        visible: !boundary.isHidden,
        order: index + 1,
        isAddable: def.isAddable,
        isDeletable: def.isDeletable,
        originalHtml: boundary.outerHtml,
        config: prev?.config,
        assetIds: prev?.assetIds || [],
        formIds: prev?.formIds || [],
        headings: prev?.headings || [],
        links: prev?.links || [],
      });
    }
  });

  return result;
}

/**
 * Toggles visibility of a section in HTML without destroying its original content or inner structure.
 */
export function toggleSectionVisibilityInHtml(
  html: string,
  sectionId: string,
  visible: boolean
): string {
  const def = SUPPORTED_SECTIONS_REGISTRY.find(d => d.id === sectionId);
  if (!def) return html;

  const boundary = def.findBoundary(html);
  if (!boundary) return html;

  const outer = boundary.outerHtml;
  // Match opening tag
  const openTagMatch = /^<([a-zA-Z0-9\-]+)(\b[^>]*)>/i.exec(outer);
  if (!openTagMatch) return html;

  const tagName = openTagMatch[1];
  let tagAttrs = openTagMatch[2];

  if (!visible) {
    // Hide: apply data attribute and display: none !important
    if (!/data-pryvix-section-hidden="true"/i.test(tagAttrs)) {
      tagAttrs = `${tagAttrs} data-pryvix-section-hidden="true"`;
    }
    if (/style\s*=\s*["']([^"']*)["']/i.test(tagAttrs)) {
      tagAttrs = tagAttrs.replace(/style\s*=\s*["']([^"']*)["']/i, (m, existingStyle) => {
        const clean = existingStyle.replace(/display\s*:\s*none\s*!important;?/gi, '').trim();
        return `style="display: none !important; ${clean}"`.trim();
      });
    } else {
      tagAttrs = `${tagAttrs} style="display: none !important;"`;
    }
  } else {
    // Show: remove data attribute and display: none !important
    tagAttrs = tagAttrs.replace(/\s*data-pryvix-section-hidden="true"/gi, '');
    if (/style\s*=\s*["']([^"']*)["']/i.test(tagAttrs)) {
      tagAttrs = tagAttrs.replace(/style\s*=\s*["']([^"']*)["']/i, (m, existingStyle) => {
        const clean = existingStyle
          .replace(/display\s*:\s*none\s*!important;?/gi, '')
          .trim()
          .replace(/;\s*;+/g, ';');
        if (!clean) return '';
        return `style="${clean}"`;
      });
    }
  }

  const newOpenTag = `<${tagName}${tagAttrs}>`;
  const newOuter = newOpenTag + outer.substring(openTagMatch[0].length);

  return html.substring(0, boundary.start) + newOuter + html.substring(boundary.end);
}

/**
 * Extracts the Read More Button configuration from HTML or provides safe defaults based on reference PDF links.
 */
export function extractReadMoreConfigFromHtml(
  html: string,
  existingConfig?: ReadMoreSectionConfig
): ReadMoreSectionConfig {
  if (existingConfig) return existingConfig;

  // Extract initial PDF URL from reference if present
  let defaultPdfUrl = DEFAULT_READ_MORE_CONFIG.desktop.url;
  const linkMatch = /<a\b[^>]*class\s*=\s*["'][^"']*\bread-more-btn\b[^"']*["'][^>]*href\s*=\s*["']([^"']+)["']/i.exec(
    html
  );
  if (linkMatch && linkMatch[1]) {
    defaultPdfUrl = linkMatch[1].trim();
  }

  return {
    desktop: {
      ...DEFAULT_READ_MORE_CONFIG.desktop,
      url: defaultPdfUrl,
    },
    mobile: {
      ...DEFAULT_READ_MORE_CONFIG.mobile,
      url: defaultPdfUrl,
    },
  };
}

/**
 * Updates or injects the dedicated responsive Read More Button Section into the HTML.
 */
export function updateReadMoreButtonInHtml(
  html: string,
  config: ReadMoreSectionConfig
): string {
  const def = SUPPORTED_SECTIONS_REGISTRY.find(d => d.id === 'sec_read_more')!;
  const boundary = def.findBoundary(html);

  // Scoped responsive style block for the button section
  const scopedStyles = `
<style id="pryvix-read-more-styles">
  .pryvix-read-more-wrapper {
    box-sizing: border-box;
    width: 100%;
  }
  .pryvix-read-more-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    box-sizing: border-box;
    cursor: pointer;
    transition: transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease;
  }
  .pryvix-read-more-btn:hover {
    transform: translateY(-2px);
    opacity: 0.95;
  }
  @media (min-width: 768px) {
    .pryvix-read-more-wrapper {
      text-align: ${config.desktop.alignment} !important;
      margin-top: ${config.desktop.marginTop} !important;
      margin-bottom: ${config.desktop.marginBottom} !important;
    }
    .pryvix-rm-desktop {
      display: ${config.desktop.enabled ? 'inline-flex' : 'none'} !important;
      background-color: ${config.desktop.backgroundColor};
      color: ${config.desktop.textColor};
      font-size: ${config.desktop.fontSize};
      font-weight: ${config.desktop.fontWeight};
      width: ${config.desktop.width};
      padding: ${config.desktop.padding};
      border-radius: ${config.desktop.borderRadius};
    }
    .pryvix-rm-mobile {
      display: none !important;
    }
    ${config.desktop.hoverBackgroundColor ? `.pryvix-rm-desktop:hover { background-color: ${config.desktop.hoverBackgroundColor} !important; }` : ''}
    ${config.desktop.hoverTextColor ? `.pryvix-rm-desktop:hover { color: ${config.desktop.hoverTextColor} !important; }` : ''}
  }
  @media (max-width: 767px) {
    .pryvix-read-more-wrapper {
      text-align: ${config.mobile.alignment} !important;
      margin-top: ${config.mobile.marginTop} !important;
      margin-bottom: ${config.mobile.marginBottom} !important;
    }
    .pryvix-rm-desktop {
      display: none !important;
    }
    .pryvix-rm-mobile {
      display: ${config.mobile.enabled ? 'inline-flex' : 'none'} !important;
      background-color: ${config.mobile.backgroundColor};
      color: ${config.mobile.textColor};
      font-size: ${config.mobile.fontSize};
      font-weight: ${config.mobile.fontWeight};
      width: ${config.mobile.width};
      padding: ${config.mobile.padding};
      border-radius: ${config.mobile.borderRadius};
    }
    ${config.mobile.hoverBackgroundColor ? `.pryvix-rm-mobile:hover { background-color: ${config.mobile.hoverBackgroundColor} !important; }` : ''}
    ${config.mobile.hoverTextColor ? `.pryvix-rm-mobile:hover { color: ${config.mobile.hoverTextColor} !important; }` : ''}
  }
</style>`.trim();

  const isBothDisabled = !config.desktop.enabled && !config.mobile.enabled;
  const hideAttr = isBothDisabled ? ' style="display: none !important;" data-pryvix-section-hidden="true"' : '';

  const newMarkup = `<!-- Read More Details Button -->
            <div class="read-more-wrapper pryvix-read-more-wrapper" id="pryvixReadMoreWrapper"${hideAttr}>
                <a href="${config.desktop.url}" class="read-more-btn pryvix-read-more-btn pryvix-rm-desktop"${config.desktop.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ' target="_self"'}>
                    <span>${config.desktop.text}</span>
                </a>
                <a href="${config.mobile.url}" class="read-more-btn pryvix-read-more-btn pryvix-rm-mobile"${config.mobile.openInNewTab ? ' target="_blank" rel="noopener noreferrer"' : ' target="_self"'}>
                    <span>${config.mobile.text}</span>
                </a>
            </div>`;

  // First, ensure existing <style id="pryvix-read-more-styles"> is updated or injected in <head>
  let updatedHtml = html;
  const styleRegex = /<style\b[^>]*id\s*=\s*["']pryvix-read-more-styles["'][^>]*>[\s\S]*?<\/style>/i;
  if (styleRegex.test(updatedHtml)) {
    updatedHtml = updatedHtml.replace(styleRegex, scopedStyles);
  } else if (/<\/head>/i.test(updatedHtml)) {
    updatedHtml = updatedHtml.replace(/<\/head>/i, `    ${scopedStyles}\n</head>`);
  } else {
    updatedHtml = `${scopedStyles}\n${updatedHtml}`;
  }

  // Next, replace or insert the markup
  const boundaryAfterStyle = def.findBoundary(updatedHtml);
  if (boundaryAfterStyle) {
    return (
      updatedHtml.substring(0, boundaryAfterStyle.start) +
      newMarkup +
      updatedHtml.substring(boundaryAfterStyle.end)
    );
  }

  // If not found, inject inside .campaign-details-container before Scroll To Top button
  const insertRegex = /<!--\s*Scroll\s+to\s+Top\s+Button\s*-->/i;
  if (insertRegex.test(updatedHtml)) {
    return updatedHtml.replace(insertRegex, `${newMarkup}\n\n        <!-- Scroll to Top Button -->`);
  }

  // Fallback: inject before </section> of campaign-details-section
  const campaignSecRegex = /(<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-details-section\b[^"']*["'][^>]*>[\s\S]*?)(<\/section>)/i;
  if (campaignSecRegex.test(updatedHtml)) {
    return updatedHtml.replace(campaignSecRegex, `$1    ${newMarkup}\n    $2`);
  }

  return updatedHtml;
}

/**
 * Adds an authorized predefined section to the HTML.
 */
export function addSectionToHtml(
  html: string,
  sectionType: SupportedSectionType
): string {
  if (sectionType === 'read_more_button') {
    return updateReadMoreButtonInHtml(html, DEFAULT_READ_MORE_CONFIG);
  }

  if (sectionType === 'additional_content') {
    // Check if already present
    if (/<section\b[^>]*class\s*=\s*["'][^"']*\badditional-content-section\b[^"']*["']/i.test(html)) {
      return html;
    }
    const sectionHtml = `
    <!-- Additional Content Section -->
    <section class="additional-content-section" id="pryvixAdditionalContentSection" style="padding: 44px 20px; text-align: center; background: rgba(10, 14, 26, 0.85); color: #ffffff; border-top: 1px solid rgba(37, 99, 235, 0.2);">
        <div class="additional-content-container" style="max-width: 1000px; margin: 0 auto;">
            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 12px; color: #ffffff; letter-spacing: 0.5px;">Additional Campaign Highlights</h2>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; max-width: 800px; margin: 0 auto;">
                Explore exclusive campaign rewards, partnership announcements, and verified participant updates.
            </p>
        </div>
    </section>`.trim();

    // Insert after prize-banner-section or before campaign-details-section
    const prizeSecRegex = /(<\/section>\s*)(<!--\s*Campaign\s+Details\s+Section\s*-->|<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-details-section\b)/i;
    if (prizeSecRegex.test(html)) {
      return html.replace(prizeSecRegex, `</section>\n\n    ${sectionHtml}\n\n    $2`);
    }

    // Fallback: before </body>
    return html.replace(/<\/body>/i, `    ${sectionHtml}\n</body>`);
  }

  if (sectionType === 'campaign_info') {
    if (/<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-info-section\b[^"']*["']/i.test(html)) {
      return html;
    }
    const sectionHtml = `
    <!-- Campaign Information Section -->
    <section class="campaign-info-section" id="pryvixCampaignInfoSection" style="padding: 44px 20px; text-align: center; background: rgba(15, 23, 42, 0.9); color: #ffffff; border-top: 1px solid rgba(124, 58, 237, 0.25);">
        <div class="campaign-info-container" style="max-width: 1000px; margin: 0 auto;">
            <h2 style="font-size: 24px; font-weight: 700; margin-bottom: 18px; color: #ffffff; letter-spacing: 0.5px;">Campaign Schedule &amp; Eligibility</h2>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-top: 20px;">
                <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 22px; flex: 1 1 280px; max-width: 340px; text-align: left;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #60a5fa; margin-bottom: 8px;">Key Promotion Dates</h3>
                    <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">Campaign registration officially closes at 11:59 PM AEDT on the final draw date.</p>
                </div>
                <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 12px; padding: 22px; flex: 1 1 280px; max-width: 340px; text-align: left;">
                    <h3 style="font-size: 16px; font-weight: 600; color: #c084fc; margin-bottom: 8px;">Participant Eligibility</h3>
                    <p style="font-size: 13px; color: #cbd5e1; margin: 0; line-height: 1.5;">Open to verified Australian residents aged 18 years or older who complete required registration fields.</p>
                </div>
            </div>
        </div>
    </section>`.trim();

    const prizeSecRegex = /(<\/section>\s*)(<!--\s*Campaign\s+Details\s+Section\s*-->|<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-details-section\b)/i;
    if (prizeSecRegex.test(html)) {
      return html.replace(prizeSecRegex, `</section>\n\n    ${sectionHtml}\n\n    $2`);
    }

    return html.replace(/<\/body>/i, `    ${sectionHtml}\n</body>`);
  }

  throw new Error(`Unsupported section type: ${sectionType}`);
}

/**
 * Removes an explicitly added section from the HTML.
 */
export function removeSectionFromHtml(html: string, sectionId: string): string {
  const def = SUPPORTED_SECTIONS_REGISTRY.find(d => d.id === sectionId);
  if (!def || !def.isDeletable) return html;

  const boundary = def.findBoundary(html);
  if (!boundary) return html;

  return html.substring(0, boundary.start) + html.substring(boundary.end);
}
