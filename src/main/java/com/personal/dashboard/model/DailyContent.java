package com.personal.dashboard.model;

import java.time.LocalDate;
import java.util.List;

/**
 * 每日精选内容（文章 + 视频）
 */
public record DailyContent(
        LocalDate date,
        List<String> matchedDimensions,
        List<ContentItem> articles,
        List<ContentItem> videos,
        String notice
) {
    public record ContentItem(
            String title,
            String url,
            String source,
            List<String> points,
            String action
    ) {}
}
