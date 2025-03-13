import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create game');
      }

      // Store player ID in localStorage for session management
      localStorage.setItem('playerId', data.player.id);
      
      // Navigate to the lobby
      router.push(`/lobby/${data.game.code}`);
    } catch (err) {
      console.error('Error creating game:', err);
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!gameCode.trim()) {
      setError('Please enter a game code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/games/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ playerName, gameCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join game');
      }

      // Store player ID in localStorage for session management
      localStorage.setItem('playerId', data.player.id);
      
      // Navigate to the lobby
      router.push(`/lobby/${data.game.code}`);
    } catch (err) {
      console.error('Error joining game:', err);
      setError(err instanceof Error ? err.message : 'Failed to join game');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Word Match Game</title>
        <meta name="description" content="A multiplayer word matching game" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
              Word Match Game
            </h1>

            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <h2 className="text-lg font-semibold text-blue-800 mb-2">Game Rules</h2>
              <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                <li>In <strong>Match Rounds</strong>, try to write the same words as other players</li>
                <li>In <strong>Unmatch Rounds</strong>, try to write unique words that no one else writes</li>
                <li>Each round has a specific topic to guide your word choices</li>
                <li>Score points based on matches or uniqueness depending on the round type</li>
                <li>The player with the most points at the end wins!</li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">
                Your Name
              </label>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your name"
                disabled={isLoading}
              />
            </div>

            {!showJoinForm ? (
              <div className="space-y-3">
                <button
                  onClick={handleCreateGame}
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create New Game'}
                </button>
                <button
                  onClick={() => setShowJoinForm(true)}
                  disabled={isLoading}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50"
                >
                  Join Existing Game
                </button>
              </div>
            ) : (
              <form onSubmit={handleJoinGame} className="space-y-3">
                <div>
                  <label htmlFor="gameCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Game Code
                  </label>
                  <input
                    type="text"
                    id="gameCode"
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50"
                >
                  {isLoading ? 'Joining...' : 'Join Game'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinForm(false)}
                  disabled={isLoading}
                  className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-md transition duration-200 disabled:opacity-50"
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
