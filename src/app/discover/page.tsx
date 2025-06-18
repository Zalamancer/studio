
// src/app/discover/page.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getRecentPlans } from '@/services/planService';
import type { ClientPlan } from '@/types/plan';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Loader2, AlertTriangle, Brain, MapPin, Layers, Users, Filter, FilterX, Tag, PlusCircle, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { detailedSectorsData } from '@/components/layout/MainLayout';

const DiscoverPage = () => {
  const { user } = useAuth(); // Get current user
  const { data: plans, isLoading, error } = useQuery<ClientPlan[], Error>({
    queryKey: ['recentPlans'], // Consider making queryKey more dynamic if filters affect fetching
    queryFn: () => getRecentPlans(24), // Fetch more plans for better filtering results
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]); // Store sector codes
  const [isSectorFilterOpen, setIsSectorFilterOpen] = useState(false);

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
    setIsSectorFilterOpen(false);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim() !== '') count++;
    if (selectedSectors.length > 0) count++;
    return count;
  }, [searchTerm, selectedSectors]);

  const filteredPlans = useMemo(() => {
    if (!Array.isArray(plans)) return [];
    let currentPlans = plans;

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
  }, [plans, selectedSectors, searchTerm]);

  const calculateNodeCounts = (plan: ClientPlan) => {
    const numNodes = plan.roadmap?.length || 0;
    const numChildren = plan.roadmap?.reduce((acc, step) => acc + (step.childrenData?.length || 0), 0) || 0;
    return { numNodes, numChildren };
  };

  return (
    <div className="container mx-auto p-4 md:p-6 min-h-screen">
      <header className="mb-6 pb-4 border-b">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
              <Compass className="mr-3 h-8 w-8 text-primary" />
              Discover Collaboration Plans
            </h1>
            <p className="text-lg text-muted-foreground mt-1">
              Explore recent collaboration plans created by the community.
            </p>
          </div>
          {user && ( // Show Create Plan button only if user is logged in
            <Button asChild size="default" className="w-full sm:w-auto">
              <Link href="/plan/create"><PlusCircle className="mr-2 h-4 w-4" /> Create New Plan</Link>
            </Button>
          )}
        </div>
        
        {/* Filters Section */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex items-center flex-grow w-full sm:w-auto">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search plans by name, description, industry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 h-9 text-xs w-full rounded-md border-input focus:ring-primary focus:border-primary"
              aria-label="Search plans"
            />
          </div>
          <Popover open={isSectorFilterOpen} onOpenChange={setIsSectorFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs w-full sm:w-auto flex-shrink-0">
                <Tag className="mr-1.5 h-3.5 w-3.5" />
                Filter by Sector {selectedSectors.length > 0 && `(${selectedSectors.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="start">
              <div className="p-3 border-b">
                <p className="text-sm font-medium">Filter by Sector</p>
              </div>
              <ScrollArea className="h-48">
                <div className="p-3 space-y-1.5">
                  {availableSectorsForFilter.length > 0 ? (
                    availableSectorsForFilter.map((sector) => (
                      <div key={sector.code} className="flex items-center space-x-2">
                        <Checkbox
                          id={`sector-filter-${sector.code}`}
                          checked={selectedSectors.includes(sector.code)}
                          onCheckedChange={() => handleSectorToggle(sector.code)}
                        />
                        <Label htmlFor={`sector-filter-${sector.code}`} className="text-xs font-normal">
                          {sector.name}
                        </Label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">No sectors available.</p>
                  )}
                </div>
              </ScrollArea>
              {selectedSectors.length > 0 && (
                <div className="p-3 border-t">
                  <Button variant="ghost" size="xs" onClick={() => { setSelectedSectors([]); setIsSectorFilterOpen(false); }} className="w-full text-primary">Clear Sector Filters</Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-9 text-xs text-primary hover:underline w-full sm:w-auto flex-shrink-0">
              <FilterX className="mr-1.5 h-3.5 w-3.5" /> Clear All Filters ({activeFilterCount})
            </Button>
          )}
        </div>
      </header>

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
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
            Try Again
          </Button>
        </div>
      )}

      {!isLoading && !error && filteredPlans && filteredPlans.length === 0 && (
        <div className="text-center py-10">
          <Layers className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground">
            {activeFilterCount > 0 ? "No plans found matching your filters." : "No collaboration plans found yet."}
          </p>
          {activeFilterCount === 0 && user && (
            <Button asChild className="mt-4">
              <Link href="/plan/create">Create the First Plan</Link>
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
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary/70" />
                      Sector:
                    </span>
                    <span className="font-medium text-foreground truncate">{plan.sector || 'N/A'}</span>
                  </div>
                   {plan.industry && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                           <Layers className="h-3.5 w-3.5 text-primary/70" /> 
                            Industry:
                        </span>
                        <span className="font-medium text-foreground truncate">{plan.industry}</span>
                    </div>
                   )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary/70" />
                      Steps:
                    </span>
                    <span className="font-medium text-foreground">{numNodes}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                     <span className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-primary/70 opacity-70" />
                        Child Items:
                     </span>
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
