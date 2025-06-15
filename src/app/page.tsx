
// src/app/page.tsx
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
  AlertDialogDescription as AlertDialogPrimitiveDescription, // Aliased to avoid conflict if DialogDescription is also imported
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle as AlertDialogPrimitiveTitle,
} from "@/components/ui/alert-dialog";
import { DialogDescription } from "@/components/ui/dialog"; // Added DialogDescription import
// Dialog components for Create Post are removed from here as it's now inline
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import { useForm } from 'react-hook-form';
import {
  Loader2, Trash2, MessageSquare, Sparkles, HandHelping, Briefcase, Link as LinkIcon,
  X, DollarSign, CalendarDays, Star, User, FileText, Compass, Home, Network, CornerDownRight, Send, AtSign, PlusCircle
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
import type { Post, NewPostData } from '@/types/post';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore, addPostToFirestore } from '@/services/postService';
import { Skeleton } from '@/components/ui/skeleton';
import { Timestamp } from 'firebase/firestore';
import { findOrCreateConversation } from '@/services/messagingService';
import { ConnectionButton } from '@/components/ConnectionButton';
import { addCommentToPost, getCommentsForPost, deleteCommentFromPost, getSubCommentsForComment, addSubCommentToComment, deleteSubCommentFromComment, toggleLikeComment, toggleLikeSubComment } from '@/services/commentService';
import type { NewCommentData, ClientComment, ClientSubComment, NewSubCommentData } from '@/types/comment';
import { fetchUserProfileBasic, getSuggestibleUsers } from '@/services/connectionService';
import { getReviewsForProfile } from '@/services/reviewService';
import type { UserProfileBasic } from '@/types/connection';
import { availableTags, detailedSectorsData } from '@/components/layout/MainLayout';
import { generateAnonymousName, getInitials as getSharedInitials } from '@/lib/pseudonymUtils';
import { IS_VALID_FIREBASE_UID_REGEX as IS_UID_REGEX_PAGE } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { PostList } from '@/components/board-page/PostList';
import type { CreatePostFormData, CreatePostFormProps } from '@/components/CreatePostForm';
import { uploadPostImage } from '@/services/storageService';
import { createNotification } from '@/services/notificationService';


const DynamicPostDetailPanel = dynamic(() =>
  import('@/components/board-page/PostDetailPanel').then(mod => mod.PostDetailPanel),
  { loading: () => <div className="md:col-span-1 flex justify-center items-center p-8"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>, ssr: false }
);

const DynamicCreatePostForm = dynamic<CreatePostFormProps>(() =>
  import('@/components/CreatePostForm').then((mod) => mod.CreatePostForm),
  {
    loading: () => <div className="p-4 text-center"><p className="text-sm text-muted-foreground">Loading form...</p></div>,
    ssr: false
  }
);

const BoardPageContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCreatePostFormInline, setShowCreatePostFormInline] = useState(false); // Renamed from isCreatePostOpen

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

  const addPostMutation = useMutation({
    mutationFn: async (formData: CreatePostFormData) => {
      if (!user) throw new Error("User not authenticated to create post.");

      let currentRatingScore = 0;
      try {
        const reviews = await getReviewsForProfile(user.uid);
        if (reviews && reviews.length > 0) {
          const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
          currentRatingScore = parseFloat((totalRating / reviews.length).toFixed(1));
        }
      } catch (ratingError: any) {
        // console.error("Error fetching reviews for rating score:", ratingError.message);
      }

      let uploadedImageUrls: string[] = [];
      if (formData.imageFiles && formData.imageFiles.length > 0 && user) {
        const uploadPromises = formData.imageFiles.map(file =>
          uploadPostImage(file, user.uid).catch(uploadError => {
            toast({ variant: "destructive", title: `Image Upload Failed for ${file.name}`, description: (uploadError as Error).message || "Could not upload image." });
            return null;
          })
        );
        const results = await Promise.all(uploadPromises);
        uploadedImageUrls = results.filter((url): url is string => url !== null);

        if (uploadedImageUrls.length !== formData.imageFiles.length) {
          if (uploadedImageUrls.length === 0 && formData.imageFiles.length > 0) {
            throw new Error("All image uploads failed. Post not created.");
          }
          toast({ variant: "warning", title: "Partial Image Upload", description: "Some images could not be uploaded. The post will be created with the successfully uploaded images."});
        }
      }
      
      const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
      const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
      const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

      const newPostData: NewPostData = {
        userId: user.uid,
        question: formData.question,
        requestType: formData.requestType,
        descriptionDetails: formData.descriptionDetails,
        descriptionTried: formData.descriptionTried?.trim() ? formData.descriptionTried.trim() : undefined,
        descriptionOutcome: formData.descriptionOutcome?.trim() ? formData.descriptionOutcome.trim() : undefined,
        tags: formData.tags || [],
        sector: mainSectorDetails?.name || formData.sector,
        subSector: subSectorDetails?.name || null,
        industry: industryDetails?.name || null,
        naicsCode: formData.industry || formData.subSector || formData.sector,
        ratingScore: currentRatingScore,
        imageUrls: uploadedImageUrls,
        mentionedUserIds: formData.mentionedUserIds || [],
        maxBudget: formData.requestType === 'help_request' ? (formData.maxBudget === undefined ? null : formData.maxBudget) : null,
        deadline: formData.requestType === 'help_request' && formData.deadline ? Timestamp.fromDate(new Date(formData.deadline)) : null,
        commentCount: 0,
      };
      return addPostToFirestore(newPostData);
    },
    onSuccess: (newlyCreatedPostId, variables) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['userPosts'] });
      queryClient.invalidateQueries({ queryKey: ['allPostsForSectorPage'] });
      toast({ title: variables.requestType === 'help_request' ? "Help Request Submitted" : "Post Created", description: "Your submission has been added." });
      setShowCreatePostFormInline(false); // Hide the inline form on success

      if (user && newlyCreatedPostId && variables.mentionedUserIds && variables.mentionedUserIds.length > 0) {
        const descriptionSource = variables.descriptionDetails;
        variables.mentionedUserIds.forEach(async (mentionedUid) => {
          if (mentionedUid !== user.uid) {
            try {
              await createNotification({
                userId: mentionedUid,
                type: 'mention',
                senderId: user.uid,
                postId: newlyCreatedPostId,
                postQuestion: variables.question,
                textSnippet: descriptionSource ? descriptionSource.substring(0, 100) : "",
              });
            } catch (notifyError) {
              // console.error("Failed to create mention notification:", notifyError);
            }
          }
        });
      }
    },
    onError: (error: Error, variables) => {
      toast({ variant: "destructive", title: "Submission Failed", description: `Could not submit ${variables.requestType === 'help_request' ? 'help request' : 'post'}: ${error.message}.` });
    },
  });

  const handleCreatePostSubmit = useCallback(
    (formData: CreatePostFormData) => {
      if (!user) {
        toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in." });
        return;
      }
      addPostMutation.mutate(formData);
    },
    [user, toast, addPostMutation]
  );


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
    setShowCreatePostFormInline(false); // Also hide create form if detail view is closed
  }, [searchParams, router, selectedPost, setSelectedPost, setShowCreatePostFormInline]);


  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');

    if (postIdFromUrl) {
      setShowCreatePostFormInline(false); // If a post is selected from URL, don't show create form
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
      // If no postId in URL, and a post was previously selected, clear it
      // This logic doesn't automatically open the create form, that's a separate action
      if (selectedPost) {
        setSelectedPost(null);
      }
    }
  }, [searchParams, posts, selectedPost, router, toast, setSelectedPost, setShowCreatePostFormInline]);


  const openPostCallback = useCallback((postToOpen: Post) => {
    setShowCreatePostFormInline(false); // Hide create form when selecting a post
    const currentPostIdInUrl = searchParams?.get('postId');
    if (currentPostIdInUrl === postToOpen.id) {
      handleCloseDetailView();
    } else {
      router.push(`/?postId=${postToOpen.id}`, { scroll: false });
    }
  }, [searchParams, router, handleCloseDetailView, setShowCreatePostFormInline]);


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
        isMobile ? "grid grid-cols-1" : "md:flex md:flex-row" 
      )}>
        <div className={cn(
          "flex flex-col overflow-hidden", 
          isMobile && (selectedPost || showCreatePostFormInline) ? "hidden" : "md:flex-1 md:min-w-0", 
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
          <>
            <Sheet
              open={!!selectedPost && !showCreatePostFormInline} // Only open if a post is selected AND create form isn't shown
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
                  {selectedPost && renderPostDetailPanel()}
                </div>
              </SheetContent>
            </Sheet>
             <Sheet
              open={showCreatePostFormInline && !selectedPost} // Only open if create form is active AND no post is selected
              onOpenChange={(isOpen) => {
                if (!isOpen) {
                  setShowCreatePostFormInline(false);
                }
              }}
            >
              <SheetContent
                side="right"
                className="w-full h-full p-0 flex flex-col sm:max-w-full"
                showCloseButton={false}
              >
                <SheetHeader className="p-4 border-b">
                   <div className="flex justify-between items-center">
                    <SheetTitle>Create New Post</SheetTitle>
                     <Button variant="ghost" size="icon" onClick={() => setShowCreatePostFormInline(false)}><X className="h-4 w-4"/></Button>
                   </div>
                   <DialogDescription> {/* Using DialogDescription for consistency with desktop */}
                     Share your idea, question, or request help from the community.
                   </DialogDescription>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {user && (
                      <DynamicCreatePostForm
                        onSubmit={handleCreatePostSubmit}
                        availableTags={availableTags}
                        detailedSectorsData={detailedSectorsData}
                        isSubmitting={addPostMutation.isPending}
                        currentUserId={user.uid}
                        onDialogClose={() => setShowCreatePostFormInline(false)}
                      />
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </>
        ) : ( // Desktop view
          (selectedPost || showCreatePostFormInline) ? (
             <div className="md:flex-1 md:min-w-0 md:border-l md:border-border md:pl-4 flex flex-col">
              {selectedPost && !showCreatePostFormInline && renderPostDetailPanel()}
              {showCreatePostFormInline && !selectedPost && user && (
                <Card className="flex flex-col flex-1 overflow-hidden bg-card shadow-xl sticky top-20 max-h-[calc(100vh-6.5rem)] rounded-lg">
                  <div className="p-4 border-b flex-shrink-0 flex flex-row justify-between items-center">
                    <div className="text-lg font-semibold text-foreground">Create New Post</div>
                     <Button variant="outline" size="sm" onClick={() => setShowCreatePostFormInline(false)}>Cancel</Button>
                  </div>
                  <ScrollArea className="flex-grow">
                    <div className="p-6">
                      <DynamicCreatePostForm
                          onSubmit={handleCreatePostSubmit}
                          availableTags={availableTags}
                          detailedSectorsData={detailedSectorsData}
                          isSubmitting={addPostMutation.isPending}
                          currentUserId={user.uid}
                          onDialogClose={() => setShowCreatePostFormInline(false)}
                      />
                    </div>
                  </ScrollArea>
                </Card>
              )}
            </div>
          ) : ( // Desktop silhouette panel
            <div className="hidden md:flex md:flex-1 md:min-w-0 md:pl-4 md:border-l md:border-border flex-col">
                <Card className="flex flex-col flex-1 overflow-hidden bg-card shadow-xl sticky top-20 max-h-[calc(100vh-6.5rem)] rounded-lg">
                  <div className="p-4 border-b flex-shrink-0 flex flex-row justify-between items-center">
                    <div className="text-lg font-semibold text-muted-foreground/50">Post Details</div>
                    {user && (
                        <Button variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setShowCreatePostFormInline(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Post
                        </Button>
                    )}
                  </div>
                  <ScrollArea className="flex-grow bg-background">
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                      <MessageSquare className="h-16 w-16 mb-4 text-muted-foreground opacity-30" />
                      <p className="text-lg font-medium text-muted-foreground">Select a post to view details</p>
                      <p className="text-sm mt-1 text-muted-foreground">Or create a new post to share with the community.</p>
                    </div>
                  </ScrollArea>
                  <div className="p-3 border-t flex-shrink-0">
                    <div className="h-9"></div>
                  </div>
                </Card>
            </div>
          )
        )}
      </div>
    </div>
  );
};

// CreatePostDialogHeader is no longer needed as the form is inline or in Sheet
// const CreatePostDialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
//   <div className={cn("flex flex-col space-y-1.5 text-left", className)} {...props} />
// );

export default BoardPageContent;
    
    

    



    




    

