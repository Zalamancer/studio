
"use client";

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { Loader2, Trash2, Heart, CornerDownRight } from 'lucide-react';
import type { ClientSubComment, ClientComment } from '@/types/comment'; // Added ClientComment for onStartReply
import { deleteSubCommentFromComment, toggleLikeSubComment } from '@/services/commentService';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import { TextWithMentions } from './TextWithMentions';

const IS_UID_REGEX_SUB_COMMENT = /^[a-zA-Z0-9]{20,}$/;

interface SubCommentItemProps {
  subComment: ClientSubComment;
  currentUserId: string | null;
  postId: string;
  commentId: string;
  onDelete: () => void;
  onStartReply: (replyTo: ClientSubComment) => void; 
}

export const SubCommentItem: React.FC<SubCommentItemProps> = React.memo(({
  subComment,
  currentUserId,
  postId,
  commentId,
  onDelete,
  onStartReply,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isOwnSubComment = subComment.userId === currentUserId;
  const [isLiking, setIsLiking] = useState(false);
  const hasLiked = !!(currentUserId && subComment.likedBy?.includes(currentUserId));
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Use mentionName if userName (from old data) is missing, otherwise use generateAnonymousName
  const displayAnonymousName = subComment.mentionName || subComment.userName || generateAnonymousName(subComment.userId);


  const handleDeleteClick = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteSubCommentFromComment(postId, commentId, subComment.id);
      toast({ title: "Reply Deleted" });
      onDelete();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Delete Failed",
        description: `Could not delete reply: ${error.message}`,
      });
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, postId, commentId, subComment.id, toast, onDelete]);

  const handleLikeClick = useCallback(async () => {
    if (!user || isLiking) return;
    setIsLiking(true);
    const previousSubComments = queryClient.getQueryData<ClientSubComment[]>(['subComments', postId, commentId]);

    queryClient.setQueryData<ClientSubComment[]>(['subComments', postId, commentId], (oldSubComments = []) =>
      oldSubComments.map(sc => {
        if (sc.id === subComment.id) {
          const currentlyLiked = sc.likedBy?.includes(user!.uid);
          return {
            ...sc,
            likeCount: currentlyLiked ? (sc.likeCount ?? 1) - 1 : (sc.likeCount ?? 0) + 1,
            likedBy: currentlyLiked
              ? sc.likedBy?.filter(uid => uid !== user!.uid) ?? []
              : [...(sc.likedBy ?? []), user!.uid],
          };
        }
        return sc;
      })
    );

    try {
      await toggleLikeSubComment(postId, commentId, subComment.id, user.uid);
    } catch (err) {
      toast({ variant: "destructive", title: "Like Failed", description: "Could not update like." });
      if (previousSubComments) {
        queryClient.setQueryData(['subComments', postId, commentId], previousSubComments);
      }
    } finally {
      setIsLiking(false);
      queryClient.invalidateQueries({ queryKey: ['subComments', postId, commentId] });
    }
  }, [user, isLiking, queryClient, postId, commentId, subComment.id, toast]);

  return (
    <div className="flex items-start gap-2 group">
      <Link href={`/profile/${subComment.userId}`} passHref>
        <Avatar className="h-6 w-6 mt-1 flex-shrink-0 cursor-pointer">
          <AvatarImage src={subComment.userAvatar} alt={displayAnonymousName} />
          <AvatarFallback className="text-xs bg-secondary text-secondary-foreground">
            {getInitials(displayAnonymousName)}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-grow bg-background p-2 rounded-md min-w-0 border border-border/50">
        <div className="flex justify-between items-center mb-1">
          <Link href={`/profile/${subComment.userId}`} passHref>
            <p className="text-xs font-medium text-foreground truncate hover:underline cursor-pointer">
              {displayAnonymousName}
            </p>
          </Link>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            <p className="text-xs text-muted-foreground">
              {new Date(subComment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            {user && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleLikeClick}
                disabled={isLiking}
                className={cn(
                  "text-xs h-auto p-0.5 flex items-center gap-0.5",
                  hasLiked ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"
                )}
                aria-pressed={hasLiked}
              >
                {isLiking ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Heart className={cn("h-3 w-3", hasLiked ? "fill-current" : "")} />
                )}
                {(subComment.likeCount ?? 0) > 0 ? <span className="text-xs ml-0.5">({subComment.likeCount})</span> : ''}
              </Button>
            )}
            {user && (
                 <Button variant="ghost" size="icon" className="h-5 w-5 p-0.5 text-muted-foreground/70 hover:text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" onClick={() => onStartReply(subComment)} title="Reply to this comment">
                    <CornerDownRight className="h-3 w-3" />
                 </Button>
            )}
            {isOwnSubComment && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground/70 hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    disabled={isDeleting}
                    aria-label="Delete reply"
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Reply?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this reply? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteClick}
                      disabled={isDeleting}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground break-words">
           <TextWithMentions text={subComment.text} mentionedUserIds={subComment.mentionedUserIds || []} />
        </p>
      </div>
    </div>
  );
});
SubCommentItem.displayName = 'SubCommentItem';

