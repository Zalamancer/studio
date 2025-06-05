
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogPrimitiveTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useForm } from 'react-hook-form';
import {
  Loader2, Trash2, MessageSquare, Sparkles, HandHelping, Briefcase, Link as LinkIcon,
  X, DollarSign, CalendarDays, Star, User, FileText, Compass, Home, Network, CornerDownRight, Send, AtSign
} from "lucide-react";
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { formatDistanceToNow } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

import { cn } from "@/lib/utils";
import type { Post } from '@/types/post';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';
import { findOrCreateConversation } from '@/services/messagingService';
import { ConnectionButton } from '@/components/ConnectionButton';
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService';
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { availableTags, detailedSectorsData } from '@/components/layout/MainLayout';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';
import { IS_VALID_FIREBASE_UID_REGEX as IS_UID_REGEX_PAGE } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { PostList } from '@/components/board-page/PostList';


const DynamicPostDetailPanel = dynamic(() =>
  import('@/components/board-page/PostDetailPanel').then(mod => mod.PostDetailPanel),
  { loading: () => <div className="md:col-span-1 flex justify-center items-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>, ssr: false }
);

const BoardPageContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);


  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });


  const deletePostMutation = useMutation({
    mutationFn: deletePostFromFirestore,
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: "Post Deleted", description: "The post has been removed." });
      if (selectedPost?.id === postId) {
        handleCloseDetailView();
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Deletion Failed", description: `Could not delete post: ${error.message}.` });
    },
  });

  const handleDeletePost = useCallback((postId: string | undefined) => {
    if (!postId) {
      toast({ variant: "destructive", title: "Error", description: "Post ID missing for deletion." });
      return;
    }
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in to delete posts." });
      return;
    }
    deletePostMutation.mutate(postId);
  }, [user, deletePostMutation, toast]);


  const handleCloseDetailView = useCallback(() => {
    if (searchParams?.get('postId')) {
      router.replace('/', { scroll: false });
    } else if (selectedPost) {
      setSelectedPost(null);
    }
  }, [searchParams, router, selectedPost, setSelectedPost]);


  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');

    if (postIdFromUrl) {
      if (!selectedPost || selectedPost.id !== postIdFromUrl) {
        if (posts.length > 0) {
          const postToOpen = posts.find(p => p.id === postIdFromUrl);
          if (postToOpen) {
            setSelectedPost(postToOpen);
          } else {
            toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found or is no longer available." });
            router.replace('/', { scroll: false });
            if (selectedPost) setSelectedPost(null);
          }
        }
      }
    } else {
      if (selectedPost) {
        setSelectedPost(null);
      }
    }
  }, [searchParams, posts, selectedPost, router, toast, setSelectedPost]);


  const openPostCallback = useCallback((postToOpen: Post) => {
    const currentPostIdInUrl = searchParams?.get('postId');
    if (currentPostIdInUrl === postToOpen.id) {
      handleCloseDetailView();
    } else {
      router.push(`/?postId=${postToOpen.id}`, { scroll: false });
    }
  }, [searchParams, router, handleCloseDetailView]);


  const renderPostDetailPanel = () => {
    if (!selectedPost) return null;
    return (
      <DynamicPostDetailPanel
        post={selectedPost}
        currentUser={user}
        onClose={handleCloseDetailView}
        onDelete={handleDeletePost}
        deletePostMutationIsPending={deletePostMutation.isPending}
      />
    );
  };

  return (
    <div className="container mx-auto p-4 pt-6 flex flex-col flex-grow">
      <div className={cn(
        "flex-grow",
        isMobile ? "grid grid-cols-1" : "md:flex md:flex-row md:gap-0" 
      )}>
        <div className={cn(
          "flex flex-col overflow-hidden", // Ensure vertical overflow is handled, horizontal should be clipped by parent
          isMobile && selectedPost ? "hidden" : "md:flex-1 md:min-w-0", 
          !isMobile && "md:pr-4" 
        )}>
          <PostList
            posts={posts}
            isLoading={isLoadingPosts}
            onPostSelect={openPostCallback}
            selectedPostId={selectedPost?.id}
            availableTags={availableTags}
            detailedSectorsData={detailedSectorsData}
          />
        </div>

        {isMobile ? (
          <Sheet
            open={!!selectedPost}
            onOpenChange={(isOpen) => {
              if (!isOpen) {
                handleCloseDetailView();
              }
            }}
          >
            <SheetContent
              side="right"
              className="w-full h-full p-0 flex flex-col sm:max-w-full"
              showCloseButton={false} 
            >
              <SheetTitle className="sr-only">
                {selectedPost ? `Details for post: ${selectedPost.question.substring(0, 50)}${selectedPost.question.length > 50 ? '...' : ''}` : "Post Details"}
              </SheetTitle>
              <div className="flex-1 overflow-y-auto">
                 {renderPostDetailPanel()}
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          selectedPost ? (
            <div className="md:w-[450px] md:flex-shrink-0 md:border-l md:border-border md:pl-4 flex flex-col md:overflow-hidden"> {/* Added md:overflow-hidden */}
              {renderPostDetailPanel()}
            </div>
          ) : (
            <div className="hidden md:flex md:w-[450px] md:flex-shrink-0 md:border-l md:border-border md:pl-4 flex-col items-center justify-center p-8 bg-card/50 text-muted-foreground sticky top-20 h-[calc(100vh-6.5rem)] max-h-[calc(100vh-6.5rem)] md:overflow-hidden"> {/* Added md:overflow-hidden */}
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Select a post to view details</p>
              <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default BoardPageContent;
    
    

    
