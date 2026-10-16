const target = process.argv.includes('--test')
  ? 'DATABASE_URL_TEST'
  : 'DATABASE_URL';

console.log(
  `Migration runner is not implemented yet. Step 0B will apply migrations using ${target}.`,
);
