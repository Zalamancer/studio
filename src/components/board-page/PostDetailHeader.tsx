
// src/components/board-page/PostDetailHeader.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, HandHelping, DollarSign, CalendarDays, Star } from 'lucide-react';
import type { Post } from '@/types/post';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface PostDetailHeaderProps {
  post: Post;
  onClose: () => void;
}

export const PostDetailHeader: React.FC<PostDetailHeaderProps> = React.memo(({ post, onClose }) => {
  const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : typeof post.createdAt === 'number'
    ? new Date(post.createdAt).toLocaleDateString()
    : 'Date unavailable';

  const postAuthorMentionName = post.userId ? generateAnonymousName(post.userId) : 'Unknown User';
  const postAuthorProfileLink = post.userId ? `/profile/${post.userId}` : '#';

  return (
    <CardHeader className="p-4 border-b flex-shrink-0">
      <div className="flex justify-between items-start">
        <div className="flex-grow min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {post.requestType === 'help_request' && (
              <Badge variant="outline" className="text-xs cursor-default border-amber-500 text-amber-600 bg-amber-500/10">
                <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
              </Badge>
            )}
            {post.requestType === 'help_request' && post.maxBudget != null && (
              <Badge variant="secondary" className="text-xs cursor-default">
                <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Max Budget: ${post.maxBudget.toLocaleString()}
              </Badge>
            )}
            {post.tags?.map((tag, index) => (
              <Badge key={`${post.id}-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
            ))}
          </div>
          <CardTitle className="text-xl font-semibold line-clamp-3">{post.question}</CardTitle>
          <CardDescription className="text-sm pt-1">
            Posted by: <Link href={postAuthorProfileLink} className="text-primary hover:underline">{postAuthorMentionName}</Link> on {postDate}
            {post.requestType === 'help_request' && post.deadline && (
              <span className="ml-2 inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Deadline: {post.deadline instanceof Date ? post.deadline.toLocaleDateString() : (post.deadline as unknown as Timestamp)?.toDate?.().toLocaleDateString() || 'N/A'}
              </span>
            )}
            {post.ratingScore != null && (
              <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                <Star className={cn("h-3.5 w-3.5 mr-1", post.ratingScore > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                {post.ratingScore.toFixed(1)}/5
              </span>
            )}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close post details" className="flex-shrink-0 ml-2">
          <X className="h-5 w-5" />
        </Button>
      </div>
    </CardHeader>
  );
});

PostDetailHeader.displayName = 'PostDetailHeader';
