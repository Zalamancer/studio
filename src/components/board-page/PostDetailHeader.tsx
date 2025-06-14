
// src/components/board-page/PostDetailHeader.tsx
"use client";

import React, { useState } from 'react'; // Removed useMemo as isPostSaved is removed
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, HandHelping, DollarSign, CalendarDays, Star, Trash2, Loader2, MessageSquare, AtSign, Briefcase, CheckCircle, Bookmark } from 'lucide-react';
import type { Post } from '@/types/post';
import type { User as FirebaseUser } from 'firebase/auth';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ConnectionButton } from '@/components/ConnectionButton';
import { findOrCreateConversation } from '@/services/messagingService';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ConnectionStatus } from '@/types/connection';
// SaveToCollectionDialog and related imports (useQuery, getUserCollections, ClientCollection) are removed

interface PostDetailHeaderProps {
  post: Post;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
  deletePostMutationIsPending: boolean;
  connectionStatus?: ConnectionStatus | null;
}

export const PostDetailHeader: React.FC<PostDetailHeaderProps> = React.memo(({
  post,
  currentUser,
  onClose,
  onDelete,
  deletePostMutationIsPending,
  connectionStatus
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isStartingChat, setIsStartingChat] = React.useState(false);
  // Removed isSaveToCollectionOpen, userCollections query, and isPostSaved logic

  const postDate = post.createdAt instanceof Timestamp
    ? post.createdAt.toDate().toLocaleDateString()
    : typeof (post.createdAt as any)?.seconds === 'number'
    ? new Timestamp((post.createdAt as any).seconds, (post.createdAt as any).nanoseconds).toDate().toLocaleDateString()
    : 'Date unavailable';


  const postAuthorMentionName = post.userId ? (post.mentionName || generateAnonymousName(post.userId)) : 'Unknown User';
  const postAuthorProfileLink = post.userId ? `/profile/${post.userId}` : '#';
  const isOwnPost = post.userId === currentUser?.uid;

  const handleStartChat = async () => {
    if (!currentUser || !post.userId || isOwnPost || isStartingChat) return;
    setIsStartingChat(true);
    try {
      const conversationId = await findOrCreateConversation(currentUser.uid, post.userId, post.id);
      if (conversationId) {
        router.push(`/messages?conversationId=${conversationId}&postId=${post.id}`);
        onClose();
      } else {
        throw new Error("Failed to initiate conversation.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error Starting Chat", description: error.message || "Could not start chat." });
    } finally {
      setIsStartingChat(false);
    }
  };

  return (
    <>
      <CardHeader className="p-4 border-b flex-shrink-0 bg-card">
        <div className="flex justify-between items-start gap-2">
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
            <CardDescription className="text-sm pt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Posted by: <Link href={postAuthorProfileLink} className="text-primary hover:underline">{postAuthorMentionName}</Link> on {postDate}
              </span>
              {currentUser && !isOwnPost && post.userId && (
                connectionStatus === 'connected' ? (
                  <Button variant="outline" size="xs" onClick={handleStartChat} disabled={isStartingChat} className="h-auto py-0.5 px-1.5 text-xs">
                    {isStartingChat ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <MessageSquare className="mr-1 h-3 w-3"/>}
                    Message
                  </Button>
                ) : (
                  <ConnectionButton
                    targetUserId={post.userId}
                    targetUserName={postAuthorMentionName}
                    size="xs"
                    variant="outline"
                    className="h-auto py-0.5 px-1.5 text-xs"
                  />
                )
              )}
              {post.requestType === 'help_request' && post.deadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Deadline: {post.deadline instanceof Date ? post.deadline.toLocaleDateString() : (post.deadline as unknown as Timestamp)?.toDate?.().toLocaleDateString() || 'N/A'}
                </span>
              )}
              {post.ratingScore != null && post.ratingScore > 0 && (
                <span className="inline-flex items-center text-xs">
                  <Star className={cn("h-3.5 w-3.5 mr-1", post.ratingScore > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                  {post.ratingScore.toFixed(1)}/5
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center flex-shrink-0">
            {isOwnPost && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={deletePostMutationIsPending} className="text-destructive hover:text-destructive h-7 w-7 p-1">
                    {deletePostMutationIsPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="sr-only">Delete Post</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your post and all associated comments and bids.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletePostMutationIsPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(post.id)} disabled={deletePostMutationIsPending} className="bg-destructive hover:bg-destructive/90">
                      {deletePostMutationIsPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Continue'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {/* Removed Save to Collection Button and Dialog Trigger */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label="Close post details"
              className="h-7 w-7 p-1"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {/* Removed SaveToCollectionDialog instance */}
    </>
  );
});

PostDetailHeader.displayName = 'PostDetailHeader';
