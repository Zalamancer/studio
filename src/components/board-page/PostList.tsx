
"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Filter, FilterX, Tag, Briefcase, LayoutGrid, HandHelping } from "lucide-react";
import { PostCard } from './PostCard';
import type { Post } from '@/types/post';
import type { SectorWithSubSectors, SubSector, Industry } from '@/components/layout/MainLayout'; // For sector data types
import { cn } from '@/lib/utils';

interface PostListProps {
  posts: Post[];
  isLoading: boolean;
  onPostSelect: (post: Post) => void;
  selectedPostId?: string | null;
  availableTags: string[]; // Added prop
  detailedSectorsData: SectorWithSubSectors[]; // Added prop
}

type PostTypeFilter = 'all' | 'help_request' | 'post';

export const PostList: React.FC<PostListProps> = ({
  posts,
  isLoading,
  onPostSelect,
  selectedPostId,
  availableTags,
  detailedSectorsData,
}) => {
  const [selectedPostType, setSelectedPostType] = useState<PostTypeFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string | undefined>(undefined);
  const [selectedSubSectorFilter, setSelectedSubSectorFilter] = useState<string | undefined>(undefined);
  const [selectedIndustryFilter, setSelectedIndustryFilter] = useState<string | undefined>(undefined);

  const [availableSubSectors, setAvailableSubSectors] = useState<SubSector[]>([]);
  const [availableIndustries, setAvailableIndustries] = useState<Industry[]>([]);

  // Populate sub-sectors when a sector is selected
  useEffect(() => {
    if (selectedSectorFilter) {
      const sector = detailedSectorsData.find(s => s.code === selectedSectorFilter);
      setAvailableSubSectors(sector?.subSectors || []);
      setSelectedSubSectorFilter(undefined); // Reset sub-sector
      setAvailableIndustries([]); // Reset industries
      setSelectedIndustryFilter(undefined); // Reset industry
    } else {
      setAvailableSubSectors([]);
      setAvailableIndustries([]);
      setSelectedSubSectorFilter(undefined);
      setSelectedIndustryFilter(undefined);
    }
  }, [selectedSectorFilter, detailedSectorsData]);

  // Populate industries when a sub-sector is selected
  useEffect(() => {
    if (selectedSubSectorFilter) {
      const subSector = availableSubSectors.find(ss => ss.code === selectedSubSectorFilter);
      setAvailableIndustries(subSector?.industries || []);
      setSelectedIndustryFilter(undefined); // Reset industry
    } else {
      setAvailableIndustries([]);
      setSelectedIndustryFilter(undefined);
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
    // Sub-sector and industry will be reset by the useEffect hooks above
  }, []);

  const isAnyFilterActive = useMemo(() => {
    return selectedPostType !== "all" || selectedTags.length > 0 || !!selectedSectorFilter;
  }, [selectedPostType, selectedTags, selectedSectorFilter]);

  const filteredPosts = useMemo(() => {
    if (!Array.isArray(posts)) return [];
    let filtered = posts;

    // Filter by Post Type
    if (selectedPostType !== "all") {
      filtered = filtered.filter(post => post.requestType === selectedPostType);
    }

    // Filter by Tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(post =>
        Array.isArray(post.tags) && selectedTags.every(tag => post.tags.includes(tag))
      );
    }

    // Filter by Sector/Sub-Sector/Industry
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

    return filtered.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : (typeof a.createdAt === 'number' ? a.createdAt : (a.createdAt as any)?.toMillis?.() || 0);
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === 'number' ? b.createdAt : (b.createdAt as any)?.toMillis?.() || 0);
      return timeB - timeA;
    });
  }, [posts, selectedPostType, selectedTags, selectedSectorFilter, selectedSubSectorFilter, selectedIndustryFilter, detailedSectorsData, availableSubSectors]);


  if (isLoading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading posts...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Consolidated Filter Bar */}
      <div className="mb-4 p-1 space-y-2 md:space-y-0 md:flex md:items-center md:gap-2 border-b pb-3">
        <Select value={selectedPostType} onValueChange={(value) => setSelectedPostType(value as PostTypeFilter)}>
          <SelectTrigger className="w-full md:w-[180px] h-9 text-xs">
            <SelectValue placeholder="Filter by Post Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs"><LayoutGrid className="h-3.5 w-3.5 mr-1.5 inline-block" />All Posts</SelectItem>
            <SelectItem value="help_request" className="text-xs"><HandHelping className="h-3.5 w-3.5 mr-1.5 inline-block" />Help Requests</SelectItem>
            <SelectItem value="post" className="text-xs"><Briefcase className="h-3.5 w-3.5 mr-1.5 inline-block" />Opportunities</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full md:w-auto h-9 text-xs">
              <Tag className="h-3.5 w-3.5 mr-1.5" />
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <div className="p-3">
              <p className="text-sm font-medium mb-2">Filter by Tags</p>
              <ScrollArea className="h-[150px]">
                <div className="space-y-1.5">
                  {availableTags.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tag-${tag}`}
                        checked={selectedTags.includes(tag)}
                        onCheckedChange={() => handleTagToggle(tag)}
                      />
                      <Label htmlFor={`tag-${tag}`} className="text-xs font-normal">{tag}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="w-full md:w-auto h-9 text-xs">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Industry {selectedSectorFilter && `(${detailedSectorsData.find(s => s.code === selectedSectorFilter)?.name.substring(0,10)}...)`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-3 space-y-2">
              <p className="text-sm font-medium mb-1">Filter by Industry</p>
              <Select value={selectedSectorFilter} onValueChange={setSelectedSectorFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select Sector" /></SelectTrigger>
                <SelectContent>
                  {detailedSectorsData.map(sector => <SelectItem key={sector.code} value={sector.code} className="text-xs">{sector.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedSubSectorFilter} onValueChange={setSelectedSubSectorFilter} disabled={availableSubSectors.length === 0}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={availableSubSectors.length > 0 ? "Select Sub-Sector" : "N/A"} /></SelectTrigger>
                <SelectContent>
                  {availableSubSectors.map(sub => <SelectItem key={sub.code} value={sub.code} className="text-xs">{sub.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={selectedIndustryFilter} onValueChange={setSelectedIndustryFilter} disabled={availableIndustries.length === 0}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={availableIndustries.length > 0 ? "Select Industry" : "N/A"} /></SelectTrigger>
                <SelectContent>
                  {availableIndustries.map(ind => <SelectItem key={ind.code} value={ind.code} className="text-xs">{ind.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>

        {isAnyFilterActive && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full md:w-auto h-9 text-xs text-primary hover:underline">
            <FilterX className="h-3.5 w-3.5 mr-1.5" /> Clear All
          </Button>
        )}
      </div>

      <ScrollArea className="flex-grow overflow-y-auto min-h-0 pr-2"> {/* Added pr-2 for scrollbar */}
        <div className="columns-1 md:columns-2 gap-4 space-y-4">
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                onOpen={onPostSelect}
                isSelected={selectedPostId === post.id}
                isPriority={index < 2} // Prioritize loading first 2 images in the current view
              />
            ))
          ) : (
            <div className="col-span-full text-center py-10">
              <p className="text-muted-foreground">
                {isLoading ? "Loading..." : (isAnyFilterActive ? "No posts found matching your filters." : "No posts available yet.")}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

PostList.displayName = "PostList";

    