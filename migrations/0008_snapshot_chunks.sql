-- Split immutable revisions so no financial history row approaches D1's 2 MB limit.
CREATE TABLE finance_snapshots (
  version INTEGER NOT NULL,
  part INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY(version,part)
);

