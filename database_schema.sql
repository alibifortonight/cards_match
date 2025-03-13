-- Database schema for Word-Match/Unmatch Game

-- Games table to store main game information
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(6) UNIQUE NOT NULL,  -- Short code for players to join
    status VARCHAR(20) NOT NULL CHECK (status IN ('lobby', 'in-progress', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    round_count INTEGER DEFAULT 0,
    current_round INTEGER DEFAULT 0,
    time_per_round INTEGER DEFAULT 60,  -- Time limit in seconds
    max_players INTEGER DEFAULT 8
);

-- Players table to store player information
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    short_id VARCHAR(8) NOT NULL,
    score INTEGER DEFAULT 0,
    is_host BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, short_id)
);

-- Rounds table to store round information
CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('match', 'unmatch')),
    topic VARCHAR(100) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, round_number)
);

-- Submissions table to store player submissions for each round
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_final BOOLEAN DEFAULT FALSE,  -- Flag to indicate if submission is final
    UNIQUE(round_id, player_id, word)
);

-- Round scores table to store scores for each player in each round
CREATE TABLE round_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID REFERENCES rounds(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(round_id, player_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_rounds_game_id ON rounds(game_id);
CREATE INDEX idx_submissions_round_id ON submissions(round_id);
CREATE INDEX idx_submissions_player_id ON submissions(player_id);
CREATE INDEX idx_round_scores_round_id ON round_scores(round_id);
CREATE INDEX idx_round_scores_player_id ON round_scores(player_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update the updated_at column
CREATE TRIGGER update_games_updated_at
BEFORE UPDATE ON games
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rounds_updated_at
BEFORE UPDATE ON rounds
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies for security
-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE round_scores ENABLE ROW LEVEL SECURITY;

-- Create policies (these are simplified and should be adjusted based on your auth setup)
CREATE POLICY "Anyone can read games" ON games FOR SELECT USING (true);
CREATE POLICY "Anyone can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can read rounds" ON rounds FOR SELECT USING (true);
CREATE POLICY "Anyone can read submissions" ON submissions FOR SELECT USING (true);
CREATE POLICY "Anyone can read round_scores" ON round_scores FOR SELECT USING (true);

-- More restrictive policies for insert/update/delete would be needed in production
