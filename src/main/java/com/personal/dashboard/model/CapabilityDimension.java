package com.personal.dashboard.model;

/**
 * 能力维度（对应「能力成长地图」，8 个维度 1-5 分）
 */
public record CapabilityDimension(
        String name,
        int score,
        int target,
        String reasoning,
        String evidence
) {
    public CapabilityDimension withTarget(int newTarget) {
        return new CapabilityDimension(name, score, newTarget, reasoning, evidence);
    }

    public CapabilityDimension withAssessment(int newScore, String newReasoning, String newEvidence) {
        return new CapabilityDimension(name, newScore, target, newReasoning, newEvidence);
    }
}
