import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

// Define all game topics directly in this file
const embeddedTopics: TopicsCollection = {
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

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gameId, playerId } = req.body;

    if (!gameId || !playerId) {
      return res.status(400).json({ error: 'Game ID and player ID are required' });
    }

    // Check if the player is the host
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .eq('game_id', gameId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (!player.is_host) {
      return res.status(403).json({ error: 'Only the host can start the game' });
    }

    // Get the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Game has already started' });
    }

    // Count the number of players
    const { count, error: countError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    if (countError) {
      throw countError;
    }

    // Check if we have at least 2 players
    if (!count || count < 2) {
      return res.status(400).json({ error: 'At least 2 players are required to start the game' });
    }

    // Determine the first round type (match or unmatch)
    const firstRoundType = Math.random() < 0.5 ? 'match' : 'unmatch';
    
    // Select a random topic for the first round
    const availableTopics = embeddedTopics[firstRoundType];
    if (!availableTopics || availableTopics.length === 0) {
      console.error('No topics available for type:', firstRoundType);
      return res.status(500).json({ error: 'No topics available for the selected round type' });
    }
    
    const randomTopicIndex = Math.floor(Math.random() * availableTopics.length);
    const firstTopic = availableTopics[randomTopicIndex];
    
    console.log("Selected topic:", firstTopic);

    // Update game status to in-progress
    const { error: updateError } = await supabase
      .from('games')
      .update({ status: 'in-progress' })
      .eq('id', gameId);

    if (updateError) {
      console.error('Error updating game status:', updateError);
      return res.status(500).json({ error: 'Failed to update game status' });
    }

    // Start the first round
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/games/start-round`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gameId,
        playerId, // Use the playerId from the request body
        currentRoundNumber: 1, // This is the first round
        roundType: firstRoundType,
        // Use embedded topics directly instead of fetching from an API
        topicId: embeddedTopics[firstRoundType][randomTopicIndex].id,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error starting round:', errorData);
      return res.status(response.status).json({ error: 'Failed to start the first round' });
    }

    return res.status(200).json({
      success: true,
      message: 'Game started successfully',
    });
  } catch (error) {
    console.error('Error starting game:', error);
    return res.status(500).json({ error: 'Failed to start game' });
  }
}
