export const SITE_NAME = "GTAClipper";
/** Operator shown in the footer and legal pages. Set NEXT_PUBLIC_COMPANY_* in .env. */
export const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || "GTAClipper";
export const COMPANY_REGISTRATION_NUMBER = process.env.NEXT_PUBLIC_COMPANY_REGISTRATION_NUMBER?.trim() || "N/A";
export const COMPANY_REGISTERED_ADDRESS = process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || "India";
export const DEFAULT_SITE_URL = "https://www.gtaclipper.com";
export const HOSTED_APP_URL = DEFAULT_SITE_URL;
/** Public GitHub repository for this project. */
export const DEFAULT_SOURCE_CODE_URL = "https://github.com/V413havai/gtaclipper";
/**
 * Where users can get this deployment's source code. AGPL-3.0 section 13 requires
 * offering the source to people who use the app over a network. If you deploy a
 * modified copy, point NEXT_PUBLIC_SOURCE_CODE_URL at your own repository.
 */
export const GITHUB_URL = process.env.NEXT_PUBLIC_SOURCE_CODE_URL?.trim() || DEFAULT_SOURCE_CODE_URL;
/** The hosted MCP server's Streamable HTTP endpoint (legacy SSE clients use `/sse`). */
export const HOSTED_MCP_URL = "https://mcp.gtaclipper.com/mcp";

/** MCP endpoint shown in setup snippets; self-hosters set NEXT_PUBLIC_MCP_URL. */
export function getMcpUrl() {
  const value = process.env.NEXT_PUBLIC_MCP_URL?.trim();
  if (!value) return HOSTED_MCP_URL;
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    return HOSTED_MCP_URL;
  }
}
export const APP_STORE_ID = "6784760040";
export const APP_STORE_URL = `https://apps.apple.com/us/app/gtaclipper/id${APP_STORE_ID}`;
export const PRODUCT_HUNT_URL =
  "https://www.producthunt.com/products/gtaclipper?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-gtaclipper";
/** Product Hunt's launch badge; it shows the live upvote count once the launch is up. */
export const PRODUCT_HUNT_BADGE_URL =
  "https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1276786&theme=dark";

/** Opens the App Store's offer-code redemption for a creator's custom code (the "Creator offer"). */
export function appStoreRedeemUrl(code: string) {
  return `https://apps.apple.com/redeem?ctx=offercodes&id=${APP_STORE_ID}&code=${encodeURIComponent(code.toUpperCase())}`;
}

export function getSiteUrl() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL).origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}
