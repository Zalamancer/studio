
// src/components/board-page/TextWithMentions.tsx
"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';

// Define IS_UID_REGEX here or import from a shared location if it becomes widely used
const IS_UID_REGEX_MENTIONS = /^[a-zA-Z0-9]{20,}$/;

interface TextWithMentionsProps {
  text: string;
  mentionedUserIds?: string[]; // Should be an array of actual UIDs
}

export const TextWithMentions: React.FC<TextWithMentionsProps> = React.memo(({ text, mentionedUserIds = [] }) => {
  const validMentionedUids = useMemo(() => mentionedUserIds.filter(id => id && IS_UID_REGEX_MENTIONS.test(id)), [mentionedUserIds]);

  const { data: mentionProfilesMap = new Map<string, UserProfileBasic | null>(), isLoading: isLoadingMentionProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['mentionProfilesForText', validMentionedUids.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (validMentionedUids.length === 0) {
        
        return profiles;
      }
      
      await Promise.all(
        validMentionedUids.map(async (userId) => {
          try {
            const profile = await fetchUserProfileBasic(userId);
            profiles.set(userId, profile);
          } catch (error) {
            // console.warn(`[TextWithMentions] QueryFn: Error fetching profile for UID ${userId}:`, error);
            profiles.set(userId, null); // Store null if fetch fails to avoid re-fetching constantly
          }
        })
      );
      
      return profiles;
    },
    enabled: validMentionedUids.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const renderableParts = useMemo(() => {
    if (typeof text !== 'string' || text.trim() === '') {
      return [<React.Fragment key="empty-text">{text || ''}</React.Fragment>];
    }

    const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,28})/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;

    for (const match of text.matchAll(mentionRegexGlobal)) {
      const mentionWithAt = match[0]; // e.g., "@BlueWhale123" or "@ActualUID"
      const textualMention = match[1]; // e.g., "BlueWhale123" or "ActualUID"
      const startIndex = match.index!;

      if (startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, startIndex));
      }

      let profileToLink: UserProfileBasic | null | undefined = undefined;
      const textualMentionLower = textualMention.toLowerCase();

      if (IS_UID_REGEX_MENTIONS.test(textualMention) && mentionProfilesMap.has(textualMention)) {
        profileToLink = mentionProfilesMap.get(textualMention);
      } else if (mentionProfilesMap.size > 0) {
        for (const profile of mentionProfilesMap.values()) {
          if (profile && profile.mentionName?.toLowerCase() === textualMentionLower) {
            profileToLink = profile;
            break;
          }
        }
      }

      if (profileToLink && profileToLink.userId && IS_UID_REGEX_MENTIONS.test(profileToLink.userId)) {
        parts.push(
          <Link
            key={`${profileToLink.userId}-${startIndex}`}
            href={`/profile/${profileToLink.userId}`}
            className="text-primary hover:underline font-medium cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {`@${profileToLink.mentionName}`}
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
  }, [text, mentionProfilesMap]);


  if (isLoadingMentionProfiles && validMentionedUids.length > 0) {
    // Optional: render the text as is while profiles are loading to avoid layout shifts
    // or show a more subtle loading indicator if preferred.
    return <>{text}</>; 
  }

  return <>{renderableParts.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}</>;
});
TextWithMentions.displayName = 'TextWithMentions';

