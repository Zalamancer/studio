
// src/app/news/page.tsx
"use client";

import React from 'react';
import { Newspaper, Info } from 'lucide-react'; // Removed Edit2 icon
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const NewsPage = () => {
  // Removed handleCreateNews function

  return (
    <div className="container mx-auto p-4 md:p-8 min-h-[calc(100vh-8rem)]">
      <header className="mb-8 text-center">
        {/* Removed "Create News" button from here */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground flex items-center justify-center">
          <Newspaper className="mr-3 h-8 w-8 text-primary" />
          Latest News & Updates
        </h1>
        <p className="text-lg text-muted-foreground mt-1">
          Stay informed about AnonyCollab and industry insights.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center text-center">
        <Card className="w-full max-w-2xl shadow-lg border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-2xl">
              <Info className="mr-2 h-6 w-6 text-blue-500" />
              Content Coming Soon!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              We're working hard to bring you the latest news, updates, and articles.
              Check back soon for exciting content related to anonymous B2B collaboration,
              industry trends, and platform enhancements.
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild variant="default">
                <Link href="/">Return to Homepage</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/discover">Discover Plans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewsPage;
