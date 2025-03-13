import { loadTopicsFromFile } from '../../lib/topicsManager';

export default function handler(req, res) {
  try {
    // Load topics from the JSON file
    const topics = loadTopicsFromFile();
    
    // Return the topics as JSON
    res.status(200).json(topics);
  } catch (error) {
    console.error('Error loading topics:', error);
    res.status(500).json({ error: 'Failed to load topics' });
  }
}
