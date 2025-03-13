import { calculateMatchRoundScores } from '../lib/scoreCalculator';

// Example with 3 players
const playerWords = {
  'player1': ['cat', 'dog', 'fish', 'bird', 'hamster'],
  'player2': ['cat', 'dog', 'rabbit', 'snake', 'lizard'],
  'player3': ['cat', 'dog', 'fish', 'turtle', 'frog']
};

// Example with perfect match bonus
const perfectMatchExample = {
  'player1': ['cat', 'dog', 'fish'],
  'player2': ['cat', 'dog', 'fish', 'bird', 'hamster'],
  'player3': ['cat', 'dog', 'fish', 'rabbit', 'snake']
};

// Calculate scores for the first example
console.log('Example 1: Basic Matching');
console.log('-----------------------');
const scores1 = calculateMatchRoundScores(playerWords);

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
console.log('- "cat" and "dog" were submitted by all 3 players, so each player gets +1 point for each word');
console.log('- "fish" was submitted by player1 and player3, so they each get +1 point');
console.log('- No player had all of their words match with others, so no bonus points were awarded');

// Calculate scores for the second example
console.log('\n\nExample 2: Perfect Match Bonus');
console.log('--------------------------');
const scores2 = calculateMatchRoundScores(perfectMatchExample);

console.log('Player Words:');
Object.entries(perfectMatchExample).forEach(([playerId, words]) => {
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
console.log('- "cat", "dog", and "fish" were submitted by all 3 players, so each player gets +1 point for each word');
console.log('- player1 submitted only 3 words, and all of them matched with other players');
console.log('- player1 gets a +1 bonus point for having all their words match');
console.log('- player2 and player3 had additional words that did not match, so they do not get the bonus');
