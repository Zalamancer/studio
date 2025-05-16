
// src/app/discover/[sectorCode]/page.tsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FilterX, Star, Tag, Briefcase, Building, Info, Loader2, AlertTriangle } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Post } from '@/types/post';
import { Timestamp } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { getPostsFromFirestore } from '@/services/postService'; // Import post fetching service
import { detailedSectorsData, type SectorWithSubSectors, type SubSector, type Industry } from '@/components/layout/MainLayout'; // Import sector data from MainLayout

// Helper to find sector data (can be moved to a util if used elsewhere)
const getSectorDataByCode = (code: string): SectorWithSubSectors | null => {
    // Special handling for manufacturing "31-33" which is a range
    if (code === "31-33") {
        return detailedSectorsData.find(s => s.code === "31-33") || null;
    }
    // For other codes, check if they are top-level (e.g., "11")
    const sector = detailedSectorsData.find(s => s.code === code);
    if (sector) return sector;

    // If not found, it might be a sub-sector or industry code,
    // but this page is designed for top-level sectors.
    // For simplicity, we'll only return top-level matches here.
    return null;
};


const SectorDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const sectorCode = params?.sectorCode as string | undefined;

  const [selectedSubSector, setSelectedSubSector] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false); // UI only for now

  const sectorData = useMemo(() => {
    if (!sectorCode) return null;
    return getSectorDataByCode(sectorCode);
  }, [sectorCode]);

  // --- Fetch Posts Dynamically ---
  const {
    data: allPosts = [],
    isLoading: isLoadingPosts,
    error: postsError,
  } = useQuery<Post[]>({
    queryKey: ['allPostsForSectorPage'], // Unique key, might need to be more specific if global
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
  // --- End Fetch Posts ---

  const handleSubSectorSelect = (subSectorCode: string | null) => {
    setSelectedSubSector(current => (current === subSectorCode ? null : subSectorCode));
    setSelectedIndustry(null); // Reset industry when sub-sector changes
  };

  const handleIndustrySelect = (industryCode: string | null) => {
    setSelectedIndustry(current => (current === industryCode ? null : industryCode));
  };

  const clearFilters = () => {
    setSelectedSubSector(null);
    setSelectedIndustry(null);
  };

  const filteredPosts = useMemo(() => {
    if (!sectorData || isLoadingPosts) return [];

    let postsToFilter = allPosts.filter(post => {
        // Primary filter: post's NAICS code must belong to the current main sector
        // A post's naicsCode (e.g., "3111") should start with the main sector code (e.g., "31")
        // For "31-33", we check if it starts with "31", "32", or "33".
        const mainSectorCodeForFilter = sectorData.code;
        const postNaics = post.naicsCode || ""; // Ensure post.naicsCode is a string

        let isInMainSector = false;
        if (mainSectorCodeForFilter === "31-33") {
            isInMainSector = postNaics.startsWith("31") || postNaics.startsWith("32") || postNaics.startsWith("33");
        } else {
            isInMainSector = postNaics.startsWith(mainSectorCodeForFilter);
        }
        return isInMainSector;
    });

    // Secondary filter: by selected industry (most specific)
    if (selectedIndustry) {
      return postsToFilter.filter(post => post.naicsCode === selectedIndustry);
    }

    // Tertiary filter: by selected sub-sector
    if (selectedSubSector) {
      // Show posts directly matching the sub-sector code OR
      // posts whose NAICS code (industry) starts with the sub-sector code.
      return postsToFilter.filter(post =>
        post.naicsCode === selectedSubSector ||
        (post.naicsCode && post.naicsCode.startsWith(selectedSubSector))
      );
    }
    // If no sub-sector or industry filter, return all posts for the main sector
    return postsToFilter;
  }, [sectorData, selectedSubSector, selectedIndustry, allPosts, isLoadingPosts]);


  if (!sectorCode) {
    return (
        <div className="container mx-auto p-8 text-center">
            <p className="text-xl text-muted-foreground">Loading sector information...</p>
            <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </div>
    );
  }

  if (!sectorData) {
    return (
      <div className="container mx-auto p-8">
        <Link href="/discover" className="inline-flex items-center text-primary hover:underline mb-6 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discover
        </Link>
        <Card className="shadow-lg border-border">
            <CardHeader>
                <CardTitle className="text-2xl text-destructive flex items-center gap-2">
                    <Info className="h-6 w-6" /> Sector Not Found
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <p className="text-muted-foreground">
                    Sorry, we couldn't find details for NAICS sector code <strong className="text-foreground">{sectorCode}</strong>.
                 </p>
                 <p className="text-muted-foreground mt-2">
                    It's possible this sector is not yet detailed or the code is incorrect.
                 </p>
                 <Button onClick={() => router.push('/discover')} className="mt-6">
                    Return to Discover Page
                 </Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  // Find the current main sector's data from the imported `detailedSectorsData`
  // This is to ensure we use the most up-to-date structure for sub-sectors and industries
  const currentDisplaySectorData = detailedSectorsData.find(s => s.code === sectorCode);


  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Link href="/discover" className="inline-flex items-center text-primary hover:underline mb-4 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discover
        </Link>
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                {sectorData.name} ({sectorData.code})
                </h1>
                <p className="text-md text-muted-foreground max-w-3xl">{sectorData.description || "Detailed description for this sector is being compiled."}</p>
            </div>
            <Button
                variant={isFavorited ? "default" : "outline"}
                size="sm"
                onClick={() => setIsFavorited(!isFavorited)}
                className="mt-2 ml-4 flex-shrink-0"
                aria-pressed={isFavorited}
            >
                <Star className={cn("h-4 w-4 mr-2", isFavorited && "fill-yellow-400 text-yellow-500")}/>
                {isFavorited ? "Favorited" : "Favorite Sector"}
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Sidebar: Filters */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Filter by Industry</CardTitle>
              <CardDescription>
                {currentDisplaySectorData && currentDisplaySectorData.subSectors && currentDisplaySectorData.subSectors.length > 0
                  ? "Select sub-sectors and industries to narrow down posts."
                  : `No detailed industry filters available for ${sectorData.name}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
                {(selectedSubSector || selectedIndustry) && (
                    <Button onClick={clearFilters} variant="ghost" size="sm" className="mb-3 text-primary w-full justify-start">
                        <FilterX className="h-4 w-4 mr-2" /> Clear All Filters
                    </Button>
                )}
                {currentDisplaySectorData && currentDisplaySectorData.subSectors && currentDisplaySectorData.subSectors.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full space-y-1.5">
                    {currentDisplaySectorData.subSectors.map((subsector) => (
                      <AccordionItem key={subsector.code} value={`subsector-${subsector.code}`}>
                        <AccordionTrigger
                          onClick={() => handleSubSectorSelect(subsector.code)}
                          className={cn(
                            "text-md font-medium hover:no-underline px-3 py-2.5 rounded-md border text-left",
                            selectedSubSector === subsector.code && !selectedIndustry ? "bg-primary/10 text-primary border-primary" : "bg-muted/30 hover:bg-muted/50"
                          )}
                        >
                          {subsector.code}: {subsector.name}
                        </AccordionTrigger>
                        <AccordionContent className="px-1 pt-2 pb-1 border-none">
                          {subsector.industries && subsector.industries.length > 0 && (
                            <Accordion type="single" collapsible className="w-full space-y-1 pl-3 border-l-2 ml-2">
                              {subsector.industries.map((industry) => (
                                <AccordionItem key={industry.code} value={`industry-${industry.code}`} className="border-b-0">
                                  <AccordionTrigger
                                    onClick={() => handleIndustrySelect(industry.code)}
                                    className={cn(
                                      "text-sm font-normal hover:no-underline px-2 py-1.5 rounded-md text-left",
                                      selectedIndustry === industry.code ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted/20"
                                    )}
                                  >
                                    {industry.code}: {industry.name}
                                  </AccordionTrigger>
                                  {/* Optional: Industry Description (can be added if available) */}
                                  {/* <AccordionContent className="px-2 pt-1 pb-0 text-xs text-muted-foreground">
                                    {industry.description}
                                  </AccordionContent> */}
                                </AccordionItem>
                              ))}
                            </Accordion>
                          )}
                           {(!subsector.industries || subsector.industries.length === 0) && (
                                <p className="text-xs text-muted-foreground pl-4 py-1">No specific industries listed for this sub-sector.</p>
                           )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                    <p className="text-sm text-muted-foreground p-4 text-center">Detailed industry filters for this sector will be available soon.</p>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Right Content: Posts */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Posts in {selectedIndustry ? currentDisplaySectorData?.subSectors.flatMap(ss => ss.industries).find(ind => ind.code === selectedIndustry)?.name ?? 'Selected Industry'
                           : selectedSubSector ? currentDisplaySectorData?.subSectors.find(ss => ss.code === selectedSubSector)?.name ?? 'Selected Sub-Sector'
                           : sectorData.name}
              </CardTitle>
              <CardDescription>
                {selectedIndustry ? `Showing posts related to industry NAICS ${selectedIndustry}.`
                : selectedSubSector ? `Showing posts related to sub-sector NAICS ${selectedSubSector}.`
                : `Showing all posts for ${sectorData.name}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPosts ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-3 text-muted-foreground">Loading posts...</p>
                </div>
              ) : postsError ? (
                <div className="text-destructive flex items-center gap-2 text-sm p-4 bg-destructive/5 rounded-md justify-center">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>Error loading posts: {postsError.message}</div>
                </div>
              ) : filteredPosts.length > 0 ? (
                <div className="space-y-4">
                  {filteredPosts.map((post) => (
                    <Card key={post.id} className="shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                             <CardTitle className="text-md font-semibold hover:text-primary cursor-pointer">
                                <Link href={`/?postId=${post.id}`}>{post.question}</Link>
                             </CardTitle>
                             <CardDescription className="text-xs pt-0.5">
                                Posted on: {post.createdAt instanceof Timestamp ? post.createdAt.toDate().toLocaleDateString() : 'Date unavailable'}
                             </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            {post.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{post.description}</p>}
                            <div className="flex flex-wrap gap-1.5">
                                {post.tags.map(tag => <Badge key={`${post.id}-${tag}`} variant="secondary" className="text-xs">{tag}</Badge>)}
                                {post.naicsCode && <Badge variant="outline" className="text-xs"><Tag className="h-3 w-3 mr-1"/>NAICS: {post.naicsCode}</Badge>}
                            </div>
                        </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No posts found matching your current filters for this sector.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SectorDetailPage;

    
