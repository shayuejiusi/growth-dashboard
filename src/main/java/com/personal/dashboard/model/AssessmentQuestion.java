package com.personal.dashboard.model;

import java.util.List;

/**
 * 能力评估题目：情景选择题，每个选项对应 1-5 分
 */
public record AssessmentQuestion(
        String id,
        String dimension,
        String scenario,
        List<Option> options
) {
    public record Option(String label, String text, int score) {}
}
