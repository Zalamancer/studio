// src/components/board-page/PostList.tsx
"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Filter, FilterX, Tag, Briefcase, LayoutGrid, HandHelping, Search, PlusCircle, X, ListFilter } from "lucide-react";
import { PostCard } from './PostCard';
import type { Post } from '@/types/post';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import { useIsMobile } from "@/hooks/use-mobile";
import type { User as FirebaseUser } from 'firebase/auth';

interface PostListProps {
  posts: Post[];
  isLoading: boolean;
  onPostSelect: (post: Post) => void;
  selectedPostId?: string | null;
  availableTags: string[];
  detailedSectorsData: SectorWithSubSectors[];
  onInitiateCreatePost?: () => void;
  currentUser: FirebaseUser | null;
}

type PostTypeFilter = 'all' | 'help_request' | 'post';

export const PostList: React.FC<PostListProps> = ({
  posts,
  isLoading,
  onPostSelect,
  selectedPostId,
  availableTags,
  detailedSectorsData,
  onInitiateCreatePost,
  currentUser,
}) => {
  const isMobile = useIsMobile();
  const [isFilterContainerOpen, setIsFilterContainerOpen] = useState(false);

  const [selectedPostType, setSelectedPostType] = useState<PostTypeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | undefined>(undefined);
  const [selectedSubSectorFilter, setSelectedSubSectorFilter] = useState<string | undefined>(undefined);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [availableSubSectors, setAvailableSubSectors] = useState<SubSector[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<Industry[]>([]);

  const toggleSearch = () => {
    setIsSearchActive(prev => {
        if (prev) {
            setSearchTerm(''); // Clear search on close
        }
        return !prev;
    });
  };

  useEffect(() => {
    if (isSearchActive) {
        setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isSearchActive]);

  useEffect(() => {
    if (selectedSectorFilter) {
      const sector = detailedSectorsData.find(s => s.code === selectedSectorFilter);
      setAvailableSubSectors(sector?.subSectors || []);
      setSelectedSubSectorFilter(undefined);
      setAvailableIndustries([]);
      setSelectedIndustryFilter(undefined);
    } else {
      setAvailableSubSectors([]);
      setAvailableIndustries([]);
      setSelectedSubSectorFilter(undefined);
      setSelectedIndustryFilter(undefined);
    }
  }, [selectedSectorFilter, detailedSectorsData]);

  useEffect(() => {
    if (selectedSubSectorFilter) {
      const subSector = availableSubSectors.find(ss => ss.code === selectedSubSectorFilter);
      setAvailableIndustries(subSector?.industries || []);
      setSelectedIndustryFilter(undefined);
    } else {
      setAvailableIndustries([]);
    }
  }, [selectedSubSectorFilter, availableSubSectors]);

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prevTags =>
      prevTags.includes(tag)
        ? prevTags.filter(t => t !== tag)
        : [...prevTags, tag]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedPostType("all");
    setSelectedTags([]);
    setSelectedSectorFilter(undefined);
    setSearchTerm('');
    if (isSearchActive) setIsSearchActive(false);
  }, [isSearchActive]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedPostType !== "all") count++;
    if (selectedTags.length > 0) count++;
    if (selectedSectorFilter) count++;
    // Search term is not counted in the "clearable" filter badge
    return count;
  }, [selectedPostType, selectedTags, selectedSectorFilter]);

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
  }, [posts, selectedPostType, selectedTags, selectedSectorFilter, selectedSubSectorFilter, selectedIndustryFilter, detailedSectorsData, availableSubSectors, searchTerm]);


  if (isLoading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading posts...</p>
      </div>
    );
  }

  const FilterContent = () => (
    <div className={cn("space-y-4", isMobile ? "p-4" : "p-3 w-72")}>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Post Type</Label>
        <Select value={selectedPostType} onValueChange={(value) => setSelectedPostType(value as PostTypeFilter)}>
          <SelectTrigger className="w-full h-9 text-xs">
            <SelectValue placeholder="Filter by Post Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs"><LayoutGrid className="h-3.5 w-3.5 mr-1.5 inline-block" />All Posts</SelectItem>
            <SelectItem value="help_request" className="text-xs"><HandHelping className="h-3.5 w-3.5 mr-1.5 inline-block" />Help Requests</SelectItem>
            <SelectItem value="post" className="text-xs"><Briefcase className="h-3.5 w-3.5 mr-1.5 inline-block" />Opportunities</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Tags {selectedTags.length > 0 && `(${selectedTags.length})`}</Label>
        <ScrollArea className="h-[120px] rounded-md border p-2.5">
          <div className="space-y-1.5">
            {availableTags.map((tag) => (
              <div key={tag} className="flex items-center space-x-2">
                <Checkbox
                  id={`tag-filter-${tag}`}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => handleTagToggle(tag)}
                />
                <Label htmlFor={`tag-filter-${tag}`} className="text-xs font-normal">{tag}</Label>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Industry</Label>
        <Select value={selectedSectorFilter} onValueChange={setSelectedSectorFilter}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Sector" /></SelectTrigger>
          <SelectContent>
            {detailedSectorsData.map(sector => <SelectItem key={sector.code} value={sector.code} className="text-xs">{sector.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSubSectorFilter} onValueChange={setSelectedSubSectorFilter} disabled={availableSubSectors.length === 0}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={availableSubSectors.length > 0 ? "Select Sub-Sector" : "N/A"} /></SelectTrigger>
          <SelectContent>
            {availableSubSectors.map(sub => <SelectItem key={sub.code} value={sub.code} className="text-xs">{sub.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedIndustryFilter} onValueChange={setSelectedIndustryFilter} disabled={availableIndustries.length === 0}>
          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={availableIndustries.length > 0 ? "Select Industry" : "N/A"} /></SelectTrigger>
          <SelectContent>
            {availableIndustries.map(ind => <SelectItem key={ind.code} value={ind.code} className="text-xs">{ind.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 p-1 flex items-center gap-2 border-b pb-3">
        <Button variant="ghost" size="icon" onClick={toggleSearch} className="h-9 w-9 p-2 flex-shrink-0">
            {isSearchActive ? <X className="h-5 w-5"/> : <Search className="h-5 w-5"/>}
        </Button>

        {isSearchActive ? (
            <Input
                ref={searchInputRef}
                type="search"
                placeholder="Search posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 text-xs flex-grow rounded-md border-input"
                aria-label="Search posts"
            />
        ) : (
            <>
                {/* Mobile Filter & Create Buttons */}
                {isMobile && (
                    <div className="flex w-full items-center gap-2">
                        <Dialog open={isFilterContainerOpen} onOpenChange={setIsFilterContainerOpen}>
                            <DialogTrigger asChild>
                                <Button size="icon" variant="outline" className="h-9 w-9 p-2 flex-shrink-0 relative">
                                    <ListFilter className="h-5 w-5" />
                                    <span className="sr-only">Filters</span>
                                    {activeFilterCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 flex items-center justify-center text-xs font-bold rounded-full bg-primary text-primary-foreground">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px] p-0 flex flex-col h-[85vh] sm:h-auto">
                                <DialogHeader className="p-4 border-b">
                                    <DialogTitle>Filter Posts</DialogTitle>
                                    <DialogDescription>Refine posts by type, tags, or industry.</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="flex-grow min-h-0"><FilterContent /></ScrollArea>
                                <DialogFooter className="p-4 border-t">
                                    <DialogClose asChild>
                                        <Button type="button" variant="default" size="sm">Done</Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        {currentUser && onInitiateCreatePost && (
                            <Button size="sm" variant="default" className="text-xs flex-1 h-9" onClick={onInitiateCreatePost} type="button">
                                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                                Create Post
                            </Button>
                        )}
                    </div>
                )}
                
                {/* Desktop Filter & Create Buttons */}
                {!isMobile && (
                    <>
                        <Popover open={isFilterContainerOpen} onOpenChange={setIsFilterContainerOpen}>
                            <PopoverTrigger asChild>
                                <Button size="icon" variant="outline" className="h-9 w-9 p-2 flex-shrink-0 relative">
                                    <ListFilter className="h-5 w-5" />
                                    <span className="sr-only">Filters</span>
                                    {activeFilterCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-4 min-w-[1rem] px-1 flex items-center justify-center text-xs font-bold rounded-full bg-primary text-primary-foreground">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="start"><FilterContent /></PopoverContent>
                        </Popover>

                        <div className="flex-grow"></div>
                        
                        {activeFilterCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-xs text-primary hover:underline flex-shrink-0">
                                <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear All ({activeFilterCount})
                            </Button>
                        )}
                    </>
                )}
            </>
        )}
      </div>

      <ScrollArea className="flex-grow overflow-y-auto min-h-0 pr-2">
        <div className="columns-1 md:columns-2 gap-4 space-y-4">
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={onPostSelect}
                isSelected={selectedPostId === post.id}
                isPriority={index < 2}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-10">
              <p className="text-muted-foreground">
                {isLoading ? "Loading..." : (searchTerm.trim() ? `No posts found matching "${searchTerm}".` : (activeFilterCount > 0 ? "No posts found matching your filters." : "No posts available yet."))}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

PostList.displayName = "PostList";
