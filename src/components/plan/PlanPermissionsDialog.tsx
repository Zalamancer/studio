
// src/components/plan/PlanPermissionsDialog.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription as DialogPrimitiveDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Loader2,
  Users,
  Eye,
  Lock,
  Link as LinkIcon,
  ShieldQuestion,
  Trash2,
  Search,
  PlusCircle,
  X,
  Save,
  Globe,
  User,
  ExternalLink,
  History,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PlanVisibility, PlanEditability } from '@/types/plan';
import type { UserProfileBasic } from '@/types/connection';
import { useToast } from '@/hooks/use-toast';
import { getInitials, generateAnonymousName } from '@/lib/pseudonymUtils';
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfileBasic } from '@/services/connectionService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { ConnectionButton } from '@/components/connect/ConnectionButton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Import Tabs
import { useIsMobile } from '@/hooks/use-mobile'; // Import useIsMobile


interface PlanPermissionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialVisibility: PlanVisibility;
  initialEditability: PlanEditability;
  initialViewUserIds: string[];
  initialEditUserIds: string[];
  ownerId: string;
  onSave: (settings: {
    visibility: PlanVisibility;
    editability: PlanEditability;
    viewUserIds: string[];
    editUserIds: string[];
  }) => void;
  isSaving: boolean;
  viewPermissionsSearch: string;
  setViewPermissionsSearch: (search: string) => void;
  editPermissionsSearch: string;
  setEditPermissionsSearch: (search: string) => void;
  viewPermissionSuggestions: UserProfileBasic[];
  editPermissionSuggestions: UserProfileBasic[];
  onViewUserChanges: (userId: string) => void;
}

const SkeletonListItem: React.FC = () => (
    <div className="flex items-center justify-between py-1.5 px-2 bg-muted/30 rounded-md animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-muted-foreground/20" />
        <div className="h-4 w-24 bg-muted-foreground/20 rounded" />
      </div>
    </div>
  );
  
const UserListItem: React.FC<{
  userId: string;
  onRemove: (uid: string) => void;
  onViewChanges: () => void;
  canBeRemoved: boolean;
  isSaving: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}> = ({ userId, onRemove, onViewChanges, canBeRemoved, isSaving, isOwner, isAdmin }) => {
  const { user: currentUser } = useAuth();

  const { data: profile, isLoading } = useQuery<UserProfileBasic | null>({
    queryKey: ['userProfileBasic', userId, 'planPermissionsMember'],
    queryFn: () => fetchUserProfileBasic(userId),
    enabled: !!userId,
    staleTime: Infinity,
  });

  if (isLoading) return <SkeletonListItem />;

  if (!profile) {
    return null;
  }

  const displayName = profile.displayName || generateAnonymousName(userId);

  return (
    <div className="group/memberitem flex items-center justify-between py-1.5 px-2 hover:bg-muted/50 rounded-md transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-grow">
          <Link href={`/profile/${userId}`} passHref onClick={(e) => e.stopPropagation()} className="flex-shrink-0" title={`Visit profile for ${displayName}`}>
              <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={profile?.avatarUrl} alt={displayName} />
                  <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
              </Avatar>
          </Link>
          <div className="min-w-0 flex-grow relative h-5">
              <div className="absolute inset-0 flex items-center transition-opacity opacity-100 group-hover/memberitem:opacity-0 group-hover/memberitem:pointer-events-none">
                  <p className="text-xs truncate" title={displayName}>{displayName}</p>
              </div>
              <div className="absolute inset-0 flex items-center gap-1 transition-opacity opacity-0 group-hover/memberitem:opacity-100">
                  {currentUser && currentUser.uid !== userId && (
                      <ConnectionButton
                          targetUserId={userId}
                          size="xs"
                          variant="ghost"
                          className="h-6 w-6 p-1"
                          iconOnly
                      />
                  )}
                  {isAdmin && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-1" title="View User's Changes" onClick={(e) => { e.stopPropagation(); onViewChanges(); }}>
                          <History className="h-3.5 w-3.5" />
                      </Button>
                  )}
              </div>
          </div>
      </div>
      <div className="flex-shrink-0 ml-2">
          <div className="relative h-5 w-12 text-right">
              <div className="absolute inset-0 flex items-center justify-end transition-opacity opacity-100 group-hover/memberitem:opacity-0 group-hover/memberitem:pointer-events-none">
                  {isOwner && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-amber-500 text-amber-600">Owner</Badge>}
                  {isAdmin && !isOwner && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">Admin</Badge>}
              </div>
              {canBeRemoved && (
                  <div className="absolute inset-0 flex items-center justify-end transition-opacity opacity-0 group-hover/memberitem:opacity-100">
                      <Button variant="ghost" size="icon" className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(userId); }} disabled={isSaving} title="Remove User">
                          <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};
  
export const PlanPermissionsDialog: React.FC<PlanPermissionsDialogProps> = ({
  isOpen,
  onOpenChange,
  initialVisibility,
  initialEditability,
  initialViewUserIds,
  initialEditUserIds,
  ownerId,
  onSave,
  isSaving,
  viewPermissionsSearch,
  setViewPermissionsSearch,
  editPermissionsSearch,
  setEditPermissionsSearch,
  viewPermissionSuggestions,
  editPermissionSuggestions,
  onViewUserChanges,
}) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const isMobile = useIsMobile();

  const [visibility, setVisibility] = useState<PlanVisibility>(initialVisibility);
  const [editability, setEditability] = useState<PlanEditability>(initialEditability);
  const [currentViewUserIds, setCurrentViewUserIds] = useState<string[]>([]);
  const [currentEditUserIds, setCurrentEditUserIds] = useState<string[]>([]);

  const [isViewSuggestionsOpen, setIsViewSuggestionsOpen] = useState(false);
  const [isEditSuggestionsOpen, setIsEditSuggestionsOpen] = useState(false);
  const viewSearchInputRef = useRef<HTMLInputElement>(null);
  const editSearchInputRef = useRef<HTMLInputElement>(null);
  const viewSuggestionsPopoverRef = useRef<HTMLDivElement>(null);
  const editSuggestionsPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setVisibility(initialVisibility);
      setEditability(initialEditability);
      setCurrentViewUserIds(initialViewUserIds.filter(uid => uid !== ownerId));
      setCurrentEditUserIds(initialEditUserIds.filter(uid => uid !== ownerId));
    }
  }, [isOpen, initialVisibility, initialEditability, initialViewUserIds, initialEditUserIds, ownerId]);

  useEffect(() => {
    if (visibility === 'unlisted' && editability === 'everyone') {
      setEditability('owner_only');
      toast({ title: "Editability Adjusted", description: "The 'Everyone' edit option is not available for unlisted plans. Editability set to 'Owner Only'." });
    } else if (visibility === 'private' && editability !== 'owner_only') {
      setEditability('owner_only');
      toast({ title: "Editability Adjusted", description: "Private plans can only be edited by the owner." });
    }
  }, [visibility, editability, toast]);

  useEffect(() => { setIsViewSuggestionsOpen(!!viewPermissionsSearch && viewPermissionSuggestions.length > 0); }, [viewPermissionsSearch, viewPermissionSuggestions]);
  useEffect(() => { setIsEditSuggestionsOpen(!!editPermissionsSearch && editPermissionSuggestions.length > 0); }, [editPermissionsSearch, editPermissionSuggestions]);

  const handleAddViewer = (userProfile: UserProfileBasic) => {
    if (userProfile.userId === ownerId || currentViewUserIds.includes(userProfile.userId)) return;
    setCurrentViewUserIds(prev => Array.from(new Set([...prev, userProfile.userId])));
    setViewPermissionsSearch('');
    setIsViewSuggestionsOpen(false);
  };

  const handleRemoveViewer = (userIdToRemove: string) => {
    setCurrentViewUserIds(prev => prev.filter(uid => uid !== userIdToRemove));
    setCurrentEditUserIds(prev => prev.filter(uid => uid !== userIdToRemove));
  };

  const handleAddEditor = (userProfile: UserProfileBasic) => {
    if (userProfile.userId === ownerId || currentEditUserIds.includes(userProfile.userId)) return;
    setCurrentEditUserIds(prev => Array.from(new Set([...prev, userProfile.userId])));
    setCurrentViewUserIds(prev => Array.from(new Set([...prev, userProfile.userId])));
    setEditPermissionsSearch('');
    setIsEditSuggestionsOpen(false);
  };

  const handleRemoveEditor = (userIdToRemove: string) => {
    setCurrentEditUserIds(prev => prev.filter(uid => uid !== userIdToRemove));
  };

  const handleSave = () => {
    onSave({
      visibility,
      editability,
      viewUserIds: currentViewUserIds,
      editUserIds: currentEditUserIds,
    });
  };

  const renderUserManagementSection = (
      title: string,
      currentUserIds: string[],
      searchVal: string,
      setSearchVal: (val: string) => void,
      suggestionList: UserProfileBasic[],
      onAddInternal: (profile: UserProfileBasic) => void,
      onRemoveInternal: (uid: string) => void,
      isSuggestionsOpen: boolean,
      setIsSuggestionsOpen: (open: boolean) => void,
      inputRef: React.RefObject<HTMLInputElement>,
      popoverRef: React.RefObject<HTMLDivElement>,
      isEditorList: boolean,
    ) => (
      <div className="space-y-2 border p-3 rounded-md bg-background shadow-sm flex flex-col h-[300px]">
        <Label className="text-sm font-semibold text-foreground flex-shrink-0">{title}</Label>
        <Popover open={isSuggestionsOpen} onOpenChange={setIsSuggestionsOpen}>
          <PopoverTrigger asChild>
            <div className="relative flex-shrink-0">
              <Input ref={inputRef} type="search" placeholder="Search by name or @mention..." value={searchVal} onChange={(e) => setSearchVal(e.target.value)} className="text-xs h-8 pr-8" disabled={isSaving} />
              <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </PopoverTrigger>
          {isSuggestionsOpen && (
            <PopoverContent ref={popoverRef} className="w-[var(--radix-popover-trigger-width)] p-1 mt-1 max-h-36 overflow-y-auto" side="bottom" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
              {suggestionList.filter(sugg => sugg.userId !== ownerId && !currentUserIds.includes(sugg.userId)).map(sugg => (
                <Button key={`sugg-${title}-${sugg.userId}`} variant="ghost" size="sm" className="w-full justify-start text-xs h-auto py-1.5 px-2 hover:bg-accent" onClick={() => onAddInternal(sugg)} onMouseDown={(e) => e.preventDefault()}>
                  <Avatar className="h-5 w-5 mr-1.5"><AvatarImage src={sugg.avatarUrl} /><AvatarFallback className="text-xs">{getInitials(sugg.displayName || sugg.mentionName)}</AvatarFallback></Avatar>
                  <div className="flex flex-col items-start text-left min-w-0"><span className="truncate font-medium">{sugg.displayName || sugg.mentionName}</span><span className="text-muted-foreground text-[11px] truncate">@{sugg.mentionName}</span></div>
                  <PlusCircle className="h-4 w-4 ml-auto text-primary flex-shrink-0"/>
                </Button>
              ))}
              {suggestionList.filter(sugg => sugg.userId !== ownerId && !currentUserIds.includes(sugg.userId)).length === 0 && searchVal && (<p className="text-xs text-muted-foreground text-center p-2">No new users found.</p>)}
            </PopoverContent>
          )}
        </Popover>
        <ScrollArea className="flex-grow min-h-0 rounded-md border p-1">
            <div className="space-y-1">
                <UserListItem userId={ownerId} onRemove={() => {}} onViewChanges={() => onViewUserChanges(ownerId)} canBeRemoved={false} isSaving={isSaving} isOwner={true} isAdmin={true} />
                {currentUserIds.map(uid => <UserListItem key={`item-${title}-${uid}`} userId={uid} onRemove={onRemoveInternal} onViewChanges={() => onViewUserChanges(uid)} canBeRemoved={true} isSaving={isSaving} isOwner={false} isAdmin={isEditorList || currentEditUserIds.includes(uid)} />)}
                {currentUserIds.length === 0 && (<p className="text-xs text-muted-foreground text-center py-2">No specific users added.</p>)}
            </div>
        </ScrollArea>
      </div>
    );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-full h-full p-0 flex flex-col sm:h-auto sm:w-auto sm:max-w-5xl sm:max-h-[90vh] sm:rounded-lg"
        showCloseButton={false}
      >
        <DialogHeader className="p-4 border-b flex-shrink-0 flex items-center justify-between relative">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Cancel">
                <X className="h-4 w-4" />
            </Button>
            
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <DialogTitle className="text-base sm:text-lg">Manage Permissions</DialogTitle>
            </div>

            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
            </Button>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="plan-visibility" className="text-sm flex items-center gap-1.5"><ShieldQuestion className="h-4 w-4 text-muted-foreground" />Visibility</Label>
                <Select value={visibility} onValueChange={(v) => setVisibility(v as PlanVisibility)} disabled={isSaving}>
                  <SelectTrigger id="plan-visibility" className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private"><div className="flex items-center gap-2 text-sm"><Lock className="h-3.5 w-3.5" /> Private</div></SelectItem>
                    <SelectItem value="unlisted"><div className="flex items-center gap-2 text-sm"><LinkIcon className="h-3.5 w-3.5" /> Unlisted</div></SelectItem>
                    <SelectItem value="public"><div className="flex items-center gap-2 text-sm"><Eye className="h-3.5 w-3.5" /> Public</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-editability" className="text-sm flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground" />Editability</Label>
                <Select value={editability} onValueChange={(v) => setEditability(v as PlanEditability)} disabled={isSaving}>
                  <SelectTrigger id="plan-editability" className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner_only"><div className="flex items-center gap-2 text-sm"><User className="h-3.5 w-3.5" /> Owner Only</div></SelectItem>
                    <SelectItem value="collaborators" disabled={visibility === 'private'}><div className="flex items-center gap-2 text-sm"><Users className="h-3.5 w-3.5" /> Collaborators</div></SelectItem>
                    <SelectItem value="everyone" disabled={visibility === 'unlisted' || visibility === 'private'}><div className="flex items-center gap-2 text-sm"><Globe className="h-3.5 w-3.5" /> All Authenticated Users</div></SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {isMobile ? (
              <Tabs defaultValue="view" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="view" disabled={visibility === 'public'}>View Access</TabsTrigger>
                  <TabsTrigger value="edit" disabled={editability !== 'collaborators'}>Edit Access</TabsTrigger>
                </TabsList>
                <TabsContent value="view" className="pt-4">
                  {visibility !== 'public' ? (
                     renderUserManagementSection("Who can view?", currentViewUserIds, viewPermissionsSearch, setViewPermissionsSearch, viewPermissionSuggestions, handleAddViewer, handleRemoveViewer, isViewSuggestionsOpen, setIsViewSuggestionsOpen, viewSearchInputRef, viewSuggestionsPopoverRef, false)
                  ) : (
                    <div className="text-center p-4 text-sm text-muted-foreground border rounded-md bg-muted/50">Public plans are visible to everyone.</div>
                  )}
                </TabsContent>
                <TabsContent value="edit" className="pt-4">
                  {editability === 'collaborators' ? (
                     renderUserManagementSection("Who can edit? (Collaborators)", currentEditUserIds, editPermissionsSearch, setEditPermissionsSearch, editPermissionSuggestions, handleAddEditor, handleRemoveEditor, isEditSuggestionsOpen, setIsEditSuggestionsOpen, editSearchInputRef, editSuggestionsPopoverRef, true)
                  ) : (
                     <div className="text-center p-4 text-sm text-muted-foreground border rounded-md bg-muted/50">Only the owner can edit this plan based on current settings.</div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {visibility !== 'public' ? (
                  renderUserManagementSection("Who can view?", currentViewUserIds, viewPermissionsSearch, setViewPermissionsSearch, viewPermissionSuggestions, handleAddViewer, handleRemoveViewer, isViewSuggestionsOpen, setIsViewSuggestionsOpen, viewSearchInputRef, viewSuggestionsPopoverRef, false)
                ) : (
                  <div className="sm:col-span-1 text-center p-4 text-sm text-muted-foreground border rounded-md bg-muted/50 flex items-center justify-center">Public plans are visible to everyone.</div>
                )}
                {editability === 'collaborators' ? (
                  renderUserManagementSection("Who can edit? (Collaborators)", currentEditUserIds, editPermissionsSearch, setEditPermissionsSearch, editPermissionSuggestions, handleAddEditor, handleRemoveEditor, isEditSuggestionsOpen, setIsEditSuggestionsOpen, editSearchInputRef, editSuggestionsPopoverRef, true)
                ) : (
                  <div className="sm:col-span-1 text-center p-4 text-sm text-muted-foreground border rounded-md bg-muted/50 flex items-center justify-center">Only the owner can edit this plan based on current settings.</div>
                )}
              </div>
            )}
            
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
