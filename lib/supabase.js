import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Generate a random 6-character game code
export const generateGameCode = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Generate a short player ID (4 characters)
export const generateShortId = () => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Game Operations
export const gameOperations = {
  // Create a new game
  async createGame(timePerRound = 60, maxPlayers = 8) {
    const gameCode = generateGameCode();
    
    const { data, error } = await supabase
      .from('games')
      .insert({
        code: gameCode,
        status: 'lobby',
        time_per_round: timePerRound,
        max_players: maxPlayers
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Get game by code
  async getGameByCode(code) {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Update game status
  async updateGameStatus(gameId, status) {
    const { data, error } = await supabase
      .from('games')
      .update({ status })
      .eq('id', gameId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Start a new round
  async startNewRound(gameId, roundNumber, type, topic) {
    // First update the game's current round
    await supabase
      .from('games')
      .update({ 
        current_round: roundNumber,
        round_count: roundNumber
      })
      .eq('id', gameId);
    
    // Then create the new round
    const { data, error } = await supabase
      .from('rounds')
      .insert({
        game_id: gameId,
        round_number: roundNumber,
        type,
        topic,
        start_time: new Date()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // End a round
  async endRound(roundId) {
    const { data, error } = await supabase
      .from('rounds')
      .update({ end_time: new Date() })
      .eq('id', roundId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Player Operations
export const playerOperations = {
  // Add a player to a game
  async addPlayer(gameId, playerName, isHost = false) {
    const shortId = generateShortId();
    
    const { data, error } = await supabase
      .from('players')
      .insert({
        game_id: gameId,
        name: playerName,
        short_id: shortId,
        is_host: isHost
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
  
  // Get all players in a game
  async getGamePlayers(gameId) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    return data;
  },
  
  // Update player score
  async updatePlayerScore(playerId, newScore) {
    const { data, error } = await supabase
      .from('players')
      .update({ score: newScore })
      .eq('id', playerId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};

// Submission Operations
export const submissionOperations = {
  // Add or update a submission (supports partial submissions)
  async saveSubmission(roundId, playerId, word, isFinal = false) {
    // Check if submission already exists
    const { data: existingSubmission } = await supabase
      .from('submissions')
      .select('*')
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .eq('word', word)
      .single();
    
    if (existingSubmission) {
      // Update existing submission
      const { data, error } = await supabase
        .from('submissions')
        .update({ is_final: isFinal })
        .eq('id', existingSubmission.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new submission
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          round_id: roundId,
          player_id: playerId,
          word,
          is_final: isFinal
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },
  
  // Get all submissions for a round
  async getRoundSubmissions(roundId) {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        player:player_id (id, name, short_id)
      `)
      .eq('round_id', roundId);
    
    if (error) throw error;
    return data;
  },
  
  // Finalize all submissions for a player in a round
  async finalizeSubmissions(roundId, playerId) {
    const { data, error } = await supabase
      .from('submissions')
      .update({ is_final: true })
      .eq('round_id', roundId)
      .eq('player_id', playerId);
    
    if (error) throw error;
    return data;
  }
};

// Round Score Operations
export const scoreOperations = {
  // Record a player's score for a round
  async recordRoundScore(roundId, playerId, score) {
    // Check if score already exists
    const { data: existingScore } = await supabase
      .from('round_scores')
      .select('*')
      .eq('round_id', roundId)
      .eq('player_id', playerId)
      .single();
    
    if (existingScore) {
      // Update existing score
      const { data, error } = await supabase
        .from('round_scores')
        .update({ score })
        .eq('id', existingScore.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new score
      const { data, error } = await supabase
        .from('round_scores')
        .insert({
          round_id: roundId,
          player_id: playerId,
          score
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },
  
  // Get all scores for a round
  async getRoundScores(roundId) {
    const { data, error } = await supabase
      .from('round_scores')
      .select(`
        *,
        player:player_id (id, name, short_id)
      `)
      .eq('round_id', roundId);
    
    if (error) throw error;
    return data;
  }
};

// Real-time subscriptions
export const realtime = {
  // Subscribe to game updates
  subscribeToGame(gameId, callback) {
    return supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, callback)
      .subscribe();
  },
  
  // Subscribe to player updates for a game
  subscribeToPlayers(gameId, callback) {
    return supabase
      .channel(`players:${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${gameId}`
      }, callback)
      .subscribe();
  },
  
  // Subscribe to round updates for a game
  subscribeToRounds(gameId, callback) {
    return supabase
      .channel(`rounds:${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rounds',
        filter: `game_id=eq.${gameId}`
      }, callback)
      .subscribe();
  },
  
  // Subscribe to submissions for a specific round
  subscribeToSubmissions(roundId, callback) {
    return supabase
      .channel(`submissions:${roundId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `round_id=eq.${roundId}`
      }, callback)
      .subscribe();
  },
  
  // Subscribe to round scores
  subscribeToRoundScores(roundId, callback) {
    return supabase
      .channel(`round_scores:${roundId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round_scores',
        filter: `round_id=eq.${roundId}`
      }, callback)
      .subscribe();
  }
};
