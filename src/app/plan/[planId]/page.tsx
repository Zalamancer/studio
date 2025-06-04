
// src/app/plan/[planId]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getPlanById } from '@/services/planService';
import type { ClientPlan, RoadmapStep, RoadmapSubStep } from '@/types/plan'; // Ensure Roadmap types are imported
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertTriangle, Brain, Share2, Presentation, MessageSquare, Plus, Undo, Redo, Layers, Minus, HelpCircle, User, MapPin, MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateAnonymousName, getInitials } from '@/lib/pseudonymUtils';
import Link from 'next/link';
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label'; // Already imported from previous steps
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AddRoadmapStepDialog, type AddRoadmapStepFormData } from '@/components/plan/AddRoadmapStepDialog'; // Assuming path
import { useToast } from '@/hooks/use-toast';

// New interface for the card component props
interface RoadmapStepCardProps {
  step: RoadmapStep;
  onAddSubStep: (parentId: string, parentTitle: string) => void;
  onSelectStep: (stepId: string) => void;
  onAddNewMainStepAfter: (currentStepId: string) => void;
  isSelected: boolean;
  isSubmitting: boolean;
}

// New dedicated component for rendering a main roadmap step card
const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  onAddSubStep,
  onSelectStep,
  onAddNewMainStepAfter,
  isSelected,
  isSubmitting,
}) => {
  return (
    <Card
      className={cn(
        "bg-card border rounded-lg shadow-md w-full sm:w-72 md:w-80 mb-3 cursor-pointer hover:shadow-lg",
        isSelected && "ring-2 ring-primary shadow-primary/30"
      )}
      onClick={() => onSelectStep(step.id)}
    >
      <CardHeader className="p-3">
        <CardTitle className="text-sm font-semibold">{step.title}</CardTitle>
        {step.type && <CardDescription className="text-xs">{step.type}</CardDescription>}
      </CardHeader>
      {step.subSteps && step.subSteps.length > 0 && (
        <CardContent className="p-3 pt-0 border-t">
          <p className="text-xs font-medium mb-1 text-muted-foreground">Sub-steps:</p>
          <ul className="list-disc list-inside pl-1 space-y-0.5">
            {step.subSteps.map((subStep) => (
              <li key={subStep.id} className="text-xs text-muted-foreground">
                {subStep.title} ({subStep.type})
              </li>
            ))}
          </ul>
        </CardContent>
      )}
      <CardFooter className="p-2 border-t flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-1.5">
        <Button
          variant="outline"
          size="xs"
          onClick={(e) => { e.stopPropagation(); onAddSubStep(step.id, step.title); }}
          disabled={isSubmitting}
          className="text-xs w-full sm:w-auto"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Sub-step
        </Button>
        {isSelected && (
          <Button
            variant="outline"
            size="xs"
            onClick={(e) => { e.stopPropagation(); onAddNewMainStepAfter(step.id); }}
            disabled={isSubmitting}
            className="text-xs w-full sm:w-auto"
          >
            <Plus className="h-3 w-3 mr-1" /> Add Next Main Step
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};


const ViewPlanPage = () => {
  const paramsFromHook = useParams();
  const params = paramsFromHook;
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const planId = params?.planId as string | undefined;

  const [roadmapSteps, setRoadmapSteps] = useState<RoadmapStep[]>([]);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [currentParentStepForDialog, setCurrentParentStepForDialog] = useState<{ id: string; title: string } | null>(null);
  const [isAddingMainStepAfter, setIsAddingMainStepAfter] = useState<string | null>(null);
  const [isSubmittingStep, setIsSubmittingStep] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);


  const isPlanIdValidUid = React.useMemo(() => {
    if (!planId) return false;
    return IS_VALID_FIREBASE_UID_REGEX.test(planId) || planId.length === 20;
  }, [planId]);

  const { data: plan, isLoading, error } = useQuery<ClientPlan | null, Error>({
    queryKey: ['plan', planId],
    queryFn: async () => {
      if (!planId || !isPlanIdValidUid) {
        return null;
      }
      return getPlanById(planId);
    },
    enabled: !!planId && isPlanIdValidUid && !authLoading,
  });

  const openAddStepDialog = useCallback((parentId: string | null = null, parentTitle: string | null = null, addAfterStepId: string | null = null) => {
    if (parentId && parentTitle) {
      setCurrentParentStepForDialog({ id: parentId, title: parentTitle });
      setIsAddingMainStepAfter(null);
    } else {
      setCurrentParentStepForDialog(null);
      setIsAddingMainStepAfter(addAfterStepId);
    }
    setIsAddStepDialogOpen(true);
  }, []);
  
  const handleSelectStep = (stepId: string) => {
    setSelectedStepId(prevId => (prevId === stepId ? null : stepId));
  };

  const handleAddRoadmapStepSubmit = useCallback((data: AddRoadmapStepFormData) => {
    setIsSubmittingStep(true);
    const newStepBase = {
      id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: data.title,
      type: data.type,
    };

    setRoadmapSteps(prevSteps => {
      if (currentParentStepForDialog) {
        return prevSteps.map(step =>
          step.id === currentParentStepForDialog.id
            ? { ...step, subSteps: [...(step.subSteps || []), { ...newStepBase, parentId: step.id }] }
            : step
        );
      } else if (isAddingMainStepAfter) {
        const newMainStep: RoadmapStep = { ...newStepBase, subSteps: [] };
        const index = prevSteps.findIndex(step => step.id === isAddingMainStepAfter);
        if (index !== -1) {
          const stepsCopy = [...prevSteps];
          stepsCopy.splice(index + 1, 0, newMainStep);
          return stepsCopy;
        }
        return [...prevSteps, newMainStep];
      } else {
        return [...prevSteps, { ...newStepBase, subSteps: [] }];
      }
    });

    toast({ title: "Step Added", description: `"${data.title}" added to the roadmap.` });
    setIsAddStepDialogOpen(false);
    setCurrentParentStepForDialog(null);
    setIsAddingMainStepAfter(null);
    setIsSubmittingStep(false);
  }, [currentParentStepForDialog, isAddingMainStepAfter, toast]);


  if (authLoading || (isLoading && isPlanIdValidUid)) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!planId || !isPlanIdValidUid) {
     return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h1 className="text-xl font-semibold">Invalid Plan ID</h1>
        <p className="text-muted-foreground">The plan identifier in the URL is not valid.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive mb-2" />
        <h1 className="text-xl font-semibold">Error Loading Plan</h1>
        <p className="text-muted-foreground">{error.message || "Could not load the collaboration plan."}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[calc(100vh-8rem)] p-4 text-center">
        <Brain className="h-10 w-10 text-muted-foreground mb-2" />
        <h1 className="text-xl font-semibold">Plan Not Found</h1>
        <p className="text-muted-foreground">The collaboration plan does not exist or you may not have permission.</p>
        <Button onClick={() => router.push('/')} className="mt-4">Go to Homepage</Button>
      </div>
    );
  }

  const isOwner = currentUser?.uid === plan.ownerId;
  const ownerDisplayName = generateAnonymousName(plan.ownerId);
  const toolbarIcons = [ MousePointer2, LayoutGrid, StickyNote, Type, Share, PenTool, Square, Frame, Plus, Undo, Redo ];
  
  const dialogTitle = currentParentStepForDialog
    ? `Add Sub-step to "${currentParentStepForDialog.title}"`
    : isAddingMainStepAfter
    ? `Add New Main Step After Selected`
    : "Add New Main Roadmap Step";


  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
      <header className="h-12 flex-shrink-0 bg-card border-b border-border flex items-center px-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Link href="/discover" className="p-1 rounded hover:bg-muted">
             <Brain className="h-6 w-6 text-primary" />
          </Link>
          <div className="h-5 w-px bg-border"></div>
          <h1 className="text-sm font-semibold text-foreground truncate" title={plan.name}>
            {plan.name}
          </h1>
           {isOwner && <Badge variant="outline" className="text-xs ml-2 hidden sm:inline-flex">Owner</Badge>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8"><MessageSquare className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8"><Presentation className="h-4 w-4" /></Button>
          <Button variant="default" size="sm" className="h-8">
            <Share2 className="h-4 w-4 mr-1.5 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          {currentUser && (
            <Avatar className="h-7 w-7">
              <AvatarImage src={currentUser.photoURL || undefined} alt={currentUser.displayName || 'User'} />
              <AvatarFallback className="text-xs">{getInitials(currentUser.displayName || currentUser.email || 'U')}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-12 sm:w-14 bg-card border-r border-border flex flex-col items-center py-3 space-y-1 flex-shrink-0 shadow-sm">
          {toolbarIcons.slice(0,8).map((Icon, index) => (
            <Button key={index} variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-primary hover:bg-primary/10">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          ))}
          <div className="flex-grow"></div>
           {toolbarIcons.slice(8).map((Icon, index) => (
            <Button key={`bottom-${index}`} variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-primary hover:bg-primary/10">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          ))}
        </aside>

        <main className="flex-1 grid-background relative overflow-auto p-4 md:p-6">
          <div className="mb-4">
            <Button
              variant="outline"
              onClick={() => openAddStepDialog(null, null, null)}
              disabled={isSubmittingStep || isAddStepDialogOpen}
              className="shadow-md"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Main Roadmap Step
            </Button>
          </div>

          {roadmapSteps.length === 0 && (
            <div className="flex flex-col items-center justify-center text-muted-foreground h-40 bg-card/50 rounded-lg border-2 border-dashed p-6">
              <StickyNote className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium">No roadmap steps yet.</p>
              <p className="text-xs">Click "Add Main Roadmap Step" to begin.</p>
            </div>
          )}

          <div className="flex flex-wrap items-start gap-4">
            {roadmapSteps.map(step => (
              <RoadmapStepCard
                key={step.id}
                step={step}
                onAddSubStep={openAddStepDialog}
                onSelectStep={handleSelectStep}
                onAddNewMainStepAfter={(currentId) => openAddStepDialog(null, null, currentId)}
                isSelected={selectedStepId === step.id}
                isSubmitting={isSubmittingStep || isAddStepDialogOpen}
              />
            ))}
          </div>
          
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-lg shadow-md flex items-center p-0.5 space-x-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7"><Layers className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Minus className="h-4 w-4" /></Button>
            <span className="text-xs px-2 text-muted-foreground">100%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7"><HelpCircle className="h-4 w-4" /></Button>
          </div>
        </main>
      </div>
      
      {planId && (
        <AddRoadmapStepDialog
          isOpen={isAddStepDialogOpen}
          onOpenChange={setIsAddStepDialogOpen}
          onSubmit={handleAddRoadmapStepSubmit}
          isSubmitting={isSubmittingStep}
          parentStepTitle={currentParentStepForDialog?.title}
          isSubStep={!!currentParentStepForDialog}
          dialogTitle={dialogTitle}
        />
      )}
    </div>
  );
};

export default ViewPlanPage;
    