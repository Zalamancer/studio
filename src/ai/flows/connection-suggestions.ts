'use server';
/**
 * @fileOverview An AI-powered connection suggestion flow.
 *
 * - connectionSuggestions - A function that suggests relevant connections based on post content and user profiles.
 * - ConnectionSuggestionsInput - The input type for the connectionSuggestions function.
 * - ConnectionSuggestionsOutput - The return type for the connectionSuggestions function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ConnectionSuggestionsInputSchema = z.object({
  postContent: z.string().describe('The content of the post.'),
  userProfile: z.string().describe('The user profile information.'),
  industry: z.string().describe('The industry of the user.'),
  tags: z.array(z.string()).describe('The tags associated with the post.'),
});
export type ConnectionSuggestionsInput = z.infer<typeof ConnectionSuggestionsInputSchema>;

const ConnectionSuggestionsOutputSchema = z.object({
  suggestedConnections: z.array(z.string()).describe('A list of suggested user profiles for potential collaboration.'),
  reasoning: z.string().describe('The AI reasoning behind the suggested connections.'),
});
export type ConnectionSuggestionsOutput = z.infer<typeof ConnectionSuggestionsOutputSchema>;

export async function connectionSuggestions(input: ConnectionSuggestionsInput): Promise<ConnectionSuggestionsOutput> {
  return connectionSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'connectionSuggestionsPrompt',
  model: 'googleai/gemini-1.5-flash-latest', // Added model parameter
  input: {
    schema: z.object({
      postContent: z.string().describe('The content of the post.'),
      userProfile: z.string().describe('The user profile information.'),
      industry: z.string().describe('The industry of the user.'),
      tags: z.array(z.string()).describe('The tags associated with the post.'),
    }),
  },
  output: {
    schema: z.object({
      suggestedConnections: z.array(z.string()).describe('A list of suggested user profiles for potential collaboration.'),
      reasoning: z.string().describe('The AI reasoning behind the suggested connections.'),
    }),
  },
  prompt: `You are an AI assistant designed to suggest relevant connections between users on a B2B collaboration platform, given a post's content, the user's profile, industry, and associated tags.

  Post Content: {{{postContent}}}
  User Profile: {{{userProfile}}}
  Industry: {{{industry}}}
  Tags: {{#each tags}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  Suggest user profiles that would benefit from collaborating on this post and explain your reasoning. Adhere to the output schema. Return the suggested connections as a list of user profile strings. Return the reasoning as a well-structured explanation for each suggestion.`,
});

const connectionSuggestionsFlow = ai.defineFlow<
  typeof ConnectionSuggestionsInputSchema,
  typeof ConnectionSuggestionsOutputSchema
>({
  name: 'connectionSuggestionsFlow',
  inputSchema: ConnectionSuggestionsInputSchema,
  outputSchema: ConnectionSuggestionsOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
