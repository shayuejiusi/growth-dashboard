package com.personal.dashboard.ai;

import com.personal.dashboard.model.AssessmentQuestion;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.model.ReviewDraft;

import java.util.List;
import java.util.Map;

/**
 * AI 能力接口层 —— 看板中所有需要 AI 的功能都通过此接口调用。
 *
 * 现有两个实现：
 *  - {@link LocalHeuristicAiService}：内置规则引擎，离线可用，作为兜底；
 *  - {@link OpenAiCompatibleAiService}：接入任何 OpenAI Chat Completions 兼容服务
 *    （OpenAI / DeepSeek / 通义千问 / Ollama 本地模型等），
 *    在 application.properties 中配置 ai.api-key 后自动启用。
 *
 * 调用方（Controller）只依赖 {@link AiGateway}，无需关心底层实现。
 */
public interface AiService {

    /** 当前实现是否处于可用状态（远程实现未配置 key 时为 false） */
    boolean isConfigured();

    /** 实现名称，用于 /api/ai/status 展示 */
    String providerName();

    /** 文档识别生成待办：从一段文字中提取任务清单 */
    List<TaskDraft> extractTasks(String text);

    /**
     * 文档识别（带文档类型）。kind: "doc" 文档/纪要（默认）| "official" 收文/教育局文件。
     * 默认实现忽略类型；远程实现可针对不同类型使用专门的提示词。
     */
    default List<TaskDraft> extractTasks(String text, String kind) {
        return extractTasks(text);
    }

    /** 能力成长地图：依据任务完成情况自动评估 8 个维度 */
    List<CapabilityAssessment> assessCapabilities(CapabilityContext context);

    /** 能力评估：整合 8 个评估维度生成情景选择题 */
    List<AssessmentQuestion> generateAssessmentQuestions(AssessmentContext context);

    /** 日复盘：基于当日数据生成复盘草稿 */
    ReviewDraft generateDailyReview(ReviewContext context);

    /** 每日精选：围绕能力短板推荐 2 篇文章 + 1 个视频 */
    DailyContent curateDailyContent(ContentContext context);

    // ==================== DTO ====================

    /** 从文本中提取的任务草稿 */
    record TaskDraft(String title, String priority, String dueDate,
                     boolean needReport, List<String> capabilities) {}

    /** 能力评估上下文：任务统计 */
    record CapabilityContext(Map<String, Object> taskStats,
                             List<String> currentDimensions) {}

    /** 单个维度的评估结果 */
    record CapabilityAssessment(String name, int score, String reasoning, String evidence) {}

    /** 评估出题上下文：维度清单 + 用户角色描述 */
    record AssessmentContext(List<String> dimensions, String roleHint) {}

    /** 日复盘上下文 */
    record ReviewContext(Map<String, Object> metrics,
                         List<String> completedToday,
                         List<String> overdueTitles,
                         List<String> reportedToday) {}

    /** 每日精选上下文 */
    record ContentContext(List<String> weakDimensions, String recentTopics) {}
}
