# vocab-trainer

一个本地运行的英语背单词工具。用户可以录入英文单词、中文释义和词性，也可以在输入英文后自动联网查词。数据保存在项目内的 `data/words.json`。

## 功能

- 录入单词、中文释义和词性
- 输入英文后自动联网查找简洁中文释义和词性
- 查词失败时仍可手动录入
- 同一个英文单词只保存一条记录，多个词性和释义保存在该单词下
- 支持查看全部词库，并编辑或删除单词
- 支持英文到中文、中文到英文两种测试模式
- 支持按全部、今天、近 7 天、近 30 天、自定义最近 x 天抽题
- 随机抽题并判断答案是否正确
- 显示本次测试的答题数、正确数和正确率

## 数据结构

`data/words.json` 使用一个英文单词对应多个释义的结构：

```json
[
  {
    "id": "word_001",
    "english": "record",
    "meanings": [
      {
        "id": "meaning_001",
        "partOfSpeech": "noun",
        "chinese": "记录"
      },
      {
        "id": "meaning_002",
        "partOfSpeech": "verb",
        "chinese": "记录；录制"
      }
    ],
    "createdAt": "2026-06-04T00:00:00.000Z",
    "updatedAt": "2026-06-04T00:00:00.000Z"
  }
]
```

## 启动

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

桌面版会自动启动本地服务并打开应用窗口，不需要手动访问 `localhost:3000`。

桌面版的词库保存在系统应用数据目录，不再写入项目里的 `data/words.json`：

- macOS: `~/Library/Application Support/Vocab Trainer/words.json`
- Windows: `%APPDATA%/Vocab Trainer/words.json`
- Linux: `~/.config/Vocab Trainer/words.json`

如果要生成安装包，可以运行：

```bash
npm run build:desktop
```

生成结果会放在 `dist/`。

## 测试

```bash
node --test tests/*.test.js
```

如果你的环境有 npm，也可以使用：

```bash
npm test
```
