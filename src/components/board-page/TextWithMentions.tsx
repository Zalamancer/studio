"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils'; // Assuming getInitials is not needed here if we display full names or use avatar fallback

interface TextWithMentionsProps {
  text: string;
  mentionedUserIds?: string[];
  IS_UID_REGEX: RegExp; // Pass the regex as a prop
}

export const TextWithMentions: React.FC<TextWithMentionsProps> = React.memo(({ text, mentionedUserIds = [], IS_UID_REGEX }) => {
  const validMentionedUids = useMemo(() => mentionedUserIds.filter(id => id && IS_UID_REGEX.test(id)), [mentionedUserIds, IS_UID_REGEX]);

  const { data: mentionProfilesMap = new Map<string, UserProfileBasic | null>(), isLoading: isLoadingMentionProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['mentionProfiles', validMentionedUids.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (validMentionedUids.length === 0) return profiles;
      console.log(`%c[TextWithMentions] QueryFn: Fetching profiles for UIDs:`, "color: teal;", validMentionedUids);
      await Promise.all(
        validMentionedUids.map(async (userId) => {
          try {
            const profile = await fetchUserProfileBasic(userId);
            profiles.set(userId, profile);
          } catch (error) {
            console.warn(`%c[TextWithMentions] QueryFn: Error fetching profile for UID ${userId}:`, "color: orange;", error);
            profiles.set(userId, null);
          }
        })
      );
      return profiles;
    },
    enabled: validMentionedUids.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const renderableParts = useMemo(() => {
    if (typeof text !== 'string' || text.trim() === '') return [<React.Fragment key="original-text">{text || ''}</React.Fragment>];

    const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,})/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(mentionRegexGlobal)) {
      const mentionWithAt = match[0];
      const textualMention = match[1];
      const startIndex = match.index!;

      if (startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, startIndex));
      }

      let profileToLink: UserProfileBasic | null | undefined = undefined;
      const textualMentionLower = textualMention.toLowerCase();

      if (IS_UID_REGEX.test(textualMention) && mentionProfilesMap.has(textualMention)) {
        profileToLink = mentionProfilesMap.get(textualMention);
      } else if (mentionProfilesMap.size > 0) {
        for (const profile of mentionProfilesMap.values()) {
          if (profile && profile.mentionName?.toLowerCase() === textualMentionLower) {
            profileToLink = profile;
            break;
          }
        }
      }

      if (profileToLink && profileToLink.userId && IS_UID_REGEX.test(profileToLink.userId)) {
        parts.push(
          <Link
            key={`${profileToLink.userId}-${startIndex}`}
            href={`/profile/${profileToLink.userId}`}
            className="text-primary hover:underline font-medium cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {`@${profileToLink.mentionName || generateAnonymousName(profileToLink.userId)}`}
          </Link>
        );
      } else {
        parts.push(
          <span
            key={`unresolved-${textualMention}-${startIndex}`}
            className="text-primary cursor-pointer"
            title={`Mention: ${mentionWithAt} (User not resolved or linkable from context)`}
            onClick={(e) => e.stopPropagation()}
          >
            {mentionWithAt}
          </span>
        );
      }
      lastIndex = startIndex + mentionWithAt.length;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    return parts;
  }, [text, mentionProfilesMap, IS_UID_REGEX]);

  if (isLoadingMentionProfiles && validMentionedUids.length > 0) {
    return <span className="text-muted-foreground/80 italic">Loading mentions in text...</span>;
  }

  return <>{renderableParts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}</>;
});
TextWithMentions.displayName = 'TextWithMentions';