package com.personal.dashboard.ai;

import com.personal.dashboard.model.AssessmentQuestion;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.model.ReviewDraft;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * AI 调用网关：Controller 统一入口。
 * 远程 AI 已配置时优先调用，失败或未配置时自动回退本地规则引擎。
 */
@Service
public class AiGateway implements AiService {

    private static final Logger log = LoggerFactory.getLogger(AiGateway.class);

    private final OpenAiCompatibleAiService remote;
    private final LocalHeuristicAiService local;

    public AiGateway(OpenAiCompatibleAiService remote, LocalHeuristicAiService local) {
        this.remote = remote;
        this.local = local;
    }

    @Override
    public boolean isConfigured() { return remote.isConfigured(); }

    @Override
    public String providerName() {
        return remote.isConfigured() ? remote.providerName() : local.providerName();
    }

    private interface Call<T> {
        T run(AiService service);
    }

    private <T> T route(Call<T> call) {
        if (remote.isConfigured()) {
            try {
                return call.run(remote);
            } catch (Exception e) {
                log.warn("远程 AI 调用失败，回退本地规则引擎: {}", e.getMessage());
            }
        }
        return call.run(local);
    }

    @Override
    public List<TaskDraft> extractTasks(String text) {
        return route(s -> s.extractTasks(text));
    }

    /**
     * 文档识别（快速新增任务弹窗用）。
     * kind: doc 文档/纪要 | official 收文/教育局文件；mode: ai 远程优先 | local 强制本地规则引擎。
     */
    public List<TaskDraft> extractTasks(String text, String kind, String mode) {
        if ("local".equalsIgnoreCase(mode)) {
            return local.extractTasks(text, kind);
        }
        // 远程未配置或调用失败都必须如实反馈；离线能力由用户显式选择本地模式。
        if (remote.isConfigured()) {
            return remote.extractTasks(text, kind);
        }
        throw new OpenAiCompatibleAiService.AiCallException(
                "AI 尚未配置，请配置服务端 API Key 或使用本地快速识别");
    }

    @Override
    public List<CapabilityAssessment> assessCapabilities(CapabilityContext context) {
        return route(s -> s.assessCapabilities(context));
    }

    @Override
    public List<AssessmentQuestion> generateAssessmentQuestions(AssessmentContext context) {
        return route(s -> s.generateAssessmentQuestions(context));
    }

    @Override
    public ReviewDraft generateDailyReview(ReviewContext context) {
        return route(s -> s.generateDailyReview(context));
    }

    @Override
    public DailyContent curateDailyContent(ContentContext context) {
        return route(s -> s.curateDailyContent(context));
    }
}
