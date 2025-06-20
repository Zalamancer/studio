
// src/types/news.ts
import type { Timestamp, FieldValue } from 'firebase/firestore';

export type NewsArticleStatus = 'draft' | 'published';

export interface NewsArticle {
  id: string;
  userId: string;
  title: string;
  tags?: string[] | null;
  content: string;
  draftContent?: string | null;
  hasUnpublishedChanges?: boolean;
  coverImageUrl?: string | null;
  status: NewsArticleStatus;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  publishedAt?: Timestamp | FieldValue | null;

  likeCount?: number;
  likedBy?: string[];
  commentCount?: number;
}

export type NewNewsArticleData = Omit<NewsArticle, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt' | 'draftContent' | 'hasUnpublishedChanges' | 'likeCount' | 'likedBy' | 'commentCount'> & {
  createdAt?: FieldValue;
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | null;
  draftContent?: string | null;
  hasUnpublishedChanges?: boolean;
  likeCount?: number;
  likedBy?: string[];
  commentCount?: number;
  tags?: string[] | null;
};

export type UpdateNewsArticleData = Partial<Pick<NewsArticle,
  'title' | 'content' | 'status' | 'coverImageUrl' |
  'draftContent' | 'hasUnpublishedChanges' |
  'tags' | 'likeCount' | 'likedBy' // commentCount is updated via specific functions
>> & {
  updatedAt?: FieldValue;
  publishedAt?: FieldValue | Timestamp | null;
};


export interface ClientNewsArticle extends Omit<NewsArticle, 'createdAt' | 'updatedAt' | 'publishedAt' | 'draftContent' | 'hasUnpublishedChanges'> {
  createdAt: number; // Milliseconds
  updatedAt: number; // Milliseconds
  publishedAt?: number | null; // Milliseconds
  draftContent?: string | null;
  hasUnpublishedChanges?: boolean;
  tags?: string[] | null;
  likeCount?: number;
  likedBy?: string[];
  commentCount?: number;
}

