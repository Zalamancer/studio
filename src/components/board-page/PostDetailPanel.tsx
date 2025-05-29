// src/components/board-page/PostDetailPanel.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { cn, IS_VALID_FIREBASE_UID_REGEX } from "@/lib/utils"; // Import IS_VALID_FIREBASE_UID_REGEX
import {
  Loader2, Trash2, HandHelping, FileText, Network, Home, Eye, Building, Link2,
  MessageCircle, Send, X, DollarSign, CalendarDays, Star, Info, AtSign, Briefcase
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Post } from '@/types/post';
import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { ConnectionButton } from '@/components/ConnectionButton'; // Re-verify this path if needed
import { addCommentToPost, getCommentsForPost } from '@/services/commentService';
import type { NewCommentData, ClientComment } from '@/types/comment';
import { getSuggestibleUsers, fetchUserProfileBasic } from '@/services/connectionService';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils'; // Use shared getInitials
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { addBidToPost, getBidsForPost } from '@/services/bidService';
import type { ClientBid, NewBidData } from '@/types/bid';
import { formatDistanceToNow } from 'date-fns';
import { Form } from "@/components/ui/form"; // Form is imported but not used in this component
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TextWithMentions } from './TextWithMentions';
import { CommentItem } from './CommentItem';

// Bid form schema - This belongs here as it's specific to this panel's bidding form
const bidFormSchema = z.object({
    bidAmount: z.coerce.number().min(0, "Bid must be non-negative.").optional(),
    bidMessage: z.string().max(300, "Message too long.").optional(),
});
type BidFormValues = z.infer<typeof bidFormSchema>;

// Helper function to extract mentioned user UIDs from text
// It now prioritizes matching against generated mentionNames.
// This function needs context of available profiles to resolve mentionNames to UIDs.
const extractMentionedUids = (text: string, profilesToSearch: UserProfileBasic[]): string[] => {
  console.log(`%c[PostDetailPanel] extractMentionedUids - Input Text: "${text?.substring(0, 100)}..."`, "color: orange;");
  console.log(`%c[PostDetailPanel] extractMentionedUids - Profiles to Search In (count: ${profilesToSearch.length}):`, "color: orange;", profilesToSearch.slice(0, 5).map(p => ({ uid: p.userId, mentionName: p.mentionName, displayName: p.displayName })));

  const mentionRegexGlobal = /@([A-Z][a-z]+[A-Z][a-z]+[0-9]{3,}|[a-zA-Z0-9]{20,28})/g;
  const textualMentions = new Set<string>();
  for (const match of text.matchAll(mentionRegexGlobal)) {
    if (match[1]) textualMentions.add(match[1].trim());
  }

  if (textualMentions.size === 0) {
    console.log(`%c[PostDetailPanel] extractMentionedUids - No textual mentions found in text.`, "color: orange;");
    return [];
  }
  console.log(`%c[PostDetailPanel] extractMentionedUids - Input Textual Mentions Extracted:`, "color: orange;", Array.from(textualMentions));

  const resolvedUids = new Set<string>();

  for (const textualMention of textualMentions) {
    let foundProfile: UserProfileBasic | undefined = undefined;
    const textualMentionLower = textualMention.toLowerCase();

    // Strategy 1: Match textualMention (as "ColorAnimalNumber") against the mentionName of profiles in profilesToSearch
    foundProfile = profilesToSearch.find(p => {
      const profileMentionNameLower = p.mentionName?.toLowerCase();
      return profileMentionNameLower === textualMentionLower;
    });

    if (foundProfile && foundProfile.userId) {
      console.log(`%c[PostDetailPanel] extractMentionedUids - Resolved textualMention "${textualMention}" by matching mentionName with profile UID: ${foundProfile.userId}`, "color: green;");
      resolvedUids.add(foundProfile.userId);
      continue;
    }

    // Strategy 2: Fallback - If the textualMention itself is a UID, find if that user is in profilesToSearch
    if (IS_VALID_FIREBASE_UID_REGEX.test(textualMention)) {
      foundProfile = profilesToSearch.find(p => p.userId === textualMention);
      if (foundProfile) {
        console.log(`%c[PostDetailPanel] extractMentionedUids - Resolved textualMention "${textualMention}" as DIRECT UID from profilesToSearch to UID: ${foundProfile.userId}`, "color: green;");
        resolvedUids.add(foundProfile.userId);
        continue;
      }
    }
    console.log(`%c[PostDetailPanel] extractMentionedUids - Could NOT resolve textual mention: "${textualMention}" to a UID from the provided profiles.`, "color: red;");
  }
  console.log(`%c[PostDetailPanel] extractMentionedUids - Final Resolved UIDs:`, "color: green; font-weight: bold;", Array.from(resolvedUids));
  return Array.from(resolvedUids);
};


interface PostDetailPanelProps {
  post: Post;
  currentUser: User | null;
  onClose: () => void;
  onDelete: (postId: string) => void;
}

export const PostDetailPanel: React.FC<PostDetailPanelProps> = ({ post: selectedPost, currentUser: user, onClose, onDelete }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newCommentMentionQuery, setNewCommentMentionQuery] = useState('');
  const [debouncedNewCommentMentionQuery, setDebouncedNewCommentMentionQuery] = useState('');
  const [showNewCommentSuggestions, setShowNewCommentSuggestions] = useState(false);
  const newCommentInputRef = useRef<HTMLInputElement>(null);
  const newCommentSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  const [inlineBidAmount, setInlineBidAmount] = useState<string>("");
  const [inlineBidError, setInlineBidError] = useState<string | null>(null);
  const [isProcessingOffer, setIsProcessingOffer] = useState(false);

  const { data: comments = [], isLoading: isLoadingComments, error: commentsError, refetch: refetchComments } = useQuery<ClientComment[]>({
    queryKey: ['comments', selectedPost?.id],
    queryFn: () => selectedPost?.id && user ? getCommentsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost?.id && !!user,
  });

  const { data: bids = [], isLoading: isLoadingBids, error: bidsError } = useQuery<ClientBid[], Error>({
    queryKey: ['bids', selectedPost?.id],
    queryFn: () => selectedPost?.id ? getBidsForPost(selectedPost.id) : Promise.resolve([]),
    enabled: !!selectedPost && selectedPost.requestType === 'help_request',
  });

  const { data: generalSuggestibleUsers = [], isLoading: isLoadingGeneralSuggestions } = useQuery<UserProfileBasic[]>({
    queryKey: ['generalSuggestibleUsersForDetailPanel', selectedPost?.id, debouncedNewCommentMentionQuery],
    queryFn: () => getSuggestibleUsers(debouncedNewCommentMentionQuery, debouncedNewCommentMentionQuery ? 10 : 25),
    enabled: !!selectedPost && !!user && showNewCommentSuggestions,
  });
  
  const bidForm = useForm<BidFormValues>({
    resolver: zodResolver(bidFormSchema),
    defaultValues: { bidAmount: undefined, bidMessage: "" },
  });

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedNewCommentMentionQuery(newCommentMentionQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [newCommentMentionQuery]);

  const allAvailableProfilesForNewComment = useMemo(() => {
    const profiles = new Map<string, UserProfileBasic>();
    if (user) {
      profiles.set(user.uid, {
        userId: user.uid,
        mentionName: generateAnonymousName(user.uid),
        displayName: user.displayName || generateAnonymousName(user.uid),
        companyName: undefined, // Assuming 'user' object doesn't have companyName directly
      });
    }
    if (selectedPost?.userId && !profiles.has(selectedPost.userId)) {
      const existingSuggestion = generalSuggestibleUsers.find(p => p.userId === selectedPost.userId);
      profiles.set(selectedPost.userId, existingSuggestion || {
        userId: selectedPost.userId,
        mentionName: generateAnonymousName(selectedPost.userId),
        displayName: generateAnonymousName(selectedPost.userId),
      });
    }
    comments.forEach(c => {
      if (!profiles.has(c.userId)) {
        const existingSuggestion = generalSuggestibleUsers.find(p => p.userId === c.userId);
        profiles.set(c.userId, existingSuggestion || {
          userId: c.userId,
          mentionName: c.mentionName || generateAnonymousName(c.userId),
          displayName: c.userName || c.mentionName || generateAnonymousName(c.userId),
          avatarUrl: c.userAvatar,
        });
      }
    });
    generalSuggestibleUsers.forEach(sug => {
      if (!profiles.has(sug.userId)) profiles.set(sug.userId, sug);
    });
    return Array.from(profiles.values());
  }, [user, selectedPost?.userId, comments, generalSuggestibleUsers]);


  const handleCommentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedPost || !newComment.trim() || isSubmittingComment) return;
    setIsSubmittingComment(true);
    const finalMentionedUids = extractMentionedUids(newComment.trim(), allAvailableProfilesForNewComment);
    const commentData: Omit<NewCommentData, 'likeCount' | 'likedBy'> = {
      userId: user.uid,
      text: newComment.trim(),
      mentionedUserIds: finalMentionedUids,
      mentionName: generateAnonymousName(user.uid),
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
  },[user, selectedPost, newComment, isSubmittingComment, allAvailableProfilesForNewComment, queryClient, toast]);

  const handleCommentDeleted = useCallback(() => {
    if (selectedPost) queryClient.invalidateQueries({ queryKey: ['comments', selectedPost.id] });
  }, [selectedPost, queryClient]);

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
  }, []);

  const handleNewCommentInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewComment(value);
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [evaluateNewCommentMentionState]);
  
  const handleNewCommentInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const value = e.target.value;
    evaluateNewCommentMentionState(value, e.target.selectionStart || 0);
  }, [evaluateNewCommentMentionState]);

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
  }, [newComment]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showNewCommentSuggestions && newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(event.target as Node) && newCommentInputRef.current && !newCommentInputRef.current.contains(event.target as Node)) {
        if (showNewCommentSuggestions) setShowNewCommentSuggestions(false);
      }
    };
    if (showNewCommentSuggestions) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNewCommentSuggestions]);

  const addBidMutation = useMutation({
    mutationFn: addBidToPost,
    onSuccess: () => {
      if (selectedPost) queryClient.invalidateQueries({ queryKey: ['bids', selectedPost.id] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Bid Failed", description: error.message });
    },
  });
  
  const handleInlineBidChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInlineBidAmount(value);
    if (value === "") {
      setInlineBidError(null); return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) setInlineBidError("Please enter a valid number.");
    else if (numValue < 0) setInlineBidError("Bid cannot be negative.");
    else if (selectedPost?.maxBudget != null && numValue > selectedPost.maxBudget) setInlineBidError(`Bid cannot exceed max budget of $${selectedPost.maxBudget.toLocaleString()}.`);
    else setInlineBidError(null);
  }, [selectedPost?.maxBudget]);

  const handleOfferHelpAndBid = useCallback(async () => {
    if (!user || !selectedPost || selectedPost.userId === user.uid || selectedPost.requestType !== 'help_request' || selectedPost.maxBudget == null) {
      toast({ variant: "destructive", title: "Action Not Allowed", description: "Cannot perform this action." }); return;
    }
    setIsProcessingOffer(true);
    const parsedBidAmount = parseFloat(inlineBidAmount);
    if (inlineBidAmount === "" || isNaN(parsedBidAmount) || parsedBidAmount < 0 || (selectedPost.maxBudget !== null && parsedBidAmount > selectedPost.maxBudget)) {
      const currentError = inlineBidAmount === "" ? "Bid amount is required." : (isNaN(parsedBidAmount) || parsedBidAmount < 0 ? "Invalid bid amount." : `Bid cannot exceed max budget of $${selectedPost.maxBudget.toLocaleString()}.`);
      setInlineBidError(currentError);
      toast({ variant: "destructive", title: "Invalid Bid", description: currentError });
      setIsProcessingOffer(false); return;
    }
    setInlineBidError(null);
    const bidDetails: NewBidData = {
      postId: selectedPost.id, bidderId: user.uid, bidAmount: parsedBidAmount,
      bidMessage: `Bid placed: $${parsedBidAmount.toLocaleString()}`,
    };
    try {
      await addBidMutation.mutateAsync(bidDetails);
      const conversationId = await findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id);
      if (conversationId) {
        toast({ title: "Bid Placed & Conversation Started", description: "Redirecting to Messages..." });
        router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}&initialBidAmount=${parsedBidAmount}`);
        onClose(); 
      } else throw new Error("Failed to initiate conversation after bid.");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action Failed", description: error.message || "Could not place bid or start conversation." });
    } finally {
      setIsProcessingOffer(false);
    }
  }, [user, selectedPost, inlineBidAmount, addBidMutation, router, toast, queryClient, onClose]);

  const minimumBidAmount = useMemo(() => {
    if (!bids || bids.length === 0 || !selectedPost || selectedPost.requestType !== 'help_request') return null;
    return Math.min(...bids.map(bid => bid.bidAmount));
  }, [bids, selectedPost]);

  const filteredNewCommentSuggestions = useMemo(() => {
    if (!showNewCommentSuggestions) return [];
    if (isLoadingGeneralSuggestions) return [{ userId: 'loading-main-comment', mentionName: 'Loading users...', displayName: 'Loading users...' }];
    
    let results: UserProfileBasic[];
    const source = generalSuggestibleUsers.filter(p => p.userId !== user?.uid && !!p.mentionName);

    if (newCommentMentionQuery.trim() === '') {
        results = source.slice(0, 25);
    } else {
        const queryLower = newCommentMentionQuery.toLowerCase();
        results = source.filter(p => 
            p.mentionName.toLowerCase().includes(queryLower) ||
            (p.displayName && p.displayName.toLowerCase().includes(queryLower)) ||
            (p.companyName && p.companyName.toLowerCase().includes(queryLower))
        ).slice(0, 10);
    }
    if (results.length === 0 && newCommentMentionQuery.trim() !== '') {
        return [{ userId: 'no-match-main-comment', mentionName: `No users matching "@${newCommentMentionQuery}"`, displayName: `No users matching "@${newCommentMentionQuery}"`}];
    }
    if (results.length === 0) {
        return [{ userId: 'no-users-main-comment', mentionName: 'No users to suggest.', displayName: 'No users to suggest.'}];
    }
    return results;
  }, [newCommentMentionQuery, generalSuggestibleUsers, isLoadingGeneralSuggestions, showNewCommentSuggestions, user?.uid]);


  if (!selectedPost) return null; 

  const selectedPostDate = selectedPost.createdAt instanceof Timestamp
    ? selectedPost.createdAt.toDate().toLocaleDateString()
    : 'Date unavailable';

  return (
    <Card className="shadow-xl flex flex-col flex-1 overflow-hidden bg-card h-full">
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
              Posted on: {selectedPostDate}
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
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close post details" className="flex-shrink-0 ml-2">
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
                <TabsContent value="details" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-muted/30 min-h-[100px]">
                  {selectedPost.descriptionDetails ? (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      <TextWithMentions text={selectedPost.descriptionDetails} mentionedUserIds={selectedPost.mentionedUserIds || []} />
                    </p>
                  ) : (
                    <p className="text-muted-foreground italic">No details provided.</p>
                  )}
                </TabsContent>
                {selectedPost.descriptionTried && (
                  <TabsContent value="tried" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-muted/30 min-h-[100px]">
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedPost.descriptionTried}</p>
                  </TabsContent>
                )}
                {selectedPost.descriptionOutcome && (
                  <TabsContent value="outcome" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-muted/30 min-h-[100px]">
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
                  <TextWithMentions text={selectedPost.description} mentionedUserIds={selectedPost.mentionedUserIds || []} />
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

          {selectedPost.requestType === 'help_request' && (
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-semibold flex items-center gap-2"> <DollarSign className="h-5 w-5 text-green-600" /> Bids ({isLoadingBids ? '...' : bids.length}) </h4>
                 <p className="text-xs text-muted-foreground">
                   Minimum bid: <span className="font-semibold text-primary">{isLoadingBids ? '...' : (minimumBidAmount !== null ? `$${minimumBidAmount.toLocaleString()}` : 'N/A')}</span>
                 </p>
              </div>
              {isLoadingBids && user ? (
                <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading bids...</div>
              ) : bidsError && user ? (
                <p className="text-sm text-destructive">Error loading bids: {bidsError.message}</p>
              ) : user && bids.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bids placed yet.</p>
              ) : !user ? (
                <p className="text-sm text-muted-foreground text-center py-4"> <Link href="/login" className="text-primary hover:underline">Log in</Link> to view or place bids. </p>
              ) : bids.length > 0 ? (
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
          )}

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
                  <CommentItem key={comment.id} comment={comment} currentUserId={user?.uid ?? null} postId={selectedPost!.id} onDelete={handleCommentDeleted} postAuthorId={selectedPost.userId}/>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </ScrollArea>

      <CardFooter className="p-4 border-t bg-background flex-shrink-0">
        <div className="w-full space-y-3">
          {user && (
             <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
                <Input
                    ref={newCommentInputRef}
                    type="text"
                    placeholder="Add a comment... (@mention someone)"
                    value={newComment}
                    onChange={handleNewCommentInputChange}
                    onFocus={handleNewCommentInputFocus}
                    onBlurCapture={() => setTimeout(() => { if (newCommentSuggestionsPopoverRef.current && !newCommentSuggestionsPopoverRef.current.contains(document.activeElement as Node) && newCommentInputRef.current !== document.activeElement) { if (showNewCommentSuggestions) setShowNewCommentSuggestions(false); } }, 150)}
                    disabled={!user || isSubmittingComment}
                    className="flex-grow bg-card"
                    aria-label="New comment input"
                    autoComplete="off"
                />
                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newComment.trim() || !user || isSubmittingComment}> {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-primary" />} <span className="sr-only">Send Comment</span> </Button>
             </form>
          )}

          {user && selectedPost.requestType === 'help_request' && selectedPost.userId !== user.uid && selectedPost.maxBudget != null && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2">
                <div className="flex-grow flex items-center gap-2 w-full sm:w-auto">
                  <Button variant="outline" size="sm" className="h-9 whitespace-nowrap flex-1 sm:flex-none" onClick={() => { setInlineBidAmount("0"); setInlineBidError(null); }} disabled={isProcessingOffer}>
                    Bid FREE
                  </Button>
                  <div className="flex-grow min-w-[100px] sm:min-w-[130px]">
                    <Label htmlFor="inlineBidAmountSheet" className="sr-only">Your Bid (0 - ${selectedPost.maxBudget.toLocaleString()})</Label>
                    <Input
                      id="inlineBidAmountSheet"
                      type="number"
                      placeholder={`Custom amount...`}
                      value={inlineBidAmount}
                      onChange={handleInlineBidChange}
                      className={cn("h-9 text-sm w-full bg-card", inlineBidError && "border-destructive ring-destructive focus-visible:ring-destructive")}
                      disabled={isProcessingOffer}
                      min="0"
                      max={selectedPost.maxBudget}
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex-shrink-0 w-full sm:w-auto">
                    <TooltipProvider>
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="default" size="sm" onClick={handleOfferHelpAndBid} disabled={isProcessingOffer || !!inlineBidError || inlineBidAmount === "" || !user} className="bg-green-600 hover:bg-green-700 text-white w-full">
                                    {isProcessingOffer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <HandHelping className="mr-2 h-4 w-4" />}
                                    Offer Help & Submit Bid
                                </Button>
                            </TooltipTrigger>
                            {(!!inlineBidError || inlineBidAmount === "" || !user) && (
                            <TooltipContent side="top" className="bg-destructive text-destructive-foreground"><p>{!user ? "Log in to offer help" : inlineBidError || "Please enter a valid bid amount."}</p></TooltipContent>
                            )}
                        </Tooltip>
                    </TooltipProvider>
                </div>
              </div>
              {inlineBidError && (<p className="text-xs text-destructive text-left w-full mt-1 sm:ml-2">{inlineBidError}</p>)}
            </div>
          )}

          <div className="flex flex-shrink-0 gap-2 self-end w-full sm:w-auto justify-end mt-2">
            {user && selectedPost.userId && selectedPost.userId !== user.uid && selectedPost.requestType !== 'help_request' && (
              <Button variant="outline" size="sm" onClick={() => { if (user && selectedPost && selectedPost.userId) { findOrCreateConversation(user.uid, selectedPost.userId, selectedPost.id).then(conversationId => { if (conversationId) router.push(`/contracts?conversationId=${conversationId}&postId=${selectedPost.id}`); }).catch(err => toast({ variant: "destructive", title: "Failed to start conversation", description: err.message })); } }} disabled={!user} className="w-full sm:w-auto">
                <MessageCircle className="mr-2 h-4 w-4" /> Start Conversation
              </Button>
            )}
             {user && selectedPost.userId && selectedPost.userId !== user.uid && (
                <ConnectionButton targetUserId={selectedPost.userId} targetUserName={generateAnonymousName(selectedPost.userId)} size="sm" className="w-full sm:w-auto" />
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
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>This action cannot be undone. This will permanently delete your post.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletePostMutation.isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(selectedPost.id)} disabled={deletePostMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                      {deletePostMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : 'Continue'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};
PostDetailPanel.displayName = "PostDetailPanel";

// Main Board Page Content Component
const BoardPageContent = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<string>("recommended");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  
  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: true,
  });

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

  const openPostCallback = useCallback((postToOpen: Post) => {
    console.log("[BoardPageContent] openPostCallback called with post:", postToOpen.id);
    if (selectedPost && selectedPost.id === postToOpen.id) {
      console.log("[BoardPageContent] Toggling off selected post:", postToOpen.id);
      setSelectedPost(null);
      router.replace('/', undefined, { shallow: true });
    } else {
      console.log("[BoardPageContent] Setting new selected post:", postToOpen.id);
      setSelectedPost(postToOpen);
    }
  }, [selectedPost, router]);

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    console.log("[BoardPageContent] useEffect for URL postId. Current searchParams:", searchParams?.toString(), "postIdFromUrl:", postIdFromUrl);
    
    if (postIdFromUrl && posts.length > 0) {
      console.log("[BoardPageContent] Attempting to open post from URL. current selectedPost?.id:", selectedPost?.id);
      if (!selectedPost || selectedPost.id !== postIdFromUrl) { 
        const postToOpen = posts.find(p => p.id === postIdFromUrl);
        if (postToOpen) {
          console.log("[BoardPageContent] Opening post from URL:", postToOpen.id);
          setSelectedPost(postToOpen);
          // DO NOT clear URL here immediately, let it be cleared when user closes the panel
        } else {
          console.warn(`[BoardPageContent] Post with ID '${postIdFromUrl}' from URL not found in fetched posts.`);
          toast({ variant: "destructive", title: "Post Not Found", description: "The requested post could not be found." });
          router.replace('/', undefined, { shallow: true });
        }
      } else {
          console.log("[BoardPageContent] Post from URL is already selected or no change needed.");
      }
    }
  }, [searchParams, posts, router, toast, selectedPost]); // Added selectedPost here to re-evaluate if it changed from null due to URL

  useEffect(() => {
    if (!authLoading && !user && selectedPost) {
      console.log("[BoardPageContent] Auth changed, user logged out. Clearing selectedPost.");
      setSelectedPost(null);
    }
  }, [user, authLoading, selectedPost]);

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

  const handleTagClick = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  }, []);

  const renderPosts = useCallback((postsToRender: Post[]) => (
    <div className="columns-1 md:columns-2 gap-4 space-y-4"> {/* md:columns-2 for two columns */}
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

  if (authLoading && !posts.length) { 
    return (
      <div className="flex-grow flex justify-center items-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (postsError) {
    return (
        <div className="flex-grow flex flex-col justify-center items-center text-destructive p-4">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <p className="text-lg font-semibold">Error loading posts</p>
            <p className="text-sm">{postsError.message}</p>
        </div>
    );
  }
  
  const DynamicPostDetailPanel = dynamic(() => 
    import('@/components/board-page/PostDetailPanel').then(mod => mod.PostDetailPanel),
    { 
      loading: () => (
        <div className="md:col-span-1 flex flex-col h-full">
          <Card className="shadow-xl flex flex-col flex-1 overflow-hidden bg-card h-full">
            <CardHeader className="p-4 border-b"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/2 mt-2" /></CardHeader>
            <ScrollArea className="flex-grow"><CardContent className="p-4 space-y-4"><Skeleton className="h-32 w-full" /><Skeleton className="h-20 w-full" /></CardContent></ScrollArea>
            <CardFooter className="p-4 border-t bg-background"><Skeleton className="h-10 w-full" /></CardFooter>
          </Card>
        </div>
      ), 
      ssr: false 
    }
  );


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

      <div className="grid md:grid-cols-2 md:gap-8 flex-grow">
        {/* Left Column: Post List */}
        <div className={cn(
            "flex flex-col overflow-hidden",
            selectedPost ? "md:col-span-1" : "col-span-1 md:col-span-2" // Takes full width if no post selected on desktop
        )}>
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

        {/* Right Column: Selected Post Details */}
        {selectedPost ? (
          <div className="md:col-span-1 flex flex-col h-full md:max-h-[calc(100vh-8rem)] md:sticky md:top-[calc(4rem+1.5rem)]"> {/* Adjust top based on header height + page padding-top */}
            <DynamicPostDetailPanel
              post={selectedPost}
              currentUser={user}
              onClose={() => {
                setSelectedPost(null);
                router.replace('/', undefined, { shallow: true }); 
              }}
              onDelete={handleDeletePost}
            />
          </div>
        ) : (
          <div className="hidden md:flex md:col-span-1 md:flex-col md:items-center md:justify-center border rounded-lg bg-card/50 text-muted-foreground p-8 sticky top-[calc(4rem+1.5rem)] max-h-[calc(100vh-8rem)]">
            <MessageSquareDashed className="h-16 w-16 mb-4 opacity-30" />
            <p className="text-lg">Select a post to view details</p>
            <p className="text-sm mt-1">Details will appear here once you click on a post from the list.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BoardPageContent;

```