export interface LegalTable {
  head: string[];
  rows: string[][];
}

export interface LegalSection {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: LegalTable;
  /** Parágrafos exibidos depois da lista/tabela */
  after?: string[];
}
