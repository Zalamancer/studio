
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
import { TextWithMentions } from './TextWithMentions'; // Assuming TextWithMentions is now a separate component
import { IS_VALID_FIREBASE_UID_REGEX } from '@/lib/utils'; // Assuming this is centralized

interface PostDetailContentBodyProps {
  post: Post;
}

export const PostDetailContentBody: React.FC<PostDetailContentBodyProps> = React.memo(({ post }) => {
  return (
    <CardContent className="p-4 space-y-4">
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

      {post.requestType === 'help_request' ? (
        <div className="mt-4">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-transparent p-0 border-b-2 border-border rounded-none h-auto">
              <TabsTrigger value="details" className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">Problem Details</TabsTrigger>
              <TabsTrigger value="tried" disabled={!post.descriptionTried} className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">What I've Tried</TabsTrigger>
              <TabsTrigger value="outcome" disabled={!post.descriptionOutcome} className="text-xs px-3 py-2.5 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none rounded-none data-[state=active]:bg-primary/5 hover:bg-muted/50 focus-visible:ring-0 focus-visible:ring-offset-0">Expected Outcome</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
              {post.descriptionDetails ? (
                <p className="text-muted-foreground whitespace-pre-wrap">
                  <TextWithMentions text={post.descriptionDetails} mentionedUserIds={post.mentionedUserIds || []} IS_UID_REGEX_PAGE={IS_VALID_FIREBASE_UID_REGEX} />
                </p>
              ) : (
                <p className="text-muted-foreground italic">No details provided.</p>
              )}
            </TabsContent>
            {post.descriptionTried && (
              <TabsContent value="tried" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                <p className="text-muted-foreground whitespace-pre-wrap">{post.descriptionTried}</p>
              </TabsContent>
            )}
            {post.descriptionOutcome && (
              <TabsContent value="outcome" className="mt-0 border border-border border-t-0 rounded-b-md p-3 shadow-inner bg-background min-h-[100px]">
                <p className="text-muted-foreground whitespace-pre-wrap">{post.descriptionOutcome}</p>
              </TabsContent>
            )}
          </Tabs>
        </div>
      ) : (
        post.description && (
          <div>
            <strong className="text-foreground">Details:</strong>
            <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
              <TextWithMentions text={post.description} mentionedUserIds={post.mentionedUserIds || []} IS_UID_REGEX_PAGE={IS_VALID_FIREBASE_UID_REGEX} />
            </p>
          </div>
        )
      )}

      <div className="grid grid-cols-1 gap-y-2 mt-4 border-t pt-4">
        <div> <strong className="block text-foreground">Sector:</strong> <span className="text-muted-foreground">{post.sector || 'N/A'}</span> </div>
        {post.subSector && (<div> <strong className="block text-foreground">Sub-Sector:</strong> <span className="text-muted-foreground">{post.subSector}</span> </div>)}
        {post.industry && (<div> <strong className="block text-foreground">Industry:</strong> <span className="text-muted-foreground">{post.industry}</span> </div>)}
        {post.naicsCode && (<div> <strong className="block text-foreground">NAICS Code:</strong> <Badge variant="outline" className="text-xs ml-1">{post.naicsCode}</Badge> </div>)}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
        <div> <strong className="block text-foreground">Business Type:</strong> <span className="text-muted-foreground">{post.businessType || 'N/A'}</span> </div>
        <div className="flex items-center gap-2"> <strong className="text-foreground">Safety Indicator:</strong> <span className={post.safetyIndicator === 'High' ? "text-green-500" : post.safetyIndicator === 'Medium' ? "text-yellow-500" : "text-red-500"}>{post.safetyIndicator || 'N/A'}</span> </div>
      </div>
    </CardContent>
  );
});

PostDetailContentBody.displayName = 'PostDetailContentBody';
