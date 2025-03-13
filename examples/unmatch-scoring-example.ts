import { calculateUnmatchRoundScores } from '../lib/scoreCalculator';

// Run this example to see how unmatch round scoring works
function runUnmatchExample() {
  // Example with 3 players
  const playerWords = {
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
  
  // Example with partial submissions
  const partialSubmissionExample = {
    'player1': ['unique1', 'unique2', 'unique3'], // Only 3 words
    'player2': ['unique4', 'unique5', 'shared1', 'shared2', 'unique6'],
    'player3': ['unique7', 'unique8', 'shared1', 'shared2'] // Only 4 words
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
  
  // Calculate scores for the third example
  console.log('\n\nExample 3: Partial Submissions');
  console.log('---------------------------');
  const scores3 = calculateUnmatchRoundScores(partialSubmissionExample);
  
  console.log('Player Words:');
  Object.entries(partialSubmissionExample).forEach(([playerId, words]) => {
    console.log(`${playerId}: ${words.join(', ')}`);
  });
  
  console.log('\nScoring Results:');
  Object.entries(scores3).forEach(([playerId, scoreData]) => {
    console.log(`${playerId}:`);
    console.log(`  Score: ${scoreData.score}`);
    console.log(`  Matched Words: ${scoreData.matchedWords.join(', ')}`);
    console.log(`  Bonus Awarded: ${scoreData.bonusAwarded ? 'Yes' : 'No'}`);
  });
  
  console.log('\nExplanation:');
  console.log('- "shared1" and "shared2" appear in multiple players\' lists, so those players get 0 points for them');
  console.log('- player1 submitted only 3 words, but all are unique, so they get +3 points plus a +1 bonus');
  console.log('- player2 and player3 had shared words, so they do not get the bonus');
  console.log('- Partial submissions are handled naturally - players get points for each unique word they submit');
}

runUnmatchExample();
