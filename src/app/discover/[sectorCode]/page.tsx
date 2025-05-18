
// src/app/discover/[sectorCode]/page.tsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FilterX, Star, Loader2, AlertTriangle, Info, Eye, Tag } from 'lucide-react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPostsFromFirestore } from '@/services/postService';
import { detailedSectorsData, type SectorWithSubSectors, type SubSector, type Industry } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { getUserFavoriteSectors, addFavoriteSector, removeFavoriteSector } from '@/services/userPreferenceService';
import { useToast } from '@/hooks/use-toast';
import Whiteboard from '@/components/whiteboard/Whiteboard';
// DocumentEditorPlaceholder is now rendered within Whiteboard.tsx when a user shape is clicked
// So, it's no longer directly imported or used here.
// import DocumentEditorPlaceholder from '@/components/document-editor/DocumentEditor';

export interface FocusNodeDetails {
  code: string;
  type: 'sector' | 'subsector' | 'industry';
  name: string;
}

const getSectorDataByCode = (code: string): SectorWithSubSectors | null => {
    if (!code) return null;
    const sector = detailedSectorsData.find(s => s.code === code);
    console.log(`[SectorDetailPage] getSectorDataByCode for '${code}': Found:`, !!sector, sector);
    return sector || null;
};


const SectorDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const sectorCode = params?.sectorCode as string | undefined;

  const [selectedSubSector, setSelectedSubSector] = useState<string | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  
  const currentSectorData = useMemo(() => {
    if (!sectorCode) return null;
    return getSectorDataByCode(sectorCode);
  }, [sectorCode]);

  const [focusNodeDetails, setFocusNodeDetails] = useState<FocusNodeDetails | null>(null);

  useEffect(() => {
    if (currentSectorData) {
      console.log(`[SectorDetailPage] Main sector data changed or loaded. Setting initial focus to: ${currentSectorData.name} (${currentSectorData.code})`);
      setFocusNodeDetails({
        code: currentSectorData.code,
        type: 'sector',
        name: currentSectorData.name,
      });
      setSelectedSubSector(null); // Reset filters when main sector changes
      setSelectedIndustry(null);
    } else {
      console.log(`[SectorDetailPage] currentSectorData is null/undefined. Current sectorCode param: ${sectorCode}`);
      setFocusNodeDetails(null); // Clear focus if sector data is not found
    }
  }, [currentSectorData]);


  const { data: favoriteSectorCodes = [], isLoading: isLoadingFavorites } = useQuery<string[]>({
    queryKey: ['userFavoriteSectors', user?.uid],
    queryFn: () => user ? getUserFavoriteSectors(user.uid) : Promise.resolve([]),
    enabled: !!user,
  });

  const isFavorited = useMemo(() => {
    if (!currentSectorData || !currentSectorData.code) return false;
    return favoriteSectorCodes.includes(currentSectorData.code);
  }, [favoriteSectorCodes, currentSectorData]);

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !currentSectorData || !currentSectorData.code) {
        throw new Error("User not authenticated or sector data missing.");
      }
      if (isFavorited) {
        await removeFavoriteSector(user.uid, currentSectorData.code);
        toast({ title: "Sector Unfavorited", description: `${currentSectorData.name} removed from your favorites.` });
      } else {
        await addFavoriteSector(user.uid, currentSectorData.code);
        toast({ title: "Sector Favorited!", description: `${currentSectorData.name} added to your favorites.` });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userFavoriteSectors', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['userFavoriteSectorsOnDiscoverPage', user?.uid] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error Updating Favorite", description: error.message });
    },
  });

  const handleToggleFavorite = () => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please log in to favorite sectors." });
      return;
    }
    if (!currentSectorData || !currentSectorData.code) return;
    toggleFavoriteMutation.mutate();
  };

  const {
    data: allPosts = [],
    isLoading: isLoadingPosts,
    error: postsError,
  } = useQuery<Post[]>({
    queryKey: ['allPostsForSectorPage', sectorCode], 
    queryFn: getPostsFromFirestore,
    staleTime: 1000 * 60 * 2, 
    enabled: !!sectorCode, 
  });

  const handleSubSectorSelect = (subSectorCode: string | null) => {
    const newSubSectorCode = selectedSubSector === subSectorCode ? null : subSectorCode;
    setSelectedSubSector(newSubSectorCode);
    setSelectedIndustry(null); 
    
    if (newSubSectorCode && currentSectorData) {
      const sub = currentSectorData.subSectors.find(s => s.code === newSubSectorCode);
      if (sub) {
        setFocusNodeDetails({ code: sub.code, type: 'subsector', name: sub.name });
      }
    } else if (currentSectorData) { 
      setFocusNodeDetails({ code: currentSectorData.code, type: 'sector', name: currentSectorData.name });
    }
  };
  
  const handleIndustrySelect = (industryCode: string | null) => {
    const newIndustryCode = selectedIndustry === industryCode ? null : industryCode;
    setSelectedIndustry(newIndustryCode);

    if (newIndustryCode && currentSectorData && selectedSubSector) {
        const sub = currentSectorData.subSectors.find(s => s.code === selectedSubSector);
        const ind = sub?.industries.find(i => i.code === newIndustryCode);
        if (ind) {
            setFocusNodeDetails({ code: ind.code, type: 'industry', name: ind.name });
        }
    } else if (selectedSubSector && currentSectorData) { 
        const sub = currentSectorData.subSectors.find(s => s.code === selectedSubSector);
        if (sub) {
            setFocusNodeDetails({ code: sub.code, type: 'subsector', name: sub.name });
        }
    } else if (currentSectorData) { 
        setFocusNodeDetails({ code: currentSectorData.code, type: 'sector', name: currentSectorData.name });
    }
  };

  const clearFilters = () => {
    setSelectedSubSector(null);
    setSelectedIndustry(null);
    if (currentSectorData) {
      setFocusNodeDetails({ code: currentSectorData.code, type: 'sector', name: currentSectorData.name });
    }
  };

  const handleWhiteboardNodeClick = useCallback((clickedNodeInfo: { code: string; type: 'sector' | 'subsector' | 'industry'; text: string }) => {
    console.log(`[SectorDetailPage] Whiteboard node clicked. Raw text from WB: "${clickedNodeInfo.text}", Code: ${clickedNodeInfo.code}, Type: ${clickedNodeInfo.type}`);
    
    let nodeNameForFocus = clickedNodeInfo.text; 
    let nodeTypeForFocus = clickedNodeInfo.type;

    if (currentSectorData) {
        if (nodeTypeForFocus === 'sector' && currentSectorData.code === clickedNodeInfo.code) {
            nodeNameForFocus = currentSectorData.name;
        } else if (nodeTypeForFocus === 'subsector') {
            const sub = currentSectorData.subSectors.find(s => s.code === clickedNodeInfo.code);
            if (sub) nodeNameForFocus = sub.name;
        } else if (nodeTypeForFocus === 'industry') {
            let foundIndustry = null;
            for (const sub of currentSectorData.subSectors) {
                const industry = sub.industries.find(ind => ind.code === clickedNodeInfo.code);
                if (industry) {
                    foundIndustry = industry;
                    break;
                }
            }
            if (foundIndustry) nodeNameForFocus = foundIndustry.name;
        }
    }
    
    console.log(`[SectorDetailPage] Setting focusNodeDetails from Whiteboard click. Name: "${nodeNameForFocus}", Code: ${clickedNodeInfo.code}, Type: ${nodeTypeForFocus}`);
    setFocusNodeDetails({ code: clickedNodeInfo.code, type: nodeTypeForFocus, name: nodeNameForFocus });

    if (nodeTypeForFocus === 'sector') {
        setSelectedSubSector(null);
        setSelectedIndustry(null);
        toast({ title: "Filter Applied", description: `Showing all for ${nodeNameForFocus}` });
    } else if (nodeTypeForFocus === 'subsector') {
        setSelectedSubSector(clickedNodeInfo.code);
        setSelectedIndustry(null);
        toast({ title: "Filter Applied", description: `Showing posts for sub-sector: ${nodeNameForFocus}` });
    } else if (nodeTypeForFocus === 'industry') {
        const parentSubSector = currentSectorData?.subSectors.find(ss => ss.industries.some(ind => ind.code === clickedNodeInfo.code));
        const parentSubSectorCode = parentSubSector?.code || null;
        
        if (parentSubSectorCode) {
            setSelectedSubSector(parentSubSectorCode);
        }
        setSelectedIndustry(clickedNodeInfo.code);
        toast({ title: "Filter Applied", description: `Showing posts for industry: ${nodeNameForFocus}` });
    }
  }, [currentSectorData, toast, setSelectedSubSector, setSelectedIndustry]);


  const handleResetWhiteboardFocus = () => {
    if (currentSectorData) {
      console.log("[SectorDetailPage] Resetting whiteboard focus to main sector:", currentSectorData.name);
      setFocusNodeDetails({
        code: currentSectorData.code,
        type: 'sector',
        name: currentSectorData.name,
      });
      toast({ title: "Whiteboard View Reset", description: `Showing full map for ${currentSectorData.name}` });
    }
  };


  const filteredPosts = useMemo(() => {
    if (isLoadingPosts || !currentSectorData) return [];
    if (!Array.isArray(allPosts)) return [];

    let postsToFilter = allPosts.filter(post => {
        const mainSectorCodeForFilter = currentSectorData.code;
        const postNaics = post.naicsCode || "";
        
        let isInMainSector = false;
        if (mainSectorCodeForFilter === "31-33") { 
            isInMainSector = postNaics.startsWith("31") || postNaics.startsWith("32") || postNaics.startsWith("33");
        } else {
            isInMainSector = postNaics.startsWith(mainSectorCodeForFilter);
        }
        return isInMainSector;
    });

    if (selectedIndustry) {
      return postsToFilter.filter(post => post.naicsCode === selectedIndustry);
    }
    if (selectedSubSector) {
      return postsToFilter.filter(post =>
        post.naicsCode === selectedSubSector || 
        (post.naicsCode && currentSectorData.subSectors
          .find(ss => ss.code === selectedSubSector)
          ?.industries.some(ind => ind.code === post.naicsCode))
      );
    }
    return postsToFilter;
  }, [currentSectorData, selectedSubSector, selectedIndustry, allPosts, isLoadingPosts]);


  if (!sectorCode) {
    return (
        <div className="container mx-auto p-8 text-center">
            <p className="text-xl text-muted-foreground">Loading sector information...</p>
            <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </div>
    );
  }

  if (!currentSectorData) {
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

  const pageTitle = focusNodeDetails?.name || currentSectorData.name;
  const pageCode = focusNodeDetails?.code || currentSectorData.code;

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="mb-6">
        <Link href="/discover" className="inline-flex items-center text-primary hover:underline mb-4 text-sm">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Discover
        </Link>
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
                    {currentSectorData.name} 
                    <span className="text-2xl text-muted-foreground ml-2">({currentSectorData.code})</span>
                </h1>
                <p className="text-md text-muted-foreground max-w-3xl">{currentSectorData.description || "Detailed description for this sector is being compiled."}</p>
            </div>
             <div className="flex flex-col items-end gap-2 ml-4 flex-shrink-0">
                <Button
                    variant={isFavorited ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleFavorite}
                    className="w-full"
                    disabled={!user || isLoadingFavorites || toggleFavoriteMutation.isPending}
                    aria-pressed={isFavorited}
                >
                    {isLoadingFavorites || toggleFavoriteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                    ) : (
                        <Star className={cn("h-4 w-4 mr-2", isFavorited && "fill-yellow-400 text-yellow-500")}/>
                    )}
                    {isFavorited ? "Favorited" : "Favorite Sector"}
                </Button>
                {focusNodeDetails && currentSectorData && focusNodeDetails.code !== currentSectorData.code && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetWhiteboardFocus}
                        className="w-full text-xs"
                    >
                        <Eye className="h-3 w-3 mr-1.5" /> View Full Sector Map
                    </Button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Filter by Industry</CardTitle>
              <CardDescription>
                {currentSectorData?.subSectors?.length > 0
                  ? "Select sub-sectors and industries to narrow down posts."
                  : `No detailed industry filters available for ${currentSectorData.name}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
                {(selectedSubSector || selectedIndustry) && (
                    <Button onClick={clearFilters} variant="ghost" size="sm" className="mb-3 text-primary w-full justify-start">
                        <FilterX className="h-4 w-4 mr-2" /> Clear All Filters
                    </Button>
                )}
                {currentSectorData?.subSectors?.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full space-y-1.5" value={selectedSubSector ? `subsector-${selectedSubSector}` : undefined}>
                    {currentSectorData.subSectors.map((subsector) => (
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
                          {subsector.industries?.length > 0 && (
                            <Accordion type="single" collapsible className="w-full space-y-1 pl-3 border-l-2 ml-2" value={selectedIndustry ? `industry-${selectedIndustry}` : undefined}>
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

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Posts in {focusNodeDetails?.name || currentSectorData.name}
              </CardTitle>
              <CardDescription>
                {selectedIndustry && currentSectorData.subSectors.flatMap(ss => ss.industries).find(ind => ind.code === selectedIndustry)
                    ? `Showing posts related to industry: ${currentSectorData.subSectors.flatMap(ss => ss.industries).find(ind => ind.code === selectedIndustry)?.name} (${selectedIndustry})`
                    : selectedSubSector && currentSectorData.subSectors.find(ss => ss.code === selectedSubSector)
                    ? `Showing posts related to sub-sector: ${currentSectorData.subSectors.find(ss => ss.code === selectedSubSector)?.name} (${selectedSubSector})`
                    : `Showing all posts for ${currentSectorData.name}`
                }
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

          <Whiteboard
            sectorData={currentSectorData} // Pass the main sector data
            focusNodeDetails={focusNodeDetails} // Pass the current focus for the whiteboard
            onNodeClick={handleWhiteboardNodeClick}
          />
          
          {/* DocumentEditorPlaceholder is now rendered by Whiteboard.tsx conditionally */}
        </div>
      </div>
    </div>
  );
};

export default SectorDetailPage;

    