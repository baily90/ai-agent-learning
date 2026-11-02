// Lab 17 · 评估（LLM-as-judge）
// 目标：用"另一个 LLM"当裁判，自动评估客服回答的质量
// 升级版：pass/fail 判定 + 规则前置检查 + 分场景数据集 + 分场景报告 + 结果落盘
import "dotenv/config";
import { generateText, Output } from "ai";
import { deepseek } from "@ai-sdk/deepseek";
import { z } from "zod";
import { writeFileSync } from "node:fs";

// 被评估的对象：客服 system prompt（改这里就能做 A/B 对比）
const SYSTEM = "你是电商客服，回答要准确、简洁。";

// 评估数据集：按场景分组，每个用例拆成多条可勾选的评估标准（rubric）
// 真实项目里这些来自线上日志 + 人工标注，不是拍脑袋的 3 条
type EvalCase = {
  scenario: string; // 场景分组
  input: string;    // 用户问题
  rubric: string[]; // 拆解后的评估标准，逐条判定 pass/fail
};

const evalSet: EvalCase[] = [
  // 退款
  { scenario: "退款", input: "我买的商品怎么退款？", rubric: ["说明退款流程步骤", "说明退款到账时间"] },
  { scenario: "退款", input: "退款多久能到账？", rubric: ["给出到账时间范围", "说明不同支付方式可能有差异"] },
  { scenario: "退款", input: "我拆封了还能退款吗？", rubric: ["说明拆封商品的退款政策", "给出联系客服的指引"] },

  // 物流
  { scenario: "物流", input: "我的订单到哪了？", rubric: ["说明如何查询物流", "给出查询入口或步骤"] },
  { scenario: "物流", input: "物流三天没更新了怎么办？", rubric: ["给出可能的排查方向", "提供联系客服或催单方式"] },
  { scenario: "物流", input: "能改收货地址吗？", rubric: ["说明是否可修改及条件", "给出操作步骤"] },

  // 优惠券
  { scenario: "优惠券", input: "优惠券过期了还能用吗？", rubric: ["明确说明过期券不可用", "不误导用户"] },
  { scenario: "优惠券", input: "优惠券为什么用不了？", rubric: ["列举常见原因", "给出解决建议"] },
  { scenario: "优惠券", input: "两张优惠券能叠加吗？", rubric: ["说明叠加规则", "给出明确结论"] },

  // 售前咨询
  { scenario: "售前", input: "这款商品有货吗？", rubric: ["给出查询库存的方式", "不凭空承诺库存"] },
  { scenario: "售前", input: "支持七天无理由退货吗？", rubric: ["说明退货政策", "说明例外情况"] },
  { scenario: "售前", input: "能不能开发票？", rubric: ["说明开票流程", "说明时间或方式"] },

  // 售后
  { scenario: "售后", input: "商品坏了怎么保修？", rubric: ["说明保修流程", "给出联系方式"] },
  { scenario: "售后", input: "收到货少了配件怎么办？", rubric: ["给出处理方案", "引导提供订单信息"] },
  { scenario: "售后", input: "质量问题怎么投诉？", rubric: ["说明投诉或退换流程", "给出时效或渠道"] },

  // 账号
  { scenario: "账号", input: "怎么注销账号？", rubric: ["说明注销流程", "提示注销后果"] },
  { scenario: "账号", input: "忘记密码怎么找回？", rubric: ["给出找回步骤", "提示安全注意事项"] },
  { scenario: "账号", input: "怎么改绑定的手机号？", rubric: ["说明修改步骤", "提示可能需要验证"] },

  // 其他
  { scenario: "其他", input: "客服电话是多少？", rubric: ["给出客服联系方式", "不提供虚假信息"] },
  { scenario: "其他", input: "现在下单什么时候能送到？", rubric: ["说明配送时效", "说明可能受地区影响"] },
  { scenario: "其他", input: "可以货到付款吗？", rubric: ["说明是否支持", "给出替代支付方式"] },
  { scenario: "其他", input: "发票信息填错了能改吗？", rubric: ["说明修改条件", "给出操作方式"] },
];

// 规则前置检查：能确定性判断的，就不要花钱请 LLM 判
// 先过滤掉明显失败的，省一次裁判调用
function ruleCheck(answer: string): string[] {
  const issues: string[] = [];
  const text = answer.trim();
  if (!text) {
    issues.push("空回答");
  } else {
    if (text.length < 5) issues.push("回答过短（<5 字）");
    if (text.length > 800) issues.push("回答过长（>800 字）");
    // 检测连续重复（同一段话重复 3 次以上，典型的复读机 bug）
    if (/(.{10,})\1{2,}/.test(text)) issues.push("出现明显重复内容");
  }
  return issues;
}

// LLM-as-judge：逐条判定 rubric，用 pass/fail 而不是打 1-5 分
// 二值判断比打分更稳定，也是回归测试的标准做法
async function judge(input: string, answer: string, rubric: string[]) {
  const result = await generateText({
    model: deepseek("deepseek-chat"),
    temperature: 0, // 裁判要确定性，降低随机波动
    prompt: `你是一个严格的评审。判断下面的客服回答是否满足每一条评估标准。

用户问题：${input}
客服回答：${answer}

评估标准（共 ${rubric.length} 条，逐条判定，顺序保持一致）：
${rubric.map((r, i) => `${i + 1}. ${r}`).join("\n")}

请对每一条标准给出 pass（是否满足）和 reason（一句话说明判断依据）。只判断事实是否满足，不要因为表达风格扣分。`,
    output: Output.object({
      schema: z.object({
        checks: z
          .array(
            z.object({
              pass: z.boolean().describe("该条标准是否满足"),
              reason: z.string().describe("一句话说明判断依据"),
            })
          )
          .describe(`逐条对应上述评估标准，共 ${rubric.length} 条，顺序一致`),
      }),
    }),
  });
  return result.output.checks;
}

async function main() {
  const results: {
    scenario: string;
    input: string;
    answer: string;
    ruleIssues: string[];
    checks: { criterion: string; pass: boolean; reason: string }[];
    pass: boolean;
  }[] = [];

  for (const item of evalSet) {
    // ① 被评估对象生成回答
    const answer = await generateText({
      model: deepseek("deepseek-chat"),
      instructions: SYSTEM,
      prompt: item.input,
    });
    const text = answer.text;

    // ② 规则前置检查：不通过直接判失败，跳过 LLM 裁判
    const ruleIssues = ruleCheck(text);
    let checks: { criterion: string; pass: boolean; reason: string }[] = [];
    let pass = ruleIssues.length === 0;

    if (pass) {
      // ③ LLM-as-judge 逐条判定 rubric
      const raw = await judge(item.input, text, item.rubric);
      checks = item.rubric.map((criterion, i) => {
        const c = raw[i];
        return {
          criterion,
          pass: c?.pass ?? false,
          reason: c?.reason ?? "（裁判未返回该条）",
        };
      });
      pass = checks.every((c) => c.pass); // 全部标准通过才算通过
    }

    results.push({ scenario: item.scenario, input: item.input, answer: text, ruleIssues, checks, pass });

    // 逐条打印
    console.log(`\n❓ [${item.scenario}] ${item.input}`);
    console.log(`💬 ${text}`);
    if (ruleIssues.length) {
      console.log(`🚫 规则检查未通过：${ruleIssues.join("；")}`);
    } else {
      for (const c of checks) {
        console.log(`  ${c.pass ? "✅" : "❌"} ${c.criterion} —— ${c.reason}`);
      }
    }
  }

  // ④ 分场景 + 总计报告
  const byScenario = new Map<string, { total: number; pass: number }>();
  for (const r of results) {
    const s = byScenario.get(r.scenario) ?? { total: 0, pass: 0 };
    s.total++;
    if (r.pass) s.pass++;
    byScenario.set(r.scenario, s);
  }
  const totalPass = results.filter((r) => r.pass).length;
  const overall = ((totalPass / results.length) * 100).toFixed(1);

  console.log("\n📊 评估报告");
  console.log("──────────────────────────────");
  for (const [scenario, s] of byScenario) {
    const pct = ((s.pass / s.total) * 100).toFixed(0);
    console.log(`  ${scenario}  ${s.pass}/${s.total}  ${pct}%`);
  }
  console.log("──────────────────────────────");
  console.log(`  总计  ${totalPass}/${results.length}  ${overall}%`);

  // ⑤ 落盘：方便回归对比 / 进 CI
  writeFileSync(
    "eval-results.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        system: SYSTEM,
        total: results.length,
        pass: totalPass,
        overall: `${overall}%`,
        cases: results,
      },
      null,
      2
    )
  );
  console.log("\n💾 已写入 eval-results.json");
}

main().catch((err) => {
  console.error("❌ 调用失败：", err.message);
  process.exit(1);
});
