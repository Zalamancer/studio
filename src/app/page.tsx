
// src/app/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, PlusCircle, X, FilterX, Briefcase, LayoutGrid, HandHelping, Search, MessageSquare
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore, deletePostFromFirestore, addPostToFirestore } from '@/services/postService';
import type { Post, NewPostData, SectorWithSubSectors, SubSector, Industry } from '@/types/post';
import { availableTags, detailedSectorsData } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import dynamic from 'next/dynamic';
import { PostList } from '@/components/board-page/PostList';
import type { CreatePostFormData, CreatePostFormProps } from '@/components/CreatePostForm';
import { uploadPostImage } from '@/services/storageService';
import { Timestamp } from 'firebase/firestore';
import { usePage } from '@/contexts/PageContext';

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

type PostTypeFilter = 'all' | 'help_request' | 'post';

const EMPTY_SUBSECTOR_ARRAY: SubSector[] = [];
const EMPTY_INDUSTRY_ARRAY: Industry[] = [];

const BoardPageContent = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isFilterViewVisible, searchTerm, setSearchTerm, setHandleCreateClick, setFilterContent } = usePage();

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showCreatePostFormInline, setShowCreatePostFormInline] = useState(false);

  const [selectedPostType, setSelectedPostType] = useState<PostTypeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | undefined>(undefined);
  const [selectedSubSectorFilter, setSelectedSubSectorFilter] = useState<string | undefined>(undefined);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState<string | undefined>(undefined);
  
  const [availableSubSectors, setAvailableSubSectors] = useState<SubSector[]>(EMPTY_SUBSECTOR_ARRAY);
  const [availableIndustries, setAvailableIndustries] = useState<Industry[]>(EMPTY_INDUSTRY_ARRAY);

  const { data: posts = [], isLoading: isLoadingPosts, error: postsError } = useQuery<Post[]>({
    queryKey: ['posts'],
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 1,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (selectedSectorFilter) {
      const sector = detailedSectorsData.find(s => s.code === selectedSectorFilter);
      setAvailableSubSectors(sector?.subSectors || EMPTY_SUBSECTOR_ARRAY);
      setSelectedSubSectorFilter(undefined);
      setSelectedIndustryFilter(undefined);
      setAvailableIndustries(EMPTY_INDUSTRY_ARRAY);
    } else {
      setAvailableSubSectors(EMPTY_SUBSECTOR_ARRAY);
      setSelectedSubSectorFilter(undefined);
    }
  }, [selectedSectorFilter]);

  useEffect(() => {
    if (selectedSubSectorFilter) {
      const subSector = availableSubSectors.find(ss => ss.code === selectedSubSectorFilter);
      setAvailableIndustries(subSector?.industries || EMPTY_INDUSTRY_ARRAY);
      setSelectedIndustryFilter(undefined);
    } else {
      setAvailableIndustries(EMPTY_INDUSTRY_ARRAY);
    }
  }, [selectedSubSectorFilter, availableSubSectors]);


  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  }, []);

  const handlePostTypeToggle = useCallback((type: 'help_request' | 'post') => {
    setSelectedPostType(prevType => (prevType === type ? 'all' : type));
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedPostType("all");
    setSelectedTags([]);
    setSelectedSectorFilter(undefined);
    setSelectedSubSectorFilter(undefined);
    setSelectedIndustryFilter(undefined);
    setSearchTerm('');
  }, [setSearchTerm]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedPostType !== "all") count++;
    if (selectedTags.length > 0) count++;
    if (selectedSectorFilter) count++;
    if (selectedSubSectorFilter) count++;
    if (selectedIndustryFilter) count++;
    return count;
  }, [selectedPostType, selectedTags, selectedSectorFilter, selectedSubSectorFilter, selectedIndustryFilter]);

  const filteredPosts = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = posts;

    if (selectedPostType !== "all") {
      filtered = filtered.filter(post => post.requestType === selectedPostType);
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(post =>
        Array.isArray(post.tags) && selectedTags.every(tag => post.tags.includes(tag))
      );
    }

    if (selectedIndustryFilter) {
        filtered = filtered.filter(post => post.naicsCode === selectedIndustryFilter);
    } else if (selectedSubSectorFilter) {
        const subSector = availableSubSectors.find(ss => ss.code === selectedSubSectorFilter);
        const industryCodesInSubSector = subSector?.industries.map(ind => ind.code) || [];
        filtered = filtered.filter(post =>
            post.naicsCode === selectedSubSectorFilter ||
            (post.naicsCode && industryCodesInSubSector.includes(post.naicsCode))
        );
    } else if (selectedSectorFilter) {
        const sector = detailedSectorsData.find(s => s.code === selectedSectorFilter);
        const subSectorCodesInSector = sector?.subSectors.map(ss => ss.code) || [];
        const industryCodesInSector = sector?.subSectors.flatMap(ss => ss.industries.map(ind => ind.code)) || [];
        filtered = filtered.filter(post =>
            post.naicsCode === selectedSectorFilter ||
            (post.naicsCode && subSectorCodesInSector.includes(post.naicsCode)) ||
            (post.naicsCode && industryCodesInSector.includes(post.naicsCode))
        );
    }

    if (searchTerm.trim() !== '') {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter(post =>
        post.question.toLowerCase().includes(searchTermLower) ||
        (post.descriptionDetails && post.descriptionDetails.toLowerCase().includes(searchTermLower))
      );
    }

    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt as any)?.toMillis?.() || 0);
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt as any)?.toMillis?.() || 0);
      return timeB - timeA;
    });
  }, [posts, selectedPostType, selectedTags, selectedSectorFilter, selectedSubSectorFilter, selectedIndustryFilter, searchTerm, availableSubSectors, detailedSectorsData]);

  const FilterContent = useCallback(() => (
    <div className="space-y-4 p-4 border-b">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Post Type</Label>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedPostType === 'help_request' ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handlePostTypeToggle('help_request')}
            className={cn("h-9 px-3 text-xs flex-1 rounded-md", selectedPostType === 'help_request' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
          >
            <HandHelping className="mr-1.5 h-3.5 w-3.5" /> Requests
          </Button>
          <Button
            variant={selectedPostType === 'post' ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handlePostTypeToggle('post')}
            className={cn("h-9 px-3 text-xs flex-1 rounded-md", selectedPostType === 'post' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
          >
            <Briefcase className="mr-1.5 h-3.5 w-3.5" /> Opportunities
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Tags</Label>
        <div className="p-1">
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Button
                key={tag}
                type="button"
                variant={selectedTags.includes(tag) ? 'secondary' : 'outline'}
                size="xs"
                className="h-7 rounded-sm px-3 text-xs font-normal"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Industry</Label>
        <Select value={selectedSectorFilter} onValueChange={setSelectedSectorFilter}>
          <SelectTrigger className="w-full h-9 text-xs">
            <SelectValue placeholder="Select Sector" />
          </SelectTrigger>
          <SelectContent>
            {detailedSectorsData.map(sector => (
              <SelectItem key={sector.code} value={sector.code} className="text-xs">
                {sector.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSectorFilter && availableSubSectors.length > 0 && (
          <Select value={selectedSubSectorFilter} onValueChange={setSelectedSubSectorFilter}>
            <SelectTrigger className="w-full h-9 text-xs mt-2">
              <SelectValue placeholder="Select Sub-Sector" />
            </SelectTrigger>
            <SelectContent>
              {availableSubSectors.map(sub => (
                <SelectItem key={sub.code} value={sub.code} className="text-xs">
                  {sub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {selectedSubSectorFilter && availableIndustries.length > 0 && (
          <Select value={selectedIndustryFilter} onValueChange={setSelectedIndustryFilter}>
            <SelectTrigger className="w-full h-9 text-xs mt-2">
              <SelectValue placeholder="Select Industry" />
            </SelectTrigger>
            <SelectContent>
              {availableIndustries.map(ind => (
                <SelectItem key={ind.code} value={ind.code} className="text-xs">
                  {ind.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full h-9 text-xs text-primary hover:underline">
          <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear All Filters ({activeFilterCount})
        </Button>
      )}
    </div>
  ), [selectedPostType, handlePostTypeToggle, selectedTags, handleTagToggle, selectedSectorFilter, availableSubSectors, selectedSubSectorFilter, availableIndustries, selectedIndustryFilter, activeFilterCount, clearAllFilters]);
  
  const addPostMutation = useMutation({
    mutationFn: addPostToFirestore,
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        toast({
            title: "Post Created",
            description: "Your post is now live on the board.",
        });
        setShowCreatePostFormInline(false);
    },
    onError: (error: Error) => {
        toast({
            variant: "destructive",
            title: "Error Creating Post",
            description: error.message,
        });
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deletePostFromFirestore(postId),
    onSuccess: (_, postId) => {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        toast({
            title: "Post Deleted",
            description: "Your post has been successfully removed.",
        });
        if (selectedPost?.id === postId) {
            handleCloseDetailView();
        }
    },
    onError: (error: Error) => {
        toast({
            variant: "destructive",
            title: "Error Deleting Post",
            description: error.message,
        });
    }
  });

  const handleCreatePostSubmit = useCallback(async (formData: CreatePostFormData) => {
    if (!user) {
        toast({ variant: "destructive", title: "Authentication Error", description: "You must be logged in to create a post." });
        return;
    }
    const uploadedImageUrls: string[] = [];
    if (formData.imageFiles && formData.imageFiles.length > 0) {
        toast({ title: "Uploading Images...", description: "Please wait while your images are uploaded." });
        for (const file of formData.imageFiles) {
            try {
                const url = await uploadPostImage(file, user.uid);
                uploadedImageUrls.push(url);
            } catch (error) {
                toast({ variant: "destructive", title: "Image Upload Failed", description: `Could not upload ${file.name}. Please try again.` });
                return;
            }
        }
    }

    const sectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
    const subSectorDetails = sectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
    const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

    const newPost: NewPostData = {
        userId: user.uid,
        question: formData.question,
        descriptionDetails: formData.descriptionDetails,
        descriptionTried: formData.descriptionTried || null,
        descriptionOutcome: formData.descriptionOutcome || null,
        tags: formData.tags,
        sector: sectorDetails?.name || formData.sector,
        subSector: subSectorDetails?.name || null,
        industry: industryDetails?.name || null,
        naicsCode: formData.industry || formData.subSector || formData.sector,
        ratingScore: 0,
        imageUrls: uploadedImageUrls,
        mentionedUserIds: formData.mentionedUserIds || [],
        requestType: formData.requestType,
        maxBudget: formData.maxBudget,
        deadline: formData.deadline
    };
    addPostMutation.mutate(newPost);
  }, [user, toast, addPostMutation]);

  const handleDeletePost = useCallback((postId: string | undefined) => {
    if (!postId) return;
    if (user && posts.find(p => p.id === postId)?.userId === user.uid) {
        deletePostMutation.mutate(postId);
    } else {
        toast({ variant: "destructive", title: "Permission Denied", description: "You can only delete your own posts." });
    }
  }, [user, posts, deletePostMutation, toast]);

  const handleCloseDetailView = useCallback(() => {
    const newParams = new URLSearchParams(searchParams?.toString());
    newParams.delete('postId');
    router.replace(`/?${newParams.toString()}`, { scroll: false });
    setShowCreatePostFormInline(false);
  }, [searchParams, router]);

  useEffect(() => {
    const postIdFromUrl = searchParams?.get('postId');
    if (postIdFromUrl) {
      setShowCreatePostFormInline(false);
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
  }, [searchParams, posts, selectedPost, router, toast]);

  const openPostCallback = useCallback((postToOpen: Post) => {
    setShowCreatePostFormInline(false);
    const currentPostIdInUrl = searchParams?.get('postId');
    if (currentPostIdInUrl === postToOpen.id) {
      handleCloseDetailView();
    } else {
      router.push(`/?postId=${postToOpen.id}`, { scroll: false });
    }
  }, [searchParams, router, handleCloseDetailView]);

  const handleOpenCreatePostForm = useCallback(() => {
    if (user) {
      // Navigate to the base path to clear the 'postId' search param from the URL.
      // The main useEffect hook will then handle closing the detail view.
      router.push('/', { scroll: false });
      
      // Set state to show the create form.
      setShowCreatePostFormInline(true);
    } else {
      toast({ variant: "default", title: "Login Required", description: "Please log in to create a post." });
    }
  }, [user, toast, router]);
  
  useEffect(() => {
    setFilterContent(<FilterContent />);
    setHandleCreateClick(handleOpenCreatePostForm);
  }, [setFilterContent, setHandleCreateClick, handleOpenCreatePostForm, FilterContent]);


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
    <div className="flex flex-col flex-grow md:container md:mx-auto">
      {isMobile && isFilterViewVisible && (
        <div className="absolute inset-x-0 top-0 bg-background z-40 h-full overflow-y-auto">
          <FilterContent />
        </div>
      )}

      <div className={cn(
          "flex-grow md:p-4",
          isMobile ? "grid grid-cols-1" : "md:flex md:flex-row",
          isMobile && isFilterViewVisible && "hidden"
        )}>
        <div className={cn(
            "flex flex-col overflow-hidden",
            isMobile && (selectedPost || showCreatePostFormInline) ? "hidden" : "md:flex-1 md:min-w-0",
            !isMobile && "md:pr-4"
        )}>
          <PostList
            posts={filteredPosts}
            isLoading={isLoadingPosts}
            onPostSelect={openPostCallback}
            selectedPostId={selectedPost?.id}
            noResultsMessage={
              searchTerm.trim() ? `No posts found matching "${searchTerm}".` : (activeFilterCount > 0 ? "No posts found matching your filters." : "No posts available yet.")
            }
          />
        </div>

        {isMobile ? (
          <>
            <Sheet open={!!selectedPost && !showCreatePostFormInline} onOpenChange={(isOpen) => { if (!isOpen) handleCloseDetailView(); }}>
              <SheetContent side="right" className="w-full h-full p-0 flex flex-col sm:max-w-full" showCloseButton={false}>
                <SheetTitle className="sr-only">{selectedPost ? `Details for post: ${selectedPost.question.substring(0, 50)}...` : "Post Details"}</SheetTitle>
                <div className="flex-1 overflow-y-auto">{selectedPost && renderPostDetailPanel()}</div>
              </SheetContent>
            </Sheet>
            <Sheet open={showCreatePostFormInline && !selectedPost} onOpenChange={(isOpen) => { if (!isOpen) setShowCreatePostFormInline(false); }}>
              <SheetContent side="right" className="w-full h-full p-0 flex flex-col sm:max-w-full" showCloseButton={false}>
                <SheetHeader className="p-4 border-b flex flex-row justify-between items-center">
                  <SheetTitle>Create New Post</SheetTitle>
                  <Button variant="ghost" size="icon" onClick={() => setShowCreatePostFormInline(false)}><X className="h-4 w-4" /></Button>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  <div className="p-6">
                    {user && (<DynamicCreatePostForm onSubmit={handleCreatePostSubmit} availableTags={availableTags} detailedSectorsData={detailedSectorsData} isSubmitting={addPostMutation.isPending} currentUserId={user.uid} onDialogClose={() => setShowCreatePostFormInline(false)} />)}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </>
        ) : (
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
                      <DynamicCreatePostForm onSubmit={handleCreatePostSubmit} availableTags={availableTags} detailedSectorsData={detailedSectorsData} isSubmitting={addPostMutation.isPending} currentUserId={user.uid} onDialogClose={() => setShowCreatePostFormInline(false)} />
                    </div>
                  </ScrollArea>
                </Card>
              )}
            </div>
          ) : (
            <div className="hidden md:flex md:flex-1 md:min-w-0 md:pl-4 md:border-l md:border-border flex-col">
              <Card className="flex flex-col flex-1 overflow-hidden bg-card shadow-xl sticky top-20 max-h-[calc(100vh-6.5rem)] rounded-lg">
                <div className="p-4 border-b flex-shrink-0 flex flex-row justify-between items-center">
                  <div className="text-lg font-semibold text-muted-foreground/50">Post Details</div>
                </div>
                <div className="flex-grow bg-background"><div className="flex flex-col items-center justify-center h-full p-8 text-center"><MessageSquare className="h-16 w-16 mb-4 text-muted-foreground opacity-30" /><p className="text-lg font-medium text-muted-foreground">Select a post to view details</p><p className="text-sm mt-1 text-muted-foreground">Or create a new post to share with the community.</p></div></div>
                <div className="p-3 border-t flex-shrink-0"><div className="h-9"></div></div>
              </Card>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default BoardPageContent;
