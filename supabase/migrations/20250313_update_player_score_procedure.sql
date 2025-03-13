-- Create a function to update player scores
CREATE OR REPLACE FUNCTION update_player_score(p_player_id UUID, p_score_to_add INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Update the player's score by adding the new score
  UPDATE players
  SET score = score + p_score_to_add
  WHERE id = p_player_id;
END;
$$ LANGUAGE plpgsql;
