
// src/components/plan/PlanInfoDialog.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, FileText, CalendarDays, Users2, User, Eye, Lock, Link as LinkIcon, Users, ShieldQuestion, Trash2, Search } from 'lucide-react'; // Added Search
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
  onAddUserToViewers: (userId: string) => void;
  onRemoveUserFromViewers: (userId: string) => void;
  onAddUserToEditors: (userId: string) => void;
  onRemoveUserFromEditors: (userId: string) => void;
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
  onAddUserToViewers,
  onRemoveUserFromViewers,
  onAddUserToEditors,
  onRemoveUserFromEditors,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<PlanVisibility>('private');
  const [editability, setEditability] = useState<PlanEditability>('owner_only');

  // Local state for managing viewer/editor lists within the dialog before saving
  const [currentViewers, setCurrentViewers] = useState<string[]>([]);
  const [currentEditors, setCurrentEditors] = useState<string[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    if (planData && isOpen) {
      setName(planData.name);
      setDescription(planData.description || '');
      setVisibility(planData.visibility);
      setEditability(planData.editability);
      setCurrentViewers(planData.viewUserIds || []);
      setCurrentEditors(planData.editUserIds || []);
    }
  }, [planData, isOpen]);

  const { data: viewerProfilesMap } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['userProfilesBasic', 'planViewers', planData?.id, currentViewers.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (!currentViewers || currentViewers.length === 0) return profiles;
      await Promise.all(currentViewers.map(async uid => {
        if (uid !== planData?.ownerId) { // Don't fetch owner profile again if it's already available
          const profile = await fetchUserProfileBasic(uid);
          profiles.set(uid, profile);
        }
      }));
      return profiles;
    },
    enabled: isOpen && currentViewers.length > 0 && !!planData,
  });

  const { data: editorProfilesMap } = useQuery<Map<string, UserProfileBasic | null>>({
    queryKey: ['userProfilesBasic', 'planEditors', planData?.id, currentEditors.join(',')],
    queryFn: async () => {
      const profiles = new Map<string, UserProfileBasic | null>();
      if (!currentEditors || currentEditors.length === 0) return profiles;
      await Promise.all(currentEditors.map(async uid => {
        if (uid !== planData?.ownerId) {
          const profile = await fetchUserProfileBasic(uid);
          profiles.set(uid, profile);
        }
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
  const handleInternalRemoveViewer = (userId: string) => {
    if (!planData || userId === planData.ownerId) return;
    setCurrentViewers(prev => prev.filter(uid => uid !== userId));
    setCurrentEditors(prev => prev.filter(uid => uid !== userId)); // If removed from viewers, also remove from editors
  };
  const handleInternalAddEditor = (userProfile: UserProfileBasic) => {
    if (!planData || userProfile.userId === planData.ownerId) return;
    setCurrentEditors(prev => Array.from(new Set([...prev, userProfile.userId])));
    setCurrentViewers(prev => Array.from(new Set([...prev, userProfile.userId]))); // Editors are also viewers
    setEditPermissionsSearch(''); // Clear search
  };
  const handleInternalRemoveEditor = (userId: string) => {
    if (!planData || userId === planData.ownerId) return;
    setCurrentEditors(prev => prev.filter(uid => uid !== userId));
    // Do NOT remove from viewers here, they might still have explicit view access
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
      viewUserIds: currentViewers.filter(uid => uid !== planData.ownerId), // Owner implicit
      editUserIds: currentEditors.filter(uid => uid !== planData.ownerId), // Owner implicit
    });
  };

  const renderUserListItem = (userId: string, profilesMap: Map<string, UserProfileBasic | null> | undefined, onRemove: (uid: string) => void, isOwner: boolean, role: 'Viewer' | 'Editor') => {
    const profile = profilesMap?.get(userId);
    const displayName = profile?.displayName || profile?.mentionName || generateAnonymousName(userId);
    if (userId === planData?.ownerId) return null; // Don't list owner here

    return (
      <div key={`${role}-${userId}`} className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6"><AvatarImage src={profile?.avatarUrl} /><AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback></Avatar>
          <span className="text-xs truncate" title={displayName}>{displayName}</span>
        </div>
        {isOwner && (
          <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => onRemove(userId)} disabled={isSavingSettings}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  const renderPermissionSection = (
    title: string,
    userIds: string[],
    profilesMap: Map<string, UserProfileBasic | null> | undefined,
    search: string,
    setSearch: (val: string) => void,
    suggestions: UserProfileBasic[],
    onAdd: (profile: UserProfileBasic) => void,
    onRemove: (uid: string) => void,
    role: 'Viewer' | 'Editor'
  ) => (
    <div className="space-y-2 border p-3 rounded-md bg-background">
      <Label className="text-sm font-medium">{title}</Label>
      {isPlanOwner && (
        <div className="relative">
          <Input
            type="search"
            placeholder="Search by @mentionName..."
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
            {suggestions.filter(sugg => sugg.userId !== planData?.ownerId && !userIds.includes(sugg.userId)).map(sugg => (
              <Button key={sugg.userId} variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1 px-2" onClick={() => onAdd(sugg)}>
                <Avatar className="h-5 w-5 mr-1.5"><AvatarImage src={sugg.avatarUrl} /><AvatarFallback className="text-xs">{getInitials(sugg.displayName || sugg.mentionName)}</AvatarFallback></Avatar>
                {sugg.displayName || sugg.mentionName} <span className="text-muted-foreground ml-1">(@{sugg.mentionName})</span>
              </Button>
            ))}
          </div>
        </ScrollArea>
      )}
      <ScrollArea className="max-h-28">
        <div className="space-y-1 py-1">
          {userIds.length > 0 ?
            userIds.map(uid => renderUserListItem(uid, profilesMap, onRemove, isPlanOwner, role)) :
            <p className="text-xs text-muted-foreground text-center py-2">No specific {role.toLowerCase()}s added yet.</p>
          }
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
          <DialogDescription>View and manage your plan's details and access.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow min-h-0 pr-2">
          <div className="space-y-6 py-2 pr-4">
            <div>
              <Label htmlFor="plan-name" className="text-sm">Plan Name</Label>
              <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isPlanOwner || isSavingSettings} />
            </div>
            <div>
              <Label htmlFor="plan-description" className="text-sm">Description</Label>
              <Textarea id="plan-description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isPlanOwner || isSavingSettings} rows={3} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-visibility" className="text-sm">Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as PlanVisibility)} disabled={!isPlanOwner || isSavingSettings}>
                  <SelectTrigger id="plan-visibility">
                    <SelectValue placeholder="Select visibility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-4 w-4" /> Private (Only you)</div></SelectItem>
                    <SelectItem value="unlisted"><div className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Unlisted (Sharable link)</div></SelectItem>
                    <SelectItem value="public"><div className="flex items-center gap-2"><Eye className="h-4 w-4" /> Public (Discoverable)</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="plan-editability" className="text-sm">Editability</Label>
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

            {isPlanOwner && (visibility !== 'public' || editability === 'collaborators') && (
              <>
                {visibility !== 'public' && renderPermissionSection(
                  "Manage View Access (for Private/Unlisted)",
                  currentViewers,
                  viewerProfilesMap,
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
              <p><strong className="text-foreground">Created:</strong> {format(new Date(planData.createdAt), 'PPp')} by {ownerProfile?.displayName || generateAnonymousName(planData.ownerId)}</p>
              <p><strong className="text-foreground">Last Updated:</strong> {format(new Date(planData.updatedAt), 'PPp')}</p>
              <p><strong className="text-foreground">Version:</strong> {planData.version}</p>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-4 border-t">
          {isPlanOwner && (
            <Button onClick={handleSave} disabled={isSavingSettings}>
              {isSavingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Settings
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

