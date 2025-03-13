-- Create a stored procedure to start a game and create the first round
CREATE OR REPLACE FUNCTION start_game(
  p_game_id UUID,
  p_round_type TEXT,
  p_topic TEXT,
  p_topic_id TEXT
) RETURNS VOID AS $$
DECLARE
  v_round_id UUID;
  v_has_topic_id BOOLEAN;
BEGIN
  -- Check if topic_id column exists in rounds table
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'rounds' AND column_name = 'topic_id'
  ) INTO v_has_topic_id;

  -- Update the game status to in-progress and set current round to 1
  UPDATE games
  SET 
    status = 'in-progress',
    current_round = 1,
    updated_at = NOW()
  WHERE id = p_game_id;
  
  -- Create the first round
  IF v_has_topic_id THEN
    -- If topic_id column exists, include it in the INSERT
    INSERT INTO rounds (
      id,
      game_id,
      round_number,
      type,
      topic,
      topic_id,
      start_time,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_game_id,
      1,
      p_round_type,
      p_topic,
      p_topic_id,
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO v_round_id;
  ELSE
    -- If topic_id column doesn't exist, omit it from the INSERT
    INSERT INTO rounds (
      id,
      game_id,
      round_number,
      type,
      topic,
      start_time,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_game_id,
      1,
      p_round_type,
      p_topic,
      NOW(),
      NOW(),
      NOW()
    ) RETURNING id INTO v_round_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
