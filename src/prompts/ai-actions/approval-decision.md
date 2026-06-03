# OpenClaw Desktop AI Action: 审批决定

Action Center 已经对当前执行会话中的审批请求作出决定。

## 原始动作

{{actionInput}}

## 审批项

{{approvalTitle}}

## 决定

{{decision}}

{{decisionInstruction}}

后续回复仍必须以机器可解析的 `ai-action` JSON 块结束。

执行完成：

```ai-action
{"version":1,"kind":"completed","summary":"执行结果摘要"}
```

执行失败：

```ai-action
{"version":1,"kind":"failed","summary":"失败摘要","error":"可操作的失败原因"}
```

如果出现新的、实质不同的风险：

```ai-action
{"version":1,"kind":"approval_required","summary":"新的计划摘要","approval":{"title":"新的审批标题","risk":"low|medium|high","reason":"新的风险和影响范围"}}
```
