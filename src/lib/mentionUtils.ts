// src/lib/mentionUtils.ts
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName } from './pseudonymUtils';
import { IS_VALID_FIREBASE_UID_REGEX } from './utils';

/**
 * Extracts Firebase UIDs from text containing @mentions.
 * It prioritizes matching textual mentions (like "ColorAnimalNumber") against
 * the generated anonymous names of users in the profilesToSearch list.
 * It also falls back to checking if a textual mention is a direct UID.
 *
 * @param text The input string containing potential mentions.
 * @param profilesToSearch An array of UserProfileBasic objects to search within for matching mentionNames.
 * @returns An array of resolved Firebase User IDs (UIDs).
 */
export const extractMentionedUids = (text: string, profilesToSearch: UserProfileBasic[]): string[] => {
  if (!text || text.trim() === '' || !profilesToSearch || profilesToSearch.length === 0) {
    return [];
  }

  console.log(`%c[mentionUtils] extractMentionedUids - Input Text: "${text.substring(0, 100)}..."`, "color: #FF8C00;");
  console.log(`%c[mentionUtils] extractMentionedUids - Profiles to Search In (count: ${profilesToSearch.length}):`, "color: #FF8C00;", profilesToSearch.slice(0, 5).map(p => ({ uid: p.userId, mentionName: p.mentionName, displayName: p.displayName })));

  // Regex to capture @ColorAnimalNumber format or @UID format
  const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,28})/g;
  const textualMentions = new Set<string>();
  for (const match of text.matchAll(mentionRegexGlobal)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }

  if (textualMentions.size === 0) {
    console.log(`%c[mentionUtils] extractMentionedUids - No textual mentions found in text.`, "color: #FF8C00;");
    return [];
  }
  console.log(`%c[mentionUtils] extractMentionedUids - Input Textual Mentions Extracted:`, "color: #FF8C00;", Array.from(textualMentions));

  const resolvedUids = new Set<string>();

  for (const textualMention of textualMentions) {
    let foundProfile: UserProfileBasic | undefined = undefined;
    const textualMentionLower = textualMention.toLowerCase();

    // Strategy 1: Match textualMention (as "ColorAnimalNumber") against the mentionName of profiles in profilesToSearch
    foundProfile = profilesToSearch.find(p => {
      const profileMentionNameLower = p.mentionName?.toLowerCase();
      return profileMentionNameLower === textualMentionLower;
    });

    if (foundProfile && foundProfile.userId) {
      console.log(`%c[mentionUtils] extractMentionedUids - Resolved textualMention "${textualMention}" by matching mentionName with profile UID: ${foundProfile.userId}`, "color: green;");
      resolvedUids.add(foundProfile.userId);
      continue;
    }

    // Strategy 2: Fallback - If the textualMention itself is a UID, find if that user is in profilesToSearch
    // This is more of a safety net if a raw UID gets into the text.
    if (IS_VALID_FIREBASE_UID_REGEX.test(textualMention)) {
      foundProfile = profilesToSearch.find(p => p.userId === textualMention);
      if (foundProfile) {
        console.log(`%c[mentionUtils] extractMentionedUids - Resolved textualMention "${textualMention}" as DIRECT UID from profilesToSearch to UID: ${foundProfile.userId}`, "color: green;");
        resolvedUids.add(foundProfile.userId);
        continue;
      }
    }
    console.log(`%c[mentionUtils] extractMentionedUids - Could NOT resolve textual mention: "${textualMention}" to a UID from the provided profiles.`, "color: red;");
  }

  const finalUids = Array.from(resolvedUids);
  console.log(`%c[mentionUtils] extractMentionedUids - Final Resolved UIDs:`, "color: green; font-weight: bold;", finalUids);
  return finalUids;
};