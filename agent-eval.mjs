import { cases } from './agent-cases.mjs';
import { buildPayload } from './server.mjs';
import { validatePlan } from './focus-agent.mjs';

if (!process.env.LOCAL_MODEL) {
  console.log('BLOCKED: 未配置 LOCAL_MODEL；10 个案例均未进行模型效果测试。');
  process.exitCode = 2;
} else {
  for (const c of cases) {
    try {
      const response = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
        body: JSON.stringify(buildPayload('local', { quick: process.env.LOCAL_MODEL }, 'quick', c.input, c.minutes))
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.choices?.[0]?.finish_reason !== 'stop') throw new Error('Incomplete output');
      const plan = validatePlan(JSON.parse(data.choices[0].message.content), c.minutes);
      console.log(JSON.stringify({ case: c, model: process.env.LOCAL_MODEL, contract: 'PASS', semanticReview: '人工待评', plan }));
    } catch (error) { console.log(JSON.stringify({ id: c.id, status: 'FAIL', error: error.message })); process.exitCode = 1; }
  }
}
