
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
  AlertDialogTitle,
  AlertDialogTrigger,
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
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"; // Added Sheet imports
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
        setSelectedPost(null);
        router.replace('/', undefined, { shallow: true });
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
  }, [user, deletePostMutation, toast, queryClient, selectedPost, router]);


  // --- Post Selection & URL Handling ---
  const handleCloseDetailView = useCallback(() => {
    setSelectedPost(null);
    if (searchParams?.get('postId')) { // Only replace if URL actually had the postId
      router.replace('/', undefined, { shallow: true });
    }
  }, [searchParams, router, setSelectedPost]);


  const openPostCallback = useCallback((postToOpen: Post) => {
    console.log("[BoardPageContent] openPostCallback, opening post:", postToOpen.id);
    if (selectedPost && selectedPost.id === postToOpen.id) {
      handleCloseDetailView(); // Toggle off if same post is clicked
    } else {
      setSelectedPost(postToOpen);
      if (searchParams?.get('postId') !== postToOpen.id) {
        router.push(`/?postId=${postToOpen.id}`, { scroll: false });
      }
    }
  }, [selectedPost, router, searchParams, handleCloseDetailView]);


  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    console.log(`[BoardPageContent] useEffect for URL postId: postIdFromUrl='${postIdFromUrl}', posts.length=${posts.length}, currentSelectedPostId='${selectedPost?.id}'`);

    if (postIdFromUrl && posts.length > 0) {
      if (!selectedPost || selectedPost.id !== postIdFromUrl) {
        const postToOpen = posts.find(p => p.id === postIdFromUrl);
        if (postToOpen) {
          console.log(`  Found post in URL: ${postIdFromUrl}. Setting as selectedPost.`);
          setSelectedPost(postToOpen);
        } else {
          console.warn(`  Post with ID '${postIdFromUrl}' from URL not found in fetched posts. Closing detail view.`);
          toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found or is no longer available." });
          handleCloseDetailView();
        }
      }
    } else if (!postIdFromUrl && selectedPost) {
      // If URL is cleared but a post is selected (e.g., by sheet closure not updating URL yet, or back navigation),
      // ensure local state also clears. This can happen if Sheet's onOpenChange fires before URL logic.
      // handleCloseDetailView(); // This might be too aggressive, let Sheet's onOpenChange manage it.
    }
  }, [searchParams, posts, router, toast, selectedPost, handleCloseDetailView]);


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
            <SheetContent side="right" className="w-full h-full p-0 flex flex-col sm:max-w-full">
              {renderPostDetailPanel()}
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
