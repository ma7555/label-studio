import type { TipsCollection } from "./types";

/**
 * Tips are intentionally disabled.
 *
 * The upstream tip content was third-party promotional material (Enterprise
 * upsells, onboarding links), which does not belong in this product. Keeping
 * the collections empty means the HeidiTips component renders nothing on the
 * project creation, organization and project settings pages.
 */
export const defaultTipsCollection: TipsCollection = {
  projectCreation: [],
  organizationPage: [],
  projectSettings: [],
};
