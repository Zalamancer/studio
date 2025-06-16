
// src/components/news/ArticleListItem.tsx
"use client";

import React, { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import type { ClientNewsArticle } from '@/types/news';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { MessageSquareText, Bookmark, MoreHorizontal, CalendarDays, Clock, Edit3 } from 'lucide-react'; // Added icons
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ArticleListItemProps {
  article: ClientNewsArticle;
  getCleanTextExcerpt: (htmlString: string | null | undefined, maxLength?: number) => string;
  currentUserId: string | null;
}

export const ArticleListItem: React.FC<ArticleListItemProps> = ({ article, getCleanTextExcerpt, currentUserId }) => {
  const { data: authorProfile, isLoading: isLoadingAuthor } = useQuery({
    queryKey: ['userProfileBasic', article.userId, 'newsAuthor'],
    queryFn: () => fetchUserProfileBasic(article.userId),
    enabled: !!article.userId,
    staleTime: Infinity, 
  });

  const authorName = useMemo(() => {
    if (isLoadingAuthor) return 'Loading author...';
    return authorProfile?.displayName || generateAnonymousName(article.userId);
  }, [authorProfile, isLoadingAuthor, article.userId]);

  const displayDate = useMemo(() => {
    const dateToFormat = article.publishedAt || article.updatedAt || article.createdAt;
    if (!dateToFormat) return 'Date unavailable';
    try {
      return format(new Date(dateToFormat), 'MMM d');
    } catch (e) {
      return 'Invalid date';
    }
  }, [article.publishedAt, article.updatedAt, article.createdAt]);
  
  const excerpt = useMemo(() => getCleanTextExcerpt(article.content, 120), [article.content, getCleanTextExcerpt]);

  const isOwnArticle = article.userId === currentUserId;

  return (
    <article className="py-6 border-b border-border last:border-b-0">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            {/* Placeholder for author avatar - can be added if UserProfileBasic includes avatarUrl */}
            {/* <Avatar className="h-5 w-5"><AvatarImage src={authorProfile?.avatarUrl} /><AvatarFallback>{getInitials(authorName)}</AvatarFallback></Avatar> */}
            <span className="font-medium text-foreground">{authorName}</span>
            <span className="text-muted-foreground/70">in</span>
            <Link href={`/news?category=${encodeURIComponent(article.category.toLowerCase())}`} className="hover:underline text-foreground/90">
              {article.category}
            </Link>
          </div>

          <Link href={`/news/article/${article.id}`} className="group">
            <h2 className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
              {article.title}
            </h2>
            {excerpt && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                {excerpt}
              </p>
            )}
          </Link>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>{displayDate}</span>
              <span className="flex items-center gap-1">
                <MessageSquareText className="h-3.5 w-3.5" />
                {article.commentCount || 0}
              </span>
              {/* Placeholder for reading time/claps */}
            </div>
            <div className="flex items-center gap-2">
              {isOwnArticle && article.status === 'draft' && (
                <Badge variant="outline" className="border-amber-500 text-amber-600">Draft</Badge>
              )}
              {isOwnArticle && (
                 <Button variant="ghost" size="icon" className="h-7 w-7 p-1" asChild>
                    <Link href={`/news/article/${article.id}`} title="Edit Article">
                        <Edit3 className="h-4 w-4"/>
                    </Link>
                 </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7 p-1" title="Save to collection (placeholder)">
                <Bookmark className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 p-1" title="More options (placeholder)">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {article.coverImageUrl && (
          <Link href={`/news/article/${article.id}`} className="block flex-shrink-0 ml-4">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-24 rounded-md overflow-hidden bg-muted">
              <Image
                src={article.coverImageUrl}
                alt={article.title}
                fill
                sizes="(max-width: 640px) 96px, (max-width: 768px) 112px, 128px"
                className="object-cover"
                data-ai-hint="article summary event"
              />
            </div>
          </Link>
        )}
      </div>
    </article>
  );
};
ArticleListItem.displayName = 'ArticleListItem';

