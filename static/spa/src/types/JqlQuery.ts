
// https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-jql/#api-rest-api-3-jql-parse-post

export type JqlQuery = {
  where: JqlQueryWhereClause;
  orderBy: JqlQueryOrderByClause;
}

export type JqlQueryWhereClause = CompoundClause | FieldValueClause | FieldWasClause | FieldChangedClause;

export type CompoundClause = {
  clauses: JqlQueryWhereClause[];
  operator: 'and' | 'or' | 'not';
}

export type FieldValueClause = {
  field: JqlQueryField;
  operand: ListOperand | ValueOperand | FunctionOperand | KeywordOperand;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'in' | 'not in' | '~' | '~=' | 'is' | 'is not';
}

export type FieldWasClause = {
  // TBD
}

export type FieldChangedClause = {
  // TBD
}

export type ListOperand = {
  encodedOperand?: string;
  values: any[]; // TBD
}

export type ValueOperand = {
  encodedOperand?: string;
  value: string;
}

export type FunctionOperand = {
  // TBD
}

export type KeywordOperand = {
  // TBD
}

export type JqlQueryField = {
  name: string;
  encodedName?: string;
  property?: JqlQueryFieldEntityProperty[]
}

export type JqlQueryFieldEntityProperty = {
  entity: string;
  key: string;
  path: string;
  type?: string;
}

export type JqlQueryOrderByClause = {
  fields: JqlQueryOrderByClauseElement[];
}

export type JqlQueryOrderByClauseElement = {
  field: string;
  direction?: 'asc' | 'desc';
}
