CREATE TABLE IF NOT EXISTS applications (
  session_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  furthest_step TEXT NOT NULL,
  furthest_number INTEGER NOT NULL,
  completed INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  goals TEXT NOT NULL DEFAULT '[]',
  gender TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  drive TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  work TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  rounds TEXT NOT NULL DEFAULT '',
  days TEXT NOT NULL DEFAULT '[]',
  times TEXT NOT NULL DEFAULT '[]',
  fees TEXT NOT NULL DEFAULT '[]',
  interests TEXT NOT NULL DEFAULT '[]',
  commitment TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS applications_area_idx ON applications (area);
CREATE INDEX IF NOT EXISTS applications_status_idx ON applications (status);
CREATE INDEX IF NOT EXISTS applications_completed_idx ON applications (completed);
