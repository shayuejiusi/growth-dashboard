package com.personal.dashboard.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.personal.dashboard.ai.AiGateway;
import com.personal.dashboard.ai.AiService.ContentContext;
import com.personal.dashboard.model.CapabilityDimension;
import com.personal.dashboard.model.DailyContent;
import com.personal.dashboard.service.JsonDocService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 每日精选文章与视频 API
 */
@RestController
@RequestMapping("/api/content")
public class ContentController {

    private final JsonDocService docs;
    private final com.personal.dashboard.service.CapabilityService capabilities;
    private final AiGateway ai;

    public ContentController(JsonDocService docs, com.personal.dashboard.service.CapabilityService capabilities, AiGateway ai) {
        this.docs = docs;
        this.capabilities = capabilities;
        this.ai = ai;
    }

    @GetMapping("/daily")
    public DailyContent daily() {
        return docs.load("content", new TypeReference<>() {}, () -> null);
    }

    /** AI 刷新今日精选：围绕当前能力短板重新推荐 */
    @PostMapping("/daily/refresh")
    public DailyContent refresh() {
        List<CapabilityDimension> dims = capabilities.all();
        List<String> weak = dims.stream()
                .filter(d -> d.score() < d.target())
                .sorted((a, b) -> Integer.compare(a.score() - a.target(), b.score() - b.target()))
                .limit(2)
                .map(CapabilityDimension::name)
                .toList();
        DailyContent previous = daily();
        DailyContent fresh = ai.curateDailyContent(new ContentContext(weak,
                previous == null ? "" : previous.articles().stream().map(DailyContent.ContentItem::title).toList().toString()));
        docs.save("content", fresh);
        return fresh;
    }
}
