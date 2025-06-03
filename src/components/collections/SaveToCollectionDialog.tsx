
// src/components/collections/SaveToCollectionDialog.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react'; // Added useRef
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, PlusCircle, Bookmark } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserCollections,
  createCollection,
  addPostToCollection,
  removePostFromCollection,
} from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import { cn } from '@/lib/utils';

interface SaveToCollectionDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
}

const saveToCollectionSchema = z.object({
  selectedCollectionIds: z.array(z.string()),
  newCollectionName: z.string().optional(),
  newCollectionDescription: z.string().optional(),
});

type SaveToCollectionFormData = z.infer<typeof saveToCollectionSchema>;

export const SaveToCollectionDialog: React.FC<SaveToCollectionDialogProps> = ({
  isOpen,
  onOpenChange,
  postId,
  postTitle,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateNewCollection, setShowCreateNewCollection] = useState(false);
  const prevIsOpenRef = useRef<boolean>(isOpen); // Ref to track previous isOpen state

  const { data: collectionsDataFromQuery = [], isLoading: isLoadingCollections } = useQuery<ClientCollection[]>({
    queryKey: ['userCollections', user?.uid],
    queryFn: () => user ? getUserCollections(user.uid) : Promise.resolve([]),
    enabled: !!user && isOpen,
  });

  const form = useForm<SaveToCollectionFormData>({
    resolver: zodResolver(saveToCollectionSchema),
    defaultValues: {
      selectedCollectionIds: [],
      newCollectionName: '',
      newCollectionDescription: '',
    },
  });

  useEffect(() => {
    // Only reset the form when the dialog *opens* (isOpen becomes true from false)
    if (isOpen && !prevIsOpenRef.current && user) {
      const cachedCollections = queryClient.getQueryData<ClientCollection[]>(['userCollections', user.uid]);
      const currentCollections = cachedCollections || collectionsDataFromQuery || [];

      const preselectedIds = currentCollections
        .filter(c => c.postIds?.includes(postId))
        .map(c => c.id);

      form.reset({
        selectedCollectionIds: preselectedIds,
        newCollectionName: '',
        newCollectionDescription: '',
      });
      setShowCreateNewCollection(false); // Reset create new form visibility
    }

    // When dialog closes, ensure create new form section is hidden
    // and optionally reset form fields if needed (though opening reset is often primary)
    if (!isOpen && prevIsOpenRef.current) {
      setShowCreateNewCollection(false);
      // Consider if a full form.reset() is needed on every close, or if open is sufficient.
      // For now, keeping it simple: reset create form visibility.
      // If form state needs to be pristine on every open regardless of cache, add form.reset here too.
    }

    prevIsOpenRef.current = isOpen; // Update the ref after logic has run
  }, [isOpen, user, postId, queryClient, form, collectionsDataFromQuery]);


  const manageCollectionsMutation = useMutation({
    mutationFn: async (data: SaveToCollectionFormData) => {
      if (!user) throw new Error("User not authenticated.");

      let newCollectionId: string | null = null;
      if (showCreateNewCollection && data.newCollectionName?.trim()) {
        newCollectionId = await createCollection(
          user.uid,
          data.newCollectionName.trim(),
          data.newCollectionDescription?.trim() || undefined,
          postId
        );
      }

      const currentSelections = data.selectedCollectionIds;
      const initialSelections = collectionsDataFromQuery.filter(c => c.postIds?.includes(postId)).map(c => c.id);

      const collectionsToAddPostTo = currentSelections.filter(id => !initialSelections.includes(id));
      const collectionsToRemovePostFrom = initialSelections.filter(id => !currentSelections.includes(id));

      if (newCollectionId) {
        const idx = collectionsToAddPostTo.indexOf(newCollectionId);
        if (idx > -1) collectionsToAddPostTo.splice(idx, 1);
      }

      for (const collectionId of collectionsToAddPostTo) {
        await addPostToCollection(collectionId, postId, user.uid);
      }
      for (const collectionId of collectionsToRemovePostFrom) {
        await removePostFromCollection(collectionId, postId, user.uid);
      }
      return { newCollectionId, added: collectionsToAddPostTo.length, removed: collectionsToRemovePostFrom.length };
    },
    onSuccess: ({ newCollectionId, added, removed }) => {
      queryClient.invalidateQueries({ queryKey: ['userCollections', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['collectionDetails'] });
      let message = "Post saved to collections.";
      if (newCollectionId) message = `Post saved to new collection and updated in others.`;
      else if (added > 0 && removed > 0) message = "Collection selections updated.";
      else if (added > 0) message = "Post added to selected collections.";
      else if (removed > 0) message = "Post removed from deselected collections.";
      toast({ title: "Success", description: message });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message || "Could not update collections." });
    },
  });

  const onSubmit = (data: SaveToCollectionFormData) => {
    if (showCreateNewCollection && !data.newCollectionName?.trim()) {
        form.setError("newCollectionName", { type: "manual", message: "New collection name is required."});
        return;
    }
    manageCollectionsMutation.mutate(data);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2"><Bookmark className="h-5 w-5 text-primary" /> Save to Collection</DialogTitle>
          <DialogDescription>
            Save "{postTitle.substring(0, 50)}{postTitle.length > 50 ? '...' : ''}" to one or more collections.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <Label className="font-medium">Your Collections</Label>
            {isLoadingCollections ? (
              <div className="flex justify-center items-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : collectionsDataFromQuery.length === 0 && !showCreateNewCollection ? (
              <p className="text-sm text-muted-foreground text-center py-2">
                You have no collections yet. Create one below!
              </p>
            ) : (
              <ScrollArea className={cn("max-h-40 pr-3", collectionsDataFromQuery.length > 0 ? "border rounded-md p-3" : "")}>
                <div className="space-y-2">
                  {collectionsDataFromQuery.map((collection) => (
                    <Controller
                      key={collection.id}
                      name="selectedCollectionIds"
                      control={form.control}
                      render={({ field }) => {
                        const isChecked = field.value?.includes(collection.id);
                        return (
                          <div
                            className={cn(
                              "flex items-center space-x-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors",
                              isChecked && "bg-muted"
                            )}
                            onClick={() => {
                              const currentSelectedIds = field.value || [];
                              let newSelectedIds;
                              if (isChecked) {
                                newSelectedIds = currentSelectedIds.filter((id) => id !== collection.id);
                              } else {
                                newSelectedIds = [...currentSelectedIds, collection.id];
                              }
                              field.onChange(newSelectedIds);
                            }}
                          >
                            <Checkbox
                              id={`collection-${collection.id}`}
                              checked={isChecked}
                              onCheckedChange={(checkedParam) => {
                                const isNowChecked = typeof checkedParam === 'boolean' ? checkedParam : false;
                                const currentSelectedIds = field.value || [];
                                let newSelectedIds;
                                if (isNowChecked) {
                                  newSelectedIds = [...currentSelectedIds, collection.id];
                                } else {
                                  newSelectedIds = currentSelectedIds.filter((id) => id !== collection.id);
                                }
                                field.onChange(newSelectedIds);
                              }}
                              className="flex-shrink-0"
                              disabled={manageCollectionsMutation.isPending}
                            />
                            <Label htmlFor={`collection-${collection.id}`} className="text-sm font-normal text-foreground truncate cursor-pointer">
                              {collection.name}
                            </Label>
                          </div>
                        );
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
            {form.formState.errors.selectedCollectionIds && (
                 <p className="text-xs text-destructive">{form.formState.errors.selectedCollectionIds.message}</p>
            )}

            <div className="pt-3">
              {!showCreateNewCollection ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateNewCollection(true)}
                  disabled={manageCollectionsMutation.isPending}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Create New Collection
                </Button>
              ) : (
                <div className="space-y-3 p-3 border rounded-md bg-muted/20">
                  <h4 className="text-sm font-medium">Create New Collection</h4>
                  <div className="space-y-1">
                    <Label htmlFor="newCollectionName" className="text-xs">Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="newCollectionName"
                      placeholder="e.g., Marketing Ideas"
                      {...form.register('newCollectionName')}
                      disabled={manageCollectionsMutation.isPending}
                      className={cn(form.formState.errors.newCollectionName && "border-destructive")}
                    />
                    {form.formState.errors.newCollectionName && (
                        <p className="text-xs text-destructive">{form.formState.errors.newCollectionName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="newCollectionDescription" className="text-xs">Description (Optional)</Label>
                    <Input
                      id="newCollectionDescription"
                      placeholder="Briefly describe this collection"
                      {...form.register('newCollectionDescription')}
                      disabled={manageCollectionsMutation.isPending}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setShowCreateNewCollection(false);
                        form.setValue('newCollectionName', '');
                        form.setValue('newCollectionDescription', '');
                        form.clearErrors('newCollectionName');
                    }}
                    className="text-xs text-muted-foreground"
                    disabled={manageCollectionsMutation.isPending}
                  >
                    Cancel Create New
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="p-6 pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={manageCollectionsMutation.isPending}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={manageCollectionsMutation.isPending || isLoadingCollections}>
              {manageCollectionsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
