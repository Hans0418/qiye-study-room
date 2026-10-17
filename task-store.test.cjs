const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse, create } = require('./outputs/study-room-mvp/task-store.js');
test('completion undo expires after three seconds and stale session writes cannot restore it', () => {
  const { store } = fixture(); store.add([{ text: 'Task' }]); const task = store.read()[0];
  store.update(task.id, { done: true, completedAt: Date.now() });
  store.update(task.id, { done: false, completedAt: null }); assert.equal(store.read()[0].done, false);
  store.update(task.id, { done: true, completedAt: Date.now() - 3001 });
  assert.throws(() => store.update(task.id, { done: false }), /撤销时间已结束/);
  store.sync([{ ...task, done: false }]); assert.equal(store.read()[0].done, true);
});
const crisisPlan = `Crisis Communication（危机传播）课程作业计划
**作业目标：** 完成危机传播课程的小组作业，包括危机应对策略制定、PPT制作以及演讲稿撰写。
### 一、危机应对策略制定
- 分析危机事件背景，识别核心问题及利益相关方。
- 制定危机传播与应对策略，明确危机处理方向。
- 确定核心传播信息、具体应对措施及沟通方式。
### 二、PPT制作
- 根据危机分析及应对策略，设计PPT整体框架。
- 整理关键内容，包括事件背景、危机评估、应对策略及执行方案。
- 优化PPT的逻辑结构、视觉设计及内容呈现。
### 三、演讲稿撰写
- 根据PPT内容撰写完整的英文演讲稿。
- 确保演讲内容逻辑清晰，准确阐述危机应对策略及决策依据。
- 进行演讲练习，调整表达方式、演讲节奏及时间安排。
### 四、预期成果
1. 危机传播应对策略方案
2. 课程汇报PPT
3. 英文演讲稿。`;
test('course plan groups actions, omits duplicate deliverables, and preserves original', () => {
  const tasks = parse(crisisPlan);
  assert.deepEqual(tasks.map(t => t.text), ['危机应对策略制定', 'PPT制作', '演讲稿撰写']);
  assert.ok(tasks.every(t => t.notes.split('\n').length === 3 && t.original === crisisPlan && t.minutes === null));
  assert.match(tasks[1].notes, /优化PPT/);
});
test('date assignment supports recurring wording on different days and legacy migration', () => {
  const { store, storage } = fixture();
  store.add([{ text: 'Read', date: '2026-10-15' }, { text: 'Read', date: '2026-10-16' }]);
  assert.equal(store.read().length, 2);
  const task = store.read()[0]; store.sync([task]); assert.equal(store.read()[0].date, '2026-10-15');
  storage.setItem('qiyeTaskInbox.v1', JSON.stringify([{ id: 'old', text: 'Legacy' }]));
  const migrated = store.read()[0]; assert.match(migrated.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(JSON.parse(storage.getItem('qiyeTaskInbox.v1'))[0].date, migrated.date);
});
function fixture() {
  const data = new Map(); let id = 0;
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  return { store: create(storage, () => String(++id)), storage };
}
test('paste preserves task wording, notes and links without invented dates or durations', () => {
  const tasks = parse('# 我的计划\n1. 阅读资料（20分钟）\n   https://example.com/article\n2. 写三条问题\n3. 明天下午寄快递');
  assert.equal(tasks.length, 3); assert.equal(tasks[0].minutes, 20);
  assert.equal(tasks[0].notes, 'https://example.com/article');
  assert.equal(tasks[1].minutes, null); assert.equal(tasks[2].text, '明天下午寄快递');
  assert.equal(tasks[2].date, undefined);
});
test('markdown tables and checklists import without separator rows', () => {
  const tasks = parse('| 任务 | 时长 |\n| --- | --- |\n| 阅读 | 15分钟 |\n- [ ] 写提纲');
  assert.equal(tasks.length, 2); assert.equal(tasks[0].minutes, 15);
  assert.equal(tasks[1].text, '写提纲');
});
test('duration ranges stay unspecified and long lists are not silently truncated', () => {
  assert.equal(parse('阅读 15–20分钟')[0].minutes, null);
  assert.equal(parse(Array.from({ length: 101 }, (_, i) => `${i + 1}. Task ${i}`).join('\n')).length, 101);
});
test('deduplication, selection, completion and leaving persist across store instances', () => {
  const { store, storage } = fixture();
  assert.deepEqual(store.add([{ text: 'Read', minutes: null }, { text: ' read ', minutes: 15 }]), { added: 1, duplicates: 1 });
  const task = store.read()[0]; store.sync([task]);
  assert.equal(create(storage).read()[0].selected, true);
  task.done = true; store.sync([task]); assert.equal(store.read()[0].selected, false);
  store.sync([]); assert.equal(store.read().length, 1);
  store.update(task.id, { done: false }); assert.equal(store.read()[0].done, false);
});
test('room tasks do not enter personal inbox; corrupt storage is not overwritten', () => {
  const { store, storage } = fixture(); store.sync([{ id: 'room', text: 'Shared', fromRoom: true }]); assert.equal(store.read().length, 0);
  storage.setItem('qiyeTaskInbox.v1', '{broken');
  assert.throws(() => store.sync([])); assert.equal(storage.getItem('qiyeTaskInbox.v1'), '{broken');
});
