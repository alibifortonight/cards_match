import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { 
  calculateMatchRoundScores, 
  calculateUnmatchRoundScores, 
  saveRoundScores 
} from '../../../lib/scoreCalculator';

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
    const { gameId, roundId, roundNumber } = req.body;

    if (!gameId || !roundId || roundNumber === undefined) {
      return res.status(400).json({ error: 'Game ID, round ID, and round number are required' });
    }

    // Mark the round as completed
    const { error: roundError } = await supabase
      .from('rounds')
      .update({ 
        end_time: new Date().toISOString()
      })
      .eq('id', roundId);

    if (roundError) {
      throw roundError;
    }

    // Calculate scores for the round
    await calculateRoundScores(roundId, roundNumber);

    return res.status(200).json({
      success: true,
      message: 'Round ended successfully',
    });
  } catch (error) {
    console.error('Error ending round:', error);
    return res.status(500).json({ error: 'Failed to end round' });
  }
}

async function calculateRoundScores(roundId: string, roundNumber: number) {
  try {
    // Get the round to determine if it's a match or unmatch round
    const { data: round, error: roundError } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', roundId)
      .single();

    if (roundError || !round) {
      throw roundError || new Error('Round not found');
    }

    // Get all submissions for this round
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .eq('round_id', roundId);

    if (submissionsError) {
      throw submissionsError;
    }

    if (!submissions || submissions.length === 0) {
      console.log('No submissions found for round', roundId);
      return; // No submissions to score
    }

    // Organize submissions by player
    const playerWords: { [playerId: string]: string[] } = {};
    
    // Group submissions by player
    submissions.forEach(submission => {
      if (!playerWords[submission.player_id]) {
        playerWords[submission.player_id] = [];
      }
      
      if (submission.word && submission.word.trim() !== '') {
        playerWords[submission.player_id].push(submission.word.toLowerCase().trim());
      }
    });
    
    console.log('Player words for scoring:', playerWords);

    // Calculate scores based on round type
    let scores: any = {};
    
    if (round.type === 'match') {
      // For match rounds, use the enhanced scoring logic
      scores = calculateMatchRoundScores(playerWords);
      console.log('Match round scores:', scores);
    } else {
      // For unmatch rounds, use the unmatch scoring logic
      scores = calculateUnmatchRoundScores(playerWords);
      console.log('Unmatch round scores:', scores);
    }
    
    // Save the scores to the database
    await saveRoundScores(roundId, scores);

    // If this is the last round, update the game status to 'completed'
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('round_count, current_round')
      .eq('id', round.game_id)
      .single();

    if (gameError) {
      console.error('Error checking game status:', gameError);
    } else if (game) {
      console.log('Game status check:', { 
        current_round: game.current_round, 
        round_count: game.round_count,
        isLastRound: game.current_round >= game.round_count
      });
      
      if (game.current_round >= game.round_count) {
        console.log('This is the last round. Setting game status to completed.');
        const { error: updateError } = await supabase
          .from('games')
          .update({ status: 'completed' })
          .eq('id', round.game_id);
          
        if (updateError) {
          console.error('Error updating game status to completed:', updateError);
        } else {
          console.log('Game status updated to completed successfully');
        }
      } else {
        // Not the last round, automatically start the next round
        console.log('Starting next round automatically');
        
        // Load topics for the game
        let topics;
        try {
          // Fetch topics from the API directly
          const apiUrl = process.env.NODE_ENV === 'production' 
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/topics-function`
            : `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3004'}/api/topics`;
            
          console.log('Fetching topics from:', apiUrl);
          const response = await fetch(apiUrl);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch topics: ${response.status}`);
          }
          
          topics = await response.json();
          console.log('Loaded topics:', topics);
        } catch (error) {
          console.error('Error loading topics:', error);
          // Use fallback topics if API fails
          topics = {
            match: [
              { id: 'animals', name: 'Animals', description: 'Think of animals from around the world' },
              { id: 'countries', name: 'Countries', description: 'Name countries from any continent' },
              { id: 'food', name: 'Food', description: 'List different types of food and dishes' }
            ],
            unmatch: [
              { id: 'emotions', name: 'Emotions', description: 'List different feelings and emotional states' },
              { id: 'colors', name: 'Colors', description: 'Name different colors and shades' },
              { id: 'weather', name: 'Weather Phenomena', description: 'Think of different weather conditions and events' }
            ]
          };
          console.log('Using fallback topics:', topics);
        }

        // Determine the next round type (alternate between match and unmatch)
        const nextRoundNumber = game.current_round + 1;
        const nextRoundType = nextRoundNumber % 2 === 0 ? 'match' : 'unmatch';
        
        // Select a random topic for the next round
        const availableTopics = topics[nextRoundType];
        const randomIndex = Math.floor(Math.random() * availableTopics.length);
        const nextTopic = availableTopics[randomIndex];
        
        console.log('Selected topic:', nextTopic);
        
        // Create a new round
        const { error: roundError } = await supabase
          .from('rounds')
          .insert({
            game_id: round.game_id,
            round_number: nextRoundNumber,
            type: nextRoundType,
            topic: nextTopic.name,
            topic_id: nextTopic.id,
            start_time: new Date().toISOString(),
            end_time: null
          });

        if (roundError) {
          console.error('Error creating next round:', roundError);
        } else {
          // Update the game's current round
          const { error: updateGameError } = await supabase
            .from('games')
            .update({ current_round: nextRoundNumber })
            .eq('id', round.game_id);

          if (updateGameError) {
            console.error('Error updating game current round:', updateGameError);
          } else {
            console.log('Next round started automatically:', nextRoundNumber);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error calculating round scores:', error);
    throw error;
  }
}
