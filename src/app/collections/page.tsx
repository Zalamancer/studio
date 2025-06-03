
// src/app/collections/page.tsx
"use client";

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { getUserCollections, deleteCollection } from '@/services/collectionService';
import type { ClientCollection } from '@/types/collection';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { EditCollectionDialog } from '@/components/collections/EditCollectionDialog';
import { SelectedCollectionPosts } from '@/components/collections/SelectedCollectionPosts';
import { Button } from '@/components/ui/button';
import { Loader2, FolderOpen, AlertTriangle, PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MyCollectionsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedCollection, setSelectedCollection] = useState<ClientCollection | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<ClientCollection | null>(null);
  const [collectionToDeleteId, setCollectionToDeleteId] = useState<string | null>(null);

  const { data: collections = [], isLoading: isLoadingCollections, error } = useQuery<ClientCollection[]>({
    queryKey: ['userCollections', user?.uid],
    queryFn: () => user ? getUserCollections(user.uid) : Promise.resolve([]),
    enabled: !!user && !authLoading,
  });

  const deleteCollectionMutation = useMutation({
    mutationFn: (collectionId: string) => {
      if (!user) throw new Error("User not authenticated.");
      return deleteCollection(collectionId, user.uid);
    },
    onSuccess: (_, collectionId) => {
      toast({ title: "Collection Deleted", description: "The collection has been successfully removed." });
      queryClient.invalidateQueries({ queryKey: ['userCollections', user?.uid] });
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null);
      }
      setCollectionToDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error Deleting Collection", description: error.message });
      setCollectionToDeleteId(null);
    },
  });

  const handleSelectCollection = useCallback((collection: ClientCollection) => {
    setSelectedCollection(collection);
  }, []);

  const handleEditCollection = useCallback((collection: ClientCollection) => {
    setCollectionToEdit(collection);
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteCollection = useCallback((collectionId: string) => {
    setCollectionToDeleteId(collectionId);
  }, []);

  const confirmDeleteCollection = () => {
    if (collectionToDeleteId) {
      deleteCollectionMutation.mutate(collectionToDeleteId);
    }
  };

  const handleCollectionUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['userCollections', user?.uid] });
    if (selectedCollection && collectionToEdit && selectedCollection.id === collectionToEdit.id) {
      // Re-select the collection to show updated details if it was the one being viewed
      const updatedCollection = collections.find(c => c.id === collectionToEdit.id);
      if (updatedCollection) setSelectedCollection(updatedCollection);
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
    // Redirect to login or show a message
    // router.push('/login'); // Or use a more user-friendly approach
    return (
      <div className="container mx-auto p-4 md:p-8 text-center min-h-[calc(100vh-10rem)] flex flex-col justify-center items-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg font-semibold text-foreground">Access Denied</p>
        <p className="text-muted-foreground">Please log in to view your collections.</p>
        <Button onClick={() => router.push('/login')} className="mt-6">Log In</Button>
      </div>
    );
  }
  
  if (error) {
    return <div className="container mx-auto p-4 md:p-8 text-destructive text-center">Error loading collections: {error.message}</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center">
          <FolderOpen className="mr-3 h-8 w-8 text-primary" />
          My Collections
        </h1>
        <p className="text-muted-foreground mt-1">
          Organize, view, and manage your saved posts.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Your Saved Collections</h2>
          {isLoadingCollections ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4 border rounded-lg bg-card shadow-sm animate-pulse">
                <div className="h-5 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))
          ) : collections.length === 0 ? (
            <p className="text-muted-foreground text-sm border p-4 rounded-md bg-muted/30">
              You haven&apos;t created any collections yet. Save posts from the main board to start!
            </p>
          ) : (
            collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                isSelected={selectedCollection?.id === collection.id}
                onSelect={() => handleSelectCollection(collection)}
                onEdit={() => handleEditCollection(collection)}
                onDelete={() => handleDeleteCollection(collection.id)}
              />
            ))
          )}
        </div>

        <div className="md:col-span-2">
          {selectedCollection ? (
            <SelectedCollectionPosts
              key={selectedCollection.id} // Force re-mount if collection changes
              collection={selectedCollection}
              currentUserId={user.uid}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 border-2 border-dashed rounded-lg bg-muted/30 text-muted-foreground">
              <FolderOpen className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a collection to view its posts.</p>
              <p className="text-sm mt-1">Or, create a new collection when saving a post.</p>
            </div>
          )}
        </div>
      </div>

      {collectionToEdit && (
        <EditCollectionDialog
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          collectionToEdit={collectionToEdit}
          onCollectionUpdated={handleCollectionUpdated}
        />
      )}

      <AlertDialog open={!!collectionToDeleteId} onOpenChange={(open) => !open && setCollectionToDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the collection &quot;{collections.find(c => c.id === collectionToDeleteId)?.name || 'this collection'}&quot;?
              This will not delete the posts themselves, only remove them from this collection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCollectionToDeleteId(null)} disabled={deleteCollectionMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCollection}
              disabled={deleteCollectionMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteCollectionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete Collection
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyCollectionsPage;

    