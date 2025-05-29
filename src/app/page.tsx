
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useForm } from 'react-hook-form';
import {
  Loader2, Trash2, MessageSquare, Sparkles, HandHelping, Briefcase, Link as LinkIcon,
  X, DollarSign, CalendarDays, Star, User, FileText, Compass, Home, Network, Info, CornerDownRight, Send, AtSign
} from "lucide-react";
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { formatDistanceToNow } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import dynamic from 'next/dynamic';

// Helper for TextWithMentions - moved here for self-containment within page.tsx scope if needed
// but ideally this could be a shared utility if TextWithMentions becomes shared.
// const IS_UID_REGEX_PAGE = /^[a-zA-Z0-9]{20,28}$/;

// --- PostDetailPanel dynamic import ---
const DynamicPostDetailPanel = dynamic(() =>
  import('@/components/board-page/PostDetailPanel').then(mod => mod.PostDetailPanel),
  {
    loading: () => (
      <div className="md:col-span-1 flex justify-center items-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    ),
    ssr: false
  }
);


// Main Board Page Component
const BoardPageContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
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
  }, [user, deletePostMutation, toast]);

  // --- Post Selection & URL Handling ---
  const openPostCallback = useCallback((postToOpen: Post) => {
    if (selectedPost && selectedPost.id === postToOpen.id) {
      setSelectedPost(null);
      // If closing the currently URL-selected post, clear the URL
      if (searchParams?.get('postId') === postToOpen.id) {
        router.replace('/', undefined, { shallow: true });
      }
    } else {
      setSelectedPost(postToOpen);
      // Update URL if not already matching, but don't push if it's already the one from URL
      if (searchParams?.get('postId') !== postToOpen.id) {
        router.push(`/?postId=${postToOpen.id}`, { scroll: false });
      }
    }
  }, [selectedPost, router, searchParams]);

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    if (postIdFromUrl && posts.length > 0) {
      // Only try to open if no post is selected or if the selected post doesn't match the URL
      // This prevents re-opening if the user manually closed it while the URL param was still there
      if (!selectedPost || selectedPost.id !== postIdFromUrl) {
        const postToOpen = posts.find(p => p.id === postIdFromUrl);
        if (postToOpen) {
          setSelectedPost(postToOpen);
          // Don't clear URL here immediately; let user interaction (closing sheet) handle it
          // or a separate effect that cleans up if selectedPost becomes null and URL still has postId
        } else {
          toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found or is no longer available." });
          router.replace('/', undefined, { shallow: true }); // Clean URL if post not found
        }
      }
    } else if (!postIdFromUrl && selectedPost) {
      // If URL is cleared but a post is still selected (e.g. user navigated back), deselect it
      // This scenario might need refinement based on desired UX for back button
      // setSelectedPost(null);
    }
  }, [searchParams, posts, router, toast, selectedPost]); // Added selectedPost to deps for robustness


  // --- Filtering and Display Logic ---
  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  }, []);

  const filteredPostsByTags = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = selectedTags.length === 0 ? posts : posts.filter(post =>
      Array.isArray(post.tags) && selectedTags.every(tag => post.tags.includes(tag))
    );
    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0);
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0);
      return timeB - timeA;
    });
  }, [posts, selectedTags]);

  const helpRequestPosts = useMemo(() =>
    filteredPostsByTags.filter(post => post.requestType === 'help_request'),
    [filteredPostsByTags]
  );

  const opportunitiesPosts = useMemo(() =>
    filteredPostsByTags.filter(post => post.requestType === 'post' || !post.requestType), // Default to 'post' if type is missing
    [filteredPostsByTags]
  );

  const renderPosts = useCallback((postsToRender: Post[]) => (
    <div className="columns-1 sm:columns-2 gap-4 space-y-4"> {/* Changed to 2 columns for md and up */}
      {postsToRender.length > 0 ? (
        postsToRender.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onOpen={openPostCallback}
            isSelected={selectedPost?.id === post.id}
          />
        ))
      ) : (
        <div className="col-span-full text-center py-10">
          <p className="text-muted-foreground">
            {isLoadingPosts ? "Loading posts..." : (selectedTags.length > 0 ? "No posts found matching the selected tags." : "No posts available in this category yet.")}
          </p>
        </div>
      )}
    </div>
  ), [isLoadingPosts, selectedTags, openPostCallback, selectedPost?.id]);


  // Main Return
  return (
    <div className="container mx-auto p-4 pt-6 flex flex-col flex-grow">
      <div className="md:grid md:grid-cols-2 md:gap-8 flex-grow">
        {/* Left Column: Post List */}
        <div className="md:col-span-1 flex flex-col overflow-hidden">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground mr-2">Filter by Tag:</span>
            {availableTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTagClick(tag)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition-colors duration-150",
                  selectedTags.includes(tag) ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                aria-pressed={selectedTags.includes(tag)}
              >
                {tag}
              </Button>
            ))}
            {selectedTags.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedTags([])} className="text-xs text-primary hover:underline p-1 h-auto ml-2">
                Clear Filters
              </Button>
            )}
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="recommended" className="flex items-center gap-1.5 text-xs sm:text-sm"><Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Recommended</TabsTrigger>
              <TabsTrigger value="help_requests" className="flex items-center gap-1.5 text-xs sm:text-sm"><HandHelping className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Help Requests</TabsTrigger>
              <TabsTrigger value="opportunities" className="flex items-center gap-1.5 text-xs sm:text-sm"><Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Opportunities</TabsTrigger>
            </TabsList>
            <TabsContent value="recommended" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {isLoadingPosts && posts.length === 0 ? <Skeleton className="h-40 w-full"/> : renderPosts(filteredPostsByTags)} </ScrollArea>
            </TabsContent>
            <TabsContent value="help_requests" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {isLoadingPosts && helpRequestPosts.length === 0 ? <Skeleton className="h-40 w-full"/> : renderPosts(helpRequestPosts)} </ScrollArea>
            </TabsContent>
            <TabsContent value="opportunities" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {isLoadingPosts && opportunitiesPosts.length === 0 ? <Skeleton className="h-40 w-full"/> : renderPosts(opportunitiesPosts)} </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Selected Post Details or Placeholder */}
        {selectedPost ? (
          <div className="md:col-span-1 flex flex-col mt-8 md:mt-0"> {/* Add margin top for mobile, none for desktop */}
            <DynamicPostDetailPanel
              post={selectedPost}
              currentUser={user}
              onClose={() => {
                setSelectedPost(null);
                // Clear URL only if it matches the selected post, to avoid clearing other potential params
                if (searchParams?.get('postId') === selectedPost.id) {
                  router.replace('/', undefined, { shallow: true });
                }
              }}
              onDelete={handleDeletePost}
              deletePostMutationIsPending={deletePostMutation.isPending}
            />
          </div>
        ) : (
          <div className="hidden md:flex md:col-span-1 flex-col items-center justify-center p-8 border rounded-lg bg-card/50 text-muted-foreground sticky top-20 h-[calc(100vh-6.5rem)] max-h-[calc(100vh-6.5rem)]">
            <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Select a post to view details</p>
            <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoardPageContent;

    