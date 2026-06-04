# vocab-trainer

一个本地运行的英语背单词工具。用户可以录入英文单词、中文释义和词性，数据保存在项目内的 `data/words.json`。

## 功能

- 录入单词、中文释义和词性
- 支持同一个英文词按不同释义分条保存
- 支持英文到中文、中文到英文两种测试模式
- 支持按全部、今天、近 7 天、近 30 天、自定义最近 x 天抽题
- 随机抽题并判断答案是否正确
- 显示本次测试的答题数、正确数和正确率

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

## 测试

```bash
node --test tests/*.test.js
```

如果你的环境有 npm，也可以使用：

```bash
npm test
```
