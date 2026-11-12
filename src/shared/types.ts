export type DeviceTarget = 'desktop' | 'tablet' | 'mobile' | 'universal';

export type AssetType =
  | 'html_img'
  | 'picture_source'
  | 'css_background'
  | 'inline_style_bg'
  | 'svg'
  | 'video_poster'
  | 'hyperlink_image'
  | 'html_video';

export type AssetStatus = 'valid' | 'invalid' | 'unverified' | 'unhosted_local';

export interface ImageAsset {
  id: string;
  projectId: string;
  sectionId: string;
  sectionName: string;
  label: string;
  originalLabel: string;
  role:
    | 'hero_bg'
    | 'hero_brand'
    | 'prize_banner'
    | 'campaign_bg'
    | 'campaign_graphic'
    | 'button'
    | 'icon'
    | 'popup'
    | 'logo'
    | 'form_bg'
    | 'unclassified';
  device: DeviceTarget;
  type: AssetType;
  currentUrl: string;
  originalUrl: string;
  replacementUrl?: string;
  altText?: string;
  selectorOrLocation: string;
  htmlLineNumber?: number;
  sourceRange?: {
    start: number;
    end: number;
  };
  dimensions?: {
    width?: number;
    height?: number;
  };
  fileType?: string;
  status: AssetStatus;
  statusMessage?: string;
  parentComponentId?: string;
}

export interface GHLFormCustomScripts {
  hasLoginToken: boolean;
  hasEventId: boolean;
  closingCustomValue?: string; // e.g. {{custom_values.gtagaming_gift_cards_form_closing}}
  rawScripts: string[];
}

export interface GHLForm {
  id: string;
  projectId: string;
  formId: string; // e.g. DuEWLBc3a3oXylBTrYC7
  iframeId: string; // e.g. inline-DuEWLBc3a3oXylBTrYC7 or inline-DuEWLBc3a3oXylBTrYC7-mobile
  formName: string;
  iframeUrl: string;
  height: string | number;
  width: string;
  borderRadius: string;
  cookieConsent: boolean;
  cookieConsentProvider: string;
  embedScriptUrl: string;
  deviceTarget: DeviceTarget;
  customScripts: GHLFormCustomScripts;
  lineNumber?: number;
  dataAttributes?: Record<string, string>;
}

export interface ReadMoreButtonConfig {
  enabled: boolean;
  text: string;
  url: string;
  openInNewTab: boolean;
  backgroundColor: string;
  textColor: string;
  fontSize: string;
  fontWeight: string;
  width: string;
  padding: string;
  borderRadius: string;
  alignment: 'left' | 'center' | 'right';
  marginTop: string;
  marginBottom: string;
  hoverBackgroundColor?: string;
  hoverTextColor?: string;
}

export interface ReadMoreSectionConfig {
  desktop: ReadMoreButtonConfig;
  mobile: ReadMoreButtonConfig;
}

export type SupportedSectionType =
  | 'popup'
  | 'hero'
  | 'mobile_form'
  | 'prize'
  | 'campaign_details'
  | 'read_more_button'
  | 'additional_content'
  | 'campaign_info'
  | 'form'
  | 'floating'
  | 'other';

export interface ComponentSection {
  id: string;
  name: string;
  type: SupportedSectionType;
  visible: boolean;
  desktopVisible?: boolean;
  mobileVisible?: boolean;
  order?: number;
  isAddable?: boolean;
  isDeletable?: boolean;
  isCustomAdded?: boolean;
  originalHtml?: string;
  config?: {
    readMore?: ReadMoreSectionConfig;
    customContent?: {
      title?: string;
      bodyText?: string;
    };
  };
  assetIds: string[];
  formIds: string[];
  headings: { text: string; selector: string; line?: number }[];
  links: { text: string; href: string; selector: string; line?: number }[];
}

export interface SectionManagerSettings {
  sections: ComponentSection[];
  readMoreConfig?: ReadMoreSectionConfig;
}

export interface ChangeHistoryEntry {
  id: string;
  projectId: string;
  timestamp: string;
  component: string;
  description: string;
  prevValue: string;
  newValue: string;
  type: 'image_url' | 'form_id' | 'form_setting' | 'code_edit' | 'text' | 'link' | 'restore';
}

export interface LibraryImage {
  id: string;
  name: string;
  category:
    | 'Hero Images'
    | 'Campaign Banners'
    | 'Desktop Images'
    | 'Mobile Images'
    | 'Logos'
    | 'Icons'
    | 'Backgrounds'
    | 'Popups'
    | 'Buttons'
    | 'Other';
  localPath: string;
  externalUrl?: string;
  dataUrl?: string;
  mimeType: string;
  width?: number;
  height?: number;
  fileSize: number;
  createdAt: string;
}

export type BackgroundMode = 'static' | 'video';

export interface BackgroundConfig {
  mode: BackgroundMode;
  static: {
    desktopImage: string;
    mobileImage: string;
  };
  video: {
    desktopVideo: string;
    mobileVideo: string;
  };
  referenceFiles?: {
    static?: string;
    video?: string;
  };
}

export interface ReferenceTemplate {
  id: 'static' | 'video';
  name: string;
  filename: string;
  description: string;
  content: string;
  lastModified: string;
  isCustom: boolean;
}

export interface Project {
  id: string;
  name: string;
  campaignName: string;
  description: string;
  originalHtml: string;
  currentHtml: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'ready' | 'exported' | 'archived';
  assetCount: number;
  formCount: number;
  syncTitleWithProjectName?: boolean;
  backgroundConfiguration?: BackgroundConfig;
  formTitle?: string;
  sectionSettings?: SectionManagerSettings;
  readMoreConfiguration?: ReadMoreSectionConfig;
}

export interface PortableSettings {
  portableMode: boolean;
  customDataDir?: string;
  syncTitleWithProjectName: boolean;
  activeDataDir?: string;
}

export interface ExportFileInfo {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  exportedAt: string;
  type: 'html' | 'txt' | 'zip';
}

export interface MissingAssetInfo {
  assetId: string;
  label: string;
  url: string;
  device: DeviceTarget;
  reason: string;
}

export type ValidationSeverity = 'error' | 'warning' | 'info' | 'success';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: 'html' | 'images' | 'css' | 'javascript' | 'ghl_forms';
  title: string;
  message: string;
  lineNumber?: number;
  assetId?: string;
  formId?: string;
  actionHint?: string;
}

export interface ValidationReport {
  passed: boolean;
  totalErrors: number;
  totalWarnings: number;
  totalInfos: number;
  issues: ValidationIssue[];
}

export interface ProjectBackup {
  version: string;
  project: Project;
  assets: ImageAsset[];
  forms: GHLForm[];
  sections: ComponentSection[];
  history: ChangeHistoryEntry[];
  exportedAt: string;
}


// Video Quality Assessment Types
export type VideoQualityRating = 'good' | 'needs_attention' | 'poor' | 'unable_to_verify';

export interface VideoQualityCheckItem {
  name: string;
  rating: 'pass' | 'warn' | 'fail' | 'unknown';
  message: string;
  recommendation?: string;
}

export interface VideoMetadata {
  url: string;
  filename: string;
  fileSizeBytes?: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  aspectRatioString?: string;
  aspectRatioDecimal?: number;
  frameRate?: number | string;
  format?: string;
  codec?: string;
  hasAudio?: boolean;
  sourceStatus: 'accessible' | 'inaccessible' | 'loading' | 'unverified';
  playbackStatus: 'playing' | 'paused' | 'stalled' | 'error' | 'ready';
  errorMessage?: string;
}

export interface VideoQualityAssessment {
  overallRating: VideoQualityRating;
  targetRole: 'desktop' | 'mobile' | 'universal';
  scoreSummary: string;
  items: VideoQualityCheckItem[];
  resolutionCheck: VideoQualityCheckItem;
  aspectRatioCheck: VideoQualityCheckItem;
  fileSizeCheck: VideoQualityCheckItem;
  playbackCheck: VideoQualityCheckItem;
  loopingCheck: VideoQualityCheckItem;
}

// Source Comparison and Fidelity Audit Types
export interface SourceComparisonDifference {
  type:
    | 'image_replacement'
    | 'video_replacement'
    | 'form_replacement'
    | 'section_visibility'
    | 'section_addition'
    | 'read_more_config'
    | 'unpermitted_change';
  location: string;
  originalValue: string;
  replacedValue: string;
  isPermitted: boolean;
  description: string;
}

export interface ExplicitReplacementsMap {
  images?: { originalUrl: string; currentUrl: string; label?: string }[];
  videos?: { originalUrl: string; currentUrl: string; label?: string }[];
  forms?: { originalFormId: string; newFormId: string; formName?: string }[];
  hiddenSections?: string[];
  addedSections?: string[];
  readMoreConfig?: ReadMoreSectionConfig;
}

export interface SourceComparisonReport {
  passed: boolean;
  referenceTemplate: 'static' | 'video' | 'custom';
  referenceFilename: string;
  totalDifferences: number;
  permittedReplacementsCount: number;
  unpermittedChangesCount: number;
  differences: SourceComparisonDifference[];
  checks: {
    addedHtmlElements: number;
    removedHtmlElements: number;
    changedCssRules: number;
    changedJavaScript: number;
    modifiedScripts: number;
    changedClassesOrIds: number;
    alteredIframeAttributes: number;
    modifiedResponsiveBreakpoints: number;
    unrequestedUrlChanges: number;
  };
  summary: string;
}

// ============================================================================
// GoHighLevel Media Storage Integration Types (API v3)
// ============================================================================

export type GHLMediaEntityType = 'file' | 'folder';
export type GHLMediaCategory = 'image' | 'video' | 'pdf' | 'uncategorized' | 'folder' | 'other';
export type GHLSortBy = 'updatedAt' | 'createdAt' | 'name';
export type GHLSortOrder = 'asc' | 'desc';
export type GHLFilterTab = 'all' | 'image' | 'video' | 'pdf' | 'uncategorized' | 'folder';

export interface GHLMediaItem {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: GHLMediaEntityType;
  mediaCategory: GHLMediaCategory;
  mimeType?: string;
  fileExtension?: string;
  size?: number;
  parentId?: string | null;
  altId: string;
  altType: 'location';
  createdAt?: string;
  updatedAt?: string;
}

export interface GHLFolderBreadcrumb {
  id: string | null;
  name: string;
}

export interface GHLMediaListParams {
  locationId?: string;
  parentId?: string | null;
  query?: string;
  filterTab?: GHLFilterTab;
  sortBy?: GHLSortBy;
  sortOrder?: GHLSortOrder;
  offset?: number;
  limit?: number;
  refresh?: boolean;
}

export interface GHLMediaListResponse {
  success: boolean;
  items: GHLMediaItem[];
  folders: GHLMediaItem[];
  files: GHLMediaItem[];
  totalCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  locationId: string;
  parentId: string | null;
  fromCache: boolean;
  syncedAt: string;
  categoryCounts?: {
    all: number;
    image: number;
    video: number;
    pdf: number;
    uncategorized: number;
    folder: number;
  };
  error?: string;
  errorCode?:
    | 'NOT_CONFIGURED'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN_SCOPE'
    | 'INVALID_LOCATION'
    | 'RATE_LIMITED'
    | 'NETWORK_ERROR'
    | 'API_ERROR';
}

export interface GHLConnectionStatus {
  connected: boolean;
  hasToken: boolean;
  maskedToken: string;
  locationId: string;
  requiredScope: string;
  status: 'connected' | 'disconnected' | 'error' | 'unconfigured';
  statusMessage: string;
  lastSyncedAt?: string | null;
  lastError?: string | null;
  errorCode?: string | null;
  stats?: {
    fileCount?: number;
    folderCount?: number;
  };
}

export interface GHLVerifyAssetResult {
  accessible: boolean;
  status: number;
  contentType?: string;
  contentLength?: number;
  error?: string;
}


