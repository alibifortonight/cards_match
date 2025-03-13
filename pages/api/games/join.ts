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
    const { playerName, gameCode } = req.body;

    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }

    if (!gameCode || typeof gameCode !== 'string' || gameCode.trim() === '') {
      return res.status(400).json({ error: 'Game code is required' });
    }

    // Find the game with the provided code
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('code', gameCode.toUpperCase())
      .single();

    if (gameError) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Cannot join a game that has already started' });
    }

    // Get current players in the game
    const { data: existingPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id);

    if (playersError) {
      throw playersError;
    }

    // Check if the game is full
    if (existingPlayers.length >= game.max_players) {
      return res.status(400).json({ error: 'Game is full' });
    }

    // Create a new player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert([
        {
          id: uuidv4(),
          game_id: game.id,
          name: playerName.trim(),
          short_id: Math.random().toString(36).substring(2, 10),
          score: 0,
          is_host: false,
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
    console.error('Error joining game:', error);
    return res.status(500).json({ error: 'Failed to join game' });
  }
}
