// tools.ts
// Agent 可调用的工具。description 是给 LLM 看的"使用说明书"，
// 直接决定 AI 能否在正确场景选中正确的工具。
import { tool } from "ai";
import { z } from "zod";

// 天气工具
export const getWeather = tool({
  description:
    "查询指定城市的当前天气。当用户询问天气、气温、是否下雨、是否适合出门等问题时使用。",
  inputSchema: z.object({
    city: z.string().describe("城市名称，例如 '北京'、'上海'"),
  }),
  execute: async ({ city }) => {
    // 演示用模拟数据；真实项目里替换成天气 API 调用
    const temp = Math.floor(Math.random() * 25) + 5;
    const conditions = ["晴", "多云", "小雨"] as const;
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    return { city, temperature: temp, condition };
  },
});

// 日期时间工具
export const getCurrentDateTime = tool({
  description:
    "获取当前日期和时间。当用户询问今天几号、现在几点、今天星期几时使用。",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    return {
      date: now.toLocaleDateString("zh-CN"),
      time: now.toLocaleTimeString("zh-CN"),
      weekday: weekdays[now.getDay()],
    };
  },
});
