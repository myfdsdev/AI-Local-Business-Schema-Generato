/**
 * Shared enums. Kept in one place so Mongoose models, validators and
 * authorization checks cannot drift apart.
 */

// This app's fixed id in the AppsFields platform. Stamped on every tenant record.
export const APP_ID = 'localschema';

// Roles WITHIN a workspace (distinct from the platform ROLES below).
export const WORKSPACE_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
});

export const WORKSPACE_ROLE_VALUES = Object.freeze(Object.values(WORKSPACE_ROLES));

export const WORKSPACE_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  CANCELLED: 'cancelled',
});

export const WORKSPACE_STATUS_VALUES = Object.freeze(Object.values(WORKSPACE_STATUS));

export const MEMBER_STATUS = Object.freeze({
  ACTIVE: 'active',
  INVITED: 'invited',
  REVOKED: 'revoked',
});

export const MEMBER_STATUS_VALUES = Object.freeze(Object.values(MEMBER_STATUS));

export const INVITATION_STATUS = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
});

export const INVITATION_STATUS_VALUES = Object.freeze(Object.values(INVITATION_STATUS));

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  AGENCY: 'agency',
  USER: 'user',
});

export const ROLE_VALUES = Object.freeze(Object.values(ROLES));

export const ACCOUNT_TYPES = Object.freeze({
  LOCAL_BUSINESS: 'local_business',
  FREELANCER: 'freelancer',
  SEO_AGENCY: 'seo_agency',
  WEB_DEVELOPER: 'web_developer',
  MARKETING_CONSULTANT: 'marketing_consultant',
});

export const ACCOUNT_TYPE_VALUES = Object.freeze(Object.values(ACCOUNT_TYPES));

export const ONBOARDING_GOALS = Object.freeze({
  GENERATE_SCHEMA: 'generate_schema',
  AUDIT_SCHEMA: 'audit_schema',
  MANAGE_LOCATIONS: 'manage_locations',
  CLIENT_REPORTS: 'client_reports',
  MONITOR_ERRORS: 'monitor_errors',
});

export const ONBOARDING_GOAL_VALUES = Object.freeze(Object.values(ONBOARDING_GOALS));

// Post-login onboarding questionnaire answers (spec section 4, step 2). These
// are high-level bands, distinct from the granular SchemaType catalog.
export const ONBOARDING_BUSINESS_CATEGORIES = Object.freeze([
  'food',
  'health',
  'home_services',
  'beauty',
  'retail',
  'professional',
  'lodging',
  'other',
]);

export const ONBOARDING_LOCATION_BANDS = Object.freeze(['single', '2_5', '6_20', '20_plus']);

export const ONBOARDING_EXPERIENCE_LEVELS = Object.freeze(['new', 'some', 'advanced']);

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DELETED: 'deleted',
});

export const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUS));

export const PLAN_SLUGS = Object.freeze({
  FREE: 'free',
  PRO: 'pro',
  AGENCY: 'agency',
});

export const PLAN_SLUG_VALUES = Object.freeze(Object.values(PLAN_SLUGS));

export const BILLING_INTERVALS = Object.freeze(['month', 'year', 'lifetime']);

export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  INCOMPLETE: 'incomplete',
});

export const SUBSCRIPTION_STATUS_VALUES = Object.freeze(Object.values(SUBSCRIPTION_STATUS));

/** Default page-scan allowance per plan (spec section 4, step 4). */
export const PLAN_PAGE_SCAN_LIMITS = Object.freeze({
  [PLAN_SLUGS.FREE]: 5,
  [PLAN_SLUGS.PRO]: 25,
  [PLAN_SLUGS.AGENCY]: 100,
});

/** Scan credits granted on registration. */
export const INITIAL_SCAN_CREDITS = 25;

export const PROJECT_STATUS = Object.freeze({
  DRAFT: 'draft',
  SCANNING: 'scanning',
  READY: 'ready',
  ARCHIVED: 'archived',
});

export const PROJECT_STATUS_VALUES = Object.freeze(Object.values(PROJECT_STATUS));

export const LOCATION_MODES = Object.freeze({
  SINGLE: 'single',
  MULTI: 'multi',
});

export const LOCATION_MODE_VALUES = Object.freeze(Object.values(LOCATION_MODES));

export const CMS_OPTIONS = Object.freeze([
  'wordpress',
  'shopify',
  'wix',
  'webflow',
  'squarespace',
  'react',
  'nextjs',
  'custom_html',
  'other',
]);

export const SCAN_STATUS = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
});

export const SCAN_STATUS_VALUES = Object.freeze(Object.values(SCAN_STATUS));

/** Ordered scan steps surfaced to the UI (spec section 4, step 4). */
export const SCAN_STEPS = Object.freeze([
  'preparing_scan',
  'reading_homepage',
  'discovering_pages',
  'extracting_business_information',
  'detecting_existing_schema',
  'generating_recommendations',
  'validating_results',
  'scan_completed',
]);

export const PAGE_TYPES = Object.freeze([
  'homepage',
  'about',
  'contact',
  'services',
  'locations',
  'faq',
  'products',
  'blog',
  'sitemap',
]);

export const SCHEMA_STATUS = Object.freeze({
  DRAFT: 'draft',
  GENERATED: 'generated',
  VALID: 'valid',
  WARNING: 'warning',
  ERROR: 'error',
});

export const SCHEMA_STATUS_VALUES = Object.freeze(Object.values(SCHEMA_STATUS));

/** Installation verification outcomes (spec section 15). */
export const INSTALL_STATUS = Object.freeze({
  NOT_INSTALLED: 'not_installed',
  DETECTED: 'installation_detected',
  INSTALLED_VALID: 'installed_and_valid',
  INSTALLED_WARNINGS: 'installed_with_warnings',
  INSTALLED_ERRORS: 'installed_with_errors',
  SCHEMA_CHANGED: 'generated_schema_has_changed',
  VERIFICATION_FAILED: 'verification_failed',
});

export const INSTALL_STATUS_VALUES = Object.freeze(Object.values(INSTALL_STATUS));

export const SCHEMA_FORMATS = Object.freeze(['json-ld', 'microdata', 'rdfa']);

/** Confidence bands shown in the business data editor (spec section 9). */
export const CONFIDENCE_BANDS = Object.freeze({
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  MANUAL: 'manual',
});

export const EXTRACTION_METHODS = Object.freeze([
  'website_text',
  'existing_schema',
  'meta_tags',
  'ai_inference',
  'manual_entry',
]);

export const CREDIT_TRANSACTION_TYPES = Object.freeze({
  GRANT: 'grant',
  RESERVE: 'reserve',
  CONSUME: 'consume',
  REFUND: 'refund',
  ADMIN_ADJUSTMENT: 'admin_adjustment',
});

export const CREDIT_TRANSACTION_TYPE_VALUES = Object.freeze(
  Object.values(CREDIT_TRANSACTION_TYPES),
);

export const TEAM_ROLES = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
});

export const TEAM_ROLE_VALUES = Object.freeze(Object.values(TEAM_ROLES));

export const TEAM_MEMBER_STATUS = Object.freeze(['invited', 'active', 'revoked']);

/** Machine-readable API error codes (spec section 26). */
export const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  EMAIL_ALREADY_REGISTERED: 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  PROJECT_LIMIT_REACHED: 'PROJECT_LIMIT_REACHED',
  INVALID_WEBSITE_URL: 'INVALID_WEBSITE_URL',
  UNSAFE_WEBSITE_URL: 'UNSAFE_WEBSITE_URL',
  DUPLICATE_PROJECT: 'DUPLICATE_PROJECT',

  WEBSITE_SCAN_FAILED: 'WEBSITE_SCAN_FAILED',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
});
