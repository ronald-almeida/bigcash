CREATE TABLE goals (
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  revenue INTEGER NOT NULL CHECK(revenue >= 0),
  profit INTEGER NOT NULL CHECK(profit >= 0),
  PRIMARY KEY(start_date, end_date)
);
