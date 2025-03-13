import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define types
interface PlayerWords {
  [playerId: string]: string[]; // array of words for each player
}

interface PlayerScores {
  [playerId: string]: {
    score: number;
    matchedWords: string[];
    bonusAwarded: boolean;
  };
}

/**
 * Calculate scores for a match round
 * 
 * In a match round:
 * - Each matching word is worth +1 point for each player with that word
 * - If all of a player's words match with at least one other player, they get a +1 bonus
 * 
 * @param playerWords Object mapping player IDs to their submitted words
 * @returns Object with each player's score details
 */
export function calculateMatchRoundScores(playerWords: PlayerWords): PlayerScores {
  // Initialize scores object
  const scores: PlayerScores = {};
  Object.keys(playerWords).forEach(playerId => {
    scores[playerId] = {
      score: 0,
      matchedWords: [],
      bonusAwarded: false
    };
  });

  // Create a map of words to the players who submitted them
  const wordToPlayers: { [word: string]: string[] } = {};
  
  // Populate the word-to-players map
  Object.entries(playerWords).forEach(([playerId, words]) => {
    words.forEach(word => {
      const normalizedWord = word.toLowerCase().trim();
      if (normalizedWord) { // Skip empty words
        if (!wordToPlayers[normalizedWord]) {
          wordToPlayers[normalizedWord] = [];
        }
        wordToPlayers[normalizedWord].push(playerId);
      }
    });
  });

  // Award points for matching words
  Object.entries(wordToPlayers).forEach(([word, playerIds]) => {
    if (playerIds.length > 1) { // Word appears in multiple players' lists
      playerIds.forEach(playerId => {
        // Each player gets +1 point for each of their words that matched with any other player
        scores[playerId].score += 1;
        scores[playerId].matchedWords.push(word);
      });
    }
  });

  // Check for perfect match bonus
  Object.entries(playerWords).forEach(([playerId, words]) => {
    // Filter out empty words
    const validWords = words.filter(word => word.trim() !== '');
    
    if (validWords.length > 0) {
      // Check if all of the player's words matched with at least one other player
      const allWordsMatched = validWords.every(word => {
        const normalizedWord = word.toLowerCase().trim();
        return wordToPlayers[normalizedWord] && wordToPlayers[normalizedWord].length > 1;
      });
      
      // Award bonus point if all words matched
      if (allWordsMatched) {
        scores[playerId].score += 1;
        scores[playerId].bonusAwarded = true;
      }
    }
  });

  return scores;
}

/**
 * Calculate scores for an unmatch round
 * 
 * In an unmatch round:
 * - Players get +1 point for each unique word (not shared with any other player)
 * - If all of a player's words are unique, they get a +1 bonus
 * 
 * @param playerWords Object mapping player IDs to their submitted words
 * @returns Object with each player's score details
 */
export function calculateUnmatchRoundScores(playerWords: PlayerWords): PlayerScores {
  // Initialize scores object
  const scores: PlayerScores = {};
  Object.keys(playerWords).forEach(playerId => {
    scores[playerId] = {
      score: 0,
      matchedWords: [],
      bonusAwarded: false
    };
  });

  // Create a map of words to the players who submitted them
  const wordToPlayers: { [word: string]: string[] } = {};
  
  // Populate the word-to-players map
  Object.entries(playerWords).forEach(([playerId, words]) => {
    words.forEach(word => {
      const normalizedWord = word.toLowerCase().trim();
      if (normalizedWord) { // Skip empty words
        if (!wordToPlayers[normalizedWord]) {
          wordToPlayers[normalizedWord] = [];
        }
        wordToPlayers[normalizedWord].push(playerId);
      }
    });
  });

  // Track unique words for each player
  const playerUniqueWords: { [playerId: string]: string[] } = {};
  Object.keys(playerWords).forEach(playerId => {
    playerUniqueWords[playerId] = [];
  });

  // Award points for unique words
  Object.entries(wordToPlayers).forEach(([word, playerIds]) => {
    if (playerIds.length === 1) { // Word is unique to one player
      const playerId = playerIds[0];
      scores[playerId].score += 1;
      playerUniqueWords[playerId].push(word);
    } else {
      // For duplicated words, add them to matchedWords for tracking
      playerIds.forEach(playerId => {
        scores[playerId].matchedWords.push(word);
      });
    }
  });

  // Check for perfect unmatch bonus
  Object.entries(playerWords).forEach(([playerId, words]) => {
    // Filter out empty words
    const validWords = words.filter(word => word.trim() !== '');
    
    if (validWords.length > 0) {
      // Check if all of the player's words are unique
      const allWordsUnique = validWords.every(word => {
        const normalizedWord = word.toLowerCase().trim();
        return wordToPlayers[normalizedWord] && wordToPlayers[normalizedWord].length === 1;
      });
      
      // Award bonus point if all words are unique
      if (allWordsUnique) {
        scores[playerId].score += 1;
        scores[playerId].bonusAwarded = true;
      }
    }
  });

  return scores;
}

/**
 * Save round scores to the database
 * 
 * @param roundId The ID of the round
 * @param scores The calculated scores for each player
 */
export async function saveRoundScores(roundId: string, scores: PlayerScores): Promise<void> {
  for (const [playerId, scoreData] of Object.entries(scores)) {
    try {
      // Save detailed score to round_scores table
      await supabase
        .from('round_scores')
        .insert({
          player_id: playerId,
          round_id: roundId,
          score: scoreData.score,
          matched_words: scoreData.matchedWords,
          bonus_awarded: scoreData.bonusAwarded
        });
      
      // Update player's total score
      await supabase.rpc('update_player_score', {
        p_player_id: playerId,
        p_score_to_add: scoreData.score
      });
    } catch (error) {
      console.error(`Error saving score for player ${playerId}:`, error);
      throw error;
    }
  }
}

/**
 * Example function to demonstrate scoring
 */
export function scoringExample(): void {
  // Example with 3 players
  const playerWords: PlayerWords = {
    'player1': ['cat', 'dog', 'fish', 'bird', 'hamster'],
    'player2': ['cat', 'dog', 'rabbit', 'snake', 'lizard'],
    'player3': ['cat', 'dog', 'fish', 'turtle', 'frog']
  };
  
  const scores = calculateMatchRoundScores(playerWords);
  
  console.log('Player Words:');
  Object.entries(playerWords).forEach(([playerId, words]) => {
    console.log(`${playerId}: ${words.join(', ')}`);
  });
  
  console.log('\nScoring Results:');
  Object.entries(scores).forEach(([playerId, scoreData]) => {
    console.log(`${playerId}:`);
    console.log(`  Score: ${scoreData.score}`);
    console.log(`  Matched Words: ${scoreData.matchedWords.join(', ')}`);
    console.log(`  Bonus Awarded: ${scoreData.bonusAwarded ? 'Yes' : 'No'}`);
  });
  
  console.log('\nExplanation:');
  console.log('- "cat" and "dog" were submitted by all 3 players, so each player gets +1 point for each word');
  console.log('- "fish" was submitted by player1 and player3, so they each get +1 point');
  console.log('- No player had all of their words match with others, so no bonus points were awarded');
}

/**
 * Example function to demonstrate unmatch scoring
 */
export function unmatchScoringExample(): void {
  // Example with 3 players
  const playerWords: PlayerWords = {
    'player1': ['unique1', 'unique2', 'shared1', 'unique3', 'unique4'],
    'player2': ['unique5', 'unique6', 'shared1', 'shared2', 'unique7'],
    'player3': ['unique8', 'unique9', 'unique10', 'shared2', 'unique11']
  };
  
  // Example with perfect unmatch bonus
  const perfectUnmatchExample = {
    'player1': ['unique1', 'unique2', 'unique3', 'unique4', 'unique5'],
    'player2': ['shared1', 'shared2', 'unique6', 'unique7', 'unique8'],
    'player3': ['shared1', 'shared2', 'unique9', 'unique10', 'unique11']
  };
  
  // Calculate scores for the first example
  console.log('Example 1: Basic Unmatch');
  console.log('-----------------------');
  const scores1 = calculateUnmatchRoundScores(playerWords);
  
  console.log('Player Words:');
  Object.entries(playerWords).forEach(([playerId, words]) => {
    console.log(`${playerId}: ${words.join(', ')}`);
  });
  
  console.log('\nScoring Results:');
  Object.entries(scores1).forEach(([playerId, scoreData]) => {
    console.log(`${playerId}:`);
    console.log(`  Score: ${scoreData.score}`);
    console.log(`  Matched Words: ${scoreData.matchedWords.join(', ')}`);
    console.log(`  Bonus Awarded: ${scoreData.bonusAwarded ? 'Yes' : 'No'}`);
  });
  
  console.log('\nExplanation:');
  console.log('- "shared1" appears in player1 and player2 lists, so they get 0 points for it');
  console.log('- "shared2" appears in player2 and player3 lists, so they get 0 points for it');
  console.log('- Each player gets +1 point for each of their unique words');
  console.log('- No player had all unique words, so no bonus points were awarded');
  
  // Calculate scores for the second example
  console.log('\n\nExample 2: Perfect Unmatch Bonus');
  console.log('-----------------------------');
  const scores2 = calculateUnmatchRoundScores(perfectUnmatchExample);
  
  console.log('Player Words:');
  Object.entries(perfectUnmatchExample).forEach(([playerId, words]) => {
    console.log(`${playerId}: ${words.join(', ')}`);
  });
  
  console.log('\nScoring Results:');
  Object.entries(scores2).forEach(([playerId, scoreData]) => {
    console.log(`${playerId}:`);
    console.log(`  Score: ${scoreData.score}`);
    console.log(`  Matched Words: ${scoreData.matchedWords.join(', ')}`);
    console.log(`  Bonus Awarded: ${scoreData.bonusAwarded ? 'Yes' : 'No'}`);
  });
  
  console.log('\nExplanation:');
  console.log('- "shared1" and "shared2" appear in multiple players\' lists, so those players get 0 points for them');
  console.log('- player1 submitted 5 unique words, so they get +5 points plus a +1 bonus for perfect unmatch');
  console.log('- player2 and player3 had shared words, so they do not get the bonus');
}
