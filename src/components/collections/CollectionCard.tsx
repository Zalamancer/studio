
// src/components/collections/CollectionCard.tsx
"use client";

import React from 'react';
import type { ClientCollection } from '@/types/collection';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder, Edit3, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollectionCardProps {
  collection: ClientCollection;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const postCount = collection.postIds?.length || 0;

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", isSelected && "ring-2 ring-primary border-primary")}>
      <CardHeader className="p-4 pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-grow min-w-0">
            <Folder className={cn("h-5 w-5 flex-shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
            <CardTitle className="text-base font-semibold text-foreground truncate cursor-pointer hover:text-primary" onClick={onSelect}>
              {collection.name}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-1">
        {collection.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{collection.description}</p>
        )}
        <p className="text-xs text-muted-foreground">{postCount} {postCount === 1 ? 'post' : 'posts'}</p>
      </CardContent>
      <CardFooter className="p-3 border-t flex justify-end gap-1.5">
        <Button variant="ghost" size="xs" onClick={onSelect} className="text-xs h-7 px-2">
          <Eye className="h-3.5 w-3.5 mr-1" /> View Posts
        </Button>
        <Button variant="ghost" size="xs" onClick={onEdit} className="text-xs h-7 px-2">
          <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
        </Button>
        <Button variant="ghost" size="xs" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-7 px-2">
          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
};

    