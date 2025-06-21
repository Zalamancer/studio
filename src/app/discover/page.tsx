
// src/app/discover/page.tsx
"use client";

import React, { useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getRecentPlans } from '@/services/planService';
import type { ClientPlan } from '@/types/plan';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, AlertTriangle, MapPin, Layers, FilterX, Tag, PlusCircle, Search, X, ListFilter, Users, LayoutGrid } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { detailedSectorsData } from '@/components/layout/MainLayout';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

const DiscoverPage = () => {
  const { user } = useAuth();
  const { data: plans, isLoading, error } = useQuery<ClientPlan[], Error>({
    queryKey: ['recentPlansDiscoverPage'], // Unique queryKey
    queryFn: () => getRecentPlans(50), // Fetch more plans for better filtering
    staleTime: 1000 * 60 * 5,
  });
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [isSectorFilterOpen, setIsSectorFilterOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isHeaderSearchActive, setIsHeaderSearchActive] = useState(false);
  const headerSearchInputRef = useRef<HTMLInputElement>(null);
  const [activePlanView, setActivePlanView] = useState<'all' | 'my_plans'>('all');

  const availableSectorsForFilter = useMemo(() => {
    return detailedSectorsData.map(sector => ({ code: sector.code, name: sector.name }));
  }, []);

  const handleSectorToggle = useCallback((sectorCode: string) => {
    setSelectedSectors(prev =>
      prev.includes(sectorCode)
        ? prev.filter(code => code !== sectorCode)
        : [...prev, sectorCode]
    );
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedSectors([]);
    setActivePlanView('all'); // Reset view to 'all'
    if (isMobile) {
        setIsFilterDialogOpen(false);
    } else {
        setIsSectorFilterOpen(false);
    }
    if (isHeaderSearchActive) setIsHeaderSearchActive(false); // Close search input if open
  }, [isHeaderSearchActive, isMobile]);


  const toggleHeaderSearch = () => {
    setIsHeaderSearchActive(prev => {
      if (prev) setSearchTerm(''); // Clear search term when hiding input
      else setTimeout(() => headerSearchInputRef.current?.focus(), 0);
      return !prev;
    });
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSectors.length > 0) count++;
    if (activePlanView === 'my_plans') count++;
    // Search term itself is not typically counted in "clearable" filter badges
    return count;
  }, [selectedSectors, activePlanView]);

  const filteredPlans = useMemo(() => {
    if (!Array.isArray(plans)) return [];
    let currentPlans = plans;

    if (activePlanView === 'my_plans' && user) {
      currentPlans = currentPlans.filter(plan => plan.ownerId === user.uid);
    }

    if (selectedSectors.length > 0) {
      const selectedSectorNames = selectedSectors.map(code => {
        const sector = detailedSectorsData.find(s => s.code === code);
        return sector?.name.toLowerCase();
      }).filter(Boolean);

      currentPlans = currentPlans.filter(plan =>
        plan.sector && selectedSectorNames.includes(plan.sector.toLowerCase())
      );
    }

    if (searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      currentPlans = currentPlans.filter(plan =>
        plan.name.toLowerCase().includes(lowerSearchTerm) ||
        (plan.description && plan.description.toLowerCase().includes(lowerSearchTerm)) ||
        (plan.sector && plan.sector.toLowerCase().includes(lowerSearchTerm)) ||
        (plan.subSector && plan.subSector.toLowerCase().includes(lowerSearchTerm)) ||
        (plan.industry && plan.industry.toLowerCase().includes(lowerSearchTerm))
      );
    }
    return currentPlans.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [plans, selectedSectors, searchTerm, activePlanView, user]);

  const calculateNodeCounts = (plan: ClientPlan) => {
    const numNodes = plan.roadmap?.length || 0;
    const numChildren = plan.roadmap?.reduce((acc, step) => acc + (step.childrenData?.length || 0), 0) || 0;
    return { numNodes, numChildren };
  };

  const FilterContent = () => (
    <div className={cn("space-y-4", isMobile ? "p-4" : "p-3 w-72")}>
       <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">View</Label>
            <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                    variant={activePlanView === 'all' ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setActivePlanView('all')}
                    className={cn("h-9 px-3 text-xs rounded-full flex-1", activePlanView === 'all' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
                >
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> All Plans
                </Button>
                {user && (
                    <Button
                        variant={activePlanView === 'my_plans' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActivePlanView('my_plans')}
                        className={cn("h-9 px-3 text-xs rounded-full flex-1", activePlanView === 'my_plans' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
                    >
                        <Users className="mr-1.5 h-3.5 w-3.5" /> My Plans
                    </Button>
                )}
            </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">Filter by Sector {selectedSectors.length > 0 && `(${selectedSectors.length})`}</Label>
        <ScrollArea className="h-48 rounded-md border p-2.5">
          <div className="space-y-1.5">
            {availableSectorsForFilter.length > 0 ? (
              availableSectorsForFilter.map((sector) => (
                <div key={sector.code} className="flex items-center space-x-2">
                  <Checkbox id={`sector-filter-${sector.code}`} checked={selectedSectors.includes(sector.code)} onCheckedChange={() => handleSectorToggle(sector.code)} />
                  <Label htmlFor={`sector-filter-${sector.code}`} className="text-xs font-normal">{sector.name}</Label>
                </div>
              ))
            ) : (<p className="text-xs text-muted-foreground text-center">No sectors available.</p>)}
          </div>
        </ScrollArea>
        {selectedSectors.length > 0 && (
          <div className="pt-2">
            <Button variant="ghost" size="xs" onClick={() => setSelectedSectors([])} className="w-full text-primary">Clear Sector Filters</Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6 min-h-screen">

      {/* Sticky Filter Bar */}
      <div className="mb-6 flex items-center gap-2 sticky top-[56px] z-40 bg-background py-3 border-b -mx-4 md:mx-0 px-4">
        <Button variant="ghost" size="icon" onClick={toggleHeaderSearch} className="flex-shrink-0 h-9 w-9 p-2">
          {isHeaderSearchActive ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>

        {isHeaderSearchActive ? (
          <Input
            ref={headerSearchInputRef}
            type="search"
            placeholder="Search plans by name, description, industry..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 text-xs flex-grow"
          />
        ) : (
          <>
            {isMobile ? (
                 <div className="flex w-full items-center gap-2">
                    <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
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
                              <DialogTitle>Filter Plans</DialogTitle>
                              <DialogDescription>Refine plans by type or sector.</DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="flex-grow min-h-0"><FilterContent /></ScrollArea>
                          <DialogFooter className="p-4 border-t flex flex-row items-center justify-between">
                            {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-primary">Clear All</Button>}
                            <DialogClose asChild>
                              <Button type="button" variant="default" size="sm">Done</Button>
                            </DialogClose>
                          </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    {user && (
                      <Button asChild size="sm" className="text-xs flex-1 h-9">
                        <Link href="/plan/create"><PlusCircle className="h-4 w-4 mr-1.5" />Create Plan</Link>
                      </Button>
                    )}
                 </div>
            ) : (
                <>
                    <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                        variant={activePlanView === 'all' ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setActivePlanView('all')}
                        className={cn("h-9 px-3 text-xs rounded-full", activePlanView === 'all' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
                    >
                        <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> All Plans
                    </Button>
                    {user && (
                        <Button
                            variant={activePlanView === 'my_plans' ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setActivePlanView('my_plans')}
                            className={cn("h-9 px-3 text-xs rounded-full", activePlanView === 'my_plans' && "font-semibold bg-primary/10 text-primary border border-primary/30")}
                        >
                            <Users className="mr-1.5 h-3.5 w-3.5" /> My Plans
                        </Button>
                    )}
                    </div>

                    <div className="flex-grow"></div> {/* Spacer */}

                    <div className="flex items-center gap-2 flex-shrink-0">
                    <Popover open={isSectorFilterOpen} onOpenChange={setIsSectorFilterOpen}>
                        <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 text-xs">
                            <Tag className="mr-1.5 h-3.5 w-3.5" />
                            Filter by Sector {selectedSectors.length > 0 && `(${selectedSectors.length})`}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="end"><FilterContent /></PopoverContent>
                    </Popover>

                    {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-xs text-primary hover:underline">
                        <FilterX className="mr-1.5 h-3.5 w-3.5" /> Clear All ({activeFilterCount})
                        </Button>
                    )}
                    </div>

                    {user && (
                    <Button asChild size="sm" className="ml-2 h-9 px-3 text-xs flex-shrink-0">
                        <Link href="/plan/create"><PlusCircle className="mr-2 h-4 w-4" /> Create Plan</Link>
                    </Button>
                    )}
                </>
            )}
          </>
        )}
      </div>


      {isLoading && (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading plans...</p>
        </div>
      )}

      {error && (
        <div className="text-destructive flex flex-col items-center gap-2 text-sm p-6 bg-destructive/5 rounded-md justify-center border border-destructive/20">
          <AlertTriangle className="h-8 w-8 flex-shrink-0" />
          <p className="font-semibold">Error Loading Plans</p>
          <p>{error.message || "An unexpected error occurred."}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">Try Again</Button>
        </div>
      )}

      {!isLoading && !error && filteredPlans && filteredPlans.length === 0 && (
        <div className="text-center py-10">
          <Layers className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground">
            {searchTerm && !isHeaderSearchActive ? `No plans found for "${searchTerm}".` : // if search was active but now closed
             isHeaderSearchActive && searchTerm ? `No plans found for "${searchTerm}".` : // if search is active and has term
             activeFilterCount > 0 ? "No plans found matching your filters." :
             activePlanView === 'my_plans' ? "You haven't created any plans yet." :
             "No collaboration plans found yet."
            }
          </p>
          {activeFilterCount === 0 && activePlanView === 'all' && !searchTerm && user && (
            <Button asChild className="mt-4">
              <Link href="/plan/create">Create the First Plan</Link>
            </Button>
          )}
           {activeFilterCount === 0 && activePlanView === 'my_plans' && !searchTerm && user && (
            <Button asChild className="mt-4">
              <Link href="/plan/create">Create Your First Plan</Link>
            </Button>
          )}
        </div>
      )}

      {!isLoading && !error && filteredPlans && filteredPlans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => {
            const { numNodes, numChildren } = calculateNodeCounts(plan);
            return (
              <Card key={plan.id} className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200 rounded-lg border-border">
                <CardHeader className="pb-3">
                  <Link href={`/plan/${plan.id}`} className="group">
                    <CardTitle className="text-lg font-semibold text-primary group-hover:underline line-clamp-2">
                      {plan.name}
                    </CardTitle>
                  </Link>
                  {plan.description && (
                    <CardDescription className="text-xs text-muted-foreground line-clamp-2 h-8">
                      {plan.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-grow space-y-2 text-sm pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary/70" />Sector:</span>
                    <span className="font-medium text-foreground truncate">{plan.sector || 'N/A'}</span>
                  </div>
                   {plan.industry && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-primary/70" />Industry:</span>
                        <span className="font-medium text-foreground truncate">{plan.industry}</span>
                    </div>
                   )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-primary/70" />Steps:</span>
                    <span className="font-medium text-foreground">{numNodes}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                     <span className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5 text-primary/70 opacity-70" />Child Items:</span>
                    <span className="font-medium text-foreground">{numChildren}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between items-center pt-3 border-t mt-auto">
                  <p className="text-xs text-muted-foreground">
                    Created: {formatDistanceToNow(new Date(plan.createdAt), { addSuffix: true })}
                  </p>
                  <Link
                    href={`/plan/${plan.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }), "h-7 px-2 text-xs")}
                  >
                    View Plan
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;

    