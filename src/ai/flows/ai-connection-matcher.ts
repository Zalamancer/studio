'use server';
/**
 * @fileOverview An AI-powered connection matcher for suggesting relevant collaborators.
 *
 * - aiConnectionMatcher - A function that suggests relevant connections based on post content and user profiles.
 * - AIConnectionMatcherInput - The input type for the aiConnectionMatcher function.
 * - AIConnectionMatcherOutput - The return type for the aiConnectionMatcher function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const AIConnectionMatcherInputSchema = z.object({
  postContent: z.string().describe('The content of the post.'),
  userProfile: z.string().describe('The user profile information.'),
  industry: z.string().describe('The industry of the user.'),
  tags: z.array(z.string()).describe('The tags associated with the post.'),
});
export type AIConnectionMatcherInput = z.infer<typeof AIConnectionMatcherInputSchema>;

const AIConnectionMatcherOutputSchema = z.object({
  suggestedConnections: z.array(z.string()).describe('A list of suggested user profiles for potential collaboration.'),
  reasoning: z.string().describe('The AI reasoning behind the suggested connections.'),
});
export type AIConnectionMatcherOutput = z.infer<typeof AIConnectionMatcherOutputSchema>;

export async function aiConnectionMatcher(input: AIConnectionMatcherInput): Promise<AIConnectionMatcherOutput> {
  return aiConnectionMatcherFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiConnectionMatcherPrompt',
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
  prompt: `You are an AI assistant designed to suggest relevant connections between users on a B2B collaboration platform.

  Based on the following post content, user profile, industry, and tags, identify potential collaborators and explain your reasoning.

  Post Content: {{{postContent}}}
  User Profile: {{{userProfile}}}
  Industry: {{{industry}}}
  Tags: {{#each tags}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  Suggest user profiles that would benefit from collaborating on this post and explain why. Adhere to the output schema.`, // Ensure Handlebars syntax is correctly applied
});

const aiConnectionMatcherFlow = ai.defineFlow<
  typeof AIConnectionMatcherInputSchema,
  typeof AIConnectionMatcherOutputSchema
>(
  {
    name: 'aiConnectionMatcherFlow',
    inputSchema: AIConnectionMatcherInputSchema,
    outputSchema: AIConnectionMatcherOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
