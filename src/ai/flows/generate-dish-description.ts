'use server';
/**
 * @fileOverview A Genkit flow for generating attractive and creative descriptions for menu items.
 *
 * - generateDishDescription - A function that handles the dish description generation process.
 * - GenerateDishDescriptionInput - The input type for the generateDishDescription function.
 * - GenerateDishDescriptionOutput - The return type for the generateDishDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDishDescriptionInputSchema = z.object({
  dishName: z.string().describe('The name of the dish.'),
  ingredients: z
    .array(z.string())
    .describe('A list of key ingredients in the dish.'),
  cuisineType: z
    .string()
    .optional()
    .describe('The type of cuisine the dish belongs to (e.g., Italian, Mexican, Fusion).'),
  descriptionTone: z
    .string()
    .optional()
    .describe('The desired tone for the description (e.g., elegant, rustic, casual, modern).'),
});
export type GenerateDishDescriptionInput = z.infer<
  typeof GenerateDishDescriptionInputSchema
>;

const GenerateDishDescriptionOutputSchema = z.object({
  description: z
    .string()
    .describe('The AI-generated attractive and creative description for the dish.'),
});
export type GenerateDishDescriptionOutput = z.infer<
  typeof GenerateDishDescriptionOutputSchema
>;

export async function generateDishDescription(
  input: GenerateDishDescriptionInput
): Promise<GenerateDishDescriptionOutput> {
  return generateDishDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateDishDescriptionPrompt',
  input: {schema: GenerateDishDescriptionInputSchema},
  output: {schema: GenerateDishDescriptionOutputSchema},
  prompt: `You are a skilled culinary writer specializing in creating enticing and attractive descriptions for restaurant menus.
Your goal is to craft a creative, vivid, and appealing description for the following dish that will make customers eager to try it.
The description should be between 50 and 150 words.

Dish Name: {{{dishName}}}
Key Ingredients: {{#each ingredients}}- {{{this}}}{{/each}}
{{#if cuisineType}}Cuisine Type: {{{cuisineType}}}{{/if}}
{{#if descriptionTone}}Desired Tone: {{{descriptionTone}}}{{/if}}

Generate the description now:`,
});

const generateDishDescriptionFlow = ai.defineFlow(
  {
    name: 'generateDishDescriptionFlow',
    inputSchema: GenerateDishDescriptionInputSchema,
    outputSchema: GenerateDishDescriptionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
