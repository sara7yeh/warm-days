import { z } from "zod";
import { type LifeService } from "./service";
import { dateSchema, records } from "./model";
import { occurrences } from "./domain";
// Optional browser standard. Unsupported browsers retain the exact same UI behavior.
export function registerLocalTools(service: LifeService) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: unknown,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: "read_day_schedule",
          title: "查看暖日日程",
          description:
            "读取当前浏览器中指定日期的日程及待办，不上传数据，也不修改记录。",
          inputSchema: {
            type: "object",
            properties: {
              date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
            },
            required: ["date"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          async execute(input: unknown) {
            const { date } = z
              .object({ date: dateSchema })
              .strict()
              .parse(input);
            const s = await service.repository.load();
            return {
              date,
              events: occurrences(s, date, date).map((e) => ({
                title: e.title,
                time: e.time ?? null,
                category: e.category,
                done: e.done,
              })),
              tasks: records(s, "task")
                .filter((t) => t.date === date)
                .map((t) => ({ title: t.title, done: t.done })),
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {}
  return () => lifecycle.abort();
}
