import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Function to generate a random 6-character game code
function generateGameCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
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
    const { playerName } = req.body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }

    // Generate a unique game code
    let gameCode = generateGameCode();
    let isUnique = false;
    
    // Ensure the game code is unique
    while (!isUnique) {
      const { data } = await supabase
        .from('games')
        .select('code')
        .eq('code', gameCode)
        .single();
        
      if (!data) {
        isUnique = true;
      } else {
        gameCode = generateGameCode();
      }
    }

    // Create a new game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert([
        {
          id: uuidv4(),
          code: gameCode,
          status: 'lobby',
          round_count: 5, // Default to 5 rounds
          current_round: 0,
          time_per_round: 60, // Default to 60 seconds per round
          max_players: 8, // Default to 8 max players
        },
      ])
      .select()
      .single();

    if (gameError) {
      throw gameError;
    }

    // Create the first player (host)
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert([
        {
          id: uuidv4(),
          game_id: game.id,
          name: playerName.trim(),
          short_id: Math.random().toString(36).substring(2, 10),
          score: 0,
          is_host: true,
        },
      ])
      .select()
      .single();

    if (playerError) {
      throw playerError;
    }

    return res.status(200).json({
      game,
      player,
    });
  } catch (error) {
    console.error('Error creating game:', error);
    return res.status(500).json({ error: 'Failed to create game' });
  }
}
