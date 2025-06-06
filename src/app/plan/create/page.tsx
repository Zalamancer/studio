
// src/app/plan/create/page.tsx
"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { CreatePlanForm, type CreatePlanFormData } from '@/components/plan/CreatePlanForm';
import { createPlan } from '@/services/planService';
import type { NewPlanData } from '@/types/plan';
import { detailedSectorsData } from '@/components/layout/MainLayout'; // Import from MainLayout

const CreatePlanPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreatePlanSubmit = async (formData: CreatePlanFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please log in to create a plan." });
      return;
    }
    setIsSubmitting(true);
    try {
      const sectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
      const subSectorDetails = sectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
      const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

      const newPlanData: NewPlanData = {
        name: formData.name,
        ownerId: user.uid,
        sector: sectorDetails?.name || formData.sector, // Store name
        subSector: subSectorDetails?.name || null,     // Store name
        industry: industryDetails?.name || null,       // Store name
        naicsCode: formData.industry || formData.subSector || formData.sector, // Store most specific code
        roadmap: [], // Initialize with an empty roadmap
      };
      
      const planId = await createPlan(newPlanData);
      toast({ title: "Plan Created!", description: `Your new plan "${formData.name}" has been created.` });
      router.push(`/plan/${planId}`); // Navigate to the new plan's detail page
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to Create Plan", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-10rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="text-muted-foreground">Please log in to create a collaboration plan.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="max-w-2xl mx-auto shadow-lg border-border">
        <CardHeader>
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">Create New Collaboration Plan</CardTitle>
          <CardDescription className="text-muted-foreground">
            Define the objectives and structure for your new collaborative project.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePlanForm
            onSubmit={handleCreatePlanSubmit}
            detailedSectorsData={detailedSectorsData}
            isSubmitting={isSubmitting}
            currentUserId={user.uid}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CreatePlanPage;
