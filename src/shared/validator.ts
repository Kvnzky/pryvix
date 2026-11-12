import {
  ValidationIssue,
  ValidationReport,
  ImageAsset,
  GHLForm,
  SourceComparisonReport,
  SourceComparisonDifference,
  ExplicitReplacementsMap,
} from './types';

export function validateLandingPage(
  html: string,
  assets: ImageAsset[],
  forms: GHLForm[]
): ValidationReport {
  const issues: ValidationIssue[] = [];

  // 1. HTML STRUCTURE VALIDATION
  if (!html || !html.trim()) {
    issues.push({
      id: 'html_empty',
      severity: 'error',
      category: 'html',
      title: 'Empty HTML Document',
      message: 'The landing page HTML is completely empty.',
    });
    return {
      passed: false,
      totalErrors: 1,
      totalWarnings: 0,
      totalInfos: 0,
      issues,
    };
  }

  // Check doctype
  if (!/<!DOCTYPE\s+html>/i.test(html)) {
    issues.push({
      id: 'html_doctype',
      severity: 'warning',
      category: 'html',
      title: 'Missing <!DOCTYPE html>',
      message: 'HTML5 doctype declaration is missing.',
      actionHint: 'Add <!DOCTYPE html> at the beginning of the file.',
    });
  }

  // Check <html>, <head>, <body>
  if (!/<html\b/i.test(html) || !/<\/html>/i.test(html)) {
    issues.push({
      id: 'html_root',
      severity: 'warning',
      category: 'html',
      title: 'Missing <html> tags',
      message: 'Document is missing opening or closing <html> tags.',
    });
  }

  // Check duplicate element IDs in HTML (ensure we only match exact id="..." attribute, not data-*-id)
  const idRegex = /(?:^|\s)id\s*=\s*["']([^"']+)["']/gi;
  const idCounts = new Map<string, number>();
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idRegex.exec(html)) !== null) {
    const idVal = idMatch[1].trim();
    if (idVal) {
      idCounts.set(idVal, (idCounts.get(idVal) || 0) + 1);
    }
  }

  idCounts.forEach((count, id) => {
    if (count > 1) {
      issues.push({
        id: `dup_id_${id}`,
        severity: 'error',
        category: 'html',
        title: `Duplicate Element ID: "${id}"`,
        message: `ID "${id}" appears ${count} times in the document. HTML IDs must be globally unique to avoid broken scripts and styles.`,
      });
    }
  });

  // 2. IMAGE ASSETS VALIDATION
  if (assets.length === 0) {
    issues.push({
      id: 'img_none_found',
      severity: 'info',
      category: 'images',
      title: 'No Images Detected',
      message: 'No images or background graphics were identified in this document.',
    });
  }

  // Check unhosted local file paths (CRITICAL requirement from prompt)
  assets.forEach(asset => {
    const url = asset.currentUrl.trim();
    if (asset.status === 'unhosted_local') {
      issues.push({
        id: `img_local_${asset.id}`,
        severity: 'error',
        category: 'images',
        title: `Unhosted Local Image: ${asset.label}`,
        message: `Image uses a local computer file path: "${url}". This will NOT load on a live GoHighLevel landing page. It must be hosted on a public CDN/HTTPS URL.`,
        lineNumber: asset.htmlLineNumber,
        assetId: asset.id,
        actionHint: 'Replace URL with a publicly accessible HTTPS image link.',
      });
    } else if (asset.status === 'invalid') {
      issues.push({
        id: `img_invalid_${asset.id}`,
        severity: 'error',
        category: 'images',
        title: `Invalid Image URL: ${asset.label}`,
        message: `The image URL format is invalid: "${url}".`,
        lineNumber: asset.htmlLineNumber,
        assetId: asset.id,
      });
    }

    // Check missing alt text on standard <img>
    if (asset.type === 'html_img' && (!asset.altText || !asset.altText.trim())) {
      issues.push({
        id: `img_alt_${asset.id}`,
        severity: 'warning',
        category: 'images',
        title: `Missing Alt Text: ${asset.label}`,
        message: `Image at line ${asset.htmlLineNumber || '?'} has an empty alt attribute, affecting accessibility.`,
        lineNumber: asset.htmlLineNumber,
        assetId: asset.id,
      });
    }
  });

  // Check responsive pairing (e.g., desktop without mobile or mobile without desktop)
  const heroDesktop = assets.some(a => a.role === 'hero_brand' && a.device === 'desktop');
  const heroMobile = assets.some(a => a.role === 'hero_brand' && (a.device === 'mobile' || a.device === 'tablet'));
  if (heroDesktop && !heroMobile) {
    issues.push({
      id: 'img_hero_missing_mobile',
      severity: 'warning',
      category: 'images',
      title: 'Missing Mobile Hero Branding',
      message: 'Hero Branding has a Desktop image but no responsive Mobile/Tablet image detected.',
    });
  }

  // 3. CSS VALIDATION
  const unclosedStyleBraces = (html.match(/\{/g) || []).length !== (html.match(/\}/g) || []).length;
  if (unclosedStyleBraces) {
    issues.push({
      id: 'css_braces',
      severity: 'warning',
      category: 'css',
      title: 'Potential Mismatched Braces in Styles/Scripts',
      message: 'Found an unequal count of "{" and "}" characters. Ensure all CSS and script blocks are properly closed.',
    });
  }

  // 4. GOHIGHLEVEL FORMS VALIDATION
  if (forms.length === 0) {
    issues.push({
      id: 'ghl_no_forms',
      severity: 'info',
      category: 'ghl_forms',
      title: 'No GoHighLevel Forms Detected',
      message: 'No GHL form embed iframes or form_embed.js scripts were found in the document.',
    });
  } else {
    // Check embed script
    const hasEmbedScript = /form_embed\.js/i.test(html);
    if (!hasEmbedScript) {
      issues.push({
        id: 'ghl_missing_embed_script',
        severity: 'warning',
        category: 'ghl_forms',
        title: 'Missing form_embed.js Script',
        message: 'GoHighLevel iframe is present, but form_embed.js was not detected. The form height may not auto-resize.',
        actionHint: 'Add <script src="https://link.megarewards.au/js/form_embed.js"></script>',
      });
    }

    forms.forEach(form => {
      if (!form.formId || String(form.formId).trim() === '') {
        issues.push({
          id: `ghl_empty_id_${form.id}`,
          severity: 'error',
          category: 'ghl_forms',
          title: `Missing Form ID: ${form.formName || 'GoHighLevel Form'}`,
          message: 'The GoHighLevel form has no form ID specified. The iframe will not load any form.',
          lineNumber: form.lineNumber,
          formId: form.id,
        });
      }

      // Check token logic
      if (form.customScripts?.hasLoginToken && !/megaLoginToken/i.test(html)) {
        issues.push({
          id: `ghl_login_token_ref_${form.id}`,
          severity: 'warning',
          category: 'ghl_forms',
          title: `Unbound Login Token Reference: ${form.formName}`,
          message: 'Form script looks for megaLoginToken, but token initialization might be missing or misplaced.',
          lineNumber: form.lineNumber,
          formId: form.id,
        });
      }
    });

    // Check separate desktop/mobile instances
    const hasDesktopForm = forms.some(f => f.deviceTarget === 'desktop');
    const hasMobileForm = forms.some(f => f.deviceTarget === 'mobile');
    if (hasDesktopForm && !hasMobileForm) {
      issues.push({
        id: 'ghl_single_form_instance',
        severity: 'info',
        category: 'ghl_forms',
        title: 'Desktop Form Only',
        message: 'Only a Desktop form instance is present. If targeting mobile devices with separated layout, ensure responsive display is intended.',
      });
    }
  }

  // 5. JAVASCRIPT VALIDATION
  // Check for getElementById targets that do not exist
  const getElemCalls = html.matchAll(/document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const match of getElemCalls) {
    const targetId = match[1];
    const idPattern = new RegExp(`id\\s*=\\s*["']${targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
    if (!idPattern.test(html)) {
      issues.push({
        id: `js_missing_elem_${targetId}`,
        severity: 'warning',
        category: 'javascript',
        title: `Element Not Found: #${targetId}`,
        message: `JavaScript references document.getElementById('${targetId}'), but no element with id="${targetId}" exists in the HTML.`,
      });
    }
  }

  // Summary counts
  const totalErrors = issues.filter(i => i.severity === 'error').length;
  const totalWarnings = issues.filter(i => i.severity === 'warning').length;
  const totalInfos = issues.filter(i => i.severity === 'info').length;

  return {
    passed: totalErrors === 0,
    totalErrors,
    totalWarnings,
    totalInfos,
    issues,
  };
}

/**
 * MANDATORY SOURCE COMPARISON AND VALIDATION ENGINE
 * Compares original selected reference HTML against candidate/exported HTML.
 * Confirms that EVERY difference is exclusively attributable to an explicitly
 * requested image, video, or form replacement.
 */
export function compareAndValidateSourcePreservation(
  referenceHtml: string,
  candidateHtml: string,
  explicitReplacements: ExplicitReplacementsMap = {}
): SourceComparisonReport {
  const normRef = (referenceHtml || '').replace(/\r\n/g, '\n').trim();
  const normCand = (candidateHtml || '').replace(/\r\n/g, '\n').trim();

  // Detect reference template
  const isVideoTemplate = normRef.includes('.hero-bg-slider video') || normRef.includes('desktopHeroVideo');
  const referenceTemplate: 'static' | 'video' | 'custom' = isVideoTemplate ? 'video' : 'static';
  const referenceFilename = isVideoTemplate
    ? 'LP Reference-video Campaign Details Background.txt'
    : 'LP Reference-static Campaign Details Background.txt';

  const differences: SourceComparisonDifference[] = [];
  const checks = {
    addedHtmlElements: 0,
    removedHtmlElements: 0,
    changedCssRules: 0,
    changedJavaScript: 0,
    modifiedScripts: 0,
    changedClassesOrIds: 0,
    alteredIframeAttributes: 0,
    modifiedResponsiveBreakpoints: 0,
    unrequestedUrlChanges: 0,
  };

  // Build permitted replacement lists (supporting multiple assets sharing the same initial URL/ID)
  const permittedImageList: { orig: string; rep: string }[] = [];
  (explicitReplacements.images || []).forEach(img => {
    if (img.originalUrl && img.currentUrl && img.originalUrl !== img.currentUrl) {
      permittedImageList.push({ orig: img.originalUrl.trim(), rep: img.currentUrl.trim() });
    }
  });

  const permittedVideoList: { orig: string; rep: string }[] = [];
  (explicitReplacements.videos || []).forEach(vid => {
    if (vid.originalUrl && vid.currentUrl && vid.originalUrl !== vid.currentUrl) {
      permittedVideoList.push({ orig: vid.originalUrl.trim(), rep: vid.currentUrl.trim() });
    }
  });

  const permittedFormList: { origId: string; newId: string }[] = [];
  (explicitReplacements.forms || []).forEach(f => {
    if (f.originalFormId && f.newFormId && f.originalFormId !== f.newFormId) {
      permittedFormList.push({ origId: f.originalFormId.trim(), newId: f.newFormId.trim() });
    }
  });

  // Track authorized hidden sections
  (explicitReplacements.hiddenSections || []).forEach(secId => {
    differences.push({
      type: 'section_visibility',
      location: `Section [${secId}]`,
      originalValue: 'Visible',
      replacedValue: 'Hidden',
      isPermitted: true,
      description: `Authorized section visibility change: section [${secId}] marked hidden.`,
    });
  });

  // 1. HTML ELEMENT / TAG STRUCTURE CHECK
  const extractTags = (html: string) => {
    const matches: string[] = [];
    const tagRegex = /<\/?([a-zA-Z0-9\-]+)(?:\s+[^>]*)?>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(html)) !== null) {
      matches.push(m[1].toLowerCase());
    }
    return matches;
  };

  const countAuthorizedComponentTags = (html: string) => {
    let count = 0;
    const rmStyle = /<style\b[^>]*id\s*=\s*["']pryvix-read-more-styles["'][^>]*>[\s\S]*?<\/style>/i.exec(html);
    if (rmStyle) count += extractTags(rmStyle[0]).length;
    const rmWrapper = /<div\b[^>]*class\s*=\s*["'][^"']*\bpryvix-read-more-wrapper\b[^"']*["'][^>]*>[\s\S]*?<\/div>/i.exec(html);
    if (rmWrapper) {
      count += Math.max(0, extractTags(rmWrapper[0]).length - 3);
    }
    const addSec = /<section\b[^>]*class\s*=\s*["'][^"']*\badditional-content-section\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i.exec(html);
    if (addSec) count += extractTags(addSec[0]).length;
    const infoSec = /<section\b[^>]*class\s*=\s*["'][^"']*\bcampaign-info-section\b[^"']*["'][^>]*>[\s\S]*?<\/section>/i.exec(html);
    if (infoSec) count += extractTags(infoSec[0]).length;
    return count;
  };

  const refTags = extractTags(normRef);
  const candTags = extractTags(normCand);

  const authorizedExtraTags = countAuthorizedComponentTags(normCand);
  const rawDiff = candTags.length - refTags.length;
  const netDiff = Math.max(0, rawDiff - authorizedExtraTags);

  if (authorizedExtraTags > 0) {
    differences.push({
      type: 'section_addition',
      location: 'Section Manager Components',
      originalValue: 'Default Structure',
      replacedValue: `${authorizedExtraTags} authorized component tags`,
      isPermitted: true,
      description: `Authorized additions: Section Manager components and Read More Button markup.`,
    });
  }

  if (netDiff > 0) {
    checks.addedHtmlElements += netDiff;
    differences.push({
      type: 'unpermitted_change',
      location: 'DOM Structure',
      originalValue: `${refTags.length} tags`,
      replacedValue: `${candTags.length} tags`,
      isPermitted: false,
      description: `Detected ${netDiff} unpermitted additional HTML element(s) inserted into the document.`,
    });
  } else if (candTags.length < refTags.length) {
    const diffCount = refTags.length - candTags.length;
    checks.removedHtmlElements += diffCount;
    differences.push({
      type: 'unpermitted_change',
      location: 'DOM Structure',
      originalValue: `${refTags.length} tags`,
      replacedValue: `${candTags.length} tags`,
      isPermitted: false,
      description: `Detected ${diffCount} original HTML element(s) removed from the document.`,
    });
  }

  // 2. SCRIPTS AND JAVASCRIPT CHECK
  const extractScripts = (html: string) => {
    const scripts: string[] = [];
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = scriptRegex.exec(html)) !== null) {
      scripts.push(m[1].trim());
    }
    return scripts;
  };

  const refScripts = extractScripts(normRef);
  const candScripts = extractScripts(normCand);

  if (candScripts.length !== refScripts.length) {
    checks.modifiedScripts += Math.abs(candScripts.length - refScripts.length);
    differences.push({
      type: 'unpermitted_change',
      location: '<script> tags',
      originalValue: `${refScripts.length} scripts`,
      replacedValue: `${candScripts.length} scripts`,
      isPermitted: false,
      description: `Script tag count mismatch: Expected ${refScripts.length} scripts, found ${candScripts.length}.`,
    });
  } else {
    refScripts.forEach((refScript, idx) => {
      let expectedScript = refScript;
      // Apply permitted form ID substitutions to expected script
      permittedFormList.forEach(({ origId, newId }) => {
        expectedScript = expectedScript.split(origId).join(newId);
      });

      // Apply permitted custom value substitutions to expected script (e.g. form closing token)
      const refCustomValueMatch = /\{\{custom_values\.[a-zA-Z0-9_.-]+\}\}/i.exec(refScript);
      const candCustomValueMatch = /\{\{custom_values\.[a-zA-Z0-9_.-]+\}\}/i.exec(candScripts[idx] || '');
      if (refCustomValueMatch && candCustomValueMatch) {
        expectedScript = expectedScript.split(refCustomValueMatch[0]).join(candCustomValueMatch[0]);
      }

      const actualScript = candScripts[idx];
      if (expectedScript.replace(/\s+/g, ' ') !== actualScript.replace(/\s+/g, ' ')) {
        checks.changedJavaScript += 1;
        differences.push({
          type: 'unpermitted_change',
          location: `Script #${idx + 1}`,
          originalValue: refScript.substring(0, 80) + '...',
          replacedValue: actualScript.substring(0, 80) + '...',
          isPermitted: false,
          description: `JavaScript logic in script #${idx + 1} was altered outside permitted form ID replacement.`,
        });
      }
    });
  }

  // 3. RESPONSIVE BREAKPOINTS AND CSS CHECK
  const extractStyle = (html: string) => {
    const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    let m: RegExpExecArray | null;
    let combined = '';
    while ((m = styleRegex.exec(html)) !== null) {
      combined += m[1] + '\n';
    }
    return combined;
  };

  const refStyle = extractStyle(normRef);
  const candStyle = extractStyle(normCand);

  // Check critical media queries
  const expectedBreakpoints = ['@media (max-width: 1199px)', '@media (max-width: 991px)', '@media (min-width: 992px)', '@media (max-width: 768px)'];
  expectedBreakpoints.forEach(bp => {
    if (refStyle.includes(bp) && !candStyle.includes(bp)) {
      checks.modifiedResponsiveBreakpoints += 1;
      differences.push({
        type: 'unpermitted_change',
        location: '<style>',
        originalValue: bp,
        replacedValue: 'Missing',
        isPermitted: false,
        description: `Responsive breakpoint declaration "${bp}" was modified or removed.`,
      });
    }
  });

  // 4. URLS & CONTENT REPLACEMENTS AUDIT
  const extractAllUrls = (html: string) => {
    const urls = new Set<string>();
    // src and srcset
    const srcRegex = /\b(?:src|srcset)\s*=\s*["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = srcRegex.exec(html)) !== null) {
      urls.add(m[1].trim());
    }
    // url('...') in css or inline style
    const urlFuncRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    while ((m = urlFuncRegex.exec(html)) !== null) {
      urls.add(m[1].trim());
    }
    // a href
    const hrefRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
    while ((m = hrefRegex.exec(html)) !== null) {
      urls.add(m[1].trim());
    }
    return urls;
  };

  const refUrls = extractAllUrls(normRef);
  const candUrls = extractAllUrls(normCand);

  // Any URL in candidate that was not in reference must be a permitted replacement
  candUrls.forEach(cUrl => {
    if (!refUrls.has(cUrl)) {
      // Check if it is permitted
      let isPermitted = false;
      let matchedOrig = '';
      let repType: SourceComparisonDifference['type'] = 'image_replacement';

      for (const { orig, rep } of permittedImageList) {
        if (rep === cUrl) {
          isPermitted = true;
          matchedOrig = orig;
          repType = 'image_replacement';
          break;
        }
      }
      if (!isPermitted) {
        for (const { orig, rep } of permittedVideoList) {
          if (rep === cUrl) {
            isPermitted = true;
            matchedOrig = orig;
            repType = 'video_replacement';
            break;
          }
        }
      }
      if (!isPermitted) {
        // Check form URL
        for (const { origId, newId } of permittedFormList) {
          if (cUrl.includes(newId)) {
            isPermitted = true;
            matchedOrig = `widget/form/${origId}`;
            repType = 'form_replacement';
            break;
          }
        }
      }
      if (!isPermitted && explicitReplacements.readMoreConfig) {
        const dUrl = explicitReplacements.readMoreConfig.desktop?.url;
        const mUrl = explicitReplacements.readMoreConfig.mobile?.url;
        if ((dUrl && cUrl === dUrl) || (mUrl && cUrl === mUrl)) {
          isPermitted = true;
          matchedOrig = 'Original Read More Destination';
          repType = 'read_more_config';
        }
      }

      if (isPermitted) {
        differences.push({
          type: repType,
          location: 'Content Asset',
          originalValue: matchedOrig,
          replacedValue: cUrl,
          isPermitted: true,
          description: `Explicit user replacement: ${matchedOrig} -> ${cUrl}`,
        });
      } else {
        checks.unrequestedUrlChanges += 1;
        differences.push({
          type: 'unpermitted_change',
          location: 'URL / Media Source',
          originalValue: 'None (Unrequested)',
          replacedValue: cUrl,
          isPermitted: false,
          description: `Unrequested URL modification detected: "${cUrl}" was not in the user replacement list.`,
        });
      }
    }
  });

  // Calculate totals
  const permittedReplacementsCount = differences.filter(d => d.isPermitted).length;
  const unpermittedChangesCount =
    differences.filter(d => !d.isPermitted).length +
    checks.addedHtmlElements +
    checks.removedHtmlElements +
    checks.changedCssRules +
    checks.changedJavaScript +
    checks.modifiedScripts +
    checks.changedClassesOrIds +
    checks.alteredIframeAttributes +
    checks.modifiedResponsiveBreakpoints;

  const passed = unpermittedChangesCount === 0;

  const summary = passed
    ? `Source Code Preservation Passed: 100% of the original ${referenceTemplate.toUpperCase()} reference source code is preserved. ${permittedReplacementsCount} explicitly requested content replacements verified with 0 unpermitted changes.`
    : `Source Code Preservation Failed: Detected ${unpermittedChangesCount} unpermitted modification(s) outside explicit content replacements.`;

  return {
    passed,
    referenceTemplate,
    referenceFilename,
    totalDifferences: differences.length,
    permittedReplacementsCount,
    unpermittedChangesCount,
    differences,
    checks,
    summary,
  };
}

