const fs = require('node:fs');
const path = require('node:path');
const {assert,equal,digest,sourceHash,receiptSummary} = require('./transport.cjs');
const {decodeReceipt} = require('./receipt-calldata.cjs');
const reference = require('./reference.cjs');

async function main() {
  process.env.GENLAYER_CLI_PATH ||= path.resolve('node_modules/genlayer/dist/index.js');
  const folder = process.argv[2] || 'proofs';
  const load = name=>JSON.parse(fs.readFileSync(path.join(folder,name+'.json')));
  const report = load('verified');
  const journal = load('transactions');
  const wallets = [load('claim-scope-receipt').from_address,load('block-cyrillic-alias-receipt').from_address]
    .map(address=>address.toLowerCase());
  assert(wallets[0] !== wallets[1], 'Distinct signing wallets required');
  const expectedCalls = [
    ['deploy',0,null,[],null],
    ['claim-scope',0,'claim',['scope'],null],
    ['block-cyrillic-alias',1,'claim',['ѕсоре'],'Confusable name already reserved'],
    ['transfer-scope',0,'transfer',['scope',1,wallets[1]],null],
    ['block-former-owner',0,'release',['scope',2],'Only the current owner'],
    ['block-stale-epoch',1,'release',['scope',1],'Stale name epoch'],
    ['release-scope',1,'release',['scope',2],null],
    ['reclaim-cyrillic',1,'claim',['ѕсоре'],null],
    ['claim-m',0,'claim',['m'],null],
    ['block-rn',1,'claim',['rn'],'Confusable name already reserved'],
    ['block-invisible',0,'claim',['name\u200b'],'Unsupported label'],
    ['block-wrong-spelling',1,'release',['scope',4],'Use the exact registered label'],
  ];
  const labels = expectedCalls.map(row=>row[0]);
  assert(report.source_sha256===sourceHash && journal.source_sha256===sourceHash,'Contract source digest differs');
  assert(report.unicode_source===reference.url && report.unicode_sha256===reference.hash,'Unicode source differs');
  assert(equal(Object.keys(journal.hashes).sort(),[...labels].sort()),'Unexpected journal transactions');
  assert(equal(report.trace.map(step=>step.label),labels),'Unexpected proof order');
  const state = new Map();
  const tracked = ['scope','ѕсоре','m','rn','free'];
  const source = fs.readFileSync('contracts/glyph_dock.py');
  for (const [index,[label,actor,method,args,error]] of expectedCalls.entries()) {
    const raw = load(label+'-receipt');
    const trace = report.trace[index];
    const summary = receiptSummary(raw);
    const from = (raw.from_address || raw.sender).toLowerCase();
    assert(from===wallets[actor] && from===trace.signer,'Wrong signing wallet');
    assert((raw.to_address || raw.recipient).toLowerCase()===report.contract.toLowerCase(),'Wrong receipt recipient');
    assert(summary.hash===journal.hashes[label] && summary.hash===trace.hash,'Wrong transaction hash');
    assert(summary.status==='FINALIZED' && summary.result==='MAJORITY_AGREE'
      && summary.agree>(summary.agree+summary.disagree+summary.idle)/2,'Missing strict finalized majority');
    assert(equal(summary,Object.fromEntries(Object.keys(summary).map(key=>[key,trace[key]]))),'Receipt summary differs');
    const calldata = method ? {method,args} : {args:[]};
    assert(equal(await decodeReceipt(raw),calldata) && equal(trace.calldata,calldata),'Wrong actual signed calldata');
    assert(trace.error===(error||null),'Wrong documented error');
    if (label==='deploy') {
      assert(report.deployment===summary.hash && source.equals(Buffer.from(raw.data.contract_code,'base64')),
        'Deployment source bytes differ');
    }
    if (error) {
      const payload=Buffer.from(raw.consensus_data.leader_receipt[0].result,'base64');
      assert(summary.execution==='ERROR' && payload[0]===1 && payload.subarray(1).toString()===error,'Unexpected error');
      assert(equal(trace.state,report.trace[index-1].state),'Rejected operation changed state');
    } else {
      assert(['SUCCESS','FINISHED_WITH_RETURN'].includes(summary.execution),'Expected successful execution');
      if(method){
        const key=reference.skeleton(args[0]);
        const prior=state.get(key)||{epoch:0,label:'',owner:''};
        assert(method==='claim'?!prior.owner:prior.owner===from && prior.epoch===args[1] && prior.label===args[0],
          'Invalid expected ownership transition');
        const owner=method==='release'?'':method==='transfer'?args[2]:from;
        state.set(key,{epoch:prior.epoch+1,label:owner?args[0]:'',owner});
      }
    }
    const active=[...state.values()].filter(entry=>entry.owner).length;
    const policy={source_url:reference.url,source_sha256:reference.hash,alphabet:reference.alphabet,
      max_characters:32,mappings:reference.mappings,active};
    assert(equal(trace.state.policy,policy),'Wrong observed table or count');
    assert(equal(Object.keys(trace.state.names).sort(),[...tracked].sort()),'Missing tracked name');
    for (const name of tracked) {
      const skeleton=reference.skeleton(name);
      const expected={skeleton,...(state.get(skeleton)||{epoch:0,label:'',owner:''})};
      const observed=trace.state.names[name];
      assert(equal({...observed,owner:observed.owner.toLowerCase()},expected),'Observed namespace differs');
    }
  }
  assert(equal(report.final_state,report.trace.at(-1).state),'Final state differs');
  console.log(JSON.stringify({contract:report.contract,receipts:labels.length,sourceHash,
    active:report.final_state.policy.active,unicodeMappings:reference.alphabet.length}));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
