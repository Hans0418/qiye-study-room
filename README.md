# 栖页 Qiye

面向学习任务启动困难的 AI 线上自习室。本项目是独立产品 MVP，结合任务规划与专注执行，减少开始学习前手动拆解、录入待办的准备成本。

> 当前公开版本为源码展示版，不是已部署的在线产品。以下截图展示开发者本地版本；音频和运行所需的原始图片素材未包含，克隆后书房背景、头像与宠物图像不会完整显示。

![栖页首页：雪山书房与专注入口](docs/screenshots/home.png)

## 产品思路

面向备考、作业、论文与个人学习等场景，将模糊的学习目标转化为可执行的小步骤。AI 提供建议，由用户决定是否采纳，不在生成后自动开始执行。

核心流程：**目标输入 → AI 拆解 → 计划确认与调整 → 待办执行与计时**。

- **AI 任务规划**：将自然语言目标拆解为步骤，生成带预计时长的待办；支持调整内容、时长和顺序。
- **专注环境**：提供多种书房场景、环境声、番茄钟与学习记录。
- **多人在线自习**：通过邀请加入房间，选择跟随房主目标或使用个人目标；同步共享目标、清单及目标倒计时。
- **学习陪伴**：宠物陪伴天数、喂养与成长反馈。

## 产品截图

### 设置学习环境与本轮目标

选择书房场景，自定义背景音乐与环境声组合，再设置专注时长和本轮目标。

![选择学习场景：六种书房氛围](docs/screenshots/scene-selection.png)

<details>
<summary>查看声音配置、专注时长与目标设置</summary>

**配置声音氛围**：分别调整音乐与环境总音量，自定义环境声组合及各声道音量。

![声音氛围与环境声混音设置](docs/screenshots/sound-settings.png)

**设置本轮学习**：选择专注时长，填写可选目标，然后开始学习。

![专注时长与本轮目标设置](docs/screenshots/session-setup.png)

</details>

### 从模糊目标到可执行计划

用户用自然语言描述本轮任务，AI 给出步骤建议；用户可以调整内容和预计时长，再选择“按计划开始”。

<img src="docs/screenshots/ai-input.png" alt="自然语言输入学习目标" width="640">

<table>
  <tr><th>拆解任务与确认计划</th><th>计划后续步骤</th></tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/ai-plan.png" alt="AI 任务拆解与用户确认"></td>
    <td width="50%"><img src="docs/screenshots/ai-plan-more.png" alt="AI 计划后续步骤与调整入口"></td>
  </tr>
</table>

### 将计划衔接到专注执行

计划进入待办清单，可调整顺序、选择当前任务，并查看目标倒计时与番茄钟。

![待办清单、当前目标与倒计时](docs/screenshots/task-execution.png)

<details>
<summary>查看雨夜书房的专注界面</summary>

![雨夜书房与番茄钟](docs/screenshots/focus.png)

</details>

### 多人在线自习

创建邀请房间，与朋友一起学习；成员可跟随房主目标，也可保留个人目标。

![多人自习成员与目标模式](docs/screenshots/room-members.png)

<details>
<summary>查看邀请与房间设置</summary>

![邀请朋友进入同一间书房](docs/screenshots/room-invite.png)

截图中的 127.0.0.1 是本机演示地址，不是可供访客使用的在线邀请。

</details>

### 学习陪伴

记录陪伴天数，通过专注获得食物；喂养增加成长值，为学习提供轻量反馈。

<img src="docs/screenshots/companion.png" alt="学习伙伴的陪伴天数、喂养与成长值" width="420">

## AI 工作流

当前使用 Ollama 本地模型。模型生成结构化规划，程序校验字段和步骤，并通过确定性时间分配工具约束总时长。背景不足时支持澄清；结果需用户确认后进入执行。

这是受控规划工作流，不是能任意执行操作的通用自主 Agent。当前没有知识库检索或联网搜索能力，也不宣称已经验证学习效率提升。

详细设计见 [Agent 设计](AGENT-DESIGN.md)，核心实现位于 `focus-agent.mjs`。

## 本地运行

需要 Node.js 24，以及已运行并安装模型的 Ollama。

1. 将 `.env.example` 复制为 `.env`，设置 `LOCAL_MODEL` 为本机已安装的模型名称。
2. 在项目根目录执行：

```sh
node --env-file=.env server.mjs
```

3. 打开终端显示的地址，默认是 `http://127.0.0.1:8766/`。

macOS 也可运行 `zsh start-local.command`，该脚本默认使用 8769 端口。未配置模型时，普通页面可运行，但 AI 规划不可用。当前服务器只接受本机访问，GitHub 仓库不是在线体验地址，GitHub Pages 也不能运行此后端。

## 技术结构

| 路径 | 职责 |
| --- | --- |
| `outputs/study-room-mvp/` | HTML、CSS、JavaScript 前端 |
| `server.mjs` | 静态资源及同源 API 服务 |
| `focus-agent.mjs` | 提示词、结构化输出校验、时间分配 |
| `auth.mjs` | 本地 SQLite 账号与会话 |
| `rooms.mjs` | 多人房间及状态同步 |

开发中主要使用 Codex 辅助实现，Ollama 提供本地模型推理。

## 测试

无需连接真实模型的核心测试：

```sh
node --test server.test.mjs auth.test.mjs rooms.test.mjs ai-errors.test.mjs focus-agent.test.mjs companion-store.test.cjs companion-ui.test.mjs goal-clock.test.cjs calendar-store.test.cjs together.test.mjs task-order.test.mjs
```

`scene-effects.test.mjs` 仍引用开发机器上的图像测试依赖路径，不包含在以上可移植命令中。真实模型评估另行运行 `node --env-file=.env agent-eval.mjs`；自动测试通过不代表模型质量或公网安全已经验证。

## 当前边界

- 账号支持本地注册与登录，但没有邮箱或手机验证、密码找回；请使用测试身份，不收集真实用户敏感信息。
- 学习记录保存在浏览器本地，不随账号同步，也不按账号隔离。
- 多人房间保存在服务内存，重启会丢失，不支持多实例共享。
- 公网发布前还需要部署、安全和模型服务适配。

## 素材与隐私

音频文件、私人运行数据及密钥不随代码上传。`docs/screenshots/` 仅包含项目作者选定用于产品展示的截图，不包含可复用的场景原图。本地选曲需要用户自行提供有权使用的文件；YouTube BGM 依赖第三方网络服务，不代表获得音乐再分发授权。环境声包含浏览器合成实现。

场景、头像等视觉素材的授权范围需要独立核对，仓库不对第三方素材授予再使用或再分发权。保留现有第三方许可文件；没有为整个项目附加开源许可证。
