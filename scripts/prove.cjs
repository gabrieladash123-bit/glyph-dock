const fs = require('node:fs');
const {assert, equal, digest, sourceHash, invoke, read, rpc, receipt, receiptSummary, save} = require('./transport.cjs');
const {decodeReceipt} = require('./receipt-calldata.cjs');
const reference = require('./reference.cjs');

async function main() {
  const wallets = JSON.parse(process.env.GLYPH_ACCOUNTS || '[]');
  assert(wallets.length === 2 && wallets[0].address !== wallets[1].address, 'Two signing wallets required');
  assert(await rpc('eth_chainId', []) === '0xf22f', 'StudioNet only');
  const body = Buffer.from(await (await fetch(reference.url, {signal:AbortSignal.timeout(25000)})).arrayBuffer());
  assert(digest(body) === reference.hash, 'Fresh Unicode digest differs');
  process.env.GLYPH_ACCOUNT = wallets[0].name;
  const code = fs.readFileSync('contracts/glyph_dock.py');
  const deployment = await invoke('deploy', ['deploy', '--contract', 'contracts/glyph_dock.py']);
  const deployed = await receipt('deploy', deployment, true);
  const contract = deployed.to_address || deployed.recipient;
  assert(code.equals(Buffer.from(deployed.data.contract_code, 'base64')), 'Deployment payload differs');
  const report = {contract, deployment, revision:process.env.GITHUB_SHA, source_sha256:sourceHash,
    unicode_source:reference.url, unicode_sha256:reference.hash, trace:[]};
  const entries = new Map();
  const tracked = ['scope','ѕсоре','m','rn','free'];

  function expected(label) {
    const key = reference.skeleton(label);
    return {skeleton:key, ...(entries.get(key) || {epoch:0,label:'',owner:''})};
  }

  async function verify(label, raw, actor, calldata, error) {
    const sender = (raw.from_address || raw.sender).toLowerCase();
    assert(sender === wallets[actor].address
      && (raw.to_address || raw.recipient).toLowerCase() === contract.toLowerCase(), 'Wrong signer or recipient');
    assert(equal(await decodeReceipt(raw), calldata), 'Wrong signed calldata');
    if (error) {
      const value = Buffer.from(raw.consensus_data.leader_receipt[0].result, 'base64');
      assert(value[0] === 1 && value.subarray(1).toString() === error, 'Unexpected contract error');
    }
    const policy = await read(label+'-policy', ['call',contract,'policy']);
    const active = [...entries.values()].filter(entry=>entry.owner).length;
    assert(equal(policy,{source_url:reference.url,source_sha256:reference.hash,
      alphabet:reference.alphabet,max_characters:32,mappings:reference.mappings,active}), 'Imported policy or active count differs');
    const names = {};
    for (const name of tracked) {
      names[name] = await read(label+'-'+name, ['call',contract,'resolve','--args',name]);
      // Addresses are case-insensitive; preserve exactly what the chain returned.
      assert(equal({...names[name],owner:names[name].owner.toLowerCase()}, expected(name)), 'Unexpected name state');
    }
    const state = {policy,names};
    if (error) assert(equal(state,report.trace.at(-1).state), 'Rejected call mutated state');
    report.trace.push({label,...receiptSummary(raw),signer:sender,calldata,error:error||null,state});
    save('progress',report);
  }

  async function call(label, actor, method, args, change, error) {
    process.env.GLYPH_ACCOUNT = wallets[actor].name;
    const argsForCli = args.map(value=>String(value));
    const hash = await invoke(label,['write',contract,method,'--args',...argsForCli]);
    const raw = await receipt(label,hash,!error);
    if (change) change();
    await verify(label,raw,actor,{method,args},error);
  }

  await verify('deploy',deployed,0,{args:[]});
  await call('claim-scope',0,'claim',['scope'],()=>entries.set('scope',{epoch:1,label:'scope',owner:wallets[0].address}));
  await call('block-cyrillic-alias',1,'claim',['ѕсоре'],null,'Confusable name already reserved');
  await call('transfer-scope',0,'transfer',['scope',1,wallets[1].address],
    ()=>entries.set('scope',{epoch:2,label:'scope',owner:wallets[1].address}));
  await call('block-former-owner',0,'release',['scope',2],null,'Only the current owner');
  await call('block-stale-epoch',1,'release',['scope',1],null,'Stale name epoch');
  await call('release-scope',1,'release',['scope',2],()=>entries.set('scope',{epoch:3,label:'',owner:''}));
  await call('reclaim-cyrillic',1,'claim',['ѕсоре'],()=>entries.set('scope',{epoch:4,label:'ѕсоре',owner:wallets[1].address}));
  await call('claim-m',0,'claim',['m'],()=>entries.set('rn',{epoch:1,label:'m',owner:wallets[0].address}));
  await call('block-rn',1,'claim',['rn'],null,'Confusable name already reserved');
  await call('block-invisible',0,'claim',['name\u200b'],null,'Unsupported label');
  await call('block-wrong-spelling',1,'release',['scope',4],null,'Use the exact registered label');
  assert(code.equals(Buffer.from(await rpc('gen_getContractCode',[contract]),'base64')), 'Fresh deployed source differs');
  report.final_state=report.trace.at(-1).state;
  save('verified',report);
  console.log(JSON.stringify({contract,deployment,receipts:report.trace.length,active:report.final_state.policy.active}));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
