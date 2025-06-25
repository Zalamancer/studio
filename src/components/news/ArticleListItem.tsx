
// src/components/news/ArticleListItem.tsx
"use client";

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import { followUser, unfollowUser, isFollowingUser } from '@/services/followService';
import type { ClientNewsArticle } from '@/types/news';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { format } from 'date-fns';
import { MessageSquareText, Bookmark, MoreHorizontal, Edit3, Tag, UserPlus, Ban, Flag, UserMinus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SaveToCollectionDialog } from '@/components/collections/SaveToCollectionDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';

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
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: authorProfile, isLoading: isLoadingAuthor } = useQuery({
    queryKey: ['userProfileBasic', article.userId, 'newsAuthor'],
    queryFn: () => fetchUserProfileBasic(article.userId),
    enabled: !!article.userId,
    staleTime: Infinity,
  });

  const [isSaveToCollectionDialogOpen, setIsSaveToCollectionDialogOpen] = useState(false);
  const isOwnArticle = article.userId === currentUserId;

  const { data: isFollowing, isLoading: isLoadingFollowStatus } = useQuery({
    queryKey: ['isFollowing', currentUserId, article.userId],
    queryFn: () => {
      if (!currentUserId || !article.userId) return false;
      return isFollowingUser(currentUserId, article.userId);
    },
    enabled: !!currentUserId && !isOwnArticle,
    staleTime: 5 * 60 * 1000,
  });

  const authorName = useMemo(() => {
    if (isLoadingAuthor) return 'Loading author...';
    return authorProfile?.displayName || generateAnonymousName(article.userId);
  }, [authorProfile, isLoadingAuthor, article.userId]);

  const followMutation = useMutation({
    mutationFn: async ({ shouldFollow }: { shouldFollow: boolean }) => {
      if (!currentUserId || !article.userId) throw new Error("You must be logged in.");
      if (shouldFollow) {
        await followUser(currentUserId, article.userId);
      } else {
        await unfollowUser(currentUserId, article.userId);
      }
    },
    onSuccess: (_, { shouldFollow }) => {
      toast({
        title: shouldFollow ? "Author Followed" : "Author Unfollowed",
        description: `You are now ${shouldFollow ? 'following' : 'no longer following'} ${authorName}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUserId, article.userId] });
      queryClient.invalidateQueries({ queryKey: ['followedUserIds', currentUserId] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Action Failed",
        description: error.message,
      });
    },
  });

  const handleFollowToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (isLoadingFollowStatus || followMutation.isPending) return;
    followMutation.mutate({ shouldFollow: !isFollowing });
  };

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
                <Link href={`/news/article/${article.id}?mode=edit`} title="Edit Article" onClick={(e) => e.stopPropagation()}>
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 p-1" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {!isOwnArticle && currentUserId && (
                  <>
                    <DropdownMenuItem onClick={handleFollowToggle} disabled={followMutation.isPending}>
                      {followMutation.isPending || isLoadingFollowStatus ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : isFollowing ? (
                        <UserMinus className="mr-2 h-4 w-4" />
                      ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                      )}
                      <span>
                        {followMutation.isPending
                          ? 'Updating...'
                          : isLoadingFollowStatus
                          ? 'Loading...'
                          : isFollowing
                          ? 'Unfollow Author'
                          : 'Follow Author'}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => alert('Block action triggered')}>
                      <Ban className="mr-2 h-4 w-4" />
                      <span>Block Author</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => alert('Report action triggered')}>
                    <Flag className="mr-2 h-4 w-4" />
                    <span>Report Article</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
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
