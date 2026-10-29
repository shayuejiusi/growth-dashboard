package com.personal.dashboard.ai;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.personal.dashboard.model.AssessmentQuestion;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.model.ReviewDraft;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * OpenAI Chat Completions 兼容服务的 AI 实现。
 *
 * 兼容 OpenAI / DeepSeek / 通义千问(compatible-mode) / Ollama 等任何
 * 实现了 POST {base-url}/chat/completions 的服务。通过配置启用：
 * <pre>
 *   ai.provider=openai-compatible
 *   ai.base-url=https://api.deepseek.com/v1
 *   ai.api-key=sk-xxxx
 *   ai.model=deepseek-chat
 * </pre>
 * 未配置 api-key 或调用失败时，由 {@link AiGateway} 自动回退本地规则引擎。
 */
@Component
public class OpenAiCompatibleAiService implements AiService {

    private final AiProperties props;
    private final ObjectMapper mapper;
    private final HttpClient http;

    public OpenAiCompatibleAiService(AiProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
    }

    @Override
    public boolean isConfigured() { return props.remoteEnabled(); }

    @Override
    public String providerName() {
        return "openai-compatible（" + props.getModel() + " @ " + props.getBaseUrl() + "）";
    }

    /** 远程调用异常，触发网关回退 */
    public static class AiCallException extends RuntimeException {
        public AiCallException(String msg, Throwable cause) { super(msg, cause); }
        public AiCallException(String msg) { super(msg); }
    }

    private static final String JSON_INSTRUCTION = """
            你是个人效能教练。严格只输出一个 JSON 对象或数组，不要输出任何其他文字、解释或 Markdown 代码块标记。
            """;

    private <T> T chat(String userPrompt, TypeReference<T> type) {
        if (!isConfigured()) throw new AiCallException("AI 未配置 api-key");
        try {
            Map<String, Object> body = Map.of(
                    "model", props.getModel(),
                    "messages", List.of(
                            Map.of("role", "system", "content", JSON_INSTRUCTION),
                            Map.of("role", "user", "content", userPrompt)),
                    "temperature", 0.4);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(props.getBaseUrl().replaceAll("/+$", "") + "/chat/completions"))
                    .timeout(Duration.ofSeconds(props.getTimeoutSeconds()))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + props.getApiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new AiCallException("AI 服务返回 HTTP " + response.statusCode() + ": "
                        + response.body().lines().limit(3).reduce("", (a, b) -> a + b));
            }
            JsonNode root = mapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText();
            if (content == null || content.isBlank()) throw new AiCallException("AI 返回内容为空");
            String json = content.trim()
                    .replaceAll("^```(?:json)?\\s*", "")
                    .replaceAll("\\s*```$", "");
            return mapper.readValue(json, type);
        } catch (AiCallException e) {
            throw e;
        } catch (Exception e) {
            throw new AiCallException("AI 调用失败: " + e.getMessage(), e);
        }
    }

    @Override
    public List<TaskDraft> extractTasks(String text) {
        return extractTasks(text, "doc");
    }

    private record TaskDraftEnvelope(List<TaskDraft> tasks) {}

    @Override
    public List<TaskDraft> extractTasks(String text, String kind) {
        TaskDraftEnvelope envelope = chat(SchoolTaskPrompt.forDocument(text, kind), new TypeReference<>() {});
        if (envelope == null || envelope.tasks() == null) {
            throw new AiCallException("AI 返回内容缺少 tasks 数组");
        }
        return envelope.tasks().stream().map(this::validateTaskDraft).toList();
    }

    /** 不信任上游结构：进入预览前校验所有会影响任务入库的字段。 */
    private TaskDraft validateTaskDraft(TaskDraft draft) {
        if (draft == null) throw new AiCallException("AI 返回了空任务");
        String title = draft.title() == null ? "" : draft.title().trim();
        if (title.isEmpty() || title.length() > 255) {
            throw new AiCallException("AI 返回的任务标题为空或超过 255 字");
        }
        if (!List.of("P0", "P1", "P2").contains(draft.priority())) {
            throw new AiCallException("AI 返回了无效优先级");
        }
        if (!List.of("德育", "教学", "行政").contains(draft.category())) {
            throw new AiCallException("AI 返回了无效工作分类");
        }
        if (draft.dueDate() != null) {
            try {
                if (!java.time.LocalDate.parse(draft.dueDate()).toString().equals(draft.dueDate())) {
                    throw new AiCallException("AI 返回的截止日期格式不正确");
                }
            } catch (java.time.format.DateTimeParseException e) {
                throw new AiCallException("AI 返回了无效截止日期", e);
            }
        }
        String sourceText = draft.sourceText() == null ? "" : draft.sourceText().trim();
        if (sourceText.isEmpty()) throw new AiCallException("AI 返回的任务缺少原文依据");
        Double confidence = draft.confidence();
        if (confidence == null || confidence < 0 || confidence > 1) {
            throw new AiCallException("AI 返回了无效置信度");
        }
        boolean needsReview = draft.needsReview() || confidence < 0.8;
        String reviewReason = needsReview
                ? (draft.reviewReason() == null || draft.reviewReason().isBlank()
                    ? "AI 置信度较低，请复核分类、日期和任务要求。" : draft.reviewReason().trim())
                : null;
        return new TaskDraft(title, draft.priority(), draft.dueDate(), draft.needReport(),
                List.of(), draft.category(), sourceText, confidence, needsReview, reviewReason);
    }

    @Override
    public List<CapabilityAssessment> assessCapabilities(CapabilityContext ctx) {
        String prompt = """
                依据以下工作数据评估个人能力，输出 JSON 数组，每个元素：
                {"name":"维度名","score":1到5的整数,"reasoning":"评估推理","evidence":"数据依据"}
                必须覆盖全部 8 个维度：%s
                任务统计：%s
                """.formatted(String.join("、", ctx.currentDimensions()), ctx.taskStats());
        return chat(prompt, new TypeReference<>() {});
    }

    @Override
    public List<AssessmentQuestion> generateAssessmentQuestions(AssessmentContext ctx) {
        String prompt = """
                为能力评估生成情景选择题，覆盖全部 8 个维度，每个维度 2 道题，共 16 道。
                输出 JSON 数组，每个元素：
                {"id":"q1","dimension":"维度名","scenario":"工作情景题干",
                 "options":[{"label":"A","text":"选项描述","score":1到5的整数}]}
                要求：题干为真实工作情景；每题 4 个选项，分值按行为成熟度区分（最优行为=5 分，最差=1 分）；
                选项顺序随机，不要把高分选项固定在同一个位置。角色背景：%s
                维度：%s
                """.formatted(ctx.roleHint(), String.join("、", ctx.dimensions()));
        return chat(prompt, new TypeReference<>() {});
    }

    @Override
    public ReviewDraft generateDailyReview(ReviewContext ctx) {
        String prompt = """
                基于今日工作数据生成日复盘，字段：
                {"date":"%s","metrics":{},"overdueAnalysis":"逾期分析","reportQuality":"汇报质量",
                 "collabIssues":"协作问题","highlights":["亮点"],"improvements":["改进点"],
                 "tomorrowGoals":["明日目标"],"focusCapability":"建议聚焦能力"}
                今日指标：%s
                已完成：%s
                逾期：%s
                已汇报：%s
                """.formatted(java.time.LocalDate.now(), ctx.metrics(),
                ctx.completedToday(), ctx.overdueTitles(), ctx.reportedToday());
        return chat(prompt, new TypeReference<>() {});
    }

    @Override
    public DailyContent curateDailyContent(ContentContext ctx) {
        String prompt = """
                围绕以下能力短板，推荐今日学习内容（2 篇文章 + 1 个视频，需真实可访问的链接），字段：
                {"date":"%s","matchedDimensions":["维度"],
                 "articles":[{"title":"","url":"","source":"","points":["要点"],"action":"行动建议"}],
                 "videos":[{"title":"","url":"","source":"","points":["要点"],"action":"行动建议"}],
                 "notice":"学习提示"}
                能力短板：%s
                近期主题（避免重复）：%s
                """.formatted(java.time.LocalDate.now(),
                String.join("、", ctx.weakDimensions()), ctx.recentTopics());
        return chat(prompt, new TypeReference<>() {});
    }
}
