import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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
    if (currentRoundNumber > 0) {
      const { data: currentRound, error: currentRoundError } = await supabase
        .from('rounds')
        .select('end_time')
        .eq('game_id', gameId)
        .eq('round_number', currentRoundNumber)
        .single();

      if (currentRoundError) {
        throw currentRoundError;
      }

      if (!currentRound.end_time) {
        return res.status(400).json({ error: 'Current round is not completed yet' });
      }
    }

    // Load topics for the game
    let topics;
    try {
      // Determine the API URL based on environment
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/topics-function`
        : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'}/api/topics`;
      
      console.log('Fetching topics from:', apiUrl);
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch topics: ${response.status}`);
      }
      
      topics = await response.json();
    } catch (error) {
      console.error('Error loading topics:', error);
      return res.status(500).json({ error: 'Failed to load game topics' });
    }

    // Determine the next round type (alternate between match and unmatch)
    const nextRoundType = currentRoundNumber % 2 === 0 ? 'match' : 'unmatch';
    
    // Select a random topic for the next round
    const availableTopics = topics[nextRoundType];
    const randomIndex = Math.floor(Math.random() * availableTopics.length);
    const nextTopic = availableTopics[randomIndex];

    // Reset all players' submission status
    // Instead of updating the has_submitted column, we'll check for submissions in the next round
    /* 
    const { error: resetError } = await supabase
      .from('players')
      .update({ has_submitted: false })
      .eq('game_id', gameId);

    if (resetError) {
      throw resetError;
    }
    */

    // Create a new round
    const newRoundNumber = currentRoundNumber + 1;
    const roundId = uuidv4();
    
    const { error: roundError } = await supabase
      .from('rounds')
      .insert({
        id: roundId,
        game_id: gameId,
        round_number: newRoundNumber,
        type: nextRoundType,
        topic: nextTopic.name,
        topic_id: nextTopic.id,
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
      roundType: nextRoundType,
      topic: nextTopic.name
    });
  } catch (error) {
    console.error('Error starting new round:', error);
    return res.status(500).json({ error: 'Failed to start new round' });
  }
}
