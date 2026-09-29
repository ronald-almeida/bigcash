CREATE TABLE monthly_goals (
 month TEXT PRIMARY KEY,
 revenue_target INTEGER NOT NULL DEFAULT 0,
 profit_target INTEGER NOT NULL DEFAULT 0,
 actual_revenue INTEGER,
 actual_profit INTEGER,
 closed_at TEXT
);
INSERT INTO monthly_goals(month,revenue_target,profit_target)
SELECT substr(start_date,1,7), revenue, profit FROM goals
WHERE start_date = date(start_date,'start of month') AND end_date = date(start_date,'start of month','+1 month','-1 day');
