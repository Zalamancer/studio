
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
  AlertDialogTitle as AlertDialogPrimitiveTitle, // Alias to avoid conflict if needed
} from "@/components/ui/alert-dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from '@/components/ui/label'; // Added Label import
import { useToast } from "@/hooks/use-toast";
import { useForm } from 'react-hook-form'; // Import useForm from react-hook-form
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"; // Added SheetHeader and SheetTitle
import { useIsMobile } from "@/hooks/use-mobile"; // Added useIsMobile

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
import { availableTags } from '@/components/layout/MainLayout';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';
import { IS_VALID_FIREBASE_UID_REGEX as IS_UID_REGEX_PAGE } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { PostCard } from '@/components/board-page/PostCard';
import { PostList } from '@/components/board-page/PostList';


const DynamicPostDetailPanel = dynamic(() =>
  import('@/components/board-page/PostDetailPanel').then(mod => mod.PostDetailPanel),
  { loading: () => <div className="md:col-span-1 flex justify-center items-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>, ssr: false }
);

// Main Board Page Component
const BoardPageContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);


  // --- Data Fetching ---
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: true,
  });


  // --- Post Deletion Logic ---
  const deletePostMutation = useMutation({
    mutationFn: deletePostFromFirestore,
    onSuccess: (_, postId) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: "Post Deleted", description: "The post has been removed." });
      if (selectedPost?.id === postId) {
        // If the deleted post was selected, close the detail view
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


  // --- Post Selection & URL Handling (URL as Source of Truth) ---

  // Callback to close the detail view (primarily clears the URL)
  const handleCloseDetailView = useCallback(() => {
    if (searchParams?.get('postId')) {
      router.replace('/', undefined, { shallow: true });
    } else if (selectedPost) {
      // If URL is already clear but state is not (e.g., programmatic close not via URL)
      setSelectedPost(null);
    }
  }, [searchParams, router, selectedPost, setSelectedPost]);

  // Effect to sync `selectedPost` state with `postId` from URL
  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');

    if (postIdFromUrl) {
      // URL indicates a post should be open
      if (!selectedPost || selectedPost.id !== postIdFromUrl) {
        // State is not matching the URL, or no post is selected. Try to open/sync.
        if (posts.length > 0) { // Only proceed if posts are loaded
          const postToOpen = posts.find(p => p.id === postIdFromUrl);
          if (postToOpen) {
            setSelectedPost(postToOpen); // Sync state with URL
          } else {
            // Invalid postId in URL
            toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found or is no longer available." });
            router.replace('/', undefined, { shallow: true }); // Clean invalid URL
            if (selectedPost) setSelectedPost(null); // Ensure state is also cleared
          }
        }
        // If posts are not loaded yet, this effect will re-run when posts load.
      }
      // If selectedPost.id === postIdFromUrl, state and URL are in sync, do nothing.
    } else {
      // URL indicates no post should be open
      if (selectedPost) {
        // State says a post is open, but URL is clear. Sync state by closing.
        setSelectedPost(null);
      }
    }
  }, [searchParams, posts, selectedPost, router, toast, setSelectedPost]);


  // Callback when a PostCard is clicked
  const openPostCallback = useCallback((postToOpen: Post) => {
    const currentPostIdInUrl = searchParams?.get('postId');
    if (currentPostIdInUrl === postToOpen.id) {
      // Clicking the same post that's already open (or supposed to be open via URL)
      // This means we should close it.
      handleCloseDetailView();
    } else {
      // Open a new post or switch to a different post by updating the URL.
      // The useEffect will then handle setting selectedPost.
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

  // Main Return
  return (
    <div className="container mx-auto p-4 pt-6 flex flex-col flex-grow">
      <div className={cn(
        "flex-grow",
        isMobile ? "grid grid-cols-1" : "md:grid md:grid-cols-2 md:gap-8"
      )}>
        {/* Left Column: Post List - always visible on desktop, full width on mobile if no post selected */}
        <div className={cn(
          "flex flex-col overflow-hidden",
          isMobile && selectedPost ? "hidden" : "md:col-span-1"
        )}>
          <PostList
            posts={posts}
            isLoading={isLoadingPosts}
            onPostSelect={openPostCallback}
            selectedPostId={selectedPost?.id}
          />
        </div>

        {/* Right Column: Selected Post Details or Placeholder (Desktop) / Full-Screen Sheet (Mobile) */}
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
            <div className="md:col-span-1 flex flex-col"> {/* For Desktop Layout */}
              {renderPostDetailPanel()}
            </div>
          ) : (
            <div className="hidden md:flex md:col-span-1 flex-col items-center justify-center p-8 border rounded-lg bg-card/50 text-muted-foreground sticky top-20 h-[calc(100vh-6.5rem)] max-h-[calc(100vh-6.5rem)]">
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

    