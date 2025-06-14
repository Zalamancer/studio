
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
  userProfile: z.string().describe('The viewing user profile information (e.g., their industry, expertise summary).'), // Clarified this is the VIEWING user
  industry: z.string().describe('The industry of the viewing user.'), // Clarified this is the VIEWING user
  tags: z.array(z.string()).describe('The tags associated with the post.'),
});
export type ConnectionSuggestionsInput = z.infer<typeof ConnectionSuggestionsInputSchema>;

const ConnectionSuggestionsOutputSchema = z.object({
  suggestedConnections: z.array(z.string()).describe('A list of suggested types of collaborators or expertise areas for potential collaboration (e.g., "A data analyst", "Experts in international trade"). Max 3-4 suggestions.'),
  reasoning: z.string().describe('The AI reasoning behind the suggested types of connections or expertise areas.'),
});
export type ConnectionSuggestionsOutput = z.infer<typeof ConnectionSuggestionsOutputSchema>;

export async function connectionSuggestions(input: ConnectionSuggestionsInput): Promise<ConnectionSuggestionsOutput> {
  return connectionSuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'connectionSuggestionsPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {
    schema: z.object({ // Input schema for the prompt itself
      postContent: z.string().describe('The content of the post.'),
      userProfile: z.string().describe('The viewing user profile information (e.g., their industry, expertise summary).'),
      industry: z.string().describe('The industry of the viewing user.'),
      tags: z.array(z.string()).describe('The tags associated with the post.'),
    }),
  },
  output: { // Output schema defined here
    schema: ConnectionSuggestionsOutputSchema, // Reference the one defined above
  },
  prompt: `You are an AI assistant designed to suggest relevant types of collaborators or areas of expertise for a B2B collaboration platform, given a post's content, the viewing user's profile, their industry, and associated tags.

  Post Content: {{{postContent}}}
  Viewing User Profile: {{{userProfile}}}
  Viewing User Industry: {{{industry}}}
  Post Tags: {{#each tags}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

  Identify up to 3-4 types of collaborators or specific expertise areas that would be beneficial for the viewing user to connect with regarding this post.
  For each suggestion, provide a brief explanation of why this type of collaborator or expertise would be valuable in the context of the post.
  If specific user profiles are not immediately obvious from the provided information, focus on suggesting general roles, skills, or business types. The goal is to provide actionable advice.
  Ensure your output adheres to the schema. The 'suggestedConnections' should be descriptions of these types or expertise areas (e.g., "A data analyst", "Experts in international trade"). Return the reasoning as a well-structured explanation for the suggestions.
  If you truly cannot find any relevant suggestions, you may indicate that, but strive to offer some general guidance if possible.`,
});

const connectionSuggestionsFlow = ai.defineFlow(
  {
    name: 'connectionSuggestionsFlow',
    inputSchema: ConnectionSuggestionsInputSchema,
    outputSchema: ConnectionSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input); // model is defined in the prompt object
    if (!output) {
      console.warn("[connection-suggestions.ts] AI prompt did not return an output for input:", input);
      // Return a default "no suggestions" output that matches the schema
      return {
        suggestedConnections: ["No specific types of collaborators suggested by AI at this time."],
        reasoning: "The AI could not identify specific types of collaborators based on the provided information. Consider broadening your search or looking for general expertise in the post's domain."
      };
    }
     // Ensure output.suggestedConnections is an array, even if empty
     if (!output.suggestedConnections || output.suggestedConnections.length === 0) {
      return {
        suggestedConnections: ["No specific types of collaborators suggested by AI at this time."],
        reasoning: output.reasoning || "The AI could not identify specific types of collaborators or provide detailed reasoning based on the provided information."
      };
    }
    return output;
  }
);
