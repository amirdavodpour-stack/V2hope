import { spawn } from 'node:child_process';
const args = ['--test','--test-concurrency=1','--experimental-test-coverage','--test-coverage-include=src/**/*.js',
  '--test-coverage-exclude=src/db/schema.js','--test-coverage-exclude=src/db/legacy.js','--test-coverage-exclude=src/db/legacy_adapter.js',
  ...process.argv.slice(2)];
const child = spawn(process.execPath,args,{stdio:['inherit','pipe','pipe']});
let output='';
child.stdout.on('data',c=>{process.stdout.write(c); output+=c.toString();});
child.stderr.on('data',c=>process.stderr.write(c));
child.on('error',e=>{console.error(e);process.exit(1);});
child.on('close',code=>{
 if(code!==0) process.exit(code ?? 1);
 // Node >=22 drops the '#' TAP-coverage marker; summary row is printed as 'all files | line | branch | funcs |'
 // (older runtimes printed 'ℹ # all files | ...'). Match on the row label regardless of the marker.
 const row=output.split(/\r?\n/).find(l=>/all files\s*\|/.test(l));
 if(!row){console.error('Coverage summary row not found');process.exit(1);}
 const m=row.match(/\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|\s*([0-9.]+)\s*\|/);
 if(!m){console.error(`Unable to parse coverage row: ${row}`);process.exit(1);}
 const [line,branch,funcs]=m.slice(1).map(Number);
 const min={line:Number(process.env.BACKEND_LINE_COVERAGE_MIN??70),branch:Number(process.env.BACKEND_BRANCH_COVERAGE_MIN??60),funcs:Number(process.env.BACKEND_FUNCTION_COVERAGE_MIN??65)};
 if(line<min.line||branch<min.branch||funcs<min.funcs){console.error(`Backend coverage below threshold: line=${line} branch=${branch} functions=${funcs}; required ${min.line}/${min.branch}/${min.funcs}`);process.exit(1);}
 console.log(`Backend coverage gate: line=${line}% branch=${branch}% functions=${funcs}%`);
});
