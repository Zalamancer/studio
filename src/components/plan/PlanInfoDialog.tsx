// src/components/plan/PlanInfoDialog.tsx
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import type { ClientPlan } from '@/types/plan';
import type { UserProfileBasic } from '@/types/connection';
import { generateAnonymousName } from '@/lib/pseudonymUtils';
import { X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PlanInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  planData: ClientPlan | null;
  ownerProfile: UserProfileBasic | null;
}

export const PlanInfoDialog: React.FC<PlanInfoDialogProps> = ({
  isOpen,
  onOpenChange,
  planData,
  ownerProfile,
}) => {
  if (!planData) return null;

  const renderStaticSetting = (label: string, value: string | undefined | null) => {
    let displayValue = value || 'Not set';
    if (label === 'Visibility') {
        switch (value) {
            case 'private': displayValue = 'Private (Owner only)'; break;
            case 'unlisted': displayValue = 'Unlisted (With link)'; break;
            case 'public': displayValue = 'Public (Discoverable)'; break;
        }
    } else if (label === 'Editability') {
        switch (value) {
            case 'owner_only': displayValue = 'Owner Only'; break;
            case 'collaborators': displayValue = 'Collaborators'; break;
            case 'everyone': displayValue = 'All Authenticated Users'; break;
        }
    }
    return (
      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <p className="text-sm text-foreground">{displayValue}</p>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg p-0 flex flex-col h-auto max-h-[80vh]" showCloseButton={false}>
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <DialogTitle className="text-xl">{planData.name}</DialogTitle>
              <DialogDescription>
                Owned by {ownerProfile?.displayName || generateAnonymousName(planData.ownerId)}
              </DialogDescription>
            </div>
            <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogPrimitive.Close>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {planData.description && (
              <div>
                <Label className="text-sm text-muted-foreground">Description</Label>
                <p className="text-sm text-foreground whitespace-pre-wrap">{planData.description}</p>
              </div>
            )}
            {renderStaticSetting("Visibility", planData.visibility)}
            {renderStaticSetting("Editability", planData.editability)}
            {renderStaticSetting("Sector", planData.sector)}
            {renderStaticSetting("Sub-Sector", planData.subSector)}
            {renderStaticSetting("Industry", planData.industry)}
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p>Version: {planData.version}</p>
              <p>Created: {format(new Date(planData.createdAt), 'PPp')}</p>
              <p>Last Updated: {format(new Date(planData.updatedAt), 'PPp')}</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
