import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL. Add it to your .env (not committed).");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  const tablesRes = await pool.query(
    `
    select table_schema, table_name
    from information_schema.tables
    where table_type='BASE TABLE'
      and table_schema not in ('pg_catalog','information_schema')
    order by table_schema, table_name
  `,
  );

  const tables = tablesRes.rows as Array<{ table_schema: string; table_name: string }>;
  console.log(`Found ${tables.length} tables:\n`);

  for (const t of tables) {
    console.log(`- ${t.table_schema}.${t.table_name}`);
    const colsRes = await pool.query(
      `
      select
        column_name,
        data_type,
        is_nullable,
        column_default
      from information_schema.columns
      where table_schema=$1 and table_name=$2
      order by ordinal_position
    `,
      [t.table_schema, t.table_name],
    );
    for (const c of colsRes.rows) {
      const def = c.column_default ? ` default ${c.column_default}` : "";
      console.log(`    - ${c.column_name}: ${c.data_type} ${c.is_nullable === "YES" ? "null" : "not null"}${def}`);
    }
    console.log("");
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});





