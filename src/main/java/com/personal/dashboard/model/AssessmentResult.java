package com.personal.dashboard.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 能力评估结果
 */
public record AssessmentResult(
        String username,
        LocalDateTime completedAt,
        int questionCount,
        Map<String, Integer> dimensionScores,
        int overallScore,
        String comment,
        List<String> answers
) {}
