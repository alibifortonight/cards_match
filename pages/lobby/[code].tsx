import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define types for our data structures
interface Player {
  id: string;
  name: string;
  game_id: string;
  is_host: boolean;
  score: number;
  created_at: string;
}

interface Game {
  id: string;
  code: string;
  status: 'lobby' | 'in-progress' | 'completed';
  current_round: number;
  round_count: number;
  created_at: string;
}

export default function Lobby() {
  const router = useRouter();
  const { code } = router.query;
  
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [startingGame, setStartingGame] = useState(false);
  const [copied, setCopied] = useState(false);

  // Check if the current player is the host
  const isHost = currentPlayer?.is_host || false;
  
  // Check if there are enough players to start the game (at least 2)
  const canStartGame = players.length >= 2;

  useEffect(() => {
    // Only run this effect when the code is available from the router
    if (!code) return;

    const playerId = localStorage.getItem('playerId');
    if (!playerId) {
      router.push('/');
      return;
    }

    const fetchGameAndPlayers = async () => {
      try {
        setLoading(true);
        
        // Fetch game data
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('code', code)
          .single();

        if (gameError) throw gameError;
        
        if (gameData.status === 'in-progress') {
          // If game has already started, redirect to game page
          router.push(`/game/${code}`);
          return;
        }

        setGame(gameData);

        // Fetch players in this game
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameData.id)
          .order('created_at', { ascending: true });

        if (playersError) throw playersError;
        
        setPlayers(playersData);

        // Find the current player
        const player = playersData.find(p => p.id === playerId);
        if (!player) {
          // If player not found in this game, redirect to home
          localStorage.removeItem('playerId');
          router.push('/');
          return;
        }

        setCurrentPlayer(player);
      } catch (err) {
        console.error('Error fetching game data:', err);
        setError('Failed to load game data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchGameAndPlayers();

    // Set up real-time subscription for player updates
    const playersSubscription = supabase
      .channel('public:players')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'players',
        filter: `game_id=eq.${game?.id}`,
      }, (payload) => {
        setPlayers(current => [...current, payload.new as Player]);
      })
      .subscribe();

    // Subscribe to game updates
    const gameId = game?.id;
    if (gameId) {
      const gameSubscription = supabase
        .channel(`game:${gameId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        }, (payload) => {
          console.log('Game updated:', payload);
          const updatedGame = payload.new;
          
          // If game status changed to in-progress, redirect to game page
          if (updatedGame.status === 'in-progress') {
            console.log('Game started, redirecting to game page');
            router.push(`/game/${code}`);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(gameSubscription);
      };
    }

    // Cleanup subscriptions on unmount
    return () => {
      playersSubscription.unsubscribe();
    };
  }, [code, router, game?.id]);

  const handleStartGame = async () => {
    if (!isHost || !canStartGame || startingGame) return;

    setStartingGame(true);
    setError('');

    try {
      const response = await fetch('/api/games/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: game?.id,
          playerId: currentPlayer?.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start game');
      }

      // The redirect will happen automatically when the game status updates
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err instanceof Error ? err.message : 'Failed to start game');
      setStartingGame(false);
    }
  };

  const copyGameCode = () => {
    if (typeof code === 'string') {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading lobby...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Game Lobby | Word Match Game</title>
        <meta name="description" content="Waiting for players to join" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
              Game Lobby
            </h1>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
                {error}
              </div>
            )}

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-blue-800">Game Code</h2>
                  <p className="text-3xl font-mono tracking-wider mt-1">{code}</p>
                </div>
                <button
                  onClick={copyGameCode}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm transition duration-200"
                >
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Share this code with friends to join your game
              </p>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Players ({players.length})</h2>
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-md">
                {players.map((player) => (
                  <li key={player.id} className="flex items-center p-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{player.name}</p>
                      {player.is_host && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          Host
                        </span>
                      )}
                    </div>
                    {player.id === currentPlayer?.id && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {isHost ? (
              <div className="text-center">
                <button
                  onClick={handleStartGame}
                  disabled={!canStartGame || startingGame}
                  className={`
                    w-full py-3 px-4 rounded-md font-medium transition duration-200
                    ${canStartGame 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
                  `}
                >
                  {startingGame 
                    ? 'Starting Game...' 
                    : canStartGame 
                      ? 'Start Game' 
                      : 'Need at least 2 players to start'}
                </button>
              </div>
            ) : (
              <div className="text-center text-gray-600">
                Waiting for the host to start the game...
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
