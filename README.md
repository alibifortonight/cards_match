# Word-Match/Unmatch Game - Data Structure & Database Setup

This document outlines the data schema and database setup for the multiplayer word-matching game using Next.js and Supabase.

## Database Schema

The game uses a relational database structure with the following tables:

### Games Table

Stores the main game information:

- `id`: UUID, primary key
- `code`: VARCHAR(6), unique code for players to join
- `status`: VARCHAR(20), game status ('lobby', 'in-progress', 'completed')
- `created_at`: TIMESTAMP, when the game was created
- `updated_at`: TIMESTAMP, when the game was last updated
- `round_count`: INTEGER, total number of rounds
- `current_round`: INTEGER, current round number
- `time_per_round`: INTEGER, time limit per round in seconds
- `max_players`: INTEGER, maximum number of players allowed

### Players Table

Stores player information:

- `id`: UUID, primary key
- `game_id`: UUID, reference to games table
- `name`: VARCHAR(50), player's display name
- `short_id`: VARCHAR(8), short unique identifier for the player
- `score`: INTEGER, player's total score
- `is_host`: BOOLEAN, whether the player is the host
- `created_at`: TIMESTAMP, when the player joined
- `updated_at`: TIMESTAMP, when the player was last updated

### Rounds Table

Stores round information:

- `id`: UUID, primary key
- `game_id`: UUID, reference to games table
- `round_number`: INTEGER, the round number
- `type`: VARCHAR(10), round type ('match' or 'unmatch')
- `topic`: VARCHAR(100), the topic for the round
- `start_time`: TIMESTAMP, when the round started
- `end_time`: TIMESTAMP, when the round ended
- `created_at`: TIMESTAMP, when the round was created
- `updated_at`: TIMESTAMP, when the round was last updated

### Submissions Table

Stores player word submissions:

- `id`: UUID, primary key
- `round_id`: UUID, reference to rounds table
- `player_id`: UUID, reference to players table
- `word`: VARCHAR(100), the submitted word
- `submitted_at`: TIMESTAMP, when the word was submitted
- `is_final`: BOOLEAN, whether the submission is final

### Round Scores Table

Stores scores for each player in each round:

- `id`: UUID, primary key
- `round_id`: UUID, reference to rounds table
- `player_id`: UUID, reference to players table
- `score`: INTEGER, the score for this round
- `created_at`: TIMESTAMP, when the score was recorded

## Topics System

The game uses a JSON-based topics system to provide different topics for match and unmatch rounds. Topics are stored in a structured JSON file and are kept separate for each round type to ensure no overlap.

### Topics JSON Structure

The topics are stored in `data/topics.json` with the following structure:

```json
{
  "match": [
    {
      "id": "animals",
      "name": "Animals",
      "description": "Think of animals from around the world"
    },
    // More match topics...
  ],
  "unmatch": [
    {
      "id": "emotions",
      "name": "Emotions",
      "description": "List different feelings and emotional states"
    },
    // More unmatch topics...
  ]
}
```

Each topic has:
- `id`: A unique identifier for the topic
- `name`: The display name shown to players
- `description`: A brief description or hint for players

### Topic Selection Logic

The game includes a `TopicsTracker` class that:

1. Keeps track of used topics to prevent repetition
2. Selects appropriate topics for each round type
3. Ensures match and unmatch rounds use different topic sets

The selection logic:
- Randomly selects a topic from the appropriate category (match/unmatch)
- Avoids reusing topics until all topics in a category have been used
- Alternates between match and unmatch rounds

### Loading Topics

Topics can be loaded in several ways:

1. **Server-side**: Using the `loadTopicsFromFile` function to read directly from the JSON file
2. **API Route**: Through a Next.js API route at `/api/topics` that serves the topics
3. **Edge Function**: The Supabase Edge Function can also serve topics and has a cached version

### Using Topics in Rounds

When a new round starts:
1. The round type is determined (match or unmatch)
2. A topic is selected from the appropriate category
3. The topic is stored with the round in the database
4. The topic details are passed to the frontend for display

## Real-time Updates

The application uses Supabase Realtime to handle real-time updates for:

1. **Game state changes**: When the game status changes or a new round starts
2. **Player joins**: When a new player joins the game
3. **Submissions**: When players submit words during a round
4. **Score updates**: When round scores are calculated

## Deployment Guide

### Deploying to Vercel

1. **Push your code to GitHub**
   - Create a new repository on GitHub
   - Push your local code to the repository

2. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com) and sign in
   - Click "Add New..." and select "Project"
   - Import your GitHub repository
   - Configure the project settings:
     - Framework Preset: Next.js
     - Root Directory: ./
     - Build Command: npm run build
     - Output Directory: .next

3. **Set up Environment Variables**
   - In the Vercel project settings, go to "Environment Variables"
   - Add the following variables:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
     NEXT_PUBLIC_BASE_URL=your-vercel-deployment-url
     ```
   - Click "Deploy" to start the deployment process

### Setting up Supabase Edge Functions

1. **Install Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Initialize Supabase in your project**
   ```bash
   supabase init
   ```

4. **Link to your Supabase project**
   ```bash
   supabase link --project-ref your-project-ref
   ```

5. **Create an Edge Function**
   ```bash
   supabase functions new topics-function
   ```

6. **Edit the Edge Function**
   - Navigate to `supabase/functions/topics-function/index.ts`
   - Implement your function (example below)

   ```typescript
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

   const topics = {
     match: [
       { id: 'animals', name: 'Animals', description: 'Think of animals from around the world' },
       { id: 'countries', name: 'Countries', description: 'Name countries from any continent' },
       { id: 'food', name: 'Food', description: 'List different types of food and dishes' },
       // Add more topics...
     ],
     unmatch: [
       { id: 'emotions', name: 'Emotions', description: 'List different feelings and emotional states' },
       { id: 'colors', name: 'Colors', description: 'Name different colors and shades' },
       { id: 'weather', name: 'Weather Phenomena', description: 'Think of different weather conditions and events' },
       // Add more topics...
     ]
   }

   serve(async (req) => {
     // Enable CORS
     const headers = new Headers({
       'Access-Control-Allow-Origin': '*',
       'Access-Control-Allow-Methods': 'GET, OPTIONS',
       'Content-Type': 'application/json'
     })

     // Handle preflight requests
     if (req.method === 'OPTIONS') {
       return new Response('ok', { headers })
     }

     return new Response(
       JSON.stringify(topics),
       { headers }
     )
   })
   ```

7. **Deploy the Edge Function**
   ```bash
   supabase functions deploy topics-function
   ```

8. **Update your application to use the Edge Function**
   - Replace the local API endpoints with your Supabase Edge Function URL
   - For example, in `pages/api/games/end-round.ts`:

   ```typescript
   const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/topics-function`;
   ```

## How to Use

### Setting Up Supabase

1. Create a new Supabase project
2. Run the SQL in `database_schema.sql` to set up the tables and relationships
3. Set up your environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Using the Game Hook

The `useGame` hook provides a complete interface for interacting with the game:

```jsx
import { useGame } from '../hooks/useGame';

function GameComponent() {
  const {
    game,
    players,
    currentRound,
    submissions,
    roundScores,
    loading,
    error,
    createGame,
    joinGame,
    startGame,
    submitWord,
    finalizeSubmissions,
    endRound,
    resetGameState
  } = useGame();

  // Use these functions and state in your components
}
```

### Creating a New Game

```jsx
const handleCreateGame = async () => {
  try {
    const { game, player } = await createGame('Player Name');
    // Store the player ID in local storage or state
    localStorage.setItem('playerId', player.id);
    // Navigate to lobby
    router.push(`/game/${game.code}`);
  } catch (error) {
    console.error('Error creating game:', error);
  }
};
```

### Joining a Game

```jsx
const handleJoinGame = async (gameCode) => {
  try {
    const { game, player } = await joinGame(gameCode, 'Player Name');
    // Store the player ID in local storage or state
    localStorage.setItem('playerId', player.id);
    // Navigate to lobby
    router.push(`/game/${game.code}`);
  } catch (error) {
    console.error('Error joining game:', error);
  }
};
```

### Starting a Game

```jsx
const handleStartGame = async () => {
  try {
    await startGame(game.id);
    // Game state will update automatically through real-time subscription
  } catch (error) {
    console.error('Error starting game:', error);
  }
};
```

### Submitting Words

```jsx
const handleSubmitWord = async (word) => {
  try {
    await submitWord(currentRound.id, playerId, word);
    // Submission will be added to state through real-time subscription
  } catch (error) {
    console.error('Error submitting word:', error);
  }
};
```

### Finalizing Submissions

```jsx
const handleFinalizeSubmissions = async () => {
  try {
    await finalizeSubmissions(currentRound.id, playerId);
    // Submissions will be updated through real-time subscription
  } catch (error) {
    console.error('Error finalizing submissions:', error);
  }
};
```

### Ending a Round

```jsx
const handleEndRound = async () => {
  try {
    await endRound(currentRound.id, game.id, currentRound.round_number);
    // Game state will update automatically through real-time subscription
  } catch (error) {
    console.error('Error ending round:', error);
  }
};
```

## Edge Functions

The Supabase Edge Function `handle-game-logic` provides server-side logic for:

1. Creating and joining games
2. Starting games and rounds
3. Handling word submissions
4. Calculating scores based on match/unmatch rules

To deploy the Edge Function:

```bash
supabase functions deploy handle-game-logic
```

## Handling Partial Submissions

During the 1-minute countdown:
1. Players can submit multiple words
2. Each submission is saved with `is_final: false`
3. When time expires, all submissions are marked as `is_final: true`
4. Scores are calculated based on final submissions

## Recommended Indexes

The schema includes indexes for:
- `games.status`: For filtering games by status
- `players.game_id`: For retrieving all players in a game
- `rounds.game_id`: For retrieving all rounds in a game
- `submissions.round_id` and `submissions.player_id`: For retrieving submissions
- `round_scores.round_id` and `round_scores.player_id`: For retrieving scores

## Security Considerations

The schema includes Row Level Security (RLS) policies that should be customized based on your authentication setup.
# cards_match
