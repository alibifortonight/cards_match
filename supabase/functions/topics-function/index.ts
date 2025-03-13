// Follow Deno's module import pattern
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Define topic interface
interface Topic {
  id: string;
  name: string;
  description: string;
}

interface TopicsCollection {
  match: Topic[];
  unmatch: Topic[];
}

// Define all game topics
const topics: TopicsCollection = {
  match: [
    { id: 'animals', name: 'Animals', description: 'Think of animals from around the world' },
    { id: 'countries', name: 'Countries', description: 'Name countries from any continent' },
    { id: 'food', name: 'Food', description: 'List different types of food and dishes' },
    { id: 'sports', name: 'Sports', description: 'Name sports played around the world' },
    { id: 'movies', name: 'Movies', description: 'Think of movie titles from any genre or era' },
    { id: 'professions', name: 'Professions', description: 'List different jobs and career paths' },
    { id: 'cities', name: 'Cities', description: 'Name cities from around the world' },
    { id: 'musical_instruments', name: 'Musical Instruments', description: 'List instruments used to make music' },
    { id: 'hobbies', name: 'Hobbies', description: 'Think of activities people do for fun' },
    { id: 'famous_people', name: 'Famous People', description: 'Name well-known celebrities, historical figures, or public personalities' }
  ],
  unmatch: [
    { id: 'emotions', name: 'Emotions', description: 'List different feelings and emotional states' },
    { id: 'colors', name: 'Colors', description: 'Name different colors and shades' },
    { id: 'weather', name: 'Weather Phenomena', description: 'Think of different weather conditions and events' },
    { id: 'body_parts', name: 'Body Parts', description: 'List different parts of the human body' },
    { id: 'transportation', name: 'Transportation', description: 'Name different modes of transportation' },
    { id: 'furniture', name: 'Furniture', description: 'Think of items found in homes and offices' },
    { id: 'school_subjects', name: 'School Subjects', description: 'List academic subjects taught in schools' },
    { id: 'clothing', name: 'Clothing Items', description: 'Name different articles of clothing' },
    { id: 'nature', name: 'Nature', description: 'Think of natural elements, landscapes, and phenomena' },
    { id: 'technology', name: 'Technology', description: 'List gadgets, devices, and technological concepts' }
  ]
};

serve(async (req: Request) => {
  // Enable CORS
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  return new Response(
    JSON.stringify(topics),
    { headers }
  );
});
