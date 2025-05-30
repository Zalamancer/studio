// src/components/board-page/PostDetailContentBody.tsx
"use client";

import React from 'react';
import Image from 'next/image';
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Post } from '@/types/post';
import { TextWithMentions } from './TextWithMentions'; // Assuming this is in the same directory or correct path
import { cn } from '@/lib/utils';

interface PostDetailContentBodyProps {
  post: Post;
}

export const PostDetailContentBody: React.FC<PostDetailContentBodyProps> = React.memo(({ post }) => {
  return (
    <div className="p-4 space-y-4">
      {post.imageUrls && post.imageUrls.length > 0 && (
        <div className="mb-4 rounded-lg overflow-hidden shadow-md">
          <Carousel className="w-full">
            <CarouselContent>
              {post.imageUrls.map((url, index) => (
                <CarouselItem key={index}>
                  <div className="aspect-video relative">
                    <Image
                      src={url} alt={`Post image ${index + 1}`} fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      style={{ objectFit: 'contain' }} className="rounded-md"
                      data-ai-hint={post.tags && post.tags.length > 0 ? post.tags.slice(0,2).join(' ') : 'abstract'}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            {post.imageUrls.length > 1 && (
              <> <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2" /> <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2" /> </>
            )}
          </Carousel>
        </div>
      )}

      <div className="mt-4">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="inline-flex h-auto items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
            <TabsTrigger
              value="details"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1"
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              value="tried"
              disabled={!post.descriptionTried}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1"
            >
              What Was Tried
            </TabsTrigger>
            <TabsTrigger
              value="outcome"
              disabled={!post.descriptionOutcome}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-xs sm:text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex-1"
            >
              Expected Outcome
            </TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-2 rounded-md border p-3 bg-background min-h-[100px]">
            {post.descriptionDetails ? (
              <p className="text-muted-foreground whitespace-pre-wrap">
                <TextWithMentions text={post.descriptionDetails} mentionedUserIds={post.mentionedUserIds || []} />
              </p>
            ) : (
              <p className="text-muted-foreground italic">No details provided.</p>
            )}
          </TabsContent>
          {post.descriptionTried && (
            <TabsContent value="tried" className="mt-2 rounded-md border p-3 bg-background min-h-[100px]">
              <p className="text-muted-foreground whitespace-pre-wrap">{post.descriptionTried}</p>
            </TabsContent>
          )}
          {post.descriptionOutcome && (
            <TabsContent value="outcome" className="mt-2 rounded-md border p-3 bg-background min-h-[100px]">
              <p className="text-muted-foreground whitespace-pre-wrap">{post.descriptionOutcome}</p>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4 text-sm">
        {/* Column 1 */}
        <div className="space-y-2">
          <div>
            <strong className="block text-foreground">Sector:</strong>
            <span className="text-muted-foreground">{post.sector || 'N/A'}</span>
          </div>
          {post.industry && (
            <div>
              <strong className="block text-foreground">Industry:</strong>
              <span className="text-muted-foreground">{post.industry}</span>
            </div>
          )}
        </div>
        {/* Column 2 */}
        <div className="space-y-2">
          {post.subSector && (
            <div>
              <strong className="block text-foreground">Sub-Sector:</strong>
              <span className="text-muted-foreground">{post.subSector}</span>
            </div>
          )}
          {post.naicsCode && (
            <div>
              <strong className="block text-foreground">NAICS Code:</strong>
              <Badge variant="outline" className="text-xs ml-1">{post.naicsCode}</Badge>
            </div>
          )}
        </div>
      </div>

      {/* Business Type and Safety Indicator removed from display
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4 text-sm">
        <div>
          <strong className="block text-foreground">Business Type:</strong>
          <span className="text-muted-foreground">{post.businessType || 'N/A'}</span>
        </div>
        <div className="flex items-center gap-2">
          <strong className="text-foreground">Safety Indicator:</strong>
          <span className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
            post.safetyIndicator === 'High' ? "bg-green-100 text-green-700 border-green-300" :
            post.safetyIndicator === 'Medium' ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
            "bg-red-100 text-red-700 border-red-300"
          )}>
            {post.safetyIndicator || 'N/A'}
          </span>
        </div>
      </div>
      */}
    </div>
  );
});

PostDetailContentBody.displayName = 'PostDetailContentBody';
