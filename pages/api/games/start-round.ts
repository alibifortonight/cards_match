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

// Function to get topics - always use embedded data
async function getTopics() {
  try {
    // Log the topics structure for debugging
    console.log('Topics structure:', JSON.stringify({
      hasMatch: !!embeddedTopics.match,
      matchLength: embeddedTopics.match.length,
      hasUnmatch: !!embeddedTopics.unmatch,
      unmatchLength: embeddedTopics.unmatch.length
    }));
    
    return embeddedTopics;
  } catch (error) {
    console.error('Error getting topics:', error);
    // Return default topics as fallback
    return {
      match: [
        { id: 'animals', name: 'Animals', description: 'Think of animals from around the world' },
        { id: 'countries', name: 'Countries', description: 'Name countries from any continent' }
      ],
      unmatch: [
        { id: 'emotions', name: 'Emotions', description: 'List different feelings and emotional states' },
        { id: 'colors', name: 'Colors', description: 'Name different colors and shades' }
      ]
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { gameId, playerId, currentRoundNumber } = req.body;

    if (!gameId || !playerId || currentRoundNumber === undefined) {
      return res.status(400).json({ error: 'Game ID, player ID, and current round number are required' });
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
      return res.status(403).json({ error: 'Only the host can start a new round' });
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

    // Check if we've reached the maximum number of rounds
    if (game.current_round >= game.round_count) {
      return res.status(400).json({ error: 'Maximum number of rounds reached' });
    }

    // Check if the current round is completed
    if (currentRoundNumber > 1) {
      // Only check for completion if this is not the first round
      const { data: currentRound, error: currentRoundError } = await supabase
        .from('rounds')
        .select('end_time')
        .eq('game_id', gameId)
        .eq('round_number', currentRoundNumber - 1)
        .single();

      if (currentRoundError) {
        console.error('Error checking current round:', currentRoundError);
        return res.status(500).json({ error: 'Failed to check current round status' });
      }

      if (!currentRound.end_time) {
        return res.status(400).json({ error: 'Current round is not completed yet' });
      }
    }

    // Load topics for the game
    let topics = await getTopics();

    // Get the round type from request body or determine it based on round number
    const roundType = req.body.roundType || (currentRoundNumber % 2 === 0 ? 'match' : 'unmatch');
    console.log('Using round type:', roundType);
    
    // Get the topic ID from request body or select a random one
    let topicId = req.body.topicId;
    let topicName = '';
    
    if (!topicId) {
      // Select a random topic for the round
      const availableTopics = topics[roundType as keyof TopicsCollection];
      if (!availableTopics || availableTopics.length === 0) {
        console.error('No topics available for type:', roundType);
        return res.status(500).json({ error: 'No topics available for the selected round type' });
      }
      
      const randomIndex = Math.floor(Math.random() * availableTopics.length);
      topicId = availableTopics[randomIndex].id;
      topicName = availableTopics[randomIndex].name;
    } else {
      // Find the topic name by ID
      const topicList = topics[roundType as keyof TopicsCollection];
      const topic = topicList.find((t: Topic) => t.id === topicId);
      if (!topic) {
        console.error('Topic not found with ID:', topicId);
        return res.status(404).json({ error: 'Topic not found' });
      }
      topicName = topic.name;
    }
    
    console.log('Selected topic ID:', topicId, 'name:', topicName);

    // Create a new round
    const newRoundNumber = currentRoundNumber; // Use the currentRoundNumber from the request
    const roundId = uuidv4();
    
    const { error: roundError } = await supabase
      .from('rounds')
      .insert({
        id: roundId,
        game_id: gameId,
        round_number: newRoundNumber,
        type: roundType,
        topic: topicName,
        topic_id: topicId,
        start_time: new Date().toISOString(),
        end_time: null
      });

    if (roundError) {
      throw roundError;
    }

    // Update the game's current round
    const { error: updateGameError } = await supabase
      .from('games')
      .update({ current_round: newRoundNumber })
      .eq('id', gameId);

    if (updateGameError) {
      throw updateGameError;
    }

    return res.status(200).json({
      success: true,
      message: 'New round started successfully',
      roundId,
      roundNumber: newRoundNumber,
      roundType,
      topic: topicName
    });
  } catch (error) {
    console.error('Error starting new round:', error);
    return res.status(500).json({ error: 'Failed to start new round' });
  }
}
