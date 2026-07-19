/**
 * Split a `.sql` file into individual statements. The Neon HTTP driver runs one
 * statement per prepared query, so a migration with several DDL commands (and a
 * dollar-quoted function body) has to be executed piece by piece.
 *
 * The scanner tracks the contexts where a `;` is not a statement boundary: line
 * comments and slash-star block comments, both dropped; single-quoted string
 * literals (`'…'`, with `''` as an escaped quote); and dollar-quoted blocks
 * (`$$…$$`, `$tag$…$tag$`, copied verbatim including any comments inside them).
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null;
  let inString = false;
  let i = 0;

  while (i < sql.length) {
    const ch = sql[i]!;
    const rest = sql.slice(i);

    if (dollarTag) {
      if (rest.startsWith(dollarTag)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        current += ch;
        i += 1;
      }
      continue;
    }

    if (inString) {
      current += ch;
      i += 1;
      if (ch === "'") {
        if (sql[i] === "'") {
          current += "'"; // escaped quote, stay in the string
          i += 1;
        } else {
          inString = false;
        }
      }
      continue;
    }

    if (rest.startsWith("--")) {
      const newline = sql.indexOf("\n", i);
      i = newline === -1 ? sql.length : newline;
      continue;
    }

    if (rest.startsWith("/*")) {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    const dollar = /^\$\w*\$/.exec(rest);
    if (dollar) {
      dollarTag = dollar[0];
      current += dollarTag;
      i += dollarTag.length;
      continue;
    }

    if (ch === "'") {
      inString = true;
      current += ch;
      i += 1;
      continue;
    }

    if (ch === ";") {
      statements.push(current.trim());
      current = "";
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);

  return statements.filter((s) => s.length > 0);
}
