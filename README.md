# vocab-trainer

一个本地运行的英语背单词工具。用户可以录入英文单词、中文释义、词性和音标，也可以在输入英文后自动联网查词。个人词库保存在本地，GitHub 只保留初始模板，避免把个人学习记录上传到仓库。

## 功能

- 手动录入英文单词、中文释义和词性。
- 输入英文后自动联网查词，返回适合背诵的简洁中文释义、词性和音标。
- 查词结果以候选释义展示，用户勾选后会填入释义栏，仍可自行修改。
- 查词失败时仍可手动填写，不影响手动录入流程。
- 同一个英文单词只保存一条记录，多个词性和释义保存在该单词下，避免重复词条。
- 支持查看词库，按英文前缀或中文释义搜索，并按全部、今日添加、昨天添加、近 7 日添加筛选。
- 支持编辑、删除单词，并可在词库中点击“听一下”播放发音。
- 支持英文到中文、中文到英文两种测试模式，默认是中文到英文。
- 测试范围支持全部、今天、昨天、近 7 天。
- 测试题随机抽取；一轮内已出现过的单词不会重复出现。
- 题目会显示当前词性的释义；如果一个词有多个词性，中文到英文测试会按“词性 + 释义”分行展示。
- 提交答案后判断是否正确；答错时不显示正确答案。
- 答错两次或手动跳过会加入本轮错题，并记录历史错误次数。
- 一轮结束后可显示错题，也可以重做本轮错题。
- 历史错误次数越多，后续抽到该释义的概率越高。
- 显示本次测试的答题数、正确数和正确率。

## 数据结构

`data/words.example.json` 是 GitHub 上的初始词库模板；本地运行时会使用 `data/words.json` 保存你的个人词库。词库使用一个英文单词对应多个释义的结构：

```json
[
  {
    "id": "word_001",
    "english": "record",
    "phonetic": "ˈrekɔːrd",
    "meanings": [
      {
        "id": "meaning_001",
        "partOfSpeech": "noun",
        "chinese": "记录",
        "spellingErrorCount": 0,
        "skipCount": 0,
        "errorCount": 0
      },
      {
        "id": "meaning_002",
        "partOfSpeech": "verb",
        "chinese": "记录；录制",
        "spellingErrorCount": 0,
        "skipCount": 0,
        "errorCount": 0
      }
    ],
    "createdAt": "2026-06-04T00:00:00.000Z",
    "updatedAt": "2026-06-04T00:00:00.000Z"
  }
]
```

字段说明：

- `phonetic`：单词音标。旧词如果没有该字段，也可以正常使用。
- `meanings`：同一个英文单词下的多个词性和释义。
- `spellingErrorCount`：历史拼写错误次数。
- `skipCount`：历史跳过次数。
- `errorCount`：兼容旧数据的累计错误次数，通常等于拼写错误次数加跳过次数。
- `createdAt`：用于“今天 / 昨天 / 近 7 天”的筛选和抽题范围。

## 启动

首次本地运行时，如果还没有个人词库，可以从模板复制一份：

```bash
cp data/words.example.json data/words.json
```

`data/words.json` 已加入 `.gitignore`，不会上传你的个人学习记录。

```bash
node src/server/server.js
```

然后打开：

```text
http://localhost:3000
```

如果你的环境有 npm，也可以使用：

```bash
npm start
```

## 桌面 App

安装依赖后可以用 Electron 打开桌面版：

```bash
npm install
npm run desktop
```

桌面版会自动启动本地服务并打开应用窗口，不需要手动访问 `localhost:3000`。应用会使用本机的系统数据目录保存词库。

桌面版词库位置：

- macOS: `~/Library/Application Support/Vocab Trainer/words.json`
- Windows: `%APPDATA%/Vocab Trainer/words.json`
- Linux: `~/.config/Vocab Trainer/words.json`

首次启动时，如果系统数据目录里还没有词库，会从 `data/words.example.json` 初始化。

如果要生成安装包，可以运行：

```bash
npm run build:desktop
```

生成结果会放在 `dist/`。

如果本地构建出的 `dist/mac-arm64/Vocab Trainer.app` 也被 Spotlight 搜到，可能会看到两个同名应用。实际保留 `/Applications/Vocab Trainer.app` 即可，`dist/` 只是构建输出目录，可以按需删除后重新构建。

## 测试

```bash
node --test tests/*.test.js
```

如果你的环境有 npm，也可以使用：

```bash
npm test
```
