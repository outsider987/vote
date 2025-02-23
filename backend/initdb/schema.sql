-- 建立活動資料表
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(36) PRIMARY KEY,
  event_date DATE NOT NULL,
  member_count INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  options JSON NOT NULL,
  votes_per_user INT NOT NULL,
  show_count INT NOT NULL,
  is_voting_started BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 建立票券資料表
CREATE TABLE IF NOT EXISTS tickets (
  vote_code VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event
    FOREIGN KEY(event_id)
      REFERENCES events(id) ON DELETE CASCADE
);

-- 建立投票記錄資料表
CREATE TABLE IF NOT EXISTS votes (
  id VARCHAR(36) PRIMARY KEY,
  event_id VARCHAR(36) NOT NULL,
  vote_code VARCHAR(36) NOT NULL,
  candidate VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_event_vote
    FOREIGN KEY(event_id)
      REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_vote
    FOREIGN KEY(vote_code)
      REFERENCES tickets(vote_code) ON DELETE CASCADE
);
