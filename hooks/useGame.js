import { useState, useEffect, useCallback } from 'react';
import { 
  supabase, 
  gameOperations, 
  playerOperations, 
  submissionOperations, 
  scoreOperations, 
  realtime 
} from '../lib/supabase';
import { TopicsTracker } from '../lib/topicsManager';

export function useGame() {
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [roundScores, setRoundScores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [topics, setTopics] = useState(null);
  const [topicsTracker, setTopicsTracker] = useState(null);

  // Initialize topics
  useEffect(() => {
    const initializeTopics = async () => {
      try {
        // In a real app, you would fetch this from an API endpoint that loads the topics
        const response = await fetch('/api/topics');
        const topicsData = await response.json();
        setTopics(topicsData);
        setTopicsTracker(new TopicsTracker(topicsData));
      } catch (err) {
        setError('Failed to load topics: ' + err.message);
      }
    };

    initializeTopics();
  }, []);

  // Clear all state
  const resetGameState = useCallback(() => {
    setGame(null);
    setPlayers([]);
    setCurrentRound(null);
    setSubmissions([]);
    setRoundScores([]);
    setError(null);
    
    // Reset the topics tracker
    if (topicsTracker) {
      topicsTracker.reset();
    }
  }, [topicsTracker]);

  // Create a new game
  const createGame = useCallback(async (playerName, timePerRound = 60, maxPlayers = 8) => {
    try {
      setLoading(true);
      setError(null);
      
      // Create the game
      const newGame = await gameOperations.createGame(timePerRound, maxPlayers);
      
      // Add the host player
      const hostPlayer = await playerOperations.addPlayer(newGame.id, playerName, true);
      
      // Set up real-time subscriptions
      setupSubscriptions(newGame.id);
      
      // Update state
      setGame(newGame);
      setPlayers([hostPlayer]);
      
      return { game: newGame, player: hostPlayer };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Join an existing game
  const joinGame = useCallback(async (gameCode, playerName) => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the game by code
      const existingGame = await gameOperations.getGameByCode(gameCode);
      
      // Check if game is joinable
      if (existingGame.status !== 'lobby') {
        throw new Error('This game has already started');
      }
      
      // Get existing players
      const existingPlayers = await playerOperations.getGamePlayers(existingGame.id);
      
      // Check if max players reached
      if (existingPlayers.length >= existingGame.max_players) {
        throw new Error('This game is full');
      }
      
      // Add the new player
      const newPlayer = await playerOperations.addPlayer(existingGame.id, playerName);
      
      // Set up real-time subscriptions
      setupSubscriptions(existingGame.id);
      
      // Update state
      setGame(existingGame);
      setPlayers([...existingPlayers, newPlayer]);
      
      return { game: existingGame, player: newPlayer };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Start the game
  const startGame = useCallback(async (gameId) => {
    try {
      if (!topicsTracker) {
        throw new Error('Topics not loaded yet');
      }
      
      setLoading(true);
      setError(null);
      
      // Update game status
      const updatedGame = await gameOperations.updateGameStatus(gameId, 'in-progress');
      
      // Get a random round type
      const roundType = Math.random() > 0.5 ? 'match' : 'unmatch';
      
      // Get a topic for the round type
      const topic = topicsTracker.getTopicForRoundType(roundType);
      
      // Start the first round
      const firstRound = await gameOperations.startNewRound(
        gameId, 
        1, 
        roundType,
        topic.name
      );
      
      // Update state
      setGame(updatedGame);
      setCurrentRound({...firstRound, topicDetails: topic});
      
      return { game: updatedGame, round: firstRound };
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [topicsTracker]);

  // Submit a word for the current round
  const submitWord = useCallback(async (roundId, playerId, word, isFinal = false) => {
    try {
      setError(null);
      
      // Save the submission
      const submission = await submissionOperations.saveSubmission(roundId, playerId, word, isFinal);
      
      return submission;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Finalize all submissions for a player
  const finalizeSubmissions = useCallback(async (roundId, playerId) => {
    try {
      setError(null);
      
      await submissionOperations.finalizeSubmissions(roundId, playerId);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // End the current round
  const endRound = useCallback(async (roundId, gameId, currentRoundNumber) => {
    try {
      if (!topicsTracker) {
        throw new Error('Topics not loaded yet');
      }
      
      setLoading(true);
      setError(null);
      
      // End the round
      await gameOperations.endRound(roundId);
      
      // Calculate and record scores
      await calculateAndRecordScores(roundId);
      
      // Check if this was the last round (e.g., after 5 rounds)
      if (currentRoundNumber >= 5) {
        // End the game
        await gameOperations.updateGameStatus(gameId, 'completed');
      } else {
        // Get a random round type for the next round
        // Alternate between match and unmatch
        const nextRoundType = currentRound.type === 'match' ? 'unmatch' : 'match';
        
        // Get a topic for the next round
        const nextTopic = topicsTracker.getTopicForRoundType(nextRoundType);
        
        // Start the next round
        const nextRound = await gameOperations.startNewRound(
          gameId,
          currentRoundNumber + 1,
          nextRoundType,
          nextTopic.name
        );
        
        setCurrentRound({...nextRound, topicDetails: nextTopic});
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [topicsTracker, currentRound]);

  // Calculate scores for the round
  const calculateAndRecordScores = async (roundId) => {
    // Get all submissions for the round
    const allSubmissions = await submissionOperations.getRoundSubmissions(roundId);
    
    // Get the round details
    const round = currentRound;
    
    // Group submissions by player
    const submissionsByPlayer = {};
    allSubmissions.forEach(sub => {
      if (!submissionsByPlayer[sub.player_id]) {
        submissionsByPlayer[sub.player_id] = [];
      }
      submissionsByPlayer[sub.player_id].push(sub.word);
    });
    
    // Calculate scores based on the round type
    const scores = {};
    const playerIds = Object.keys(submissionsByPlayer);
    
    if (round.type === 'match') {
      // For 'match' rounds, players get points for words that match other players
      playerIds.forEach(playerId => {
        scores[playerId] = 0;
        const playerWords = submissionsByPlayer[playerId];
        
        playerIds.forEach(otherPlayerId => {
          if (playerId !== otherPlayerId) {
            const otherPlayerWords = submissionsByPlayer[otherPlayerId];
            
            playerWords.forEach(word => {
              if (otherPlayerWords.includes(word)) {
                scores[playerId] += 1;
              }
            });
          }
        });
      });
    } else {
      // For 'unmatch' rounds, players get points for words that don't match any other player
      playerIds.forEach(playerId => {
        scores[playerId] = 0;
        const playerWords = submissionsByPlayer[playerId];
        
        playerWords.forEach(word => {
          let isUnique = true;
          
          playerIds.forEach(otherPlayerId => {
            if (playerId !== otherPlayerId) {
              const otherPlayerWords = submissionsByPlayer[otherPlayerId];
              if (otherPlayerWords.includes(word)) {
                isUnique = false;
              }
            }
          });
          
          if (isUnique) {
            scores[playerId] += 1;
          }
        });
      });
    }
    
    // Record scores and update player totals
    for (const playerId of playerIds) {
      const roundScore = scores[playerId];
      
      // Record round score
      await scoreOperations.recordRoundScore(roundId, playerId, roundScore);
      
      // Update player's total score
      const player = players.find(p => p.id === playerId);
      if (player) {
        const newTotalScore = player.score + roundScore;
        await playerOperations.updatePlayerScore(playerId, newTotalScore);
      }
    }
  };

  // Set up real-time subscriptions
  const setupSubscriptions = useCallback((gameId) => {
    // Subscribe to game updates
    const gameSubscription = realtime.subscribeToGame(gameId, (payload) => {
      if (payload.eventType === 'UPDATE') {
        setGame(payload.new);
        
        // If game status changed to completed, we might want to do something
        if (payload.new.status === 'completed') {
          // Handle game completion
        }
      }
    });
    
    // Subscribe to player updates
    const playersSubscription = realtime.subscribeToPlayers(gameId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setPlayers(prevPlayers => [...prevPlayers, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setPlayers(prevPlayers => 
          prevPlayers.map(player => 
            player.id === payload.new.id ? payload.new : player
          )
        );
      }
    });
    
    // Subscribe to round updates
    const roundsSubscription = realtime.subscribeToRounds(gameId, async (payload) => {
      if (payload.eventType === 'INSERT') {
        // Find the topic details for this round
        let topicDetails = null;
        if (topics) {
          const roundType = payload.new.type;
          const topicName = payload.new.topic;
          const topicsList = topics[roundType] || [];
          topicDetails = topicsList.find(t => t.name === topicName) || null;
        }
        
        setCurrentRound({...payload.new, topicDetails});
        
        // Clear previous round data
        setSubmissions([]);
        setRoundScores([]);
      } else if (payload.eventType === 'UPDATE') {
        setCurrentRound(prev => ({...payload.new, topicDetails: prev.topicDetails}));
        
        // If the round was just ended (end_time was set)
        if (payload.new.end_time && (!payload.old.end_time)) {
          // Fetch round scores
          const scores = await scoreOperations.getRoundScores(payload.new.id);
          setRoundScores(scores);
        }
      }
    });
    
    // Return cleanup function
    return () => {
      gameSubscription.unsubscribe();
      playersSubscription.unsubscribe();
      roundsSubscription.unsubscribe();
    };
  }, [topics, players]);

  // Subscribe to submissions when current round changes
  useEffect(() => {
    if (!currentRound) return;
    
    // Subscribe to submissions for the current round
    const submissionsSubscription = realtime.subscribeToSubmissions(currentRound.id, (payload) => {
      if (payload.eventType === 'INSERT') {
        setSubmissions(prev => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setSubmissions(prev => 
          prev.map(sub => sub.id === payload.new.id ? payload.new : sub)
        );
      }
    });
    
    // Subscribe to round scores
    const scoresSubscription = realtime.subscribeToRoundScores(currentRound.id, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        setRoundScores(prev => {
          const exists = prev.some(score => score.id === payload.new.id);
          if (exists) {
            return prev.map(score => score.id === payload.new.id ? payload.new : score);
          } else {
            return [...prev, payload.new];
          }
        });
      }
    });
    
    // Fetch existing submissions for this round
    const fetchExistingSubmissions = async () => {
      try {
        const existingSubmissions = await submissionOperations.getRoundSubmissions(currentRound.id);
        setSubmissions(existingSubmissions);
        
        const existingScores = await scoreOperations.getRoundScores(currentRound.id);
        setRoundScores(existingScores);
      } catch (err) {
        setError(err.message);
      }
    };
    
    fetchExistingSubmissions();
    
    return () => {
      submissionsSubscription.unsubscribe();
      scoresSubscription.unsubscribe();
    };
  }, [currentRound]);

  return {
    // State
    game,
    players,
    currentRound,
    submissions,
    roundScores,
    loading,
    error,
    topics,
    
    // Actions
    createGame,
    joinGame,
    startGame,
    submitWord,
    finalizeSubmissions,
    endRound,
    resetGameState
  };
}
