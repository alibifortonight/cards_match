import fs from 'fs';
import path from 'path';

// Path to the topics.json file
const topicsFilePath = path.join(process.cwd(), 'data', 'topics.json');

/**
 * Load topics from the JSON file
 * This is used server-side only
 */
export function loadTopicsFromFile() {
  try {
    const fileContents = fs.readFileSync(topicsFilePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error('Error loading topics file:', error);
    // Return default empty structure if file can't be loaded
    return { match: [], unmatch: [] };
  }
}

/**
 * Load topics from the API endpoint
 * This is used client-side or in API routes
 */
export async function loadTopicsFromAPI() {
  try {
    // When running in the browser, use the current origin
    const apiUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}/api/topics` 
      : `http://localhost:${process.env.PORT || 3006}/api/topics`;
    
    console.log('Fetching topics from:', apiUrl);
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to load topics: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error loading topics from API:', error);
    // Return default empty structure if API call fails
    return { match: [], unmatch: [] };
  }
}

/**
 * Get all topics (for client-side use)
 * This should be called from getStaticProps or getServerSideProps
 */
export async function getAllTopics() {
  // In a real-world scenario with GitHub integration, you might fetch from the raw URL
  // const response = await fetch('https://raw.githubusercontent.com/yourusername/yourrepo/main/data/topics.json');
  // return await response.json();
  
  // For local development or when bundled with the app:
  return loadTopicsFromFile();
}

/**
 * Get a random topic for a specific round type
 * @param {Object} topics - The topics object with match and unmatch arrays
 * @param {string} roundType - Either 'match' or 'unmatch'
 * @param {Array} usedTopicIds - Optional array of topic IDs that have been used and should be excluded
 * @returns {Object} A randomly selected topic object
 */
export function getRandomTopic(topics, roundType, usedTopicIds = []) {
  if (!topics || !topics[roundType] || topics[roundType].length === 0) {
    throw new Error(`No ${roundType} topics available`);
  }

  // Filter out used topics
  let availableTopics = topics[roundType].filter(topic => !usedTopicIds.includes(topic.id));
  
  if (availableTopics.length === 0) {
    // If all topics have been used, reset and use all topics again
    // In a real game, you might want to handle this differently
    availableTopics = topics[roundType];
  }
  
  // Select a random topic from the available ones
  const randomIndex = Math.floor(Math.random() * availableTopics.length);
  return availableTopics[randomIndex];
}

/**
 * Track used topics to avoid repetition within a game session
 */
export class TopicsTracker {
  constructor(topics) {
    this.topics = topics;
    this.usedMatchTopicIds = [];
    this.usedUnmatchTopicIds = [];
  }

  /**
   * Get a random topic for a match round
   * @returns {Object} A randomly selected match topic
   */
  getMatchTopic() {
    const topic = getRandomTopic(this.topics, 'match', this.usedMatchTopicIds);
    this.usedMatchTopicIds.push(topic.id);
    return topic;
  }

  /**
   * Get a random topic for an unmatch round
   * @returns {Object} A randomly selected unmatch topic
   */
  getUnmatchTopic() {
    const topic = getRandomTopic(this.topics, 'unmatch', this.usedUnmatchTopicIds);
    this.usedUnmatchTopicIds.push(topic.id);
    return topic;
  }

  /**
   * Get a topic based on the round type
   * @param {string} roundType - Either 'match' or 'unmatch'
   * @returns {Object} A randomly selected topic for the specified round type
   */
  getTopicForRoundType(roundType) {
    return roundType === 'match' ? this.getMatchTopic() : this.getUnmatchTopic();
  }

  /**
   * Reset the tracker to start fresh
   */
  reset() {
    this.usedMatchTopicIds = [];
    this.usedUnmatchTopicIds = [];
  }
}
