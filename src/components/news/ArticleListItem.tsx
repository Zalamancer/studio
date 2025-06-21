// src/components/news/ArticleListItem.tsx
"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import type { ClientNewsArticle } from '@/types/news';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { format } from 'date-fns';
import { MessageSquareText, Bookmark, MoreHorizontal, Edit3, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SaveToCollectionDialog } from '@/components/collections/SaveToCollectionDialog';

interface ArticleListItemProps {
  article: ClientNewsArticle;
  getCleanTextExcerpt: (htmlString: string | null | undefined, maxLength?: number) => string;
  currentUserId: string | null;
  savedItemIds: Set<string>;
  onCollectionUpdate: () => void;
}

export const ArticleListItem: React.FC<ArticleListItemProps> = ({
  article,
  getCleanTextExcerpt,
  currentUserId,
  savedItemIds,
  onCollectionUpdate,
}) => {
  const { data: authorProfile, isLoading: isLoadingAuthor } = useQuery({
    queryKey: ['userProfileBasic', article.userId, 'newsAuthor'],
    queryFn: () => fetchUserProfileBasic(article.userId),
    enabled: !!article.userId,
    staleTime: Infinity,
  });

  const [isSaveToCollectionDialogOpen, setIsSaveToCollectionDialogOpen] = useState(false);

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
  const isSaved = savedItemIds.has(article.id);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    e.preventDefault();   
    if (currentUserId) {
      setIsSaveToCollectionDialogOpen(true);
    }
  };

  const authorAndTagsRow = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{authorName}</span>
      {article.tags && article.tags.length > 0 && (
        <>
          <span className="text-muted-foreground/70">in</span>
          <span className="flex flex-wrap gap-1">
            {article.tags.slice(0, 2).map(tag => (
               <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0.5 cursor-default">
                 #{tag}
               </Badge>
            ))}
            {article.tags.length > 2 && (
                <span className="text-muted-foreground/70 text-[10px] self-center">
                    +{article.tags.length - 2} more
                </span>
            )}
          </span>
        </>
      )}
    </div>
  );
  
  const mainContent = (
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
  );

  const actionsRow = (
    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
        <span>{displayDate}</span>
        <span className="flex items-center gap-1">
            <MessageSquareText className="h-3.5 w-3.5" />
            {article.commentCount || 0}
        </span>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-1">
        {isOwnArticle && (
            <Button variant="ghost" size="icon" className="h-7 w-7 p-1" asChild>
                <Link href={`/news/article/${article.id}`} title="Edit Article" onClick={(e) => e.stopPropagation()}>
                    <Edit3 className="h-4 w-4"/>
                </Link>
            </Button>
        )}
        {currentUserId && (
            <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 p-1"
            title={isSaved ? "Unsave Article" : "Save Article"}
            onClick={handleSaveClick}
            aria-pressed={isSaved}
            >
            <Bookmark className={cn("h-4 w-4", isSaved ? "fill-primary text-primary" : "")} />
            </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 p-1" title="More options (placeholder)" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
        </Button>
        </div>
    </div>
  );

  const imageColumn = article.coverImageUrl && (
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
  );

  return (
    <>
      <article className="py-6 border-b border-border last:border-b-0">
        <div className="mb-2">
            {authorAndTagsRow}
        </div>
        <div className="flex justify-between items-start gap-4">
          <div className="flex-grow min-w-0">
            {mainContent}
          </div>
          {imageColumn}
        </div>
        {actionsRow}
      </article>
      {currentUserId && (
        <SaveToCollectionDialog
          isOpen={isSaveToCollectionDialogOpen}
          onOpenChange={(open) => {
            setIsSaveToCollectionDialogOpen(open);
            if (!open) onCollectionUpdate();
          }}
          itemId={article.id}
          itemTitle={article.title}
          itemType="article"
        />
      )}
    </>
  );
};
ArticleListItem.displayName = 'ArticleListItem';
