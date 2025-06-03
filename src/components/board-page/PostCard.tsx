
// src/components/board-page/PostCard.tsx
"use client";

import React from 'react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
import { Timestamp } from 'firebase/firestore';
import { cn } from "@/lib/utils";
import type { Post } from '@/types/post';
import { TextWithMentions } from './TextWithMentions';
import { HandHelping, DollarSign, Star, MessageSquare } from 'lucide-react';

interface PostCardProps {
  post: Post;
  onOpen: (post: Post) => void;
  isSelected?: boolean;
  isPriority?: boolean; // New prop
}

export const PostCard: React.FC<PostCardProps> = React.memo(({ post, onOpen, isSelected, isPriority = false }) => {
  const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : typeof (post.createdAt as any)?.seconds === 'number'
    ? new Timestamp((post.createdAt as any).seconds, (post.createdAt as any).nanoseconds).toDate().toLocaleDateString()
    : typeof post.createdAt === 'number'
    ? new Date(post.createdAt).toLocaleDateString()
    : 'Date unavailable';

  const descriptionToDisplay = post.descriptionDetails || ""; // Always use descriptionDetails

  return (
    <Card
      className={cn(
        "mb-4 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 cursor-pointer break-inside-avoid bg-card",
        post.requestType === 'help_request' && "border-2 border-amber-500/70 hover:border-amber-500",
        isSelected && "ring-2 ring-primary ring-offset-2 shadow-primary/20"
      )}
      onClick={() => onOpen(post)}
      aria-label={`View details for post: ${post.question}`}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(post)}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {post.requestType === 'help_request' && (
            <Badge variant="outline" className="text-xs cursor-default border-amber-500 text-amber-600 bg-amber-500/10">
              <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
            </Badge>
          )}
          {post.requestType === 'help_request' && post.maxBudget != null && ( // Check for not null or undefined
            <Badge variant="secondary" className="text-xs cursor-default">
              <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Max Budget: ${post.maxBudget.toLocaleString()}
            </Badge>
          )}
          {post.tags?.map((tag, index) => (
            <Badge key={`${post.id}-tag-${index}`} variant="outline" className="text-xs cursor-default">
              {tag}
            </Badge>
          ))}
        </div>
        <h3 className="text-base font-semibold leading-snug text-card-foreground line-clamp-3">{post.question}</h3>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {post.imageUrls && post.imageUrls.length > 0 && (
          <div className="mb-3 rounded-md overflow-hidden aspect-[3/4] relative">
            <Image
              src={post.imageUrls[0]}
              alt={post.question}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
              data-ai-hint={post.tags && post.tags.length > 0 ? post.tags.slice(0, 2).join(' ') : 'abstract'}
              priority={isPriority} // Apply priority prop
              loading={isPriority ? undefined : "lazy"} // Conditionally set loading
            />
          </div>
        )}
        {descriptionToDisplay && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            <TextWithMentions text={descriptionToDisplay} mentionedUserIds={post.mentionedUserIds || []} />
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground/80">
          <span>Posted: {postDate}</span>
          <div className="flex items-center gap-2">
            {post.ratingScore != null && ( // Check for not null or undefined
              <div className="flex items-center">
                <Star className={cn("h-3.5 w-3.5 mr-0.5", post.ratingScore > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                <span>{post.ratingScore.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center">
                <MessageSquare className="h-3.5 w-3.5 mr-0.5" />
                <span>{post.commentCount || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
PostCard.displayName = 'PostCard';
