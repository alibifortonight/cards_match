import type { NextApiRequest, NextApiResponse } from 'next';
import { topics as topicsData } from '../../data/topics';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request
  if (req.method === 'GET') {
    // Return all topics
    return res.status(200).json(topicsData);
  }

  // Return 405 Method Not Allowed for other request methods
  return res.status(405).json({ error: 'Method not allowed' });
}
