-- Preserve amounts, dates, status and recurring schedules while consolidating the category.
UPDATE entries SET data=json_set(data,'$.kind','fixed','$.category','Pró-labore') WHERE json_extract(data,'$.kind')='salary';
