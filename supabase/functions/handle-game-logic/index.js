// This is a Supabase Edge Function that handles various game logic operations
// To deploy: supabase functions deploy handle-game-logic

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// Create a Supabase client with the Auth context of the function
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Topics cache to avoid fetching on every request
let topicsCache = null
let topicsCacheTime = 0
const CACHE_TTL = 3600000 // 1 hour in milliseconds

// Handle HTTP requests
Deno.serve(async (req) => {
  // Get the authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Parse the request body
  const { action, payload } = await req.json()

  try {
    // Ensure topics are loaded
    await loadTopics()
    
    let result
    
    switch (action) {
      case 'create-game':
        result = await createGame(payload)
        break
      case 'join-game':
        result = await joinGame(payload)
        break
      case 'start-game':
        result = await startGame(payload)
        break
      case 'submit-word':
        result = await submitWord(payload)
        break
      case 'end-round':
        result = await endRound(payload)
        break
      case 'calculate-scores':
        result = await calculateScores(payload)
        break
      case 'get-topics':
        result = { topics: topicsCache }
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
    
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// Load topics from GitHub or a source URL
async function loadTopics() {
  const now = Date.now()
  
  // Return cached topics if they're still fresh
  if (topicsCache && (now - topicsCacheTime < CACHE_TTL)) {
    return topicsCache
  }
  
  try {
    // In production, you would fetch from your GitHub repo's raw URL
    // const response = await fetch('https://raw.githubusercontent.com/yourusername/yourrepo/main/data/topics.json')
    
    // For development/demo purposes, we'll use a hardcoded set of topics
    // In production, replace this with the fetch above
    const topics = {
      "match": [
        {
          "id": "animals",
          "name": "Animals",
          "description": "Think of animals from around the world"
        },
        {
          "id": "countries",
          "name": "Countries",
          "description": "Name countries from any continent"
        },
        {
          "id": "food",
          "name": "Food",
          "description": "List different types of food and dishes"
        },
        {
          "id": "sports",
          "name": "Sports",
          "description": "Name sports played around the world"
        },
        {
          "id": "movies",
          "name": "Movies",
          "description": "Think of movie titles from any genre or era"
        },
        {
          "id": "professions",
          "name": "Professions",
          "description": "List different jobs and career paths"
        },
        {
          "id": "cities",
          "name": "Cities",
          "description": "Name cities from around the world"
        },
        {
          "id": "musical_instruments",
          "name": "Musical Instruments",
          "description": "List instruments used to make music"
        },
        {
          "id": "hobbies",
          "name": "Hobbies",
          "description": "Think of activities people do for fun"
        },
        {
          "id": "famous_people",
          "name": "Famous People",
          "description": "Name well-known celebrities, historical figures, or public personalities"
        }
      ],
      "unmatch": [
        {
          "id": "emotions",
          "name": "Emotions",
          "description": "List different feelings and emotional states"
        },
        {
          "id": "colors",
          "name": "Colors",
          "description": "Name different colors and shades"
        },
        {
          "id": "weather",
          "name": "Weather Phenomena",
          "description": "Think of different weather conditions and events"
        },
        {
          "id": "body_parts",
          "name": "Body Parts",
          "description": "List different parts of the human body"
        },
        {
          "id": "transportation",
          "name": "Transportation",
          "description": "Name different modes of transportation"
        },
        {
          "id": "furniture",
          "name": "Furniture",
          "description": "Think of items found in homes and offices"
        },
        {
          "id": "school_subjects",
          "name": "School Subjects",
          "description": "List academic subjects taught in schools"
        },
        {
          "id": "clothing",
          "name": "Clothing Items",
          "description": "Name different articles of clothing"
        },
        {
          "id": "nature",
          "name": "Nature",
          "description": "Think of natural elements, landscapes, and phenomena"
        },
        {
          "id": "technology",
          "name": "Technology",
          "description": "List gadgets, devices, and technological concepts"
        }
      ]
    }
    
    // Update cache
    topicsCache = topics
    topicsCacheTime = now
    
    return topics
  } catch (error) {
    console.error('Error loading topics:', error)
    
    // If we can't load topics, return a minimal default set
    const defaultTopics = {
      match: [
        { id: "animals", name: "Animals", description: "Think of animals" },
        { id: "food", name: "Food", description: "Think of food items" }
      ],
      unmatch: [
        { id: "colors", name: "Colors", description: "Think of colors" },
        { id: "emotions", name: "Emotions", description: "Think of emotions" }
      ]
    }
    
    // Update cache with defaults
    topicsCache = defaultTopics
    topicsCacheTime = now
    
    return defaultTopics
  }
}

// Get a random topic for a specific round type
function getRandomTopic(roundType, usedTopicIds = []) {
  if (!topicsCache || !topicsCache[roundType] || topicsCache[roundType].length === 0) {
    throw new Error(`No ${roundType} topics available`)
  }

  // Filter out used topics
  let availableTopics = topicsCache[roundType].filter(topic => !usedTopicIds.includes(topic.id))
  
  if (availableTopics.length === 0) {
    // If all topics have been used, reset and use all topics again
    availableTopics = topicsCache[roundType]
  }
  
  // Select a random topic from the available ones
  const randomIndex = Math.floor(Math.random() * availableTopics.length)
  return availableTopics[randomIndex]
}

// Generate a random 6-character game code
function generateGameCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Removed similar looking characters
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

// Generate a short player ID (4 characters)
function generateShortId() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

// Create a new game
async function createGame({ timePerRound = 60, maxPlayers = 8, playerName }) {
  // Generate a unique game code
  let gameCode
  let isUnique = false
  
  while (!isUnique) {
    gameCode = generateGameCode()
    
    // Check if code already exists
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .eq('code', gameCode)
      .single()
    
    if (error && error.code === 'PGRST116') {
      // Error code for "no rows returned" means the code is unique
      isUnique = true
    } else if (error) {
      throw error
    }
  }
  
  // Create the game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      code: gameCode,
      status: 'lobby',
      time_per_round: timePerRound,
      max_players: maxPlayers
    })
    .select()
    .single()
  
  if (gameError) throw gameError
  
  // Add the host player
  const shortId = generateShortId()
  
  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      game_id: game.id,
      name: playerName,
      short_id: shortId,
      is_host: true
    })
    .select()
    .single()
  
  if (playerError) throw playerError
  
  return { game, player }
}

// Join an existing game
async function joinGame({ gameCode, playerName }) {
  // Get the game by code
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('code', gameCode.toUpperCase())
    .single()
  
  if (gameError) {
    if (gameError.code === 'PGRST116') {
      throw new Error('Game not found')
    }
    throw gameError
  }
  
  // Check if game is joinable
  if (game.status !== 'lobby') {
    throw new Error('This game has already started')
  }
  
  // Get existing players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
  
  if (playersError) throw playersError
  
  // Check if max players reached
  if (players.length >= game.max_players) {
    throw new Error('This game is full')
  }
  
  // Add the new player
  const shortId = generateShortId()
  
  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      game_id: game.id,
      name: playerName,
      short_id: shortId,
      is_host: false
    })
    .select()
    .single()
  
  if (playerError) throw playerError
  
  return { game, player, existingPlayers: players }
}

// Start the game
async function startGame({ gameId }) {
  // Get used topic IDs for this game (none for a new game)
  const usedTopicIds = []
  
  // Update game status
  const { data: game, error: gameError } = await supabase
    .from('games')
    .update({ 
      status: 'in-progress',
      current_round: 1,
      round_count: 1
    })
    .eq('id', gameId)
    .select()
    .single()
  
  if (gameError) throw gameError
  
  // Choose a random round type
  const roundType = Math.random() > 0.5 ? 'match' : 'unmatch'
  
  // Get a topic for this round type
  const topic = getRandomTopic(roundType, usedTopicIds)
  
  // Create the first round
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .insert({
      game_id: gameId,
      round_number: 1,
      type: roundType,
      topic: topic.name,
      start_time: new Date()
    })
    .select()
    .single()
  
  if (roundError) throw roundError
  
  // Store the topic details with the round
  round.topicDetails = topic
  
  return { game, round }
}

// Submit a word
async function submitWord({ roundId, playerId, word, isFinal = false }) {
  // Check if submission already exists
  const { data: existingSubmission, error: checkError } = await supabase
    .from('submissions')
    .select('*')
    .eq('round_id', roundId)
    .eq('player_id', playerId)
    .eq('word', word)
    .maybeSingle()
  
  if (checkError) throw checkError
  
  let submission
  
  if (existingSubmission) {
    // Update existing submission
    const { data, error } = await supabase
      .from('submissions')
      .update({ is_final: isFinal })
      .eq('id', existingSubmission.id)
      .select()
      .single()
    
    if (error) throw error
    submission = data
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
      .single()
    
    if (error) throw error
    submission = data
  }
  
  return { submission }
}

// End the current round
async function endRound({ roundId, gameId, currentRoundNumber }) {
  // Get the current round to determine its type
  const { data: currentRound, error: roundQueryError } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()
  
  if (roundQueryError) throw roundQueryError
  
  // End the round
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .update({ end_time: new Date() })
    .eq('id', roundId)
    .select()
    .single()
  
  if (roundError) throw roundError
  
  // Get all previous rounds to track used topics
  const { data: previousRounds, error: previousRoundsError } = await supabase
    .from('rounds')
    .select('topic, type')
    .eq('game_id', gameId)
  
  if (previousRoundsError) throw previousRoundsError
  
  // Extract used topic names
  const usedMatchTopics = previousRounds
    .filter(r => r.type === 'match')
    .map(r => r.topic)
  
  const usedUnmatchTopics = previousRounds
    .filter(r => r.type === 'unmatch')
    .map(r => r.topic)
  
  // Convert topic names to IDs by looking them up in the topics cache
  const usedMatchTopicIds = usedMatchTopics.map(topicName => {
    const topic = topicsCache.match.find(t => t.name === topicName)
    return topic ? topic.id : null
  }).filter(id => id !== null)
  
  const usedUnmatchTopicIds = usedUnmatchTopics.map(topicName => {
    const topic = topicsCache.unmatch.find(t => t.name === topicName)
    return topic ? topic.id : null
  }).filter(id => id !== null)
  
  // Check if this was the last round (e.g., after 5 rounds)
  let nextRound = null
  
  if (currentRoundNumber >= 5) {
    // End the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .update({ status: 'completed' })
      .eq('id', gameId)
      .select()
      .single()
    
    if (gameError) throw gameError
  } else {
    // Start the next round with alternating type
    const nextRoundNumber = currentRoundNumber + 1
    const nextRoundType = currentRound.type === 'match' ? 'unmatch' : 'match'
    
    // Get a topic for the next round, avoiding previously used topics
    const usedTopicIds = nextRoundType === 'match' ? usedMatchTopicIds : usedUnmatchTopicIds
    const nextTopic = getRandomTopic(nextRoundType, usedTopicIds)
    
    // Update the game's current round
    await supabase
      .from('games')
      .update({ 
        current_round: nextRoundNumber,
        round_count: nextRoundNumber
      })
      .eq('id', gameId)
    
    // Create the next round
    const { data, error } = await supabase
      .from('rounds')
      .insert({
        game_id: gameId,
        round_number: nextRoundNumber,
        type: nextRoundType,
        topic: nextTopic.name,
        start_time: new Date()
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Add the topic details to the round
    nextRound = {
      ...data,
      topicDetails: nextTopic
    }
  }
  
  return { round, nextRound }
}

// Calculate scores for a round
async function calculateScores({ roundId }) {
  // Get the round details
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('*')
    .eq('id', roundId)
    .single()
  
  if (roundError) throw roundError
  
  // Get all submissions for the round
  const { data: submissions, error: submissionsError } = await supabase
    .from('submissions')
    .select('*')
    .eq('round_id', roundId)
  
  if (submissionsError) throw submissionsError
  
  // Get all players for the game
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', round.game_id)
  
  if (playersError) throw playersError
  
  // Group submissions by player
  const submissionsByPlayer = {}
  submissions.forEach(sub => {
    if (!submissionsByPlayer[sub.player_id]) {
      submissionsByPlayer[sub.player_id] = []
    }
    submissionsByPlayer[sub.player_id].push(sub.word)
  })
  
  // Calculate scores based on the round type
  const scores = {}
  const playerIds = Object.keys(submissionsByPlayer)
  
  if (round.type === 'match') {
    // For 'match' rounds, players get points for words that match other players
    playerIds.forEach(playerId => {
      scores[playerId] = 0
      const playerWords = submissionsByPlayer[playerId]
      
      playerIds.forEach(otherPlayerId => {
        if (playerId !== otherPlayerId) {
          const otherPlayerWords = submissionsByPlayer[otherPlayerId]
          
          playerWords.forEach(word => {
            if (otherPlayerWords.includes(word)) {
              scores[playerId] += 1
            }
          })
        }
      })
    })
  } else {
    // For 'unmatch' rounds, players get points for words that don't match any other player
    playerIds.forEach(playerId => {
      scores[playerId] = 0
      const playerWords = submissionsByPlayer[playerId]
      
      playerWords.forEach(word => {
        let isUnique = true
        
        playerIds.forEach(otherPlayerId => {
          if (playerId !== otherPlayerId) {
            const otherPlayerWords = submissionsByPlayer[otherPlayerId]
            if (otherPlayerWords.includes(word)) {
              isUnique = false
            }
          }
        })
        
        if (isUnique) {
          scores[playerId] += 1
        }
      })
    })
  }
  
  // Record scores and update player totals
  const roundScores = []
  
  for (const playerId of playerIds) {
    const roundScore = scores[playerId]
    
    // Record round score
    const { data: scoreRecord, error: scoreError } = await supabase
      .from('round_scores')
      .insert({
        round_id: roundId,
        player_id: playerId,
        score: roundScore
      })
      .select()
      .single()
    
    if (scoreError) throw scoreError
    roundScores.push(scoreRecord)
    
    // Update player's total score
    const player = players.find(p => p.id === playerId)
    if (player) {
      const newTotalScore = player.score + roundScore
      
      await supabase
        .from('players')
        .update({ score: newTotalScore })
        .eq('id', playerId)
    }
  }
  
  return { roundScores }
}
