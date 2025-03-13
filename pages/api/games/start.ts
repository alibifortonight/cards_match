import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { loadTopicsFromAPI } from '../../../lib/topicsManager';

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

    // Load topics for the game
    let topics;
    try {
      topics = await loadTopicsFromAPI();
      console.log("Loaded topics:", topics);
    } catch (error) {
      console.error('Error loading topics:', error);
      return res.status(500).json({ error: 'Failed to load game topics' });
    }

    // Determine the first round type (match or unmatch)
    const firstRoundType = Math.random() < 0.5 ? 'match' : 'unmatch';
    
    // Select a random topic for the first round
    const availableTopics = topics[firstRoundType];
    if (!availableTopics || availableTopics.length === 0) {
      console.error('No topics available for type:', firstRoundType);
      return res.status(500).json({ error: 'No topics available for the selected round type' });
    }
    
    const randomIndex = Math.floor(Math.random() * availableTopics.length);
    const firstTopic = availableTopics[randomIndex];
    
    console.log("Selected topic:", firstTopic);

    // Start transaction to update game and create first round
    const { data, error } = await supabase.rpc('start_game', {
      p_game_id: gameId,
      p_round_type: firstRoundType,
      p_topic: firstTopic.name,
      p_topic_id: firstTopic.id
    });

    if (error) {
      console.error("Error calling start_game procedure:", error);
      throw error;
    }

    // Double-check that the round was created correctly
    const { data: roundData, error: roundError } = await supabase
      .from('rounds')
      .select('*')
      .eq('game_id', gameId)
      .eq('round_number', 1)
      .single();

    if (roundError) {
      console.error("Error verifying round creation:", roundError);
      // If the round wasn't created, create it manually
      const roundId = uuidv4();
      const { error: insertError } = await supabase
        .from('rounds')
        .insert({
          id: roundId,
          game_id: gameId,
          round_number: 1,
          type: firstRoundType,
          topic: firstTopic.name,
          topic_id: firstTopic.id,
          start_time: new Date().toISOString(),
          is_completed: false
        });

      if (insertError) {
        console.error("Error creating round manually:", insertError);
        throw insertError;
      }
    } else {
      console.log("Round created successfully:", roundData);
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
