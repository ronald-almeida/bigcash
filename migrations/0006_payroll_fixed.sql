UPDATE entries SET data=json_set(data,'$.kind','fixed','$.category','Folha salarial') WHERE json_extract(data,'$.kind')='payroll';
