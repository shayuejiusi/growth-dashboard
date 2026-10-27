package com.personal.dashboard.ai;

import com.personal.dashboard.model.AssessmentQuestion;
import com.personal.dashboard.model.AssessmentQuestion.Option;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.model.ReviewDraft;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 内置规则引擎：AI 未配置远程服务时的兜底实现，离线可用。
 * 所有输出均为结构化草稿，供用户在此基础上修改。
 */
@Component
public class LocalHeuristicAiService implements AiService {

    private static final List<String> DIMENSIONS = List.of(
            "结构化表达", "情绪中立沟通", "主动预判", "主动解决问题",
            "跨部门协作", "团队管理与任务分配", "风险意识", "人才识别与培养");

    @Override
    public boolean isConfigured() { return true; }

    @Override
    public String providerName() { return "local（内置规则引擎）"; }

    // ==================== 文档识别生成待办 ====================

    private static final Pattern DATE_CN = Pattern.compile("(\\d{1,2})月(\\d{1,2})[日号]");
    private static final Pattern WEEKDAY = Pattern.compile("周([一二三四五六日天])");

    @Override
    public List<TaskDraft> extractTasks(String text) {
        List<TaskDraft> drafts = new ArrayList<>();
        if (text == null || text.isBlank()) return drafts;
        LocalDate today = LocalDate.now();
        for (String raw : text.split("[\\n；;]+")) {
            String line = raw.replaceAll("^[\\s\\-*•]+", "")
                    .replaceAll("^\\d{1,3}[.、)）]\\s*", "").trim();
            if (line.length() < 4) continue;

            String priority = "P2";
            if (line.contains("紧急") || line.contains("P0") || line.contains("立即")) priority = "P0";
            else if (line.contains("重要") || line.contains("P1") || line.contains("尽快")) priority = "P1";

            LocalDate due = null;
            Matcher m = DATE_CN.matcher(line);
            if (m.find()) {
                due = LocalDate.of(today.getYear(), Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)));
                if (due.isBefore(today.minusDays(30))) due = due.plusYears(1);
            } else if (line.contains("今天") || line.contains("今日")) due = today;
            else if (line.contains("明天") || line.contains("明日")) due = today.plusDays(1);
            else if (line.contains("本周") || line.contains("周末前")) {
                int dow = today.getDayOfWeek().getValue();
                due = today.plusDays(dow == 7 ? 0 : 7 - dow);
            } else {
                Matcher w = WEEKDAY.matcher(line);
                if (w.find()) {
                    int target = "一二三四五六日天".indexOf(w.group(1)) % 7 + 1;
                    int diff = (target - today.getDayOfWeek().getValue() + 7) % 7;
                    due = today.plusDays(diff == 0 ? 7 : diff);
                }
            }

            boolean needReport = line.contains("汇报") || line.contains("上报") || line.contains("请示");

            List<String> caps = new ArrayList<>();
            if (line.contains("汇报") || line.contains("总结") || line.contains("方案")) caps.add("结构化表达");
            if (line.contains("协调") || line.contains("对接") || line.contains("沟通")) caps.add("跨部门协作");
            if (line.contains("排查") || line.contains("风险") || line.contains("安全")) caps.add("风险意识");
            if (line.contains("安排") || line.contains("分工") || line.contains("值班")) caps.add("团队管理与任务分配");
            if (line.contains("提前") || line.contains("预判") || line.contains("准备")) caps.add("主动预判");
            if (line.contains("培训") || line.contains("培养") || line.contains("带教")) caps.add("人才识别与培养");
            if (caps.isEmpty()) caps.add("主动解决问题");

            drafts.add(new TaskDraft(line, priority, due == null ? null : due.toString(), needReport, caps));
        }
        return drafts;
    }

    // ==================== 能力维度自动评估 ====================

    @Override
    public List<CapabilityAssessment> assessCapabilities(CapabilityContext ctx) {
        Map<String, Object> ts = ctx.taskStats() == null ? Map.of() : ctx.taskStats();
        int done = asInt(ts.get("completedTotal"));
        int overdue = asInt(ts.get("overdue"));
        int reported = asInt(ts.get("reportedCount"));

        List<CapabilityAssessment> out = new ArrayList<>();
        for (String dim : DIMENSIONS) {
            int score = switch (dim) {
                case "结构化表达" -> clamp(2 + (reported > 0 ? 1 : 0));
                case "情绪中立沟通" -> 2;
                case "主动预判" -> clamp(2 + (overdue == 0 && done > 0 ? 1 : 0));
                case "主动解决问题" -> clamp(2 + Math.min(done, 2));
                case "跨部门协作" -> clamp(2 + (done >= 3 ? 1 : 0));
                case "团队管理与任务分配" -> 2;
                case "风险意识" -> clamp(3 + (overdue == 0 ? 1 : -1));
                case "人才识别与培养" -> 2;
                default -> 2;
            };
            String evidence = "近期待办完成 %d 项、逾期 %d 项".formatted(done, overdue);
            String reasoning = "基于任务数据的自动评估（本地规则引擎草稿）：%s。".formatted(evidence);
            out.add(new CapabilityAssessment(dim, score, reasoning, evidence));
        }
        return out;
    }

    // ==================== 能力评估出题 ====================

    @Override
    public List<AssessmentQuestion> generateAssessmentQuestions(AssessmentContext ctx) {
        // 内置题库：8 维度 × 2 道情景选择题，选项分值 1-5
        List<AssessmentQuestion> qs = new ArrayList<>();
        int n = 1;
        n = add(qs, n, "结构化表达", "向领导汇报一项进展不顺的工作时，你通常会：",
                o("A", "先把过程完整讲一遍，最后再谈结果", 2),
                o("B", "开口先说结论，再用 2-3 个关键事实支撑，最后给出方案", 5),
                o("C", "重点讲清楚遇到的困难和客观原因", 3),
                o("D", "等领导追问时再逐步说明", 1));
        n = add(qs, n, "结构化表达", "撰写一份需要上级审阅的活动方案时，你会：",
                o("A", "按「背景—目标—方案—资源—风险」结构化呈现", 5),
                o("B", "把想到的内容尽量都写上，宁多勿少", 1),
                o("C", "找一份旧模板套用修改", 3),
                o("D", "先口头汇报，通过后再补文字", 2));
        n = add(qs, n, "情绪中立沟通", "同事在会议上情绪激动地当众质疑你的方案，你会：",
                o("A", "立即反驳，当面说清楚", 1),
                o("B", "先复述确认对方观点，再平静陈述事实与数据", 5),
                o("C", "会上沉默，会后再单独沟通", 3),
                o("D", "请在场领导评理", 2));
        n = add(qs, n, "情绪中立沟通", "面对情绪激动的投诉方（家长/客户/合作方），你会：",
                o("A", "逐条解释相关规定和流程", 2),
                o("B", "先接纳情绪再处理事情，用「我观察到……我理解……」句式开场", 5),
                o("C", "转交给其他同事处理", 1),
                o("D", "先道歉并承诺尽快整改", 3));
        n = add(qs, n, "主动预判", "接到一项两周后截止的重要任务，你的第一反应是：",
                o("A", "时间还早，截止前两天再集中处理", 1),
                o("B", "立即拆解节点，识别依赖项和潜在风险并提前部署", 5),
                o("C", "先做起来，边做边看", 2),
                o("D", "排进日程，按既定计划推进", 4));
        n = add(qs, n, "主动预判", "当各项工作都在顺利推进时，你会：",
                o("A", "难得轻松，先歇一歇", 1),
                o("B", "例行检查各环节，留意潜在风险点", 4),
                o("C", "主动向领导申请新任务", 3),
                o("D", "建立风险清单并设置关键预警线", 5));
        n = add(qs, n, "主动解决问题", "发现一个不在你职责范围内的问题，你会：",
                o("A", "不归我管，不去碰", 1),
                o("B", "上报相关方，并附上自己的可行建议", 4),
                o("C", "先自己想办法解决，再同步结果", 5),
                o("D", "口头提醒一下相关负责人", 3));
        n = add(qs, n, "主动解决问题", "遇到一个从未处理过的问题，你会：",
                o("A", "等领导给出明确指示再动手", 1),
                o("B", "查资料、请教前辈，形成自己的方案后再请示", 5),
                o("C", "凭过往经验先试试", 3),
                o("D", "转交给更有经验的同事", 2));
        n = add(qs, n, "跨部门协作", "需要其他部门配合推进一项工作时，你会：",
                o("A", "发正式通知，等对方回复", 2),
                o("B", "先了解对方诉求和难处，再谈分工与共赢点", 5),
                o("C", "请领导出面施压推进", 1),
                o("D", "先一对一沟通，再开会确认分工并留痕", 4));
        n = add(qs, n, "跨部门协作", "协作部门的进度明显滞后，影响到你的节点，你会：",
                o("A", "发函催促并抄送领导", 2),
                o("B", "升级给双方领导协调", 3),
                o("C", "主动了解卡点，给出最小依赖的启动方案", 5),
                o("D", "在联合群里点名提醒", 1));
        n = add(qs, n, "团队管理与任务分配", "给团队成员分配任务时，你通常：",
                o("A", "平均分配，人人有份", 2),
                o("B", "按能力特点匹配任务，明确完成标准与时间节点", 5),
                o("C", "谁有空就分给谁", 1),
                o("D", "让大家自愿认领", 3));
        n = add(qs, n, "团队管理与任务分配", "团队成员进度滞后时，你会：",
                o("A", "严肃批评，要求加班赶上", 1),
                o("B", "了解原因，调整分工或提供支持资源", 5),
                o("C", "自己接手把活干了", 3),
                o("D", "等到截止日再看结果", 2));
        n = add(qs, n, "风险意识", "大型活动或重要项目启动前，你会：",
                o("A", "按计划执行，不必多想", 2),
                o("B", "做全面风险排查，制定预案并留痕备查", 5),
                o("C", "出了问题再补救也来得及", 1),
                o("D", "重点环节检查一下即可", 3));
        n = add(qs, n, "风险意识", "发现一个暂时影响不大的隐患，你会：",
                o("A", "影响不大，先忽略", 1),
                o("B", "记录下来并持续观察", 3),
                o("C", "立即整改，并复盘根因防止复发", 5),
                o("D", "随口跟同事提一句", 2));
        n = add(qs, n, "人才识别与培养", "日常观察团队成员时，你更注重：",
                o("A", "只看任务是否按时完成", 2),
                o("B", "结合绩效与潜力做定位，持续记录观察", 5),
                o("C", "凭日常相处的印象", 1),
                o("D", "出了问题才重点关注", 2));
        add(qs, n, "人才识别与培养", "有新人加入团队时，你会：",
                o("A", "让他自己摸索，成长更快", 1),
                o("B", "指定带教人，设定阶段目标并定期反馈", 5),
                o("C", "交给经验丰富的老员工带着", 3),
                o("D", "先观察一段时间再说", 2));
        return qs;
    }

    private static Option o(String label, String text, int score) {
        return new Option(label, text, score);
    }

    private static int add(List<AssessmentQuestion> qs, int n, String dim, String scenario, Option... options) {
        qs.add(new AssessmentQuestion("q" + n, dim, scenario, List.of(options)));
        return n + 1;
    }

    // ==================== 日复盘 ====================

    @Override
    public ReviewDraft generateDailyReview(ReviewContext ctx) {
        Map<String, Object> metrics = new java.util.LinkedHashMap<>(ctx.metrics() == null ? Map.of() : ctx.metrics());
        List<String> completed = ctx.completedToday() == null ? List.of() : ctx.completedToday();
        List<String> overdue = ctx.overdueTitles() == null ? List.of() : ctx.overdueTitles();

        String overdueAnalysis = overdue.isEmpty()
                ? "今日无逾期任务，风险前置工作到位，继续保持。"
                : "今日逾期 %d 项：%s。建议逐项确认阻塞原因，能今天闭环的不留到明天。".formatted(overdue.size(), String.join("、", overdue));

        String reportQuality = ctx.reportedToday() == null || ctx.reportedToday().isEmpty()
                ? "今日无正式汇报。若有需汇报任务，请按「结论—事实—判断—请示」结构补齐。"
                : "今日完成 %d 次汇报。自查：是否开口先给结论？是否带方案而非只抛问题？".formatted(ctx.reportedToday().size());

        List<String> highlights = new ArrayList<>();
        if (!completed.isEmpty()) highlights.add("完成 %d 项任务：%s".formatted(completed.size(), String.join("、", completed)));
        if (overdue.isEmpty()) highlights.add("零逾期，风险管控在线。");
        if (highlights.isEmpty()) highlights.add("今日数据较少，建议补齐任务录入以便复盘更准确。");

        List<String> improvements = new ArrayList<>();
        if (!overdue.isEmpty()) improvements.add("逾期任务需分析根因：是排期过紧、依赖未到位还是预估不足？");
        improvements.add("汇报闭环：每个需汇报任务都要有书面留痕。");

        List<String> tomorrowGoals = List.of(
                "清零高优先级任务，P0/P1 不过夜；",
                "完成一次结构化汇报练习（结论先行）；",
                "对逾期风险提前一天预警。");

        return new ReviewDraft(LocalDate.now(), metrics, overdueAnalysis, reportQuality,
                "今日无突出协作冲突记录；如有跨部门卡点，请记录具体事项与各方诉求。",
                highlights, improvements, tomorrowGoals, "结构化表达");
    }

    // ==================== 每日精选 ====================

    @Override
    public DailyContent curateDailyContent(ContentContext ctx) {
        List<String> weak = ctx.weakDimensions() == null || ctx.weakDimensions().isEmpty()
                ? List.of("结构化表达", "情绪中立沟通") : ctx.weakDimensions();
        DailyContent.ContentItem a1 = new DailyContent.ContentItem(
                "中层管理者如何汇报：结构化表达让决策更高效",
                "https://docs.pingcode.com/insights/ymrih7f15i0aic2d8xsisa20", "PingCode 洞察",
                List.of("汇报用“结论—证据—行动—风险”框架，开口先给结论",
                        "风险上报用“事实—影响—对策”三段式",
                        "按受众调整颗粒度，10 分钟简报按 60-30-10 分配时间"),
                "本周汇报先用一句话说结论，再按三段式补齐细节。");
        DailyContent.ContentItem a2 = new DailyContent.ContentItem(
                "职场冲突的非暴力沟通技巧：化解矛盾的艺术与实践",
                "https://m.jingliren.org/zc/zcxr/316345.html", "经理人网",
                List.of("非暴力沟通四要素：观察、感受、需求、请求",
                        "先处理情绪再处理事情",
                        "先识别冲突根源，再选择沟通策略"),
                "下次处理矛盾时用“我观察到……我感到……我需要……”开场。");
        DailyContent.ContentItem v1 = new DailyContent.ContentItem(
                "马歇尔·卢森堡：非暴力沟通基础工作坊（全集）",
                "https://www.bilibili.com/video/BV1BJ411n76x/", "哔哩哔哩",
                List.of("创始人亲授四要素底层逻辑", "大量现场案例演示", "“情绪中立”是看清情绪背后的需要"),
                "观看前 30 分钟，记录一个可套用句式，明天用一次。");
        return new DailyContent(LocalDate.now(), weak, List.of(a1, a2), List.of(v1),
                "（本地内容库）配置 AI 服务后将围绕能力短板实时检索更新。今日聚焦：" + String.join("、", weak));
    }

    private static int asInt(Object o) {
        return o instanceof Number n ? n.intValue() : 0;
    }

    private static int clamp(int score) {
        return Math.max(1, Math.min(5, score));
    }
}
