
// src/components/plan/PlanInfoDialog.tsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, FileText, CalendarDays, Users2, User, Eye, Lock, Link as LinkIconLucide, Users, ShieldQuestion, Trash2, Search, PlusCircle } from 'lucide-react'; // Added Search, PlusCircle
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
  // Callbacks from usePlanLogic are removed as PlanInfoDialog now manages its local state for viewers/editors
}

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

  const [currentViewers, setCurrentViewers] = useState<string[]>([]);
  const [currentEditors, setCurrentEditors] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    if (planData && isOpen) {
      setName(planData.name);
      setDescription(planData.description || '');
      setVisibility(planData.visibility);
      setEditability(planData.editability);
      // Initialize local viewer/editor lists from planData, excluding the owner
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
    setViewPermissionsSearch('');
  };

  const handleInternalRemoveViewer = (userIdToRemove: string) => {
    if (!planData || userIdToRemove === planData.ownerId) return;
    setCurrentViewers(prev => prev.filter(uid => uid !== userIdToRemove));
    setCurrentEditors(prev => prev.filter(uid => uid !== userIdToRemove)); // Also remove from editors
  };

  const handleInternalAddEditor = (userProfile: UserProfileBasic) => {
    if (!planData || userProfile.userId === planData.ownerId) return;
    setCurrentEditors(prev => Array.from(new Set([...prev, userProfile.userId])));
    setCurrentViewers(prev => Array.from(new Set([...prev, userProfile.userId]))); // Editors are implicitly viewers
    setEditPermissionsSearch('');
  };

  const handleInternalRemoveEditor = (userIdToRemove: string) => {
    if (!planData || userIdToRemove === planData.ownerId) return;
    setCurrentEditors(prev => prev.filter(uid => uid !== userIdToRemove));
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
      viewUserIds: currentViewers, // Pass the locally managed list
      editUserIds: currentEditors, // Pass the locally managed list
    });
  };

  const renderUserListItem = (userId: string, profilesMap: Map<string, UserProfileBasic | null> | undefined, onRemove: (uid: string) => void, role: 'Viewer' | 'Editor', isLoadingProfiles: boolean) => {
    const profile = profilesMap?.get(userId);
    const displayName = profile?.displayName || profile?.mentionName || generateAnonymousName(userId);
    if (userId === planData?.ownerId) return null;

    if (isLoadingProfiles && !profile) {
      return (
        <div key={`${role}-loading-${userId}`} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md animate-pulse">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      );
    }

    return (
      <div key={`${role}-${userId}`} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-6 w-6"><AvatarImage src={profile?.avatarUrl} /><AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback></Avatar>
          <span className="text-xs truncate" title={displayName}>{displayName}</span>
        </div>
        {isPlanOwner && (
          <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => onRemove(userId)} disabled={isSavingSettings}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  const renderPermissionSection = (
    title: string,
    currentPermittedUserIds: string[],
    profilesMap: Map<string, UserProfileBasic | null> | undefined,
    isLoadingProfiles: boolean,
    search: string,
    setSearch: (val: string) => void,
    suggestions: UserProfileBasic[],
    onAddUser: (profile: UserProfileBasic) => void,
    onRemoveUser: (uid: string) => void,
    role: 'Viewer' | 'Editor'
  ) => (
    <div className="space-y-2 border p-3 rounded-md bg-background">
      <Label className="text-sm font-medium">{title}</Label>
      {isPlanOwner && (
        <div className="relative mb-1">
          <Input
            type="search"
            placeholder="Search users by @mentionName..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs h-8 pr-8"
            disabled={isSavingSettings}
          />
          <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}
      {isPlanOwner && search && suggestions.length > 0 && (
        <ScrollArea className="max-h-32 border rounded-md">
          <div className="p-1">
            {suggestions
              .filter(sugg => sugg.userId !== planData?.ownerId && !currentPermittedUserIds.includes(sugg.userId))
              .map(sugg => (
                <Button key={sugg.userId} variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1 px-2" onClick={() => onAddUser(sugg)}>
                  <Avatar className="h-5 w-5 mr-1.5"><AvatarImage src={sugg.avatarUrl} /><AvatarFallback className="text-xs">{getInitials(sugg.displayName || sugg.mentionName)}</AvatarFallback></Avatar>
                  <span className="truncate">{sugg.displayName || sugg.mentionName}</span>
                  <span className="text-muted-foreground ml-1 truncate">(@{sugg.mentionName})</span>
                </Button>
              ))}
             {suggestions.filter(sugg => sugg.userId !== planData?.ownerId && !currentPermittedUserIds.includes(sugg.userId)).length === 0 && search && (
                <p className="text-xs text-muted-foreground text-center p-2">No new users found for "{search}".</p>
             )}
          </div>
        </ScrollArea>
      )}
      <ScrollArea className={cn("max-h-28", currentPermittedUserIds.length === 0 && "border-none")}>
        <div className="space-y-1 py-1">
          {isLoadingProfiles && currentPermittedUserIds.length > 0 && !profilesMap?.size ? (
            Array.from({length: Math.min(3, currentPermittedUserIds.length)}).map((_,idx) => renderUserListItem(`loading-${idx}`, undefined, ()=>{}, true, role, true))
          ) : currentPermittedUserIds.length > 0 ? (
            currentPermittedUserIds.map(uid => renderUserListItem(uid, profilesMap, onRemoveUser, isPlanOwner, role, isLoadingProfiles))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">No specific {role.toLowerCase()}s added yet.</p>
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
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isPlanOwner || isSavingSettings} />
            </div>
            <div>
              <Label htmlFor="plan-description" className="text-sm">Description</Label>
              <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isPlanOwner || isSavingSettings} rows={3} placeholder="A brief overview of this plan's purpose."/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-visibility" className="text-sm flex items-center gap-1"><ShieldQuestion className="h-4 w-4 text-muted-foreground" />Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as PlanVisibility)} disabled={!isPlanOwner || isSavingSettings}>
                  <SelectTrigger id="plan-visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-4 w-4" /> Private (Owner only)</div></SelectItem>
                    <SelectItem value="unlisted"><div className="flex items-center gap-2"><LinkIconLucide className="h-4 w-4" /> Unlisted (With link)</div></SelectItem>
                    <SelectItem value="public"><div className="flex items-center gap-2"><Eye className="h-4 w-4" /> Public (Discoverable)</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan-editability" className="text-sm flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" />Editability</Label>
                <Select value={editability} onValueChange={(v) => setEditability(v as PlanEditability)} disabled={!isPlanOwner || isSavingSettings}>
                  <SelectTrigger id="plan-editability">
                    <SelectValue placeholder="Select editability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner_only"><div className="flex items-center gap-2"><User className="h-4 w-4" /> Owner Only</div></SelectItem>
                    <SelectItem value="collaborators"><div className="flex items-center gap-2"><Users className="h-4 w-4" /> Collaborators</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isPlanOwner && (
              <>
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
              </>
            )}

            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t mt-4">
              <p><strong className="text-foreground">Owner:</strong> {ownerProfile?.displayName || generateAnonymousName(planData.ownerId)}</p>
              <p><strong className="text-foreground">Created:</strong> {format(new Date(planData.createdAt), 'PPp')}</p>
              <p><strong className="text-foreground">Last Updated:</strong> {format(new Date(planData.updatedAt), 'PPp')}</p>
              <p><strong className="text-foreground">Version:</strong> {planData.version}</p>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t mt-auto">
          {isPlanOwner && (
            <Button onClick={handleSave} disabled={isSavingSettings || isLoadingViewerProfiles || isLoadingEditorProfiles}>
              {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
