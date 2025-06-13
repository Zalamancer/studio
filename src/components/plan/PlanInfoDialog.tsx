
// src/components/plan/PlanInfoDialog.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, FileText, Users2, User, Eye, Lock, Link as LinkIcon, Users, ShieldQuestion, Trash2, Search, PlusCircle } from 'lucide-react';
import type { ClientPlan, PlanVisibility, PlanEditability } from '@/types/plan';
import type { UserProfileBasic } from '@/types/connection';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import { cn } from '@/lib/utils';

interface PlanInfoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  planData: ClientPlan | null;
  ownerProfile: UserProfileBasic | null;
  isPlanOwner: boolean;
  onSaveSettings: (settings: {
    name: string;
    description: string;
    visibility: PlanVisibility;
    editability: PlanEditability;
    viewUserIds: string[];
    editUserIds: string[];
  }) => void;
  isSavingSettings: boolean;
  // Permission specific props from usePlanLogic
  viewPermissionsSearch: string;
  setViewPermissionsSearch: (value: string) => void;
  editPermissionsSearch: string;
  setEditPermissionsSearch: (value: string) => void;
  viewPermissionSuggestions: UserProfileBasic[];
  editPermissionSuggestions: UserProfileBasic[];
}

const SkeletonListItem: React.FC = () => (
  <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md animate-pulse">
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-full bg-muted-foreground/20" />
      <div className="h-4 w-24 bg-muted-foreground/20 rounded" />
    </div>
  </div>
);


export const PlanInfoDialog: React.FC<PlanInfoDialogProps> = ({
  isOpen,
  onOpenChange,
  planData,
  ownerProfile,
  isPlanOwner,
  onSaveSettings,
  isSavingSettings,
  viewPermissionsSearch,
  setViewPermissionsSearch,
  editPermissionsSearch,
  setEditPermissionsSearch,
  viewPermissionSuggestions,
  editPermissionSuggestions,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PlanVisibility>('private');
  const [editability, setEditability] = useState<PlanEditability>('owner_only');

  // Local state for managing lists of viewer and editor UIDs within the dialog
  const [currentViewers, setCurrentViewers] = useState<string[]>([]);
  const [currentEditors, setCurrentEditors] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    if (planData && isOpen) {
      setName(planData.name);
      setDescription(planData.description || '');
      setVisibility(planData.visibility);
      setEditability(planData.editability);
      // Initialize local viewer/editor lists from planData, excluding the owner as they are implicitly included
      setCurrentViewers(planData.viewUserIds?.filter(uid => uid !== planData.ownerId) || []);
      setCurrentEditors(planData.editUserIds?.filter(uid => uid !== planData.ownerId) || []);
    }
  }, [planData, isOpen]);

  const { data: viewerProfilesMap, isLoading: isLoadingViewerProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['userProfilesBasic', 'planDialogViewers', planData?.id, currentViewers.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (!currentViewers || currentViewers.length === 0) return profiles;
      await Promise.all(currentViewers.map(async uid => {
        const profile = await fetchUserProfileBasic(uid);
        profiles.set(uid, profile);
      }));
      return profiles;
    },
    enabled: isOpen && currentViewers.length > 0 && !!planData,
  });

  const { data: editorProfilesMap, isLoading: isLoadingEditorProfiles } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['userProfilesBasic', 'planDialogEditors', planData?.id, currentEditors.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (!currentEditors || currentEditors.length === 0) return profiles;
      await Promise.all(currentEditors.map(async uid => {
        const profile = await fetchUserProfileBasic(uid);
        profiles.set(uid, profile);
      }));
      return profiles;
    },
    enabled: isOpen && currentEditors.length > 0 && !!planData,
  });

  const handleInternalAddViewer = (userProfile: UserProfileBasic) => {
    if (!planData || userProfile.userId === planData.ownerId) return;
    setCurrentViewers(prev => Array.from(new Set([...prev, userProfile.userId])));
    setViewPermissionsSearch(''); // Clear search
  };

  const handleInternalRemoveViewer = (userIdToRemove: string) => {
    if (!planData || userIdToRemove === planData.ownerId) return;
    setCurrentViewers(prev => prev.filter(uid => uid !== userIdToRemove));
    // If removed from viewers, also remove from editors
    setCurrentEditors(prev => prev.filter(uid => uid !== userIdToRemove));
  };

  const handleInternalAddEditor = (userProfile: UserProfileBasic) => {
    if (!planData || userProfile.userId === planData.ownerId) return;
    setCurrentEditors(prev => Array.from(new Set([...prev, userProfile.userId])));
    // Editors are implicitly viewers
    setCurrentViewers(prev => Array.from(new Set([...prev, userProfile.userId])));
    setEditPermissionsSearch(''); // Clear search
  };

  const handleInternalRemoveEditor = (userIdToRemove: string) => {
    if (!planData || userIdToRemove === planData.ownerId) return;
    setCurrentEditors(prev => prev.filter(uid => uid !== userIdToRemove));
    // Note: Removing from editors does NOT automatically remove from viewers in this direct action.
    // If they were *only* an editor and not explicitly added as a viewer, they will remain a viewer
    // if the plan visibility is 'unlisted' and they were added as a viewer.
    // If they must lose view access too, they need to be removed from the Viewers list.
  };

  const handleSave = () => {
    if (!planData || !name.trim()) {
      toast({ variant: "destructive", title: "Validation Error", description: "Plan name is required." });
      return;
    }
    onSaveSettings({
      name: name.trim(),
      description: description.trim(),
      visibility,
      editability,
      viewUserIds: currentViewers, // Pass the locally managed list (owner implicitly added by service)
      editUserIds: currentEditors, // Pass the locally managed list (owner implicitly added by service)
    });
  };
  
  const renderUserListItem = (
    userId: string,
    profilesMap: Map<string, UserProfileBasic | null> | undefined,
    onRemove: (uid: string) => void,
    roleContext: 'Viewer' | 'Editor', // Just for logging/key uniqueness
    isLoadingMap: boolean
  ) => {
    const profile = profilesMap?.get(userId);
    const displayName = profile?.displayName || profile?.mentionName || generateAnonymousName(userId);
    
    if (userId === planData?.ownerId) return null; // Owner shouldn't be listed here for management

    if (isLoadingMap && !profile) {
      return <SkeletonListItem key={`loading-${roleContext}-${userId}`} />;
    }
    
    return (
      <div key={`${roleContext}-${userId}`} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md hover:bg-muted/60 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-6 w-6">
            <AvatarImage src={profile?.avatarUrl} alt={displayName} />
            <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
          </Avatar>
          <span className="text-xs truncate" title={displayName}>{displayName}</span>
        </div>
        {isPlanOwner && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 text-destructive hover:text-destructive/80"
            onClick={() => onRemove(userId)}
            disabled={isSavingSettings}
            title={`Remove ${roleContext.toLowerCase()}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  const renderPermissionSection = (
    title: string,
    currentPermittedUserIds: string[], // e.g., currentEditors, currentViewers
    profilesMap: Map<string, UserProfileBasic | null> | undefined,
    isLoadingProfilesMap: boolean,
    searchVal: string,
    setSearchVal: (val: string) => void,
    suggestionList: UserProfileBasic[],
    onAddToList: (profile: UserProfileBasic) => void,
    onRemoveFromList: (uid: string) => void,
    roleContext: 'Viewer' | 'Editor'
  ) => (
    <div className="space-y-2 border p-3 rounded-md bg-background shadow-sm">
      <Label className="text-sm font-semibold text-foreground">{title}</Label>
      {isPlanOwner && (
        <>
          <div className="relative">
            <Input
              type="search"
              placeholder="Search by @mentionName or name..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="text-xs h-8 pr-8"
              disabled={isSavingSettings}
            />
            <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          {searchVal && suggestionList.length > 0 && (
            <ScrollArea className="max-h-32 border rounded-md bg-popover">
              <div className="p-1">
                {suggestionList
                  .filter(sugg => sugg.userId !== planData?.ownerId && !currentPermittedUserIds.includes(sugg.userId))
                  .map(sugg => (
                    <Button key={`sugg-${roleContext}-${sugg.userId}`} variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1.5 px-2 hover:bg-accent" onClick={() => onAddToList(sugg)}>
                      <Avatar className="h-5 w-5 mr-1.5"><AvatarImage src={sugg.avatarUrl} /><AvatarFallback className="text-xs">{getInitials(sugg.displayName || sugg.mentionName)}</AvatarFallback></Avatar>
                      <div className="flex flex-col items-start text-left min-w-0">
                        <span className="truncate font-medium">{sugg.displayName || sugg.mentionName}</span>
                        <span className="text-muted-foreground text-[11px] truncate">@{sugg.mentionName}</span>
                      </div>
                      <PlusCircle className="h-4 w-4 ml-auto text-primary flex-shrink-0"/>
                    </Button>
                  ))}
                 {suggestionList.filter(sugg => sugg.userId !== planData?.ownerId && !currentPermittedUserIds.includes(sugg.userId)).length === 0 && searchVal && (
                    <p className="text-xs text-muted-foreground text-center p-2">No new users found matching "{searchVal}".</p>
                 )}
              </div>
            </ScrollArea>
          )}
        </>
      )}
      <ScrollArea className={cn("max-h-28", currentPermittedUserIds.length === 0 && "border-none")}>
        <div className="space-y-1 py-1">
          {isLoadingProfilesMap && currentPermittedUserIds.length > 0 && !profilesMap?.size ? (
            Array.from({length: Math.min(2, currentPermittedUserIds.length)}).map((_,idx) => <SkeletonListItem key={`loading-${roleContext}-${idx}`} />)
          ) : currentPermittedUserIds.length > 0 ? (
            currentPermittedUserIds.map(uid => renderUserListItem(uid, profilesMap, onRemoveFromList, roleContext, isLoadingProfilesMap))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No specific {roleContext.toLowerCase()}s added (besides owner).</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );


  if (!planData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="pr-10">
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Plan Information & Settings</DialogTitle>
          <DialogDescription>View and manage your plan's details and access permissions.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow min-h-0 pr-2">
          <div className="space-y-6 py-2 pr-4">
            <div>
              <Label htmlFor="plan-name" className="text-sm">Plan Name</Label>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isPlanOwner || isSavingSettings} className="text-sm h-9"/>
            </div>
            <div>
              <Label htmlFor="plan-description" className="text-sm">Description</Label>
              <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isPlanOwner || isSavingSettings} rows={3} placeholder="A brief overview of this plan's purpose." className="text-sm"/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-visibility" className="text-sm flex items-center gap-1"><ShieldQuestion className="h-4 w-4 text-muted-foreground" />Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as PlanVisibility)} disabled={!isPlanOwner || isSavingSettings}>
                  <SelectTrigger id="plan-visibility" className="text-sm h-9">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private"><div className="flex items-center gap-2 text-sm"><Lock className="h-3.5 w-3.5" /> Private (Owner only)</div></SelectItem>
                    <SelectItem value="unlisted"><div className="flex items-center gap-2 text-sm"><LinkIcon className="h-3.5 w-3.5" /> Unlisted (With link)</div></SelectItem>
                    <SelectItem value="public"><div className="flex items-center gap-2 text-sm"><Eye className="h-3.5 w-3.5" /> Public (Discoverable)</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan-editability" className="text-sm flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />Editability</Label>
                <Select value={editability} onValueChange={(v) => setEditability(v as PlanEditability)} disabled={!isPlanOwner || isSavingSettings}>
                  <SelectTrigger id="plan-editability" className="text-sm h-9">
                    <SelectValue placeholder="Select editability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner_only"><div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5" /> Owner Only</div></SelectItem>
                    <SelectItem value="collaborators"><div className="flex items-center gap-2 text-sm"><Users className="h-3.5 w-3.5" /> Collaborators</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPlanOwner && (
              <div className="space-y-3 pt-2">
                {visibility !== 'public' && renderPermissionSection(
                  "Manage View Access (for Private/Unlisted plans)",
                  currentViewers,
                  viewerProfilesMap,
                  isLoadingViewerProfiles,
                  viewPermissionsSearch,
                  setViewPermissionsSearch,
                  viewPermissionSuggestions,
                  handleInternalAddViewer,
                  handleInternalRemoveViewer,
                  "Viewer"
                )}
                {editability === 'collaborators' && renderPermissionSection(
                  "Manage Edit Access (Collaborators)",
                  currentEditors,
                  editorProfilesMap,
                  isLoadingEditorProfiles,
                  editPermissionsSearch,
                  setEditPermissionsSearch,
                  editPermissionSuggestions,
                  handleInternalAddEditor,
                  handleInternalRemoveEditor,
                  "Editor"
                )}
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t mt-4">
              <p><strong className="text-foreground">Owner:</strong> {ownerProfile?.displayName || generateAnonymousName(planData.ownerId)}</strong className="text-foreground"></p>
              <p><strong className="text-foreground">Created:</strong> {format(new Date(planData.createdAt), 'PPp')}</p>
              <p><strong className="text-foreground">Last Updated:</strong> {format(new Date(planData.updatedAt), 'PPp')}</p>
              <p><strong className="text-foreground">Version:</strong> {planData.version}</p>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t mt-auto p-6">
          {isPlanOwner && (
            <Button onClick={handleSave} disabled={isSavingSettings || isLoadingViewerProfiles || isLoadingEditorProfiles} className="w-full sm:w-auto">
              {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

    