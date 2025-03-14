import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Head from 'next/head';
import styles from '../../styles/Scoreboard.module.css';
import confetti from 'canvas-confetti';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Define types
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
  status: string;
  created_at: string;
  round_count: number;
  current_round: number;
}

export default function Scoreboard() {
  const router = useRouter();
  const { code } = router.query;
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  // Load game and players data
  useEffect(() => {
    const fetchScoreboard = async () => {
      try {
        setLoading(true);
        
        // Get the game data
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('*')
          .eq('code', code)
          .single();
          
        if (gameError) throw gameError;
        
        // Get all players in the game
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', gameData.id)
          .order('score', { ascending: false });
          
        if (playersError) throw playersError;
        
        setPlayers(playersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching scoreboard:', error);
        setError('Failed to load scoreboard data');
        setLoading(false);
      }
    };
    
    if (code) {
      fetchScoreboard();
    }
  }, [code, supabase]);

  // Confetti effect for winners
  const triggerWinnerConfetti = () => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // since particles fall down, start a bit higher than random
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  // Smaller confetti effect for non-winners
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  // Handle "Play Again" button
  const handlePlayAgain = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Final Scoreboard | Cards Match</title>
        </Head>
        <div className={styles.loading}>Loading final scores...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Head>
          <title>Error | Cards Match</title>
        </Head>
        <div className={styles.error}>{error}</div>
        <button className={styles.button} onClick={() => router.push('/')}>
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Final Scoreboard | Cards Match</title>
      </Head>
      
      <div className={styles.scoreboardContainer}>
        <h1 className={styles.title}>Game Over!</h1>
        <h2 className={styles.subtitle}>Final Scores</h2>
        
        <div className={styles.scoreboardWrapper}>
          <table className={styles.scoreboard}>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, index) => {
                // Determine if this player is a winner
                const isWinner = index === 0 || (players[0] && player.score === players[0].score);
                // Determine if this is the current player
                const isCurrentPlayer = currentPlayer && player.id === currentPlayer.id;
                
                return (
                  <tr 
                    key={player.id} 
                    className={`
                      ${isWinner ? styles.winner : ''} 
                      ${isCurrentPlayer ? styles.currentPlayer : ''}
                    `}
                  >
                    <td>{index + 1}</td>
                    <td>
                      {player.name} 
                      {isWinner && <span className={styles.crownIcon}>👑</span>}
                      {isCurrentPlayer && <span className={styles.youLabel}> (You)</span>}
                    </td>
                    <td>{player.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className={styles.buttonsContainer}>
          <button 
            className={`${styles.button} ${styles.primaryButton}`} 
            onClick={handlePlayAgain}
          >
            Play Again
          </button>
          <Link href="/" className={styles.button}>
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
