
"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from 'next/image';
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import {
  Loader2, Trash2, HandHelping, FileText, Network, Home, Eye, Building, Link2,
  MessageCircle, Send, CornerDownLeft, X, DollarSign, CalendarDays,
  Heart, Sparkles, AtSign, Briefcase, MessageSquareDashed, UserCheck, UserPlus, Hourglass, Ban, Star, Info, CornerDownRight
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { formatDistanceToNow } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TextWithMentions } from '@/components/board-page/TextWithMentions';
import { PostCard } from '@/components/board-page/PostCard';
import { SubCommentItem } from '@/components/board-page/SubCommentItem';
import { CommentItem } from '@/components/board-page/CommentItem';


// This regex needs to be available to TextWithMentions if used directly in this file
// Or TextWithMentions should define its own or import from a common constants file.
const IS_UID_REGEX_PAGE = /^[a-zA-Z0-9]{20,}$/;


// This helper is used by handleCommentSubmit and handleReplySubmit (within CommentItem)
// It needs the list of profiles available in the current context to resolve mentions to UIDs.
const extractMentionedUids = (text: string, profilesToSearch: UserProfileBasic[]): string[] => {
  console.log(`%c[page.tsx] extractMentionedUids - Input Text: "${text?.substring(0, 100)}..."`, "color: orange;");
  console.log(`%c[page.tsx] extractMentionedUids - Profiles to Search In (count: ${profilesToSearch.length}):`, "color: orange;", profilesToSearch.slice(0, 5).map(p => ({ uid: p.userId, mentionName: p.mentionName, actualDisplayName: p.actualDisplayName, companyName: p.companyName })));

  // Regex for ColorAnimalNumber format OR a typical Firebase UID
  const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,})/g;
  const textualMentions = new Set<string>();
  for (const match of text.matchAll(mentionRegexGlobal)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }

  if (textualMentions.size === 0) {
    console.log(`%c[page.tsx] extractMentionedUids - No textual mentions found in text.`, "color: orange;");
    return [];
  }
  console.log(`%c[page.tsx] extractMentionedUids - Input Textual Mentions Extracted:`, "color: orange;", Array.from(textualMentions));

  const resolvedUids = new Set<string>();

  for (const textualMention of textualMentions) {
    let foundProfile: UserProfileBasic | undefined = undefined;

    // Strategy 1: If the textualMention itself is a UID, find if that user is in profilesToSearch
    if (IS_UID_REGEX_PAGE.test(textualMention)) {
      foundProfile = profilesToSearch.find(p => p.userId === textualMention);
      if (foundProfile) {
        console.log(`%c[page.tsx] extractMentionedUids - Resolved textualMention "${textualMention}" as DIRECT UID from profilesToSearch to UID: ${foundProfile.userId}`, "color: green;");
        resolvedUids.add(foundProfile.userId);
        continue;
      }
    }

    // Strategy 2: Match textualMention (as "ColorAnimalNumber") against the mentionName of profiles in profilesToSearch
    const textualMentionLower = textualMention.toLowerCase();
    foundProfile = profilesToSearch.find(p => {
      const profileMentionName = p.mentionName; // This is the ColorAnimalNumber
      return profileMentionName?.toLowerCase() === textualMentionLower;
    });

    if (foundProfile && foundProfile.userId) {
      console.log(`%c[page.tsx] extractMentionedUids - Resolved textualMention "${textualMention}" by matching mentionName with profile UID: ${foundProfile.userId}`, "color: green;");
      resolvedUids.add(foundProfile.userId);
    } else {
      console.log(`%c[page.tsx] extractMentionedUids - Could NOT resolve textual mention: "${textualMention}" to a UID from the provided profiles.`, "color: red;");
    }
  }
  console.log(`%c[page.tsx] extractMentionedUids - Final Resolved UIDs:`, "color: green; font-weight: bold;", Array.from(resolvedUids));
  return Array.from(resolvedUids);
};


// Zod schema for the inline bid form (simplified for inline use)
const bidFormSchema = z.object({
  bidAmount: z.coerce.number().min(0, "Bid amount must be $0 or more.").optional(),
  // bidMessage is not needed here as we're simplifying the inline bid
});
type BidFormValues = z.infer<typeof bidFormSchema>;


const BoardPageContent = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // For main comment input
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  // For inline bidding in SheetFooter
  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);


  // Data Fetching Hooks
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });

  const {
    data: comments = [],
    isLoading: isLoadingComments,
    error: commentsError,
    refetch: refetchComments,
  } = useQuery<ClientComment[]>({
    queryKey: ['comments', selectedPost?.id],
    queryFn: () => selectedPost?.id && user ? getCommentsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost?.id && !!user,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });

  const { data: bids = [], isLoading: isLoadingBids, error: bidsError } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', selectedPost?.id],
    queryFn: () => selectedPost?.id ? getBidsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost && selectedPost.requestType === 'help_request', // No user check here, bids can be public
  });


  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsers', debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!selectedPost && !!user && showNewCommentSuggestions,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const newCommentMentionProfilesMap = useMemo(() => {
    const profilesMap = new Map<string, UserProfileBasic>();
    generalSuggestibleUsers.forEach(profile => {
      if (profile.userId) profilesMap.set(profile.userId, profile);
    });
    return profilesMap;
  }, [generalSuggestibleUsers]);

  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-nc', mentionName: 'loading-nc', displayName: 'Loading users...' } as UserProfileBasic];
    const profilesSource = generalSuggestibleUsers.filter(p => p.userId !== user?.uid && !!p.mentionName);
    let results: UserProfileBasic[];
    if (newCommentMentionQuery.trim() === '') {
      results = profilesSource;
    } else {
      const queryLower = newCommentMentionQuery.toLowerCase();
      results = profilesSource.filter(
        p => p.mentionName.toLowerCase().includes(queryLower) ||
             (p.actualDisplayName && p.actualDisplayName.toLowerCase().includes(queryLower))
      );
    }
    results = results.slice(0, 10);
    if (results.length === 0 && newCommentMentionQuery.trim() !== '') {
      return [{ userId: 'no-match-nc', mentionName: 'no-match-nc', displayName: `No users matching "@${newCommentMentionQuery}"` } as UserProfileBasic];
    }
    if (results.length === 0) {
      return [{ userId: 'no-users-nc', mentionName: 'no-users-nc', displayName: 'No users to suggest.' } as UserProfileBasic];
    }
    return results;
  }, [newCommentMentionQuery, generalSuggestibleUsers, isLoadingGeneralSuggestions, showNewCommentSuggestions, user?.uid]);

  const allAvailableProfilesForNewComment = useMemo(() => {
    const profiles: UserProfileBasic[] = [];
    if (user) {
      profiles.push({
        userId: user.uid,
        mentionName: generateAnonymousName(user.uid),
        displayName: user.displayName || generateAnonymousName(user.uid),
        avatarUrl: user.photoURL || undefined,
      });
    }
    if (selectedPost?.userId && !profiles.find(p => p.userId === selectedPost.userId)) {
      const postAuthorProfile = generalSuggestibleUsers.find(p => p.userId === selectedPost.userId) ||
        { userId: selectedPost.userId, mentionName: generateAnonymousName(selectedPost.userId), displayName: generateAnonymousName(selectedPost.userId) };
      profiles.push(postAuthorProfile);
    }
    comments.forEach(c => {
      if (c.userId && !profiles.find(p => p.userId === c.userId)) {
        profiles.push({
          userId: c.userId,
          mentionName: c.userName || generateAnonymousName(c.userId),
          displayName: c.userName || generateAnonymousName(c.userId),
          avatarUrl: c.userAvatar,
        });
      }
    });
    generalSuggestibleUsers.forEach(sug => {
      if (!profiles.find(p => p.userId === sug.userId)) {
        profiles.push(sug);
      }
    });
    return profiles;
  }, [user, selectedPost, comments, generalSuggestibleUsers]);


  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    const finalMentionedUids = extractMentionedUids(newComment.trim(), allAvailableProfilesForNewComment);
    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: finalMentionedUids,
    };
    try {
      await addCommentToPost(selectedPost.id, commentData);
      setNewComment('');
      setNewCommentMentionQuery('');
      setShowNewCommentSuggestions(false);
      toast({ title: "Comment Added" });
      queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Comment Failed", description: `Could not add comment: ${error.message}.` });
    } finally {
      setIsSubmittingComment(false);
    }
  }, [user, selectedPost, newComment, isSubmittingComment, allAvailableProfilesForNewComment, queryClient, toast]);

  const handleCommentDeleted = useCallback(() => {
    if (selectedPost) queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
  }, [selectedPost, queryClient]);

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  }, []);

  const openPostCallback = useCallback((postToOpen: Post) => {
    if (selectedPost && selectedPost.id === postToOpen.id) {
      setSelectedPost(null);
    } else {
      setSelectedPost(postToOpen);
    }
    setInlineBidAmount(""); 
    setInlineBidError(null);
  }, [selectedPost]);

  const evaluateNewCommentMentionState = useCallback((text: string, cursorPosition: number) => {
    let activeQuery = null;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1 && (lastAtIndex === 0 || /\s|^$/.test(textBeforeCursor.charAt(lastAtIndex - 1)))) {
      const potentialQuery = textBeforeCursor.substring(lastAtIndex + 1);
      if (!/\s/.test(potentialQuery) && !/\n/.test(potentialQuery)) {
        activeQuery = potentialQuery;
      }
    }
    setNewCommentMentionQuery(activeQuery !== null ? activeQuery : '');
    setShowNewCommentSuggestions(activeQuery !== null);
  }, [setNewCommentMentionQuery, setShowNewCommentSuggestions]);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [setNewComment, evaluateNewCommentMentionState]);

  const handleSelectNewCommentSuggestion = useCallback((profile: UserProfileBasic) => {
    if (!newCommentInputRef.current || !profile.mentionName) return;
    const currentValue = newComment;
    const cursorPosition = newCommentInputRef.current.selectionStart || 0;
    const textBeforeCursor = currentValue.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    if (lastAtIndex > -1) {
      const textBeforeMention = currentValue.substring(0, lastAtIndex);
      const textAfterCursor = currentValue.substring(cursorPosition);
      const mentionToInsert = profile.mentionName;
      setNewComment(`${textBeforeMention}@${mentionToInsert} ${textAfterCursor}`);
      const newCursorPosition = textBeforeMention.length + `@${mentionToInsert} `.length;
      setTimeout(() => {
        newCommentInputRef.current?.focus();
        newCommentInputRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
      }, 0);
    }
    setShowNewCommentSuggestions(false);
    setNewCommentMentionQuery('');
  }, [newComment, setNewComment, setNewCommentMentionQuery, setShowNewCommentSuggestions]);

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      if (selectedPost) {
        queryClient.invalidateQueries({ queryKey: ['bids', selectedPost.id] });
      }
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });

  const handleInlineBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInlineBidAmount(value);
    if (value === "") {
      setInlineBidError(null);
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      setInlineBidError("Please enter a valid number.");
    } else if (numValue < 0) {
      setInlineBidError("Bid cannot be negative.");
    } else if (selectedPost?.maxBudget != null && numValue > selectedPost.maxBudget) {
      setInlineBidError(`Bid cannot exceed max budget of $${selectedPost.maxBudget.toLocaleString()}.`);
    } else {
      setInlineBidError(null);
    }
  }, [selectedPost?.maxBudget]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !selectedPost || selectedPost.userId === user.uid || selectedPost.requestType !== 'help_request' || selectedPost.maxBudget == null) {
      toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action." });
      return;
    }
    setIsProcessingOffer(true);
    const parsedBidAmount = parseFloat(inlineBidAmount);
    if (inlineBidAmount === "" || isNaN(parsedBidAmount) || parsedBidAmount < 0 || (selectedPost.maxBudget !== null && parsedBidAmount > selectedPost.maxBudget)) {
      const currentError = inlineBidAmount === "" ? "Bid amount is required." : `Invalid bid. Must be $0 - $${selectedPost.maxBudget.toLocaleString()}.`;
      setInlineBidError(currentError);
      toast({ variant: "destructive", title: "Invalid Bid", description: currentError });
      setIsProcessingOffer(false);
      return;
    }
    setInlineBidError(null);
    const bidDetails: NewBidData = {
      postId: selectedPost.id,
      bidderId: user.uid,
      bidAmount: parsedBidAmount,
      bidMessage: `Bid placed via 'Offer Help': $${parsedBidAmount.toLocaleString()}`,
    };
    try {
      await addBidMutation.mutateAsync(bidDetails);
      const conversationId = await findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id);
      if (conversationId) {
        toast({ title: "Bid Placed & Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}&initialBidAmount=${parsedBidAmount}`);
        setInlineBidAmount("");
        setSelectedPost(null);
      } else {
        throw new Error("Failed to initiate conversation after bid.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not place bid or start conversation." });
    } finally {
      setIsProcessingOffer(false);
    }
  }, [user, selectedPost, inlineBidAmount, addBidMutation, router, toast, queryClient]);

  const deletePostMutation = useMutation({
    mutationFn: deletePostFromFirestore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast({ title: "Post Deleted", description: "The post has been removed." });
      setSelectedPost(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Deletion Failed", description: `Could not delete post: ${error.message}.` });
    },
  });

  const handleDeletePost = useCallback((postId: string | undefined) => {
    if (!postId) { toast({ variant: "destructive", title: "Error", description: "Post ID missing." }); return; }
    if (!user) { toast({ variant: "destructive", title: "Authentication Required", description: "Must be logged in." }); return; }
    deletePostMutation.mutate(postId);
  }, [user, deletePostMutation, toast]);

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    console.log("[BoardPageContent] useEffect for URL postId. postIdFromUrl:", postIdFromUrl, "Posts loaded:", posts.length > 0, "Current selectedPostId:", selectedPost?.id);
    if (postIdFromUrl && posts.length > 0) {
      if (selectedPost?.id !== postIdFromUrl) { // Only set if not already selected or different
        const postToOpen = posts.find(p => p.id === postIdFromUrl);
        if (postToOpen) {
          console.log("[BoardPageContent] Opening post from URL:", postToOpen.id);
          setSelectedPost(postToOpen);
          // Do NOT clear URL here if we want to support direct linking to an open post
        } else {
          toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found." });
          router.replace('/', undefined, { shallow: true }); // Clear invalid postId from URL
        }
      }
    }
  }, [searchParams, posts, router, toast, selectedPost?.id]);


  useEffect(() => {
    if (selectedPost && !authLoading && !user) {
      setSelectedPost(null);
      setInlineBidAmount("");
      setInlineBidError(null);
    }
  }, [user, authLoading, selectedPost]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) {
        if (showNewCommentSuggestions) setShowNewCommentSuggestions(false);
      }
    };
    if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewCommentSuggestions]);

  const filteredPostsByTags = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = selectedTags.length === 0 ? posts : posts.filter(post => Array.isArray(post.tags) && selectedTags.every(tag => post.tags.includes(tag)));
    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : (typeof a.createdAt === 'object' && a.createdAt && 'seconds' in a.createdAt ? new Timestamp((a.createdAt as any).seconds, (a.createdAt as any).nanoseconds).toMillis() : (typeof a.createdAt === 'number' ? a.createdAt : 0));
      const timeB = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : (typeof b.createdAt === 'object' && b.createdAt && 'seconds' in b.createdAt ? new Timestamp((b.createdAt as any).seconds, (b.createdAt as any).nanoseconds).toMillis() : (typeof b.createdAt === 'number' ? b.createdAt : 0));
      return timeB - timeA;
    });
  }, [posts, selectedTags]);

  const helpRequestPosts = useMemo(() => filteredPostsByTags.filter(post => post.requestType === 'help_request'), [filteredPostsByTags]);
  const opportunitiesPosts = useMemo(() => filteredPostsByTags.filter(post => post.requestType === 'post' || !post.requestType), [filteredPostsByTags]);

  const minimumBidAmount = useMemo(() => {
    if (!bids || bids.length === 0 || !selectedPost || selectedPost.requestType !== 'help_request') return null;
    return Math.min(...bids.map(bid => bid.bidAmount));
  }, [bids, selectedPost]);

  const renderPosts = useCallback((postsToRender: Post[]) => (
    <div className="columns-1 md:columns-2 gap-4 space-y-4">
      {postsToRender.length > 0 ? (
        postsToRender.map((post) => (
          <PostCard key={post.id} post={post} onOpen={openPostCallback} isSelected={selectedPost?.id === post.id} />
        ))
      ) : (
        <div className="col-span-full text-center py-10">
          <p className="text-muted-foreground">
            {isLoadingPosts ? "Loading..." : (selectedTags.length > 0 ? "No posts found matching the selected tags." : "No posts available in this category yet.")}
          </p>
        </div>
      )}
    </div>
  ), [isLoadingPosts, selectedTags, openPostCallback, selectedPost?.id]);

  if (authLoading && !selectedPost) {
    return (
      <div className="container mx-auto p-4 pt-6 flex flex-col flex-grow">
        <Skeleton className="h-8 w-1/2 mb-6" />
        <div className="md:grid md:grid-cols-2 md:gap-8 flex-grow">
          <div className="md:col-span-1 flex flex-col overflow-hidden space-y-4">
            <Skeleton className="h-10 w-full mb-4" />
            <div className="columns-1 md:columns-2 gap-4 space-y-4">
              <Skeleton className="h-64 w-full rounded-lg" />
              <Skeleton className="h-72 w-full rounded-lg" />
              <Skeleton className="h-56 w-full rounded-lg" />
              <Skeleton className="h-80 w-full rounded-lg" />
            </div>
          </div>
          <div className="md:col-span-1 hidden md:flex md:flex-col items-center justify-center border rounded-lg bg-card/50 text-muted-foreground p-8 sticky top-20 max-h-[calc(100vh-6rem)]">
            <MessageSquareDashed className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Select a post to view details</p>
          </div>
        </div>
      </div>
    );
  }

  // Main Return
  return (
    <div className="container mx-auto p-4 pt-6 flex flex-col flex-grow">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground mr-2">Filter by Tag:</span>
        {availableTags.map((tag) => (
          <Button
            key={tag}
            variant={selectedTags.includes(tag) ? "default" : "outline"}
            size="sm"
            onClick={() => handleTagClick(tag)}
            className={cn("rounded-full px-3 py-1 text-xs transition-colors duration-150", selectedTags.includes(tag) ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground")}
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

      <div className="md:grid md:grid-cols-2 md:gap-8 flex-grow">
        <div className="md:col-span-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-grow">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="recommended" className="flex items-center gap-1.5 text-xs sm:text-sm"><Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Recommended</TabsTrigger>
              <TabsTrigger value="help_requests" className="flex items-center gap-1.5 text-xs sm:text-sm"><HandHelping className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Help Requests</TabsTrigger>
              <TabsTrigger value="opportunities" className="flex items-center gap-1.5 text-xs sm:text-sm"><Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Opportunities</TabsTrigger>
            </TabsList>
            <TabsContent value="recommended" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {renderPosts(filteredPostsByTags)} </ScrollArea>
            </TabsContent>
            <TabsContent value="help_requests" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {renderPosts(helpRequestPosts)} </ScrollArea>
            </TabsContent>
            <TabsContent value="opportunities" className="mt-0 flex-grow overflow-hidden">
              <ScrollArea className="h-full pr-2"> {renderPosts(opportunitiesPosts)} </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <div className="md:col-span-1 flex flex-col">
          {selectedPost ? (
            <Card className="shadow-xl flex flex-col flex-1 overflow-hidden sticky top-20 max-h-[calc(100vh-6rem)] bg-card">
              <CardHeader className="p-4 border-b flex-shrink-0">
                <div className="flex justify-between items-start">
                  <div className="flex-grow min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {selectedPost.requestType === 'help_request' && (
                        <Badge variant="outline" className="text-xs cursor-default border-amber-500 text-amber-600 bg-amber-500/10">
                          <HandHelping className="mr-1.5 h-3 w-3" /> Help Request
                        </Badge>
                      )}
                      {selectedPost.requestType === 'help_request' && selectedPost.maxBudget != null && (
                        <Badge variant="secondary" className="text-xs cursor-default">
                          <DollarSign className="mr-1 h-3 w-3 text-green-600" /> Max Budget: ${selectedPost.maxBudget.toLocaleString()}
                        </Badge>
                      )}
                      {selectedPost.tags?.map((tag, index) => (
                        <Badge key={`${selectedPost.id}-detail-tag-${index}`} variant="secondary" className="text-xs cursor-default">{tag}</Badge>
                      ))}
                    </div>
                    <CardTitle className="text-xl font-semibold line-clamp-3">{selectedPost.question}</CardTitle>
                    <CardDescription className="text-sm pt-1">
                      Posted on: {selectedPost.createdAt instanceof Timestamp ? selectedPost.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                      {selectedPost.requestType === 'help_request' && selectedPost.deadline && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> Deadline: {selectedPost.deadline instanceof Date ? selectedPost.deadline.toLocaleDateString() : 'N/A'}
                        </span>
                      )}
                      {selectedPost.ratingScore != null && (
                        <span className="ml-2 inline-flex items-center text-xs text-muted-foreground">
                          <Star className={cn("h-3.5 w-3.5 mr-1", selectedPost.ratingScore > 0 ? "fill-yellow-400 text-yellow-500" : "text-muted-foreground")} />
                          {selectedPost.ratingScore.toFixed(1)}/5
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openPostCallback(selectedPost)} aria-label="Close post details" className="flex-shrink-0 ml-2">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </CardHeader>

              <ScrollArea className="flex-grow">
                <CardContent className="p-4 space-y-4">
                  {selectedPost.imageUrls && selectedPost.imageUrls.length > 0 && (
                    <div className="mb-4 rounded-lg overflow-hidden shadow-md">
                      <Carousel className="w-full">
                        <CarouselContent>
                          {selectedPost.imageUrls.map((url, index) => (
                            <CarouselItem key={index}>
                              <div className="aspect-video relative">
                                <Image
                                  src={url}
                                  alt={`Post image ${index + 1}`}
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                  style={{ objectFit: 'contain' }}
                                  className="rounded-md"
                                  data-ai-hint={selectedPost.tags && selectedPost.tags.length > 0 ? selectedPost.tags.slice(0,2).join(' ') : 'abstract'}
                                />
                              </div>
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                        {selectedPost.imageUrls.length > 1 && (
                          <>
                            <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" />
                            <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" />
                          </>
                        )}
                      </Carousel>
                    </div>
                  )}

                  {selectedPost.requestType === 'help_request' ? (
                    <div className="mt-4">
                      <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 mb-0.5 p-0 h-auto bg-transparent border-b-2 border-border rounded-none">
                          <TabsTrigger value="details" className={cn("text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0")}>Problem Details</TabsTrigger>
                          <TabsTrigger value="tried" disabled={!selectedPost.descriptionTried} className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">What I've Tried</TabsTrigger>
                          <TabsTrigger value="outcome" disabled={!selectedPost.descriptionOutcome} className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">Expected Outcome</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                          {selectedPost.descriptionDetails ? (
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              <TextWithMentions text={selectedPost.descriptionDetails} mentionedUserIds={selectedPost.mentionedUserIds || []} IS_UID_REGEX={IS_UID_REGEX_PAGE} />
                            </p>
                          ) : (
                            <p className="text-muted-foreground italic">No details provided.</p>
                          )}
                        </TabsContent>
                        {selectedPost.descriptionTried && (
                          <TabsContent value="tried" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                            <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionTried}</p>
                          </TabsContent>
                        )}
                        {selectedPost.descriptionOutcome && (
                          <TabsContent value="outcome" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                            <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionOutcome}</p>
                          </TabsContent>
                        )}
                      </Tabs>
                    </div>
                  ) : (
                    selectedPost.description && (
                      <div>
                        <strong className="text-foreground">Details:</strong>
                        <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                          <TextWithMentions text={selectedPost.description} mentionedUserIds={selectedPost.mentionedUserIds || []} IS_UID_REGEX={IS_UID_REGEX_PAGE} />
                        </p>
                      </div>
                    )
                  )}

                  <div className="grid grid-cols-1 gap-y-2 mt-4 border-t pt-4">
                    <div> <strong className="block text-foreground">Sector:</strong> <span className="text-muted-foreground">{selectedPost.sector || 'N/A'}</span> </div>
                    {selectedPost.subSector && (<div> <strong className="block text-foreground">Sub-Sector:</strong> <span className="text-muted-foreground">{selectedPost.subSector}</span> </div>)}
                    {selectedPost.industry && (<div> <strong className="block text-foreground">Industry:</strong> <span className="text-muted-foreground">{selectedPost.industry}</span> </div>)}
                    {selectedPost.naicsCode && (<div> <strong className="block text-foreground">NAICS Code:</strong> <Badge variant="outline" className="text-xs ml-1">{selectedPost.naicsCode}</Badge> </div>)}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
                    <div> <strong className="block text-foreground">Business Type:</strong> <span className="text-muted-foreground">{selectedPost.businessType || 'N/A'}</span> </div>
                    <div className="flex items-center gap-2"> <strong className="text-foreground">Safety Indicator:</strong> <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", selectedPost.safetyIndicator === 'High' ? "bg-primary text-primary-foreground" : selectedPost.safetyIndicator === 'Medium' ? "bg-secondary text-secondary-foreground" : "bg-destructive text-destructive-foreground")}>{selectedPost.safetyIndicator || 'N/A'}</span> </div>
                    <div> <strong className="block text-foreground">Poster Profile:</strong> <Link href={`/profile/${selectedPost.userId}`} className="text-sm text-primary hover:underline inline-flex items-center gap-1"> <Building className="h-4 w-4" /> View Profile </Link> </div>
                    <div> <strong className="block text-foreground">Rating Score:</strong> <span className="text-muted-foreground">{selectedPost.ratingScore ? `${selectedPost.ratingScore.toFixed(1)} / 5` : 'N/A'}</span> </div>
                  </div>

                  <div className="mt-6 border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-md font-semibold flex items-center gap-2"> <DollarSign className="h-5 w-5 text-green-600" /> Bids ({isLoadingBids ? '...' : bids.length}) </h4>
                      {selectedPost.requestType === 'help_request' && (
                        <p className="text-xs text-muted-foreground">
                          Minimum bid: <span className="font-semibold text-primary">{isLoadingBids ? '...' : (minimumBidAmount !== null ? `$${minimumBidAmount.toLocaleString()}` : 'N/A')}</span>
                        </p>
                      )}
                    </div>
                    {isLoadingBids && user ? (
                      <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...</div>
                    ) : bidsError && user ? (
                      <p className="text-sm text-destructive">Error loading bids: {bidsError.message}</p>
                    ) : user && bids.length === 0 && selectedPost.requestType === 'help_request' ? (
                      <p className="text-sm text-muted-foreground">No bids placed yet.</p>
                    ) : !user && selectedPost.requestType === 'help_request' ? (
                      <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view or place bids. </p>
                    ) : user && bids.length > 0 && selectedPost.requestType === 'help_request' ? (
                      <ScrollArea className="max-h-60 pr-3">
                        <div className="space-y-3">
                          {bids.map(bid => (
                            <Card key={bid.id} className="p-3 bg-muted/40 shadow-sm">
                              <div className="flex items-start gap-2.5">
                                <Link href={`/profile/${bid.bidderId}`} passHref>
                                  <Avatar className="h-8 w-8 cursor-pointer">
                                    <AvatarImage src={bid.bidderAvatar} alt={bid.bidderName} />
                                    <AvatarFallback className="text-xs">{getSharedInitials(bid.bidderName)}</AvatarFallback>
                                  </Avatar>
                                </Link>
                                <div className="flex-grow min-w-0">
                                  <div className="flex justify-between items-center">
                                    <Link href={`/profile/${bid.bidderId}`} passHref>
                                      <p className="text-xs font-medium text-foreground truncate hover:underline">{bid.bidderName}</p>
                                    </Link>
                                    <p className="text-xs text-muted-foreground flex-shrink-0 ml-2">{formatDistanceToNow(new Date(bid.timestamp), { addSuffix: true })}</p>
                                  </div>
                                  <p className="text-sm font-semibold text-primary">${bid.bidAmount.toLocaleString()}</p>
                                  {bid.bidMessage && <p className="text-xs text-muted-foreground mt-0.5 break-words">{bid.bidMessage}</p>}
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : null}
                  </div>

                  <div className="mt-6 border-t pt-4">
                    <h4 className="text-lg font-semibold mb-4 flex items-center gap-2"> <MessageCircle className="h-5 w-5 text-primary" /> Comments ({user && !isLoadingComments ? comments.length : '...'}) </h4>
                    {isLoadingComments && user ? (
                      <div className="space-y-4"> <Skeleton className="h-16 w-full" /> <Skeleton className="h-16 w-full" /> </div>
                    ) : commentsError && user ? (
                      <p className="text-sm text-destructive">Error loading comments: {commentsError.message}</p>
                    ) : user && comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    ) : !user ? (
                      <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view and add comments. </p>
                    ) : (
                      <div className="space-y-4">
                        {comments.map((comment) => (
                          <CommentItem key={comment.id} comment={comment} currentUserId={user?.uid ?? null} postId={selectedPost!.id} onDelete={handleCommentDeleted} extractMentionedUids={extractMentionedUids} />
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </ScrollArea>

              <CardFooter className="p-4 border-t bg-background flex-shrink-0">
                <div className="w-full space-y-3">
                  {user && (
                    <Popover
                      open={showNewCommentSuggestions && filteredNewCommentSuggestions.length > 0 && (filteredNewCommentSuggestions[0]?.userId !== 'loading-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-users-nc' && filteredNewCommentSuggestions[0]?.userId !== 'no-match-nc')}
                      onOpenChange={(open) => { setShowNewCommentSuggestions(open); if (!open) setNewCommentMentionQuery(''); }}
                    >
                      <PopoverTrigger asChild>
                        <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                          <Input ref={newCommentInputRef} type="text" placeholder="Add a comment... (@mention someone)" value={newComment} onChange={handleNewCommentInputChange} onFocus={handleNewCommentInputChange} onBlurCapture={() => setTimeout(() => { if (newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(document.activeElement as Node) && newCommentInputRef.current !== document.activeElement) { if (showNewCommentSuggestions) setShowNewCommentSuggestions(false); } }, 150)} disabled={!user || isSubmittingComment} className="flex-grow bg-card" aria-label="New comment input" autoComplete="off" />
                          <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newComment.trim() || !user || isSubmittingComment}> {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />} <span className="sr-only">Send Comment</span> </Button>
                        </form>
                      </PopoverTrigger>
                      <PopoverContent ref={newCommentSuggestionsPopoverRef} className="w-[--radix-popover-trigger-width] p-1 mt-1 max-h-48 overflow-y-auto" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                        {filteredNewCommentSuggestions.map(profile => {
                          const displayableName = profile.actualDisplayName || profile.mentionName;
                          const showSecondaryNameLine = profile.actualDisplayName && profile.actualDisplayName.toLowerCase() !== profile.mentionName.toLowerCase();
                          return (
                            profile.userId === 'loading-nc' || profile.userId === 'no-users-nc' || profile.userId === 'no-match-nc' ? (
                              <div key={profile.userId} className="p-2 text-center text-xs text-muted-foreground">{profile.displayName}</div>
                            ) : (
                              <Button key={profile.userId} variant="ghost" size="sm" className="w-full justify-start h-auto px-2 py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={() => handleSelectNewCommentSuggestion(profile)}>
                                <Avatar className="h-5 w-5 mr-2"><AvatarImage src={profile.avatarUrl} alt={profile.mentionName} /><AvatarFallback className="text-xs">{getSharedInitials(profile.mentionName)}</AvatarFallback></Avatar>
                                <div className="flex flex-col items-start">
                                  {showSecondaryNameLine && (<span className="font-medium text-foreground">{displayableName}</span>)}
                                  <span className={cn("text-muted-foreground", !showSecondaryNameLine && "font-medium text-foreground")}>@{profile.mentionName}</span>
                                </div>
                              </Button>
                            )
                          );
                        })}
                      </PopoverContent>
                    </Popover>
                  )}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                    <div className="flex-grow flex flex-col xs:flex-row items-stretch xs:items-center gap-2 w-full sm:w-auto">
                      {user && selectedPost.requestType === 'help_request' && selectedPost.userId !== user.uid && selectedPost.maxBudget != null && (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button variant="outline" size="xs" className="h-9" onClick={() => { setInlineBidAmount("0"); setInlineBidError(null); }} disabled={isProcessingOffer}>Bid FREE</Button>
                            <div className="flex-grow min-w-[130px] sm:min-w-[150px]">
                              <Label htmlFor="inlineBidAmountSheet" className="sr-only">Your Bid (0 - ${selectedPost.maxBudget.toLocaleString()})</Label>
                              <Input id="inlineBidAmountSheet" type="number" placeholder={`Bid (0 - $${selectedPost.maxBudget.toLocaleString()})`} value={inlineBidAmount} onChange={handleInlineBidChange} className={cn("h-9 text-sm w-full bg-card", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")} disabled={isProcessingOffer} min="0" max={selectedPost.maxBudget} step="0.01" />
                            </div>
                          </div>
                          {inlineBidError && (<p className="text-xs text-destructive mt-1 text-left w-full">{inlineBidError}</p>)}
                        </>
                      )}
                    </div>

                    <div className="flex flex-shrink-0 gap-2 self-end sm:self-center w-full sm:w-auto justify-end">
                      {user && selectedPost.userId && selectedPost.userId !== user.uid && (
                        <>
                          {selectedPost.requestType === 'help_request' && selectedPost.maxBudget != null ? (
                            <TooltipProvider>
                              <Tooltip delayDuration={100}>
                                <TooltipTrigger asChild>
                                  <Button variant="default" size="sm" onClick={handleOfferHelpAndBid} disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount === "" || !user} className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto">
                                    {isProcessingOffer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HandHelping className="mr-2 h-4 w-4" />}
                                    Offer Help & Submit Bid
                                  </Button>
                                </TooltipTrigger>
                                {(!!inlineBidError || inlineBidAmount === "" || !user) && (
                                  <TooltipContent side="top" className="bg-destructive text-destructive-foreground"><p>{!user ? "Log in to offer help" : inlineBidError || "Please enter a valid bid amount."}</p></TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          ) : selectedPost.requestType !== 'help_request' ? (
                            <Button variant="outline" size="sm" onClick={() => { if (user && selectedPost && selectedPost.userId) { findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id).then(conversationId => { if (conversationId) router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}`); }).catch(err => toast({ variant: "destructive", title: "Failed to start conversation", description: err.message })); } }} disabled={!user} className="w-full sm:w-auto">
                              <MessageCircle className="mr-2 h-4 w-4" /> Start Conversation
                            </Button>
                          ) : null}
                          <ConnectionButton targetUserId={selectedPost.userId} targetUserName={generateAnonymousName(selectedPost.userId)} size="sm" className="w-full sm:w-auto" />
                        </>
                      )}
                      {user && selectedPost.userId === user.uid && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={deletePostMutation.isPending} className="w-full sm:w-auto">
                              {deletePostMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              Delete Post
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete your post.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={deletePostMutation.isPending}>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeletePost(selectedPost.id)} disabled={deletePostMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                                {deletePostMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Continue'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <div className="hidden md:flex md:flex-col md:items-center md:justify-center h-full border rounded-lg bg-card/50 text-muted-foreground p-8 sticky top-20 max-h-[calc(100vh-6rem)]">
              <MessageSquareDashed className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">Select a post to view details</p>
              <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoardPageContent;
