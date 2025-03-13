import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Time per round in seconds
const ROUND_TIME = 60;

// Define types for our data structures
interface Player {
  id: string;
  name: string;
  game_id: string;
  is_host: boolean;
  score: number;
  has_submitted?: boolean;
  created_at: string;
  submissionCount?: number;
}

interface Game {
  id: string;
  code: string;
  status: 'lobby' | 'active' | 'completed';
  current_round: number;
  round_count: number;
  created_at: string;
}

interface Round {
  id: string;
  game_id: string;
  round_number: number;
  type: 'match' | 'unmatch';
  topic: string;
  topic_id: string;
  start_time: string;
  end_time: string | null;
  is_completed: boolean;
}

interface Submission {
  id: string;
  player_id: string;
  round_id: string;
  word: string;
  submitted_at: string;
  is_final: boolean;
}

export default function Game() {
  const router = useRouter();
  const { code } = router.query;
  
  // State variables
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [currentRound, setCurrentRound] = useState<Round | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [words, setWords] = useState<string[]>(Array(5).fill(''));
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const [submittedWords, setSubmittedWords] = useState<string[]>([]);
  const [allPlayersSubmitted, setAllPlayersSubmitted] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [isRoundActive, setIsRoundActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roundEnded, setRoundEnded] = useState(false);
  
  // References for input fields
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Timer interval reference
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-save interval reference
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);

  // Function to format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle word input change
  const handleWordChange = (index: number, value: string): void => {
    if (hasSubmitted) return; // Don't allow changes after submission
    
    const newWords = [...words];
    newWords[index] = value;
    setWords(newWords);
  };

  // Handle key press in input field
  const handleKeyPress = (index: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to the next input field if not the last one
      if (index < 4 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // Submit words if it's the last field
        handleSubmitWords();
      }
    }
  };

  // Submit words
  const handleSubmitWords = async (): Promise<void> => {
    if (hasSubmitted || !playerId || !currentRound?.id) return;
    
    try {
      // Filter out empty words
      const validWords = words.filter(word => word.trim() !== '');
      
      if (validWords.length === 0) {
        alert('Please enter at least one word');
        return;
      }
      
      setIsSubmitting(true);
      
      // Submit each word
      for (const word of validWords) {
        await supabase.from('submissions').insert({
          player_id: playerId,
          round_id: currentRound.id,
          word: word.trim()
        });
      }
      
      // Update local state
      setHasSubmitted(true);
      setSubmittedWords(validWords);
      
      // Check if all players have submitted
      await fetchSubmissionCounts();
      
    } catch (error) {
      console.error('Error submitting words:', error);
      alert('Failed to submit words');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-save words periodically
  const autoSaveWords = async (): Promise<void> => {
    if (isRoundActive && !roundEnded) {
      await handleSubmitWords();
    }
  };

  // End the current round
  const endRound = async (): Promise<void> => {
    if (!game || !currentRound) return;

    try {
      console.log('Ending round:', currentRound.id);
      
      // Call the API to end the round
      const response = await fetch('/api/games/end-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: game.id,
          roundId: currentRound.id,
          roundNumber: currentRound.round_number
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to end round');
      }
      
      console.log('Round ended successfully, waiting for next round...');
      
      // The next round will be started automatically by the API
      // and detected by our real-time subscriptions
      
      // Update the local round state to reflect that it's ended
      setCurrentRound({
        ...currentRound,
        end_time: new Date().toISOString()
      });
      
      setRoundEnded(true);
    } catch (err) {
      console.error('Error ending round:', err);
      setError(err instanceof Error ? err.message : 'Failed to end the round');
    }
  };

  // Start the next round
  const startNextRound = async (): Promise<void> => {
    if (!game || !currentPlayer?.is_host) return;

    try {
      setError('');
      console.log('Starting next round for game:', game.id);
      console.log('Current round:', currentRound);
      
      // Call the API to start the next round
      const response = await fetch('/api/games/start-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: game.id,
          playerId: currentPlayer.id,
          currentRoundNumber: currentRound ? currentRound.round_number : 0
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Error response from start-round API:', data);
        throw new Error(data.error || 'Failed to start next round');
      }
      
      console.log('Next round started successfully:', data);
      
      // Force reload to get the new round data
      window.location.reload();
    } catch (err) {
      console.error('Error starting next round:', err);
      setError(`Failed to start the next round: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Load game and player data
  useEffect(() => {
    if (!code) return;

    const loadGameData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get the game
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('code', code)
          .single();

        if (gameError) throw gameError;
        if (!gameData) throw new Error('Game not found');
        
        setGame(gameData);
        setGameId(gameData.id);

        // Get the current player from localStorage
        const storedPlayerId = localStorage.getItem('playerId');
        if (!storedPlayerId) {
          throw new Error('Player not found. Please join the game again.');
        }
        
        setPlayerId(storedPlayerId);

        // Get the player data
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('id', storedPlayerId)
          .single();

        if (playerError) throw playerError;
        if (!playerData) throw new Error('Player not found');
        
        setCurrentPlayer(playerData);
        setIsHost(playerData.is_host);

        // Get all players in the game
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameData.id);

        if (playersError) throw playersError;
        setPlayers(playersData || []);

        // Get the current round
        const { data: roundData, error: roundError } = await supabase
          .from('rounds')
          .select('*')
          .eq('game_id', gameData.id)
          .eq('round_number', gameData.current_round)
          .single();

        if (roundError && roundError.code !== 'PGRST116') {
          // PGRST116 is "no rows returned" - this is expected if the game hasn't started yet
          throw roundError;
        }

        if (roundData) {
          setCurrentRound(roundData);
          
          // Check if the player has already submitted words for this round
          const { data: submissionsData, error: submissionsError } = await supabase
            .from('submissions')
            .select('word')
            .eq('round_id', roundData.id)
            .eq('player_id', storedPlayerId);
            
          if (!submissionsError && submissionsData && submissionsData.length > 0) {
            setHasSubmitted(true);
            setSubmittedWords(submissionsData.map(s => s.word));
          }
          
          // Set timer based on round start time and duration
          if (roundData.start_time && roundData.duration) {
            const startTime = new Date(roundData.start_time).getTime();
            const now = new Date().getTime();
            const elapsed = Math.floor((now - startTime) / 1000);
            const remaining = Math.max(0, roundData.duration - elapsed);
            
            setTimeLeft(remaining);
            setIsRoundActive(remaining > 0 && !roundData.end_time);
          }
          
          // Check if all players have submitted
          await fetchSubmissionCounts();
        } else if (gameData.status === 'in-progress') {
          // Game is in progress but no round data yet - check for rounds
          console.log('Game is in progress but no round data found. Checking for rounds...');
          checkForNextRound();
        }
      } catch (err) {
        console.error('Error loading game data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load game data');
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [code]);
  
  // Set up real-time subscriptions
  useEffect(() => {
    if (!gameId || !code) return;
    
    console.log('Setting up real-time subscriptions for game:', gameId);
    
    // Set up real-time subscriptions for game updates
    const gameSubscription = supabase
      .channel(`game:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        console.log('Game updated:', payload);
        const updatedGame = payload.new as Game;
        const oldGame = payload.old as Game;
        setGame(updatedGame);
        
        // If game is completed, redirect to scoreboard
        if (updatedGame.status === 'completed') {
          router.push(`/scoreboard/${code}`);
          return;
        }
        
        // If current round changed, check for the new round data
        if (updatedGame.current_round !== oldGame.current_round) {
          console.log(`Current round changed from ${oldGame.current_round} to ${updatedGame.current_round}`);
          checkForNextRound();
        }
      })
      .subscribe();

    // Set up real-time subscriptions for player updates
    const playersSubscription = supabase
      .channel(`players:${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${gameId}`,
      }, (payload) => {
        setPlayers(current => 
          current.map(p => p.id === payload.new.id ? payload.new as Player : p)
        );
      })
      .subscribe();
    
    // Cleanup subscriptions on unmount
    return () => {
      console.log('Cleaning up subscriptions');
      supabase.removeChannel(gameSubscription);
      supabase.removeChannel(playersSubscription);
      
      // Clear intervals
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [gameId, code, router]);
  
  // Set up round-specific subscriptions
  useEffect(() => {
    if (!currentRound?.id) return;
    
    console.log('Setting up real-time subscriptions for round:', currentRound.id);
    
    // Set up real-time subscriptions for submissions
    const submissionsSubscription = supabase
      .channel(`submissions:${currentRound.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `round_id=eq.${currentRound.id}`,
      }, () => {
        // Refresh submissions count for all players
        fetchSubmissionCounts();
      })
      .subscribe();

    // Set up real-time subscriptions for round updates
    const roundSubscription = supabase
      .channel(`round:${currentRound.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rounds',
        filter: `id=eq.${currentRound.id}`
      }, (payload) => {
        console.log('Round updated:', payload);
        const updatedRound = payload.new as Round;
        setCurrentRound(prevRound => {
          if (!prevRound) return updatedRound;
          return { ...prevRound, ...updatedRound };
        });
        
        // If the round has an end_time, it's completed
        if (updatedRound.end_time) {
          console.log('Round ended, checking for next round');
          checkForNextRound();
        }
      })
      .subscribe();
      
    return () => {
      console.log('Cleaning up round subscriptions');
      supabase.removeChannel(submissionsSubscription);
      supabase.removeChannel(roundSubscription);
    };
  }, [currentRound?.id]);
  
  // Function to check for the next round
  const checkForNextRound = async () => {
    if (!game || !code) return;
    
    try {
      console.log('Checking for next round...');
      
      // Get the latest game data
      const { data: updatedGame, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('code', code)
        .single();
        
      if (gameError) throw gameError;
      
      console.log('Updated game data:', updatedGame);
      setGame(updatedGame);
      
      // If the game is completed, we'll be redirected by the game subscription
      if (updatedGame.status === 'completed') {
        console.log('Game is completed, redirecting to scoreboard...');
        router.push(`/scoreboard/${code}`);
        return;
      }
      
      // Get the current round data
      const { data: roundData, error: roundError } = await supabase
        .from('rounds')
        .select('*')
        .eq('game_id', updatedGame.id)
        .eq('round_number', updatedGame.current_round)
        .single();
        
      if (roundError) {
        console.error('Error fetching round data:', roundError);
        // If we can't find the round, wait a moment and try again
        // This handles the case where the round is being created but not yet available
        setTimeout(() => checkForNextRound(), 1000);
        return;
      }
      
      console.log('New round data:', roundData);
      
      // Update the current round and reset submission state
      setCurrentRound(roundData);
      setRoundEnded(false);
      setHasSubmitted(false);
      setSubmittedWords([]);
      setWords(Array(5).fill(''));
      setAllPlayersSubmitted(false);
      
      // Reset the timer
      if (roundData.duration) {
        setTimeLeft(roundData.duration);
        setIsRoundActive(true);
      }
      
      // Check for existing submissions (in case the player refreshed the page)
      const { data: existingSubmissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('word')
        .eq('round_id', roundData.id)
        .eq('player_id', playerId);
        
      if (!submissionsError && existingSubmissions && existingSubmissions.length > 0) {
        console.log('Found existing submissions:', existingSubmissions);
        const existingWords = existingSubmissions.map(s => s.word);
        setSubmittedWords(existingWords);
        setHasSubmitted(true);
      }
      
    } catch (error) {
      console.error('Error checking for next round:', error);
    }
  };

  // Fetch submission counts for all players
  const fetchSubmissionCounts = async (): Promise<void> => {
    if (!currentRound?.id || !game?.id) return;
    
    try {
      console.log('Checking submission status for all players...');
      
      // Get all players in the game
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('id')
        .eq('game_id', game.id);
        
      if (playersError) throw playersError;
      
      if (!playersData || playersData.length === 0) {
        console.error('No players found for this game');
        return;
      }
      
      console.log(`Found ${playersData.length} players in the game`);
      
      // Get all submissions for the current round
      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('player_id, word')
        .eq('round_id', currentRound.id);
        
      if (submissionsError) throw submissionsError;
      
      // Count unique players who have submitted
      const playersWhoSubmitted = new Set();
      submissions?.forEach(sub => playersWhoSubmitted.add(sub.player_id));
      
      console.log(`${playersWhoSubmitted.size} of ${playersData.length} players have submitted`);
      
      // Check if all players have submitted
      const allSubmitted = playersData.length > 0 && playersWhoSubmitted.size >= playersData.length;
      setAllPlayersSubmitted(allSubmitted);
      
      // If all players have submitted and the current player is the host, end the round
      if (allSubmitted && currentPlayer?.is_host && !currentRound.end_time) {
        console.log('All players have submitted, ending round automatically...');
        await endRound();
      }
      
    } catch (error) {
      console.error('Error fetching submission counts:', error);
    }
  };

  // Set up the countdown timer
  useEffect(() => {
    if (isRoundActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Time's up, clear interval and end round
            if (timerRef.current) clearInterval(timerRef.current);
            setIsRoundActive(false);
            setRoundEnded(true);
            
            // Auto-submit words if player hasn't submitted yet
            if (currentPlayer && !hasSubmitted) {
              handleSubmitWords();
            }
            
            // If player is host, end the round
            if (currentPlayer?.is_host) {
              console.log('Time is up, host is ending the round');
              endRound();
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Set up auto-save interval (every 10 seconds)
      autoSaveRef.current = setInterval(autoSaveWords, 10000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [isRoundActive, timeLeft, currentPlayer]);

  // Fetch submission counts when the round changes
  useEffect(() => {
    if (currentRound) {
      fetchSubmissionCounts();
    }
  }, [currentRound]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading game...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Playing Game | Word Match Game</title>
        <meta name="description" content="Play the word matching game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-gray-800">
                  Game #{code}
                </h1>
                <div className="text-sm text-gray-500">
                  Round {game?.current_round} of {game?.round_count}
                  {game?.status === 'completed' && (
                    <Link href={`/scoreboard/${code}`} className="ml-2 text-blue-600 hover:text-blue-800">
                      View Final Scoreboard
                    </Link>
                  )}
                </div>
              </div>

              {currentRound && (
                <div className={`p-4 rounded-lg mb-6 ${
                  currentRound.type === 'match' 
                    ? 'bg-blue-50' 
                    : 'bg-purple-50'
                }`}>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className={`text-lg font-semibold ${
                      currentRound.type === 'match' 
                        ? 'text-blue-800' 
                        : 'text-purple-800'
                    }`}>
                      {currentRound.type === 'match' 
                        ? 'Match Words Round' 
                        : 'Be Unique Round'}
                    </h2>
                    <div className={`text-xl font-mono ${
                      timeLeft <= 10 
                        ? 'text-red-600 animate-pulse' 
                        : timeLeft <= 30 
                          ? 'text-orange-600' 
                          : 'text-gray-700'
                    }`}>
                      {formatTime(timeLeft)}
                    </div>
                  </div>
                  <div className="text-xl font-medium text-gray-800 mb-1">
                    Topic: {currentRound.topic}
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    {currentRound.type === 'match' 
                      ? 'Try to write the same words as other players!' 
                      : 'Try to write words that no one else will think of!'}
                  </p>

                  {/* Word submission form */}
                  <div className="mt-4">
                    {hasSubmitted ? (
                      <div className="bg-green-50 p-4 rounded-md mb-4">
                        <p className="text-green-700 font-medium">You have submitted your words!</p>
                        <ul className="mt-2 list-disc pl-5">
                          {submittedWords.map((word, index) => (
                            <li key={index} className="text-gray-700">{word}</li>
                          ))}
                        </ul>
                        <p className="mt-2 text-sm text-gray-500">
                          {allPlayersSubmitted 
                            ? 'All players have submitted. Moving to the next round soon...' 
                            : 'Waiting for other players to submit...'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {words.map((word, index) => (
                          <input
                            key={index}
                            type="text"
                            value={word}
                            onChange={(e) => handleWordChange(index, e.target.value)}
                            onKeyPress={(e) => handleKeyPress(index, e)}
                            ref={(el) => { inputRefs.current[index] = el; }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Word ${index + 1}`}
                            disabled={hasSubmitted || isSubmitting}
                            maxLength={30}
                          />
                        ))}
                        
                        <div className="mt-4 flex justify-between">
                          <button
                            onClick={handleSubmitWords}
                            disabled={hasSubmitted || isSubmitting}
                            className={`px-4 py-2 rounded-md font-medium ${
                              isRoundActive && !isSubmitting
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {isSubmitting ? 'Submitting...' : 'Submit Words'}
                          </button>
                          
                          {currentPlayer?.is_host && roundEnded && (
                            <button
                              onClick={startNextRound}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                            >
                              Start Next Round
                            </button>
                          )}
                        </div>

                        {roundEnded && !currentPlayer?.is_host && (
                          <p className="mt-4 text-center text-gray-600">
                            Waiting for the host to start the next round...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">Players</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {players.map((player) => (
                    <div 
                      key={player.id} 
                      className={`p-3 rounded-md border ${
                        player.id === currentPlayer?.id 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium text-gray-800">{player.name}</p>
                          <div className="flex items-center mt-1">
                            {player.is_host && (
                              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full mr-2">
                                Host
                              </span>
                            )}
                            {player.has_submitted ? (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Submitted
                              </span>
                            ) : (
                              <div className="flex items-center">
                                <span className="text-xs text-gray-500 mr-1">
                                  {player.submissionCount || 0}/5
                                </span>
                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 rounded-full"
                                    style={{ width: `${((player.submissionCount || 0) / 5) * 100}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-gray-800">
                          {player.score}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
