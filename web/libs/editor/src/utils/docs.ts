/**
 * Returns the base URL for the in-app documentation.
 *
 * The product ships a single, self-hosted documentation page, so every help
 * link resolves there instead of to a third-party site.
 */
export function getDocsBaseUrl(): string {
  return "/documentation";
}

/**
 * Returns a full documentation URL.
 *
 * The bundled documentation is a single page, so the requested path is ignored
 * and the base documentation URL is returned.
 *
 * @param _pathOSS - Retained for call-site compatibility
 * @param _pathEnterprise - Retained for call-site compatibility
 * @returns {string} Full documentation URL
 */
export function getDocsUrl(_pathOSS?: string, _pathEnterprise?: string): string {
  return getDocsBaseUrl();
}
