
// src/app/plan/create/page.tsx
"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CreatePlanForm, type CreatePlanFormData } from '@/components/plan/CreatePlanForm';
import { createPlan } from '@/services/planService';
import type { NewPlanData } from '@/types/plan';
import { detailedSectorsData } from '@/components/layout/MainLayout'; // Re-use sector data
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const CreatePlanPage = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (formData: CreatePlanFormData) => {
    if (!user) {
      toast({ variant: "destructive", title: "Authentication Required", description: "You must be logged in to create a plan." });
      return;
    }
    setIsSubmitting(true);

    const mainSectorDetails = detailedSectorsData.find(s => s.code === formData.sector);
    const subSectorDetails = mainSectorDetails?.subSectors.find(ss => ss.code === formData.subSector);
    const industryDetails = subSectorDetails?.industries.find(ind => ind.code === formData.industry);

    const newPlanData: NewPlanData = {
      name: formData.name,
      ownerId: user.uid,
      sector: mainSectorDetails?.name || formData.sector, // Store name
      subSector: subSectorDetails?.name || null,
      industry: industryDetails?.name || null,
      naicsCode: formData.industry || formData.subSector || formData.sector, // Store most specific code
    };

    try {
      const planId = await createPlan(newPlanData);
      toast({ title: "Plan Created!", description: `"${formData.name}" has been successfully created.` });
      router.push(`/plan/${planId}`);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to Create Plan", description: error.message || "An unexpected error occurred." });
      setIsSubmitting(false);
    }
    // setIsSubmitting will be false on success due to navigation, or in catch block
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-4 md:p-8 text-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need to be logged in to create a collaboration plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/login')}>Log In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Create New Collaboration Plan</CardTitle>
          <CardDescription>Define a new space for focused collaboration and planning.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreatePlanForm
            onSubmit={handleSubmit}
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
