// src/components/collections/SelectedCollectionPosts.tsx
"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsForCollectionPage, removePostFromCollection } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import type { Post } from '@/types/post';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle, FolderOpen, ExternalLink } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';
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
} from "@/components/ui/alert-dialog";
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface SelectedCollectionPostsProps {
  collection: ClientCollection;
  currentUserId: string;
}

interface PostToRemove {
  postId: string;
  postTitle: string;
}

const PostItem: React.FC<{ post: Post, onRemove: (post: Post) => void, removeMutationPending: boolean }> = ({ post, onRemove, removeMutationPending }) => {
  const postDate = post.createdAt ? new Date(post.createdAt as any).toLocaleDateString() : 'Date unavailable';
  const hasImage = post.imageUrls && post.imageUrls.length > 0;

  return (
    // The inner content that is consistent across screen sizes
    <div className="p-4">
      {/* Mobile Layout */}
      <div className="md:hidden">
        <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer">
          <h3 className="text-base font-semibold text-foreground hover:text-primary mb-2 line-clamp-3" title={post.question}>
            {post.question}
          </h3>
        </Link>
        <div className="flex justify-between items-center gap-2 mb-3">
          <div className="flex-grow min-w-0 overflow-x-auto horizontal-scroll-with-fade">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
            </div>
          </div>
          <div className="flex-shrink-0 ml-2">
            <Button
              variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onRemove(post); }}
              disabled={removeMutationPending}
              title="Remove from collection"
            >
              {removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-12 gap-3 items-start">
          {hasImage && (
            <div className="col-span-4 relative aspect-square rounded-md overflow-hidden bg-muted">
              <Image src={post.imageUrls![0]} alt="Post image" fill style={{ objectFit: "cover" }} data-ai-hint="abstract illustration" sizes="(max-width: 768px) 33vw, 100px" />
            </div>
          )}
          <div className={cn(hasImage ? "col-span-8" : "col-span-12")}>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {post.descriptionDetails || 'No additional details provided.'}
            </p>
            <p className="text-xs text-muted-foreground/80 mt-2">
              Added on: {postDate}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:grid md:grid-cols-12 md:gap-4 md:items-start">
        {hasImage && (
          <div className="md:col-span-4 lg:col-span-3 relative aspect-square rounded-md overflow-hidden bg-muted">
            <Image src={post.imageUrls![0]} alt="Post image" fill style={{ objectFit: "cover" }} data-ai-hint="abstract illustration" sizes="(max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 200px" />
          </div>
        )}
        <div className={cn(hasImage ? "md:col-span-8 lg:col-span-9" : "md:col-span-12", "flex flex-col h-full")}>
          <div className="flex justify-between items-start gap-2">
            <Link href={`/?postId=${post.id}`} target="_blank" rel="noopener noreferrer" className="flex-grow min-w-0">
              <h3 className="text-base font-semibold text-foreground hover:text-primary" title={post.question}>
                {post.question}
              </h3>
            </Link>
            <div className="flex-shrink-0">
              <Button
                variant="ghost" size="icon" className="h-7 w-7 p-1 text-destructive/80 hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onRemove(post); }}
                disabled={removeMutationPending}
                title="Remove from collection"
              >
                {removeMutationPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {post.tags?.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-2 flex-grow">
            {post.descriptionDetails || 'No additional details provided.'}
          </p>
          <div className="flex justify-between items-center mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground/80">
              Added on: {postDate}
            </p>
            <Link href={`/?postId=${post.id}`} className="text-xs text-primary hover:underline flex items-center gap-1" target="_blank" rel="noopener noreferrer">
              View Post <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
PostItem.displayName = "PostItem";

export const SelectedCollectionPosts: React.FC<SelectedCollectionPostsProps> = ({ collection, currentUserId }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [postToRemove, setPostToRemove] = useState<PostToRemove | null>(null);

  const { data: posts = [], isLoading, error } = useQuery<Post[]>({
    queryKey: ['collectionPosts', collection.id],
    queryFn: () => getPostsForCollectionPage(collection.id),
    enabled: !!collection.id,
  });

  const removePostMutation = useMutation({
    mutationFn: ({ postIdToRemove }: { postIdToRemove: string }) => {
      return removePostFromCollection(collection.id, postIdToRemove, currentUserId);
    },
    onSuccess: (_, variables) => {
      toast({ title: "Post Removed", description: `Successfully removed from "${collection.name}".` });
      queryClient.invalidateQueries({ queryKey: ['collectionPosts', collection.id] });
      queryClient.invalidateQueries({ queryKey: ['userCollections', currentUserId] });
      setPostToRemove(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error Removing Post", description: error.message });
      setPostToRemove(null);
    },
  });

  const handleConfirmRemovePost = () => {
    if (postToRemove) {
      removePostMutation.mutate({ postIdToRemove: postToRemove.postId });
    }
  };

  return (
    <div>
      <div className="mb-6 px-4 md:px-0">
        <h2 className="text-2xl font-bold truncate text-foreground">{collection.name}</h2>
        <p className="text-sm text-muted-foreground truncate">
          {collection.description || "Posts saved in this collection."}
        </p>
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading posts...</p>
        </div>
      )}
      {error && (
        <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center mx-4 md:mx-0">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <div>Error loading posts: {error.message}</div>
        </div>
      )}
      {!isLoading && !error && posts.length === 0 && (
        <div className="text-center py-10">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">This collection is empty.</p>
          <p className="text-xs text-muted-foreground mt-1">Add posts from the main board.</p>
        </div>
      )}
      {!isLoading && !error && posts.length > 0 && (
        <div className="md:space-y-4">
          {posts.map((post, index) => (
            <React.Fragment key={post.id}>
              <div className="md:rounded-lg md:border md:shadow-sm md:hover:shadow-md md:mb-4 transition-shadow bg-background">
                <PostItem
                  post={post}
                  onRemove={(p) => setPostToRemove({ postId: p.id, postTitle: p.question })}
                  removeMutationPending={removePostMutation.isPending && removePostMutation.variables?.postIdToRemove === post.id}
                />
              </div>
              {index < posts.length - 1 && <Separator className="md:hidden" />}
            </React.Fragment>
          ))}
        </div>
      )}

      <AlertDialog open={!!postToRemove} onOpenChange={(open) => !open && setPostToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove the post &quot;{postToRemove?.postTitle.substring(0, 50)}{postToRemove && postToRemove.postTitle.length > 50 ? '...' : ''}&quot; from this collection?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPostToRemove(null)} disabled={removePostMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemovePost}
              disabled={removePostMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removePostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};