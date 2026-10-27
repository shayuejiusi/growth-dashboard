package com.personal.dashboard.model;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 日复盘草稿（对应「日复盘与人才筛选」的复盘部分）
 */
public record ReviewDraft(
        LocalDate date,
        Map<String, Object> metrics,
        String overdueAnalysis,
        String reportQuality,
        String collabIssues,
        List<String> highlights,
        List<String> improvements,
        List<String> tomorrowGoals,
        String focusCapability
) {}
